import test from 'node:test';
import assert from 'node:assert/strict';
import {extraerAlta} from '../supabase/functions/laso-privado/clientes-alta.mjs';
const now=new Date('2026-11-25T13:00:00Z');
const base={nombre:'Prueba',apellido:'Local',calle:'Calle',numero:'1',ciudad:'Córdoba',provincia:'Córdoba',telefono:'3511234567',trabajo:'Revisar equipo',fecha:'2026-11-26',inicio:'10:00',fin:'12:00',duracion:2,listo:true};
test('duración inválida elimina fin anterior y bloquea confirmación',()=>{
 for(const valor of ['0 horas','-2 horas','mucho','24 horas']){
  const r=extraerAlta('duración: '+valor,base,now);
  assert.equal(r.datos.listo,false);assert.ok(!r.datos.fin);assert.ok(!r.datos.duracion);
 }
});
test('fin explícito reemplaza duración anterior sin ser sobrescrito',()=>{
 const r=extraerAlta('fin: 13:00',base,now);
 assert.equal(r.datos.fin,'13:00');assert.ok(!r.datos.duracion);assert.equal(r.datos.listo,true);
});
test('inicio inválido descarta fin derivado y conserva base original',()=>{
 const copia=structuredClone(base);const r=extraerAlta('inicio: imposible',base,now);
 assert.equal(r.datos.listo,false);assert.ok(!r.datos.fin);assert.deepEqual(base,copia);
});
test('duración válida recalcula fin al corregir inicio',()=>{
 const r=extraerAlta('inicio: 11:00',base,now);
 assert.equal(r.datos.fin,'13:00');assert.equal(r.datos.listo,true);
});
test('fin y duración en un mensaje requieren aclaración sin elegir uno',()=>{
 for(const s of ['fin: 13:00; duración: 2 horas','duración: 2 horas; fin: 13:00']){
  const r=extraerAlta(s,base,now);assert.equal(r.datos.listo,false);assert.ok(!r.datos.fin);
 }
});

test('corrección inválida integrada no ofrece código ni llama RPC de alta',async()=>{
 const {gestionarCliente}=await import('../supabase/functions/laso-privado/clientes-alta.mjs');
 const previo=globalThis.fetch;const llamadas=[];
 globalThis.fetch=async()=>new Response(JSON.stringify([{datos:base,creado:new Date().toISOString(),codigo:'abcdef12',orden_id:null}]));
 try{
  const body=await gestionarCliente({supabaseUrl:'https://local.invalid',role:'ficticio'},
   {acceso_id:'a',version_acceso:1,perfil_id:'p',evento_id:'local-prueba'},
   {tipo:'completar'},'duración: imposible',async(c,ruta,payload)=>{llamadas.push(ruta);assert.equal(payload.datos.listo,false);});
  assert.deepEqual(llamadas,['laso_altas_pendientes']);
  assert.ok(body.includes('Falta:'));assert.ok(!body.includes('CONFIRMAR ALTA'));
 }finally{globalThis.fetch=previo;}
});
