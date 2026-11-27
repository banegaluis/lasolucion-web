import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {interpretarLista} from '../../supabase/functions/whatsapp-interno/memoria-listas-parser.mjs';
for(const corregida of [false,true]) test(`memoria ${corregida?'propuesta':'desplegada'}: comandos, deduplicación y rollback aislados`,async t=>{
 const db=new PGlite(),id='00000000-0000-0000-0000-000000000001',perfil='00000000-0000-0000-0000-000000000002';
 try{
  for(const p of ['../concurrencia/esquema.sql','../concurrencia/autorizacion-desplegada.sql'])await db.exec(await readFile(new URL(p,import.meta.url),'utf8'));
  await db.exec(`create table laso_listas(id uuid primary key default gen_random_uuid(),perfil_id uuid not null references perfiles,nombre text not null check(char_length(nombre) between 1 and 120),clave text not null check(char_length(clave) between 1 and 120),items jsonb not null default '[]' check(jsonb_typeof(items)='array' and jsonb_array_length(items)<=150),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(perfil_id,clave));
  create table laso_listas_historial(evento_id text primary key,perfil_id uuid not null references perfiles,lista_id uuid not null references laso_listas,accion text not null check(accion in ('crear','agregar','comprado','pendiente','quitar')),antes jsonb not null,despues jsonb not null,created_at timestamptz not null default now());`);
  await db.exec('create role authenticated; create role anon; create role service_role;');
  await db.exec(await readFile(new URL(corregida?'../../supabase/propuestas/memoria-atomica.sql':'./memoria-desplegada.sql',import.meta.url),'utf8'));
  if(corregida)for(const reinstalar of [false,true])await t.test(`permisos explícitos: ${reinstalar?'reemplazo con grants previos':'instalación limpia'}`,async()=>{
   const firma='public.laso_memoria(text,uuid,uuid,integer,text,text,text,text,jsonb,integer)';
   if(reinstalar){
    await db.exec(`grant execute on function ${firma} to public,anon,authenticated`);
    await db.exec(await readFile(new URL('../../supabase/propuestas/memoria-atomica.sql',import.meta.url),'utf8'));
   }
   for(const rol of ['anon','authenticated','service_role']){
    const permiso=(await db.query('select has_function_privilege($1,$2,\'EXECUTE\') ok',[rol,firma])).rows[0].ok;
    assert.equal(permiso,rol==='service_role');
    if(rol!=='service_role'){
     await db.exec('set role '+rol);
     try{await assert.rejects(()=>db.exec("select public.laso_memoria(null,null,null,null,null,null,null,null,null,null)"),e=>e.code==='42501');}
     finally{await db.exec('reset role');}
    }
   }
  });
  async function preparar(){
   await db.exec('truncate laso_listas_historial,laso_listas,bot_borradores,bot_accesos,perfiles cascade');
   await db.query("insert into perfiles values($1,true,'activo','admin')",[perfil]);
   await db.query("insert into bot_accesos values($1,$2,'+5493512143961',true,ARRAY['agenda.registrar'],1)",[id,perfil]);
   for(const evento of ['crear','agregar','ver','quitar'])await db.query("insert into bot_borradores values($1,$2,$3,1,'+5493512143961','texto','comando local')",[evento,id,perfil]);
  }
  const llamar=async(evento,comando,numero='+5493512143961')=>{
   const p=interpretarLista(comando);assert.ok(p);
   return (await db.query('select public.laso_memoria($1,$2,$3,1,$4,$5,$6,$7,$8::jsonb,$9) r',[numero,id,perfil,evento,p.accion,p.nombre??null,p.clave??null,JSON.stringify(p.items??[]),p.indice??null])).rows[0].r;
  };
  const crear=()=>llamar('crear','Creá lista materiales: 2 codos; 1 caño');
  // Intercalado determinista local: no equivale a concurrencia multiconexión.
  for(const punto of ['advisory','fila'])for(const [cambio,sql] of [
   ['perfil revocado','update public.perfiles set activo=false'],
   ['versión cambiada','update public.bot_accesos set version=2'],
   ['evento retirado',"delete from public.bot_borradores where evento_id='crear'"]
  ])await t.test(`revalidación tras ${punto}: ${cambio}`,async()=>{
   await preparar();
   const ruta=corregida?'../../supabase/propuestas/memoria-atomica.sql':'./memoria-desplegada.sql';
   const original=await readFile(new URL(ruta,import.meta.url),'utf8');
   const puntoSQL=punto==='advisory'?'perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_perfil::text,0));':'select * into l from public.laso_listas where perfil_id=p_perfil and clave=p_clave for update;';
   assert.ok(original.includes(puntoSQL));
   await db.exec(original.replace(puntoSQL,puntoSQL+'\n '+sql+';'));
   try{
    if(corregida){
     await assert.rejects(crear,/No autorizado|Evento no autorizado/);
     assert.equal((await db.query('select count(*)::int n from laso_listas')).rows[0].n,0);
     assert.equal((await db.query('select count(*)::int n from laso_listas_historial')).rows[0].n,0);
    }else assert.equal((await crear()).items.length,2);
   }finally{await db.exec(original);}
   await db.exec("update perfiles set activo=true; update bot_accesos set version=1");
   if(corregida)assert.equal((await crear()).items.length,2);
  });
  await t.test('parser a SQL conserva items y evita duplicar evento',async()=>{
   await preparar();assert.equal((await crear()).items.length,2);
   assert.deepEqual(await llamar('agregar','Agregá a lista materiales: 3 uniones'),{nombre:'materiales',items:[{texto:'2 codos',estado:'pendiente'},{texto:'1 caño',estado:'pendiente'},{texto:'3 uniones',estado:'pendiente'}]});
   assert.equal((await llamar('agregar','Agregá a lista materiales: 3 uniones')).error,'evento_repetido');
   assert.equal((await llamar('ver','Ver lista materiales')).items.length,3);
  });
  await t.test('evento consumido no se reutiliza con otros ítems, lista o acción',async()=>{
   await preparar();await crear();
   const snapshot=async()=>({listas:(await db.query('select * from laso_listas order by id')).rows,historial:(await db.query('select * from laso_listas_historial order by evento_id')).rows});
   const antes=await snapshot();
   for(const comando of ['Creá lista materiales: otro contenido','Creá lista compras: caño','Agregá a lista materiales: extra','Quitar item 1 de lista materiales','Comprado 2 de lista materiales']){
    assert.deepEqual(await llamar('crear',comando),{error:'evento_repetido'});
    assert.deepEqual(await snapshot(),antes);
   }
   assert.equal((await llamar('agregar','Agregá a lista materiales: autorizado')).items.length,3);
   assert.equal((await db.query('select count(*)::int n from laso_listas_historial')).rows[0].n,2);
  });
  await t.test('reintento consumido vuelve a exigir acceso y evento válidos',async()=>{
   await preparar();await crear();
   await db.exec('update bot_accesos set version=2');
   await assert.rejects(crear,/No autorizado/);
   await db.exec('update bot_accesos set version=1');
   await db.exec("delete from bot_borradores where evento_id='crear'");
   await assert.rejects(crear,/Evento no autorizado/);
   assert.equal((await db.query('select jsonb_array_length(items) n from laso_listas')).rows[0].n,2);
   assert.equal((await db.query('select count(*)::int n from laso_listas_historial')).rows[0].n,1);
  });
  await t.test('fallo de historial revierte creación completa y permite reintento',async()=>{
   await preparar();await db.exec("alter table laso_listas_historial add constraint fallo_local check(evento_id<>'crear')");
   try{await assert.rejects(crear,e=>e.code==='23514');}finally{await db.exec('alter table laso_listas_historial drop constraint fallo_local');}
   assert.equal((await db.query('select count(*)::int n from laso_listas')).rows[0].n,0);
   assert.equal((await crear()).items.length,2);
  });
  await t.test('número ajeno, evento ausente y perfil revocado no escriben',async()=>{
   await preparar();await assert.rejects(llamar('crear','Creá lista materiales: caño','+5493510000000'));
   await assert.rejects(llamar('ausente','Creá lista materiales: caño'));
   await db.exec('update perfiles set activo=false');await assert.rejects(crear);
   assert.equal((await db.query('select count(*)::int n from laso_listas')).rows[0].n,0);
  });
  await t.test('quitar conserva índice e historial y no se repite',async()=>{
   await preparar();await crear();const r=await llamar('quitar','Quitar item 1 de lista materiales');
   assert.equal(r.items.length,2);assert.equal(r.items[0].estado,'quitado');
   assert.equal((await llamar('quitar','Quitar item 1 de lista materiales')).error,'evento_repetido');
   assert.equal((await db.query('select count(*)::int n from laso_listas_historial')).rows[0].n,2);
  });
  await t.test('supresión silenciosa de historial: reproducción y corrección',async()=>{
   await preparar();
   await db.exec("create function omitir_memoria() returns trigger language plpgsql as $$ begin return null; end $$; create trigger omitir_historial before insert on laso_listas_historial for each row execute function omitir_memoria()");
   try{
    if(corregida){
     await assert.rejects(crear,e=>e.code==='P0001' && /incompleta/.test(e.message));
     assert.equal((await db.query('select count(*)::int n from laso_listas')).rows[0].n,0);
    }else{
     // Reproduce el defecto de la definición actual sin tocar producción.
     assert.equal((await crear()).items.length,2);
     assert.equal((await db.query('select count(*)::int n from laso_listas')).rows[0].n,1);
    }
    assert.equal((await db.query('select count(*)::int n from laso_listas_historial')).rows[0].n,0);
   }finally{await db.exec('drop trigger omitir_historial on laso_listas_historial');}
  });
  if(corregida)for(const [tabla,operacion] of [['laso_listas','insert'],['laso_listas','update'],['laso_listas_historial','insert']]){
   await t.test(`rollback y reintento cuando se omite ${operacion} en ${tabla}`,async()=>{
    await preparar();
    // UPDATE e historial prueban una lista existente; INSERT prueba creación.
    if(operacion!=='insert'||tabla!=='laso_listas')await crear();
    const accion=operacion==='insert'&&tabla==='laso_listas'?crear:()=>llamar('agregar','Agregá a lista materiales: 3 uniones');
    const antes=(await db.query('select id,items,updated_at from laso_listas')).rows;
    const historial=(await db.query('select * from laso_listas_historial')).rows;
    await db.exec(`create trigger omitir_escritura before ${operacion} on ${tabla} for each row execute function omitir_memoria()`);
    try{await assert.rejects(accion,e=>e.code==='P0001' && /incompleta/.test(e.message));}
    finally{await db.exec(`drop trigger omitir_escritura on ${tabla}`);}
    assert.deepEqual((await db.query('select id,items,updated_at from laso_listas')).rows,antes);
    assert.deepEqual((await db.query('select * from laso_listas_historial')).rows,historial);
    assert.equal((await accion()).items.length,antes.length?3:2);
    assert.equal((await db.query('select count(*)::int n from laso_listas_historial')).rows[0].n,historial.length+1);
   });
  }
  await t.test('RLS limita lista e historial al administrador activo propietario',async()=>{
   await preparar();await crear();
   const ajeno='00000000-0000-0000-0000-000000000099';
   await db.query("insert into perfiles values($1,true,'activo','admin')",[ajeno]);
   await db.exec("create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; grant select on perfiles,laso_listas,laso_listas_historial to authenticated; revoke all on function public.laso_memoria(text,uuid,uuid,integer,text,text,text,text,jsonb,integer) from public;");
   await db.exec(await readFile(new URL('./memoria-politicas.sql',import.meta.url),'utf8'));
   async function visibles(usuario){
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[usuario]);
    await db.exec('set role authenticated');
    try{return (await db.query('select (select count(*)::int from laso_listas) listas,(select count(*)::int from laso_listas_historial) historial')).rows[0];}
    finally{await db.exec('reset role');}
   }
   assert.deepEqual(await visibles(perfil),{listas:1,historial:1});
   assert.deepEqual(await visibles(ajeno),{listas:0,historial:0});
   assert.deepEqual(await visibles(''),{listas:0,historial:0});
   await db.exec('update perfiles set activo=false');assert.deepEqual(await visibles(perfil),{listas:0,historial:0});
   await db.exec("update perfiles set activo=true,rol='tecnico'");assert.deepEqual(await visibles(perfil),{listas:0,historial:0});
   await db.exec("update perfiles set rol='admin',estado='inactivo'");assert.deepEqual(await visibles(perfil),{listas:0,historial:0});
  });
  await t.test('roles de aplicación no escriben listas ni ejecutan RPC',async()=>{
   for(const rol of ['authenticated','anon']){
    await db.exec('set role '+rol);
    try{
     await assert.rejects(()=>db.exec("insert into laso_listas(perfil_id,nombre,clave) values('00000000-0000-0000-0000-000000000002','Inyección local','inyeccion')"),e=>e.code==='42501');
     await assert.rejects(()=>db.exec("update laso_listas set nombre='Alterada'"),e=>e.code==='42501');
     await assert.rejects(crear,e=>e.code==='42501');
    }finally{await db.exec('reset role');}
   }
   assert.equal((await db.query('select count(*)::int n from laso_listas')).rows[0].n,1);
  });
 }finally{await db.close();}
});
