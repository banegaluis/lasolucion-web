(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  if(root)root.VencimientosCore=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 function fechaUTC(valor){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(String(valor||'')))throw Error('Fecha inválida.');
   const [a,m,d]=valor.split('-').map(Number);
   const fecha=new Date(Date.UTC(a,m-1,d));
   if(fecha.getUTCFullYear()!==a||fecha.getUTCMonth()!==m-1||fecha.getUTCDate()!==d)throw Error('Fecha inexistente.');
   return fecha;
 }
 function iso(fecha){return fecha.toISOString().slice(0,10);}
 function sumarMeses(valor,meses){
   const f=fechaUTC(valor);
   if(!Number.isInteger(meses)||meses<1||meses>120)throw Error('Periodicidad inválida.');
   const inicio=new Date(Date.UTC(f.getUTCFullYear(),f.getUTCMonth()+meses,1));
   const ultimo=new Date(Date.UTC(inicio.getUTCFullYear(),inicio.getUTCMonth()+1,0)).getUTCDate();
   inicio.setUTCDate(Math.min(f.getUTCDate(),ultimo));
   return iso(inicio);
 }
 function diferenciaDias(fecha,referencia){
   return Math.round((fechaUTC(fecha)-fechaUTC(referencia))/86400000);
 }
 function formatearFecha(fecha){
   return fechaUTC(fecha).toLocaleDateString('es-AR',{timeZone:'UTC',day:'2-digit',month:'2-digit',year:'numeric'});
 }
 function diasAviso(valores){
   const lista=[...new Set((valores||[]).map(Number))];
   if(lista.some(n=>![0,7,30].includes(n)))throw Error('Anticipación no permitida.');
   return lista.sort((a,b)=>b-a);
 }
 function normalizarTelefono(t){
   const digitos=String(t||'').replace(/\D/g,'');
   if(digitos.length<10||digitos.length>15)return null;
   return digitos;
 }
 function mensaje(v,cliente){
   const nombre=String(cliente?.nombre_completo||[cliente?.nombre,cliente?.apellido].filter(Boolean).join(' ')||'').trim();
   const saludo=nombre?'Hola, '+nombre+'.':'Hola.';
   return saludo+' Te contactamos de La Solución porque tenemos registrada una próxima fecha de '+String(v.titulo).trim().toLowerCase()+
   ' para el '+formatearFecha(v.fecha_vencimiento)+'. ¿Querés que coordinemos una visita?';
 }
 function proximos(v,hoy){
   if(!v.activo)return [];
   const diff=diferenciaDias(v.fecha_vencimiento,hoy);
   return diasAviso(v.avisos_dias).map(d=>({dias_antes:d,fecha:iso(new Date(fechaUTC(v.fecha_vencimiento).getTime()-d*86400000)),pendiente:diff===d}));
 }
 return Object.freeze({fechaUTC,iso,sumarMeses,diferenciaDias,formatearFecha,diasAviso,normalizarTelefono,mensaje,proximos});
});
