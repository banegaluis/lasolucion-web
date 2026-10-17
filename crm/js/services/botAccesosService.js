(function(){
 'use strict';
 async function client(){const s=await window.AuthSupabaseService.verificarSesionOperativa();if(!s.ok||s.perfil?.rol!=='admin')throw Error('Solo un administrador activo puede abrir este panel.');return window.LaSolucionSupabase.getClient();}
 async function listar(tabla,columnas){const c=await client(),rows=[];for(let n=0;;n+=1000){const {data,error}=await c.from(tabla).select(columnas).order('id').range(n,n+999);if(error)throw error;rows.push(...data);if(data.length<1000)return rows;}}
 async function cargar(){const [accesos,personas]=await Promise.all([listar('bot_accesos','*'),listar('perfiles','id,nombre,apellido,rol,activo,estado')]);return {accesos,personas};}
 async function guardar(d,id,version){window.BotAccesosCore.validar(d);const c=await client();const q=id?c.from('bot_accesos').update(d).eq('id',id).eq('version',version):c.from('bot_accesos').insert(d);const {data,error}=await q.select().maybeSingle();if(error)throw error;if(!data)throw Error('Otro administrador cambió este acceso. Actualizá la lista antes de editar.');return data;}
 async function historial(id){const c=await client();let q=c.from('bot_accesos_historial').select('*').order('id',{ascending:false}).limit(100);if(id)q=q.eq('acceso_id',id);const {data,error}=await q;if(error)throw error;return data;}
 async function actividad(id){const c=await client();let q=c.from('bot_actividad').select('*').order('fecha',{ascending:false}).limit(100);if(id)q=q.eq('acceso_id',id);const {data,error}=await q;if(error)throw error;return data;}
 window.BotAccesosService=Object.freeze({cargar,guardar,historial,actividad});
})();
