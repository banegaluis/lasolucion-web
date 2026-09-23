/* =====================================================
   La Solución CRM
   Módulo: Órdenes
===================================================== */

let ordenEditando = null;
const DURACION_ORDEN_MINUTOS = 60;
const MARGEN_ENTRE_ORDENES_MINUTOS = 30;
const INTERVALO_SUGERIDO_MINUTOS = 30;
const filtrosOrdenesVista = { busqueda: "", estado: "todas" };
const ordenesSupabaseState = {
    ordenes: [],
    porId: new Map(),
    tecnicos: [],
    categorias: [],
    cargando: false,
    mutando: false
};
const clientesOrdenState = {
    sugerencias: [],
    indice: -1,
    seleccionado: null,
    direccion: null,
    buscando: 0,
    debounce: null,
    guardando: false,
    validandoHorario: false,
    duplicados: null,
    crearForzado: false
};

function obtenerValorCampo(id, fallback = "") {
    const campo = document.getElementById(id);
    return campo ? campo.value : fallback;
}

function asignarValorCampo(id, valor) {
    const campo = document.getElementById(id);
    if (campo) campo.value = valor ?? "";
}

function obtenerRolActualOrdenes() {
    if (typeof obtenerRolActualPermisos === "function") return obtenerRolActualPermisos();
    const usuario = typeof obtenerUsuarioActual === "function" ? obtenerUsuarioActual() : null;
    return String(usuario?.rol || "cliente").toLowerCase();
}

function permisoOrdenes(nombre) {
    return window.PERMISOS?.[nombre] || "";
}

function puedeAsignarTecnico() {
    return typeof tienePermiso === "function" && tienePermiso(permisoOrdenes("ORDENES_ASIGNAR_TECNICO"));
}

function usuarioPuedeCrearOrden() {
    return typeof tienePermiso !== "function" || tienePermiso(permisoOrdenes("ORDENES_CREAR"));
}

function usuarioPuedeEditarOrden(orden) {
    return typeof puedeGestionarOrden === "function" && puedeGestionarOrden(permisoOrdenes("ORDENES_EDITAR"), orden);
}

function usuarioPuedeEliminarOrden(orden) {
    return typeof puedeGestionarOrden === "function" && puedeGestionarOrden(permisoOrdenes("ORDENES_ELIMINAR"), orden);
}

function usuarioPuedeCancelarOrden(orden) {
    return typeof puedeGestionarOrden === "function" && (
        puedeGestionarOrden(permisoOrdenes("ORDENES_CANCELAR"), orden) ||
        puedeGestionarOrden(permisoOrdenes("ORDENES_ELIMINAR"), orden)
    );
}

function usuarioPuedeCambiarEstadoOrden(orden) {
    return Boolean(orden) && typeof tienePermiso === "function" && (
        tienePermiso(permisoOrdenes("ORDENES_CAMBIAR_ESTADO")) ||
        tienePermiso(permisoOrdenes("ORDENES_CAMBIAR_ESTADO_TECNICO"))
    );
}

function usuarioPuedeContactarOrden(orden) {
    return Boolean(orden) && (typeof tienePermiso !== "function" || tienePermiso(permisoOrdenes("ORDENES_CONTACTAR")));
}

function obtenerOrdenesAutorizadas() {
    return ordenesSupabaseState.ordenes;
}

function obtenerOrdenAutorizada(id) {
    return ordenesSupabaseState.porId.get(String(id)) || null;
}

function denegarAccionOrden() {
    if (typeof alertarPermisoDenegado === "function") alertarPermisoDenegado();
}

function actualizarPermisosFormularioOrden() {
    const puedeAsignar = puedeAsignarTecnico();
    document.querySelectorAll('[data-permission="assign-technician"]').forEach(contenedor => {
        contenedor.hidden = !puedeAsignar;
        contenedor.querySelectorAll("input, select, textarea, button").forEach(campo => {
            campo.disabled = !puedeAsignar;
        });
    });
}

function configurarFormularioOrden() {
    actualizarPermisosFormularioOrden();
    if (!ordenEditando) {
        asignarValorCampo("estadoOrden", "pendiente");
        if (!obtenerValorCampo("ciudad").trim()) asignarValorCampo("ciudad", "C\u00f3rdoba");
        if (!obtenerValorCampo("provincia").trim()) asignarValorCampo("provincia", "C\u00f3rdoba");
    }
    configurarRestriccionesHorarioOrden();
    sincronizarNombreTecnicoSeleccionado();
    inicializarAutocompleteClientesOrden();
}

function sincronizarNombreTecnicoSeleccionado() {
    const selector = document.getElementById("tecnicoId");
    if (!selector) return;
    asignarValorCampo("tecnicoNombre", selector.selectedOptions?.[0]?.textContent || "Sin asignar");
    if (selector.dataset.nombreTecnico !== "true") {
        selector.dataset.nombreTecnico = "true";
        selector.addEventListener("change", sincronizarNombreTecnicoSeleccionado);
    }
}

function estadoDBALocalOrden(estado) {
    return String(estado || "pendiente").toLowerCase() === "en_proceso" ? "en proceso" : String(estado || "pendiente").toLowerCase();
}

function normalizarHoraOrdenDB(hora) {
    const coincidencia = String(hora || "").match(/^(\d{2}):(\d{2})/);
    return coincidencia ? `${coincidencia[1]}:${coincidencia[2]}` : "";
}

function normalizarRelacionOrden(relacion) {
    return Array.isArray(relacion) ? relacion[0] : relacion;
}

function mapearOrdenSupabase(orden) {
    const cliente = normalizarRelacionOrden(orden.clientes);
    const direccion = normalizarRelacionOrden(orden.direcciones_clientes);
    const tecnico = normalizarRelacionOrden(orden.tecnicos);
    const perfilTecnico = normalizarRelacionOrden(tecnico?.perfiles);
    const categoria = normalizarRelacionOrden(orden.categorias_trabajo);
    const tecnicoNombre = [perfilTecnico?.nombre, perfilTecnico?.apellido].filter(Boolean).join(" ").trim();
    const snapshot = orden.direccion_snapshot || {};
    const direccionCompleta = direccion?.direccion_completa || construirDireccion(
        direccion?.calle || snapshot.calle || "",
        direccion?.numero || snapshot.numero || "",
        direccion?.piso || snapshot.piso || "-",
        direccion?.departamento || snapshot.departamento || "-",
        direccion?.ciudad || snapshot.ciudad || "Córdoba",
        direccion?.provincia || snapshot.provincia || "Córdoba",
        snapshot.direccion || ""
    );
    const estado = estadoDBALocalOrden(orden.estado);

    return {
        id: orden.id,
        numeroOrden: orden.numero_orden,
        clienteId: orden.cliente_id,
        clienteIdSupabase: orden.cliente_id,
        direccionIdSupabase: orden.direccion_cliente_id || "",
        cliente: cliente?.nombre_completo || "Cliente sin nombre",
        telefono: orden.telefono_contacto || cliente?.telefono_principal || "",
        calle: direccion?.calle || snapshot.calle || "",
        numero: direccion?.numero || snapshot.numero || "",
        piso: direccion?.piso || snapshot.piso || "-",
        departamento: direccion?.departamento || snapshot.departamento || "-",
        ciudad: direccion?.ciudad || snapshot.ciudad || "Córdoba",
        provincia: direccion?.provincia || snapshot.provincia || "Córdoba",
        direccion: direccionCompleta || "Sin dirección",
        fecha: orden.fecha_programada || "",
        hora: normalizarHoraOrdenDB(orden.hora_inicio),
        horaFin: normalizarHoraOrdenDB(orden.hora_fin),
        trabajo: orden.titulo || orden.descripcion_solicitud || "Sin descripción",
        descripcion: orden.descripcion_solicitud || orden.titulo || "",
        estado,
        prioridad: orden.prioridad || "media",
        tecnicoId: orden.tecnico_id || "",
        tecnicoNombre: tecnicoNombre || tecnico?.especialidad || "Sin asignar",
        categoriaId: orden.categoria_id || "",
        categoria: categoria?.nombre || categoria?.slug || "Sin categoría",
        createdAt: orden.created_at,
        updatedAt: orden.updated_at,
        historial: ["terminado", "cancelado"].includes(estado),
        raw: orden
    };
}

function guardarOrdenEnEstado(orden) {
    const normalizada = mapearOrdenSupabase(orden);
    const indice = ordenesSupabaseState.ordenes.findIndex(item => String(item.id) === String(normalizada.id));
    if (indice >= 0) ordenesSupabaseState.ordenes.splice(indice, 1, normalizada);
    else ordenesSupabaseState.ordenes.push(normalizada);
    ordenesSupabaseState.porId.set(String(normalizada.id), normalizada);
    return normalizada;
}

function nombreTecnicoOrden(tecnico) {
    const perfil = normalizarRelacionOrden(tecnico?.perfiles);
    return [perfil?.nombre, perfil?.apellido].filter(Boolean).join(" ").trim() ||
        tecnico?.especialidad ||
        "Técnico";
}

function completarSelectorOrden(id, opciones, valorActual = "") {
    const selector = document.getElementById(id);
    if (!selector) return;
    selector.replaceChildren();
    const vacia = document.createElement("option");
    vacia.value = "";
    vacia.textContent = id === "tecnicoId" ? "Sin asignar" : "Sin categoría";
    selector.appendChild(vacia);
    opciones.forEach(opcion => {
        const elemento = document.createElement("option");
        elemento.value = opcion.id;
        elemento.textContent = opcion.nombre;
        selector.appendChild(elemento);
    });
    selector.value = valorActual || "";
}

async function cargarCatalogosOrdenes() {
    const servicio = window.OrdenesSupabaseService;
    if (!servicio) return;
    const [tecnicos, categorias] = await Promise.all([
        servicio.listarTecnicos?.(),
        servicio.listarCategorias?.()
    ]);

    if (tecnicos?.ok) {
        ordenesSupabaseState.tecnicos = tecnicos.data || [];
        completarSelectorOrden(
            "tecnicoId",
            ordenesSupabaseState.tecnicos.map(tecnico => ({ id: tecnico.id, nombre: nombreTecnicoOrden(tecnico) })),
            obtenerValorCampo("tecnicoId")
        );
    } else if (puedeAsignarTecnico()) {
        console.error("[Órdenes] No se pudo consultar técnicos", {
            code: tecnicos?.error?.code || null,
            message: textoErrorOrden(tecnicos?.error)
        });
    }

    if (categorias?.ok) {
        ordenesSupabaseState.categorias = categorias.data || [];
        completarSelectorOrden(
            "categoria",
            ordenesSupabaseState.categorias.map(categoria => ({ id: categoria.id, nombre: categoria.nombre || categoria.slug })),
            obtenerValorCampo("categoria")
        );
    } else {
        console.error("[Órdenes] No se pudo consultar categorías", {
            code: categorias?.error?.code || null,
            message: textoErrorOrden(categorias?.error)
        });
    }
    sincronizarNombreTecnicoSeleccionado();
}

function renderizarHistorialRealOrden(historial) {
    const panel = document.getElementById("ordenHistorialReal");
    const contenido = document.getElementById("ordenHistorialRealContenido");
    if (!panel || !contenido) return;
    if (!ordenEditando) {
        panel.hidden = true;
        contenido.replaceChildren();
        return;
    }

    panel.hidden = false;
    contenido.replaceChildren();
    if (!historial.length) {
        const vacio = document.createElement("p");
        vacio.textContent = "Todavía no hay movimientos registrados.";
        contenido.appendChild(vacio);
        return;
    }

    historial.forEach(movimiento => {
        const item = document.createElement("article");
        item.className = "order-history-item";
        const titulo = document.createElement("strong");
        titulo.textContent = movimiento.descripcion || movimiento.tipo_evento || "Cambio de orden";
        const detalle = document.createElement("span");
        const cambioEstado = movimiento.estado_nuevo
            ? ` · ${etiquetaEstadoOrden(estadoDBALocalOrden(movimiento.estado_nuevo))}`
            : "";
        detalle.textContent = `${new Date(movimiento.created_at).toLocaleString("es-AR")}${cambioEstado}`;
        item.append(titulo, detalle);
        contenido.appendChild(item);
    });
}

function configurarRestriccionesHorarioOrden() {
    const fecha = document.getElementById("fecha");
    const hora = document.getElementById("hora");
    if (!fecha || !hora) return;

    const ahora = new Date();
    const hoy = fechaLocalOrden(ahora);
    fecha.min = hoy;
    actualizarMinimoHoraOrden();

    if (fecha.dataset.restriccionHorario !== "true") {
        fecha.dataset.restriccionHorario = "true";
        fecha.addEventListener("change", actualizarMinimoHoraOrden);
    }
}

function actualizarMinimoHoraOrden() {
    const fecha = document.getElementById("fecha");
    const hora = document.getElementById("hora");
    if (!fecha || !hora) return;
    const ahora = new Date();
    hora.min = fecha.value === fechaLocalOrden(ahora) ? horaLocalOrden(sumarMinutosOrden(ahora, 1)) : "00:00";
    hora.max = "22:29";
}

function obtenerHorarioInicialOrden(fechaSugerida = "", horaSugerida = "") {
    const ahora = new Date();
    const horaBase = horaSugerida || (/^\d{4}-\d{2}-\d{2}$/.test(fechaSugerida) ? "08:00" : "");
    const sugerida = fechaHoraLocalOrden(fechaSugerida, horaBase);
    const fechaValida = sugerida && sugerida.getTime() > ahora.getTime() ? sugerida : redondearFuturoOrden(ahora);
    return {
        fecha: fechaLocalOrden(fechaValida),
        hora: horaLocalOrden(fechaValida)
    };
}

function redondearFuturoOrden(fecha) {
    const resultado = new Date(fecha);
    resultado.setSeconds(0, 0);
    const minutos = resultado.getMinutes();
    const siguienteBloque = Math.ceil((minutos + 1) / INTERVALO_SUGERIDO_MINUTOS) * INTERVALO_SUGERIDO_MINUTOS;
    resultado.setMinutes(siguienteBloque, 0, 0);
    return resultado;
}

function fechaHoraLocalOrden(fecha, hora) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || "")) || !/^\d{2}:\d{2}$/.test(String(hora || ""))) return null;
    const [anio, mes, dia] = fecha.split("-").map(Number);
    const [horas, minutos] = hora.split(":").map(Number);
    const resultado = new Date(anio, mes - 1, dia, horas, minutos, 0, 0);
    return Number.isNaN(resultado.getTime()) ? null : resultado;
}

function fechaLocalOrden(fecha) {
    return [fecha.getFullYear(), String(fecha.getMonth() + 1).padStart(2, "0"), String(fecha.getDate()).padStart(2, "0")].join("-");
}

function horaLocalOrden(fecha) {
    return [String(fecha.getHours()).padStart(2, "0"), String(fecha.getMinutes()).padStart(2, "0")].join(":");
}

function sumarMinutosOrden(fecha, minutos) {
    return new Date(fecha.getTime() + minutos * 60000);
}

function horaFinOrden(horaInicio) {
    const [horas, minutos] = String(horaInicio || "").split(":").map(Number);
    const total = horas * 60 + minutos + DURACION_ORDEN_MINUTOS;
    if (!Number.isFinite(total) || total >= 1440) return "";
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function validarHorarioFuturoOrden(fecha, hora) {
    const inicio = fechaHoraLocalOrden(fecha, hora);
    if (!inicio) return { ok: false, error: "La fecha y hora de inicio no son válidas." };
    if (inicio.getTime() <= Date.now()) {
        return { ok: false, error: "La orden debe programarse para una fecha y hora futuras." };
    }
    const horaFin = horaFinOrden(hora);
    const [horas, minutos] = hora.split(":").map(Number);
    if (!horaFin || horas * 60 + minutos + DURACION_ORDEN_MINUTOS + MARGEN_ENTRE_ORDENES_MINUTOS >= 1440) {
        return { ok: false, error: "La última hora de inicio permitida es 22:29 para reservar una hora de trabajo y 30 minutos de margen." };
    }
    return { ok: true, horaFin };
}

function obtenerDatosDireccion() {
    const calle = obtenerValorCampo("calle").trim();
    const numero = obtenerValorCampo("numero").trim();
    const piso = obtenerValorCampo("piso").trim() || "-";
    const departamento = obtenerValorCampo("departamento").trim() || "-";
    const ciudad = obtenerValorCampo("ciudad").trim() || "C\u00f3rdoba";
    const provincia = obtenerValorCampo("provincia").trim() || "C\u00f3rdoba";
    const direccionManual = obtenerValorCampo("direccion").trim();
    const direccion = construirDireccion(calle, numero, piso, departamento, ciudad, provincia, direccionManual);

    return { calle, numero, piso, departamento, ciudad, provincia, direccion };
}

function snapshotDireccionOrden(datosDireccion) {
    return {
        calle: datosDireccion.calle,
        numero: datosDireccion.numero,
        piso: datosDireccion.piso,
        departamento: datosDireccion.departamento,
        ciudad: datosDireccion.ciudad,
        provincia: datosDireccion.provincia
    };
}

function esUuidOrden(valor) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(valor || "").trim());
}

function normalizarEstadoOrdenSupabase(estado) {
    const estados = {
        pendiente: "pendiente",
        "en proceso": "en_proceso",
        en_proceso: "en_proceso",
        terminado: "terminado",
        cancelado: "cancelado"
    };
    return estados[String(estado || "").trim().toLowerCase()] || "pendiente";
}

function normalizarPrioridadOrdenSupabase(prioridad) {
    const valor = String(prioridad || "").trim().toLowerCase();
    if (valor === "normal") return "media";
    return ["baja", "media", "alta", "urgente"].includes(valor) ? valor : "media";
}

function construirPayloadNuevaOrden(datosOrden, clienteSupabase, datosDireccion) {
    const tecnicoId = esUuidOrden(datosOrden.tecnicoId) ? datosOrden.tecnicoId : null;
    const categoriaId = esUuidOrden(datosOrden.categoria) ? datosOrden.categoria : null;

    return {
        cliente_id: clienteSupabase.clienteId,
        direccion_cliente_id: esUuidOrden(clienteSupabase.direccionId) ? clienteSupabase.direccionId : null,
        tecnico_id: tecnicoId,
        categoria_id: categoriaId,
        titulo: datosOrden.trabajo,
        descripcion_solicitud: datosOrden.descripcion || datosOrden.trabajo,
        descripcion_trabajo_realizado: null,
        telefono_contacto: datosOrden.telefono || null,
        direccion_snapshot: snapshotDireccionOrden(datosDireccion),
        fecha_programada: datosOrden.fecha || null,
        hora_inicio: datosOrden.hora || null,
        hora_fin: datosOrden.horaFin || horaFinOrden(datosOrden.hora),
        estado: normalizarEstadoOrdenSupabase(datosOrden.estado),
        prioridad: normalizarPrioridadOrdenSupabase(datosOrden.prioridad),
        notas_internas: null
    };
}

function construirPayloadActualizacionOrden(datosOrden, clienteSupabase, datosDireccion) {
    return {
        cliente_id: clienteSupabase.clienteId,
        direccion_cliente_id: esUuidOrden(clienteSupabase.direccionId) ? clienteSupabase.direccionId : null,
        tecnico_id: esUuidOrden(datosOrden.tecnicoId) ? datosOrden.tecnicoId : null,
        categoria_id: esUuidOrden(datosOrden.categoria) ? datosOrden.categoria : null,
        titulo: datosOrden.trabajo,
        descripcion_solicitud: datosOrden.descripcion || datosOrden.trabajo,
        telefono_contacto: datosOrden.telefono || null,
        direccion_snapshot: snapshotDireccionOrden(datosDireccion),
        fecha_programada: datosOrden.fecha || null,
        hora_inicio: datosOrden.hora || null,
        hora_fin: datosOrden.horaFin || horaFinOrden(datosOrden.hora),
        estado: normalizarEstadoOrdenSupabase(datosOrden.estado),
        prioridad: normalizarPrioridadOrdenSupabase(datosOrden.prioridad)
    };
}

function obtenerBotonGuardarOrden() {
    return document.querySelector("#agenda .btn-guardar");
}

function actualizarGuardadoVisualOrden(guardando) {
    const boton = obtenerBotonGuardarOrden();
    if (!boton) return;
    if (!boton.dataset.textoOriginal) boton.dataset.textoOriginal = boton.textContent.trim() || "Guardar orden";
    boton.disabled = guardando;
    boton.textContent = guardando ? "Guardando…" : boton.dataset.textoOriginal;
}

function finalizarGuardadoOrden() {
    clientesOrdenState.guardando = false;
    actualizarGuardadoVisualOrden(false);
}

function resetearClienteFormularioOrden() {
    clientesOrdenState.seleccionado = null;
    clientesOrdenState.direccion = null;
    clientesOrdenState.sugerencias = [];
    clientesOrdenState.indice = -1;
    clientesOrdenState.duplicados = null;
    clientesOrdenState.crearForzado = false;
    asignarValorCampo("clienteIdSupabase", "");
    asignarValorCampo("direccionIdSupabase", "");
}

function construirDireccion(calle, numero, piso = "-", departamento = "-", ciudad = "C\u00f3rdoba", provincia = "C\u00f3rdoba", direccionManual = "") {
    const base = [calle, numero].filter(Boolean).join(" ").trim();
    const direccionBase = base || direccionManual.trim();

    if (!direccionBase) return "";
    if (!base && direccionManual) return direccionManual;

    const partes = [direccionBase];
    if (piso && piso !== "-") partes.push("Piso " + piso);
    if (departamento && departamento !== "-") partes.push("Dpto. " + departamento);

    const direccionParcial = partes.join(", ");
    if (direccionTieneCiudad(direccionParcial)) return direccionParcial;

    const ubicacion = [ciudad || "C\u00f3rdoba", provincia || "C\u00f3rdoba", "Argentina"].filter(Boolean).join(", ");
    return direccionParcial + ", " + ubicacion;
}

function direccionTieneCiudad(direccion) {
    const texto = String(direccion || "").toLowerCase();
    const ciudades = ["c\u00f3rdoba", "cordoba", "argentina", "buenos aires", "santa fe", "mendoza", "san luis", "la pampa", "entre r?os", "entre rios"];
    return ciudades.some(ciudad => texto.includes(ciudad));
}

/* =====================================================
   EDITAR ORDEN
===================================================== */

async function editarOrden(id) {
    if (!esUuidOrden(id) || ordenesSupabaseState.mutando) return;
    if (!window.OrdenesSupabaseService?.obtenerOrdenConHistorial) {
        alert("No se pudo abrir la orden porque el servicio de Supabase no está disponible.");
        return;
    }

    const resultado = await window.OrdenesSupabaseService.obtenerOrdenConHistorial(id);
    if (!resultado?.ok || !resultado.data) {
        console.error("[Órdenes] No se pudo abrir el detalle", {
            code: resultado?.error?.code || null,
            message: textoErrorOrden(resultado?.error)
        });
        alert("No se pudo consultar el detalle actual de la orden.");
        return;
    }

    if (!ordenesSupabaseState.categorias.length) await cargarCatalogosOrdenes();
    const orden = guardarOrdenEnEstado(resultado.data);
    ordenEditando = orden.id;

    clientesOrdenState.seleccionado = orden.clienteIdSupabase ? { id: orden.clienteIdSupabase, nombre_completo: orden.cliente, telefono_principal: orden.telefono } : null;
    clientesOrdenState.direccion = orden.direccionIdSupabase ? { id: orden.direccionIdSupabase, direccion_completa: orden.direccion } : null;
    asignarValorCampo("cliente", orden.cliente);
    asignarValorCampo("clienteIdSupabase", orden.clienteIdSupabase || "");
    asignarValorCampo("direccionIdSupabase", orden.direccionIdSupabase || "");
    asignarValorCampo("telefono", orden.telefono);
    asignarValorCampo("direccion", orden.direccion);
    asignarValorCampo("calle", orden.calle || orden.direccion);
    asignarValorCampo("numero", orden.numero || "");
    asignarValorCampo("piso", orden.piso && orden.piso !== "-" ? orden.piso : "");
    asignarValorCampo("departamento", orden.departamento && orden.departamento !== "-" ? orden.departamento : "");
    asignarValorCampo("ciudad", orden.ciudad || "C\u00f3rdoba");
    asignarValorCampo("provincia", orden.provincia || "C\u00f3rdoba");
    asignarValorCampo("fecha", orden.fecha);
    asignarValorCampo("hora", orden.hora);
    asignarValorCampo("trabajo", orden.trabajo);
    asignarValorCampo("descripcion", orden.descripcion);
    asignarValorCampo("prioridad", orden.prioridad || "media");
    asignarValorCampo("tecnicoId", orden.tecnicoId || "");
    asignarValorCampo("tecnicoNombre", orden.tecnicoNombre || "Sin asignar");
    asignarValorCampo("categoria", orden.categoriaId || "");
    asignarValorCampo("estadoOrden", orden.estado || "pendiente");

    actualizarPermisosFormularioOrden();
    renderizarHistorialRealOrden(resultado.historial || []);
    abrirAgenda();
}

/* =====================================================
   GUARDAR ORDEN
===================================================== */

async function guardarOrden() {
    if (clientesOrdenState.guardando || clientesOrdenState.validandoHorario) return;

    const datosDireccion = obtenerDatosDireccion();
    const ordenActual = ordenEditando ? obtenerOrdenAutorizada(ordenEditando) : null;

    if (ordenEditando && !usuarioPuedeEditarOrden(ordenActual)) {
        denegarAccionOrden();
        return;
    }

    if (!ordenEditando && !usuarioPuedeCrearOrden()) {
        denegarAccionOrden();
        return;
    }

    const puedeAsignar = puedeAsignarTecnico();
    const tecnicoId = puedeAsignar ? obtenerValorCampo("tecnicoId").trim() : (ordenActual?.tecnicoId || "");
    const tecnicoNombre = puedeAsignar
        ? (obtenerValorCampo("tecnicoNombre", "Sin asignar").trim() || "Sin asignar")
        : (ordenActual?.tecnicoNombre || "Sin asignar");

    const datosOrden = {
        cliente: obtenerValorCampo("cliente").trim(),
        telefono: obtenerValorCampo("telefono").trim(),
        ...datosDireccion,
        fecha: obtenerValorCampo("fecha"),
        hora: obtenerValorCampo("hora"),
        trabajo: obtenerValorCampo("trabajo").trim(),
        descripcion: obtenerValorCampo("descripcion").trim(),
        prioridad: obtenerValorCampo("prioridad", "media") || "media",
        estado: obtenerValorCampo("estadoOrden", "pendiente") || "pendiente",
        tecnicoId,
        tecnicoNombre,
        categoria: obtenerValorCampo("categoria", "otros") || "otros"
    };

    if (
        !datosOrden.cliente ||
        !datosOrden.telefono ||
        !datosOrden.direccion ||
        !datosOrden.fecha ||
        !datosOrden.hora ||
        !datosOrden.trabajo
    ) {
        alert("Tenés que completar todos los datos mínimos de la orden.");
        return;
    }

    if (!ordenEditando) {
        const horario = validarHorarioFuturoOrden(datosOrden.fecha, datosOrden.hora);
        if (!horario.ok) {
            alert(horario.error);
            return;
        }
        datosOrden.horaFin = horario.horaFin;

        if (!window.OrdenesSupabaseService?.consultarConflictosHorario) {
            alert("No se pudo verificar la disponibilidad del horario.");
            return;
        }

        clientesOrdenState.validandoHorario = true;
        actualizarGuardadoVisualOrden(true);
        let disponibilidad;
        try {
            disponibilidad = await window.OrdenesSupabaseService.consultarConflictosHorario(
                datosOrden.fecha,
                datosOrden.hora,
                DURACION_ORDEN_MINUTOS,
                MARGEN_ENTRE_ORDENES_MINUTOS
            );
        } finally {
            clientesOrdenState.validandoHorario = false;
            actualizarGuardadoVisualOrden(false);
        }
        if (!disponibilidad?.ok) {
            console.error("[Nueva Orden] Error al verificar horario", {
                code: disponibilidad?.error?.code || null,
                message: textoErrorOrden(disponibilidad?.error)
            });
            alert("No se pudo verificar si el horario está disponible. Intentá nuevamente.");
            return;
        }

        if (disponibilidad.data.length) {
            const existentes = disponibilidad.data
                .map(orden => `Orden N.º ${orden.numero_orden} a las ${String(orden.hora_inicio).slice(0, 5)}`)
                .join("\n");
            const aceptaSuperposicion = confirm(
                `Ya existe una orden dentro del bloque operativo de 1 hora más 30 minutos de margen:\n\n${existentes}\n\n¿Querés crearla igualmente en el horario ${datosOrden.hora}?`
            );
            if (!aceptaSuperposicion) return;
        }
    }

    clientesOrdenState.guardando = true;
    actualizarGuardadoVisualOrden(true);
    if (!datosOrden.descripcion) datosOrden.descripcion = datosOrden.trabajo;

    let clienteSupabase;
    try {
        clienteSupabase = await resolverClienteSupabaseParaOrden(datosOrden, datosDireccion);
    } catch (error) {
        console.error("[Nueva Orden] Error al resolver cliente", {
            code: error?.code,
            message: error?.message || "Error inesperado"
        });
        finalizarGuardadoOrden();
        mostrarErrorClienteOrden("No se pudo validar el cliente en Supabase.");
        return;
    }
    if (!clienteSupabase.ok) {
        finalizarGuardadoOrden();
        mostrarErrorClienteOrden(clienteSupabase.error || "No se pudo validar el cliente en Supabase.");
        return;
    }

    datosOrden.clienteIdSupabase = clienteSupabase.clienteId || "";
    datosOrden.direccionIdSupabase = clienteSupabase.direccionId || "";
    datosOrden.direccionSnapshot = snapshotDireccionOrden(datosDireccion);

    if (ordenEditando) {
        const idOrden = ordenEditando;
        if (!esUuidOrden(idOrden) || !window.OrdenesSupabaseService?.actualizarOrden) {
            finalizarGuardadoOrden();
            alert("No se obtuvo un UUID válido para actualizar la orden.");
            return;
        }
        const payload = construirPayloadActualizacionOrden(datosOrden, clienteSupabase, datosDireccion);
        let actualizacion;
        try {
            actualizacion = await window.OrdenesSupabaseService.actualizarOrden(idOrden, payload);
        } catch (error) {
            actualizacion = { ok: false, data: null, error };
        }
        if (!actualizacion?.ok || !actualizacion.data) {
            finalizarGuardadoOrden();
            console.error("[Órdenes] Error al actualizar", {
                code: actualizacion?.error?.code || null,
                message: textoErrorOrden(actualizacion?.error)
            });
            alert("No se pudieron guardar los cambios en Supabase.");
            return;
        }
        guardarOrdenEnEstado(actualizacion.data);
        const verificacion = await window.OrdenesSupabaseService.obtenerOrdenConHistorial(idOrden);
        if (verificacion?.ok && verificacion.data) guardarOrdenEnEstado(verificacion.data);
        ordenEditando = null;
        finalizarGuardadoOrden();
        resetearClienteFormularioOrden();
        limpiarFormularioOrden();
        renderizarHistorialRealOrden([]);
        cerrarAgenda();
        await cargarOrdenes();
        alert("Orden actualizada correctamente.");
        return;
    }

    if (!esUuidOrden(clienteSupabase.clienteId)) {
        finalizarGuardadoOrden();
        mostrarErrorClienteOrden("No se obtuvo un cliente válido para crear la orden.");
        return;
    }

    if (!window.OrdenesSupabaseService?.crearOrden) {
        finalizarGuardadoOrden();
        mostrarErrorClienteOrden("El servicio de órdenes Supabase no está disponible.");
        return;
    }

    const payload = construirPayloadNuevaOrden(datosOrden, clienteSupabase, datosDireccion);
    let resultado;
    try {
        resultado = await window.OrdenesSupabaseService.crearOrden(payload);
    } catch (error) {
        resultado = { ok: false, data: null, error };
    }
    if (!resultado?.ok || !resultado.data) {
        const error = resultado?.error;
        console.error("[Nueva Orden] Error al crear orden", {
            code: error?.code,
            message: error?.message || textoErrorOrden(error)
        });
        finalizarGuardadoOrden();
        mostrarErrorClienteOrden(textoErrorOrden(error || "No se pudo crear la orden en Supabase."));
        return;
    }

    const ordenCreada = resultado.data;
    if (ordenCreada?.id) {
        const creadaCompleta = await window.OrdenesSupabaseService.obtenerOrden(ordenCreada.id);
        if (creadaCompleta?.ok && creadaCompleta.data) guardarOrdenEnEstado(creadaCompleta.data);
    }
    finalizarGuardadoOrden();
    resetearClienteFormularioOrden();
    limpiarFormularioOrden();
    cerrarAgenda();
    await cargarOrdenes();
    alert(`Orden N.º ${ordenCreada.numero_orden} creada correctamente`);
}

function inicializarAutocompleteClientesOrden() {
    const input = document.getElementById("cliente");
    const sugerencias = document.getElementById("clienteSugerencias");
    if (!input || !sugerencias || input.dataset.clientesAutocomplete === "true") return;

    input.dataset.clientesAutocomplete = "true";
    input.addEventListener("input", () => {
        clientesOrdenState.seleccionado = null;
        clientesOrdenState.direccion = null;
        asignarValorCampo("clienteIdSupabase", "");
        asignarValorCampo("direccionIdSupabase", "");
        programarBusquedaClientesOrden(input.value);
    });
    input.addEventListener("keydown", manejarTecladoClientesOrden);
    sugerencias.addEventListener("click", manejarClickClientesOrden);
    document.addEventListener("click", (evento) => {
        if (!sugerencias.contains(evento.target) && evento.target !== input) sugerencias.hidden = true;
    });
}

function programarBusquedaClientesOrden(valor) {
    clearTimeout(clientesOrdenState.debounce);
    clientesOrdenState.debounce = setTimeout(() => buscarClientesOrden(valor), 250);
}

async function buscarClientesOrden(valor) {
    const texto = String(valor || "").trim();
    const contenedor = document.getElementById("clienteSugerencias");
    if (!contenedor || !texto) {
        if (contenedor) contenedor.hidden = true;
        return;
    }

    const token = ++clientesOrdenState.buscando;
    console.log("[Nueva Orden] b?squeda iniciada");
    contenedor.hidden = false;
    contenedor.innerHTML = '<div class="cliente-suggestion-message">Buscando clientes...</div>';

    const resultado = await window.ClientesSupabaseService?.buscarClientes?.(texto, 8);
    if (token !== clientesOrdenState.buscando) return;

    if (!resultado?.ok) {
        console.error("[Nueva Orden] Error al buscar clientes", {
            code: resultado?.error?.code,
            message: resultado?.error?.message || textoErrorOrden(resultado?.error || "No se pudo buscar clientes.")
        });
        contenedor.hidden = false;
        contenedor.innerHTML = `<div class="cliente-suggestion-message is-error">${escaparHtmlOrden(textoErrorOrden(resultado?.error || "No se pudo buscar clientes."))}</div>`;
        return;
    }

    clientesOrdenState.sugerencias = resultado.data || [];
    console.log("[Nueva Orden] cantidad de clientes encontrados:", clientesOrdenState.sugerencias.length);
    clientesOrdenState.indice = clientesOrdenState.sugerencias.length ? 0 : -1;
    renderizarSugerenciasClientesOrden();
}

function renderizarSugerenciasClientesOrden() {
    const contenedor = document.getElementById("clienteSugerencias");
    if (!contenedor) return;
    if (!clientesOrdenState.sugerencias.length) {
        contenedor.hidden = false;
        contenedor.innerHTML = `<div class="cliente-suggestion-message">No se encontr? el cliente. Crear nuevo cliente</div>`;
        return;
    }

    contenedor.hidden = false;
    contenedor.innerHTML = clientesOrdenState.sugerencias.map((cliente, index) => {
        const direccion = direccionPrincipalOrden(cliente);
        return `
            <button type="button" class="cliente-suggestion ${index === clientesOrdenState.indice ? "is-active" : ""}" data-client-index="${index}">
                <strong>${escaparHtmlOrden(nombreClienteOrden(cliente))}</strong>
                <span>${escaparHtmlOrden(cliente.telefono_principal || "")}</span>
                <small>${escaparHtmlOrden(direccion?.direccion_completa || "Sin dirección principal")}</small>
            </button>
        `;
    }).join("");
}

function nombreClienteOrden(cliente) {
    return cliente?.nombre_completo || [cliente?.nombre, cliente?.apellido].filter(Boolean).join(" ") || "";
}

function direccionPrincipalOrden(cliente) {
    return (cliente.direcciones_clientes || []).find(d => d.activo && d.es_principal) ||
        (cliente.direcciones_clientes || []).find(d => d.activo) ||
        null;
}

function manejarTecladoClientesOrden(evento) {
    const total = clientesOrdenState.sugerencias.length;
    if (!total) return;
    if (evento.key === "ArrowDown") {
        evento.preventDefault();
        clientesOrdenState.indice = (clientesOrdenState.indice + 1) % total;
        renderizarSugerenciasClientesOrden();
    }
    if (evento.key === "ArrowUp") {
        evento.preventDefault();
        clientesOrdenState.indice = (clientesOrdenState.indice - 1 + total) % total;
        renderizarSugerenciasClientesOrden();
    }
    if (evento.key === "Enter" && document.activeElement?.id === "cliente") {
        evento.preventDefault();
        seleccionarClienteOrden(clientesOrdenState.sugerencias[clientesOrdenState.indice]);
    }
    if (evento.key === "Escape") {
        document.getElementById("clienteSugerencias").hidden = true;
    }
}

function manejarClickClientesOrden(evento) {
    const duplicateIndex = evento.target.closest("[data-duplicate-index]")?.dataset.duplicateIndex;
    if (duplicateIndex !== undefined) {
        const item = clientesOrdenState.duplicados?.[Number(duplicateIndex)];
        if (item?.cliente) seleccionarClienteOrden(item.cliente);
        return;
    }
    if (evento.target.closest("[data-duplicate-review]")) {
        buscarClientesOrden(obtenerValorCampo("cliente"));
        return;
    }
    if (evento.target.closest("[data-duplicate-create]")) {
        clientesOrdenState.crearForzado = true;
        guardarOrden();
        return;
    }
    const index = evento.target.closest("[data-client-index]")?.dataset.clientIndex;
    if (index === undefined) return;
    seleccionarClienteOrden(clientesOrdenState.sugerencias[Number(index)]);
}

function seleccionarClienteOrden(cliente, direccion = null) {
    if (!cliente) return;
    const principal = direccion || direccionPrincipalOrden(cliente);
    clientesOrdenState.seleccionado = cliente;
    clientesOrdenState.direccion = principal;
    asignarValorCampo("cliente", nombreClienteOrden(cliente) || "");
    asignarValorCampo("clienteIdSupabase", cliente.id || "");
    console.log("[Nueva Orden] cliente seleccionado:", cliente.id);
    asignarValorCampo("telefono", cliente.telefono_principal || "");
    asignarValorCampo("direccionIdSupabase", principal?.id || "");
    if (principal) {
        asignarValorCampo("calle", principal.calle || "");
        asignarValorCampo("numero", principal.numero || "");
        asignarValorCampo("piso", principal.piso || "");
        asignarValorCampo("departamento", principal.departamento || "");
        asignarValorCampo("ciudad", principal.ciudad || "Córdoba");
        asignarValorCampo("provincia", principal.provincia || "Córdoba");
        asignarValorCampo("direccion", principal.direccion_completa || "");
    }
    const contenedor = document.getElementById("clienteSugerencias");
    if (contenedor) contenedor.hidden = true;
}

function mostrarErrorClienteOrden(texto) {
    const contenedor = document.getElementById("clienteSugerencias");
    if (!contenedor) {
        alert(texto);
        return;
    }
    contenedor.hidden = false;
    contenedor.innerHTML = `<div class="cliente-suggestion-message is-error">${escaparHtmlOrden(texto)}</div>`;
}

function escaparHtmlOrden(valor) {
    return String(valor || "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function direccionParaSupabase(datosDireccion) {
    return {
        alias: "Principal",
        calle: datosDireccion.calle || datosDireccion.direccion,
        numero: datosDireccion.numero,
        piso: datosDireccion.piso && datosDireccion.piso !== "-" ? datosDireccion.piso : "",
        departamento: datosDireccion.departamento && datosDireccion.departamento !== "-" ? datosDireccion.departamento : "",
        ciudad: datosDireccion.ciudad,
        provincia: datosDireccion.provincia,
        direccion_completa: datosDireccion.direccion
    };
}

async function resolverClienteSupabaseParaOrden(datosOrden, datosDireccion) {
    const seleccionado = clientesOrdenState.seleccionado;
    if (seleccionado?.id) {
        return {
            ok: true,
            clienteId: seleccionado.id,
            direccionId: clientesOrdenState.direccion?.id || obtenerValorCampo("direccionIdSupabase").trim() || ""
        };
    }

    if (!window.ClientesSupabaseService?.crearCliente) {
        return { ok: false, error: "La integración de clientes Supabase no está disponible." };
    }

    const cliente = {
        nombre_completo: datosOrden.cliente,
        telefono_principal: datosOrden.telefono
    };
    const direccion = direccionParaSupabase(datosDireccion);
    const resultado = await window.ClientesSupabaseService.crearCliente(cliente, direccion, { omitirDuplicados: clientesOrdenState.crearForzado });
    clientesOrdenState.crearForzado = false;

    if (resultado.duplicados?.length) {
        mostrarDuplicadosOrden(resultado.duplicados);
        return { ok: false, error: "Encontramos un cliente que podría ser el mismo." };
    }
    if (!resultado.ok) return { ok: false, error: textoErrorOrden(resultado.error) };

    const direccionPrincipal = (resultado.data?.direcciones_clientes || []).find(d => d.es_principal) || resultado.data?.direcciones_clientes?.[0];
    seleccionarClienteOrden(resultado.data, direccionPrincipal);
    return { ok: true, clienteId: resultado.data.id, direccionId: direccionPrincipal?.id || "" };
}

function textoErrorOrden(error) {
    return typeof error === "string" ? error : (error?.message || "No se pudo completar la operación.");
}

function mostrarDuplicadosOrden(duplicados) {
    const contenedor = document.getElementById("clienteSugerencias");
    if (!contenedor) return;
    clientesOrdenState.duplicados = duplicados;
    contenedor.hidden = false;
    contenedor.innerHTML = `
        <div class="cliente-suggestion-duplicates">
            <strong>Encontramos un cliente que podría ser el mismo.</strong>
            ${duplicados.map((item, index) => `
                <button type="button" data-duplicate-index="${index}">
                    Usar ${escaparHtmlOrden(item.cliente.nombre_completo)} · ${escaparHtmlOrden(item.motivos.join(", "))}
                </button>
            `).join("")}
            <button type="button" data-duplicate-review="true">Revisar</button>
            <button type="button" data-duplicate-create="true">Crear nuevo de todos modos</button>
        </div>
    `;
}

/* =====================================================
   CAMBIAR ESTADO
===================================================== */

async function cambiarEstadoManual(id, nuevoEstado) {
    const ordenActual = obtenerOrdenAutorizada(id);
    if (!usuarioPuedeCambiarEstadoOrden(ordenActual)) {
        denegarAccionOrden();
        return;
    }
    if (ordenesSupabaseState.mutando || !window.OrdenesSupabaseService?.cambiarEstado) return;

    ordenesSupabaseState.mutando = true;
    const resultado = await window.OrdenesSupabaseService.cambiarEstado(id, nuevoEstado);
    ordenesSupabaseState.mutando = false;
    if (!resultado?.ok || !resultado.data) {
        console.error("[Órdenes] Error al cambiar estado", {
            code: resultado?.error?.code || null,
            message: textoErrorOrden(resultado?.error)
        });
        alert("No se pudo cambiar el estado en Supabase.");
        renderizarOrdenes();
        return;
    }

    guardarOrdenEnEstado(resultado.data);
    renderizarOrdenes();
}

/* =====================================================
   ELIMINAR
===================================================== */

async function eliminarOrden(id) {
    const ordenActual = obtenerOrdenAutorizada(id);
    if (!usuarioPuedeCancelarOrden(ordenActual)) {
        denegarAccionOrden();
        return;
    }

    if (ordenActual?.estado === "cancelado") return;
    if (!confirm("¿Querés cancelar esta orden? La orden y su historial se conservarán.")) return;
    await cambiarEstadoManual(id, "cancelado");
}

/* =====================================================
   WHATSAPP
===================================================== */

function abrirWhatsApp(orden) {
    if (!usuarioPuedeContactarOrden(orden)) {
        denegarAccionOrden();
        return;
    }
    if (!orden || !orden.telefono) return;

    const mensaje =
        `Hola ${orden.cliente}, te escribo de La Solución. Te contacto por el trabajo programado para el ${formatearFechaOrdenVisible(orden.fecha)} a las ${orden.hora}, estamos listos para ir.`;

    const telefono = String(orden.telefono).replace(/\\D/g, "");
    const telefonoNormalizado = telefono.startsWith("54") ? telefono : `54${telefono}`;
    const url = `https://wa.me/${telefonoNormalizado}?text=${encodeURIComponent(mensaje)}`;

    window.open(url, "_blank");
}

/* =====================================================
   GOOGLE MAPS
===================================================== */

function abrirMaps(orden) {
    if (!usuarioPuedeContactarOrden(orden)) {
        denegarAccionOrden();
        return;
    }
    if (!orden || !orden.direccion) return;

    let direccion = orden.direccion.trim();

    if (!direccion.toLowerCase().includes("córdoba")) {
        direccion += ", Córdoba, Argentina";
    }

    const url =
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;

    window.open(url, "_blank");
}

function normalizarTextoOrden(valor) {
    return String(valor || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function formatearFechaOrdenVisible(fecha) {
    return typeof window.formatearFechaArgentina === "function" ? window.formatearFechaArgentina(fecha) : (fecha || "Sin fecha");
}

function etiquetaEstadoOrden(estado) {
    const valor = String(estado || "pendiente").toLowerCase();
    if (valor === "en proceso") return "En proceso";
    if (valor === "terminado") return "Terminado";
    if (valor === "cancelado") return "Cancelado";
    return "Pendiente";
}

function claseEstadoOrden(estado) {
    const valor = String(estado || "pendiente").toLowerCase();
    if (valor === "en proceso") return "en-proceso";
    if (valor === "terminado") return "terminado";
    if (valor === "cancelado") return "cancelado";
    return "pendiente";
}

function ordenCoincideConFiltros(orden) {
    const busqueda = normalizarTextoOrden(filtrosOrdenesVista.busqueda);
    const estado = filtrosOrdenesVista.estado;
    const coincideEstado = estado === "todas" || String(orden.estado || "pendiente").toLowerCase() === estado;
    if (!coincideEstado) return false;
    if (!busqueda) return true;

    const texto = normalizarTextoOrden([
        orden.cliente,
        orden.telefono,
        orden.direccion,
        orden.trabajo,
        orden.descripcion,
        orden.tecnicoNombre,
        orden.categoria,
        orden.prioridad,
        orden.estado
    ].join(" "));
    return texto.includes(busqueda);
}

function crearTextoOrden(icono, texto, opciones = {}) {
    const fila = document.createElement("div");
    fila.className = "orden-detail";

    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = icono;

    const contenido = document.createElement(opciones.link ? "button" : "span");
    contenido.textContent = texto || "Sin datos";
    if (opciones.link) {
        contenido.type = "button";
        contenido.className = "orden-link-action";
        contenido.onclick = opciones.onClick;
    }

    fila.appendChild(icon);
    fila.appendChild(contenido);
    return fila;
}

function crearCardOrden(orden) {
    const estadoClase = claseEstadoOrden(orden.estado);
    const card = document.createElement("article");
    card.className = `card orden-card ${estadoClase}`;

    const header = document.createElement("header");
    header.className = "orden-card-header";

    const title = document.createElement("div");
    title.className = "orden-card-title";

    const cliente = document.createElement("strong");
    cliente.textContent = `Orden N.º ${orden.numeroOrden ?? "—"} · ${orden.cliente || "Cliente sin nombre"}`;

    const trabajo = document.createElement("span");
    trabajo.textContent = orden.trabajo || orden.descripcion || "Trabajo sin descripción";

    title.appendChild(cliente);
    title.appendChild(trabajo);

    const badge = document.createElement("span");
    badge.className = `orden-status-badge ${estadoClase}`;
    badge.textContent = etiquetaEstadoOrden(orden.estado);

    header.appendChild(title);
    header.appendChild(badge);

    const body = document.createElement("div");
    body.className = "orden-card-body";
    const bloqueHorario = orden.horaFin ? `${orden.hora}–${orden.horaFin}` : (orden.hora || "Sin hora");
    body.appendChild(crearTextoOrden("◷", `${formatearFechaOrdenVisible(orden.fecha)} · ${bloqueHorario}`));
    body.appendChild(crearTextoOrden("⌖", orden.direccion || "Sin dirección", { link: Boolean(orden.direccion), onClick: () => abrirMaps(orden) }));
    body.appendChild(crearTextoOrden("☎", orden.telefono || "Sin teléfono", { link: Boolean(orden.telefono), onClick: () => abrirWhatsApp(orden) }));
    body.appendChild(crearTextoOrden("♙", orden.tecnicoNombre || "Sin técnico asignado"));
    body.appendChild(crearTextoOrden("▦", `Categoría: ${orden.categoria || "Sin categoría"}`));
    body.appendChild(crearTextoOrden("!", `Prioridad: ${orden.prioridad || "media"}`));

    const estado = document.createElement("select");
    estado.setAttribute("aria-label", "Cambiar estado de la orden");
    ["pendiente", "en proceso", "terminado", "cancelado"].forEach(est => {
        const option = document.createElement("option");
        option.value = est;
        option.textContent = etiquetaEstadoOrden(est);
        if ((orden.estado || "pendiente") === est) option.selected = true;
        estado.appendChild(option);
    });
    pintarEstado(estado);
    estado.disabled = !usuarioPuedeCambiarEstadoOrden(orden);
    estado.onchange = () => cambiarEstadoManual(orden.id, estado.value);

    const acciones = document.createElement("div");
    acciones.className = "acciones orden-actions";

    const btnEdit = document.createElement("button");
    btnEdit.type = "button";
    btnEdit.textContent = "Abrir";
    btnEdit.onclick = () => editarOrden(orden.id);
    acciones.appendChild(btnEdit);

    if (usuarioPuedeCancelarOrden(orden) && orden.estado !== "cancelado") {
        const btnDelete = document.createElement("button");
        btnDelete.type = "button";
        btnDelete.textContent = "Cancelar";
        btnDelete.onclick = () => eliminarOrden(orden.id);
        acciones.appendChild(btnDelete);
    }

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(estado);
    if (acciones.children.length) card.appendChild(acciones);
    return card;
}

function actualizarResumenOrdenes(total, activas, historial) {
    const resumen = document.getElementById("ordenesResumen");
    const contadorActivas = document.getElementById("contadorOrdenesActivas");
    const contadorHistorial = document.getElementById("contadorOrdenesHistorial");
    if (resumen) resumen.textContent = `${total} órdenes visibles · ${activas} activas · ${historial} en historial`;
    if (contadorActivas) contadorActivas.textContent = String(activas);
    if (contadorHistorial) contadorHistorial.textContent = String(historial);
}

function renderizarVacioOrdenes(contenedor, texto) {
    const empty = document.createElement("div");
    empty.className = "orden-empty";
    empty.textContent = texto;
    contenedor.appendChild(empty);
}
/* =====================================================
   RENDER
===================================================== */

function renderizarOrdenes() {
    const lista = document.getElementById("listaOrdenes");
    const hist = document.getElementById("historialOrdenes");

    if (!lista || !hist) return;

    lista.innerHTML = "";
    hist.innerHTML = "";

    const ordenes = obtenerOrdenesAutorizadas().filter(ordenCoincideConFiltros);
    const activas = ordenes.filter(orden => !orden.historial);
    const historial = ordenes.filter(orden => orden.historial);

    actualizarResumenOrdenes(ordenes.length, activas.length, historial.length);

    activas.forEach(orden => lista.appendChild(crearCardOrden(orden)));
    historial.forEach(orden => hist.appendChild(crearCardOrden(orden)));

    if (!activas.length) renderizarVacioOrdenes(lista, "No hay órdenes activas con los filtros actuales.");
    if (!historial.length) renderizarVacioOrdenes(hist, "No hay órdenes en historial con los filtros actuales.");
}

async function cargarOrdenes() {
    const lista = document.getElementById("listaOrdenes");
    const hist = document.getElementById("historialOrdenes");
    if (!lista || !hist || ordenesSupabaseState.cargando) return;
    if (!window.OrdenesSupabaseService?.listarOrdenes) {
        actualizarResumenOrdenes(0, 0, 0);
        lista.replaceChildren();
        hist.replaceChildren();
        renderizarVacioOrdenes(lista, "El servicio de órdenes Supabase no está disponible.");
        return;
    }

    ordenesSupabaseState.cargando = true;
    const resultado = await window.OrdenesSupabaseService.listarOrdenes();
    ordenesSupabaseState.cargando = false;
    if (!resultado?.ok) {
        console.error("[Órdenes] Error al cargar listado", {
            code: resultado?.error?.code || null,
            message: textoErrorOrden(resultado?.error)
        });
        lista.replaceChildren();
        hist.replaceChildren();
        renderizarVacioOrdenes(lista, "No se pudieron cargar las órdenes. Verificá tu sesión y volvé a intentar.");
        actualizarResumenOrdenes(0, 0, 0);
        return;
    }

    const unicas = new Map();
    (resultado.data || []).forEach(orden => {
        if (orden?.id) unicas.set(String(orden.id), mapearOrdenSupabase(orden));
    });
    ordenesSupabaseState.ordenes = Array.from(unicas.values());
    ordenesSupabaseState.porId = new Map(ordenesSupabaseState.ordenes.map(orden => [String(orden.id), orden]));
    renderizarOrdenes();
}

function reiniciarEdicionOrden() {
    ordenEditando = null;
    renderizarHistorialRealOrden([]);
}
/* =====================================================
   INICIALIZACIÓN
===================================================== */

document.addEventListener("DOMContentLoaded", async function () {
    actualizarPermisosFormularioOrden();
    const buscar = document.getElementById("buscarOrdenes");
    const filtroEstado = document.getElementById("filtroEstadoOrdenes");
    const limpiar = document.getElementById("btnLimpiarFiltrosOrdenes");
    if (buscar) buscar.addEventListener("input", evento => { filtrosOrdenesVista.busqueda = evento.target.value; renderizarOrdenes(); });
    if (filtroEstado) filtroEstado.addEventListener("change", evento => { filtrosOrdenesVista.estado = evento.target.value; renderizarOrdenes(); });
    if (limpiar) limpiar.addEventListener("click", () => { filtrosOrdenesVista.busqueda = ""; filtrosOrdenesVista.estado = "todas"; if (buscar) buscar.value = ""; if (filtroEstado) filtroEstado.value = "todas"; renderizarOrdenes(); });
    await cargarCatalogosOrdenes();
    await cargarOrdenes();
});

window.configurarFormularioOrden = configurarFormularioOrden;
window.puedeAsignarTecnico = puedeAsignarTecnico;














