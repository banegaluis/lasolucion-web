import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';

test('receptor completo con red sustituida y secretos exclusivamente locales',async t=>{
 const originales={fetch:globalThis.fetch,Deno:globalThis.Deno,info:console.info,warn:console.warn};
 const env={WHATSAPP_BOT_MODO:'interno',WHATSAPP_APP_SECRET:'clave-local-sin-valor',WHATSAPP_VERIFY_TOKEN:'verificacion-local',WHATSAPP_PHONE_NUMBER_ID:'1431267843408523',SUPABASE_URL:'https://prueba-local.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'rol-local-sin-valor',WHATSAPP_ACCESS_TOKEN:'token-local-sin-valor'};
 let handler, llamadas, logs, eventos, autorizaciones, escenario;
 const identidad={acceso_id:'acceso-local',perfil_id:'perfil-local',version:1};
 const reset=(config={})=>{llamadas=[];logs=[];eventos=new Set();autorizaciones=0;escenario=config;};
 const respuesta=(data,status=200)=>new Response(JSON.stringify(data),{status});
 globalThis.Deno={env:{get:k=>env[k]},serve:fn=>{handler=fn;}};
 console.info=console.warn=(...args)=>logs.push(args.join(' '));
 // Lista cerrada de rutas: no existe fallback a fetch real.
 globalThis.fetch=async(url,op={})=>{
  const u=new URL(url);llamadas.push({url:u.href,metodo:op.method,redirect:op.redirect,payload:op.body?JSON.parse(op.body):null});
  if(u.origin==='https://prueba-local.supabase.co'&&u.pathname==='/rest/v1/rpc/bot_autorizar'){
   if(escenario.redireccionAutorizacion)throw new TypeError('Redirección rechazada localmente');
   autorizaciones++;return respuesta(escenario.sinPermiso||autorizaciones===escenario.revocarEn?[]:[identidad]);
  }
  if(u.origin==='https://prueba-local.supabase.co'&&u.pathname==='/rest/v1/bot_borradores'){
   if(escenario.falloDB)return respuesta({code:'error-local'},503);
   const b=JSON.parse(op.body);if(eventos.has(b.evento_id))return respuesta([]);
   eventos.add(b.evento_id);return respuesta([{evento_id:b.evento_id}]);
  }
  if(u.origin==='https://graph.facebook.com'&&u.pathname==='/v27.0/1431267843408523/messages'){
   if(escenario.timeout)throw new DOMException('dato-local-no-publicar','TimeoutError');
   return escenario.rechazo?respuesta({error:{code:190,error_subcode:463,message:'dato-local-no-publicar'}},401):respuesta({messages:[{id:'wamid.local.respuesta'}]});
  }
  throw new Error('Ruta no habilitada en la prueba aislada');
 };
 const enviar=async({from='5493512143961',phone='1431267843408523',firma=true}={})=>{
  const body=JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:phone},messages:[{from,id:'wamid.local.entrada',timestamp:String(Math.floor(Date.now()/1000)),type:'text',text:{body:'Hola'}}]}}]}]});
  const hash=createHmac('sha256',env.WHATSAPP_APP_SECRET).update(body).digest('hex');
  return handler(new Request('https://webhook.local/',{method:'POST',body,headers:{'x-hub-signature-256':'sha256='+(firma?hash:'0'.repeat(64))}}));
 };
 const envios=()=>llamadas.filter(x=>x.url.startsWith('https://graph.facebook.com/'));
 try{
  await import('../supabase/functions/laso-privado/index.js');
  await t.test('saludo firmado recorre autorización y borrador y responde solo al destino fijo',async()=>{
   reset();const r=await enviar();assert.equal(r.status,200);assert.equal(autorizaciones,3);assert.equal(eventos.size,1);assert.equal(envios().length,1);
   assert.equal(envios()[0].payload.to,'543512143961');assert.match(envios()[0].payload.text.body,/Hola/);assert.ok(logs.some(x=>x.includes('aceptado_por_meta')));
  });
  await t.test('firma inválida, remitente ajeno y otro phone_id nunca llegan a la red',async()=>{
   for(const config of [{firma:false},{from:'5493510000000'},{phone:'99999999'}]){
    reset();const r=await enviar(config);assert.equal(r.status,config.firma===false?403:200);assert.equal(llamadas.length,0);
   }
  });
  await t.test('sin permiso no guarda y revocación antes de responder no envía',async()=>{
   reset({sinPermiso:true});await enviar();assert.equal(eventos.size,0);assert.equal(envios().length,0);
   for(const revocarEn of [2,3]){reset({revocarEn});await enviar();assert.equal(eventos.size,1);assert.equal(envios().length,0);}
  });
  await t.test('duplicado de webhook no genera segunda respuesta',async()=>{
   reset();await enviar();await enviar();assert.equal(eventos.size,1);assert.equal(envios().length,1);
  });
  await t.test('rechazo Meta queda diagnosticado sin filtrar contenido',async()=>{
   reset({rechazo:true});assert.equal((await enviar()).status,200);assert.ok(logs.some(x=>x.includes('rechazo_http')&&x.includes('463')));
   assert.ok(!logs.join('\n').includes('dato-local-no-publicar'));assert.ok(!logs.join('\n').includes(env.WHATSAPP_ACCESS_TOKEN));
   // Limitación actual: no hay reenvío automático después de guardar evento.
   await enviar();assert.equal(envios().length,1);
  });
  await t.test('timeout queda diagnosticado sin reintentos ni falsa aceptación',async()=>{
   reset({timeout:true});await enviar();assert.equal(envios().length,1);assert.ok(logs.some(x=>x.includes('tiempo_agotado')));assert.ok(!logs.some(x=>x.includes('aceptado_por_meta')));
  });
  await t.test('fallo de guardado devuelve 503 y no intenta responder',async()=>{
   reset({falloDB:true});assert.equal((await enviar()).status,503);assert.equal(envios().length,0);assert.equal(eventos.size,0);
  });
  await t.test('todas las llamadas del saludo prohíben redirecciones, incluidas RPC y guardado',async()=>{
   reset();await enviar();assert.equal(llamadas.length,5);
   for(const llamada of llamadas)assert.equal(llamada.redirect,'error',llamada.url);
  });
  await t.test('redirección rechazada durante autorización corta antes de guardar o enviar',async()=>{
   reset({redireccionAutorizacion:true});const r=await enviar();assert.equal(r.status,503);
   assert.equal(llamadas.length,1);assert.equal(llamadas[0].redirect,'error');assert.equal(eventos.size,0);assert.equal(envios().length,0);
  });
  await t.test('apagado por defecto impide consultas y respuestas',async()=>{
   reset();delete env.WHATSAPP_BOT_MODO;assert.equal((await enviar()).status,503);assert.equal(llamadas.length,0);
  });
 }finally{globalThis.fetch=originales.fetch;console.info=originales.info;console.warn=originales.warn;if(originales.Deno===undefined)delete globalThis.Deno;else globalThis.Deno=originales.Deno;}
});
