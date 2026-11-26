import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {interpretarLista} from '../../supabase/functions/whatsapp-interno/memoria-listas-parser.mjs';
test('memoria desplegada: comandos, deduplicación y rollback aislados',async t=>{
 const db=new PGlite(),id='00000000-0000-0000-0000-000000000001',perfil='00000000-0000-0000-0000-000000000002';
 try{
  for(const p of ['../concurrencia/esquema.sql','../concurrencia/autorizacion-desplegada.sql'])await db.exec(await readFile(new URL(p,import.meta.url),'utf8'));
  await db.exec(`create table laso_listas(id uuid primary key default gen_random_uuid(),perfil_id uuid not null references perfiles,nombre text not null check(char_length(nombre) between 1 and 120),clave text not null check(char_length(clave) between 1 and 120),items jsonb not null default '[]' check(jsonb_typeof(items)='array' and jsonb_array_length(items)<=150),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(perfil_id,clave));
  create table laso_listas_historial(evento_id text primary key,perfil_id uuid not null references perfiles,lista_id uuid not null references laso_listas,accion text not null check(accion in ('crear','agregar','comprado','pendiente','quitar')),antes jsonb not null,despues jsonb not null,created_at timestamptz not null default now());`);
  await db.exec(await readFile(new URL('./memoria-desplegada.sql',import.meta.url),'utf8'));
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
  await t.test('parser a SQL conserva items y evita duplicar evento',async()=>{
   await preparar();assert.equal((await crear()).items.length,2);
   assert.deepEqual(await llamar('agregar','Agregá a lista materiales: 3 uniones'),{nombre:'materiales',items:[{texto:'2 codos',estado:'pendiente'},{texto:'1 caño',estado:'pendiente'},{texto:'3 uniones',estado:'pendiente'}]});
   assert.equal((await llamar('agregar','Agregá a lista materiales: 3 uniones')).error,'evento_repetido');
   assert.equal((await llamar('ver','Ver lista materiales')).items.length,3);
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
 }finally{await db.close();}
});
