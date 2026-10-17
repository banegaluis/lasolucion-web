(function(root){
 'use strict';
 const permisos=Object.freeze({
  'gastos.registrar':'Registrar gastos', 'cobros.registrar':'Registrar cobros',
  'deudas.registrar':'Registrar saldos por cobrar', 'movimientos.ver_propios':'Consultar sus propios movimientos',
  'deudas.consultar':'Consultar todas las deudas de clientes', 'caja.consultar':'Consultar Caja y movimientos del negocio',
  'agenda.consultar':'Consultar agenda', 'agenda.registrar':'Registrar tareas en agenda'
 });
 function numero(value){const s=String(value||'').trim().replace(/[\s()-]/g,'');if(!/^\+[1-9]\d{7,14}$/.test(s))throw Error('Usá formato internacional con + y código de país. Ejemplo: +5493511234567.');return s;}
 function validar(d){numero(d.numero);if(!d.perfil_id)throw Error('Elegí una persona del CRM.');if(!Array.isArray(d.permisos)||d.permisos.some(p=>!Object.hasOwn(permisos,p)))throw Error('Permiso desconocido.');if(d.activo&&!d.permisos.length)throw Error('Elegí al menos un permiso o guardá el número deshabilitado.');return d;}
 const api={permisos,numero,validar};if(typeof module!=='undefined')module.exports=api;else root.BotAccesosCore=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
