(function(){
 'use strict';
 const $=id=>document.getElementById(id),core=window.BotAccesosCore,svc=window.BotAccesosService;
 let datos={accesos:[],personas:[]},editando=null,borrador=null,ocupado=false;
 const estado=s=>$('estadoBot').textContent=s;
 const persona=id=>datos.personas.find(p=>p.id===id);
 const nombre=p=>p?[p.nombre,p.apellido].filter(Boolean).join(' '):'Persona no disponible';
 const etiquetas=ps=>(ps||[]).map(p=>core.permisos[p]||p).join(', ')||'Sin permisos';
 const fecha=s=>new Date(s).toLocaleString('es-AR');
 function texto(parent,s){const p=document.createElement('p');p.textContent=s;parent.append(p);return p;}
 function boton(parent,s,fn){const b=document.createElement('button');b.type='button';b.className='role-action-button';b.textContent=s;b.onclick=fn;b.disabled=ocupado;parent.append(b);}
 function cerrar(){$('formBot').hidden=true;$('confirmarPanel').hidden=true;$('camposBot').disabled=false;editando=null;borrador=null;}
 function editar(a){if(ocupado)return;cerrar();editando=a?{...a}:null;$('formBot').reset();$('formBot').hidden=false;$('tituloBot').textContent=a?'Editar acceso':'Agregar número';$('numeroBot').value=a?.numero||'';$('activoBot').checked=a?.activo||false;
  $('personaBot').replaceChildren(new Option('Seleccionar persona',''));
  datos.personas.filter(p=>(p.activo&&p.estado==='activo'&&['admin','colaborador','tecnico'].includes(p.rol))||p.id===a?.perfil_id).forEach(p=>$('personaBot').add(new Option(`${nombre(p)} · ${p.rol}${p.activo?'':' · inactivo'}`,p.id)));
  $('personaBot').value=a?.perfil_id||'';mostrarRol();
  $('permisosBot').querySelectorAll('input').forEach(i=>i.checked=(a?.permisos||[]).includes(i.value));$('numeroBot').focus();
 }
 function mostrarRol(){const p=persona($('personaBot').value);$('rolBot').textContent=p?`Vinculado a ${nombre(p)} (${p.rol}). El rol se obtiene del CRM.`:'';}
 function confirmar(d){borrador=d;$('camposBot').disabled=true;$('confirmarPanel').hidden=false;$('detalleBot').textContent=`${d.numero}\n${nombre(persona(d.perfil_id))}\n${d.activo?'HABILITADO':'DESHABILITADO'}\n${etiquetas(d.permisos)}\n${editando?'Este cambio invalida la versión anterior de permisos.':''}`;$('guardarBot').focus();}
 async function registros(){const id=$('filtroBot').value;const [h,a]=await Promise.all([svc.historial(id),svc.actividad(id)]);$('historialBot').replaceChildren();h.forEach(e=>{const anterior=e.antes,nuevo=e.despues;texto($('historialBot'),`${fecha(e.fecha)} · ${e.administrador_nombre}\n${e.persona_nombre} (${e.persona_rol}) · ${nuevo.numero}\n${anterior?'Cambio':'Alta'}: ${nuevo.activo?'habilitado':'deshabilitado'} · versión ${nuevo.version}\nAntes: ${anterior?`${anterior.numero} · ${anterior.activo?'habilitado':'deshabilitado'} · ${etiquetas(anterior.permisos)}`:'Sin acceso'}\nDespués: ${etiquetas(nuevo.permisos)}`);});if(!h.length)texto($('historialBot'),'Todavía no hay cambios registrados.');$('actividadBot').replaceChildren();a.forEach(e=>texto($('actividadBot'),`${fecha(e.fecha)} · ${e.persona_nombre} (${e.persona_rol}) · ${e.numero}\n${e.accion} · ${e.resultado}${e.movimiento_id?' · Movimiento '+e.movimiento_id:''}`));if(!a.length)texto($('actividadBot'),'Sin operaciones registradas. La conexión del bot está pendiente.');}
 async function cargar(){datos=await svc.cargar();$('listaAccesos').replaceChildren();const filtro=$('filtroBot').value;$('filtroBot').replaceChildren(new Option('Todos',''));
  datos.accesos.forEach(a=>{const p=persona(a.perfil_id),card=document.createElement('div');card.className='caja-movimiento';texto(card,`${a.numero} · ${nombre(p)} · ${p?.rol||''}\n${a.activo?'Habilitado':'Deshabilitado'}${!p?.activo||p?.estado!=='activo'?' · Perfil inactivo: acceso bloqueado':''}\n${etiquetas(a.permisos)}`);boton(card,'Editar permisos',()=>editar(a));if(a.activo)boton(card,'Revocar acceso',()=>{editar(a);$('activoBot').checked=false;confirmar({numero:a.numero,perfil_id:a.perfil_id,activo:false,permisos:a.permisos});});$('listaAccesos').append(card);$('filtroBot').add(new Option(`${a.numero} · ${nombre(p)}`,a.id));});
  if(!datos.accesos.length)texto($('listaAccesos'),'No hay números autorizados. Agregá una persona para empezar.');if(datos.accesos.some(a=>a.id===filtro))$('filtroBot').value=filtro;await registros();
 }
 document.addEventListener('DOMContentLoaded',async()=>{
  for(const [k,v] of Object.entries(core.permisos)){const label=document.createElement('label');label.className='bot-permiso';const i=document.createElement('input');i.type='checkbox';i.value=k;label.append(i,document.createTextNode(v));$('permisosBot').append(label);}
  try{await cargar();$('botPanel').hidden=false;estado('Configuración disponible solo para administradores.');}catch(e){estado('No se pudo abrir el panel: '+e.message);return;}
  $('nuevoAcceso').onclick=()=>editar();$('personaBot').onchange=mostrarRol;$('cancelarBot').onclick=()=>{if(!ocupado)cerrar();};$('volverBot').onclick=()=>{if(ocupado)return;borrador=null;$('camposBot').disabled=false;$('confirmarPanel').hidden=true;};
  $('actualizarBot').onclick=async()=>{if(ocupado)return;try{cerrar();await cargar();estado('Lista actualizada.');}catch(e){estado(e.message);}};
  $('filtroBot').onchange=()=>registros().catch(e=>estado(e.message));
  $('formBot').onsubmit=e=>{e.preventDefault();try{const d={numero:core.numero($('numeroBot').value),perfil_id:$('personaBot').value,activo:$('activoBot').checked,permisos:[...$('permisosBot').querySelectorAll('input:checked')].map(i=>i.value)};core.validar(d);confirmar(d);}catch(e){estado(e.message);}};
  $('guardarBot').onclick=async()=>{if(!borrador||ocupado)return;ocupado=true;$('guardarBot').disabled=true;$('volverBot').disabled=true;try{await svc.guardar(borrador,editando?.id,editando?.version);cerrar();estado('Permisos guardados y cambio registrado en el historial.');try{await cargar();}catch(e){estado('Guardado confirmado. Actualizá para recargar la lista.');}}catch(e){estado('No se confirmó el cambio: '+e.message+' Si hubo un problema de red, actualizá la lista antes de volver a guardar.');}finally{ocupado=false;$('guardarBot').disabled=false;$('volverBot').disabled=false;$('listaAccesos').querySelectorAll('button').forEach(b=>b.disabled=false);}};
 });
})();
