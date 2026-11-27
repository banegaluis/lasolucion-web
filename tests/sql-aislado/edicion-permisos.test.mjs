import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('cierre de permisos de edición frente a concesiones directas por defecto',async t=>{
 const db=new PGlite();
 const leer=p=>readFile(new URL(p,import.meta.url),'utf8');
 try{
  await db.exec('create role anon; create role authenticated; alter default privileges grant all on tables to anon,authenticated; alter default privileges grant execute on functions to anon,authenticated');
  for(const p of ['../concurrencia/esquema.sql','../concurrencia/autorizacion-desplegada.sql','../../supabase/propuestas/edicion-sesion.sql','../../supabase/propuestas/edicion-sesion-autorizada.sql','../../supabase/propuestas/edicion-confirmar.sql'])await db.exec(await leer(p));
  const firma='laso_edicion_privada.confirmar(text,integer,text,text,bigint)';
  // Reproduce concesiones directas que REVOKE FROM PUBLIC no elimina.
  assert.equal((await db.query('select has_function_privilege($1,$2,\'EXECUTE\') permitido',['anon',firma])).rows[0].permitido,true);
  await db.exec('grant usage on schema laso_edicion_privada to anon,authenticated');
  const cierre=await leer('../../supabase/propuestas/edicion-permisos.sql');
  await db.exec(cierre);
  await t.test('anon y authenticated no tienen acceso al esquema, tablas ni funciones',async()=>{
   for(const rol of ['anon','authenticated']){
    assert.equal((await db.query("select has_schema_privilege($1,'laso_edicion_privada','USAGE') permitido",[rol])).rows[0].permitido,false);
    const funciones=(await db.query("select p.oid, p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='laso_edicion_privada'")).rows;
    assert.equal(funciones.length,3);
    for(const f of funciones){assert.equal(f.prosecdef,false);assert.equal((await db.query("select has_function_privilege($1,$2::oid,'EXECUTE') permitido",[rol,f.oid])).rows[0].permitido,false);}
    for(const tabla of ['sesiones','eventos','cambios'])assert.equal((await db.query("select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') permitido",[rol,'laso_edicion_privada.'+tabla])).rows[0].permitido,false);
   }
  });
  await t.test('invocación real con rol restringido falla sin modificar tablas',async()=>{
   for(const rol of ['anon','authenticated']){
    await db.exec('set role '+rol);
    try{await assert.rejects(()=>db.query("select laso_edicion_privada.confirmar('+5493512143961',1,'local',$1,1)",['a'.repeat(32)]),e=>e.code==='42501');}
    finally{await db.exec('reset role');}
   }
   assert.equal((await db.query('select count(*)::int n from laso_edicion_privada.cambios')).rows[0].n,0);
  });
  await t.test('cierre repetible conserva permisos del propietario',async()=>{
   await db.exec(cierre);
   assert.equal((await db.query('select has_function_privilege(current_user,$1,\'EXECUTE\') permitido',[firma])).rows[0].permitido,true);
  });
 }finally{await db.close();}
});
