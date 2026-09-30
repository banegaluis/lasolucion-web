const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function cargarCalculador(href) {
    const source = fs.readFileSync(path.join(__dirname, "../crm/js/login.js"), "utf8")
        .replace(/if \(document\.readyState === "loading"\)[\s\S]*$/, "");
    const context = vm.createContext({
        URL,
        window: { location: { href } },
        document: {},
        setTimeout() {}
    });
    vm.runInContext(source, context);
    return context.obtenerUrlRecuperacionClave;
}

test("localhost siempre retorna a la recuperación pública", () => {
    const calcular = cargarCalculador("http://localhost:8000/crm/index.html");
    assert.equal(calcular(), "https://banegaluis.github.io/lasolucion-web/crm/recuperar-clave.html");
});

test("la web publicada elimina parámetros y conserva el origen", () => {
    const calcular = cargarCalculador("https://banegaluis.github.io/lasolucion-web/crm/index.html?x=1#login");
    assert.equal(calcular(), "https://banegaluis.github.io/lasolucion-web/crm/recuperar-clave.html");
});

test("un dominio propio futuro conserva su origen", () => {
    const calcular = cargarCalculador("https://app.lasolucioncba.com/crm/index.html");
    assert.equal(calcular(), "https://app.lasolucioncba.com/crm/recuperar-clave.html");
});
