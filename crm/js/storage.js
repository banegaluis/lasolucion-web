/* =====================================================
   STORAGE
   La Soluci\u00f3n CRM
   Centraliza el acceso a localStorage
===================================================== */

const STORAGE_KEY = "ordenes";

function normalizarTexto(valor, fallback = "") {
    return typeof valor === "string" ? valor : fallback;
}

function normalizarEstado(estado) {
    const valor = normalizarTexto(estado, "pendiente").toLowerCase();
    return ["pendiente", "en proceso", "terminado", "cancelado"].includes(valor)
        ? valor
        : "pendiente";
}

function construirDireccionNormalizada(orden) {
    const direccionActual = normalizarTexto(orden.direccion);
    const calle = normalizarTexto(orden.calle);
    const numero = normalizarTexto(orden.numero);
    const piso = normalizarTexto(orden.piso, "-") || "-";
    const departamento = normalizarTexto(orden.departamento, "-") || "-";
    const ciudad = normalizarTexto(orden.ciudad, "C\u00f3rdoba") || "C\u00f3rdoba";
    const provincia = normalizarTexto(orden.provincia, "C\u00f3rdoba") || "C\u00f3rdoba";

    if (!calle) return direccionActual;

    const base = [calle, numero].filter(Boolean).join(" ").trim();
    const partes = [base];
    if (piso !== "-") partes.push("Piso " + piso);
    if (departamento !== "-") partes.push("Dpto. " + departamento);
    const parcial = partes.join(", ");
    const lower = parcial.toLowerCase();

    const ciudades = ["c\u00f3rdoba", "cordoba", "argentina", "buenos aires", "santa fe", "mendoza", "san luis", "la pampa", "entre r?os", "entre rios"];
    if (ciudades.some(ciudad => lower.includes(ciudad))) return parcial;
    return parcial + ", " + [ciudad, provincia, "Argentina"].filter(Boolean).join(", ");
}
function normalizarOrden(orden) {
    if (!orden || typeof orden !== "object") return null;

    const trabajo = normalizarTexto(orden.trabajo || orden.descripcion, "Sin descripci\u00f3n");

    return {
        ...orden,
        id: orden.id ?? Date.now(),
        cliente: normalizarTexto(orden.cliente, "Cliente sin nombre"),
        telefono: normalizarTexto(orden.telefono),
        calle: normalizarTexto(orden.calle),
        numero: normalizarTexto(orden.numero),
        piso: normalizarTexto(orden.piso, "-") || "-",
        departamento: normalizarTexto(orden.departamento, "-") || "-",
        ciudad: normalizarTexto(orden.ciudad, "C\u00f3rdoba") || "C\u00f3rdoba",
        provincia: normalizarTexto(orden.provincia, "C\u00f3rdoba") || "C\u00f3rdoba",
        direccion: construirDireccionNormalizada(orden),
        fecha: normalizarTexto(orden.fecha),
        hora: normalizarTexto(orden.hora),
        trabajo,
        descripcion: normalizarTexto(orden.descripcion, trabajo),
        estado: normalizarEstado(orden.estado),
        prioridad: normalizarTexto(orden.prioridad, "normal"),
        tecnicoId: orden.tecnicoId ?? "",
        tecnicoNombre: normalizarTexto(orden.tecnicoNombre || orden.tecnico, "Sin asignar"),
        categoria: normalizarTexto(orden.categoria, "otros").toLowerCase(),
        clienteIdSupabase: orden.clienteIdSupabase ?? "",
        direccionIdSupabase: orden.direccionIdSupabase ?? "",
        direccionSnapshot: orden.direccionSnapshot || null,
        historial: Boolean(orden.historial),
        duracion: Number(orden.duracion) > 0 ? Number(orden.duracion) : 60,
        horaFin: normalizarTexto(orden.horaFin)
    };
}

/* ==============================
   OBTENER TODAS LAS ÓRDENES
============================== */

function obtenerOrdenes() {
    try {
        const datos = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        if (!Array.isArray(datos)) return [];
        return datos.map(normalizarOrden).filter(Boolean);
    }
    catch (error) {
        console.warn("No se pudieron leer las órdenes guardadas.", error);
        return [];
    }
}

/* ==============================
   GUARDAR TODAS LAS ÓRDENES
============================== */

function guardarOrdenes(ordenes) {
    const lista = Array.isArray(ordenes) ? ordenes : [];

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(lista)
    );

    window.dispatchEvent(new CustomEvent("ordenes:actualizadas", {
        detail: { total: lista.length }
    }));
}

/* ==============================
   OBTENER UNA ORDEN POR ID
============================== */

function obtenerOrden(id) {
    return obtenerOrdenes().find(
        orden => String(orden.id) === String(id)
    );
}

/* ==============================
   AGREGAR UNA ORDEN
============================== */

function agregarOrden(orden) {
    const ordenes = obtenerOrdenes();
    ordenes.push(orden);
    guardarOrdenes(ordenes);
}

/* ==============================
   ACTUALIZAR UNA ORDEN
============================== */

function actualizarOrden(id, nuevosDatos) {
    const ordenes = obtenerOrdenes().map(orden => {
        if (String(orden.id) === String(id)) {
            return {
                ...orden,
                ...nuevosDatos
            };
        }

        return orden;
    });

    guardarOrdenes(ordenes);
}

/* ==============================
   ELIMINAR UNA ORDEN
============================== */

function eliminarOrdenStorage(id) {
    const ordenes = obtenerOrdenes().filter(
        orden => String(orden.id) !== String(id)
    );

    guardarOrdenes(ordenes);
}



