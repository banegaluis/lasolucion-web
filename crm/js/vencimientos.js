(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const core=window.VencimientosCore;
 const svc=window.VencimientosService;
 let datos={vencimientos:[],clientes:[],avisos:[],renovaciones:[]};
 let editando=null;
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function hoyLocal(){
   const d=new Date();
   return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 }
 function nombreCliente(c){return c?.nombre_completo||[c?.nombre,c?.apellido].filter(Boolean).join(' ')||'Cliente no disponible';}
 function mensaje(s='',error=false){
   $('vEstado').textContent=s;
   $('vEstado').style.color=error?'#ff9292':'var(--color-primary,#f5c518)';
 }
 function obtener(id){return datos.vencimientos.find(v=>v.id===id);}
 function cliente(id){return datos.clientes.find(c=>c.id===id);}
 function controles(){
   $('vNuevo').addEventListener('click',()=>abrirEditor());
   $('vCancelar').addEventListener('click',cerrarEditor);
   $('vAutorizado').addEventListener('change',()=>{
     $('vFuente').disabled=!$('vAutorizado').checked;
     if(!$('vAutorizado').checked)$('vFuente').value='';
   });
   $('vForm').addEventListener('submit',guardar);
   $('vBuscar').addEventListener('input',dibujar);
   $('vListado').addEventListener('click',accion);
 }
 function abrirEditor(v=null){
   editando=v;
   $('vEditor').hidden=false;
   $('vForm').reset();
   $('vTituloEditor').textContent=v?'Editar vencimiento':'Nuevo vencimiento';
   $('vCliente').value=v?.cliente_id||'';
   $('vTitulo').value=v?.titulo||'Renovación de certificado de gas';
   $('vFecha').value=v?.fecha_vencimiento||'';
   $('vPeriodicidad').value=v?.periodicidad_meses==null?'':String(v.periodicidad_meses);
   if(!v)$('vPeriodicidad').value='12';
   $('vDetalle').value=v?.detalle||'';
   $('vActivo').checked=v?.activo??true;
   $('vAutorizado').checked=!!v?.whatsapp_autorizado;
   $('vFuente').disabled=!$('vAutorizado').checked;
   $('vFuente').value=v?.whatsapp_autorizacion_fuente||'';
   for(const cb of document.querySelectorAll('input[name="vDias"]'))cb.checked=v? (v.avisos_dias||[]).includes(Number(cb.value)):true;
   $('vEditor').scrollIntoView({behavior:'smooth',block:'start'});
 }
 function cerrarEditor(){$('vEditor').hidden=true;editando=null;}
 function payload(){
   return {cliente_id:$('vCliente').value,titulo:$('vTitulo').value,fecha_vencimiento:$('vFecha').value,
    periodicidad_meses:$('vPeriodicidad').value?Number($('vPeriodicidad').value):null,
    detalle:$('vDetalle').value,activo:$('vActivo').checked,
    avisos_dias:[...document.querySelectorAll('input[name="vDias"]:checked')].map(e=>Number(e.value)),
    whatsapp_autorizado:$('vAutorizado').checked,whatsapp_autorizacion_fuente:$('vFuente').value};
 }
 async function guardar(e){
   e.preventDefault();
   const boton=e.submitter||$('vForm').querySelector('button[type=submit]');
   boton.disabled=true;
   try{
     await svc.guardar(payload(),editando);
     cerrarEditor();await cargar();
     mensaje('Vencimiento guardado en Supabase.');
   }catch(err){mensaje(err.message||String(err),true);}
   finally{boton.disabled=false;}
 }
 async function cargar(){
   datos=await svc.cargar();
   $('vCliente').innerHTML='<option value="">Seleccionar cliente…</option>'+datos.clientes.map(c=>
      '<option value="'+esc(c.id)+'">'+esc(nombreCliente(c))+'</option>').join('');
   dibujar();
   historial();
 }
 function dibujar(){
   const hoy=hoyLocal();
   const activos=datos.vencimientos.filter(v=>v.activo);
   $('vActivos').textContent=activos.length;
   $('vProximos').textContent=activos.filter(v=>{const n=core.diferenciaDias(v.fecha_vencimiento,hoy);return n>=0&&n<=30;}).length;
   $('vVencidos').textContent=activos.filter(v=>core.diferenciaDias(v.fecha_vencimiento,hoy)<0).length;
   $('vContactos').textContent=datos.avisos.filter(a=>a.resultado==='contacto_declarado'||a.resultado==='enviado').length;
   const q=$('vBuscar').value.trim().toLowerCase();
   const filas=datos.vencimientos.filter(v=>[v.titulo,v.detalle,nombreCliente(cliente(v.cliente_id))].join(' ').toLowerCase().includes(q));
   $('vListado').innerHTML=filas.length?filas.map(v=>{
      const c=cliente(v.cliente_id),diff=core.diferenciaDias(v.fecha_vencimiento,hoy);
      const proximo=v.activo&&diff>=0&&diff<=30, vencido=v.activo&&diff<0;
      const clase=v.activo?(vencido?'v-vencido':proximo?'v-proximo':''):'v-inactivo';
      const textoEstado=!v.activo?'Pausado':vencido?'Fecha vencida hace '+Math.abs(diff)+' días':diff===0?'Fecha de hoy':diff+' días restantes';
      const dias=core.proximos(v,hoy);
      const avisosProgramados=dias.map(a=>core.formatearFecha(a.fecha)+' ('+(a.dias_antes===0?'mismo día':a.dias_antes+' días antes')+')').join(' · ')||'Sin avisos';
      const disponibles=dias.filter(a=>a.pendiente&&!datos.avisos.some(x=>x.vencimiento_id===v.id&&x.fecha_vencimiento===v.fecha_vencimiento&&x.dias_antes===a.dias_antes));
      const habilitado=!!v.activo&&!!v.whatsapp_autorizado&&!!core.normalizarTelefono(c?.telefono_principal);
      return '<article class="v-item '+clase+'"><h3>'+esc(v.titulo)+'</h3>'+
        '<p><strong>'+esc(nombreCliente(c))+'</strong> · '+esc(c?.telefono_principal||'Sin teléfono')+'</p>'+
        '<p class="v-meta">'+esc(core.formatearFecha(v.fecha_vencimiento))+' — '+esc(textoEstado)+'</p>'+
        '<p>Repetición: '+esc(v.periodicidad_meses?('cada '+v.periodicidad_meses+' meses'):'sin repetición')+'</p>'+
        '<p>Avisos previstos: '+esc(avisosProgramados)+'</p>'+
        '<p>WhatsApp: '+(v.whatsapp_autorizado?'consentimiento declarado':'sin consentimiento registrado')+'</p>'+
        (v.detalle?'<p>'+esc(v.detalle)+'</p>':'')+
        '<div class="v-acciones">'+
          '<button type="button" class="role-action-button" data-action="editar" data-id="'+esc(v.id)+'">Editar</button>'+
          (v.periodicidad_meses?'<button type="button" class="role-action-button" data-action="renovar" data-id="'+esc(v.id)+'">Registrar renovación</button>':'')+
          '<button type="button" class="role-action-button" data-action="activar" data-id="'+esc(v.id)+'">'+(v.activo?'Pausar':'Reactivar')+'</button>'+
          '<button type="button" class="role-action-button" data-action="chat" data-id="'+esc(v.id)+'" '+(habilitado?'':'disabled')+'>Abrir WhatsApp</button>'+
          disponibles.map(a=>'<button type="button" class="role-action-button" data-action="contacto" data-id="'+esc(v.id)+'" data-dias="'+a.dias_antes+'" '+(habilitado?'':'disabled')+'>Registrar contacto ('+a.dias_antes+' d)</button>').join('')+
        '</div></article>';
   }).join(''):'<p>No hay vencimientos para mostrar. Agregá uno desde el botón superior.</p>';
 }
 function historial(){
   const vs=new Map(datos.vencimientos.map(v=>[v.id,v]));
   const eventos=[
     ...datos.renovaciones.map(x=>({fecha:x.registrado_en,texto:'Renovación registrada · '+core.formatearFecha(x.fecha_anterior)+' → '+core.formatearFecha(x.fecha_nueva),id:x.vencimiento_id})),
     ...datos.avisos.map(x=>({fecha:x.registrado_en,texto:(x.canal==='manual_whatsapp'?'Contacto manual declarado':'WhatsApp API: '+x.resultado)+' · '+x.dias_antes+' días antes · vencimiento '+core.formatearFecha(x.fecha_vencimiento),id:x.vencimiento_id}))
   ].sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,100);
   $('vHistorial').innerHTML=eventos.length?eventos.map(x=>'<div class="v-evento"><strong>'+esc(vs.get(x.id)?.titulo||'Vencimiento')+'</strong> · '+esc(x.texto)+' <small>'+esc(new Date(x.fecha).toLocaleString('es-AR'))+'</small></div>').join(''):'<p class="v-ayuda">Sin renovaciones ni contactos registrados.</p>';
 }
 async function accion(e){
   const b=e.target.closest('button[data-action]');if(!b||b.disabled)return;
   const v=obtener(b.dataset.id);if(!v)return;
   const c=cliente(v.cliente_id),hoy=hoyLocal(),action=b.dataset.action;
   try{
     if(action==='editar'){abrirEditor(v);return;}
     if(action==='chat'){
       if(!v.whatsapp_autorizado)throw Error('Falta registrar el consentimiento.');
       const numero=core.normalizarTelefono(c?.telefono_principal);
       if(!numero)throw Error('El cliente no tiene un número válido.');
       const url='https://wa.me/'+numero+'?text='+encodeURIComponent(core.mensaje(v,c));
       window.open(url,'_blank','noopener,noreferrer');
       mensaje('Se abrió WhatsApp. El mensaje NO se envió automáticamente.');
       return;
     }
     if(action==='activar'){
       if(!confirm(v.activo?'¿Pausar este seguimiento y sus avisos?':'¿Reactivar este seguimiento?'))return;
       await svc.guardar({...v,activo:!v.activo},v);
     }
     if(action==='renovar'){
       const sugerida=core.sumarMeses(v.fecha_vencimiento,v.periodicidad_meses);
       const nueva=prompt('Ingresá la NUEVA fecha confirmada. No registramos renovaciones automáticamente (AAAA-MM-DD):',sugerida);
       if(nueva===null)return;
       core.fechaUTC(nueva);
       if(!confirm('¿Confirmás que la nueva fecha registrada es '+core.formatearFecha(nueva)+'?'))return;
       await svc.renovar(v,nueva);
     }
     if(action==='contacto'){
       const offset=Number(b.dataset.dias);
       if(core.diferenciaDias(v.fecha_vencimiento,hoy)!==offset)throw Error('Este aviso no corresponde a la fecha de hoy.');
       if(!confirm('¿Ya enviaste el mensaje realmente? Esto dejará constancia MANUAL, no confirmación de entrega de WhatsApp.'))return;
       await svc.declararContacto(v,offset);
     }
     await cargar();
     mensaje('Cambio guardado correctamente en Supabase.');
   }catch(err){mensaje(err.message||String(err),true);}
 }
 document.addEventListener('DOMContentLoaded',async()=>{
   controles();
   try{
     await svc.conexion();
     $('vNuevo').hidden=false;$('vPanel').hidden=false;
     await cargar();
     mensaje('Listo. El registro de vencimientos está disponible; WhatsApp automático pendiente.');
   }catch(err){mensaje('No se pudo abrir el módulo: '+(err.message||String(err)),true);}
 });
})();