import test from 'node:test';
import assert from 'node:assert/strict';
import { crearRevisionConAcceso } from '../supabase/functions/whatsapp-interno/secretario-acceso.mjs';
const numero = '+5493511234567';
const permiso = () => ({ acceso_id: 'a', perfil_id: 'p', version: 1 });
const opciones = { id: 'prueba', texto: 'Agendá para Guille 20/11/2026 10:00 revisar calefón', reloj: () => 1000 };
const ref = { id: 'prueba', version: 1 };
const crear = autorizar => crearRevisionConAcceso({ numero, autorizar, ...opciones });

test('creación denegada no entrega sesión ni datos', async () => {
  for (const respuesta of [null, true, {}, { ...permiso(), version: '1' }]) {
    assert.deepEqual(await crear(async () => respuesta), { ok: false, motivo: 'acceso_denegado' });
  }
});
test('consulta y acciones revalidan permiso sin habilitar envíos', async () => {
  let llamadas = 0;
  const s = await crear(async (n, p) => {
    assert.equal(n, numero); assert.equal(p, 'agenda.registrar'); llamadas++; return permiso();
  });
  for (const accion of ['consultar', 'confirmar', 'cancelar']) {
    const r = await s.operar({ numero, accion, referencia: ref });
    assert.equal(r.ok, true);
    assert.equal(r.sesion.puede_ejecutar, false);
    assert.equal(r.sesion.puede_enviar, false);
  }
  assert.equal(llamadas, 4);
});
test('otro remitente no puede consultar ni modificar aun con id y versión', async () => {
  const s = await crear(async () => permiso());
  for (const accion of ['consultar', 'corregir', 'confirmar', 'cancelar']) {
    assert.deepEqual(await s.operar({ numero: '+5493517654321', accion, referencia: ref, texto: opciones.texto }),
      { ok: false, motivo: 'acceso_denegado' });
  }
});
test('revocación, reasignación y cambio de versión bloquean sin filtrar borrador', async () => {
  for (const nuevo of [null, { ...permiso(), perfil_id: 'otro' }, { ...permiso(), acceso_id: 'otro' }, { ...permiso(), version: 2 }]) {
    let acceso = permiso();
    const s = await crear(async () => acceso);
    acceso = nuevo;
    for (const accion of ['consultar', 'corregir', 'confirmar', 'cancelar']) {
      assert.deepEqual(await s.operar({ numero, accion, referencia: ref, texto: opciones.texto }),
        { ok: false, motivo: 'acceso_denegado' });
    }
  }
});
test('fallo del autorizador se cierra sin exponer el error', async () => {
  let falla = false;
  const autorizar = async () => { if (falla) throw new Error('dato privado'); return permiso(); };
  const s = await crear(autorizar);
  falla = true;
  assert.deepEqual(await s.operar({ numero, accion: 'consultar' }), { ok: false, motivo: 'acceso_denegado' });
  assert.equal((await crear(autorizar)).ok, false);
});
test('control de acceso conserva rechazo de versiones viejas y vencimiento', async () => {
  let t = 1000;
  const s = await crearRevisionConAcceso({ numero, autorizar: async () => permiso(), ...opciones, reloj: () => t, vigenciaMs: 100 });
  assert.equal((await s.operar({ numero, accion: 'corregir', texto: opciones.texto, referencia: ref })).ok, true);
  assert.equal((await s.operar({ numero, accion: 'confirmar', referencia: ref })).motivo, 'referencia_desactualizada');
  t = 1100;
  assert.equal((await s.operar({ numero, accion: 'confirmar', referencia: { ...ref, version: 2 } })).motivo, 'sesion_vencida');
});
