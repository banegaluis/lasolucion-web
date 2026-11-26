import {interpretarLista} from '../whatsapp-interno/memoria-listas-parser.mjs';

const TTL=15*60*1000;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const identidad=o=>o&&uuid.test(o.acceso_id)&&uuid.test(o.perfil_id)&&Number.isSafeInteger(o.version_acceso)&&o.version_acceso>0;
const mismo=(a,b)=>identidad(a)&&identidad(b)&&a.acceso_id===b.acceso_id&&a.perfil_id===b.perfil_id&&a.version_acceso===b.version_acceso;
const aclarar=mensaje=>({estado:'aclarar',mensaje,sesion:null});
const firma=p=>JSON.stringify([p.accion,p.nombre,p.clave,p.items]);
// Prototipo puro. Identidad y sesión deben venir del servidor autenticado.
// No llama RPC, no persiste, no envía. Una intención no equivale a autorización SQL.
export function conversarMemoria({mensaje,operador,sesion=null,ahora=new Date()}){
 const tiempo=ahora instanceof Date?ahora.getTime():NaN;
 if(!identidad(operador)||!Number.isFinite(tiempo))return aclarar('No pude validar tu acceso. No guardé cambios.');
 if(!['texto','transcripcion'].includes(mensaje?.tipo)||typeof mensaje.texto!=='string'||mensaje.texto.length>12000)return aclarar('Mandame un pedido de lista más corto. No guardé cambios.');
 const texto=mensaje.texto.trim();
 if(/^cancelar$/i.test(texto))return {estado:'cancelado',mensaje:'Descarté la propuesta de lista. No guardé cambios.',sesion:null};
 if(/^confirmar\b/i.test(texto)){
  if(mensaje.tipo!=='texto')return aclarar('La confirmación tiene que ser escrita. Volvé a preparar la lista; no guardé cambios.');
  if(!sesion||!mismo(sesion.operador,operador)||!Number.isFinite(sesion.creada)||tiempo<sesion.creada||tiempo-sesion.creada>=TTL)return aclarar('La propuesta venció o tu acceso cambió. Preparala nuevamente.');
  if(typeof sesion.codigo!=='string'||!/^[0-9a-f]{32}$/.test(sesion.codigo)||texto!==`CONFIRMAR LISTA ${sesion.codigo}`)return aclarar('La confirmación no coincide exactamente con la propuesta vigente. Preparala nuevamente.');
  const p=interpretarLista(sesion.texto);
  if(!p||!['crear','agregar'].includes(p.accion)||firma(p)!==firma(sesion.propuesta??{}))return aclarar('La propuesta no es válida. Preparala nuevamente.');
  return {estado:'intencion_validada',mensaje:'Confirmación recibida. El guardado todavía está pendiente.',sesion:null,intencion:{codigo:sesion.codigo,operador:{...operador},propuesta:structuredClone(p)}};
 }
 const pedido=texto.replace(/^mejor:\s*/i,'');
 const p=interpretarLista(pedido);
 if(!p||p.accion==='invalido')return aclarar('Decime, por ejemplo: Creá lista materiales: 2 codos; 1 caño. No guardé cambios.');
 if(['listar','ver','ayuda'].includes(p.accion))return {estado:'consulta',consulta:p,sesion:null};
 if(!['crear','agregar'].includes(p.accion))return aclarar('Para cambiar un ítem primero necesito mostrarte su contenido actual. No guardé cambios.');
 const codigo=crypto.randomUUID().replace(/-/g,'');
 const creada=sesion&&mismo(sesion.operador,operador)&&Number.isFinite(sesion.creada)&&tiempo>=sesion.creada&&tiempo-sesion.creada<TTL?sesion.creada:tiempo;
 return {estado:'propuesta',sesion:{codigo,creada,operador:{...operador},texto:pedido,propuesta:structuredClone(p)},mensaje:`${p.accion==='crear'?'Crear':'Agregar a'} lista «${p.nombre}»:\n${p.items.length?p.items.map((x,i)=>`${i+1}. ${x}`).join('\n'):'Lista vacía'}\nTodavía no guardé nada. Para confirmar escribí exactamente: CONFIRMAR LISTA ${codigo}`};
}
