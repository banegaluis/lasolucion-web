const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function entorno() {
  const frames = [];
  let enfoques = 0;
  let respuesta = { ok: true, data: [] };
  const calendario = { view: { type: 'timeGridWeek' }, removeAllEvents() {} };
  const window = {
    addEventListener() {}, setInterval() {},
    requestAnimationFrame: fn => frames.push(fn),
    OrdenesSupabaseService: { consultarAgenda: async () => respuesta }
  };
  let source = fs.readFileSync(path.join(__dirname, '../crm/js/agenda.js'), 'utf8');
  source = source.replace(/\}\)\(\);\s*$/, `
    window.cargar = cargarEventosSupabase;
    calendario = window.calendarioPrueba;
    actualizarFiltrosDinamicos = actualizarResumenAgenda = mostrarEstadoCargaAgenda = abrirOrdenDesdeUrl = () => {};
    obtenerOrdenesFiltradas = () => [];
    enfocarHorarioRelevante = window.enfocarPrueba;
  })();`);
  window.calendarioPrueba = calendario;
  window.enfocarPrueba = () => enfoques++;
  vm.runInNewContext(source, { window, document: { addEventListener() {} }, console: { error() {} } });
  return {
    calendario,
    cargar: (dia = 1) => window.cargar({ start: new Date(2026, 8, dia), end: new Date(2026, 8, dia + 7) }, () => {}, () => {}),
    render: () => { while (frames.length) frames.shift()(); },
    enfoques: () => enfoques,
    fallar: valor => { respuesta = valor ? { ok: false, error: 'Sin conexión' } : { ok: true, data: [] }; }
  };
}

test('Refrescos repetidos del mismo período no mueven la posición horaria', async () => {
  const e = entorno();
  await e.cargar(); e.render();
  for (let i = 0; i < 3; i++) { await e.cargar(); e.render(); }
  assert.equal(e.enfoques(), 1);
});

test('Cambiar período o vista permite enfocar nuevamente', async () => {
  const e = entorno();
  await e.cargar(); e.render();
  await e.cargar(8); e.render();
  e.calendario.view.type = 'timeGridDay';
  await e.cargar(8); e.render();
  assert.equal(e.enfoques(), 3);
});

test('Una consulta posterior invalida el desplazamiento pendiente anterior', async () => {
  const e = entorno();
  await e.cargar();
  await e.cargar(8);
  e.render();
  assert.equal(e.enfoques(), 1);
  await e.cargar(8); e.render();
  assert.equal(e.enfoques(), 1);
});

test('Una carga fallida no consume el enfoque inicial del período', async () => {
  const e = entorno();
  e.fallar(true); await e.cargar(); e.render();
  assert.equal(e.enfoques(), 0);
  e.fallar(false); await e.cargar(); e.render();
  assert.equal(e.enfoques(), 1);
});
