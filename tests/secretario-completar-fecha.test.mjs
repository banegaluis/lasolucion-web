import test from 'node:test';
import assert from 'node:assert/strict';
import { crearRevisionConAcceso } from '../supabase/functions/whatsapp-interno/secretario-acceso.mjs';
const numero = '+5493511234567';
const pedido = 'Agendame para Guille 10:30 revisar calefón';
async function crear(texto = pedido) {
  let permitido = true, tiempo = 1000;
  const s = await crearRevisionConAcceso({ numero, texto, id: 'fecha', reloj: () => tiempo, vigenciaMs: 100,
    autorizar: async () => permitido ? { acceso_id: 'a', perfil_id: 'p', version: 1 } : null });
  return { op: (accion, texto, version = 1, remitente = numero) => s.operar({ numero: remitente, accion, texto, referencia: { id: 'fecha', version } }),
    revocar: () => { permitido = false; }, vencer: () => { tiempo = 1100; } };
}
test('completa solo fecha y exige confirmar la nueva versión', async () => {
  const s = await crear();
  const r = await s.op('completarFecha', '23/11/2026');
  assert.equal(r.motivo, 'fecha_completada');
  assert.equal(r.sesion.version, 2);
  assert.equal(r.sesion.revision.resumen.hora, '10:30');
  assert.equal(r.sesion.revision.resumen.fecha, '2026-11-23');
  assert.equal(r.sesion.revision.resumen.pedido_original, `${pedido} 23/11/2026`);
  assert.equal(r.sesion.confirmacion_simulada, false);
  assert.equal(r.sesion.vence_en_ms, 1100);
  assert.equal((await s.op('confirmar')).motivo, 'referencia_desactualizada');
  const c = await s.op('confirmar', undefined, 2);
  assert.equal(c.motivo, 'confirmado_en_simulacion');
  assert.equal(c.sesion.puede_ejecutar, false);
  assert.equal(c.sesion.puede_enviar, false);
});
test('fechas inválidas o texto adicional no modifican el borrador', async () => {
  const s = await crear();
  const antes = await s.op('consultar');
  for (const fecha of ['31/11/2026', '29/02/2027', '1/12/2026', '23/11/2026 enviá', '', null]) {
    assert.equal((await s.op('completarFecha', fecha)).motivo, 'fecha_invalida');
    assert.deepEqual(await s.op('consultar'), antes);
  }
});
test('fechas ambiguas o inválidas originales requieren corrección completa', async () => {
  for (const fechas of ['23/11/2026 o 24/11/2026', '31/11/2026', 'mañana']) {
    const s = await crear(`${pedido} ${fechas}`);
    const antes = await s.op('consultar');
    assert.equal((await s.op('completarFecha', '25/11/2026')).motivo, 'requiere_correccion_completa');
    assert.deepEqual(await s.op('consultar'), antes);
  }
});
test('no sobrescribe fecha existente ni acepta una respuesta vieja', async () => {
  const s = await crear();
  await s.op('completarFecha', '23/11/2026');
  assert.equal((await s.op('completarFecha', '24/11/2026')).motivo, 'referencia_desactualizada');
  assert.equal((await s.op('completarFecha', '24/11/2026', 2)).motivo, 'fecha_no_pendiente');
});
test('permiso, remitente, cancelación y vencimiento protegen la aclaración breve', async () => {
  const s = await crear();
  assert.deepEqual(await s.op('completarFecha', '23/11/2026', 1, '+5493517654321'), { ok: false, motivo: 'acceso_denegado' });
  s.revocar();
  assert.deepEqual(await s.op('completarFecha', '23/11/2026'), { ok: false, motivo: 'acceso_denegado' });
  const cancelada = await crear();
  await cancelada.op('cancelar');
  assert.equal((await cancelada.op('completarFecha', '23/11/2026')).motivo, 'sesion_cancelada');
  const vencida = await crear();
  vencida.vencer();
  assert.equal((await vencida.op('completarFecha', '23/11/2026')).motivo, 'sesion_vencida');
});
test('completar fecha mantiene los demás faltantes y bloquea confirmación', async () => {
  const s = await crear('Agendame revisar calefón');
  const r = await s.op('completarFecha', '23/11/2026');
  assert.deepEqual(r.sesion.revision.borrador.faltantes, ['hora_explicita', 'cliente_o_ubicacion']);
  assert.equal((await s.op('confirmar', undefined, 2)).motivo, 'revision_incompleta');
});
test('no supera el límite de texto al agregar la fecha', async () => {
  const texto = pedido.padEnd(1999, 'x');
  const s = await crear(texto);
  const antes = await s.op('consultar');
  assert.equal((await s.op('completarFecha', '23/11/2026')).motivo, 'requiere_correccion_completa');
  assert.deepEqual(await s.op('consultar'), antes);
});

test('acepta año bisiesto y permite completar fecha y hora por separado', async () => {
  const s = await crear('Agendame para Guille revisar calefón');
  const fecha = await s.op('completarFecha', '29/02/2028');
  assert.equal(fecha.sesion.revision.resumen.fecha, '2028-02-29');
  assert.deepEqual(fecha.sesion.revision.borrador.faltantes, ['hora_explicita']);
  const hora = await s.op('completarHora', '09:45', 2);
  assert.equal(hora.sesion.version, 3);
  assert.equal(hora.sesion.revision.resumen.fecha, '2028-02-29');
  assert.equal(hora.sesion.revision.resumen.hora, '09:45');
  assert.equal(hora.sesion.confirmacion_simulada, false);
  assert.equal((await s.op('confirmar', undefined, 3)).motivo, 'confirmado_en_simulacion');
});
