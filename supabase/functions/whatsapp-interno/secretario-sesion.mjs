import { prepararRevisionInterna } from './secretario-revision.mjs';

// Simulador en memoria. El estado vigente vive en el cierre, nunca en datos del remitente.
// No autentica operadores, persiste, guarda turnos ni habilita ejecución/envío.
export function crearSesionRevision({ id, texto, ahora = null, reloj = Date.now, vigenciaMs = 15 * 60 * 1000 }) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) {
    throw new TypeError('Identificador de borrador inválido');
  }
  if (typeof reloj !== 'function' || !Number.isSafeInteger(vigenciaMs) || vigenciaMs <= 0) {
    throw new TypeError('Reloj o vigencia inválidos');
  }
  let ultimoInstante = reloj();
  const venceEn = ultimoInstante + vigenciaMs;
  if (!Number.isSafeInteger(ultimoInstante) || !Number.isSafeInteger(venceEn)) {
    throw new TypeError('Instante de creación inválido');
  }
  const referencia = ahora instanceof Date ? new Date(ahora.getTime()) : null;
  let revision = prepararRevisionInterna(texto, { ahora: referencia });
  if (revision.estado === 'entrada_invalida') throw new TypeError('Pedido inválido');
  let version = 1;
  let confirmada = false;
  let cancelada = false;
  let vencida = false;
  function actualizarVencimiento() {
    if (cancelada || vencida) return;
    let instante;
    try { instante = reloj(); } catch { instante = NaN; }
    // Ante un reloj inválido o que retrocede, cerrar sin rehabilitar la sesión.
    if (!Number.isSafeInteger(instante) || instante < ultimoInstante || instante >= venceEn) {
      vencida = true;
      confirmada = false;
    } else ultimoInstante = instante;
  }
  const instantanea = () => structuredClone({ id, version, confirmacion_simulada: confirmada,
    estado_sesion: cancelada ? 'cancelada' : vencida ? 'vencida' : 'activa', vence_en_ms: venceEn,
    revision, requiere_confirmacion: true, puede_ejecutar: false, puede_enviar: false });
  const consultar = () => { actualizarVencimiento(); return instantanea(); };
  const resultado = (ok, motivo) => ({ ok, motivo, sesion: instantanea() });
  function coincide(referenciaVersion) {
    return referenciaVersion?.id === id && Number.isSafeInteger(referenciaVersion?.version)
      && referenciaVersion.version === version;
  }
  return Object.freeze({
    consultar,
    corregir(textoCompleto, referenciaVersion) {
      actualizarVencimiento();
      if (vencida) return resultado(false, 'sesion_vencida');
      if (!coincide(referenciaVersion)) return resultado(false, 'referencia_desactualizada');
      if (cancelada) return resultado(false, 'sesion_cancelada');
      const nueva = prepararRevisionInterna(textoCompleto, { ahora: referencia });
      if (nueva.estado === 'entrada_invalida') return resultado(false, 'pedido_invalido');
      if (version === Number.MAX_SAFE_INTEGER) return resultado(false, 'limite_versiones');
      revision = nueva;
      version += 1;
      confirmada = false;
      return resultado(true, 'corregido');
    },
    confirmar(referenciaVersion) {
      actualizarVencimiento();
      if (vencida) return resultado(false, 'sesion_vencida');
      if (!coincide(referenciaVersion)) return resultado(false, 'referencia_desactualizada');
      if (cancelada) return resultado(false, 'sesion_cancelada');
      if (revision.estado !== 'pendiente_revision') return resultado(false, 'revision_incompleta');
      if (confirmada) return resultado(true, 'ya_confirmado_en_simulacion');
      confirmada = true;
      return resultado(true, 'confirmado_en_simulacion');
    },
    cancelar(referenciaVersion) {
      actualizarVencimiento();
      if (vencida) return resultado(false, 'sesion_vencida');
      if (!coincide(referenciaVersion)) return resultado(false, 'referencia_desactualizada');
      if (cancelada) return resultado(true, 'ya_cancelada');
      cancelada = true;
      confirmada = false;
      return resultado(true, 'cancelada');
    }
  });
}
