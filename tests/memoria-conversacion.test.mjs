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

test('lista válida extensa se detiene sin ocultar ítems ni dejar confirmación anterior',()=>{
 const s=crear().sesion;
 const texto='Creá lista materiales: '+Array.from({length:40},(_,i)=>`${i} `+'x'.repeat(230)).join('; ');
 const r=pedir(texto,'texto',s);assert.equal(r.estado,'aclarar');assert.equal(r.sesion,null);assert.match(r.mensaje,/grupos más chicos/);assert.equal(r.intencion,undefined);
});
test('propuestas dentro del presupuesto muestran todos los ítems incluidos emojis',()=>{
 const items=Array.from({length:10},(_,i)=>`${i} `+'🔧'.repeat(100));
 const r=pedir('Agregá a lista materiales: '+items.join('; '),'transcripcion');
 assert.equal(r.estado,'propuesta');assert.ok(r.mensaje.length<=3500);assert.deepEqual(r.sesion.propuesta.items,items);
 for(const item of items)assert.ok(r.mensaje.includes(item));assert.equal(confirmar(r.sesion).estado,'intencion_validada');
});
test('límite de propuesta incluye encabezado, numeración y código de confirmación',()=>{
 let ultimo=null,primeroRechazado=null;
 for(let n=10;n<=20;n++){
  const r=pedir('Creá lista '+ 'n'.repeat(120)+': '+Array(n).fill('x'.repeat(240)).join('; '));
  if(r.estado==='propuesta'){assert.ok(r.mensaje.length<=3500);ultimo=r;}else{primeroRechazado=r;break;}
 }
 assert.ok(ultimo);assert.equal(primeroRechazado.estado,'aclarar');assert.equal(primeroRechazado.sesion,null);
});

test('sesión JSON incompleta o con texto de otro tipo se rechaza sin excepciones',()=>{
 for(const texto of [null,42,[],{}, {toString:0},'x'.repeat(12001)]){
  const s=crear().sesion;s.texto=texto;const r=confirmar(s);assert.equal(r.estado,'aclarar');assert.equal(r.sesion,null);assert.equal(r.intencion,undefined);
 }
 for(const propuesta of [null,[],false,'lista']){
  const s=crear().sesion;s.propuesta=propuesta;assert.equal(confirmar(s).estado,'aclarar');
 }
});
test('sesión antigua con lista extensa no evita el presupuesto al confirmar',async()=>{
 const {interpretarLista}=await import('../supabase/functions/whatsapp-interno/memoria-listas-parser.mjs');
 const s=crear().sesion;s.texto='Creá lista materiales: '+Array(40).fill('x'.repeat(240)).join('; ');s.propuesta=interpretarLista(s.texto);
 const r=confirmar(s);assert.equal(r.estado,'aclarar');assert.equal(r.intencion,undefined);assert.equal(r.sesion,null);
});

test('corrección breve reemplaza ítems de creación conservando nombre y vencimiento',()=>{
 const a=crear(),b=pedir('Mejor: 4 codos; 1 caño','texto',a.sesion,{ahora:new Date(+ahora+60000)});
 assert.equal(b.estado,'propuesta');assert.equal(b.sesion.propuesta.nombre,'materiales');assert.deepEqual(b.sesion.propuesta.items,['4 codos','1 caño']);assert.equal(b.sesion.creada,a.sesion.creada);assert.notEqual(b.sesion.codigo,a.sesion.codigo);
 assert.equal(pedir(`CONFIRMAR LISTA ${a.sesion.codigo}`,'texto',b.sesion).estado,'aclarar');assert.equal(confirmar(b.sesion).estado,'intencion_validada');
});
test('corrección transcrita de agregado conserva acción y exige confirmación escrita',()=>{
 const a=pedir('Agregá a lista compras: caño'),b=pedir('Mejor: 2 uniones','transcripcion',a.sesion);
 assert.equal(b.estado,'propuesta');assert.equal(b.sesion.propuesta.accion,'agregar');assert.equal(b.sesion.propuesta.nombre,'compras');assert.deepEqual(b.sesion.propuesta.items,['2 uniones']);assert.equal(confirmar(b.sesion,'transcripcion').estado,'aclarar');
});
test('corrección breve sin contexto válido no inventa lista',()=>{
 const s=crear().sesion;
 for(const sesion of [null,{...s,creada:+ahora-900000},{...s,operador:{...operador,version_acceso:2}},{...s,texto:null},{...s,codigo:'incorrecto'}]){
  const r=pedir('Mejor: 4 codos','texto',sesion);assert.equal(r.estado,'aclarar');assert.equal(r.sesion,null);
 }
 assert.equal(pedir('Mejor:','texto',s).estado,'aclarar');
});

test('corregir ítems conserva nombres que no admiten normalización repetida',()=>{
 for(const texto of ['Creá lista de de compras: caño','Creá lista materiales para para cocina: caño','Laso: Creá lista de de compras: caño','Creá lista de de compras']){
  const a=pedir(texto);assert.equal(a.estado,'propuesta');
  const b=pedir('Mejor: 4 codos','texto',a.sesion);
  assert.equal(b.estado,'propuesta');assert.equal(b.sesion.propuesta.nombre,a.sesion.propuesta.nombre);assert.equal(b.sesion.propuesta.clave,a.sesion.propuesta.clave);
  assert.deepEqual(b.sesion.propuesta.items,['4 codos']);assert.equal(confirmar(b.sesion).estado,'intencion_validada');
  const c=pedir('Mejor: 2 caños','texto',b.sesion);
  assert.equal(c.sesion.propuesta.nombre,a.sesion.propuesta.nombre);assert.equal(confirmar(c.sesion).estado,'intencion_validada');
 }
});
test('corrección breve de agregado preserva nombre y acción con prefijo Laso',()=>{
 const a=pedir('Laso: Agregá a lista materiales para para cocina: caño');
 const b=pedir('Mejor: 2 codos','transcripcion',a.sesion);
 assert.equal(b.estado,'propuesta');assert.equal(b.sesion.propuesta.accion,'agregar');assert.equal(b.sesion.propuesta.nombre,a.sesion.propuesta.nombre);assert.equal(b.sesion.propuesta.clave,a.sesion.propuesta.clave);
 assert.deepEqual(b.sesion.propuesta.items,['2 codos']);assert.equal(confirmar(b.sesion).estado,'intencion_validada');
});
