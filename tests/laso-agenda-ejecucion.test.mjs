import test from 'node:test';
import assert from 'node:assert/strict';
import {conversarEdicion} from '../supabase/functions/laso-privado/agenda-edicion-conversacion.mjs';
import {ejecutarEdicion} from '../supabase/functions/laso-privado/agenda-edicion-ejecucion.mjs';
const base={operador:'operador-local',ahora:new Date('2026-11-26T12:00:00Z'),ordenes:[{id:'orden-local',numero_orden:42,fecha_programada:'2026-11-27',hora_inicio:'09:00:00',hora_fin:'11:00:00',estado:'pendiente'}]};
const pedido={...base,mensaje:{tipo:'texto',texto:'Pasá la orden #42 para mañana a las 12'}};
const sesion=conversarEdicion(pedido).sesion;
const confirmacion={...base,sesion,mensaje:{tipo:'texto',texto:'CONFIRMAR CAMBIO '+sesion.codigo}};
const prohibido=async()=>assert.fail('puerto inesperado');
test('propuesta espera persistencia antes de mostrar código',async()=>{
 let resolver;const espera=new Promise(r=>resolver=r);let termino=false;
 const p=ejecutarEdicion({entrada:pedido,revision:0,guardarSesion:()=>espera,confirmarCambio:prohibido}).then(r=>{termino=true;return r;});
 await Promise.resolve();assert.equal(termino,false);
 resolver({estado:'guardada',revision:1});const r=await p;assert.equal(r.estado,'propuesta');assert.match(r.mensaje,/CONFIRMAR CAMBIO/);
});
test('confirmación llama una sola transacción y nunca borra sesión por separado',async()=>{
 let llamadas=0;const r=await ejecutarEdicion({entrada:confirmacion,revision:1,guardarSesion:prohibido,confirmarCambio:async p=>{llamadas++;assert.deepEqual(p,{codigo:sesion.codigo,revision:1});return {estado:'editada',orden_id:'orden-local'};}});
 assert.equal(llamadas,1);assert.equal(r.estado,'editada');
});
test('cancelación solo se informa después de guardar NULL',async()=>{
 const entrada={...base,sesion,mensaje:{tipo:'texto',texto:'Cancelar cambio'}};
 for(const [resultado,esperado] of [[{estado:'guardada',revision:2},'cancelado'],[{estado:'conflicto'},'rechazado']]){
  const r=await ejecutarEdicion({entrada,revision:1,guardarSesion:async p=>{assert.equal(p.sesion,null);return resultado;},confirmarCambio:prohibido});assert.equal(r.estado,esperado);
 }
});
test('error de transporte no afirma éxito ni rollback y no reintenta',async()=>{
 let llamadas=0;const r=await ejecutarEdicion({entrada:confirmacion,revision:1,guardarSesion:prohibido,confirmarCambio:async()=>{llamadas++;throw new Error('secreto que no debe salir');}});
 assert.equal(llamadas,1);assert.equal(r.estado,'resultado_desconocido');assert.doesNotMatch(JSON.stringify(r),/secreto/);
});
test('resultado duplicado o denegado no produce mensaje',async()=>{
 for(const resultado of [{estado:'editada',orden_id:'orden-local',repetido:true},{estado:'denegado'}]){
  const r=await ejecutarEdicion({entrada:confirmacion,revision:1,guardarSesion:prohibido,confirmarCambio:async()=>resultado});assert.equal(r.mensaje,null);assert.equal(r.releer,true);
 }
});
test('respuesta inconsistente no acredita guardado',async()=>{
 for(const resultado of [null,{estado:'editada',orden_id:'otra'},{estado:'desconocido'}])assert.equal((await ejecutarEdicion({entrada:confirmacion,revision:1,guardarSesion:prohibido,confirmarCambio:async()=>resultado})).estado,'resultado_desconocido');
 assert.equal((await ejecutarEdicion({entrada:pedido,revision:0,guardarSesion:async()=>({estado:'guardada',revision:9}),confirmarCambio:prohibido})).estado,'resultado_desconocido');
});
test('conflicto SQL pide releer sin anunciar edición',async()=>{
 const r=await ejecutarEdicion({entrada:confirmacion,revision:1,guardarSesion:prohibido,confirmarCambio:async()=>({estado:'orden_cambiada'})});assert.equal(r.estado,'rechazado');assert.equal(r.releer,true);
});
