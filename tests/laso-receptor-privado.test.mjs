import test from 'node:test';
import assert from 'node:assert/strict';
import {procesarMensajes} from '../supabase/functions/laso-privado/core.mjs';
const personal='+5493512143961';
const evento=(numero,id='wamid.prueba')=>({numero,evento_id:id,tipo:'texto',texto:'CONFIRMAR ALTA abcdef12'});
const identidad={acceso_id:'a',perfil_id:'p',version:1};
test('número ajeno no llega al autorizador ni al guardado aunque tuviera permiso',async()=>{
 let consultas=0,guardados=0;
 const r=await procesarMensajes([evento('+5493517654321')],{autorizar:async()=>{consultas++;return identidad;},insertar:async()=>{guardados++;}});
 assert.deepEqual(r,{registrados:0,omitidos:1});assert.equal(consultas,0);assert.equal(guardados,0);
});
test('número personal conserva autorización obligatoria',async()=>{
 let guardados=0;
 const r=await procesarMensajes([evento(personal)],{autorizar:async()=>null,insertar:async()=>{guardados++;}});
 assert.deepEqual(r,{registrados:0,omitidos:1});assert.equal(guardados,0);
});
test('lote mixto conserva solo el operador y deduplica su evento',async()=>{
 const guardados=[];let consultas=0;
 const r=await procesarMensajes([evento('+5493517654321','wamid.otro'),evento(personal),evento(personal)],{autorizar:async()=>{consultas++;return identidad;},insertar:async e=>guardados.push(e.numero)});
 assert.deepEqual(r,{registrados:1,omitidos:2});assert.deepEqual(guardados,[personal]);assert.equal(consultas,1);
});
test('texto que declara el número personal no autoriza un remitente ajeno',async()=>{
 const r=await procesarMensajes([{...evento('+5493517654321'),texto:'Soy Luis '+personal}],{autorizar:async()=>identidad,insertar:async()=>assert.fail('No debe guardar')});
 assert.equal(r.omitidos,1);
});
