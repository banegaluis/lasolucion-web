import test from 'node:test';
import assert from 'node:assert/strict';
import { crearSesionRevision } from '../supabase/functions/whatsapp-interno/secretario-sesion.mjs';
const pedido = 'Agendá para Guille 15/11/2026 10:00 revisar calefón';
const crear = (texto = pedido) => crearSesionRevision({ id: 'prueba', texto });
const ref = (version = 1) => ({ id: 'prueba', version });

test('corregir invalida la confirmación y rechaza el sí de la versión anterior', () => {
  const s = crear();
  assert.equal(s.confirmar(ref()).sesion.confirmacion_simulada, true);
  const corregida = s.corregir(pedido.replace('10:00', '15:00'), ref());
  assert.equal(corregida.sesion.version, 2);
  assert.equal(corregida.sesion.confirmacion_simulada, false);
  assert.equal(corregida.sesion.revision.resumen.hora, '15:00');
  assert.equal(s.confirmar(ref()).ok, false);
  assert.equal(s.confirmar(ref(2)).ok, true);
});
test('no confirma otro borrador ni versiones ausentes, futuras o coercionadas', () => {
  const s = crear();
  for (const r of [undefined, 'sí', { id: 'otro', version: 1 }, ref(2), ref('1'), ref(NaN)]) {
    assert.equal(s.confirmar(r).ok, false);
    assert.equal(s.consultar().confirmacion_simulada, false);
  }
});
test('dos correcciones desde la misma versión no se pisan', () => {
  const s = crear();
  assert.equal(s.corregir(pedido.replace('10:00', '15:00'), ref()).ok, true);
  assert.equal(s.corregir(pedido.replace('10:00', '17:00'), ref()).ok, false);
  assert.equal(s.consultar().revision.resumen.hora, '15:00');
});
test('faltantes y pedidos fuera del circuito no se confirman', () => {
  for (const texto of ['Agendá revisar calefón', 'Presupuestame un tanque', 'Sí, confirmo']) {
    assert.equal(crear(texto).confirmar(ref()).motivo, 'revision_incompleta');
  }
});
test('completar un pedido habilita solo confirmación simulada', () => {
  const s = crear('Agendá revisar calefón');
  s.corregir(pedido, ref());
  const r = s.confirmar(ref(2));
  assert.equal(r.ok, true);
  assert.equal(r.sesion.puede_ejecutar, false);
  assert.equal(r.sesion.puede_enviar, false);
  assert.equal(r.sesion.requiere_confirmacion, true);
});
test('confirmación repetida es idempotente', () => {
  const s = crear();
  const primero = s.confirmar(ref());
  const segundo = s.confirmar(ref());
  assert.equal(segundo.motivo, 'ya_confirmado_en_simulacion');
  assert.deepEqual(primero.sesion, segundo.sesion);
});
test('alterar una copia no altera el borrador vigente', () => {
  const s = crear('Agendá revisar calefón');
  const copia = s.consultar();
  copia.revision.estado = 'pendiente_revision';
  copia.revision.preguntas.length = 0;
  copia.confirmacion_simulada = true;
  assert.equal(s.confirmar(ref()).ok, false);
  assert.equal(s.consultar().revision.preguntas.length, 3);
});
test('entrada inválida no borra ni cambia la revisión vigente', () => {
  const s = crear();
  const antes = s.consultar();
  assert.equal(s.corregir('', ref()).ok, false);
  assert.deepEqual(s.consultar(), antes);
  assert.throws(() => crearSesionRevision({ id: '', texto: pedido }), TypeError);
  assert.throws(() => crear(''), TypeError);
});
test('reloj de referencia no cambia al modificar el objeto externo', () => {
  const ahora = new Date('2026-11-12T12:00:00Z');
  const texto = 'Recordame mañana 10:00 comprar caños';
  const s = crearSesionRevision({ id: 'prueba', texto, ahora });
  ahora.setUTCDate(20);
  const r = s.corregir(texto.replace('10:00', '11:00'), ref());
  assert.equal(r.sesion.revision.resumen.fecha, '2026-11-13');
});
