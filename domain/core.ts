export const ENTITY_TYPES=['task','plan','actual','inbox','routine','routineOccurrence','transaction','checkin','calendarCategory','project','settings','conflict'] as const;
export type EntityType=typeof ENTITY_TYPES[number];
export type CoreEntity<T=Record<string,unknown>>={id:string;type:EntityType;payload:T;schemaVersion:number;revision:number;createdAt:string;updatedAt:string;updatedBy:string;deletedAt:string|null};
export type TaskData={title:string;description?:string;deadline?:string|null;estimateMinutes?:number|null;projectId?:string|null;parentTaskId?:string|null;calendarCategoryId?:string|null;status:'inbox'|'open'|'completed'|'cancelled';completedAt?:string|null};
export type PlanData={title:string;taskId?:string|null;projectId?:string|null;calendarCategoryId?:string|null;startAt:string;endAt:string;type:'task'|'appointment'|'travel'|'rest'|'sleep'|'personal'|'container';flexibility:'fixed'|'flexible';allDay:boolean;actualId?:string|null;resolution?:'cancelled'|'postponed'|'unneeded'|null};
export type ActualData={title:string;taskId?:string|null;planId?:string|null;projectId?:string|null;calendarCategoryId?:string|null;startAt:string;endAt:string;type:string;note?:string};
export type InboxData={text:string;sorted:boolean};
export type CalendarCategoryData={name:string;colorToken:string;icon?:string;sortOrder:number;archived:boolean};
export type ProjectData={name:string;description?:string;calendarCategoryId?:string|null;parentProjectId?:string|null;status:'active'|'completed'|'archived'};
export type ScheduleRule={kind:'daily'|'weekdays'|'weekends'|'weekly';weekdays?:number[]};
export type RoutineData={title:string;description?:string;calendarCategoryId?:string|null;scheduleRule:ScheduleRule;preferredTime?:string|null;expectedDuration?:number|null;active:boolean};
export type RoutineOccurrenceData={routineId:string;date:string;status:'pending'|'done'|'skipped'|'unknown';actualId?:string|null};
export type TransactionData={title:string;amount:number;direction:'income'|'expense';category:string;occurredAt:string;expectedAt?:string|null;status:'expected'|'settled';planId?:string|null;actualId?:string|null;taskId?:string|null;projectId?:string|null;note?:string};
export type SettingsData={calendarView:'day'|'week'|'month';visibleCalendarCategories:string[];showPlan:boolean;showActual:boolean;showTaskDeadlines:boolean;dayStart?:string;dayEnd?:string};
export type ConflictData={targetId:string;targetType:EntityType;baseRevision:number;remoteRevision:number;localPayload:Record<string,unknown>;remotePayload:Record<string,unknown>;status:'open'|'resolved';choice?:'local'|'remote'|null;detectedAt:string;resolvedAt?:string|null};

export const active=<T>(entities:CoreEntity[],type:EntityType)=>entities.filter(e=>e.type===type&&!e.deletedAt) as CoreEntity<T>[];
export const overlaps=(startA:string,endA:string,startB:string,endB:string)=>new Date(startA)<new Date(endB)&&new Date(startB)<new Date(endA);
export const validTimeRange=(startAt:string,endAt:string)=>{const start=new Date(startAt).getTime(),end=new Date(endAt).getTime();return Number.isFinite(start)&&Number.isFinite(end)&&start<end};
export const inheritedCategory=(explicit?:string|null,plan?:string|null,task?:string|null,project?:string|null)=>explicit||plan||task||project||null;
export const shiftedPlan=(plan:PlanData,days:number):PlanData=>({...plan,startAt:new Date(new Date(plan.startAt).getTime()+days*86400000).toISOString(),endAt:new Date(new Date(plan.endAt).getTime()+days*86400000).toISOString(),resolution:null});
export function layoutOverlaps<T extends {payload:{startAt:string;endAt:string}}>(items:T[]){const sorted=[...items].sort((a,b)=>a.payload.startAt.localeCompare(b.payload.startAt)),result:{item:T;column:number;columns:number}[]=[],cluster:number[]=[];let ends:number[]=[],clusterEnd=-Infinity;const finish=()=>{const columns=Math.max(1,ends.length);for(const index of cluster)result[index].columns=columns;cluster.length=0;ends=[];clusterEnd=-Infinity};for(const item of sorted){const start=new Date(item.payload.startAt).getTime(),end=new Date(item.payload.endAt).getTime();if(cluster.length&&start>=clusterEnd)finish();let column=ends.findIndex(value=>value<=start);if(column<0){column=ends.length;ends.push(end)}else ends[column]=end;result.push({item,column,columns:1});cluster.push(result.length-1);clusterEnd=Math.max(clusterEnd,end)}finish();return result}
export function wouldCreateCycle(id:string,parentId:string|null|undefined,parents:Map<string,string|null|undefined>){let p=parentId;const seen=new Set<string>();while(p){if(p===id||seen.has(p))return true;seen.add(p);p=parents.get(p)}return false}
export function routineOccurs(rule:ScheduleRule,date:Date){const day=date.getDay();if(rule.kind==='daily')return true;if(rule.kind==='weekdays')return day>=1&&day<=5;if(rule.kind==='weekends')return day===0||day===6;return (rule.weekdays||[]).includes(day)}
export function unresolved(entities:CoreEntity[],now=new Date()){
 const plans=active<PlanData>(entities,'plan'); const actuals=active<ActualData>(entities,'actual'); const tasks=active<TaskData>(entities,'task'); const inbox=active<InboxData>(entities,'inbox');
 const transactions=active<TransactionData>(entities,'transaction');
 const items:{kind:'plan'|'task'|'inbox'|'conflict'|'transaction';id:string;label:string}[]=[];
 for(const plan of plans) if(new Date(plan.payload.endAt)<now&&!plan.payload.resolution&&!actuals.some(a=>a.payload.planId===plan.id)) items.push({kind:'plan',id:plan.id,label:`「${plan.payload.title}」はどうなった？`});
 const inSevenDays=new Date(now.getTime()+7*86400000);
 for(const task of tasks) if(task.payload.status==='open'&&task.payload.deadline&&new Date(task.payload.deadline)<=inSevenDays&&!plans.some(p=>p.payload.taskId===task.id&&new Date(p.payload.endAt)>=now)) items.push({kind:'task',id:task.id,label:`「${task.payload.title}」をいつやる？`});
 for(const note of inbox) if(!note.payload.sorted) items.push({kind:'inbox',id:note.id,label:note.payload.text});
 const conflictPlans=plans.filter(p=>!p.payload.resolution&&!p.payload.allDay&&p.payload.type!=='container'&&validTimeRange(p.payload.startAt,p.payload.endAt)&&new Date(p.payload.endAt)>now);
 for(let i=0;i<conflictPlans.length;i++) for(let j=i+1;j<conflictPlans.length;j++) if(overlaps(conflictPlans[i].payload.startAt,conflictPlans[i].payload.endAt,conflictPlans[j].payload.startAt,conflictPlans[j].payload.endAt)) items.push({kind:'conflict',id:`${conflictPlans[i].id}:${conflictPlans[j].id}`,label:`「${conflictPlans[i].payload.title}」と「${conflictPlans[j].payload.title}」の時間が重なっている`});
 for(const transaction of transactions) if(transaction.payload.status==='expected'&&transaction.payload.expectedAt&&new Date(transaction.payload.expectedAt)<now) items.push({kind:'transaction',id:transaction.id,label:`「${transaction.payload.title}」の入出金を確認する`});
 return items;
}
export function availableMinutes(plans:CoreEntity<PlanData>[],now:Date,dayEnd:string|number='23:00'){
 const [hour,minute]=typeof dayEnd==='number'?[dayEnd,0]:dayEnd.split(':').map(Number);const end=new Date(now); end.setHours(Number.isFinite(hour)?hour:23,Number.isFinite(minute)?minute:0,0,0); if(now>=end)return 0;
 const ranges=plans.filter(p=>!p.payload.allDay&&p.payload.type!=='container'&&validTimeRange(p.payload.startAt,p.payload.endAt)&&new Date(p.payload.endAt)>now&&new Date(p.payload.startAt)<end).map(p=>[Math.max(now.getTime(),new Date(p.payload.startAt).getTime()),Math.min(end.getTime(),new Date(p.payload.endAt).getTime())] as [number,number]).sort((a,b)=>a[0]-b[0]);
 const merged:[number,number][]=[];for(const range of ranges){const last=merged.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push([...range])}const occupied=merged.reduce((sum,[start,finish])=>sum+finish-start,0);
 return Math.max(0,Math.round((end.getTime()-now.getTime()-occupied)/60000));
}
