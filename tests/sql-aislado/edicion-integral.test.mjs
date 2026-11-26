import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {conversarEdicion} from '../../supabase/functions/laso-privado/agenda-edicion-conversacion.mjs';

test('conversación de edición con persistencia JSONB y transacción SQL', async t=>{
 const db=new PGlite();
 const operador='00000000-0000-0000-0000-000000000001',perfil='00000000-0000-0000-0000-000000000002';
 try {
  for(const p of ['../concurrencia/esquema.sql','../concurrencia/autorizacion-desplegada.sql','../../supabase/propuestas/edicion-sesion.sql','../../supabase/propuestas/edicion-sesion-autorizada.sql','../../supabase/propuestas/edicion-confirmar.sql'])await db.exec(await readFile(new URL(p,import.meta.url),'utf8'));
  await db.query("insert into perfiles values($1,true,'activo','admin')",[perfil]);
  await db.query("insert into bot_accesos values($1,$2,'+5493512143961',true,ARRAY['agenda.editar'],1)",[operador,perfil]);
  await db.exec("insert into ordenes(titulo,fecha_programada,hora_inicio,hora_fin,estado) values('Trabajo aislado',current_date+2,'09:00','11:00','pendiente')");
  const ordenes=async()=>(await db.query('select id,numero_orden::int,fecha_programada::text,hora_inicio::text,hora_fin::text,estado,cliente_id,direccion_cliente_id,titulo from ordenes')).rows;
  const contexto=async()=>(await db.query('select revision::int,sesion from laso_edicion_privada.sesiones')).rows[0];
  async function evento(id,texto){await db.query("insert into bot_borradores values($1,$2,$3,1,'+5493512143961','texto',$4)",[id,operador,perfil,texto]);}
  async function guardar(id,texto,revision,sesion){
   await evento(id,texto);
   return (await db.query("select laso_edicion_privada.guardar_autorizada('+5493512143961',1,$1,$2,$3::jsonb) r",[id,revision,JSON.stringify(sesion)])).rows[0].r;
  }
  const conversar=async(texto,sesion=null)=>conversarEdicion({mensaje:{tipo:'texto',texto},ordenes:await ordenes(),sesion,operador});
  const confirmar=async(id,codigo,revision)=>(await db.query("select laso_edicion_privada.confirmar('+5493512143961',1,$1,$2,$3) r",[id,codigo,revision])).rows[0].r;
  let original,actual;
  await t.test('propuesta se guarda y la corrección sobre JSONB conserva contexto',async()=>{
   const texto='Pasá la orden #1 para pasado mañana a las 12:00';
   original=await conversar(texto);assert.equal(original.estado,'propuesta');
   assert.equal((await guardar('pedido',texto,0,original.sesion)).estado,'guardada');
   const c=await contexto();
   actual=await conversar('Mejor a las 14:00',c.sesion);assert.equal(actual.estado,'propuesta');
   assert.equal(actual.sesion.creada,original.sesion.creada);assert.notEqual(actual.sesion.codigo,original.sesion.codigo);
   assert.equal((await guardar('correccion','Mejor a las 14:00',c.revision,actual.sesion)).estado,'guardada');
   assert.equal((await ordenes())[0].hora_inicio,'09:00:00');
  });
  await t.test('código anterior no escribe; código actual atraviesa conversación y SQL una sola vez',async()=>{
   const c=await contexto();
   const viejo='CONFIRMAR CAMBIO '+original.sesion.codigo;
   assert.equal((await conversar(viejo,c.sesion)).estado,'aclarar');
   await evento('viejo',viejo);assert.equal((await confirmar('viejo',original.sesion.codigo,c.revision)).estado,'propuesta_invalida');
   const texto='CONFIRMAR CAMBIO '+c.sesion.codigo;
   const resultado=await conversar(texto,c.sesion);assert.equal(resultado.estado,'intencion_validada');
   await evento('confirmacion',texto);
   assert.equal((await confirmar('confirmacion',resultado.intencion.codigo,c.revision)).estado,'editada');
   assert.equal((await confirmar('confirmacion',resultado.intencion.codigo,c.revision)).repetido,true);
   assert.equal((await ordenes())[0].hora_inicio,'14:00:00');
   assert.equal((await contexto()).sesion,null);
   assert.equal((await db.query('select count(*)::int n from laso_edicion_privada.cambios')).rows[0].n,1);
  });
 }finally{await db.close();}
});
