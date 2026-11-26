import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnosticoRespuesta as respuesta,diagnosticoTransporte as transporte} from '../supabase/functions/laso-privado/respuesta-diagnostico.mjs';
test('aceptación de Meta no se declara entrega al teléfono',()=>{
 assert.deepEqual(respuesta(200,{messages:[{id:'wamid.local'}]}),{accepted:true,status:200,code:null,subcode:null,resultado:'aceptado_por_meta'});
});
test('rechazos mantienen únicamente códigos numéricos',()=>{
 const r=respuesta(401,{error:{code:190,error_subcode:463,message:'TOKEN_PRIVADO',error_data:{details:'TELEFONO_PRIVADO'},fbtrace_id:'traza'}});
 assert.deepEqual(r,{accepted:false,status:401,code:190,subcode:463,resultado:'rechazo_http'});
 for(const dato of ['TOKEN_PRIVADO','TELEFONO_PRIVADO','traza'])assert.ok(!JSON.stringify(r).includes(dato));
});
test('respuesta 2xx sin identificador válido nunca cuenta como aceptada',()=>{
 for(const data of [null,{}, {messages:[{id:42}]},{messages:[{id:''}]},{messages:[{id:'id'}],error:{code:1}}])assert.equal(respuesta(200,data).accepted,false);
 assert.equal(respuesta(500,{messages:[{id:'id'}]}).accepted,false);
});
test('metadatos inválidos no filtran valores arbitrarios',()=>{
 for(const status of [null,NaN,Infinity,'200',99,600])assert.equal(respuesta(status,{}).status,null);
 for(const code of ['secreto',-1,1.1,Infinity,Number.MAX_SAFE_INTEGER+1])assert.equal(respuesta(400,{error:{code,error_subcode:code}}).code,null);
});
test('timeout y error de red se distinguen sin copiar datos sensibles',()=>{
 for(const name of ['TimeoutError','AbortError'])assert.equal(transporte({name,message:'TOKEN_PRIVADO'}).resultado,'tiempo_agotado');
 for(const e of [null,undefined,new Error('TOKEN_PRIVADO'),{name:'secreto',message:'TOKEN_PRIVADO'}]){
  const r=transporte(e);assert.equal(r.resultado,'fallo_transporte');assert.ok(!JSON.stringify(r).includes('TOKEN_PRIVADO'));
 }
});
