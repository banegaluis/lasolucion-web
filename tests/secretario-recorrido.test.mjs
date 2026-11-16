import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, webcrypto } from 'node:crypto';
import { firmaCorrecta, extraerMensajes, esComandoAgenda } from '../supabase/functions/whatsapp-interno/core.mjs';
import { crearRevisionConAcceso } from '../supabase/functions/whatsapp-interno/secretario-acceso.mjs';
const clave = 'clave-ficticia-solo-para-pruebas';
const cuerpo = texto => JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: {
  metadata: { phone_number_id: 'numero_prueba' },
  messages: [{ id: 'wamid.prueba', from: '5493511234567', type: 'text', text: { body: texto } }]
} }] }] });
const firmar = raw => 'sha256=' + createHmac('sha256', clave).update(raw).digest('hex');
// Arnés local: une módulos existentes. No es un receptor ni activa integraciones.
async function recorrido(raw, firma, autorizar, phoneId = 'numero_prueba') {
  if (!await firmaCorrecta(raw, firma, clave, webcrypto)) return [];
  const salida = [];
  for (const m of extraerMensajes(JSON.parse(raw), phoneId)) {
    const s = await crearRevisionConAcceso({ id: 'prueba', texto: m.texto, numero: m.numero, autorizar, reloj: () => 1000 });
    salida.push(s.ok ? await s.operar({ numero: m.numero, accion: 'consultar' }) : s);
  }
  return salida;
}
for (const comando of ['Agendame', 'Agendáme', 'Programame', 'Programáme']) {
  test(`${comando} cruza firma, filtro, permiso e interpretación`, async () => {
    const raw = cuerpo(`${comando} para Guille 20/11/2026 15:00 revisar calefón`);
    const r = await recorrido(raw, firmar(raw), async (numero, permiso) => {
      assert.equal(numero, '+5493511234567');
      assert.equal(permiso, 'agenda.registrar');
      return { acceso_id: 'a', perfil_id: 'p', version: 1 };
    });
    assert.equal(r.length, 1);
    assert.equal(r[0].sesion.revision.resumen.hora, '15:00');
    assert.equal(r[0].sesion.revision.resumen.tipo, 'agenda');
    assert.equal(r[0].sesion.puede_ejecutar, false);
    assert.equal(r[0].sesion.puede_enviar, false);
  });
}
test('firma alterada o destino distinto no alcanza al autorizador', async () => {
  const raw = cuerpo('Agendame para Guille 20/11/2026 15:00');
  let llamadas = 0;
  const autorizar = async () => { llamadas++; return null; };
  assert.deepEqual(await recorrido(raw + ' ', firmar(raw), autorizar), []);
  assert.deepEqual(await recorrido(raw, firmar(raw), autorizar, 'otro'), []);
  assert.equal(llamadas, 0);
});
test('firma válida no reemplaza el permiso del operador', async () => {
  const raw = cuerpo('Agendame para Guille 20/11/2026 15:00');
  assert.deepEqual(await recorrido(raw, firmar(raw), async () => null), [{ ok: false, motivo: 'acceso_denegado' }]);
});
test('conserva comandos anteriores y rechaza prefijos ajenos o tipos no textuales', () => {
  for (const texto of ['Agendá', 'Agendar', 'Turno', 'Programar', 'Nueva orden']) assert.equal(esComandoAgenda(texto), true);
  for (const texto of ['Agendamiento', 'Programamelo', 'Hola agendame', null, 123, {}]) assert.equal(esComandoAgenda(texto), false);
});
