/* =====================================================
   UI
   La Solución CRM
   Funciones de interfaz
===================================================== */

/* ==============================
   MODAL AGENDA / ORDEN
============================== */

function cerrarPanelesFlotantesAntesDeModal() {
    const filtroMenu = document.getElementById("agendaFilterMenu");
    const filtroToggle = document.getElementById("agendaFilterToggle");

    if (filtroMenu) filtroMenu.classList.remove("is-open");
    if (filtroToggle) filtroToggle.setAttribute("aria-expanded", "false");

    document.querySelectorAll(".agenda-filter-group.is-open").forEach(grupo => {
        grupo.classList.remove("is-open");
    });

    document.body.classList.remove("sidebar-open");
    document.body.classList.remove("layout-scroll-locked");
    document.documentElement.classList.remove("layout-scroll-locked");
    const menuToggle = document.querySelector(".app-menu-toggle");
    if (menuToggle) menuToggle.setAttribute("aria-expanded", "false");
}

function bloquearScrollModal(bloquear) {
    document.body.classList.toggle("modal-scroll-locked", bloquear);
    document.documentElement.classList.toggle("modal-scroll-locked", bloquear);
}

function abrirAgenda(valores = {}) {
    const modal = document.getElementById("agenda");

    if (!modal) return;

    cerrarPanelesFlotantesAntesDeModal();

    if (valores && typeof valores === "object") {
        Object.entries(valores).forEach(([id, valor]) => {
            const campo = document.getElementById(id);
            if (campo && valor !== undefined && valor !== null) campo.value = valor;
        });
    }

    if (typeof configurarFormularioOrden === "function") configurarFormularioOrden();

    modal.style.display = "flex";
    bloquearScrollModal(true);

    const primerCampo = modal.querySelector("#cliente, input:not([type='hidden']):not(.sr-only-field), textarea, select");
    if (primerCampo && typeof primerCampo.focus === "function") primerCampo.focus({ preventScroll: true });
}

function cerrarAgenda() {
    const modal = document.getElementById("agenda");

    if (modal) {
        modal.style.display = "none";
    }

    bloquearScrollModal(false);
    if (typeof reiniciarEdicionOrden === "function") reiniciarEdicionOrden();
}

/* ==============================
   LIMPIAR FORMULARIO
============================== */

function limpiarFormularioOrden() {
    const campos = [
        "cliente",
        "clienteIdSupabase",
        "direccionIdSupabase",
        "telefono",
        "direccion",
        "calle",
        "numero",
        "piso",
        "departamento",
        "ciudad",
        "provincia",
        "fecha",
        "hora",
        "trabajo",
        "descripcion",
        "prioridad",
        "tecnicoId",
        "tecnicoNombre",
        "categoria",
        "estadoOrden"
    ];

    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (!campo) return;
        campo.value = campo.tagName === "SELECT" ? campo.querySelector("option")?.value || "" : "";
    });
}

/* ==============================
   PINTAR SELECT SEGÚN ESTADO
============================== */

function pintarEstado(selectEstado) {
    if (!selectEstado) return;

    selectEstado.classList.remove(
        "estado-pendiente",
        "estado-proceso",
        "estado-terminado",
        "estado-cancelado"
    );

    switch (selectEstado.value) {
        case "pendiente":
            selectEstado.classList.add("estado-pendiente");
            break;

        case "en proceso":
            selectEstado.classList.add("estado-proceso");
            break;

        case "terminado":
            selectEstado.classList.add("estado-terminado");
            break;

        case "cancelado":
            selectEstado.classList.add("estado-cancelado");
            break;
    }
}

/* ==============================
   MENSAJES
============================== */

function mostrarError(mensaje) {
    alert(mensaje);
}

function confirmar(mensaje) {
    return confirm(mensaje);
}

/* ==============================
   FECHA ACTUAL
============================== */

function obtenerFechaHoy() {
    const hoy = new Date();

    const dia = String(hoy.getDate()).padStart(2, "0");
    const mes = String(hoy.getMonth() + 1).padStart(2, "0");
    const anio = hoy.getFullYear();

    return `${dia}/${mes}/${anio}`;
}

function formatearFechaArgentina(valor, opciones = {}) {
    const texto = String(valor || "").trim();
    const sinFecha = opciones.sinFecha || "Sin fecha";

    if (!texto) return sinFecha;

    const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

    const argentina = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (argentina) return `${argentina[1].padStart(2, "0")}/${argentina[2].padStart(2, "0")}/${argentina[3]}`;

    const fecha = valor instanceof Date ? valor : new Date(texto);
    if (Number.isNaN(fecha.getTime())) return texto;

    const dia = String(fecha.getDate()).padStart(2, "0");
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
}


function formatearFechaConDiaArgentina(valor, opciones = {}) {
    const fechaVisible = formatearFechaArgentina(valor, opciones);
    if (!fechaVisible || fechaVisible === (opciones.sinFecha || "Sin fecha")) return fechaVisible;

    const texto = String(valor || "").trim();
    let fecha = null;
    const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const argentina = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

    if (valor instanceof Date) fecha = valor;
    else if (iso) fecha = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    else if (argentina) fecha = new Date(Number(argentina[3]), Number(argentina[2]) - 1, Number(argentina[1]));
    else fecha = new Date(texto);

    if (!fecha || Number.isNaN(fecha.getTime())) return fechaVisible;
    const diaSemana = fecha.toLocaleDateString("es-AR", { weekday: "long" });
    return `${diaSemana} ${fechaVisible}`;
}
window.formatearFechaArgentina = formatearFechaArgentina;
window.formatearFechaConDiaArgentina = formatearFechaConDiaArgentina;
