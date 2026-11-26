import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('persistencia de edición con autorización y evento locales',async t=>{
 const db=new PGlite();const id='00000000-0000-0000-0000-000000000001',perfil='00000000-0000-0000-0000-000000000002';
 let contexto;
 try{
  for(const path of ['../concurrencia/esquema.sql','../concurrencia/autorizacion-desplegada.sql','../../supabase/propuestas/edicion-sesion.sql','../../supabase/propuestas/edicion-sesion-autorizada.sql'])await db.exec(await readFile(new URL(path,import.meta.url),'utf8'));
  async function preparar(){
   contexto={operador:id,creada:Date.now()-1000,codigo:'a'.repeat(32),base:{},propuesta:{}};
   await db.exec('truncate laso_edicion_privada.eventos,bot_accesos,perfiles,bot_borradores,laso_edicion_privada.sesiones');
   await db.query("insert into perfiles values($1,true,'activo','admin')",[perfil]);
   await db.query("insert into bot_accesos values($1,$2,'+5493512143961',true,ARRAY['agenda.editar'],1)",[id,perfil]);
   await db.query("insert into bot_borradores values('evento',$1,$2,1,'+5493512143961','texto','Mejor a las 11')",[id,perfil]);
  }
  const guardar=async({numero='+5493512143961',version=1,evento='evento',revision=0,sesion=contexto}={})=>(await db.query('select laso_edicion_privada.guardar_autorizada($1,$2,$3,$4,$5) as r',[numero,version,evento,revision,sesion===null?null:JSON.stringify(sesion)])).rows[0].r;
  const cantidad=async()=>(await db.query('select count(*)::int as n from laso_edicion_privada.sesiones')).rows[0].n;
  await t.test('guarda sesión autorizada, rechaza revisión vieja y permite descarte',async()=>{
   await preparar();assert.deepEqual(await guardar(),{estado:'guardada',revision:1});assert.deepEqual(await guardar(),{estado:'guardada',revision:1,repetido:true});
   await db.exec("insert into bot_borradores select 'evento-2',acceso_id,perfil_id,version_acceso,numero,tipo,texto from bot_borradores where evento_id='evento'");
   assert.deepEqual(await guardar({revision:1,sesion:null,evento:'evento-2'}),{estado:'guardada',revision:2});
   assert.equal((await db.query('select sesion from laso_edicion_privada.sesiones')).rows[0].sesion,null);
  });
  await t.test('otro número, versión y permiso de alta no permiten edición',async()=>{
   await preparar();for(const input of [{numero:'+5493510000000'},{version:2},{version:null}])assert.equal((await guardar(input)).estado,'denegado');
   await db.exec("update bot_accesos set permisos=ARRAY['agenda.registrar']");assert.equal((await guardar()).estado,'denegado');assert.equal(await cantidad(),0);
  });
  await t.test('evento ajeno o audio no puede persistir contexto',async()=>{
   await preparar();assert.equal((await guardar({evento:'otro'})).estado,'evento_invalido');
   await db.exec("update bot_borradores set tipo='audio'");assert.equal((await guardar()).estado,'evento_invalido');assert.equal(await cantidad(),0);
  });
  await t.test('no acepta contexto atribuido a otro operador',async()=>{
   await preparar();for(const sesion of [{operador:perfil},{},[]])assert.equal((await guardar({sesion})).estado,'sesion_invalida');assert.equal(await cantidad(),0);
  });
  await t.test('revocación previa y rollback no dejan sesión guardada',async()=>{
   await preparar();await db.exec('update bot_accesos set activo=false');assert.equal((await guardar()).estado,'denegado');
   await db.exec('update bot_accesos set activo=true; begin');assert.equal((await guardar()).estado,'guardada');await db.exec('rollback');assert.equal(await cantidad(),0);
  });
  await t.test('un evento no puede reemplazar otra propuesta ni revision',async()=>{
   await preparar();await guardar();
   assert.equal((await guardar({revision:1,sesion:{...contexto,codigo:'b'.repeat(32)}})).estado,'evento_reutilizado');
   const row=(await db.query('select revision,sesion from laso_edicion_privada.sesiones')).rows[0];
   assert.deepEqual(row,{revision:1,sesion:contexto});
  });
  await t.test('reintento viejo no resucita contexto descartado',async()=>{
   await preparar();await guardar();
   await db.exec("insert into bot_borradores select 'evento-2',acceso_id,perfil_id,version_acceso,numero,tipo,texto from bot_borradores where evento_id='evento'");
   await guardar({revision:1,sesion:null,evento:'evento-2'});assert.equal((await guardar()).repetido,true);
   assert.deepEqual((await db.query('select revision,sesion from laso_edicion_privada.sesiones')).rows[0],{revision:2,sesion:null});
  });
  await t.test('fallo al guardar revierte también el registro del evento',async()=>{
   await preparar();await assert.rejects(guardar({revision:-1}),e=>e.code==='22023');
   assert.equal((await db.query('select count(*)::int as n from laso_edicion_privada.eventos')).rows[0].n,0);
   assert.equal((await guardar()).estado,'guardada');
  });
  await t.test('vencimiento y creación futura no dejan sesión ni evento',async()=>{
   for(const creada of [Date.now()-1800001,Date.now()+60000]){
    await preparar();assert.equal((await guardar({sesion:{...contexto,creada}})).estado,'sesion_vencida');
    assert.equal(await cantidad(),0);assert.equal((await db.query('select count(*)::int as n from laso_edicion_privada.eventos')).rows[0].n,0);
   }
  });
  await t.test('contexto incompleto o código malformado no se persisten',async()=>{
   for(const cambio of [{creada:null},{creada:'ayer'},{codigo:'abc'},{base:null},{propuesta:[]}]){
    await preparar();assert.equal((await guardar({sesion:{...contexto,...cambio}})).estado,'sesion_invalida');assert.equal(await cantidad(),0);
   }
  });
  await t.test('corregir conserva creación original y exige código nuevo',async()=>{
   await preparar();await guardar();
   for(const [evento,cambio] of [['reloj',{creada:contexto.creada+1,codigo:'b'.repeat(32)}],['codigo',{propuesta:{inicio:'11:00'}}]]){
    await db.query("insert into bot_borradores select $1,acceso_id,perfil_id,version_acceso,numero,tipo,texto from bot_borradores where evento_id='evento'",[evento]);
    assert.equal((await guardar({evento,revision:1,sesion:{...contexto,...cambio}})).estado,'contexto_invalido');
   }
   assert.deepEqual((await db.query('select revision,sesion from laso_edicion_privada.sesiones')).rows[0],{revision:1,sesion:contexto});
   await db.exec("insert into bot_borradores select 'correccion',acceso_id,perfil_id,version_acceso,numero,tipo,texto from bot_borradores where evento_id='evento'");
   assert.deepEqual(await guardar({evento:'correccion',revision:1,sesion:{...contexto,codigo:'b'.repeat(32)}}),{estado:'guardada',revision:2});
  });
  await t.test('después de descartar admite conversación nueva con creación propia',async()=>{
   await preparar();await guardar();
   for(const evento of ['cancelacion','nueva'])await db.query("insert into bot_borradores select $1,acceso_id,perfil_id,version_acceso,numero,tipo,texto from bot_borradores where evento_id='evento'",[evento]);
   await guardar({evento:'cancelacion',revision:1,sesion:null});
   assert.deepEqual(await guardar({evento:'nueva',revision:2,sesion:{...contexto,creada:contexto.creada+1,codigo:'c'.repeat(32)}}),{estado:'guardada',revision:3});
  });
 }finally{await db.close();}
});
