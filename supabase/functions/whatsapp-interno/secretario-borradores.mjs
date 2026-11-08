// Laso — interpretación preliminar SIN efectos laterales ni datos externos.
// No sustituye a un motor conversacional ni habilita acciones automáticas.
const MAX_TEXTO=2000;
const RE_FECHA=/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/;
const RE_HORA=/\b([01]?\d|2[0-3]):([0-5]\d)\b/;

function fechaValida(d,m,a){
 const fecha=new Date(Date.UTC(a,m-1,d));
 return fecha.getUTCFullYear()===a&&fecha.getUTCMonth()===m-1&&fecha.getUTCDate()===d;
}
export function interpretarSolicitudInterna(texto){
 if(typeof texto!=='string'||!texto.trim()||texto.length>MAX_TEXTO)
  return {valido:false,motivo:'texto_vacio_o_excesivo',accion:'ninguna',requiere_confirmacion:true};
 const original=texto.trim();
 // Solo se permite preparar borradores, jamás ejecutar una instrucción recibida.
 const tipo=/^(?:agend[áa]|agenda|agendar|turno|program[áa]|programar|nueva orden)(?=\s|$|[.,;:])/i.test(original)
   ?'agenda':/^(?:presupuest[áa]|presupuestar|presupuesto|cotiz[áa]|cotizar)(?=\s|$|[.,;:])/i.test(original)
   ?'presupuesto':/^(?:record[áa]|recordar|recordatorio)(?=\s|$|[.,;:])/i.test(original)
   ?'recordatorio':'nota';
 let fecha=null, hora=null;
 const fechaMatch=original.match(RE_FECHA);
 if(fechaMatch){
  const [,dia,mes,anio]=fechaMatch.map(String);
  const d=Number(dia),m=Number(mes),a=Number(anio);
  if(fechaValida(d,m,a))fecha=`${anio}-${mes.padStart(2,'0')}-${dia.padStart(2,'0')}`;
 }
 const horaMatch=original.match(RE_HORA);
 if(horaMatch)hora=`${horaMatch[1].padStart(2,'0')}:${horaMatch[2]}`;
 const faltantes=[];
 if((tipo==='agenda'||tipo==='recordatorio')&&!fecha)faltantes.push('fecha_explicita');
 if((tipo==='agenda'||tipo==='recordatorio')&&!hora)faltantes.push('hora_explicita');
 if(tipo==='agenda'&&!/\b(?:cliente|para|en|direcci[oó]n)(?=\s|$|[.,;:])/i.test(original))faltantes.push('cliente_o_ubicacion');
 return {
  valido:true,
  accion:'preparar_borrador',
  tipo, texto_original:original,
  fecha, hora, faltantes,
  requiere_confirmacion:true,
  puede_ejecutar:false,
  puede_enviar:false
 };
}
