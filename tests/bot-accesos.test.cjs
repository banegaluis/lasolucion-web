const {test}=require('node:test');const assert=require('node:assert/strict');
const c=require('../crm/js/botAccesosCore.js');
test('Normaliza sin inventar país ni dígitos',()=>{assert.equal(c.numero('+54 9 (351) 123-4567'),'+5493511234567');assert.throws(()=>c.numero('3511234567'));assert.throws(()=>c.numero('+54abc3511234567'));});
test('Rechaza permiso desconocido y alta activa sin permisos',()=>{assert.throws(()=>c.validar({numero:'+5493511234567',perfil_id:'persona',activo:true,permisos:[]}));assert.throws(()=>c.validar({numero:'+5493511234567',perfil_id:'persona',activo:true,permisos:['admin']}));});
test('Permite revocar conservando las opciones y guardar deshabilitado',()=>{assert.ok(c.validar({numero:'+5493511234567',perfil_id:'persona',activo:false,permisos:[]}));});
test('Registrar gastos no concede consulta de Caja',()=>{const d={numero:'+5493511234567',perfil_id:'persona',activo:true,permisos:['gastos.registrar']};c.validar(d);assert.deepEqual(d.permisos,['gastos.registrar']);});
