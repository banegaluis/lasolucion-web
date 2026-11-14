(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 function estado(mensaje,error=false){
   $('botEstado').textContent=mensaje;
   $('botEstado').style.color=error?'#ff9999':'#f5c518';
 }
 function elemento(etiqueta,texto,clase){
   const el=document.createElement(etiqueta);
   el.textContent=String(texto??'');
   if(clase)el.className=clase;
   return el;
 }
 async function verificar(){
   const s=await window.AuthSupabaseService?.verificarSesionOperativa?.();
   if(!s?.ok||s.perfil?.rol!=='admin')throw Error('Esta bandeja es exclusiva del administrador activo.');
   const db=await window.LaSolucionSupabase?.getClient?.();
   if(!db)throw Error('La conexión segura de Supabase no está disponible.');
   return db;
 }
 async function cargar(){
   $('botRefrescar').disabled=true;estado('Consultando mensajes internos…');
   try{
     const db=await verificar();
     const {data,error}=await db.from('bot_borradores')
       .select('evento_id,numero,tipo,texto,estado,recibido_en,perfil_id,version_acceso')
       .order('recibido_en',{ascending:false}).limit(100);
     if(error)throw error;
     const lista=$('botEntradas');
     lista.replaceChildren();
     if(!data?.length)lista.append(elemento('p','No hay mensajes de prueba registrados.', 'bot-muted'));
     for(const item of data||[]){
       const card=elemento('article','','bot-row');
       card.append(elemento('strong',item.tipo==='audio'?'Audio sin transcribir':'Texto para revisar'));
       card.append(elemento('p',item.tipo==='audio'?
         'Audio identificado. No se descargó, no se transcribió y no se creó ningún turno.':
         item.texto||'(sin texto)'));
       card.append(elemento('small',item.numero+' · '+new Date(item.recibido_en).toLocaleString('es-AR')+
         ' · '+item.estado+' · acceso v'+item.version_acceso));
       lista.append(card);
     }
     estado((data||[]).length+' mensajes de prueba consultados. Sin respuestas ni órdenes creadas.');
   }catch(e){estado('No fue posible consultar la bandeja: '+(e.message||String(e)),true);}
   finally{$('botRefrescar').disabled=false;}
 }
 document.addEventListener('DOMContentLoaded',async()=>{
   try{await verificar();$('botRefrescar').hidden=false;$('botRefrescar').addEventListener('click',cargar);await cargar();}
   catch(e){estado('Acceso restringido: '+(e.message||String(e)),true);}
 });
})();