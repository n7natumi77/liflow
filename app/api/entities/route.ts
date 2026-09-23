import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { coreEntities } from '../../../db/schema';
import { ENTITY_TYPES } from '../../../domain/core';

const allowed = new Set<string>(ENTITY_TYPES);
const json = (row: typeof coreEntities.$inferSelect) => ({...row, payload: JSON.parse(row.payload)});

export async function GET(){
  const user=await getChatGPTUser(); if(!user) return NextResponse.json({error:'unauthorized'},{status:401});
  const rows=await getDb().select().from(coreEntities).where(and(eq(coreEntities.userId,user.userId),isNull(coreEntities.deletedAt)));
  return NextResponse.json({entities:rows.map(json)});
}

export async function POST(req:Request){
  const user=await getChatGPTUser(); if(!user) return NextResponse.json({error:'unauthorized'},{status:401});
  const body=await req.json() as {id?:string;type?:string;payload?:Record<string,unknown>};
  if(!body.id||!body.type||!allowed.has(body.type)||!body.payload) return NextResponse.json({error:'invalid_entity'},{status:400});
  const now=new Date(); const row={id:body.id,userId:user.userId,type:body.type,payload:JSON.stringify(body.payload),revision:1,createdAt:now,updatedAt:now,updatedBy:user.userId,deletedAt:null};
  try{await getDb().insert(coreEntities).values(row);return NextResponse.json(json(row),{status:201});}
  catch{return NextResponse.json({error:'entity_exists'},{status:409});}
}

export async function PATCH(req:Request){
  const user=await getChatGPTUser(); if(!user) return NextResponse.json({error:'unauthorized'},{status:401});
  const body=await req.json() as {id?:string;revision?:number;payload?:Record<string,unknown>;deleted?:boolean};
  if(!body.id||typeof body.revision!=='number'||!Number.isInteger(body.revision)) return NextResponse.json({error:'invalid_request'},{status:400});
  const id=body.id, revision=body.revision; const now=new Date(); const values:Record<string,unknown>={revision:revision+1,updatedAt:now,updatedBy:user.userId};
  if(body.payload) values.payload=JSON.stringify(body.payload);
  if(body.deleted===true) values.deletedAt=now;
  const result=await getDb().update(coreEntities).set(values).where(and(eq(coreEntities.id,id),eq(coreEntities.userId,user.userId),eq(coreEntities.revision,revision))).returning();
  if(!result[0]) return NextResponse.json({error:'revision_conflict'},{status:409});
  return NextResponse.json(json(result[0]));
}
