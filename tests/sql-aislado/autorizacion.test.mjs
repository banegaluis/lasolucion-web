import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('autorización SQL desplegada sobre identidades locales',async t=>{
 const db=new PGlite();
 const acceso='00000000-0000-0000-0000-000000000001',perfil='00000000-0000-0000-0000-000000000002';
 try{
  await db.exec(await readFile(new URL('../concurrencia/esquema.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../concurrencia/autorizacion-desplegada.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('./turno-desplegado.sql',import.meta.url),'utf8'));
  async function preparar(){
   await db.exec('truncate bot_accesos,perfiles,bot_borradores,laso_turnos_confirmacion,ordenes');
   await db.query("insert into perfiles values($1,true,'activo','admin')",[perfil]);
   await db.query("insert into bot_accesos values($1,$2,'+5493512143961',true,ARRAY['agenda.registrar'],1)",[acceso,perfil]);
  }
  const autorizar=async(version=1)=>(await db.query("select * from bot_autorizar('+5493512143961','agenda.registrar',$1)",[version])).rows;
  const confirmar=async()=>(await db.query("select laso_confirmar_turno('abcdef12','+5493512143961',1,'evento-local') as r")).rows[0].r;
  await t.test('acceso autorizado devuelve identidad y versión exactas',async()=>{
   await preparar();assert.deepEqual(await autorizar(),[{acceso_id:acceso,perfil_id:perfil,version:1}]);
  });
  for(const [nombre,sql] of [
   ['acceso revocado',"update bot_accesos set activo=false"],
   ['versión anterior',"update bot_accesos set version=2"],
   ['permiso retirado',"update bot_accesos set permisos=ARRAY[]::text[]"],
   ['perfil inactivo',"update perfiles set activo=false"],
   ['rol cliente',"update perfiles set rol='cliente'"],
   ['estado suspendido',"update perfiles set estado='suspendido'"]
  ])await t.test(nombre+' impide confirmar',async()=>{
   await preparar();await db.exec(sql);assert.deepEqual(await autorizar(),[]);
   assert.equal((await confirmar()).estado,'denegado');
   assert.equal((await db.query('select count(*)::int as n from ordenes')).rows[0].n,0);
  });
 }finally{await db.close();}
});
