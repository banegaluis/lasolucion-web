// Read-only agenda. No free-text SQL or user-controlled query keys.
export function tipoConsulta(texto){
 const t=String(texto||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
 if(!t||/\b(?:agendame|agendar|agenda me|anotame|anotar|registrame|registrar|creame|crear|carga|cargame|cargar|programame|programar|cancelar|cancela|cancelame|borrar|borra|eliminar|elimina|modificar|modifica|cambiar|cambia|reprogramar|reprograma|mover|move|confirmame|confirmar|pagame|pagar|cobrar|cobra|enviar|envia|mandale|no|nunca)\b/.test(t))return null;
 const tema=/\b(?:trabajos?|turnos?|agenda|citas?|orden(?:es)?|visitas?|agendad[oa]s?|programad[oa]s?|pendientes?)\b/.test(t);
 const consulta=/\b(?:que|cuales|cual|cuantos|cuantas|cuando|mostrame|muestrame|mostra|decime|dime|contame|cuentame|consulta|consultame|consultar|consultes|consultas|ver|vea|revisame|revisa|revisar|revises|quiero|necesito|pasame|dame|listame|listar|mostras|muestras|tenemos|tengo|podes|puedes)\b/.test(t);
 const candidatos=[];
 if(/\bhoy\b/.test(t))candidatos.push('hoy');
 if(/\bmanana\b/.test(t))candidatos.push('manana');
 if(/\bpendientes?\b/.test(t))candidatos.push('pendientes');
 if(/\bproxim[oa]s?\b/.test(t))candidatos.push(/\bproxim[oa]s\b/.test(t)?'agenda':'proximo');
 const simple=/^(?:(?:hola|laso|lazo|lasso|por favor)\s+)*(?:(?:mis |los |las |mi |la )?(?:trabajos?|turnos?|agenda|citas?|orden(?:es)?|visitas?)(?: de| para)? )?(?:hoy|manana|pendientes?)(?:\s+(?:laso|lazo|por favor|gracias))*$/.test(t)||/^(?:(?:laso|lazo|mi|el) )*proximo (?:trabajo|turno|visita)$/.test(t);
 if(candidatos.length>1)return null;
 if(candidatos.length===1&&(simple||tema||consulta))return candidatos[0];
 if(tema&&(consulta||/^(?:(?:hola|laso|lazo|lasso|mi|mis|la|los|las) )*(?:turnos|agenda|trabajos|citas|visitas)(?: por favor)?$/.test(t)))return 'agenda';
 if(/\b(?:ayuda|comandos|menu)\b/.test(t)||/que (?:podes|puedes) hacer/.test(t))return 'ayuda';
 return null;
}
export function fechaLocal(now){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Cordoba',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const get=k=>parts.find(p=>p.type===k)?.value;
 return {dia:get('year')+'-'+get('month')+'-'+get('day'),hora:get('hour')+':'+get('minute')+':00'};
}
export function consultaAgenda(tipo,now){
 const local=fechaLocal(now);
 const manana=new Date(local.dia+'T00:00:00Z');manana.setUTCDate(manana.getUTCDate()+1);
 const q=new URLSearchParams({select:'numero_orden,titulo,fecha_programada,hora_inicio,estado',estado:'in.(pendiente,en_proceso)',order:'fecha_programada.asc.nullslast,hora_inicio.asc.nullslast,numero_orden.asc',limit:'11'});
 if(tipo==='hoy'||tipo==='manana')q.set('fecha_programada','eq.'+(tipo==='hoy'?local.dia:manana.toISOString().slice(0,10)));
 else if(tipo==='agenda')q.set('fecha_programada','gte.'+local.dia);
 else if(tipo==='pendientes')q.set('estado','eq.pendiente');
 else if(tipo==='proximo'){
   q.set('or','(fecha_programada.gt.'+local.dia+',and(fecha_programada.eq.'+local.dia+',hora_inicio.gte.'+local.hora+'))');
   q.set('limit','1');
 }else throw Error('unsupported query');
 return q;
}
export function respuestaAgenda(tipo,rows){
 const label={agenda:'Próximos turnos agendados desde hoy',hoy:'Trabajos de hoy',manana:'Trabajos de mañana',pendientes:'Trabajos pendientes',proximo:'Próximo trabajo'}[tipo];
 if(!Array.isArray(rows)||!label)throw Error('bad result');
 if(rows.length===0)return label+': no hay registros activos en el CRM para esta consulta. Si falta cargar un trabajo, no va a aparecer acá.';
 const lines=rows.slice(0,10).map(o=>{
  const dia=String(o.fecha_programada||'').match(/^\d{4}-\d{2}-\d{2}$/)?o.fecha_programada.split('-').reverse().join('/'):'Sin fecha';
  const hora=String(o.hora_inicio||'').match(/^\d{2}:\d{2}/)?o.hora_inicio.slice(0,5):'Sin horario';
  const titulo=String(o.titulo||'Trabajo sin título').replace(/[\r\n\t\u0000-\u001f]/g,' ').slice(0,120);
  return dia+' '+hora+' · #'+String(o.numero_orden)+' · '+titulo+' ('+(o.estado==='en_proceso'?'en proceso':'pendiente')+')';
 });
 return label+' — CRM La Solución:\n'+lines.join('\n')+(rows.length>10?'\nHay más resultados. Consultá el CRM.':'');
}
