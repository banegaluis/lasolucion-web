// Contrato compartido del resultado del autorizador confiable del servidor.
// No autentica números ni sustituye permisos; solo valida la identidad recibida.
export function validarIdentidadAcceso(acceso) {
  const identificador = valor => typeof valor === 'string' && valor.trim().length > 0;
  if (!acceso || !identificador(acceso.acceso_id) || !identificador(acceso.perfil_id)
    || !Number.isInteger(acceso.version) || acceso.version < 1 || acceso.version > 2147483647) return null;
  // version_acceso se almacena como integer positivo en bot_borradores.
  return { acceso_id: acceso.acceso_id, perfil_id: acceso.perfil_id, version: acceso.version };
}
