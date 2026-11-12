import { prepararRevisionInterna } from './secretario-revision.mjs';

// Simulador en memoria. El estado vigente vive en el cierre, nunca en datos del remitente.
// No autentica operadores, persiste, guarda turnos ni habilita ejecución/envío.
export function crearSesionRevision({ id, texto, ahora = null }) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) {
    throw new TypeError('Identificador de borrador inválido');
  }
  const referencia = ahora instanceof Date ? new Date(ahora.getTime()) : null;
  let revision = prepararRevisionInterna(texto, { ahora: referencia });
  if (revision.estado === 'entrada_invalida') throw new TypeError('Pedido inválido');
  let version = 1;
  let confirmada = false;
  const consultar = () => structuredClone({ id, version, confirmacion_simulada: confirmada,
    revision, requiere_confirmacion: true, puede_ejecutar: false, puede_enviar: false });
  const resultado = (ok, motivo) => ({ ok, motivo, sesion: consultar() });
  function coincide(referenciaVersion) {
    return referenciaVersion?.id === id && Number.isSafeInteger(referenciaVersion?.version)
      && referenciaVersion.version === version;
  }
  return Object.freeze({
    consultar,
    corregir(textoCompleto, referenciaVersion) {
      if (!coincide(referenciaVersion)) return resultado(false, 'referencia_desactualizada');
      const nueva = prepararRevisionInterna(textoCompleto, { ahora: referencia });
      if (nueva.estado === 'entrada_invalida') return resultado(false, 'pedido_invalido');
      if (version === Number.MAX_SAFE_INTEGER) return resultado(false, 'limite_versiones');
      revision = nueva;
      version += 1;
      confirmada = false;
      return resultado(true, 'corregido');
    },
    confirmar(referenciaVersion) {
      if (!coincide(referenciaVersion)) return resultado(false, 'referencia_desactualizada');
      if (revision.estado !== 'pendiente_revision') return resultado(false, 'revision_incompleta');
      if (confirmada) return resultado(true, 'ya_confirmado_en_simulacion');
      confirmada = true;
      return resultado(true, 'confirmado_en_simulacion');
    }
  });
}
