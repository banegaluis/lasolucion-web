// Solo metadatos permitidos. Nunca copiar error.message, cuerpo, token o destinatario.
export function diagnosticoRespuesta(status,data){
 const estado=Number.isInteger(status)&&status>=100&&status<=599?status:null;
 const entero=x=>Number.isSafeInteger(x)&&x>=0?x:null;
 const code=entero(data?.error?.code),subcode=entero(data?.error?.error_subcode);
 const accepted=estado!==null&&estado>=200&&estado<300&&typeof data?.messages?.[0]?.id==='string'&&data.messages[0].id.length>0&&!data?.error;
 return {accepted,status:estado,code,subcode,resultado:accepted?'aceptado_por_meta':estado===null?'respuesta_invalida':estado<200||estado>=300?'rechazo_http':'respuesta_sin_confirmacion'};
}
export function diagnosticoTransporte(error){
 return {accepted:false,status:null,code:null,subcode:null,resultado:error?.name==='TimeoutError'||error?.name==='AbortError'?'tiempo_agotado':'fallo_transporte'};
}
