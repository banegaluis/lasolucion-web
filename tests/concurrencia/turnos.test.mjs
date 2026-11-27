import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import pg from 'pg';

// Cluster efímero propio, socket privado; no acepta DATABASE_URL ni accede a Supabase.
test('concurrencia real de turnos en PostgreSQL local',async t=>{
 const root=await mkdtemp(join(tmpdir(),'laso-pg-'));
 const pkg=dirname(dirname(fileURLToPath(import.meta.resolve('@embedded-postgres/linux-x64'))));
 const native=join(pkg,'native');
 const env={...process.env,LD_LIBRARY_PATH:join(native,'lib')};
 const data=join(root,'data');
 const ctl=(...args)=>execFileSync(join(native,'bin/pg_ctl'),['-D',data,...args],{env,stdio:'pipe'});
 const clients=[];let started=false;
 try{
  execFileSync(process.execPath,['scripts/hydrate-symlinks.js'],{cwd:pkg,stdio:'pipe'});
  execFileSync(join(native,'bin/initdb'),['-D',data,'-U','laso_local','-A','trust','--no-locale','--encoding=UTF8'],{env,stdio:'pipe'});
  ctl('-l',join(root,'servidor.log'),'-o',`-k ${root} -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start');started=true;
  async function connect(name){const c=new pg.Client({host:root,user:'laso_local',database:'postgres',application_name:name,statement_timeout:10000});await c.connect();clients.push(c);return c;}
  const admin=await connect('control'),a=await connect('confirmacion-a'),b=await connect('confirmacion-b');
  await admin.query(await readFile(new URL('./esquema.sql',import.meta.url),'utf8'));
  await admin.query(await readFile(new URL('./autorizacion-desplegada.sql',import.meta.url),'utf8'));
  await admin.query(await readFile(new URL('../sql-aislado/turno-desplegado.sql',import.meta.url),'utf8'));
  const acceso='00000000-0000-0000-0000-000000000001',perfil='00000000-0000-0000-0000-000000000002';
  async function preparar(dos=false){
   await admin.query('truncate ordenes,direcciones_clientes,clientes,bot_borradores,laso_turnos_confirmacion,bot_accesos,perfiles restart identity cascade');
   await admin.query("insert into perfiles values($1,true,'activo','admin')",[perfil]);
   await admin.query("insert into bot_accesos values($1,$2,'+5493512143961',true,ARRAY['agenda.registrar'],1)",[acceso,perfil]);
   const cliente=(await admin.query('insert into clientes default values returning id')).rows[0].id;
   const dir=(await admin.query("insert into direcciones_clientes(cliente_id,direccion_completa) values($1,'Local 1') returning id",[cliente])).rows[0].id;
   for(const codigo of dos?['abcdef12','abcdef13']:['abcdef12']){
    await admin.query("insert into bot_borradores values($1,$2,$3,1,'+5493512143961','texto',$4)",[codigo,acceso,perfil,`CONFIRMAR ${codigo}`]);
    await admin.query("insert into laso_turnos_confirmacion(codigo,acceso_id,perfil_id,version_acceso,cliente_id,direccion_id,titulo,fecha,inicio,fin) values($1,$2,$3,1,$4,$5,'Local',current_date+2,'10:00','12:00')",[codigo,acceso,perfil,cliente,dir]);
   }
  }
  const confirmar=async(c,codigo='abcdef12')=>(await c.query("select laso_confirmar_turno($1,'+5493512143961',1,$1) as r",[codigo])).rows[0].r;
  const contar=async()=>Number((await admin.query('select count(*) as n from ordenes')).rows[0].n);
  async function esperarBloqueo(nombre){
   const deadline=Date.now()+5000;
   while(Date.now()<deadline){
    const r=await admin.query("select 1 from pg_stat_activity where application_name=$1 and wait_event_type='Lock'",[nombre]);
    if(r.rowCount)return;
    await new Promise(r=>setTimeout(r,10));
   }
   throw Error(`No se observó bloqueo de ${nombre}`);
  }
  await t.test('dos conexiones confirman el mismo código sin duplicar',async()=>{
   await preparar();await a.query('begin');const primero=await confirmar(a);
   const segundo=confirmar(b);await esperarBloqueo('confirmacion-b');await a.query('commit');
   assert.equal(primero.estado,'registrado');assert.deepEqual(await segundo,primero);assert.equal(await contar(),1);
  });
  await t.test('reservas superpuestas se serializan entre conexiones',async()=>{
   await preparar(true);await a.query('begin');assert.equal((await confirmar(a)).estado,'registrado');
   const segundo=confirmar(b,'abcdef13');await esperarBloqueo('confirmacion-b');await a.query('commit');
   assert.equal((await segundo).estado,'ocupado');assert.equal(await contar(),1);
  });
  await t.test('revocación durante espera debe impedir escritura',async()=>{
   await preparar();await a.query("begin; select pg_advisory_xact_lock(hashtext('laso_turno'),0)");
   const pendiente=confirmar(b);await esperarBloqueo('confirmacion-b');
   await admin.query('update bot_accesos set activo=false,version=2');
   await a.query('commit');
   // Invariante de seguridad pendiente de ejecutar; no aceptar la carrera como éxito.
   assert.equal((await pendiente).estado,'denegado');assert.equal(await contar(),0);
   assert.equal((await confirmar(b)).estado,'denegado');
  });
 }catch(e){
  console.error(await readFile(join(root,'servidor.log'),'utf8').catch(()=>''));throw e;
 }finally{
  for(const c of clients){try{await c.query('rollback');}catch{}try{await c.end();}catch{}}
  if(started)ctl('-m','immediate','-w','stop');
  await rm(root,{recursive:true,force:true});
 }
});
