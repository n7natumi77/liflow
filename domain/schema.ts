import {ENTITY_TYPES,type CoreEntity,type EntityType} from './core.ts';

export const CURRENT_SCHEMA_VERSION=3;
export type StoredEntity=Omit<CoreEntity,'schemaVersion'> & {schemaVersion?:number};
export type EntityCounts=Record<EntityType,number>;

const defaults:Record<EntityType,Record<string,unknown>>={
 task:{description:'',deadline:null,estimateMinutes:null,projectId:null,parentTaskId:null,calendarCategoryId:null,status:'open',completedAt:null},
 plan:{taskId:null,projectId:null,calendarCategoryId:null,type:'personal',flexibility:'fixed',allDay:false,actualId:null,resolution:null},
 actual:{taskId:null,planId:null,projectId:null,calendarCategoryId:null,type:'personal',note:''},
 inbox:{sorted:false},routine:{description:'',calendarCategoryId:null,preferredTime:null,expectedDuration:null,active:true},
 routineOccurrence:{status:'unknown',actualId:null},transaction:{category:'その他',expectedAt:null,status:'settled',planId:null,actualId:null,taskId:null,projectId:null,note:''},
 checkin:{},calendarCategory:{colorToken:'#b9aab6',icon:'',sortOrder:0,archived:false},project:{description:'',calendarCategoryId:null,parentProjectId:null,status:'active'},
 settings:{calendarView:'week',visibleCalendarCategories:[],showPlan:true,showActual:true,showTaskDeadlines:true,dayStart:'07:00',dayEnd:'23:00'},conflict:{status:'open',choice:null,resolvedAt:null}
};

export const emptyCounts=():EntityCounts=>Object.fromEntries(ENTITY_TYPES.map(type=>[type,0])) as EntityCounts;
export function countEntities(entities:Pick<CoreEntity,'type'|'deletedAt'>[],includeDeleted=true){const counts=emptyCounts();for(const entity of entities)if(includeDeleted||!entity.deletedAt)counts[entity.type]++;return counts}

export function migrateEntity(input:StoredEntity):CoreEntity{
 const version=Number(input.schemaVersion||1);
 if(version>CURRENT_SCHEMA_VERSION)throw new Error(`newer_schema:${version}`);
 if(!ENTITY_TYPES.includes(input.type))throw new Error(`unknown_entity_type:${String(input.type)}`);
 let entity={...input,payload:{...input.payload},schemaVersion:version} as CoreEntity;
 if(version===1)entity={...entity,payload:{...defaults[entity.type],...entity.payload},schemaVersion:2};
 if(entity.schemaVersion===2)entity={...entity,payload:{...defaults[entity.type],...entity.payload},schemaVersion:3};
 if(entity.schemaVersion!==CURRENT_SCHEMA_VERSION)throw new Error(`migration_missing:${entity.schemaVersion}`);
 return entity;
}

export function assertNoEntityLoss(before:StoredEntity[],after:CoreEntity[]){
 const oldCounts=countEntities(before as CoreEntity[]),newCounts=countEntities(after);
 for(const type of ENTITY_TYPES)if(newCounts[type]<oldCounts[type])throw new Error(`entity_loss:${type}:${oldCounts[type]}:${newCounts[type]}`);
 const oldIds=new Set(before.map(entity=>entity.id));for(const entity of after)oldIds.delete(entity.id);
 if(oldIds.size)throw new Error(`entity_loss:ids:${[...oldIds].join(',')}`);
}

export function migrateSnapshot(input:StoredEntity[]){const migrated=input.map(migrateEntity);assertNoEntityLoss(input,migrated);return migrated}
