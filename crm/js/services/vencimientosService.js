(function(){
 'use strict';
 async function conexion(){
   const sesion=await window.AuthSupabaseService?.verificarSesionOperativa?.();
   if(!sesion?.ok||sesion.perfil?.rol!=='admin')throw Error('Acceso reservado a un administrador activo del CRM.');
   const db=await window.LaSolucionSupabase?.getClient?.();
   if(!db)throw Error('Supabase no está disponible.');
   return db;
 }
 async function cargar(){
   const db=await conexion();
   const [rv,rc,ra,rr]=await Promise.all([
     db.from('vencimientos').select('*').order('fecha_vencimiento',{ascending:true}).limit(1000),
     db.from('clientes').select('id,nombre,apellido,nombre_completo,telefono_principal,activo').eq('activo',true).order('nombre').limit(1000),
     db.from('vencimientos_avisos').select('*').order('registrado_en',{ascending:false}).limit(500),
     db.from('vencimientos_renovaciones').select('*').order('registrado_en',{ascending:false}).limit(500)
   ]);
   for(const r of [rv,rc,ra,rr])if(r.error)throw r.error;
   return {vencimientos:rv.data||[],clientes:rc.data||[],avisos:ra.data||[],renovaciones:rr.data||[]};
 }
 function datosPermitidos(v){
   const r={cliente_id:v.cliente_id,titulo:String(v.titulo||'').trim(),detalle:String(v.detalle||'').trim(),
     fecha_vencimiento:v.fecha_vencimiento,periodicidad_meses:v.periodicidad_meses,
     avisos_dias:window.VencimientosCore.diasAviso(v.avisos_dias),activo:!!v.activo,
     whatsapp_autorizado:!!v.whatsapp_autorizado,
     whatsapp_autorizacion_fuente:v.whatsapp_autorizado?String(v.whatsapp_autorizacion_fuente||'').trim():null};
   window.VencimientosCore.fechaUTC(r.fecha_vencimiento);
   if(!r.cliente_id||r.titulo.length<3||r.titulo.length>160)throw Error('Elegí el cliente e ingresá un título válido.');
   if(r.periodicidad_meses!==null&&(!Number.isInteger(r.periodicidad_meses)||r.periodicidad_meses<1||r.periodicidad_meses>120))throw Error('Periodicidad inválida.');
   if(r.whatsapp_autorizado&&r.whatsapp_autorizacion_fuente.length<5)throw Error('Especificá cómo y cuándo se obtuvo el consentimiento del cliente.');
   return r;
 }
 async function guardar(v,anterior){
   const db=await conexion();
   const datos=datosPermitidos(v);
   const q=anterior
    ?db.from('vencimientos').update(datos).eq('id',anterior.id).eq('updated_at',anterior.updated_at)
    :db.from('vencimientos').insert(datos);
   const {data,error}=await q.select('*').maybeSingle();
   if(error)throw error;
   if(!data)throw Error('Este vencimiento fue modificado por otra persona. Actualizá antes de guardar.');
   return data;
 }
 async function renovar(actual,nuevaFecha){
   const db=await conexion();
   window.VencimientosCore.fechaUTC(nuevaFecha);
   if(actual.fecha_vencimiento===nuevaFecha)throw Error('La nueva fecha debe ser diferente.');
   const {data,error}=await db.from('vencimientos')
     .update({fecha_vencimiento:nuevaFecha})
     .eq('id',actual.id).eq('updated_at',actual.updated_at).select('*').maybeSingle();
   if(error)throw error;
   if(!data)throw Error('Los datos cambiaron. Actualizá antes de registrar la renovación.');
   return data;
 }
 async function declararContacto(v,diasAntes){
   const db=await conexion();
   if(!v.activo||!v.whatsapp_autorizado||!v.avisos_dias.includes(diasAntes))
    throw Error('El registro no está activo o no tiene autorización para enviar avisos.');
   const {data,error}=await db.from('vencimientos_avisos').insert({
     vencimiento_id:v.id,fecha_vencimiento:v.fecha_vencimiento,dias_antes:diasAntes,
     canal:'manual_whatsapp',resultado:'contacto_declarado'
   }).select('*').single();
   if(error)throw error;
   return data;
 }
 window.VencimientosService=Object.freeze({conexion,cargar,guardar,renovar,declararContacto});
})();