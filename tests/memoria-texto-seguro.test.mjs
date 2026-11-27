import test from 'node:test';
import assert from 'node:assert/strict';
import {interpretarLista} from '../supabase/functions/whatsapp-interno/memoria-listas-parser.mjs';
import {conversarMemoria} from '../supabase/functions/laso-privado/memoria-conversacion.mjs';
const operador={acceso_id:'00000000-0000-0000-0000-000000000001',perfil_id:'00000000-0000-0000-0000-000000000002',version_acceso:1};
const ahora=new Date('2026-11-27T06:00:00Z');
const controles=['\u061c','\u200e','\u200f','\u202a','\u202b','\u202c','\u202d','\u202e','\u2066','\u2067','\u2068','\u2069'];
const pedir=(texto,sesion=null,tipo='texto')=>conversarMemoria({mensaje:{texto,tipo},sesion,operador,ahora});
test('rechaza controles de dirección en nombres, ítems y consultas sin normalizarlos',()=>{
 for(const c of controles)for(const texto of [`Creá lista com${c}pras: caño`,`Agregá a lista compras: 12${c}34`,`Ver lista com${c}pras`])assert.deepEqual(interpretarLista(texto),{accion:'invalido'});
});
test('texto, transcripción y corrección con controles no generan propuesta confirmable',()=>{
 for(const c of controles)for(const tipo of ['texto','transcripcion']){
  const s=pedir('Creá lista compras: caño').sesion;
  for(const texto of [`Creá lista compras: 12${c}34`,`Mejor: 12${c}34`]){
   const r=pedir(texto,s,tipo);assert.equal(r.estado,'aclarar');assert.equal(r.sesion,null);assert.equal(r.intencion,undefined);
  }
 }
});
test('sesión antigua con control de dirección no se puede confirmar',()=>{
 for(const c of controles){
  const s=pedir('Creá lista compras: caño').sesion;
  s.texto=`Creá lista compras: 12${c}34`;s.propuesta.items=[`12${c}34`];
  const r=pedir(`CONFIRMAR LISTA ${s.codigo}`,s);assert.equal(r.estado,'aclarar');assert.equal(r.intencion,undefined);
 }
});
test('conserva acentos, decimales y emoji compuesto sin borrar contenido',()=>{
 const items=['caño 1,5 m','👩‍🔧 reparación','válvula'];
 const r=pedir('Creá lista materiales: '+items.join('; '));
 assert.equal(r.estado,'propuesta');assert.deepEqual(r.sesion.propuesta.items,items);
 assert.equal(pedir(`CONFIRMAR LISTA ${r.sesion.codigo}`,r.sesion).estado,'intencion_validada');
});
