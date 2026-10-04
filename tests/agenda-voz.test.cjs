const { test } = require("node:test");
const assert = require("node:assert/strict");
const { interpretar } = require("../crm/js/agendaVoz.js");

const base = new Date(2026, 9, 1, 12, 0, 0);

test("interpreta tarea, cliente, mañana y hora", () => {
    assert.deepEqual(interpretar("Reparar calefón para Juan Pérez mañana a las 15:30", base), {
        tarea: "Reparar calefón", cliente: "Juan Pérez", fecha: "2026-10-02", hora: "15:30", faltantes: []
    });
});

test("acepta etiquetas y fecha numérica", () => {
    assert.deepEqual(interpretar("tarea revisar termotanque cliente Ana Gómez 05/10/2026 a las 9", base), {
        tarea: "revisar termotanque", cliente: "Ana Gómez", fecha: "2026-10-05", hora: "09:00", faltantes: []
    });
});

test("señala datos faltantes sin inventarlos", () => {
    const resultado = interpretar("Reparar pérdida para Pedro", base);
    assert.deepEqual(resultado.faltantes, ["fecha", "hora"]);
});

test("el próximo lunes nunca queda en una fecha pasada", () => {
    const resultado = interpretar("Revisar cocina para Marta el lunes a las 10", base);
    assert.equal(resultado.fecha, "2026-10-05");
    assert.equal(resultado.cliente, "Marta");
});

test("rechaza horas imposibles", () => {
    const resultado = interpretar("Revisar calefón para Luis mañana a las 28:90", base);
    assert.equal(resultado.hora, "");
    assert.ok(resultado.faltantes.includes("hora"));
});

test("interpreta la frase real del iPhone sin corregir el domicilio por su cuenta", () => {
    assert.deepEqual(interpretar("mañana domingo 10 de la mañana hay que ir al local del Guille en Duarte esguiro 3226", new Date(2026, 9, 3, 21)), {
        tarea: "Ir al local en Duarte esguiro 3226", cliente: "Guille", fecha: "2026-10-04", hora: "10:00", faltantes: []
    });
});

test("de la mañana indica horario, sin inventar una fecha", () => {
    const resultado = interpretar("Revisar calefón para Ana a las 10 de la mañana", base);
    assert.equal(resultado.hora, "10:00");
    assert.equal(resultado.fecha, "");
    assert.equal(resultado.cliente, "Ana");
});

test("convierte hora de tarde y conserva minutos", () => {
    const resultado = interpretar("hay que ir al local de Ana en Colón 400 mañana 3 y 30 de la tarde", base);
    assert.equal(resultado.hora, "15:30");
    assert.equal(resultado.cliente, "Ana");
    assert.equal(resultado.tarea, "Ir al local en Colón 400");
});

test("no confunde la altura del domicilio con una hora", () => {
    const resultado = interpretar("mañana hay que ir al local del Guille en Duarte Quirós 3226", base);
    assert.equal(resultado.hora, "");
    assert.deepEqual(resultado.faltantes, ["hora"]);
});

test("el dictado de teclado completa los campos al recibir input", () => {
    const vm = require("node:vm");
    const fs = require("node:fs");
    const nodos = new Map();
    function nodo(id) {
        if (!nodos.has(id)) nodos.set(id, { value: "", handlers: {}, classList: { toggle() {} }, addEventListener(tipo, fn) { this.handlers[tipo] = fn; } });
        return nodos.get(id);
    }
    nodo("agendaVozModal").querySelector = () => nodo("overlay");
    const contexto = { document: { readyState: "complete", getElementById: nodo } };
    contexto.window = contexto;
    vm.runInNewContext(fs.readFileSync(require.resolve("../crm/js/agendaVoz.js"), "utf8"), contexto);
    nodo("agendaVozTexto").value = "mañana domingo 10 de la mañana hay que ir al local del Guille en Duarte esguiro 3226";
    nodo("agendaVozTexto").handlers.input({ target: nodo("agendaVozTexto") });
    assert.equal(nodo("agendaVozCliente").value, "Guille");
    assert.equal(nodo("agendaVozHora").value, "10:00");
    assert.equal(nodo("agendaVozTarea").value, "Ir al local en Duarte esguiro 3226");
    assert.equal(nodo("agendaVozEstado").textContent, "Borrador completo. Revisalo antes de continuar.");
});
