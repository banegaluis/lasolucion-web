import test from 'node:test';
import assert from 'node:assert/strict';
import { procesarMensajes } from '../supabase/functions/whatsapp-interno/core.mjs';
import { crearRevisionConAcceso } from '../supabase/functions/whatsapp-interno/secretario-acceso.mjs';
const numero = '+5493511234567';
const valida = { acceso_id: 'acceso-ficticio', perfil_id: 'perfil-ficticio', version: 1 };
const invalidas = [
  ...[-1, 0, 1.5, 2147483648, Number.MAX_SAFE_INTEGER + 1, '1', null].map(version => ({ ...valida, version })),
  ...['', ' ', 42, {}, []].flatMap(id => [
    { ...valida, acceso_id: id }, { ...valida, perfil_id: id }
  ])
];
const opciones = autorizar => ({ numero, autorizar, id: 'revision',
  texto: 'Agendame para Guille 26/11/2026 10:00', reloj: () => 1000 });

test('receptor rechaza 17 autorizaciones mal formadas sin intentar guardar', async () => {
  for (const acceso of invalidas) {
    let inserciones = 0;
    const r = await procesarMensajes([{ evento_id: 'wamid.prueba', numero }], {
      autorizar: async () => acceso, insertar: async () => { inserciones++; }
    });
    assert.deepEqual(r, { registrados: 0, omitidos: 1 });
    assert.equal(inserciones, 0);
  }
});
test('revisión interna aplica el mismo rechazo al crear una sesión', async () => {
  for (const acceso of invalidas) {
    assert.deepEqual(await crearRevisionConAcceso(opciones(async () => acceso)),
      { ok: false, motivo: 'acceso_denegado' });
  }
});
test('respuesta de autorización mal formada después del alta no expone la sesión', async () => {
  let acceso = valida;
  const s = await crearRevisionConAcceso(opciones(async () => acceso));
  for (const invalida of invalidas) {
    acceso = invalida;
    assert.deepEqual(await s.operar({ numero, accion: 'consultar' }),
      { ok: false, motivo: 'acceso_denegado' });
  }
});
test('ambos circuitos aceptan los extremos válidos del entero de PostgreSQL', async () => {
  for (const version of [1, 2147483647]) {
    const acceso = { ...valida, version };
    let guardado;
    const r = await procesarMensajes([{ evento_id: 'wamid.prueba', numero }], {
      autorizar: async () => acceso, insertar: async e => { guardado = e; }
    });
    assert.equal(r.registrados, 1);
    assert.equal(guardado.version_acceso, version);
    const s = await crearRevisionConAcceso(opciones(async () => acceso));
    assert.equal(s.ok, true);
    assert.equal((await s.operar({ numero, accion: 'consultar' })).ok, true);
  }
});
