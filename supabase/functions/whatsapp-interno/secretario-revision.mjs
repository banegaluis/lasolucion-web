import { interpretarSolicitudInterna } from './secretario-borradores.mjs';

const PREGUNTAS = {
  fecha_explicita: '¿Qué día? Indicá la fecha en formato DD/MM/AAAA.',
  hora_explicita: '¿A qué hora? Indicá un único horario en formato HH:MM de 24 horas.',
  cliente_o_ubicacion: '¿Para qué cliente o en qué dirección es el trabajo?'
};

// Prepara contenido para revisión interna; no envía mensajes ni acepta aprobaciones.
// Reinterpreta el texto para no confiar en flags de un borrador proporcionado por fuera.
export function prepararRevisionInterna(texto, opciones = {}) {
  const borrador = interpretarSolicitudInterna(texto, opciones);
  const seguridad = { requiere_confirmacion: true, puede_ejecutar: false, puede_enviar: false };
  if (!borrador.valido) {
    return { estado: 'entrada_invalida', borrador, preguntas: [], resumen: null,
      indicacion: 'Escribí un pedido de entre 1 y 2000 caracteres.', ...seguridad };
  }
  if (!['agenda', 'recordatorio'].includes(borrador.tipo)) {
    return { estado: 'revision_manual', borrador, preguntas: [], resumen: null,
      indicacion: 'Este circuito solo revisa agenda y recordatorios. El pedido necesita revisión manual.',
      ...seguridad };
  }
  const preguntas = borrador.faltantes.map(campo => ({ campo, texto: PREGUNTAS[campo] }));
  return {
    estado: preguntas.length ? 'necesita_aclaracion' : 'pendiente_revision',
    borrador, preguntas,
    resumen: { pedido_original: borrador.texto_original, tipo: borrador.tipo,
      fecha: borrador.fecha, hora: borrador.hora, zona_horaria: borrador.zona_horaria },
    indicacion: preguntas.length
      ? 'Completá los datos indicados y reenviá el pedido completo para revisarlo. Todavía no se guardó nada.'
      : 'Revisá el pedido, fecha y hora. La tarea y el cliente todavía requieren validación humana. No se guardó nada.',
    ...seguridad
  };
}
