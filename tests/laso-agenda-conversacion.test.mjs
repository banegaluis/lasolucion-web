import test from 'node:test';
import assert from 'node:assert/strict';
import {conversarEdicion} from '../supabase/functions/laso-privado/agenda-edicion-conversacion.mjs';
const ahora=new Date('2026-11-25T23:00:00Z');
const orden={id:'orden-local',numero_orden:42,fecha_programada:'2026-11-26',hora_inicio:'09:00:00',hora_fin:'11:00:00',estado:'pendiente'};
const hablar=(texto,extra={})=>conversarEdicion({mensaje:{tipo:'texto',texto},ordenes:[orden],operador:'privado-local',ahora,...extra});
const preparar=()=>hablar('Pasá la orden #42 para mañana a las 10');
const confirmar=s=>`CONFIRMAR CAMBIO ${s.codigo}`;
test('propuesta, corrección y confirmación producen intención sin modificar orden',()=>{
 const antes=structuredClone(orden);const a=preparar();const b=hablar('Mejor a las 11',{sesion:a.sesion});
 assert.notEqual(a.sesion.codigo,b.sesion.codigo);
 const r=hablar(confirmar(b.sesion),{sesion:b.sesion});
 assert.equal(r.estado,'intencion_validada');assert.equal(r.intencion.propuesta.inicio,'11:00');assert.equal(r.sesion,null);assert.deepEqual(orden,antes);
});
test('código anterior queda invalidado por una corrección',()=>{
 const a=preparar();const b=hablar('Mejor a las 11',{sesion:a.sesion});
 const r=hablar(confirmar(a.sesion),{sesion:b.sesion});assert.equal(r.estado,'aclarar');assert.equal(r.sesion,null);assert.equal(r.intencion,undefined);
});
test('confirmación alterada, de alta o audio no habilita intención',()=>{
 const {sesion}=preparar();
 for(const texto of [confirmar(sesion)+'.',`CONFIRMAR ${sesion.codigo}`,`CONFIRMAR ALTA ${sesion.codigo}`,confirmar(sesion).replace('CAMBIO ','CAMBIO  ')])assert.equal(hablar(texto,{sesion}).intencion,undefined);
 assert.equal(hablar('',{sesion,mensaje:{tipo:'audio',texto:confirmar(sesion)}}).intencion,undefined);
});
test('confirmar revalida vencimiento e identidad',()=>{
 const {sesion}=preparar();
 for(const extra of [{operador:'ajeno'},{ahora:new Date(ahora.getTime()+1800000)},{operador:''}])assert.equal(hablar(confirmar(sesion),{sesion,...extra}).intencion,undefined);
});
test('cambio externo y nueva superposición bloquean confirmación',()=>{
 const {sesion}=preparar();
 for(const ordenes of [[{...orden,hora_fin:'12:00:00'}],[orden,{...orden,id:'otra',numero_orden:43,hora_inicio:'10:00:00'}]])assert.equal(hablar(confirmar(sesion),{sesion,ordenes}).intencion,undefined);
});
test('cancelar o corregir con datos inválidos retira la sesión confirmable',()=>{
 const {sesion}=preparar();
 for(const texto of ['Cancelar cambio','Mejor a las 99']){
  const r=hablar(texto,{sesion});assert.equal(r.sesion,null);assert.equal(hablar(confirmar(sesion),{sesion:r.sesion}).intencion,undefined);
 }
});
test('repetir confirmación con la sesión consumida no genera otra intención',()=>{
 const {sesion}=preparar();const r=hablar(confirmar(sesion),{sesion});
 assert.equal(hablar(confirmar(sesion),{sesion:r.sesion}).intencion,undefined);
});
test('corregir solo fecha conserva horario, duración y vencimiento; renueva código',()=>{
 const a=preparar();
 for(const texto of ['Mejor pasado mañana','Mejor para pasado mañana','Mejor para el 27/11/2026']){
  const b=hablar(texto,{sesion:a.sesion});assert.equal(b.estado,'propuesta');
  assert.deepEqual(b.sesion.propuesta,{fecha:'2026-11-27',inicio:'10:00',fin:'12:00'});
  assert.equal(b.sesion.creada,a.sesion.creada);assert.notEqual(b.sesion.codigo,a.sesion.codigo);
  assert.equal(hablar(confirmar(a.sesion),{sesion:b.sesion}).estado,'aclarar');
  assert.equal(hablar(confirmar(b.sesion),{sesion:b.sesion}).estado,'intencion_validada');
 }
});
test('corrección de fecha requiere contexto y no admite fechas ambiguas o imposibles',()=>{
 const {sesion}=preparar();
 assert.equal(hablar('Mejor para mañana').estado,'aclarar');
 for(const texto of ['Mejor para el viernes','Mejor mañana o pasado mañana','Mejor para el 31/02/2027','Mejor hoy'])assert.equal(hablar(texto,{sesion}).estado,'aclarar');
 for(const extra of [{operador:'ajeno'},{ahora:new Date(ahora.getTime()+1800000)}])assert.equal(hablar('Mejor pasado mañana',{sesion,...extra}).estado,'aclarar');
});
test('cambiar solo fecha revalida superposición y datos de la orden',()=>{
 const {sesion}=preparar();
 const ocupada={...orden,id:'otra',numero_orden:43,fecha_programada:'2026-11-27',hora_inicio:'10:00:00',hora_fin:'12:00:00'};
 assert.equal(hablar('Mejor pasado mañana',{sesion,ordenes:[orden,ocupada]}).estado,'aclarar');
 assert.equal(hablar('Mejor pasado mañana',{sesion,ordenes:[{...orden,titulo:'Modificada'}]}).estado,'aclarar');
});
