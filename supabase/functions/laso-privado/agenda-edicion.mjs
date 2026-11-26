import {fechaLocal} from './agenda-consulta.mjs';

const normalizar=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
// JSONB no conserva el orden de las claves. Comparar valores y esquema plano.
export const mismosCampos=(a,b)=>!!a&&!!b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(b).every(k=>Object.hasOwn(a,k)&&a[k]===b[k]);
const aclarar=mensaje=>({estado:'aclarar',mensaje,sesion:null});
const hora=s=>{const m=String(s??'').match(/^(\d{2}):(\d{2})(?::00)?$/);return m&&+m[1]<24&&+m[2]<60?+m[1]*60 + +m[2]:null;};
const fechaValida=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const hhmm=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
// Núcleo sin I/O: propone cambios, nunca autoriza ni ejecuta escrituras.
// El adaptador futuro debe entregar órdenes recién consultadas y una identidad ya autorizada.
export function proponerEdicion({texto,ordenes,sesion=null,operador,ahora=new Date()}){
 if(typeof operador!=='string'||!operador.trim())return aclarar('No puedo identificar la sesión privada.');
 if(typeof texto!=='string'||texto.length>500||!Array.isArray(ordenes)||ordenes.some(o=>!o||typeof o!=='object'||Array.isArray(o))||!(ahora instanceof Date)||!Number.isFinite(ahora.getTime()))return aclarar('No pude interpretar el cambio.');
 const t=normalizar(texto);
 if(t==='cancelar cambio')return {estado:'cancelado',mensaje:'Descarté la propuesta. No modifiqué la agenda.',sesion:null};
 // Gramática cerrada: una orden por número o una corrección de la propuesta activa.
 const inicial=t.match(/^(?:pasa|pasame|move|reprograma) (?:la )?(?:orden|turno) #?(\d+) (?:para|a) (.+)$/);
 const correccion=t.match(/^mejor (.+)$/);
 if(!inicial&&!correccion)return aclarar('Decime, por ejemplo: Pasá la orden #42 para mañana a las 10:00.');
 let numero,cambio,anterior;
 if(inicial){numero=Number(inicial[1]);cambio=inicial[2];}
 else{
  if(!sesion||sesion.operador!==operador||!Number.isFinite(sesion.creada)||ahora.getTime()<sesion.creada||ahora.getTime()-sesion.creada>=30*60*1000)return aclarar('La propuesta venció o no pertenece a esta sesión. Indicame la orden nuevamente.');
  if(!sesion.propuesta||!fechaValida(sesion.propuesta.fecha)||hora(sesion.propuesta.inicio)===null||hora(sesion.propuesta.fin)===null)return aclarar('La propuesta está incompleta. Indicame el cambio nuevamente.');
  numero=sesion.numero;cambio=correccion[1];anterior=sesion;
 }
 if(!Number.isSafeInteger(numero)||numero<1)return aclarar('Indicame un número de orden válido.');
 const matches=ordenes.filter(o=>o.numero_orden===numero);
 if(matches.length!==1)return aclarar('No encontré una única orden con ese número.');
 const o=matches[0];
 if(o.estado!=='pendiente')return aclarar('Solo puedo preparar cambios de órdenes pendientes.');
 const inicioOriginal=hora(o.hora_inicio),finOriginal=hora(o.hora_fin);
 if(typeof o.id!=='string'||!o.id||inicioOriginal===null||finOriginal===null||finOriginal<=inicioOriginal)return aclarar('La orden necesita un horario completo antes de reprogramarla.');
 const base={id:o.id,fecha:o.fecha_programada,inicio:o.hora_inicio,fin:o.hora_fin,estado:o.estado,cliente_id:o.cliente_id??null,direccion_cliente_id:o.direccion_cliente_id??null,titulo:o.titulo??null};
 if(anterior&&!mismosCampos(anterior.base,base))return aclarar('La orden cambió desde la propuesta anterior. Volvé a indicarme el cambio.');
 // Una corrección solo de fecha conserva la hora explícita de la propuesta vigente.
 // Se expande a la misma gramática para reutilizar todas las validaciones posteriores.
 if(anterior){
  const soloFecha=cambio.match(/^(?:para (?:el )?)?(hoy|manana|pasado manana|\d{2}\/\d{2}\/\d{4})$/);
  if(soloFecha)cambio=`${soloFecha[1]} a las ${hhmm(hora(anterior.propuesta.inicio))}`;
 }
 const m=cambio.match(/^(?:(hoy|manana|pasado manana|\d{2}\/\d{2}\/\d{4}) )?a las (\d{1,2})(?::(\d{2}))?$/);
 if(!m||(!m[1]&&!anterior))return aclarar('Necesito una fecha y una hora claras, por ejemplo: mañana a las 10:00.');
 const local=fechaLocal(ahora);
 let fecha=anterior?.propuesta.fecha;
 if(m[1]){
  if(/\//.test(m[1]))fecha=m[1].split('/').reverse().join('-');
  else{const d=new Date(local.dia+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+({'hoy':0,'manana':1,'pasado manana':2}[m[1]]));fecha=d.toISOString().slice(0,10);}
 }
 const d=new Date(fecha+'T00:00:00Z');
 const inicio=+m[2]*60 + +(m[3]||0),fin=inicio+finOriginal-inicioOriginal;
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==fecha||+m[2]>23||+(m[3]||0)>59||fin>=1440||fecha<local.dia||(fecha===local.dia&&hhmm(inicio)<=local.hora.slice(0,5)))return aclarar('La fecha u hora no es válida, ya pasó o termina al día siguiente.');
 const conflictos=ordenes.filter(x=>x.id!==o.id&&['pendiente','en_proceso'].includes(x.estado)&&x.fecha_programada===fecha).some(x=>{
  const a=hora(x.hora_inicio),b=hora(x.hora_fin);
  return a===null||b===null||a>=b||(a<fin&&b>inicio);
 });
 if(conflictos)return aclarar('Ese horario se superpone con otro trabajo. Indicame otra fecha y hora.');
 const propuesta={fecha,inicio:hhmm(inicio),fin:hhmm(fin)};
 return {estado:'propuesta',mensaje:`Propuesta para la orden #${numero}: ${base.fecha} ${hhmm(inicioOriginal)}–${hhmm(finOriginal)} → ${fecha} ${propuesta.inicio}–${propuesta.fin}. Todavía no cambié la agenda.`,sesion:{operador,numero,creada:anterior?.creada??ahora.getTime(),base,propuesta}};
}
