'use client';
import {collection,doc,getDoc,getDocs,onSnapshot,runTransaction,setDoc,writeBatch,type DocumentData} from 'firebase/firestore';
import {firestore} from './firebase-client';
import {inheritedDirection,shiftedPlan,type ActualData,type ConflictData,type CoreEntity,type EntityType,type ExecutionSessionData,type PlanData,type RoutineFlowData,type RoutineRunData,type SleepRecordData,type TaskData} from '../domain/core';
import {CURRENT_SCHEMA_VERSION,assertMigrationCandidate,countEntities,createSnapshotMigrationPlan,migrateEntity,migrateSnapshot,type StoredEntity} from '../domain/schema';
import {executionActualId,startRoutineRunPayload} from '../domain/execution';

export type SyncState='接続中'|'同期済み'|'オフライン'|'同期エラー';
const deviceId=()=>{let id=localStorage.getItem('liflow_device_id_v1');if(!id){id=`device_${crypto.randomUUID()}`;localStorage.setItem('liflow_device_id_v1',id)}return id};
const entityFromDoc=(id:string,data:DocumentData):StoredEntity=>({id,type:data.type as EntityType,payload:data.payload||{},schemaVersion:Number(data.schemaVersion||1),revision:Number(data.revision||1),createdAt:String(data.createdAt||''),updatedAt:String(data.updatedAt||''),updatedBy:String(data.updatedBy||''),deletedAt:data.deletedAt?String(data.deletedAt):null});
export type BackupSummary={id:string;timestamp:string;dataCount:number;status:string;schemaVersion:number;reason?:string};

async function createSafetyBackup(uid:string,source:StoredEntity[],reason:string){const backupId=`${reason}-${Date.now()}`,backupRef=doc(firestore,'users',uid,'backups',backupId),timestamp=new Date().toISOString();await setDoc(backupRef,{schemaVersion:source.length?Math.min(...source.map(entity=>entity.schemaVersion||1)):CURRENT_SCHEMA_VERSION,targetSchemaVersion:CURRENT_SCHEMA_VERSION,timestamp,dataCount:source.length,counts:countEntities(source as CoreEntity[]),reason,status:'writing'});for(let offset=0;offset<source.length;offset+=400){const batch=writeBatch(firestore);for(const entity of source.slice(offset,offset+400))batch.set(doc(firestore,'users',uid,'backups',backupId,'entities',entity.id),entity);await batch.commit()}await setDoc(backupRef,{status:'ready',backupCompletedAt:new Date().toISOString()},{merge:true});return {backupId,backupRef}}

export async function listBackups(uid:string){const snapshot=await getDocs(collection(firestore,'users',uid,'backups'));return snapshot.docs.map(item=>{const data=item.data();return {id:item.id,timestamp:String(data.timestamp||''),dataCount:Number(data.dataCount||0),status:String(data.status||''),schemaVersion:Number(data.schemaVersion||1),reason:data.reason?String(data.reason):undefined} satisfies BackupSummary}).filter(item=>item.status==='ready'||item.status==='migrated').sort((a,b)=>b.timestamp.localeCompare(a.timestamp))}

export async function restoreBackup(uid:string,backupId:string){const entityCollection=collection(firestore,'users',uid,'entities'),currentSnapshot=await getDocs(entityCollection),current=currentSnapshot.docs.map(item=>entityFromDoc(item.id,item.data()));await createSafetyBackup(uid,current,'before-restore');const backupSnapshot=await getDocs(collection(firestore,'users',uid,'backups',backupId,'entities')),restored=migrateSnapshot(backupSnapshot.docs.map(item=>entityFromDoc(item.id,item.data())));if(!restored.length&&current.length)throw new Error('empty_backup');const latestSnapshot=await getDocs(entityCollection),latest=latestSnapshot.docs.map(item=>entityFromDoc(item.id,item.data()));if(latest.length!==current.length||latest.some(item=>current.find(old=>old.id===item.id)?.revision!==item.revision))throw new Error('restore_conflict');if(new Set([...latest.map(x=>x.id),...restored.map(x=>x.id)]).size>400)throw new Error('restore_too_large');const now=new Date().toISOString(),by=deviceId(),restoredById=new Map(restored.map(x=>[x.id,x])),batch=writeBatch(firestore);for(const item of restored){const existing=latest.find(x=>x.id===item.id);batch.set(doc(entityCollection,item.id),{...item,revision:(existing?.revision||item.revision)+1,updatedAt:now,updatedBy:by})}for(const item of latest)if(!restoredById.has(item.id))batch.set(doc(entityCollection,item.id),{...migrateEntity(item),revision:item.revision+1,updatedAt:now,updatedBy:by,deletedAt:now});await batch.commit();return {count:restored.length}}

export async function prepareUserData(uid:string){
 const entityCollection=collection(firestore,'users',uid,'entities'),snapshot=await getDocs(entityCollection),source=snapshot.docs.map(item=>entityFromDoc(item.id,item.data())),now=new Date().toISOString(),by=deviceId();
 const plan=createSnapshotMigrationPlan(source,{now,updatedBy:by});
 if(!plan.requiresWrite)return {migrated:false,count:source.length};
 const migratedById=new Map(plan.entities.map(entity=>[entity.id,entity])),{backupId,backupRef}=await createSafetyBackup(uid,source,`schema-${CURRENT_SCHEMA_VERSION}`);
 try{
  for(const original of source){if(Number(original.schemaVersion||1)===CURRENT_SCHEMA_VERSION)continue;const next=migratedById.get(original.id);if(!next)throw new Error(`migration_entity_missing:${original.id}`);const ref=doc(entityCollection,original.id);await runTransaction(firestore,async transaction=>{const currentSnapshot=await transaction.get(ref);if(!currentSnapshot.exists())throw new Error(`migration_entity_missing:${original.id}`);const current=entityFromDoc(currentSnapshot.id,currentSnapshot.data());if(!assertMigrationCandidate(original,current))return;transaction.set(ref,{...next,revision:current.revision+1,updatedAt:new Date().toISOString(),updatedBy:deviceId()})})}
  for(const added of plan.addedEntities){const ref=doc(entityCollection,added.id);await runTransaction(firestore,async transaction=>{const currentSnapshot=await transaction.get(ref);if(currentSnapshot.exists()){const current=entityFromDoc(currentSnapshot.id,currentSnapshot.data());if(current.type!==added.type)throw new Error(`migration_id_collision:${added.id}`);return}transaction.set(ref,added)})}
  await setDoc(backupRef,{status:'migrated',migrationCompletedAt:new Date().toISOString()},{merge:true});return {migrated:true,count:plan.entities.length,backupId};
 }catch(error){await setDoc(backupRef,{status:'failed',failedAt:new Date().toISOString(),error:error instanceof Error?error.message:'unknown'},{merge:true});throw error}
}

export function subscribeEntities(uid:string,onData:(entities:CoreEntity[])=>void,onState:(state:SyncState)=>void,onError:(message:string)=>void){
 onState('接続中');
 return onSnapshot(collection(firestore,'users',uid,'entities'),{includeMetadataChanges:true},snapshot=>{
  try{onData(migrateSnapshot(snapshot.docs.map(item=>entityFromDoc(item.id,item.data()))))}catch(error){console.error(error);onState('同期エラー');onError('データ形式を安全に読み込めませんでした。自動更新を停止しています。')}
  onState(snapshot.metadata.fromCache?'オフライン':'同期済み');
 },error=>{console.error(error);onState('同期エラー');onError(error.code==='permission-denied'?'Firestoreのアクセス権限を確認してください。':'同期できませんでした。通信を確認してください。')});
}

export async function createEntity(uid:string,type:EntityType,payload:Record<string,unknown>){
 const now=new Date().toISOString(),id=crypto.randomUUID();
 const entity:CoreEntity={id,type,payload,schemaVersion:CURRENT_SCHEMA_VERSION,revision:1,createdAt:now,updatedAt:now,updatedBy:deviceId(),deletedAt:null};
 await setDoc(doc(firestore,'users',uid,'entities',id),entity);
 return entity;
}

export async function createEntities(uid:string,inputs:{type:EntityType;payload:Record<string,unknown>}[]){
 if(!inputs.length)throw new Error('batch_empty');const now=new Date().toISOString(),by=deviceId(),items:CoreEntity[]=inputs.map(input=>({id:crypto.randomUUID(),type:input.type,payload:input.payload,schemaVersion:CURRENT_SCHEMA_VERSION,revision:1,createdAt:now,updatedAt:now,updatedBy:by,deletedAt:null}));
 for(let offset=0;offset<items.length;offset+=400){const batch=writeBatch(firestore);for(const entity of items.slice(offset,offset+400))batch.set(doc(firestore,'users',uid,'entities',entity.id),entity);await batch.commit()}return items;
}

export async function startExecutionSession(uid:string,payload:ExecutionSessionData){
 const entityCollection=collection(firestore,'users',uid,'entities'),sessionRef=doc(entityCollection),lockRef=doc(firestore,'users',uid,'runtime','execution'),now=new Date().toISOString(),by=deviceId();
 return runTransaction(firestore,async transaction=>{
  const lock=await transaction.get(lockRef),lockedSessionId=lock.exists()&&lock.data().status==='running'&&typeof lock.data().sessionId==='string'?lock.data().sessionId:'';
  const lockedSessionSnapshot=lockedSessionId?await transaction.get(doc(entityCollection,lockedSessionId)):null;
  if(lockedSessionSnapshot?.exists()){
   const lockedSession=migrateEntity(entityFromDoc(lockedSessionSnapshot.id,lockedSessionSnapshot.data()));
   if(lockedSession.type==='executionSession'&&!lockedSession.deletedAt&&(lockedSession.payload as ExecutionSessionData).status==='running')throw new Error('execution_already_running');
  }
  const session:CoreEntity<ExecutionSessionData>={id:sessionRef.id,type:'executionSession',payload,schemaVersion:CURRENT_SCHEMA_VERSION,revision:1,createdAt:now,updatedAt:now,updatedBy:by,deletedAt:null};
  transaction.set(sessionRef,session);transaction.set(lockRef,{status:'running',sessionId:session.id,updatedAt:now});return session;
 });
}

export async function completeExecutionSession(uid:string,session:CoreEntity<ExecutionSessionData>,endedAt:string,completeTask=false){
 const entityCollection=collection(firestore,'users',uid,'entities'),sessionRef=doc(entityCollection,session.id),actualRef=doc(entityCollection,executionActualId(session.id)),taskRef=session.payload.taskId?doc(entityCollection,session.payload.taskId):null,lockRef=doc(firestore,'users',uid,'runtime','execution'),by=deviceId();
 return runTransaction(firestore,async transaction=>{
  const lockSnapshot=await transaction.get(lockRef),sessionSnapshot=await transaction.get(sessionRef),remoteSession=sessionSnapshot.exists()?migrateEntity(entityFromDoc(sessionSnapshot.id,sessionSnapshot.data())) as CoreEntity<ExecutionSessionData>:session;
  const actualSnapshot=await transaction.get(actualRef);
  const taskSnapshot=taskRef?await transaction.get(taskRef):null;
  if(remoteSession.payload.status!=='running'){
   if(!actualSnapshot.exists())throw new Error('execution_actual_missing');
   if(lockSnapshot.exists()&&lockSnapshot.data().sessionId===session.id)transaction.set(lockRef,{status:'completed',sessionId:null,updatedAt:endedAt});return {session:remoteSession,actual:migrateEntity(entityFromDoc(actualSnapshot.id,actualSnapshot.data())) as CoreEntity<ActualData>,task:taskSnapshot?.exists()?migrateEntity(entityFromDoc(taskSnapshot.id,taskSnapshot.data())) as CoreEntity<TaskData>:null,created:false};
  }
  if(remoteSession.revision!==session.revision)throw new Error('revision_conflict');
  const finish=new Date(endedAt),start=new Date(remoteSession.payload.startedAt);if(!Number.isFinite(+finish)||finish<=start)throw new Error('invalid_execution_range');
  const elapsed=Math.max(1,Math.floor((+finish-+start)/60000)),remoteTask=taskSnapshot?.exists()?migrateEntity(entityFromDoc(taskSnapshot.id,taskSnapshot.data())) as CoreEntity<TaskData>:null;
  const actual:CoreEntity<ActualData>={id:actualRef.id,type:'actual',payload:{title:remoteSession.payload.title,taskId:remoteSession.payload.taskId||null,planId:remoteSession.payload.planId||null,projectId:remoteTask?.payload.projectId||null,calendarCategoryId:remoteTask?.payload.calendarCategoryId||null,directionId:inheritedDirection(remoteSession.payload.directionId,remoteTask?.payload.directionId),startAt:remoteSession.payload.startedAt,endAt:finish.toISOString(),type:remoteSession.payload.targetKind,note:''},schemaVersion:CURRENT_SCHEMA_VERSION,revision:1,createdAt:finish.toISOString(),updatedAt:finish.toISOString(),updatedBy:by,deletedAt:null};
  const completed:CoreEntity<ExecutionSessionData>={...remoteSession,payload:{...remoteSession.payload,status:'completed',endedAt:finish.toISOString(),actualId:actual.id},revision:remoteSession.revision+1,updatedAt:finish.toISOString(),updatedBy:by};
  let updatedTask:CoreEntity<TaskData>|null=remoteTask;
  if(remoteTask&&(typeof remoteTask.payload.estimatedRemainingMinutes==='number'||completeTask))updatedTask={...remoteTask,payload:{...remoteTask.payload,estimatedRemainingMinutes:typeof remoteTask.payload.estimatedRemainingMinutes==='number'?Math.max(0,remoteTask.payload.estimatedRemainingMinutes-elapsed):null,status:completeTask?'completed':remoteTask.payload.status,completedAt:completeTask?finish.toISOString():remoteTask.payload.completedAt||null},revision:remoteTask.revision+1,updatedAt:finish.toISOString(),updatedBy:by};
  transaction.set(actualRef,actual);transaction.set(sessionRef,completed);transaction.set(lockRef,{status:'completed',sessionId:null,updatedAt:finish.toISOString()});if(taskRef&&updatedTask!==remoteTask&&updatedTask)transaction.set(taskRef,updatedTask);
  return {session:completed,actual,task:updatedTask,created:true};
 });
}

export async function recordWakeAndStartMorningFlow(uid:string,now:Date,sleep:CoreEntity<SleepRecordData>|undefined,flow:CoreEntity<RoutineFlowData>|undefined,running:CoreEntity<RoutineRunData>|undefined){
 const entityCollection=collection(firestore,'users',uid,'entities'),pad=(value:number)=>String(value).padStart(2,'0'),date=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`,sleepRef=doc(entityCollection,sleep?.id||`sleep_${date}`),runRef=flow&&!running?doc(entityCollection,`routine_run_${date}_${flow.id}`):null,by=deviceId();
 return runTransaction(firestore,async transaction=>{const sleepSnapshot=await transaction.get(sleepRef),runSnapshot=runRef?await transaction.get(runRef):null,currentSleep=sleepSnapshot.exists()?migrateEntity(entityFromDoc(sleepSnapshot.id,sleepSnapshot.data())) as CoreEntity<SleepRecordData>:sleep;
  const wakeAt=now.toISOString(),savedSleep:CoreEntity<SleepRecordData>=currentSleep?{...currentSleep,payload:{...currentSleep.payload,date,actualWakeAt:wakeAt,source:'manual'},revision:currentSleep.revision+1,updatedAt:wakeAt,updatedBy:by}:{id:sleepRef.id,type:'sleepRecord',payload:{date,plannedSleepAt:null,plannedWakeAt:null,estimatedSleepAt:null,actualWakeAt:wakeAt,source:'manual',confidence:1},schemaVersion:CURRENT_SCHEMA_VERSION,revision:1,createdAt:wakeAt,updatedAt:wakeAt,updatedBy:by,deletedAt:null};
  let savedRun:CoreEntity<RoutineRunData>|null=running||null;if(runRef&&flow){savedRun=runSnapshot?.exists()?migrateEntity(entityFromDoc(runSnapshot.id,runSnapshot.data())) as CoreEntity<RoutineRunData>:{id:runRef.id,type:'routineRun',payload:startRoutineRunPayload(flow,now),schemaVersion:CURRENT_SCHEMA_VERSION,revision:1,createdAt:wakeAt,updatedAt:wakeAt,updatedBy:by,deletedAt:null};if(!runSnapshot?.exists())transaction.set(runRef,savedRun)}transaction.set(sleepRef,savedSleep);return {sleep:savedSleep,run:savedRun};
 });
}

export async function updateEntity(uid:string,entity:CoreEntity,payload:Record<string,unknown>,deleted=false){
 const ref=doc(firestore,'users',uid,'entities',entity.id),now=new Date().toISOString();
 try{return await runTransaction(firestore,async transaction=>{
	   const snapshot=await transaction.get(ref),remote=snapshot.exists()?migrateEntity(entityFromDoc(snapshot.id,snapshot.data())):entity;
   if(remote.revision!==entity.revision)throw new Error('revision_conflict');
   const next:CoreEntity={...remote,payload,revision:remote.revision+1,updatedAt:now,updatedBy:deviceId(),deletedAt:deleted?now:remote.deletedAt};
   transaction.set(ref,next);return next;
 });}catch(error){if(error instanceof Error&&error.message==='revision_conflict'){const remoteSnapshot=await getDoc(ref);if(remoteSnapshot.exists()){const remote=migrateEntity(entityFromDoc(remoteSnapshot.id,remoteSnapshot.data())),detectedAt=new Date().toISOString();await createEntity(uid,'conflict',{targetId:entity.id,targetType:entity.type,baseRevision:entity.revision,remoteRevision:remote.revision,localPayload:payload,remotePayload:remote.payload,status:'open',choice:null,detectedAt,resolvedAt:null} satisfies ConflictData)}}throw error}
}

export async function resolveConflict(uid:string,conflict:CoreEntity<ConflictData>,choice:'local'|'remote'){
 const conflictRef=doc(firestore,'users',uid,'entities',conflict.id),targetRef=doc(firestore,'users',uid,'entities',conflict.payload.targetId),now=new Date().toISOString(),by=deviceId();
 return runTransaction(firestore,async transaction=>{const [conflictSnapshot,targetSnapshot]=await Promise.all([transaction.get(conflictRef),transaction.get(targetRef)]);if(!conflictSnapshot.exists()||!targetSnapshot.exists())throw new Error('conflict_target_missing');const currentConflict=migrateEntity(entityFromDoc(conflictSnapshot.id,conflictSnapshot.data())) as CoreEntity<ConflictData>,target=migrateEntity(entityFromDoc(targetSnapshot.id,targetSnapshot.data()));if(currentConflict.revision!==conflict.revision||currentConflict.payload.status!=='open')throw new Error('conflict_already_resolved');let resolvedTarget=target;if(choice==='local'){resolvedTarget={...target,payload:currentConflict.payload.localPayload,revision:target.revision+1,updatedAt:now,updatedBy:by};transaction.set(targetRef,resolvedTarget)}const resolvedConflict:CoreEntity<ConflictData>={...currentConflict,payload:{...currentConflict.payload,status:'resolved',choice,resolvedAt:now},revision:currentConflict.revision+1,updatedAt:now,updatedBy:by};transaction.set(conflictRef,resolvedConflict);return {resolvedTarget,resolvedConflict}})
}

export async function postponePlan(uid:string,plan:CoreEntity<PlanData>,days=1){
 const sourceRef=doc(firestore,'users',uid,'entities',plan.id),nextRef=doc(collection(firestore,'users',uid,'entities')),now=new Date().toISOString(),by=deviceId();
 return runTransaction(firestore,async transaction=>{
  const snapshot=await transaction.get(sourceRef),remote=snapshot.exists()?migrateEntity(entityFromDoc(snapshot.id,snapshot.data())) as CoreEntity<PlanData>:plan;
  if(remote.revision!==plan.revision)throw new Error('revision_conflict');
  if(remote.deletedAt||remote.payload.resolution)throw new Error('already_reconciled');
  const nextPlan:CoreEntity<PlanData>={id:nextRef.id,type:'plan',payload:{...shiftedPlan(remote.payload,days),actualId:null,rescheduledFromPlanId:remote.id},schemaVersion:CURRENT_SCHEMA_VERSION,revision:1,createdAt:now,updatedAt:now,updatedBy:by,deletedAt:null};
  const resolved:CoreEntity<PlanData>={...remote,payload:{...remote.payload,resolution:'postponed',rescheduledToPlanId:nextPlan.id},revision:remote.revision+1,updatedAt:now,updatedBy:by};
  transaction.set(nextRef,nextPlan);transaction.set(sourceRef,resolved);return {nextPlan,resolved};
 });
}

export async function recordPlanAsActual(uid:string,plan:CoreEntity<PlanData>){
 const sourceRef=doc(firestore,'users',uid,'entities',plan.id),actualRef=doc(collection(firestore,'users',uid,'entities')),now=new Date().toISOString(),by=deviceId();
 return runTransaction(firestore,async transaction=>{
  const snapshot=await transaction.get(sourceRef),remote=snapshot.exists()?migrateEntity(entityFromDoc(snapshot.id,snapshot.data())) as CoreEntity<PlanData>:plan;
  if(remote.revision!==plan.revision)throw new Error('revision_conflict');
  if(remote.deletedAt||remote.payload.resolution)throw new Error('already_reconciled');
  const payload:ActualData={title:remote.payload.title,taskId:remote.payload.taskId||null,planId:remote.id,projectId:remote.payload.projectId||null,calendarCategoryId:remote.payload.calendarCategoryId||null,directionId:remote.payload.directionId||null,startAt:remote.payload.startAt,endAt:remote.payload.endAt,type:remote.payload.type,note:''};
  const actual:CoreEntity<ActualData>={id:actualRef.id,type:'actual',payload,schemaVersion:CURRENT_SCHEMA_VERSION,revision:1,createdAt:now,updatedAt:now,updatedBy:by,deletedAt:null};
  transaction.set(actualRef,actual);return {actual,linkedPlan:remote};
 });
}

export async function recordActualForPlan(uid:string,plan:CoreEntity<PlanData>,payload:ActualData){
 const sourceRef=doc(firestore,'users',uid,'entities',plan.id),actualRef=doc(collection(firestore,'users',uid,'entities')),now=new Date().toISOString(),by=deviceId();
 return runTransaction(firestore,async transaction=>{
  const snapshot=await transaction.get(sourceRef),remote=snapshot.exists()?migrateEntity(entityFromDoc(snapshot.id,snapshot.data())) as CoreEntity<PlanData>:plan;
  if(remote.revision!==plan.revision)throw new Error('revision_conflict');
  if(remote.deletedAt||remote.payload.resolution)throw new Error('already_reconciled');
  const actual:CoreEntity<ActualData>={id:actualRef.id,type:'actual',payload:{...payload,planId:remote.id,directionId:inheritedDirection(payload.directionId,remote.payload.directionId)},schemaVersion:CURRENT_SCHEMA_VERSION,revision:1,createdAt:now,updatedAt:now,updatedBy:by,deletedAt:null};
  transaction.set(actualRef,actual);return {actual,linkedPlan:remote};
 });
}

export async function deleteActualAndUnlinkPlan(uid:string,actual:CoreEntity<ActualData>,plan:CoreEntity<PlanData>){
 const actualRef=doc(firestore,'users',uid,'entities',actual.id),planRef=doc(firestore,'users',uid,'entities',plan.id),now=new Date().toISOString(),by=deviceId();
 return runTransaction(firestore,async transaction=>{
  const [actualSnapshot,planSnapshot]=await Promise.all([transaction.get(actualRef),transaction.get(planRef)]),remoteActual=actualSnapshot.exists()?migrateEntity(entityFromDoc(actualSnapshot.id,actualSnapshot.data())) as CoreEntity<ActualData>:actual,remotePlan=planSnapshot.exists()?migrateEntity(entityFromDoc(planSnapshot.id,planSnapshot.data())) as CoreEntity<PlanData>:plan;
  const unlinkLegacyPointer=remotePlan.payload.actualId===actual.id;
  if(remoteActual.revision!==actual.revision||(unlinkLegacyPointer&&remotePlan.revision!==plan.revision))throw new Error('revision_conflict');
  const deletedActual:CoreEntity<ActualData>={...remoteActual,revision:remoteActual.revision+1,updatedAt:now,updatedBy:by,deletedAt:now};
  const unlinkedPlan:CoreEntity<PlanData>=unlinkLegacyPointer?{...remotePlan,payload:{...remotePlan.payload,actualId:null},revision:remotePlan.revision+1,updatedAt:now,updatedBy:by}:remotePlan;
  transaction.set(actualRef,deletedActual);if(unlinkLegacyPointer)transaction.set(planRef,unlinkedPlan);return {deletedActual,unlinkedPlan};
 });
}
