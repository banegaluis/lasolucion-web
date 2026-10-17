(function(){
 'use strict';
 const $=id=>document.getElementById(id), core=window.CajaCore;
 const dinero=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(n);
 const hoy=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Argentina/Cordoba'}).format(new Date());
 let filas=[], refs={clientes:[],ordenes:[]}, pendiente=null, guardando=false, resultadoIncierto=false;
 function estado(t){$('estado').textContent=t;}
 function nombre(id){const c=refs.clientes.find(c=>c.id===id);return c?(c.nombre_completo||[c.nombre,c.apellido].filter(Boolean).join(' ')):'Sin cliente';}
 function opciones(id,items,label,vacio){const s=$(id);s.replaceChildren(new Option(vacio,''));items.forEach(i=>s.add(new Option(label(i),i.id)));}
 function saldo(d){return Math.round((Number(d.monto)-filas.filter(c=>c.deuda_id===d.id).reduce((s,c)=>s+Number(c.monto),0))*100)/100;}
 function ordenes(){opciones('orden_id',refs.ordenes.filter(o=>o.cliente_id===$('cliente_id').value),o=>`#${o.numero_orden} · ${o.titulo}`,'Sin orden');deudas();}
 function deudas(){opciones('deuda_id',filas.filter(d=>d.tipo==='por_cobrar'&&d.cliente_id===$('cliente_id').value&&saldo(d)>0),d=>`${d.descripcion} · ${dinero(saldo(d))}`,'Cobro sin saldo vinculado');}
 function tipo(){const t=$('tipo').value;$('destinoLabel').hidden=t!=='transferencia';$('cuenta_destino').required=t==='transferencia';$('deudaLabel').hidden=t!=='cobro';$('cliente_id').required=t==='por_cobrar';}
 function render(){
  const r=core.resumir(filas,$('desde').value,$('hasta').value);
  $('resumen').textContent=`Cobros: ${dinero(r.cobro)}\nGastos del negocio: ${dinero(r.gasto)}\nRetiros personales: ${dinero(r.retiro)}\nAportes personales: ${dinero(r.aporte)}\nFlujo del período: ${dinero(r.flujo)}\nPendiente por cobrar (todos los registros): ${dinero(r.pendiente)}`;
  $('pendientes').replaceChildren();
  filas.filter(d=>d.tipo==='por_cobrar'&&saldo(d)>0).forEach(d=>{
   const p=document.createElement('p');p.textContent=`${nombre(d.cliente_id)} · ${d.descripcion} · ${dinero(saldo(d))}`;
   const b=document.createElement('button');b.type='button';b.className='role-action-button';b.textContent='Registrar cobro';
   b.onclick=()=>{if(pendiente)return; $('tipo').value='cobro';tipo();$('cliente_id').value=d.cliente_id;ordenes();$('orden_id').value=d.orden_id||'';$('deuda_id').value=d.id;$('monto').value=String(saldo(d)).replace('.',',');$('descripcion').value=`Cobro: ${d.descripcion}`;$('fecha').value=hoy();$('cuenta').value='';$('movimientoForm').scrollIntoView({behavior:'smooth'});};
   p.append(b);$('pendientes').append(p);
  });
  if(!$('pendientes').children.length)$('pendientes').textContent='Sin saldos pendientes registrados.';
  $('movimientos').replaceChildren();
  filas.filter(m=>m.fecha>=$('desde').value&&m.fecha<=$('hasta').value).reverse().forEach(m=>{const p=document.createElement('p');p.className='caja-movimiento';p.textContent=`${m.fecha} · ${m.tipo.replace('_',' ')} · ${dinero(m.monto)}\n${m.descripcion} · ${nombre(m.cliente_id)} · ${m.cuenta}${m.cuenta_destino?' → '+m.cuenta_destino:''}`;$('movimientos').append(p);});
  if(!$('movimientos').children.length)$('movimientos').textContent='Sin movimientos en este período.';
 }
 async function actualizar(){filas=await window.CajaService.listar();render();deudas();}
 document.addEventListener('DOMContentLoaded',async()=>{
  try{
   refs=await window.CajaService.referencias();
   opciones('cliente_id',refs.clientes,c=>`${nombre(c.id)} · ${c.telefono_principal||'sin teléfono'}`,'Sin cliente');
   $('fecha').value=hoy();$('hasta').value=hoy();$('desde').value=hoy().slice(0,7)+'-01';
   await actualizar();$('contenidoCaja').hidden=false;estado('Caja conectada. Solo se guarda al confirmar.');
  }catch(e){estado('No se pudo abrir Caja: '+(e.message||e));return;}
  $('tipo').onchange=tipo;$('cliente_id').onchange=ordenes;
  $('deuda_id').onchange=()=>{const d=filas.find(m=>m.id===$('deuda_id').value);if(d)$('orden_id').value=d.orden_id||'';};
  $('desde').onchange=render;$('hasta').onchange=render;
  $('actualizar').onclick=async()=>{try{await actualizar();estado('Movimientos actualizados.');}catch(e){estado('No se pudo actualizar: '+e.message);}};
  $('interpretar').onclick=()=>{
   if(pendiente)return;
   const d=core.interpretar($('dictado').value);
   $('movimientoForm').reset();$('fecha').value=hoy();ordenes();
   for(const k of ['tipo','cuenta','descripcion'])$(k).value=d[k];
   $('monto').value=d.monto?String(d.monto).replace('.',','):'';tipo();
   $('avisos').textContent=[...d.avisos,'Elegí el cliente y la orden si corresponde; no se asignan nombres automáticamente.'].join(' ');
  };
  $('movimientoForm').onsubmit=e=>{
   e.preventDefault();if(pendiente)return;
   const monto=core.monto($('monto').value);
   if(!monto||monto>999999999999.99){estado('Ingresá un importe positivo en pesos, por ejemplo 25.000,50.');return;}
   const m={id:crypto.randomUUID(),monto};
   for(const k of ['tipo','fecha','cuenta','categoria','descripcion'])m[k]=$(k).value.trim();
   for(const k of ['cliente_id','orden_id'])m[k]=$(k).value||null;
   m.cuenta_destino=m.tipo==='transferencia'?$('cuenta_destino').value:null;
   m.deuda_id=m.tipo==='cobro'?$('deuda_id').value||null:null;
   if(!m.descripcion){estado('Completá la descripción.');return;}
   if(m.tipo==='transferencia'&&m.cuenta===m.cuenta_destino){estado('La cuenta de destino debe ser diferente.');return;}
   pendiente=m;$('camposCaja').disabled=true;$('interpretar').disabled=true;$('confirmacion').hidden=false;
   $('resumenConfirmacion').textContent=`${m.tipo.replace('_',' ')} · ${dinero(monto)} · ${m.fecha}\n${m.descripcion}\n${nombre(m.cliente_id)} · ${m.cuenta}${m.cuenta_destino?' → '+m.cuenta_destino:''}\n${m.deuda_id?'Descuenta un saldo pendiente.':'No descuenta saldos anteriores.'}`;
   $('guardar').focus();
  };
  function desbloquear(){pendiente=null;$('camposCaja').disabled=false;$('interpretar').disabled=false;$('confirmacion').hidden=true;}
  $('editar').onclick=()=>{if(!guardando&&!resultadoIncierto)desbloquear();};
  $('guardar').onclick=async()=>{
   if(!pendiente||guardando)return;guardando=true;$('guardar').disabled=true;$('editar').disabled=true;
   try{
    await window.CajaService.guardar(pendiente);
    resultadoIncierto=false;
    desbloquear();$('movimientoForm').reset();$('dictado').value='';$('fecha').value=hoy();tipo();ordenes();estado('Movimiento guardado en la nube.');
    try{await actualizar();}catch(e){estado('Movimiento guardado. No se pudo actualizar la lista; tocá Actualizar.');}
   }catch(e){resultadoIncierto=!/^[A-Z0-9]{5}$/.test(e.code||'');estado('No se confirmó el guardado. Conservamos el registro para reintentar sin duplicarlo. '+(resultadoIncierto?'Reintentá antes de editar: ':'Podés corregir los datos: ')+e.message);}
   finally{guardando=false;$('guardar').disabled=false;$('editar').disabled=resultadoIncierto;}
  };
 });
})();
