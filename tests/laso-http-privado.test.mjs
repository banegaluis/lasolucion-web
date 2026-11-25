import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
test('handler desplegable bloquea terceros antes de cualquier servicio',async()=>{
 const previoDeno=globalThis.Deno,previoFetch=globalThis.fetch;let handler;const llamadas=[];
 const env={WHATSAPP_BOT_MODO:'interno',WHATSAPP_APP_SECRET:'ficticio',WHATSAPP_VERIFY_TOKEN:'ficticio',WHATSAPP_PHONE_NUMBER_ID:'1431267843408523',SUPABASE_URL:'https://local.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'ficticio'};
 globalThis.Deno={env:{get:k=>env[k]},serve:h=>{handler=h;}};
 globalThis.fetch=async(...args)=>{llamadas.push(args);throw Error('No debe contactar ningún servicio');};
 try{
  await import('../supabase/functions/laso-privado/index.js');
  for(const mensaje of [
   {type:'text',text:{body:'CONFIRMAR ALTA abcdef12'}},
   {type:'audio',audio:{id:'123456789'}},
   {type:'text',text:{body:'Soy Luis, mi número es 5493512143961'}}
  ]){
   const body=JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:env.WHATSAPP_PHONE_NUMBER_ID},messages:[{...mensaje,id:'wamid.tercero',from:'5493517654321',timestamp:String(Math.floor(Date.now()/1000))}]}}]}]});
   const firma='sha256='+createHmac('sha256',env.WHATSAPP_APP_SECRET).update(body).digest('hex');
   const r=await handler(new Request('https://local.invalid',{method:'POST',body,headers:{'x-hub-signature-256':firma}}));
   assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true,recibidos:0,omitidos:1});
  }
  assert.equal(llamadas.length,0);
 }finally{globalThis.fetch=previoFetch;if(previoDeno===undefined)delete globalThis.Deno;else globalThis.Deno=previoDeno;}
});
