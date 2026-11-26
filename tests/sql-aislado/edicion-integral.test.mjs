import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {ejecutarEdicion} from '../../supabase/functions/laso-privado/agenda-edicion-ejecucion.mjs';
import {conversarEdicion} from '../../supabase/functions/laso-privado/agenda-edicion-conversacion.mjs';

test('conversación de edición con persistencia JSONB y transacción SQL', async t=>{
 const db=new PGlite();
 const operador='00000000-0000-0000-0000-000000000001',perfil='00000000-0000-0000-0000-000000000002';
 try {
  for(const p of ['../concurrencia/esquema.sql','../concurrencia/autorizacion-desplegada.sql','../../supabase/propuestas/edicion-sesion.sql','../../supabase/propuestas/edicion-sesion-autorizada.sql','../../supabase/propuestas/edicion-confirmar.sql','../../supabase/propuestas/edicion-permisos.sql'])await db.exec(await readFile(new URL(p,import.meta.url),'utf8'));
  await db.query("insert into perfiles values($1,true,'activo','admin')",[perfil]);
  await db.query("insert into bot_accesos values($1,$2,'+5493512143961',true,ARRAY['agenda.editar'],1)",[operador,perfil]);
  await db.exec("insert into ordenes(titulo,fecha_programada,hora_inicio,hora_fin,estado) values('Trabajo aislado',current_date+2,'09:00','11:00','pendiente')");
  const ordenes=async()=>(await db.query('select id,numero_orden::int,fecha_programada::text,hora_inicio::text,hora_fin::text,estado,cliente_id,direccion_cliente_id,titulo from ordenes')).rows;
  const contexto=async()=>(await db.query('select revision::int,sesion from laso_edicion_privada.sesiones')).rows[0];
  async function evento(id,texto){await db.query("insert into bot_borradores values($1,$2,$3,1,'+5493512143961','texto',$4)",[id,operador,perfil,texto]);}
  async function guardar(id,texto,revision,sesion){
   await evento(id,texto);
   return (await db.query("select laso_edicion_privada.guardar_autorizada('+5493512143961',1,$1,$2,$3::jsonb) r",[id,revision,sesion===null?null:JSON.stringify(sesion)])).rows[0].r;
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
   const guardada=await contexto();
   const fechaCorregida=await conversar('Mejor para mañana',guardada.sesion);
   assert.equal(fechaCorregida.estado,'propuesta');
   assert.equal(fechaCorregida.sesion.propuesta.inicio,'14:00');
   assert.notEqual(fechaCorregida.sesion.propuesta.fecha,guardada.sesion.propuesta.fecha);
   assert.equal((await guardar('correccion-fecha','Mejor para mañana',guardada.revision,fechaCorregida.sesion)).estado,'guardada');
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
   const ejecutada=await ejecutarEdicion({entrada:{mensaje:{tipo:'texto',texto},ordenes:await ordenes(),sesion:c.sesion,operador},revision:c.revision,guardarSesion:async()=>{throw new Error('No consumir por separado');},confirmarCambio:({codigo,revision})=>confirmar('confirmacion',codigo,revision)});
   assert.equal(ejecutada.estado,'editada');assert.match(ejecutada.mensaje,/quedó guardado/);
   assert.equal((await confirmar('confirmacion',resultado.intencion.codigo,c.revision)).repetido,true);
   assert.equal((await ordenes())[0].hora_inicio,'14:00:00');
   assert.equal((await contexto()).sesion,null);
   assert.equal((await db.query('select count(*)::int n from laso_edicion_privada.cambios')).rows[0].n,1);
  });
  async function prepararNueva(nombre){
   const c=await contexto();
   const texto='Pasá la orden #1 para pasado mañana a las 10:00';
   const r=await conversar(texto);assert.equal(r.estado,'propuesta');
   assert.equal((await guardar(nombre,texto,c.revision,r.sesion)).estado,'guardada');
   return contexto();
  }
  await t.test('cancelación persistida invalida código y bloquea corrección atrasada',async()=>{
   const c=await prepararNueva('pedido-cancelable');
   const atrasada=await conversar('Mejor a las 11:00',c.sesion);
   const cancelacion=await conversar('Cancelar cambio',c.sesion);
   assert.equal(cancelacion.estado,'cancelado');
   assert.equal((await guardar('cancelar','Cancelar cambio',c.revision,cancelacion.sesion)).estado,'guardada');
   const cancelado=await contexto();assert.equal(cancelado.sesion,null);
   assert.equal((await guardar('atrasada','Mejor a las 11:00',c.revision,atrasada.sesion)).estado,'conflicto');
   await evento('confirmar-cancelado','CONFIRMAR CAMBIO '+c.sesion.codigo);
   assert.equal((await confirmar('confirmar-cancelado',c.sesion.codigo,c.revision)).estado,'propuesta_invalida');
   assert.deepEqual(await contexto(),cancelado);
   assert.equal((await ordenes())[0].hora_inicio,'14:00:00');
  });
  await t.test('cambio externo después de validar conversación se detecta en SQL',async()=>{
   const c=await prepararNueva('pedido-cambio-externo');
   const texto='CONFIRMAR CAMBIO '+c.sesion.codigo;
   assert.equal((await conversar(texto,c.sesion)).estado,'intencion_validada');
   // Intercalado secuencial deliberado: no acredita concurrencia multiconexión.
   await db.exec("update ordenes set titulo='Modificado desde CRM aislado'");
   await evento('confirmar-cambio-externo',texto);
   assert.equal((await confirmar('confirmar-cambio-externo',c.sesion.codigo,c.revision)).estado,'orden_cambiada');
   assert.equal((await ordenes())[0].hora_inicio,'14:00:00');
   assert.deepEqual(await contexto(),c);
   assert.equal((await db.query('select count(*)::int n from laso_edicion_privada.cambios')).rows[0].n,1);
  });
  await t.test('revocación posterior a conversación impide edición y consumo de sesión',async()=>{
   const c=await contexto();
   // Restaurar solamente el dato local que cambió en el escenario anterior.
   await db.query('update ordenes set titulo=$1',[c.sesion.base.titulo]);
   const texto='CONFIRMAR CAMBIO '+c.sesion.codigo;
   assert.equal((await conversar(texto,c.sesion)).estado,'intencion_validada');
   await evento('confirmar-revocado',texto);
   await db.exec('update bot_accesos set activo=false');
   assert.equal((await confirmar('confirmar-revocado',c.sesion.codigo,c.revision)).estado,'denegado');
   assert.deepEqual(await contexto(),c);
   assert.equal((await ordenes())[0].hora_inicio,'14:00:00');
   assert.equal((await db.query('select count(*)::int n from laso_edicion_privada.cambios')).rows[0].n,1);
  });
 }finally{await db.close();}
});
