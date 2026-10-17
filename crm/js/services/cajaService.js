(function(){
 'use strict';
 async function client(){
  const sesion=await window.AuthSupabaseService.verificarSesionOperativa();
  if(!sesion.ok||sesion.perfil?.rol!=='admin') throw Error('Caja requiere una sesión de administrador activo.');
  return window.LaSolucionSupabase.getClient();
 }
 async function listar(){
  const c=await client(), filas=[];
  for(let desde=0;;desde+=1000){
   const {data,error}=await c.from('caja_movimientos').select('*').order('created_at').order('id').range(desde,desde+999);
   if(error) throw error;
   filas.push(...data); if(data.length<1000) return filas;
  }
 }
 async function guardar(m){
  const c=await client();
  // Una misma confirmación conserva su UUID al reintentar una respuesta de red perdida.
  const previo=await c.from('caja_movimientos').select('id').eq('id',m.id).maybeSingle();
  if(previo.error) throw previo.error;
  if(previo.data) return previo.data;
  const {data,error}=await c.from('caja_movimientos').insert(m).select('id').single();
  if(error) throw error; return data;
 }
 async function referencias(){
  const c=await client();
  async function todas(tabla,campos){
   const filas=[];
   for(let n=0;;n+=1000){const {data,error}=await c.from(tabla).select(campos).order('id').range(n,n+999);if(error)throw error;filas.push(...data);if(data.length<1000)return filas;}
  }
  const [clientes,ordenes]=await Promise.all([todas('clientes','id,nombre_completo,nombre,apellido,telefono_principal'),todas('ordenes','id,cliente_id,numero_orden,titulo')]);
  return {clientes,ordenes};
 }
 window.CajaService=Object.freeze({listar,guardar,referencias});
})();
