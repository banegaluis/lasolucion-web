import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {remitenteE164,esComandoAgenda,extraerMensajes,firmaCorrecta,procesarMensajes} from '../supabase/functions/whatsapp-interno/core.mjs';
const payload=()=>({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{
 metadata:{phone_number_id:'ID_INTERNO'},
 messages:[{id:'wamid.123456789',from:'5493511234567',type:'text',text:{body:'Agendar mañana 10:00 tarea gas para Luis'}}]
}}]}]});
test('remitente de Meta estricto y sin confundir número dictado',()=>{
 assert.equal(remitenteE164('5493511234567'),'+5493511234567');
 assert.equal(remitenteE164('+5493511234567'),null);
 assert.equal(remitenteE164('3511234567 no soy yo'),null);
});
test('solo audios y comandos de agenda destinados a nuestro phone_number_id',()=>{
 assert.equal(extraerMensajes(payload(),'ID_INTERNO').length,1);
 assert.equal(extraerMensajes(payload(),'OTRO_ID').length,0);
 const p=payload();
 p.entry[0].changes[0].value.messages.push(
  {id:'wamid.987654321',from:'5493511234567',type:'audio',audio:{id:'MEDIA_12345'}},
  {id:'wamid.222222222',from:'5493511234567',type:'text',text:{body:'Hola, cliente!'}},
  {id:'wamid.333333333',from:'5493511234567',type:'image',image:{id:'MEDIA'}});
 assert.deepEqual(extraerMensajes(p,'ID_INTERNO').map(x=>x.tipo),['texto','audio']);
 assert.equal(esComandoAgenda('Agendá un trabajo'),true);
});
test('validar la firma HMAC del cuerpo original y rechazar alteración',async()=>{
 const secret='una-clave-de-prueba-que-no-es-real';
 const raw=JSON.stringify(payload());
 const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw));
 const h='sha256='+Buffer.from(digest).toString('hex');
 assert.equal(await firmaCorrecta(raw,h,secret,webcrypto),true);
 assert.equal(await firmaCorrecta(raw+' ',h,secret,webcrypto),false);
 assert.equal(await firmaCorrecta(raw,'sha256=123',secret,webcrypto),false);
 assert.equal(await firmaCorrecta(raw,null,secret,webcrypto),false);
});
test('operador no autorizado jamás se guarda',async()=>{
 const events=extraerMensajes(payload(),'ID_INTERNO');
 let count=0;
 const estado=await procesarMensajes(events,{
  autorizar:async()=>null,
  insertar:async()=>{count++;}
 });
 assert.deepEqual(estado,{registrados:0,omitidos:1});
 assert.equal(count,0);
});
test('operador autorizado se guarda como borrador, no orden ni envío',async()=>{
 let entrada;
 const estado=await procesarMensajes(extraerMensajes(payload(),'ID_INTERNO'),{
  autorizar:async(n,p)=>{assert.equal(n,'+5493511234567');assert.equal(p,'agenda.registrar');return {acceso_id:'x',perfil_id:'y',version:3};},
  insertar:async x=>{entrada=x;}
 });
 assert.equal(estado.registrados,1);
 assert.equal(entrada.estado,'pendiente_revision');
 assert.equal(entrada.version_acceso,3);
 assert.equal(entrada.tipo,'texto');
 assert.ok(!('cliente_id' in entrada));
});

test('50 repeticiones del mismo evento generan una sola inserción por lote', async () => {
 const [evento]=extraerMensajes(payload(),'ID_INTERNO');
 let consultas=0,inserciones=0;
 const r=await procesarMensajes(Array.from({length:50},()=>({...evento})),{
  autorizar:async()=>{consultas++;return {acceso_id:'x',perfil_id:'y',version:1};},
  insertar:async()=>{inserciones++;}
 });
 assert.deepEqual(r,{registrados:1,omitidos:49});
 assert.equal(consultas,1);
 assert.equal(inserciones,1);
});
test('dos eventos distintos con el mismo texto se conservan', async () => {
 const [evento]=extraerMensajes(payload(),'ID_INTERNO');
 const guardados=[];
 const r=await procesarMensajes([evento,{...evento,evento_id:'wamid.distinto'}],{
  autorizar:async()=>({acceso_id:'x',perfil_id:'y',version:1}),
  insertar:async e=>{guardados.push(e.evento_id);}
 });
 assert.equal(r.registrados,2);
 assert.deepEqual(guardados,[evento.evento_id,'wamid.distinto']);
});
test('un evento no autorizado no ocupa el identificador en el lote', async () => {
 const [evento]=extraerMensajes(payload(),'ID_INTERNO');
 let consultas=0,inserciones=0;
 const r=await procesarMensajes([evento,evento],{
  autorizar:async()=>++consultas===1?null:{acceso_id:'x',perfil_id:'y',version:1},
  insertar:async()=>{inserciones++;}
 });
 assert.deepEqual(r,{registrados:1,omitidos:1});
 assert.equal(inserciones,1);
});
test('fallo de inserción se propaga y otro intento puede guardar', async () => {
 const [evento]=extraerMensajes(payload(),'ID_INTERNO');
 let falla=true,inserciones=0;
 const deps={autorizar:async()=>({acceso_id:'x',perfil_id:'y',version:1}),
  insertar:async()=>{if(falla)throw Error('temporal');inserciones++;}};
 await assert.rejects(procesarMensajes([evento,evento],deps),/temporal/);
 falla=false;
 assert.deepEqual(await procesarMensajes([evento,evento],deps),{registrados:1,omitidos:1});
 assert.equal(inserciones,1);
});
test('lotes distintos vuelven a validar e insertar: requieren unicidad persistente', async () => {
 const [evento]=extraerMensajes(payload(),'ID_INTERNO');
 let consultas=0,intentos=0;
 const filas=new Set(); // Doble de la restricción persistente, no prueba de Supabase.
 const deps={autorizar:async()=>{consultas++;return {acceso_id:'x',perfil_id:'y',version:1};},
  insertar:async e=>{intentos++;filas.add(e.evento_id);}};
 await procesarMensajes([evento],deps);
 await procesarMensajes([evento],deps);
 assert.equal(consultas,2);
 assert.equal(intentos,2);
 assert.equal(filas.size,1);
});
