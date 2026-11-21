import { crearSesionRevision } from './secretario-sesion.mjs';

const denegado = () => ({ ok: false, motivo: 'acceso_denegado' });
const identidad = a => a && typeof a.acceso_id === 'string' && a.acceso_id.length > 0
  && typeof a.perfil_id === 'string' && a.perfil_id.length > 0
  && Number.isSafeInteger(a.version) && a.version >= 0
  ? { acceso_id: a.acceso_id, perfil_id: a.perfil_id, version: a.version } : null;

// Adaptador aislado: numero debe provenir del transporte autenticado, nunca del texto.
// autorizar es una dependencia confiable del servidor; aquí no hay llamadas a servicios.
export async function crearRevisionConAcceso({ numero, autorizar, ...opciones }) {
  if (typeof numero !== 'string' || !/^\+[1-9][0-9]{7,14}$/.test(numero)
    || typeof autorizar !== 'function') return denegado();
  async function verificar() {
    try { return identidad(await autorizar(numero, 'agenda.registrar')); }
    catch { return null; }
  }
  const propietario = await verificar();
  if (!propietario) return denegado();
  const sesion = crearSesionRevision(opciones);
  return Object.freeze({ ok: true,
    async operar({ numero: remitente, accion, referencia, texto } = {}) {
      if (remitente !== numero) return denegado();
      if (!['consultar', 'corregir', 'completarHora', 'confirmar', 'cancelar'].includes(accion)) {
        return { ok: false, motivo: 'accion_invalida' };
      }
      // Copiar la referencia antes del await evita cambios mientras se autoriza.
      const ref = { id: referencia?.id, version: referencia?.version };
      const acceso = await verificar();
      if (!acceso || acceso.acceso_id !== propietario.acceso_id
        || acceso.perfil_id !== propietario.perfil_id || acceso.version !== propietario.version) return denegado();
      if (accion === 'consultar') return { ok: true, sesion: sesion.consultar() };
      if (accion === 'corregir' || accion === 'completarHora') return sesion[accion](texto, ref);
      return sesion[accion](ref);
    }
  });
}
