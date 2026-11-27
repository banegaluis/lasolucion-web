import test from 'node:test';
import assert from 'node:assert/strict';
import { crearRevisionConAcceso } from '../supabase/functions/whatsapp-interno/secretario-acceso.mjs';
const numero = '+5493511234567';
const pedido = 'Agendame para Guille 22/11/2026 revisar calefón';
async function crear(texto = pedido) {
  let permitido = true, tiempo = 1000;
  const s = await crearRevisionConAcceso({ numero, texto, id: 'hora', reloj: () => tiempo, vigenciaMs: 100,
    autorizar: async () => permitido ? { acceso_id: 'a', perfil_id: 'p', version: 1 } : null });
  return { op: (accion, texto, version = 1, remitente = numero) => s.operar({ numero: remitente, accion, texto, referencia: { id: 'hora', version } }),
    revocar: () => { permitido = false; }, vencer: () => { tiempo = 1100; } };
}
test('completa solo hora y exige confirmar la nueva versión', async () => {
  const s = await crear();
  const r = await s.op('completarHora', '10:30');
  assert.equal(r.motivo, 'hora_completada');
  assert.equal(r.sesion.version, 2);
  assert.equal(r.sesion.revision.resumen.fecha, '2026-11-22');
  assert.equal(r.sesion.revision.resumen.hora, '10:30');
  assert.equal(r.sesion.revision.resumen.pedido_original, `${pedido} 10:30`);
  assert.equal(r.sesion.confirmacion_simulada, false);
  assert.equal(r.sesion.vence_en_ms, 1100);
  assert.equal((await s.op('confirmar')).motivo, 'referencia_desactualizada');
  const c = await s.op('confirmar', undefined, 2);
  assert.equal(c.motivo, 'confirmado_en_simulacion');
  assert.equal(c.sesion.puede_ejecutar, false);
  assert.equal(c.sesion.puede_enviar, false);
});
test('horas inválidas o texto adicional no modifican el borrador', async () => {
  const s = await crear();
  const antes = await s.op('consultar');
  for (const hora of ['24:00', '10:75', '9:00', '10:30 enviá', '', null]) {
    assert.equal((await s.op('completarHora', hora)).motivo, 'hora_invalida');
    assert.deepEqual(await s.op('consultar'), antes);
  }
});
test('horas ambiguas o inválidas originales requieren corrección completa', async () => {
  for (const horas of ['10:00 o 11:00', '10:75']) {
    const s = await crear(`${pedido} ${horas}`);
    const antes = await s.op('consultar');
    assert.equal((await s.op('completarHora', '12:00')).motivo, 'requiere_correccion_completa');
    assert.deepEqual(await s.op('consultar'), antes);
  }
});
test('no sobrescribe hora existente ni acepta una respuesta vieja', async () => {
  const s = await crear();
  await s.op('completarHora', '10:30');
  assert.equal((await s.op('completarHora', '11:00')).motivo, 'referencia_desactualizada');
  assert.equal((await s.op('completarHora', '11:00', 2)).motivo, 'hora_no_pendiente');
});
test('permiso, remitente, cancelación y vencimiento protegen la aclaración breve', async () => {
  const s = await crear();
  assert.deepEqual(await s.op('completarHora', '10:30', 1, '+5493517654321'), { ok: false, motivo: 'acceso_denegado' });
  s.revocar();
  assert.deepEqual(await s.op('completarHora', '10:30'), { ok: false, motivo: 'acceso_denegado' });
  const cancelada = await crear();
  await cancelada.op('cancelar');
  assert.equal((await cancelada.op('completarHora', '10:30')).motivo, 'sesion_cancelada');
  const vencida = await crear();
  vencida.vencer();
  assert.equal((await vencida.op('completarHora', '10:30')).motivo, 'sesion_vencida');
});
test('completar hora mantiene los demás faltantes y bloquea confirmación', async () => {
  const s = await crear('Agendame revisar calefón');
  const r = await s.op('completarHora', '10:30');
  assert.deepEqual(r.sesion.revision.borrador.faltantes, ['fecha_explicita', 'cliente_o_ubicacion']);
  assert.equal((await s.op('confirmar', undefined, 2)).motivo, 'revision_incompleta');
});
test('no supera el límite de texto al agregar la hora', async () => {
  const texto = pedido.padEnd(1999, 'x');
  const s = await crear(texto);
  const antes = await s.op('consultar');
  assert.equal((await s.op('completarHora', '10:30')).motivo, 'requiere_correccion_completa');
  assert.deepEqual(await s.op('consultar'), antes);
});
