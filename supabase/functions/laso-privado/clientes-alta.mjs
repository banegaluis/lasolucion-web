import {confirmacionExacta} from './confirmacion-exacta.mjs';
import {fechaLocal} from './agenda-consulta.mjs';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function tipoCliente(texto){
 const t=norm(texto);
 const code=t.match(/^confirmar alta ([0-9a-f]{8})$/);if(code)return {tipo:'confirmar',codigo:code[1]};
 if(/\b(?:cliente nuevo|nuevo cliente|alta de cliente|dar de alta (?:a )?(?:un |una )?cliente|creame (?:un )?cliente)\b/.test(t))return {tipo:'nuevo'};
 if(/\bclientes\b/.test(t)&&/\b(?:revisar|revisa|consultar|consulta|consultame|mostrame|decime|cuales|que|listar|listame|ver)\b/.test(t)&&!/\b(?:eliminar|borrar|modificar|cancelar)\b/.test(t))return {tipo:'listar'};
 if(/^(?:bueno\s+)?(?:lo creemos|creemoslo|crealo|dale|si|confirmado|confirmo|hagamoslo)[.!]?$/.test(t))return {tipo:'asentir'};
 if(/^(?:nombre|apellido|telefono|direccion|calle|numero|ciudad|provincia|trabajo|fecha|inicio|fin|duracion)\s*(?::|\s)/.test(t))return {tipo:'completar'};
 return null;
}
function fechaDe(x,now){const local=fechaLocal(now).dia;let s=norm(x);if(s==='hoy')return local;if(s==='manana'){const d=new Date(local+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m)s=m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s?s:null;}
function horaDe(s){const m=norm(s).match(/^(\d{1,2})(?::(\d{2}))?$/);return m&&+m[1]<24&&+(m[2]||0)<60?m[1].padStart(2,'0')+':'+(m[2]||'00'):null;}
export function extraerAlta(texto,base={},now=new Date()){
 const d={...base};delete d.listo;
 const s=String(texto||'').trim();
 // Una corrección explícita invalida el valor anterior antes de interpretarla.
 const campos=s.split(/[;\n]/).map(x=>norm(x).match(/^(fin|duracion)\s*(?::|\s)/)?.[1]);
 const cambiaFin=campos.includes('fin'), cambiaDuracion=campos.includes('duracion');
 const horarioAmbiguo=cambiaFin&&cambiaDuracion;
 if(cambiaFin||cambiaDuracion){delete d.fin;delete d.duracion;}
 else if(d.duracion)delete d.fin; // Se recalcula únicamente con un inicio válido.

 const nombre=s.match(/\b(?:se llama|llamado|llamada)\s+(.+?)(?=\s+(?:y\s+)?(?:vive|domicilio|telefono|teléfono|necesita|quiere)|[;,.]|$)/i);
 if(nombre){const n=nombre[1].trim().split(/\s+/);d.nombre=n.shift();if(n.length)d.apellido=n.join(' ');}
 const dir=s.match(/\b(?:vive en|domicilio en|direcci[oó]n en)\s+(.+?)\s+(?:en el\s+)?(\d{1,8})(?=\s|[;,.]|$)/i);if(dir){d.calle=dir[1].trim();d.numero=dir[2];}
 const trabajo=s.match(/\b(?:necesita|quiere)\s+(.+?)(?=\s+(?:mañana|manana|hoy|el día|el dia|a las)\b|[;.]|$)/i);if(trabajo)d.trabajo=trabajo[1].trim();
 const dias=[...s.replace(/\bde\s+la\s+ma[ñn]ana\b/gi,'').matchAll(/\b(pasado\s+ma[ñn]ana|hoy|ma[ñn]ana)\b/gi)];if(dias.length>1){delete d.fecha;}else if(dias.length===1){if(/^pasado/i.test(dias[0][1])){const f=new Date(fechaLocal(now).dia+'T00:00:00Z');f.setUTCDate(f.getUTCDate()+2);d.fecha=f.toISOString().slice(0,10);}else d.fecha=fechaDe(dias[0][1],now);}
 const hora=s.match(/\ba las\s+(\d{1,2}(?::\d{2})?)(?:\s+de la\s+(mañana|manana|tarde|noche))?/i);if(hora){let h=horaDe(hora[1]);if(h&&hora[2]&&/tarde|noche/i.test(hora[2])&&+h.slice(0,2)<12)h=String(+h.slice(0,2)+12).padStart(2,'0')+h.slice(2);if(h)d.inicio=h;}
 const tel=s.match(/\b(?:tel[eé]fono|celular)\s*(?::|es|del cliente)?\s*(\+?\d[\d ()-]{8,20}\d)/i);if(tel)d.telefono=tel[1].replace(/\D/g,'');
 for(const piece of s.split(/[;\n]/)){const m=piece.trim().match(/^(nombre|apellido|tel[eé]fono|direcci[oó]n|calle|n[uú]mero|ciudad|provincia|trabajo|fecha|inicio|fin|duraci[oó]n)\s*(?::|\s)\s*(.+)$/i);if(!m)continue;const k=norm(m[1]),v=m[2].trim().replace(/[.]$/,'');if(k==='direccion'){const a=v.match(/^(.+?)\s+(\d{1,8})$/);if(a){d.calle=a[1];d.numero=a[2];}}else if(k==='fecha')d.fecha=fechaDe(v,now);else if(k==='inicio'||k==='fin')d[k]=horaDe(v);else if(k==='telefono')d.telefono=v.replace(/\D/g,'');else if(k==='duracion'){const dur=norm(v).match(/^(\d+(?:[.,]\d+)?)\s*(?:horas?|h)$/);if(dur){const horas=Number(dur[1].replace(',','.'));if(Number.isFinite(horas)&&horas>0&&horas<24)d.duracion=horas;}}else d[k]=v.slice(0,180);}
 if(!d.ciudad)d.ciudad='Córdoba';if(!d.provincia)d.provincia='Córdoba';
 if(d.duracion&&d.inicio){const [h,m]=d.inicio.split(':').map(Number);const total=h*60+m+Math.round(d.duracion*60);if(total<1440&&total>h*60+m)d.fin=String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0');}
 if(horarioAmbiguo){delete d.fin;delete d.duracion;}
 if(d.duracion&&!d.fin)delete d.duracion;
 const faltan=[];if(horarioAmbiguo)faltan.push('indicar solo hora de fin o duración');for(const [k,label] of [['nombre','nombre'],['apellido','apellido'],['calle','calle'],['numero','número de domicilio'],['trabajo','trabajo'],['fecha','fecha'],['inicio','hora de inicio'],['fin','hora de fin o duración']])if(!d[k])faltan.push(label);
 if(!/^\d{10,15}$/.test(d.telefono||''))faltan.push('teléfono del cliente (escribilo con números)');
 if(d.inicio&&d.fin&&d.fin<=d.inicio)faltan.push('horario de fin posterior al inicio');
 if(d.fecha&&d.fecha<fechaLocal(now).dia)faltan.push('fecha futura');
 d.listo=faltan.length===0;return {datos:d,faltan};
}
export async function gestionarCliente(c,m,p,texto,rest){
 async function get(table,params){const r=await fetch(c.supabaseUrl+'/rest/v1/'+table+'?'+new URLSearchParams(params),{headers:{apikey:c.role,authorization:'Bearer '+c.role},redirect:'error',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('read failed');return await r.json();}
 if(p.tipo==='listar'){const rows=await get('clientes',{select:'nombre_completo',activo:'eq.true',order:'nombre_completo.asc',limit:'21'});return rows.length?'Clientes activos del CRM:\n'+rows.slice(0,20).map(x=>'• '+String(x.nombre_completo||'Sin nombre').slice(0,100)).join('\n')+(rows.length>20?'\nHay más clientes en el CRM.':''):'No hay clientes activos.';}
 if(p.tipo==='confirmar'){
  if(!confirmacionExacta(m,p.codigo,true))return 'Para confirmar, escribí CONFIRMAR ALTA '+p.codigo+' en texto.';
  const r=await rest(c,'rpc/laso_confirmar_alta',{p_codigo:p.codigo,p_numero:m.numero,p_version:m.version_acceso,p_evento:m.evento_id});const z=Array.isArray(r)?r[0]:r;
  return z?.estado==='registrado'?'Cliente y turno registrados. Orden #'+z.numero+'. No envié mensajes al cliente.':({cliente_existente:'Ese cliente o teléfono ya figura en el CRM. No creé duplicados.',ocupado:'El horario está ocupado. No guardé el cliente ni el turno.',vencido:'El código venció o fue reemplazado.',incompleto:'Faltan datos para registrar el cliente y el turno.',horario_invalido:'El horario ya pasó o no es válido.'})[z?.estado]||'No pude confirmar el alta.';
 }
 let base={};
 if(p.tipo!=='nuevo'){
  const rows=await get('laso_altas_pendientes',{select:'datos,creado,codigo,orden_id',acceso_id:'eq.'+m.acceso_id,version_acceso:'eq.'+m.version_acceso,order:'creado.desc',limit:'1'});
  if(!rows.length||rows[0].orden_id||Date.now()-Date.parse(rows[0].creado)>1800000)return 'No tengo un alta pendiente vigente. Decime que tenés un cliente nuevo y sus datos.';
  base=rows[0].datos;
  if(p.tipo==='asentir'&&base.listo)return 'Para registrar el cliente y el turno, escribí CONFIRMAR ALTA '+rows[0].codigo+'.';
 }
 const {datos:d,faltan}=extraerAlta(p.tipo==='asentir'?'':texto,base);
 const codigo=crypto.randomUUID().replace(/-/g,'').slice(0,8);
 await rest(c,'laso_altas_pendientes',{evento_id:m.evento_id,acceso_id:m.acceso_id,perfil_id:m.perfil_id,version_acceso:m.version_acceso,datos:d,codigo},'return=minimal');
 let resumen='Alta y turno pendientes (no guardados en el CRM):\nCliente: '+[d.nombre,d.apellido].filter(Boolean).join(' ')+'\nDomicilio: '+[d.calle,d.numero,d.ciudad,d.provincia].filter(Boolean).join(' ')+'\nTrabajo: '+(d.trabajo||'sin definir')+'\nFecha: '+(d.fecha||'sin definir')+'\nHorario: '+(d.inicio||'?')+' a '+(d.fin||'?')+'\nTeléfono: '+(d.telefono||'sin definir');
 if(faltan.length)return resumen+'\nFalta: '+faltan.join(', ')+'. Podés completar o corregir con: apellido: ...; teléfono: ...; trabajo: ...; duración: 2 horas. Confirmá que el trabajo transcripto sea correcto.';
 return resumen+'\nRevisá todos los datos. Para guardar y comprobar disponibilidad escribí exactamente: CONFIRMAR ALTA '+codigo+' (válido 30 minutos).';
}
