import test from 'node:test';
import assert from 'node:assert/strict';
import {proponerEdicion} from '../supabase/functions/laso-privado/agenda-edicion.mjs';
const ahora=new Date('2026-11-25T23:00:00Z');
const orden={id:'orden-local',numero_orden:42,fecha_programada:'2026-11-26',hora_inicio:'09:00:00',hora_fin:'11:00:00',estado:'pendiente'};
const pedir=(texto,extra={})=>proponerEdicion({texto,ordenes:[orden],operador:'operador-local',ahora,...extra});
test('reprograma una propuesta conservando duración y sin mutar la orden',()=>{
 const antes=JSON.stringify(orden);const r=pedir('Pasá la orden #42 para mañana a las 10');
 assert.equal(r.estado,'propuesta');assert.deepEqual(r.sesion.propuesta,{fecha:'2026-11-26',inicio:'10:00',fin:'12:00'});assert.equal(JSON.stringify(orden),antes);
});
test('mejor a las 11 conserva orden y fecha de la conversación',()=>{
 const a=pedir('Pasá la orden #42 para mañana a las 10');const b=pedir('Mejor a las 11',{sesion:a.sesion});
 assert.deepEqual(b.sesion.propuesta,{fecha:'2026-11-26',inicio:'11:00',fin:'13:00'});assert.equal(b.sesion.numero,42);
});
test('sesión vencida, ajena o ausente exige identificar la orden',()=>{
 const s=pedir('Pasá la orden #42 para mañana a las 10').sesion;
 for(const sesion of [null,{...s,operador:'otro'},{...s,creada:ahora.getTime()-1800000}])assert.equal(pedir('Mejor a las 11',{sesion}).estado,'aclarar');
});
test('cambios externos invalidan la propuesta anterior',()=>{
 const sesion=pedir('Pasá la orden #42 para mañana a las 10').sesion;
 assert.equal(pedir('Mejor a las 11',{sesion,ordenes:[{...orden,hora_inicio:'08:00:00'}]}).estado,'aclarar');
});
test('fecha imposible, hora inválida, pasado y cruce de medianoche se rechazan',()=>{
 for(const cambio of ['31/02/2027 a las 10','mañana a las 25','mañana a las 10:99','hoy a las 19','mañana a las 23','mañana a las 10 o 11'])assert.equal(pedir('Pasá la orden #42 para '+cambio).estado,'aclarar');
});
test('superposición bloquea y horario contiguo permite propuesta',()=>{
 const otra={...orden,id:'otra',numero_orden:43,hora_inicio:'11:00',hora_fin:'13:00'};
 assert.equal(pedir('Pasá la orden #42 para mañana a las 10',{ordenes:[orden,otra]}).estado,'aclarar');
 assert.equal(pedir('Pasá la orden #42 para mañana a las 13',{ordenes:[orden,otra]}).estado,'propuesta');
});
test('no elige entre duplicados ni modifica órdenes finalizadas',()=>{
 for(const ordenes of [[],[orden,orden],[{...orden,estado:'completada'}]])assert.equal(pedir('Pasá la orden #42 para mañana a las 10',{ordenes}).estado,'aclarar');
});
test('cancelar descarta propuesta y confirmar no ejecuta ninguna acción',()=>{
 assert.equal(pedir('Cancelar cambio').estado,'cancelado');assert.equal(pedir('Confirmar abcdef12').estado,'aclarar');
});
test('pasado mañana usa el día de Córdoba y no el día UTC',()=>{
 const r=pedir('Pasá la orden #42 para pasado mañana a las 10',{ahora:new Date('2026-11-26T01:00:00Z')});
 assert.equal(r.sesion.propuesta.fecha,'2026-11-27');
});
