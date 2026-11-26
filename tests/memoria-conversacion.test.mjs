import test from 'node:test';
import assert from 'node:assert/strict';
import {conversarMemoria as conversar} from '../supabase/functions/laso-privado/memoria-conversacion.mjs';
const operador={acceso_id:'00000000-0000-0000-0000-000000000001',perfil_id:'00000000-0000-0000-0000-000000000002',version_acceso:1};
const ahora=new Date('2026-11-26T20:00:00Z');
const pedir=(texto,tipo='texto',sesion=null,extra={})=>conversar({mensaje:{tipo,texto},operador,ahora,sesion,...extra});
const crear=()=>pedir('Creá lista materiales: 2 codos; caño 1,5 m');
const confirmar=(s,tipo='texto',extra={})=>pedir(`CONFIRMAR LISTA ${s.codigo}`,tipo,s,extra);
test('muestra todos los datos interpretados y confirma solo una intención',()=>{
 const r=crear();assert.equal(r.estado,'propuesta');assert.match(r.mensaje,/2 codos/);assert.match(r.mensaje,/caño 1,5 m/);
 const c=confirmar(r.sesion);assert.equal(c.estado,'intencion_validada');assert.deepEqual(c.intencion.propuesta.items,['2 codos','caño 1,5 m']);assert.equal(c.sesion,null);assert.match(c.mensaje,/pendiente/);
});
test('transcripción prepara pero no confirma',()=>{
 const r=pedir('Agregá a lista materiales: unión','transcripcion');assert.equal(r.estado,'propuesta');assert.equal(confirmar(r.sesion,'transcripcion').estado,'aclarar');
});
test('corrección reemplaza contenido y código sin extender vencimiento',()=>{
 const a=crear(),b=pedir('Mejor: Creá lista materiales: 4 codos','texto',a.sesion,{ahora:new Date(+ahora+60000)});
 assert.notEqual(a.sesion.codigo,b.sesion.codigo);assert.equal(a.sesion.creada,b.sesion.creada);assert.deepEqual(b.sesion.propuesta.items,['4 codos']);
 assert.equal(pedir(`CONFIRMAR LISTA ${a.sesion.codigo}`,'texto',b.sesion).estado,'aclarar');assert.equal(confirmar(b.sesion).estado,'intencion_validada');
});
test('confirmación exige texto exacto y sesión vigente',()=>{
 const s=crear().sesion;
 for(const txt of ['sí','confirmar',`confirmar lista ${s.codigo}`,`CONFIRMAR LISTA ${s.codigo} y agregar otra cosa`])assert.notEqual(pedir(txt,'texto',s).estado,'intencion_validada');
 assert.equal(confirmar(s,'texto',{ahora:new Date(+ahora+900000)}).estado,'aclarar');
 assert.equal(confirmar(s,'texto',{ahora:new Date(+ahora-1)}).estado,'aclarar');
 assert.equal(pedir(`CONFIRMAR LISTA ${s.codigo}`).estado,'aclarar');
});
test('otro acceso, perfil o versión no confirma',()=>{
 const s=crear().sesion;
 for(const cambio of [{version_acceso:2},{acceso_id:'00000000-0000-0000-0000-000000000099'},{perfil_id:'00000000-0000-0000-0000-000000000099'}])assert.equal(confirmar(s,'texto',{operador:{...operador,...cambio}}).estado,'aclarar');
});
test('propuesta alterada no confirma y JSONB con claves reordenadas sí',()=>{
 const s=crear().sesion,b=structuredClone(s);b.propuesta.items.push('extra');assert.equal(confirmar(b).estado,'aclarar');
 s.propuesta=Object.fromEntries(Object.entries(s.propuesta).reverse());assert.equal(confirmar(s).estado,'intencion_validada');
});
test('cancelar descarta sin escribir y consultas no generan intención de escritura',()=>{
 assert.equal(pedir('cancelar','texto',crear().sesion).sesion,null);
 for(const texto of ['mis listas','ver lista materiales'])assert.equal(pedir(texto).estado,'consulta');
 for(const texto of ['quitar item 1 de lista materiales','comprado 1 de lista materiales'])assert.equal(pedir(texto).estado,'aclarar');
});
test('entradas inválidas y largas se rechazan antes del parser',()=>{
 assert.equal(pedir('x'.repeat(12001)).estado,'aclarar');assert.equal(pedir('mis listas','audio').estado,'aclarar');assert.equal(pedir('mis listas','texto',null,{operador:null}).estado,'aclarar');assert.equal(pedir('mis listas','texto',null,{ahora:new Date('invalid')}).estado,'aclarar');
});
