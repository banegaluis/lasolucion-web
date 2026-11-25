import {confirmacionExacta} from './confirmacion-exacta.mjs';
import {fechaLocal} from './agenda-consulta.mjs';
export function pedidoTurno(raw,now=new Date()){
 const s=String(raw||'').trim();
 const confirm=s.match(/^confirmar\s+([0-9a-f]{8})[.!]?$/i);
 if(confirm)return {tipo:'confirmar',codigo:confirm[1].toLowerCase()};
 if(!/\b(?:agendame|agendar|anotame|registrame|programame|creame|cargame)\b/i.test(s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')))return null;
 const fields=s.split(/[;\n]/).map(x=>x.trim());
 const vals={};for(const f of fields){const m=f.match(/^(?:.*?\b)?(cliente|direcci[oó]n|trabajo|fecha|inicio|fin)\s*:\s*(.+)$/i);if(m)vals[m[1].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()]=m[2].trim();}
 if(!vals.cliente||!vals.direccion||!vals.trabajo||!vals.fecha||!vals.inicio||!vals.fin)return {tipo:'faltantes'};
 let fecha=vals.fecha.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const local=fechaLocal(now).dia;
 if(fecha==='hoy')fecha=local;
 else if(fecha==='manana'){const d=new Date(local+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);fecha=d.toISOString().slice(0,10);}
 else {const d=fecha.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(d)fecha=d[3]+'-'+d[2]+'-'+d[1];}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)||!Number.isFinite(Date.parse(fecha+'T00:00:00Z'))||new Date(fecha+'T00:00:00Z').toISOString().slice(0,10)!==fecha||fecha<local)return {tipo:'invalido'};
 const hora=s=>{const m=s.match(/^(\d{1,2}):(\d{2})$/);return m&&+m[1]<24&&+m[2]<60?m[1].padStart(2,'0')+':'+m[2]:null;};
 const inicio=hora(vals.inicio),fin=hora(vals.fin);
 if(!inicio||!fin||fin<=inicio||vals.trabajo.length<3||vals.trabajo.length>180||vals.cliente.length>150||vals.direccion.length>250)return {tipo:'invalido'};
 return {tipo:'preparar',cliente:vals.cliente,direccion:vals.direccion,titulo:vals.trabajo,fecha,inicio,fin};
}
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
export async function gestionarTurno(c,m,p,rest){
 const ayuda='Para preparar un turno enviame: Agendame; cliente: nombre completo; dirección: alias o dirección exacta; trabajo: descripción; fecha: mañana o DD/MM/AAAA; inicio: 10:00; fin: 12:00. Te mostraré un resumen antes de registrarlo.';
 if(p.tipo==='faltantes'||p.tipo==='invalido')return ayuda;
 if(p.tipo==='confirmar'){
  if(!confirmacionExacta(m,p.codigo,false))return 'Por seguridad, escribí CONFIRMAR '+p.codigo+' como mensaje de texto.';
  const result=await rest(c,'rpc/laso_confirmar_turno',{p_codigo:p.codigo,p_numero:m.numero,p_version:m.version_acceso,p_evento:m.evento_id});
  const r=Array.isArray(result)?result[0]:result;
  if(r?.estado==='registrado')return 'Turno registrado correctamente. Orden #'+r.numero+'. No envié mensajes al cliente.';
  return ({ocupado:'Ese horario está ocupado. Prepará otro turno.',vencido:'La confirmación venció. Prepará el turno nuevamente.',inexistente:'No encuentro ese código de confirmación.',cliente_invalido:'El cliente o domicilio ya no está disponible.',confirmacion_invalida:'La confirmación no es válida.'})[r?.estado]||'No pude registrar el turno.';
 }
 async function get(table,params){const r=await fetch(c.supabaseUrl+'/rest/v1/'+table+'?'+new URLSearchParams(params),{headers:{apikey:c.role,authorization:'Bearer '+c.role},redirect:'error',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('read failed');return await r.json();}
 const clientes=(await get('clientes',{select:'id,nombre_completo',activo:'eq.true',limit:'1000'})).filter(x=>norm(x.nombre_completo)===norm(p.cliente));
 if(clientes.length!==1)return 'No encontré un único cliente con ese nombre exacto. Verificá su ficha en el CRM.';
 const cliente=clientes[0];
 const dirs=(await get('direcciones_clientes',{select:'id,alias,direccion_completa',cliente_id:'eq.'+cliente.id,activo:'eq.true',limit:'100'})).filter(x=>norm(x.alias)===norm(p.direccion)||norm(x.direccion_completa)===norm(p.direccion));
 if(dirs.length!==1)return 'No encontré un domicilio único. Indicame el alias exacto registrado en el CRM.';
 const d=dirs[0];const codigo=crypto.randomUUID().replace(/-/g,'').slice(0,8);
 await rest(c,'laso_turnos_confirmacion',{evento_id:m.evento_id,acceso_id:m.acceso_id,perfil_id:m.perfil_id,version_acceso:m.version_acceso,cliente_id:cliente.id,direccion_id:d.id,titulo:p.titulo,fecha:p.fecha,inicio:p.inicio,fin:p.fin,codigo},'return=minimal');
 return 'Turno preparado (todavía no registrado):\nCliente: '+cliente.nombre_completo+'\nDirección: '+d.direccion_completa+'\nTrabajo: '+p.titulo+'\nFecha: '+p.fecha+'\nHorario: '+p.inicio+' a '+p.fin+'\nPara registrarlo y verificar disponibilidad, escribí exactamente:\nCONFIRMAR '+codigo+'\nVálido por 30 minutos.';
}
