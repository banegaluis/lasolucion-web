(function(root) {
 'use strict';
 const normal = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 function monto(s) {
  const t=String(s).trim();
  if (!/^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(t)) return null;
  const n=Number(t.replace(/\./g,'').replace(',','.'));
  return Number.isFinite(n)&&n>0 ? Math.round(n*100)/100 : null;
 }
 function interpretar(texto) {
  const t=normal(texto), avisos=[];
  const tipos=[['cobro',/\b(cobre|cobrado|me pago|me pagaron|entraron)\b/],['gasto',/\b(gaste|pague|compre)\b/],['por_cobrar',/\b(me debe|me deben|por cobrar)\b/],['retiro',/\b(retire|retiro|saque para mi)\b/],['aporte',/\b(aporte|puse de mi plata)\b/],['transferencia',/\b(transferi|pase|movi)\b/]].filter(([,r])=>r.test(t));
  if (/\b(no|todavia|quizas|tal vez)\b/.test(t)) return {tipo:'',monto:null,cuenta:'',descripcion:texto,avisos:['La frase contiene una negación o duda. Completá los campos manualmente.']};
  const importes=[...t.matchAll(/\b(\d+(?:\.\d{3})*(?:,\d{1,2})?)\s*(mil\b|millones?\b|pesos\b|\$)/g)];
  let valor=null;
  if(importes.length===1) valor=monto(importes[0][1]) * (/^mil$/.test(importes[0][2])?1000:/^millon/.test(importes[0][2])?1000000:1);
  if(importes.length!==1) avisos.push('Escribí el importe completo en pesos. No se interpretan números sin unidad ni varios importes juntos.');
  if(tipos.length!==1) avisos.push('Elegí el tipo. Si hay varias operaciones, cargalas una por una.');
  if(/\b(ayer|anteayer|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b|\d+[/\-]\d+/.test(t)) avisos.push('Revisá la fecha: el formulario inicia con la fecha de hoy.');
  const cuentas=[['efectivo',/\befectivo\b/],['banco',/\b(banco|transferencia bancaria)\b/],['billetera',/\b(billetera|mercado pago)\b/]].filter(([,r])=>r.test(t));
  return {tipo:tipos.length===1?tipos[0][0]:'',monto:tipos.length===1?valor:null,cuenta:cuentas.length===1?cuentas[0][0]:'',descripcion:texto,avisos};
 }
 function resumir(rows,desde,hasta) {
  const r={cobro:0,gasto:0,retiro:0,aporte:0,transferencia:0,pendiente:0,flujo:0};
  for(const m of rows) {
   if(m.fecha>=desde&&m.fecha<=hasta&&m.tipo!=='por_cobrar') r[m.tipo]+=Math.round(Number(m.monto)*100);
   if(m.tipo==='por_cobrar') r.pendiente+=Math.round(Number(m.monto)*100)-rows.filter(c=>c.deuda_id===m.id).reduce((s,c)=>s+Math.round(Number(c.monto)*100),0);
  }
  r.flujo=r.cobro+r.aporte-r.gasto-r.retiro;
  for(const k in r) r[k]/=100;
  return r;
 }
 const api={monto,interpretar,resumir};
 if(typeof module!=='undefined') module.exports=api; else root.CajaCore=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
