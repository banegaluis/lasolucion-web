import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('reprogramación, auditoría y consumo atómicos aislados',async t=>{
 const db=new PGlite(),id='00000000-0000-0000-0000-000000000001',perfil='00000000-0000-0000-0000-000000000002',orden='00000000-0000-0000-0000-000000000003',codigo='a'.repeat(32);
 try{
  for(const p of ['../concurrencia/esquema.sql','../concurrencia/autorizacion-desplegada.sql','../../supabase/propuestas/edicion-sesion.sql','../../supabase/propuestas/edicion-confirmar.sql'])await db.exec(await readFile(new URL(p,import.meta.url),'utf8'));
  async function preparar(){
   await db.exec('truncate bot_accesos,perfiles,bot_borradores,ordenes,laso_edicion_privada.sesiones,laso_edicion_privada.cambios');
   await db.query("insert into perfiles values($1,true,'activo','admin')",[perfil]);
   await db.query("insert into bot_accesos values($1,$2,'+5493512143961',true,ARRAY['agenda.editar'],1)",[id,perfil]);
   await db.query("insert into bot_borradores values('confirmacion',$1,$2,1,'+5493512143961','texto',$3)",[id,perfil,'CONFIRMAR CAMBIO '+codigo]);
   await db.query("insert into ordenes(id,titulo,fecha_programada,hora_inicio,hora_fin,estado) values($1,'Trabajo local',current_date+2,'09:00','11:00','pendiente')",[orden]);
   await db.query(`insert into laso_edicion_privada.sesiones select $1::uuid,1,1,jsonb_build_object('operador',$1::text,'creada',extract(epoch from clock_timestamp())*1000-1000,'codigo',$2::text,'base',jsonb_build_object('id',id,'fecha',fecha_programada,'inicio',hora_inicio,'fin',hora_fin,'estado',estado,'cliente_id',cliente_id,'direccion_cliente_id',direccion_cliente_id,'titulo',titulo),'propuesta',jsonb_build_object('fecha',(current_date+3)::text,'inicio','12:00','fin','14:00')) from ordenes where id=$3`,[id,codigo,orden]);
  }
  const confirmar=async()=>(await db.query("select laso_edicion_privada.confirmar('+5493512143961',1,'confirmacion',$1,1) as r",[codigo])).rows[0].r;
  const estado=async()=>(await db.query('select hora_inicio::text as inicio,(select count(*)::int from laso_edicion_privada.cambios) as cambios,(select sesion is null from laso_edicion_privada.sesiones) as consumida from ordenes where id=$1',[orden])).rows[0];
  await t.test('edita una vez, audita y consume contexto; reintento no duplica',async()=>{
   await preparar();assert.equal((await confirmar()).estado,'editada');assert.equal((await confirmar()).repetido,true);
   assert.deepEqual(await estado(),{inicio:'12:00:00',cambios:1,consumida:true});
  });
  await t.test('fallo de auditoría revierte orden y sesión',async()=>{
   await preparar();await db.exec("alter table laso_edicion_privada.cambios add constraint fallo_local check(evento_id<>'confirmacion')");
   await assert.rejects(confirmar(),e=>e.code==='23514');assert.deepEqual(await estado(),{inicio:'09:00:00',cambios:0,consumida:false});
   await db.exec('alter table laso_edicion_privada.cambios drop constraint fallo_local');assert.equal((await confirmar()).estado,'editada');
  });
  await t.test('texto alterado y revocación no editan',async()=>{
   await preparar();await db.exec("update bot_borradores set texto=texto||'.'");assert.equal((await confirmar()).estado,'confirmacion_invalida');
   await db.exec('update bot_accesos set activo=false');assert.equal((await confirmar()).estado,'denegado');assert.deepEqual(await estado(),{inicio:'09:00:00',cambios:0,consumida:false});
  });
  await t.test('orden cambiada y superposición exigen nueva propuesta',async()=>{
   await preparar();await db.exec("update ordenes set titulo='Cambiado'");assert.equal((await confirmar()).estado,'orden_cambiada');
   await preparar();await db.exec("insert into ordenes(titulo,fecha_programada,hora_inicio,hora_fin,estado) values('Otro',current_date+3,'13:00','15:00','pendiente')");assert.equal((await confirmar()).estado,'ocupado');assert.deepEqual(await estado(),{inicio:'09:00:00',cambios:0,consumida:false});
  });
  await t.test('propuesta vencida o código reemplazado no cambia orden',async()=>{
   await preparar();await db.exec("update laso_edicion_privada.sesiones set sesion=jsonb_set(sesion,'{creada}',to_jsonb(extract(epoch from clock_timestamp())*1000-1800001))");assert.equal((await confirmar()).estado,'vencida');
   await preparar();await db.query("update laso_edicion_privada.sesiones set sesion=jsonb_set(sesion,'{codigo}',to_jsonb($1::text))",['b'.repeat(32)]);assert.equal((await confirmar()).estado,'propuesta_invalida');assert.deepEqual(await estado(),{inicio:'09:00:00',cambios:0,consumida:false});
  });
  await t.test('duración alterada no se guarda',async()=>{
   await preparar();await db.exec(`update laso_edicion_privada.sesiones set sesion=jsonb_set(sesion,'{propuesta,fin}','"15:00"'::jsonb)`);assert.equal((await confirmar()).estado,'duracion_invalida');assert.deepEqual(await estado(),{inicio:'09:00:00',cambios:0,consumida:false});
  });
 }finally{await db.close();}
});
