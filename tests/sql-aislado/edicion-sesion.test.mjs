import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('sesión de edición con revisión en SQL aislado',async t=>{
 const db=new PGlite();const acceso='00000000-0000-0000-0000-000000000001';
 try{
  await db.exec(await readFile(new URL('../../supabase/propuestas/edicion-sesion.sql',import.meta.url),'utf8'));
  const guardar=async(revision,sesion,version=1)=>(await db.query('select laso_edicion_privada.reemplazar($1,$2,$3,$4) as revision',[acceso,version,revision,sesion===null?null:JSON.stringify(sesion)])).rows[0].revision;
  const leer=async()=>(await db.query('select revision,sesion from laso_edicion_privada.sesiones')).rows[0];
  const iniciar=async()=>{await db.exec('truncate laso_edicion_privada.sesiones');assert.equal(await guardar(0,{codigo:'primero'}),1);};
  await t.test('respuesta atrasada no reemplaza la corrección más nueva',async()=>{
   await iniciar();assert.equal(await guardar(1,{codigo:'nuevo'}),2);
   assert.equal(await guardar(1,{codigo:'atrasado'}),null);assert.deepEqual(await leer(),{revision:2,sesion:{codigo:'nuevo'}});
  });
  await t.test('descartar conserva revisión e impide resucitar contexto',async()=>{
   await iniciar();assert.equal(await guardar(1,null),2);
   assert.equal(await guardar(0,{codigo:'viejo'}),null);assert.equal(await guardar(1,{codigo:'viejo'}),null);
   assert.deepEqual(await leer(),{revision:2,sesion:null});
  });
  await t.test('versión distinta y repetición no pisan el estado',async()=>{
   await iniciar();assert.equal(await guardar(1,{codigo:'ajeno'},2),null);
   assert.equal(await guardar(0,{codigo:'reintento'}),null);assert.deepEqual(await leer(),{revision:1,sesion:{codigo:'primero'}});
  });
  await t.test('rollback revierte reemplazo y revisión juntos',async()=>{
   await iniciar();await db.exec('begin');assert.equal(await guardar(1,{codigo:'temporal'}),2);await db.exec('rollback');
   assert.deepEqual(await leer(),{revision:1,sesion:{codigo:'primero'}});
  });
  await t.test('sesión inválida no altera la propuesta',async()=>{
   await iniciar();await assert.rejects(guardar(1,[]),e=>e.code==='22023');
   assert.deepEqual(await leer(),{revision:1,sesion:{codigo:'primero'}});
  });
  await t.test('PUBLIC no puede usar esquema ni ejecutar función',async()=>{
   await db.exec('create role visitante_local');
   const r=(await db.query("select has_schema_privilege('visitante_local','laso_edicion_privada','USAGE') as esquema,has_function_privilege('visitante_local','laso_edicion_privada.reemplazar(uuid,integer,bigint,jsonb)','EXECUTE') as ejecutar")).rows[0];
   assert.deepEqual(r,{esquema:false,ejecutar:false});
  });
 }finally{await db.close();}
});
