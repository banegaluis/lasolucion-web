import test from 'node:test';
import assert from 'node:assert/strict';
import { crearRevisionConAcceso } from '../supabase/functions/whatsapp-interno/secretario-acceso.mjs';

// Dobles locales: sin WhatsApp, red, base de datos ni identidades reales.
const numero = '+5493511234567';
const ambiguo = 'Agendame para Guille 21/11/2026 o 22/11/2026 10:00 revisar calefón';
const corregido = 'Agendame para Guille 22/11/2026 10:00 revisar calefón';
const referencia = version => ({ id: 'aclaracion', version });
async function escenario(texto = ambiguo) {
  let autorizado = true;
  let instante = 1000;
  const control = await crearRevisionConAcceso({ numero, id: 'aclaracion', texto,
    reloj: () => instante, vigenciaMs: 100,
    autorizar: async () => autorizado ? { acceso_id: 'a', perfil_id: 'p', version: 1 } : null });
  assert.equal(control.ok, true);
  return {
    operar: (accion, version = 1, texto) => control.operar({ numero, accion, referencia: referencia(version), texto }),
    revocar: () => { autorizado = false; },
    vencer: () => { instante = 1100; }
  };
}
function sinEfectos(r) {
  assert.equal(r.sesion.puede_ejecutar, false);
  assert.equal(r.sesion.puede_enviar, false);
  assert.equal(r.sesion.requiere_confirmacion, true);
}

test('aclaración completa: bloquea ambigüedad, corrige y confirma solo la versión vigente', async () => {
  const s = await escenario();
  const inicial = await s.operar('consultar');
  assert.equal(inicial.sesion.revision.resumen.fecha, null);
  assert.deepEqual(inicial.sesion.revision.preguntas.map(p => p.campo), ['fecha_explicita']);
  const rechazo = await s.operar('confirmar');
  assert.equal(rechazo.motivo, 'revision_incompleta');
  assert.equal(rechazo.sesion.confirmacion_simulada, false);
  const cambio = await s.operar('corregir', 1, corregido);
  assert.equal(cambio.motivo, 'corregido');
  assert.equal(cambio.sesion.version, 2);
  assert.equal(cambio.sesion.revision.resumen.fecha, '2026-11-22');
  assert.equal(cambio.sesion.revision.resumen.hora, '10:00');
  assert.equal((await s.operar('confirmar', 1)).motivo, 'referencia_desactualizada');
  const confirmado = await s.operar('confirmar', 2);
  assert.equal(confirmado.motivo, 'confirmado_en_simulacion');
  assert.equal(confirmado.sesion.confirmacion_simulada, true);
  assert.equal((await s.operar('confirmar', 2)).motivo, 'ya_confirmado_en_simulacion');
  for (const r of [inicial, rechazo, cambio, confirmado]) sinEfectos(r);
});

test('una corrección ambigua revoca la confirmación previa y exige otra aclaración', async () => {
  const s = await escenario(corregido);
  assert.equal((await s.operar('confirmar')).sesion.confirmacion_simulada, true);
  const cambio = await s.operar('corregir', 1, ambiguo);
  assert.equal(cambio.sesion.confirmacion_simulada, false);
  assert.equal(cambio.sesion.revision.estado, 'necesita_aclaracion');
  assert.equal((await s.operar('confirmar', 2)).motivo, 'revision_incompleta');
  const resolucion = await s.operar('corregir', 2, corregido);
  assert.equal(resolucion.sesion.version, 3);
  assert.equal((await s.operar('confirmar', 2)).motivo, 'referencia_desactualizada');
  sinEfectos(await s.operar('confirmar', 3));
});

test('revocación después de aclarar impide confirmar o consultar sin revelar el pedido', async () => {
  const s = await escenario();
  await s.operar('corregir', 1, corregido);
  s.revocar();
  for (const accion of ['confirmar', 'consultar', 'corregir']) {
    assert.deepEqual(await s.operar(accion, 2, corregido), { ok: false, motivo: 'acceso_denegado' });
  }
});

test('vencimiento después de aclarar impide confirmar y no se renueva al corregir', async () => {
  const s = await escenario();
  const cambio = await s.operar('corregir', 1, corregido);
  assert.equal(cambio.sesion.vence_en_ms, 1100);
  s.vencer();
  const r = await s.operar('confirmar', 2);
  assert.equal(r.motivo, 'sesion_vencida');
  assert.equal(r.sesion.confirmacion_simulada, false);
  sinEfectos(r);
});
