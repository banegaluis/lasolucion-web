// Laso — interpretación preliminar sin efectos laterales ni datos externos.
// El resultado nunca habilita escrituras, mensajes salientes ni acciones autónomas.
const MAX_TEXTO = 2000;
const ZONA = 'America/Argentina/Cordoba';
const RE_FECHA = /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/;
const RE_HORA = /\b(\d+):(\d+)\b/g;
const RE_HORA_NATURAL = /\ba\s+las?\s+(\d+)\b|\b(\d+)\s*(?:hs?\.?|horas?)\b/gi;
const RE_RELATIVA = /(?:^|[\s(,;])(?:pasado\s+ma[ñn]ana|ma[ñn]ana|hoy)(?=$|[\s).,;:!?])/i;
const RE_AGENDA = /^(?:agend(?:a|á|ar|ame|áme)|agenda|turno|program(?:a|á|ar|ame|áme)|nueva orden)(?=\s|$|[.,;:])/i;
const RE_PRESUPUESTO = /^(?:presupuest(?:a|á|ar|ame|áme|o)|cotiz(?:a|á|ar|ame|áme))(?:\s|$|[.,;:])/i;
const RE_RECORDATORIO = /^(?:record(?:a|á|ar|ame|áme|atorio)|recu[eé]rdame)(?=\s|$|[.,;:])/i;

function fechaValida(d, m, a) {
  const fecha = new Date(Date.UTC(a, m - 1, d));
  return fecha.getUTCFullYear() === a && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
}
function isoFecha(a, m, d) {
  return String(a).padStart(4, '0') + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
function fechaLocalEnCordoba(ahora) {
  if (!(ahora instanceof Date) || !Number.isFinite(ahora.getTime())) return null;
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(ahora);
  const campos = Object.fromEntries(partes.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return { a: Number(campos.year), m: Number(campos.month), d: Number(campos.day) };
}
function sumarDias(fecha, cantidad) {
  const d = new Date(Date.UTC(fecha.a, fecha.m - 1, fecha.d + cantidad));
  return isoFecha(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
function leerFecha(texto, ahora) {
  const explicita = texto.match(RE_FECHA);
  if (explicita) {
    const d = Number(explicita[1]), m = Number(explicita[2]), a = Number(explicita[3]);
    return fechaValida(d, m, a)
      ? { fecha: isoFecha(a, m, d), origen_fecha: 'explicita' }
      : { fecha: null, origen_fecha: 'explicita_invalida' };
  }
  const relativa = texto.match(RE_RELATIVA);
  if (!relativa) return { fecha: null, origen_fecha: null };
  const local = fechaLocalEnCordoba(ahora);
  if (!local) return { fecha: null, origen_fecha: 'relativa_sin_referencia' };
  const palabra = relativa[0].trim().toLowerCase();
  const dias = palabra.startsWith('pasado') ? 2 : palabra === 'hoy' ? 0 : 1;
  return { fecha: sumarDias(local, dias), origen_fecha: 'relativa' };
}
function leerHora(texto) {
  const horas = [];
  // Consumir también horarios inválidos: nunca rescatar «10» de «10:75».
  for (const m of texto.matchAll(RE_HORA)) {
    if (m[1].length > 2 || m[2].length !== 2 || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
    horas.push(m[1].padStart(2, '0') + ':' + m[2]);
  }
  // Ocultar los horarios completos para no volver a leer su parte horaria.
  const sinExactas = texto.replace(RE_HORA, '');
  for (const m of sinExactas.matchAll(RE_HORA_NATURAL)) {
    const hora = m[1] ?? m[2];
    if (hora.length > 2 || Number(hora) > 23) return null;
    horas.push(hora.padStart(2, '0') + ':00');
  }
  const distintas = [...new Set(horas)];
  // Opciones y correcciones requieren aclaración, no elegir el primer horario.
  return distintas.length === 1 ? distintas[0] : null;
}

// El reloj se inyecta para no inventar qué significa «mañana» cuando falta contexto.
export function interpretarSolicitudInterna(texto, { ahora = null } = {}) {
  if (typeof texto !== 'string' || !texto.trim() || texto.length > MAX_TEXTO) {
    return { valido: false, motivo: 'texto_vacio_o_excesivo', accion: 'ninguna',
      requiere_confirmacion: true, puede_ejecutar: false, puede_enviar: false };
  }
  const original = texto.trim();
  // Nunca interpretar instrucciones incluidas en el mensaje como autorización.
  const tipo = RE_AGENDA.test(original) ? 'agenda'
    : RE_PRESUPUESTO.test(original) ? 'presupuesto'
    : RE_RECORDATORIO.test(original) ? 'recordatorio' : 'nota';
  const { fecha, origen_fecha } = leerFecha(original, ahora);
  const hora = leerHora(original);
  const faltantes = [];
  if ((tipo === 'agenda' || tipo === 'recordatorio') && !fecha) faltantes.push('fecha_explicita');
  if ((tipo === 'agenda' || tipo === 'recordatorio') && !hora) faltantes.push('hora_explicita');
  // Es una pista textual, no una validación ni vinculación de cliente en CRM.
  if (tipo === 'agenda' && !/\b(?:cliente|para|en|direcci[oó]n)(?=\s|$|[.,;:])/i.test(original)) {
    faltantes.push('cliente_o_ubicacion');
  }
  return { valido: true, accion: 'preparar_borrador', tipo, texto_original: original,
    fecha, hora, origen_fecha, zona_horaria: ZONA, faltantes,
    requiere_confirmacion: true, puede_ejecutar: false, puede_enviar: false };
}
