import test from 'node:test';import assert from 'node:assert/strict';
import {CURRENT_SCHEMA_VERSION,assertNoEntityLoss,countEntities,migrateEntity,migrateSnapshot,type StoredEntity} from './schema.ts';
import {ENTITY_TYPES} from './core.ts';
const old=(id:string,type:StoredEntity['type'],payload:Record<string,unknown>):StoredEntity=>({id,type,payload,revision:1,createdAt:'2026-01-01',updatedAt:'2026-01-01',updatedBy:'old-device',deletedAt:null});
test('unversioned project is migrated without losing its fields',()=>{const entity=migrateEntity(old('p','project',{name:'研究'}));assert.equal(entity.schemaVersion,CURRENT_SCHEMA_VERSION);assert.equal(entity.payload.name,'研究');assert.equal(entity.payload.parentProjectId,null)});
test('all registered entity types survive snapshot migration',()=>{const source=ENTITY_TYPES.map((type,index)=>old(String(index),type,{}));const result=migrateSnapshot(source);assert.equal(result.length,source.length);assert.deepEqual(countEntities(result),countEntities(source as never))});
test('migration rejects data loss by type or id',()=>{const source=[old('task-1','task',{title:'A'}),old('project-1','project',{name:'P'})];assert.throws(()=>assertNoEntityLoss(source,[migrateEntity(source[0])]),/entity_loss:project/)});
test('newer unknown schema is never reset',()=>{assert.throws(()=>migrateEntity({...old('x','task',{}),schemaVersion:99}),/newer_schema:99/)});
