import {conversarEdicion} from './agenda-edicion-conversacion.mjs';

const incierto=()=>({estado:'resultado_desconocido',mensaje:'No pude comprobar el resultado. Necesito revisar el estado guardado antes de continuar.',releer:true});
const rechazado=()=>({estado:'rechazado',mensaje:'El cambio no fue confirmado. Necesito revisar la agenda y preparar una propuesta nueva.',releer:true});
// Coordinador aún no conectado al webhook. No autentica ni envía mensajes.
// El receptor debe validar HMAC/identidad y registrar el evento antes de invocarlo.
// Los puertos deben ejecutar RPC autorizadas con ese mismo evento, acceso y revisión.
export async function ejecutarEdicion({entrada,revision,guardarSesion,confirmarCambio}){
 if(!Number.isSafeInteger(revision)||revision<0||typeof guardarSesion!=='function'||typeof confirmarCambio!=='function')return incierto();
 try{
  const conversacion=conversarEdicion(entrada);
  const confirma=conversacion.estado==='intencion_validada';
  // No consumir la sesión antes de confirmar: la transacción SQL lo hace junto al cambio.
  const resultado=confirma
   ?await confirmarCambio({codigo:conversacion.intencion.codigo,revision})
   :await guardarSesion({sesion:conversacion.sesion,revision});
  if(!resultado||typeof resultado!=='object'||Array.isArray(resultado))return incierto();
  if(resultado.estado==='denegado')return {estado:'denegado',mensaje:null,releer:true};
  // Un resultado histórico no acredita contexto actual ni autoriza reenviar respuestas.
  if(resultado.repetido===true)return {estado:'repetido',mensaje:null,releer:true};
  if(confirma&&resultado.estado==='editada'){
   if(resultado.orden_id!==conversacion.intencion.orden_id)return incierto();
   return {estado:'editada',mensaje:'Listo, el cambio de horario quedó guardado.',releer:true};
  }
  if(!confirma&&resultado.estado==='guardada'){
   if(resultado.revision!==revision+1)return incierto();
   return {estado:conversacion.estado,mensaje:conversacion.mensaje,revision:resultado.revision,releer:true};
  }
  const rechazos=['conflicto','evento_reutilizado','evento_invalido','sesion_invalida','sesion_vencida','contexto_invalido','confirmacion_invalida','propuesta_invalida','vencida','orden_inexistente','orden_cambiada','horario_invalido','duracion_invalida','ocupado'];
  return rechazos.includes(resultado.estado)?rechazado():incierto();
 }catch{
  // Puede haber commit seguido de pérdida de respuesta. No afirmar rollback ni reintentar.
  return incierto();
 }
}
