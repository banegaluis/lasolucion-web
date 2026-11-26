import {proponerEdicion,mismosCampos} from './agenda-edicion.mjs';

const descartar=mensaje=>({estado:'aclarar',mensaje,sesion:null});
// Adaptador puro: devuelve una intención validada, nunca guarda ni envía mensajes.
// La sesión y operador deben provenir del servidor, no del texto del usuario.
export function conversarEdicion({mensaje,ordenes,sesion=null,operador,ahora=new Date()}){
 if(mensaje?.tipo!=='texto'||typeof mensaje.texto!=='string')return descartar('Para cambiar un turno, escribime el pedido como texto. No cambié la agenda.');
 const texto=mensaje.texto.trim();
 if(/^confirmar\b/i.test(texto)){
  const codigo=sesion?.codigo;
  if(typeof codigo!=='string'||!/^[0-9a-f]{32}$/.test(codigo)||texto.toLowerCase()!==`confirmar cambio ${codigo}`)return descartar('Ese código no corresponde a la propuesta vigente. Prepará el cambio nuevamente.');
  if(!sesion?.propuesta||typeof sesion.propuesta.inicio!=='string')return descartar('No encuentro una propuesta válida.');
  // Reutiliza validaciones de dueño, vencimiento, base original y disponibilidad.
  const revision=proponerEdicion({texto:`Mejor a las ${sesion.propuesta.inicio}`,ordenes,sesion,operador,ahora});
  if(revision.estado!=='propuesta')return revision;
  if(!mismosCampos(revision.sesion.propuesta,sesion.propuesta))return descartar('La propuesta cambió. Prepará el cambio nuevamente.');
  return {estado:'intencion_validada',mensaje:'Confirmación validada para revisar el guardado. La agenda todavía no fue modificada.',sesion:null,intencion:{codigo,operador,orden_id:sesion.base.id,base:{...sesion.base},propuesta:{...sesion.propuesta}}};
 }
 const r=proponerEdicion({texto,ordenes,sesion,operador,ahora});
 if(r.estado!=='propuesta')return r;
 // Cada corrección reemplaza el código, aun cuando conserve la misma fecha.
 const codigo=crypto.randomUUID().replace(/-/g,'');
 return {...r,sesion:{...r.sesion,codigo},mensaje:r.mensaje+`\nPara confirmar esta propuesta escribí exactamente: CONFIRMAR CAMBIO ${codigo}`};
}
