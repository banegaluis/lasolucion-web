(function () {
    "use strict";
    const $ = id => document.getElementById(id);
    const money = value => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(value);
    const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);
    let draftKey;
    function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
    function addItem(item = {}) {
        const row = document.createElement("div"); row.className = "presupuesto-item";
        row.innerHTML = `<label><span>Descripción</span><input class="descripcion" required maxlength="500"></label><label><span>Cantidad</span><input class="cantidad" type="number" min="0.01" max="1000000" step="0.01" required value="1"></label><label><span>Precio unitario ($)</span><input class="precio" type="number" min="0" max="1000000000" step="0.01" required value="0" inputmode="decimal"></label><button type="button" class="role-action-button">Quitar</button>`;
        row.querySelector(".descripcion").value = item.descripcion || "";
        row.querySelector(".cantidad").value = item.cantidad ?? 1;
        row.querySelector(".precio").value = item.precio ?? 0;
        row.querySelector("button").addEventListener("click", () => { row.remove(); render(); });
        $("items").appendChild(row);
    }
    function read() {
        const data = Object.fromEntries(["cliente", "fecha", "direccion", "rubro", "alcance", "condiciones"].map(id => [id, $(id).value]));
        data.estimado = $("estimado").checked;
        data.items = [...$("items").children].map(row => ({ descripcion: row.querySelector(".descripcion").value, cantidad: Number(row.querySelector(".cantidad").value), precio: Number(row.querySelector(".precio").value) }));
        return data;
    }
    function subtotal(item) { return Math.round(item.cantidad * item.precio * 100) / 100; }
    function render() {
        const d = read(); const total = d.items.reduce((sum,item) => sum + Math.round(subtotal(item)*100),0)/100;
        $("total").textContent = money(total);
        const fecha = d.fecha.split("-").reverse().join("/");
        $("documento").innerHTML = `<header><img src="assets/logo/logo.png" alt="La Solución"><div><h2>PRESUPUESTO</h2><p>${esc(d.rubro)} · ${esc(fecha)}<br>351 543 9183 | @lasolucioncba<br>Córdoba, Argentina</p></div></header><h3>${esc(d.cliente || "Cliente")}</h3>${d.direccion ? `<p>${esc(d.direccion)}</p>` : ""}<h3>ALCANCE DEL TRABAJO</h3><p>${esc(d.alcance)}</p><table><thead><tr><th>CONCEPTO</th><th>IMPORTE</th></tr></thead><tbody>${d.items.map(i => `<tr><td>${esc(i.descripcion)}<small>${esc(i.cantidad)} × ${money(i.precio)}</small></td><td>${money(subtotal(i))}</td></tr>`).join("")}</tbody><tfoot><tr><td>TOTAL${d.estimado ? " ESTIMADO" : ""}</td><td>${money(total)}</td></tr></tfoot></table><h3>CONDICIONES Y ALCANCE</h3><p>Importes expresados en pesos argentinos.</p>${d.condiciones ? `<p>${esc(d.condiciones)}</p>` : ""}<footer>LA SOLUCIÓN · ${esc(d.cliente)}</footer>`;
    }
    function load(d = {}) {
        for (const id of ["cliente","direccion","alcance","condiciones"]) $(id).value = d[id] || "";
        $("fecha").value = d.fecha || today(); $("rubro").value = d.rubro || "Mantenimiento"; $("estimado").checked = Boolean(d.estimado);
        $("items").replaceChildren(); (Array.isArray(d.items) && d.items.length ? d.items : [{}]).forEach(addItem); render();
    }
    function save() {
        try { localStorage.setItem(draftKey, JSON.stringify(read())); $("estado").textContent = "Borrador guardado en este navegador. No se guarda en la nube."; }
        catch (_) { $("estado").textContent = "No se pudo guardar el borrador. Podés imprimirlo o guardar el PDF."; }
    }
    document.addEventListener("DOMContentLoaded", () => {
        if (typeof window.tienePermiso !== "function" || !window.tienePermiso("presupuestos.editar")) return;
        const user = window.obtenerUsuarioActual?.();
        draftKey = "lasolucion.presupuesto.borrador." + (user?.id || user?.email || "local");
        $("presupuestosRoot").hidden = false;
        let draft; try { draft = JSON.parse(localStorage.getItem(draftKey) || "null"); } catch (_) {}
        load(draft || {});
        $("agregarItem").addEventListener("click", () => { addItem(); render(); });
        $("presupuestoForm").addEventListener("input", render);
        $("guardarBorrador").addEventListener("click", save);
        $("nuevo").addEventListener("click", () => { if (confirm("¿Limpiar el formulario para crear otro presupuesto?")) { load(); save(); } });
        $("ejemploArre").addEventListener("click", () => {
            if (read().cliente && !confirm("¿Reemplazar el formulario con el presupuesto de Arre Taquería?")) return;
            load({ cliente: "ARRE TAQUERÍA", fecha: "2026-10-07", rubro: "Electricidad", alcance: "Provisión y reemplazo de dos fuentes de alimentación de 12 V. Incluye los repuestos y la mano de obra de instalación.", estimado: true, items: [{descripcion: "Fuentes de alimentación de 12 V (valor aproximado)",cantidad:2,precio:20000},{descripcion:"Mano de obra · reemplazo de ambas fuentes",cantidad:1,precio:40000}], condiciones: "El valor de los repuestos es aproximado; cualquier variación se informará al cliente antes de realizar la compra.\nFecha de ejecución a coordinar con el cliente. Cualquier trabajo adicional se presupuestará por separado." });
        });
        $("presupuestoForm").addEventListener("submit", e => {
            e.preventDefault(); const d = read();
            if (!d.items.length || !d.cliente.trim() || !d.alcance.trim() || d.items.some(i => !i.descripcion.trim() || !Number.isFinite(i.cantidad*i.precio) || i.cantidad <= 0 || i.precio < 0)) { $("estado").textContent = "Completá cliente, trabajo y al menos un concepto con cantidades y precios válidos."; return; }
            render(); save(); document.title = "Presupuesto La Solución - " + d.cliente; window.print();
        });
    });
})();
