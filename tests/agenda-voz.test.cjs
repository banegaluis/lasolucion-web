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
