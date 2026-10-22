// Núcleo puro, sin credenciales ni efectos laterales.
const REMITENTE=/^[1-9][0-9]{7,14}$/;
const ID=/^[A-Za-z0-9_.:-]{5,250}$/;
export function remitenteE164(from){
 const numero=String(from??'').trim();
 return REMITENTE.test(numero)?'+'+numero:null;
}
export function esComandoAgenda(texto){
 return /^(?:agend[áa]|agenda|agendar|turno|program[áa]|programar|nueva orden)\b/i.test(String(texto||'').trim());
}
export function extraerMensajes(payload,phoneId){
 if(payload?.object!=='whatsapp_business_account'||!phoneId)return [];
 const salida=[];
 for(const entry of Array.isArray(payload.entry)?payload.entry:[]){
  for(const change of Array.isArray(entry.changes)?entry.changes:[]){
   if(change.field!=='messages')continue;
   const valor=change.value;
   if(String(valor?.metadata?.phone_number_id||'')!==String(phoneId))continue;
   for(const m of Array.isArray(valor.messages)?valor.messages:[]){
    const numero=remitenteE164(m?.from);
    if(!numero||!ID.test(String(m?.id||'')))continue;
    if(m.type==='text'){
      const texto=m.text?.body;
      if(typeof texto!=='string'||texto.trim().length===0||texto.length>2000||!esComandoAgenda(texto))continue;
      salida.push({evento_id:m.id,numero,tipo:'texto',texto:texto.trim(),media_id:null,estado:'pendiente_revision'});
    }else if(m.type==='audio'){
      const mediaId=m.audio?.id;
      if(typeof mediaId!=='string'||!ID.test(mediaId))continue;
      salida.push({evento_id:m.id,numero,tipo:'audio',texto:null,media_id:mediaId,estado:'audio_sin_transcribir'});
    }
   }
  }
 }
 return salida.slice(0,50);
}
export async function firmaCorrecta(cuerpo,encabezado,clave,cripto=globalThis.crypto){
 if(typeof cuerpo!=='string'||!/^sha256=[a-f0-9]{64}$/.test(String(encabezado||''))||!clave||!cripto?.subtle)return false;
 const key=await cripto.subtle.importKey('raw',new TextEncoder().encode(clave),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const firma=await cripto.subtle.sign('HMAC',key,new TextEncoder().encode(cuerpo));
 const esperada=new Uint8Array(firma);
 const recibida=new Uint8Array(32);
 const hex=encabezado.slice(7);
 for(let i=0;i<32;i++)recibida[i]=Number.parseInt(hex.slice(2*i,2*i+2),16);
 let diferencia=0;
 for(let i=0;i<32;i++)diferencia|=esperada[i]^recibida[i];
 return diferencia===0;
}
export async function procesarMensajes(mensajes,{autorizar,insertar}){
 let registrados=0,omitidos=0;
 for(const m of mensajes){
   // Nunca confiar en un rol, nombre o identidad declarados dentro del texto.
   const acceso=await autorizar(m.numero,'agenda.registrar');
   if(!acceso?.acceso_id||!acceso.perfil_id||!Number.isInteger(acceso.version)){
      omitidos++;continue;
   }
   await insertar({...m,acceso_id:acceso.acceso_id,perfil_id:acceso.perfil_id,version_acceso:acceso.version});
   registrados++;
 }
 return {registrados,omitidos};
}
