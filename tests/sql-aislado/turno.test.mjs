import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('turno desplegado en PostgreSQL aislado en memoria',async t=>{
 const db=new PGlite();
 const acceso='00000000-0000-0000-0000-000000000001',perfil='00000000-0000-0000-0000-000000000002';
 let cliente,direccion;
 try{
  await db.exec(`
   create table clientes(id uuid primary key default gen_random_uuid(),activo boolean default true);
   create table direcciones_clientes(id uuid primary key default gen_random_uuid(),cliente_id uuid references clientes,activo boolean default true,direccion_completa text);
   create table ordenes(id uuid primary key default gen_random_uuid(),numero_orden bigint generated always as identity,cliente_id uuid references clientes,direccion_cliente_id uuid references direcciones_clientes,titulo text,fecha_programada date,hora_inicio time,hora_fin time,estado text,created_by uuid,direccion_snapshot jsonb);
   create table bot_borradores(evento_id text,acceso_id uuid,perfil_id uuid,version_acceso int,numero text,tipo text,texto text);
   create table laso_turnos_confirmacion(id uuid primary key default gen_random_uuid(),codigo text,acceso_id uuid,perfil_id uuid,version_acceso int,creado timestamptz default now(),cliente_id uuid,direccion_id uuid,titulo text,fecha date,inicio time,fin time,orden_id uuid,forzar_fallo boolean default false,check(not forzar_fallo or orden_id is null));
   create function bot_autorizar(text,text,integer) returns table(acceso_id uuid,perfil_id uuid,version integer) language sql as $$select '${acceso}'::uuid,'${perfil}'::uuid,1 where $1='+5493512143961' and $2='agenda.registrar' and $3=1$$;
  `);
  await db.exec(await readFile(new URL('./turno-desplegado.sql',import.meta.url),'utf8'));
  async function preparar(){
   await db.exec('truncate ordenes,direcciones_clientes,clientes,bot_borradores,laso_turnos_confirmacion restart identity cascade');
   cliente=(await db.query('insert into clientes default values returning id')).rows[0].id;
   direccion=(await db.query("insert into direcciones_clientes(cliente_id,direccion_completa) values($1,'Domicilio local 1') returning id",[cliente])).rows[0].id;
   await db.query("insert into bot_borradores values('evento-local',$1,$2,1,'+5493512143961','texto','CONFIRMAR abcdef12')",[acceso,perfil]);
   await db.query("insert into laso_turnos_confirmacion(codigo,acceso_id,perfil_id,version_acceso,cliente_id,direccion_id,titulo,fecha,inicio,fin) values('abcdef12',$1,$2,1,$3,$4,'Trabajo local',current_date+2,'10:00','12:00')",[acceso,perfil,cliente,direccion]);
  }
  const confirmar=async(numero='+5493512143961',version=1,evento='evento-local')=>(await db.query("select laso_confirmar_turno('abcdef12',$1,$2,$3) as r",[numero,version,evento])).rows[0].r;
  const contar=async()=>(await db.query('select (select count(*)::int from ordenes) as ordenes,(select count(*)::int from laso_turnos_confirmacion where orden_id is not null) as confirmadas')).rows[0];
  const sinEscritura=async()=>assert.deepEqual(await contar(),{ordenes:0,confirmadas:0});
  await t.test('confirmación y reintento conservan una orden vinculada al cliente',async()=>{
   await preparar();const primero=await confirmar();assert.equal(primero.estado,'registrado');assert.deepEqual(await confirmar(),primero);
   assert.deepEqual(await contar(),{ordenes:1,confirmadas:1});
   const o=(await db.query('select cliente_id,direccion_cliente_id,created_by,direccion_snapshot from ordenes')).rows[0];
   assert.deepEqual(o,{cliente_id:cliente,direccion_cliente_id:direccion,created_by:perfil,direccion_snapshot:{direccion_completa:'Domicilio local 1'}});
  });
  await t.test('fallo posterior a insertar orden revierte orden y confirmación',async()=>{
   await preparar();await db.exec('update laso_turnos_confirmacion set forzar_fallo=true');
   await assert.rejects(confirmar(),e=>e.code==='23514');await sinEscritura();
   assert.equal((await db.query('select count(*)::int as n from clientes')).rows[0].n,1);
   await db.exec('update laso_turnos_confirmacion set forzar_fallo=false');
   assert.equal((await confirmar()).estado,'registrado');assert.deepEqual(await contar(),{ordenes:1,confirmadas:1});
  });
  await t.test('número ajeno y versión inválida no autorizan',async()=>{
   await preparar();assert.equal((await confirmar('+5493510000000')).estado,'denegado');assert.equal((await confirmar('+5493512143961',2)).estado,'denegado');await sinEscritura();
  });
  await t.test('confirmación debe pertenecer al evento y ser texto exacto',async()=>{
   for(const [texto,tipo] of [['CONFIRMAR abcdef12.','texto'],['CONFIRMAR abcdef12','audio'],['CONFIRMAR ffffffff','texto']]){
    await preparar();await db.query('update bot_borradores set texto=$1,tipo=$2',[texto,tipo]);assert.equal((await confirmar()).estado,'confirmacion_invalida');await sinEscritura();
   }
   await preparar();assert.equal((await confirmar('+5493512143961',1,'otro-evento')).estado,'confirmacion_invalida');await sinEscritura();
  });
  await t.test('identidad del evento no puede pertenecer a otro acceso',async()=>{
   await preparar();await db.exec("update bot_borradores set acceso_id='00000000-0000-0000-0000-000000000099'");assert.equal((await confirmar()).estado,'confirmacion_invalida');await sinEscritura();
  });
  await t.test('borrador vencido o turno pasado no escribe',async()=>{
   for(const sql of ["update laso_turnos_confirmacion set creado=now()-interval '31 minutes'","update laso_turnos_confirmacion set fecha=current_date-1"]){
    await preparar();await db.exec(sql);assert.equal((await confirmar()).estado,'vencido');await sinEscritura();
   }
  });
  await t.test('cliente o dirección inactivos y dirección ajena son rechazados',async()=>{
   for(const sql of ['update clientes set activo=false','update direcciones_clientes set activo=false',"update laso_turnos_confirmacion set cliente_id='00000000-0000-0000-0000-000000000099'"]){
    await preparar();await db.exec(sql);assert.equal((await confirmar()).estado,'cliente_invalido');await sinEscritura();
   }
  });
  await t.test('superposición bloquea y límite contiguo permite reservar',async()=>{
   await preparar();await db.exec("insert into ordenes(titulo,fecha_programada,hora_inicio,hora_fin,estado) values('Bloqueo local',current_date+2,'11:00','13:00','pendiente')");
   assert.equal((await confirmar()).estado,'ocupado');assert.deepEqual(await contar(),{ordenes:1,confirmadas:0});
   await db.exec("update ordenes set hora_inicio='12:00'");assert.equal((await confirmar()).estado,'registrado');assert.deepEqual(await contar(),{ordenes:2,confirmadas:1});
  });
 }finally{await db.close();}
});
