import {diagnosticoRespuesta,diagnosticoTransporte} from './respuesta-diagnostico.mjs';
import {tipoCliente,gestionarCliente} from './clientes-alta.mjs';
import {pedidoTurno,gestionarTurno} from './turnos-confirmacion.mjs';
import {transcribirAudio} from './audio-transcripcion.mjs';
import {tipoConsulta,consultaAgenda,respuestaAgenda} from './agenda-consulta.mjs';
// Webhook interno. Respuestas limitadas al teléfono personal y número de prueba.
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
async function rest(c,ruta,payload,prefer='return=representation'){
 const respuesta=await fetch(c.supabaseUrl+'/rest/v1/'+ruta,{
  method:'POST',redirect:'error',
  headers:{'apikey':c.role,'authorization':'Bearer '+c.role,'content-type':'application/json',
    'prefer':prefer},
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
 // Ignorar solo repeticiones del evento; otros conflictos deben permitir reintento.
 // DO NOTHING conserva el borrador original, sin permisos de actualización.
 const nuevos=await rest(c,'bot_borradores?on_conflict=evento_id',payload,
   'return=representation,resolution=ignore-duplicates');
 // Only the request which inserted this event may attempt a reply.
 if(Array.isArray(nuevos)&&nuevos.length===1&&nuevos[0]?.evento_id===registro.evento_id){
   try{await responderPrivado(c,registro);}catch{console.warn('LASO_REPLY failed');}
 }
}
async function responderPrivado(c,m){
 const testId='1431267843408523';
 const personal='+5493512143961';
 // Fail closed, even if somebody adds other authorized numbers later.
 if(c.modo!=='interno'||c.phoneId!==testId||m.numero!==personal)return;
 const token=Deno.env.get('WHATSAPP_ACCESS_TOKEN')||'';
 if(!token){console.warn('LASO_REPLY token_missing');return;}
 const age=Date.now()/1000-m.recibidoMeta;
 if(!Number.isFinite(age)||age < -60||age >= 86400){console.info('LASO_REPLY outside_window');return;}
 const acceso=await autorizar(c,personal,'agenda.registrar');
 if(!acceso||acceso.acceso_id!==m.acceso_id||acceso.perfil_id!==m.perfil_id||acceso.version!==m.version_acceso)return;
 const saludo=m.tipo==='texto'&&/^(?:hola|buen(?:os días| día|as tardes|as noches))\b/i.test(m.texto||'');
 let body=m.tipo==='audio'?'Recibí tu audio. Todavía no puedo transcribirlo; escribime la instrucción en texto.':saludo?'¡Hola! Soy Laso, tu secretario de La Solución. Ya puedo recibir y responder mensajes. Por ahora guardo tus instrucciones para revisión.':'Recibí tu mensaje y lo guardé para revisión. Todavía no he creado un turno ni ejecutado ninguna acción.';
 let textoConsulta=m.tipo==='texto'?m.texto:null;
 let transcripcion=null;
 if(m.tipo==='audio'){
  const groq=Deno.env.get('GROQ_API_KEY')||'';
  if(!groq)body='Recibí tu audio. Falta activar la clave de transcripción.';
  else{
   try{
    transcripcion=await transcribirAudio(m.media_id,token,groq,testId);
    textoConsulta=transcripcion;
    body='Entendí: '+transcripcion+'\nPor ahora no ejecuté ninguna acción.';
    console.info('LASO_AUDIO transcribed');
   }catch{body='Recibí tu audio pero no pude transcribirlo. Probá una nota corta o escribime.';console.warn('LASO_AUDIO failed');}
  }
 }
 const clientePedido=textoConsulta?tipoCliente(textoConsulta):null;
 const pedido=!clientePedido&&textoConsulta?pedidoTurno(textoConsulta):null;
 const tipo=!clientePedido&&!pedido&&textoConsulta?tipoConsulta(textoConsulta):null;
 console.info('LASO_INTENT '+JSON.stringify({tipo:tipo||'no_reconocido',origen:m.tipo}));
 if(textoConsulta&&!tipo&&!saludo)body=(transcripcion?'Entendí: '+transcripcion+'\n':'Recibí tu mensaje.\n')+'Todavía no ejecuté ninguna acción. Puedo consultar tu agenda, trabajos de hoy, mañana, pendientes o el próximo turno. Para crear o cambiar turnos aún necesito revisión.';
 if(clientePedido){try{body=await gestionarCliente(c,m,clientePedido,textoConsulta,rest);console.info('LASO_CLIENTE '+clientePedido.tipo);}catch{body='No pude consultar o preparar el cliente. No confirmes el alta hasta revisar el CRM.';console.warn('LASO_CLIENTE failed');}}
 else if(pedido){try{body=await gestionarTurno(c,m,pedido,rest);console.info('LASO_TURNO '+pedido.tipo);}catch{body='No pude preparar o confirmar el turno. Consultá el CRM antes de reintentar.';console.warn('LASO_TURNO failed');}}
 else if(tipo==='ayuda')body='Puedo consultar el CRM. Probá: Consultar turnos, Agenda hoy, Agenda mañana, Trabajos pendientes o Próximo trabajo. También puedo preparar turnos y registrarlos con confirmación escrita.';
 else if(tipo){
  try{
   const permiso=await autorizar(c,personal,'agenda.consultar');
   if(!permiso||permiso.acceso_id!==m.acceso_id||permiso.perfil_id!==m.perfil_id||permiso.version!==m.version_acceso)body='No tengo permiso para consultar la agenda.';
   else{
    const q=consultaAgenda(tipo,new Date());
    const result=await fetch(c.supabaseUrl+'/rest/v1/ordenes?'+q.toString(),{method:'GET',redirect:'error',headers:{apikey:c.role,authorization:'Bearer '+c.role,accept:'application/json'},signal:AbortSignal.timeout(5000)});
    if(!result.ok)throw Error('agenda read failed');
    body=respuestaAgenda(tipo,await result.json());
    const vigente=await autorizar(c,personal,'agenda.consultar');
    if(!vigente||vigente.acceso_id!==m.acceso_id||vigente.perfil_id!==m.perfil_id||vigente.version!==m.version_acceso)body='No tengo permiso para consultar la agenda.';
    console.info('LASO_AGENDA '+JSON.stringify({tipo,ok:true}));
   }
  }catch{body='No pude consultar la agenda del CRM en este momento. Intentá nuevamente.';console.warn('LASO_AGENDA failed');}
 }
 if(transcripcion&&tipo)body='Entendí: '+transcripcion.slice(0,500)+'\n\n'+body;
 const finalAccess=await autorizar(c,personal,'agenda.registrar');
 if(!finalAccess||finalAccess.acceso_id!==m.acceso_id||finalAccess.perfil_id!==m.perfil_id||finalAccess.version!==m.version_acceso)return;
 let resp;
 try{resp=await fetch('https://graph.facebook.com/v27.0/'+testId+'/messages',{
  method:'POST',redirect:'error',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
  body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:'543512143961',type:'text',text:{preview_url:false,body}}),
  signal:AbortSignal.timeout(7000)
 });}catch(error){console.warn('LASO_REPLY '+JSON.stringify(diagnosticoTransporte(error)));return;}
 let data=null;try{data=await resp.json();}catch{}
 console.info('LASO_REPLY '+JSON.stringify(diagnosticoRespuesta(resp.status,data)));
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
 const entries=Array.isArray(payload?.entry)?payload.entry:[];
 const changes=entries.flatMap(e=>Array.isArray(e?.changes)?e.changes:[]);
 const incoming=changes.filter(c=>c?.field==='messages');
 const matching=incoming.filter(x=>String(x?.value?.metadata?.phone_number_id||'')===c.phoneId);
 const rawMessages=matching.flatMap(x=>Array.isArray(x?.value?.messages)?x.value.messages:[]);
 console.info('LASO_DIAG '+JSON.stringify({objectOk:payload?.object==='whatsapp_business_account',entries:entries.length,changes:changes.length,messageFields:incoming.length,matchingPhone:matching.length,incoming:rawMessages.length,eligible:mensajes.length,invalidSender:rawMessages.filter(m=>!(/^[1-9][0-9]{7,14}$/).test(String(m?.from??'').trim())).length,invalidId:rawMessages.filter(m=>!(/^[A-Za-z0-9_.:+=\/-]{5,250}$/).test(String(m?.id??''))).length,textCount:rawMessages.filter(m=>m?.type==='text').length,audioCount:rawMessages.filter(m=>m?.type==='audio').length}));
 try{
   const resultado=await procesarMensajes(mensajes,{
     autorizar:(numero,permiso)=>autorizar(c,numero,permiso),
     insertar:registro=>insertar(c,registro)
   });
   console.info('LASO_RESULT '+JSON.stringify({registrados:resultado.registrados,omitidos:resultado.omitidos}));
   // No devolver contenido recibido, datos internos ni números.
   return json({ok:true,recibidos:resultado.registrados,omitidos:resultado.omitidos});
 }catch{
   // Sin confirmación de proceso para que Meta pueda reintentar; inserciones son idempotentes.
   return json({ok:false,error:'Error temporal'},503);
 }
}
Deno.serve(handler);
