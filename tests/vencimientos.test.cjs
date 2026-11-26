const test=require('node:test');
const assert=require('node:assert/strict');
const c=require('../crm/js/vencimientosCore.js');
test('calendario anual y fin de febrero bisiesto',()=>{
 assert.equal(c.sumarMeses('2024-02-29',12),'2025-02-28');
 assert.equal(c.sumarMeses('2026-10-21',12),'2027-10-21');
 assert.equal(c.sumarMeses('2025-01-31',1),'2025-02-28');
});
test('días calculados en UTC, sin desfase por horario local',()=>{
 assert.equal(c.diferenciaDias('2027-10-21','2027-09-21'),30);
 assert.equal(c.diferenciaDias('2027-10-21','2027-10-14'),7);
 assert.deepEqual(c.proximos({activo:true,fecha_vencimiento:'2027-10-21',avisos_dias:[30,7,0]},'2027-09-21').filter(x=>x.pendiente).map(x=>x.dias_antes),[30]);
});
test('fechas imposibles y periodicidad no válida',()=>{
 assert.throws(()=>c.fechaUTC('2027-02-29'));
 assert.throws(()=>c.sumarMeses('2027-01-01',0));
 assert.throws(()=>c.diasAviso([42]));
});
test('no sugerir envíos en registros inactivos',()=>{
 assert.deepEqual(c.proximos({activo:false,fecha_vencimiento:'2027-10-21',avisos_dias:[30]},'2027-09-21'),[]);
});
test('mensaje no afirma vencimiento legal obligatorio',()=>{
 const m=c.mensaje({titulo:'Renovación de certificado de gas',fecha_vencimiento:'2027-10-21'},{nombre_completo:'Juan'});
 assert.match(m,/La Solución/);assert.match(m,/21\/10\/2027/);
 assert.doesNotMatch(m,/obligatori/i);
});
