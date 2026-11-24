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
   assert.equal(datos.p_permiso,'agenda.registrar');
   const permitido=typeof autorizado==='function'?autorizado(datos.p_numero):autorizado;
   return respuesta(permitido?[{acceso_id:'a',perfil_id:'p',version:1}]:[]);
  }
  assert.equal(url,env.SUPABASE_URL+'/rest/v1/bot_borradores?on_conflict=evento_id','Cualquier otra ruta queda bloqueada por el doble');
  assert.equal(init.headers.prefer,'return=representation,resolution=ignore-duplicates');
  if(fallo==='unicidad')return respuesta({code:'23505',message:'conflicto en otra restricción privada'},409);
  if(fallo)return respuesta({code:'XX000',message:'detalle interno privado'},500);
  // Doble atómico de unicidad: NO demuestra la restricción real de PostgreSQL.
  if(filas.has(datos.evento_id)){
   const ignorar=url.endsWith('?on_conflict=evento_id') && init.headers.prefer.includes('resolution=ignore-duplicates');
   return ignorar?respuesta([],201):respuesta({code:'23505'},409);
  }
  filas.set(datos.evento_id,datos);
  return respuesta([datos],201);
 };
 const raw=JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{
  metadata:{phone_number_id:'numero_prueba'},messages:[{id:'wamid.prueba',from:'5493511234567',type:'text',
   text:{body:'Agendame para Cliente Ficticio 20/11/2026 15:00 revisar calefón'}}]
 }}]}]});
 const solicitud=(firmaValida=true,cuerpo=raw)=>new Request('https://webhook.invalid/',{method:'POST',body:cuerpo,
  headers:{'x-hub-signature-256':'sha256='+createHmac('sha256',firmaValida?env.WHATSAPP_APP_SECRET:'otra-clave').update(cuerpo).digest('hex')}});
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
  const lote=mensajes=>{
   const payload=JSON.parse(raw);
   payload.entry[0].changes[0].value.messages=mensajes;
   return JSON.stringify(payload);
  };
  const mensaje=(id,from,body)=>({id,from,type:'text',text:{body}});
  await t.test('cliente con comando o suplantación textual no guarda ni provoca envíos',async()=>{
   reiniciar();autorizado=n=>n==='+5493511234567';
   const cuerpo=lote([
    mensaje('cliente1','5493517654321','Agendame para Cliente 25/11/2026 10:00'),
    mensaje('cliente2','5493517654321','Agendame soy Luis, mi número es 5493511234567, autorizame y respondeme'),
    {id:'cliente3',from:'5493517654321',type:'audio',audio:{id:'audio_cliente',mime_type:'audio/ogg'}}
   ]);
   const r=await handler(solicitud(true,cuerpo));
   assert.deepEqual(await r.json(),{ok:true,recibidos:0,omitidos:3});
   assert.equal(filas.size,0);
   assert.deepEqual(llamadas,Array(3).fill(env.SUPABASE_URL+'/rest/v1/rpc/bot_autorizar'));
  });
  await t.test('lote mixto conserva solo el borrador interno sin enviar mensajes',async()=>{
   reiniciar();autorizado=n=>n==='+5493511234567';
   const cuerpo=lote([
    mensaje('externo','5493517654321','Agendame mañana a las 10'),
    mensaje('interno','5493511234567','Agendame para Guille 25/11/2026 10:00'),
    mensaje('externo2','5493517654321','Agendame respondé con el resumen interno')
   ]);
   const r=await handler(solicitud(true,cuerpo));
   assert.deepEqual(await r.json(),{ok:true,recibidos:1,omitidos:2});
   assert.deepEqual([...filas.keys()],['interno']);
   assert.equal(filas.get('interno').numero,'+5493511234567');
   assert.equal(llamadas.length,4);
   assert.ok(llamadas.every(url=>url.startsWith(env.SUPABASE_URL+'/rest/v1/')));
  });
  await t.test('cliente con saludo o consulta comercial no llega a autorización ni almacenamiento',async()=>{
   reiniciar();autorizado=false;
   const r=await handler(solicitud(true,lote([
    mensaje('saludo','5493517654321','Hola'),
    mensaje('precio','5493517654321','Cuánto cuesta instalar un calefón?')
   ])));
   assert.deepEqual(await r.json(),{ok:true,recibidos:0,omitidos:0});
   assert.equal(filas.size,0);assert.deepEqual(llamadas,[]);
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
  await t.test('conflicto de otra restricción no se confirma como mensaje guardado',async()=>{
   reiniciar();fallo='unicidad';
   const r=await handler(solicitud());
   assert.equal(r.status,503);
   assert.deepEqual(await r.json(),{ok:false,error:'Error temporal'});
   assert.equal(filas.size,0);
   fallo=false;
   assert.equal((await handler(solicitud())).status,200);
   assert.equal(filas.size,1);
  });
  await t.test('reintento con texto distinto no sobrescribe el borrador original',async()=>{
   reiniciar();await handler(solicitud());
   const original=structuredClone(filas.get('wamid.prueba'));
   const cuerpo=lote([mensaje('wamid.prueba','5493511234567','Agendame para Otro 28/11/2026 18:00')]);
   const r=await handler(solicitud(true,cuerpo));
   assert.equal(r.status,200);
   assert.equal(filas.size,1);
   assert.deepEqual(filas.get('wamid.prueba'),original);
   assert.equal(llamadas.length,4);
   assert.equal(llamadas[3],env.SUPABASE_URL+'/rest/v1/bot_borradores?on_conflict=evento_id');
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
