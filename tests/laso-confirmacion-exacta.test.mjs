import test from 'node:test';
import assert from 'node:assert/strict';
import {gestionarCliente} from '../supabase/functions/laso-privado/clientes-alta.mjs';
import {gestionarTurno} from '../supabase/functions/laso-privado/turnos-confirmacion.mjs';
for(const alta of [true,false]){
 const etiqueta=alta?'alta':'turno',comando=alta?'CONFIRMAR ALTA abcdef12':'CONFIRMAR abcdef12';
 async function ejecutar(texto,tipo='texto'){
  const llamadas=[];const rest=async(c,ruta,datos)=>{llamadas.push({ruta,datos});return {estado:'registrado',numero:42};};
  const m={tipo,texto,numero:'+5493512143961',version_acceso:1,evento_id:'wamid.local'};
  const p={tipo:'confirmar',codigo:'abcdef12'};
  const respuesta=alta?await gestionarCliente({},m,p,texto,rest):await gestionarTurno({},m,p,rest);
  return {llamadas,respuesta};
 }
 test(etiqueta+': confirmación alterada pide texto exacto sin llamar RPC',async()=>{
  for(const texto of [comando+'.',comando+'!',comando.replace(' ','  '),comando.replace('abcdef12','12345678'),'sí',undefined]){
   const r=await ejecutar(texto);assert.equal(r.llamadas.length,0);assert.ok(r.respuesta.includes(comando));
  }
 });
 test(etiqueta+': confirmación exacta conserva RPC y resultado',async()=>{
  for(const texto of [comando,comando.toLowerCase(),' '+comando+' ']){
   const r=await ejecutar(texto);assert.equal(r.llamadas.length,1);
   assert.equal(r.llamadas[0].ruta,alta?'rpc/laso_confirmar_alta':'rpc/laso_confirmar_turno');
   assert.equal(r.llamadas[0].datos.p_codigo,'abcdef12');assert.ok(r.respuesta.includes('42'));
  }
 });
 test(etiqueta+': audio con texto exacto no confirma',async()=>{
  const r=await ejecutar(comando,'audio');assert.equal(r.llamadas.length,0);assert.ok(r.respuesta.includes(comando));
 });
}
