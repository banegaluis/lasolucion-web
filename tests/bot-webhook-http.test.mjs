import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

// Ejecuta el handler del repositorio con Deno.serve capturado y fetch sustituido.
// No hay servidor, red, secretos reales ni una base de datos en esta prueba.
test('contrato HTTP del webhook con dependencias simuladas', async t => {
 const anteriorDeno=globalThis.Deno, anteriorFetch=globalThis.fetch;
 let handler, llamadas, filas, fallo, autorizado;
 const env={WHATSAPP_BOT_MODO:'interno',WHATSAPP_APP_SECRET:'clave-ficticia',
  WHATSAPP_VERIFY_TOKEN:'token-ficticio',WHATSAPP_PHONE_NUMBER_ID:'numero_prueba',
  SUPABASE_URL:'https://prueba-local.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'no-es-una-clave-real'};
 const respuesta=(datos,status=200)=>new Response(JSON.stringify(datos),{status});
 function reiniciar(){llamadas=[];filas=new Map();fallo=false;autorizado=true;env.WHATSAPP_BOT_MODO='interno';}
 globalThis.Deno={env:{get:n=>env[n]},serve:h=>{handler=h;}};
 globalThis.fetch=async (url,init)=>{
  llamadas.push(url);
  assert.equal(init.method,'POST');
  const datos=JSON.parse(init.body);
  if(url===env.SUPABASE_URL+'/rest/v1/rpc/bot_autorizar'){
   return respuesta(autorizado?[{acceso_id:'a',perfil_id:'p',version:1}]:[]);
  }
  assert.equal(url,env.SUPABASE_URL+'/rest/v1/bot_borradores','Cualquier otra ruta queda bloqueada por el doble');
  if(fallo)return respuesta({code:'XX000',message:'detalle interno privado'},500);
  // Doble atómico de unicidad: NO demuestra la restricción real de PostgreSQL.
  if(filas.has(datos.evento_id))return respuesta({code:'23505'},409);
  filas.set(datos.evento_id,datos);
  return respuesta([datos],201);
 };
 const raw=JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{
  metadata:{phone_number_id:'numero_prueba'},messages:[{id:'wamid.prueba',from:'5493511234567',type:'text',
   text:{body:'Agendame para Cliente Ficticio 20/11/2026 15:00 revisar calefón'}}]
 }}]}]});
 const solicitud=(firmaValida=true)=>new Request('https://webhook.invalid/',{method:'POST',body:raw,
  headers:{'x-hub-signature-256':'sha256='+createHmac('sha256',firmaValida?env.WHATSAPP_APP_SECRET:'otra-clave').update(raw).digest('hex')}});
 try{
  await import('../supabase/functions/whatsapp-interno/index.js');
  await t.test('apagado por defecto no consulta ni guarda',async()=>{
   reiniciar();delete env.WHATSAPP_BOT_MODO;
   assert.equal((await handler(solicitud())).status,503);assert.equal(llamadas.length,0);
  });
  await t.test('firma incorrecta bloquea acceso a almacenamiento',async()=>{
   reiniciar();assert.equal((await handler(solicitud(false))).status,403);assert.equal(llamadas.length,0);
  });
  await t.test('operador sin permiso no produce borrador',async()=>{
   reiniciar();autorizado=false;
   const r=await handler(solicitud());assert.equal(r.status,200);
   assert.deepEqual(await r.json(),{ok:true,recibidos:0,omitidos:1});assert.equal(filas.size,0);
  });
  await t.test('20 solicitudes simultáneas aceptan duplicados sin exponer contenido',async()=>{
   reiniciar();const respuestas=await Promise.all(Array.from({length:20},()=>handler(solicitud())));
   for(const r of respuestas){assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true,recibidos:1,omitidos:0});}
   assert.equal(filas.size,1);assert.equal(llamadas.length,40);
   assert.equal(filas.get('wamid.prueba').estado,'pendiente_revision');
  });
  await t.test('error temporal devuelve 503 y el reintento puede completar',async()=>{
   reiniciar();fallo=true;
   const r=await handler(solicitud());assert.equal(r.status,503);
   assert.deepEqual(await r.json(),{ok:false,error:'Error temporal'});assert.equal(filas.size,0);
   fallo=false;assert.equal((await handler(solicitud())).status,200);assert.equal(filas.size,1);
  });
  await t.test('permiso revocado se revalida incluso para un reintento',async()=>{
   reiniciar();await handler(solicitud());autorizado=false;
   const r=await handler(solicitud());assert.deepEqual(await r.json(),{ok:true,recibidos:0,omitidos:1});
   assert.equal(llamadas.length,3);assert.equal(filas.size,1);
  });
 }finally{
  globalThis.fetch=anteriorFetch;
  if(anteriorDeno===undefined)delete globalThis.Deno;else globalThis.Deno=anteriorDeno;
 }
});
