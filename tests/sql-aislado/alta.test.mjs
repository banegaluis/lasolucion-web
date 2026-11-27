import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('alta desplegada en PostgreSQL aislado en memoria',async t=>{
 const db=new PGlite();
 const acceso='00000000-0000-0000-0000-000000000001',perfil='00000000-0000-0000-0000-000000000002';
 try{
 await db.exec(`
 create table clientes(id uuid primary key default gen_random_uuid(),nombre text,apellido text,telefono_principal text,created_by uuid,nombre_completo text generated always as(nombre||' '||apellido) stored);
 create table direcciones_clientes(id uuid primary key default gen_random_uuid(),cliente_id uuid references clientes,alias text,calle text,numero text,ciudad text,provincia text,es_principal boolean,direccion_completa text generated always as(calle||' '||numero) stored);
 create table ordenes(id uuid primary key default gen_random_uuid(),numero_orden bigint generated always as identity,cliente_id uuid references clientes,direccion_cliente_id uuid references direcciones_clientes,titulo text check(titulo<>'FORZAR_FALLO'),fecha_programada date,hora_inicio time,hora_fin time,estado text,created_by uuid,direccion_snapshot jsonb);
 create table bot_borradores(evento_id text,acceso_id uuid,perfil_id uuid,version_acceso int,numero text,tipo text,texto text);
 create table laso_altas_pendientes(id uuid primary key default gen_random_uuid(),codigo text,acceso_id uuid,perfil_id uuid,version_acceso int,creado timestamptz default now(),datos jsonb,cliente_id uuid,orden_id uuid);
 create function bot_autorizar(text,text,integer) returns table(acceso_id uuid,perfil_id uuid,version integer) language sql as $$select '${acceso}'::uuid,'${perfil}'::uuid,1 where $1='+5493512143961' and $2='agenda.registrar' and $3=1$$;
 `);
 await db.exec(await readFile(new URL('./alta-desplegada.sql',import.meta.url),'utf8'));
 async function preparar(trabajo='Revisión local'){
  await db.exec('truncate ordenes,direcciones_clientes,clientes,bot_borradores,laso_altas_pendientes restart identity cascade');
  await db.query(`insert into bot_borradores values ('evento-local',$1,$2,1,'+5493512143961','texto','CONFIRMAR ALTA abcdef12')`,[acceso,perfil]);
  await db.query(`insert into laso_altas_pendientes(codigo,acceso_id,perfil_id,version_acceso,datos) values('abcdef12',$1,$2,1,jsonb_build_object('listo',true,'nombre','Persona','apellido','Prueba','calle','Local','numero','1','ciudad','Córdoba','provincia','Córdoba','telefono','3510000000','trabajo',$3::text,'fecha',(current_date+2)::text,'inicio','10:00','fin','12:00'))`,[acceso,perfil,trabajo]);
 }
 const confirmar=async(evento='evento-local')=>(await db.query(`select laso_confirmar_alta('abcdef12','+5493512143961',1,$1) as r`,[evento])).rows[0].r;
 const contar=async()=>(await db.query(`select (select count(*)::int from clientes) as clientes,(select count(*)::int from direcciones_clientes) as direcciones,(select count(*)::int from ordenes) as ordenes,(select count(*)::int from laso_altas_pendientes where orden_id is not null) as confirmadas`)).rows[0];
 await t.test('alta completa y reintento conservan una sola orden',async()=>{
  await preparar();const primero=await confirmar();assert.equal(primero.estado,'registrado');
  assert.deepEqual(await confirmar(),primero);assert.deepEqual(await contar(),{clientes:1,direcciones:1,ordenes:1,confirmadas:1});
 });
 await t.test('fallo al insertar orden revierte cliente y dirección',async()=>{
  await preparar('FORZAR_FALLO');await assert.rejects(confirmar(),e=>e.code==='23514');
  assert.deepEqual(await contar(),{clientes:0,direcciones:0,ordenes:0,confirmadas:0});
 });
 await t.test('evento inexistente no confirma ni escribe',async()=>{
  await preparar();assert.equal((await confirmar('evento-ajeno')).estado,'confirmacion_invalida');
  assert.deepEqual(await contar(),{clientes:0,direcciones:0,ordenes:0,confirmadas:0});
 });
 await t.test('texto alterado y audio no habilitan escritura',async()=>{
  for(const [texto,tipo] of [['CONFIRMAR ALTA abcdef12.','texto'],['CONFIRMAR ALTA abcdef12','audio']]){
   await preparar();await db.query('update bot_borradores set texto=$1,tipo=$2',[texto,tipo]);
   assert.equal((await confirmar()).estado,'confirmacion_invalida');
   assert.deepEqual(await contar(),{clientes:0,direcciones:0,ordenes:0,confirmadas:0});
  }
 });
 await t.test('borrador vencido no crea registros',async()=>{
  await preparar();await db.exec("update laso_altas_pendientes set creado=now()-interval '31 minutes'");
  assert.equal((await confirmar()).estado,'vencido');
  assert.deepEqual(await contar(),{clientes:0,direcciones:0,ordenes:0,confirmadas:0});
 });
 await t.test('horario ocupado no deja alta parcial',async()=>{
  await preparar();await db.exec("insert into ordenes(titulo,fecha_programada,hora_inicio,hora_fin,estado) values('Bloqueo local',current_date+2,'11:00','13:00','pendiente')");
  assert.equal((await confirmar()).estado,'ocupado');
  assert.deepEqual(await contar(),{clientes:0,direcciones:0,ordenes:1,confirmadas:0});
 });
 }finally{await db.close();}
});
