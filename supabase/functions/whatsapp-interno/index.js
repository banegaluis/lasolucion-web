// Webhook en modo APAGADO por defecto. Sin mensajes salientes.
import {extraerMensajes,firmaCorrecta,procesarMensajes} from './core.mjs';
const texto=(s,status=200)=>new Response(s,{status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
const json=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const conf=()=>{
 const url=Deno.env.get('SUPABASE_URL')||'';
 return {
  modo:Deno.env.get('WHATSAPP_BOT_MODO')||'apagado',
  secreto:Deno.env.get('WHATSAPP_APP_SECRET')||'',
  verificacion:Deno.env.get('WHATSAPP_VERIFY_TOKEN')||'',
  phoneId:Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')||'',
  supabaseUrl:url,
  role:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
 };
};
async function leerLimitado(req,limite=131072){
 const lector=req.body?.getReader();if(!lector)return '';
 const pedazos=[];let total=0;
 while(true){
  const {done,value}=await lector.read();if(done)break;
  total+=value.length;
  if(total>limite){await lector.cancel();throw Error('BODY_DEMASIADO_GRANDE');}
  pedazos.push(value);
 }
 const combinado=new Uint8Array(total);let offset=0;
 for(const p of pedazos){combinado.set(p,offset);offset+=p.length;}
 return new TextDecoder('utf-8',{fatal:true}).decode(combinado);
}
async function rest(c,ruta,payload){
 const respuesta=await fetch(c.supabaseUrl+'/rest/v1/'+ruta,{
  method:'POST',
  headers:{'apikey':c.role,'authorization':'Bearer '+c.role,'content-type':'application/json',
    'prefer':'return=representation'},
  body:JSON.stringify(payload),
  signal:AbortSignal.timeout(8000)
 });
 const textoRespuesta=await respuesta.text();
 let data=null;
 try{data=textoRespuesta?JSON.parse(textoRespuesta):null;}catch{}
 if(!respuesta.ok){
  const error=new Error('Supabase respondió '+respuesta.status);
  error.code=data?.code||'SUPABASE_HTTP_ERROR';throw error;
 }
 return data;
}
async function autorizar(c,numero,permiso){
 const r=await rest(c,'rpc/bot_autorizar',{p_numero:numero,p_permiso:permiso,p_version:null});
 return Array.isArray(r)?r[0]||null:null;
}
async function insertar(c,registro){
 const payload={
   evento_id:registro.evento_id,
   acceso_id:registro.acceso_id,
   perfil_id:registro.perfil_id,
   version_acceso:registro.version_acceso,
   numero:registro.numero,tipo:registro.tipo,
   texto:registro.texto,media_id:registro.media_id,
   estado:registro.estado
 };
 try{await rest(c,'bot_borradores',payload);}
 catch(error){if(error.code!=='23505')throw error;} // WhatsApp reintenta; único por mensaje.
}
async function handler(req){
 const c=conf();
 if(c.modo!=='interno')return texto('Bot de prueba desactivado',503);
 if(!c.secreto||!c.verificacion||!c.phoneId||
   !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(c.supabaseUrl)||!c.role)
   return texto('Configuración incompleta',503);
 if(req.method==='GET'){
  const params=new URL(req.url).searchParams;
  if(params.get('hub.mode')==='subscribe'&&params.get('hub.verify_token')===c.verificacion){
   const challenge=params.get('hub.challenge');
   if(challenge!==null&&/^[0-9]{1,80}$/.test(challenge))return texto(challenge,200);
  }
  return texto('No autorizado',403);
 }
 if(req.method!=='POST')return texto('Método no permitido',405);
 let raw;
 try{raw=await leerLimitado(req);}catch{return texto('Carga inválida',413);}
 if(!await firmaCorrecta(raw,req.headers.get('x-hub-signature-256'),c.secreto))
   return texto('Firma incorrecta',403);
 let payload;
 try{payload=JSON.parse(raw);}catch{return texto('JSON inválido',400);}
 const mensajes=extraerMensajes(payload,c.phoneId);
 try{
   const resultado=await procesarMensajes(mensajes,{
     autorizar:(numero,permiso)=>autorizar(c,numero,permiso),
     insertar:registro=>insertar(c,registro)
   });
   // No devolver contenido recibido, datos internos ni números.
   return json({ok:true,recibidos:resultado.registrados,omitidos:resultado.omitidos});
 }catch{
   // Sin confirmación de proceso para que Meta pueda reintentar; inserciones son idempotentes.
   return json({ok:false,error:'Error temporal'},503);
 }
}
Deno.serve(handler);
