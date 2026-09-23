/* =====================================================
   La Solución CRM
   Agenda profesional
===================================================== */

(function () {
    let calendario = null;
    let agendaInicializada = false;
    let firmaTecnicos = "";
    let detalleOrdenActualId = null;
    let ordenesAgenda = [];
    let ordenesAgendaPorId = new Map();
    let errorCargaAgenda = null;
    let estadoFiltro = "todas";
    let textoBusqueda = "";
    let tecnicoFiltro = "todos";
    let categoriaFiltro = "todas";
    let prioridadFiltro = "todas";
    const DURACION_VISUAL_MINUTOS = 60;

    function permisoAgenda(nombre) {
        return window.PERMISOS?.[nombre] || "";
    }

    function puedeCrearOrdenAgenda() {
        return typeof tienePermiso !== "function" || tienePermiso(permisoAgenda("ORDENES_CREAR"));
    }

    function puedeMoverOrdenAgenda(orden) {
        return typeof puedeGestionarOrden === "function" && puedeGestionarOrden(permisoAgenda("ORDENES_MOVER_AGENDA"), orden);
    }

    function puedeRedimensionarOrdenAgenda(orden) {
        return typeof puedeGestionarOrden === "function" && puedeGestionarOrden(permisoAgenda("ORDENES_REDIMENSIONAR_AGENDA"), orden);
    }

    function puedeEditarOrdenAgenda(orden) {
        return typeof puedeGestionarOrden === "function" && puedeGestionarOrden(permisoAgenda("ORDENES_EDITAR"), orden);
    }

    function puedeEliminarOrdenAgenda(orden) {
        return typeof puedeGestionarOrden === "function" && puedeGestionarOrden(permisoAgenda("ORDENES_ELIMINAR"), orden);
    }

    function puedeCambiarEstadoAgenda(orden) {
        return typeof puedeGestionarOrden === "function" && (
            puedeGestionarOrden(permisoAgenda("ORDENES_CAMBIAR_ESTADO"), orden) ||
            puedeGestionarOrden(permisoAgenda("ORDENES_CAMBIAR_ESTADO_TECNICO"), orden)
        );
    }

    function denegarAccionAgenda() {
        if (typeof alertarPermisoDenegado === "function") alertarPermisoDenegado();
    }

    function obtenerOrdenesAgendaBase() {
        return ordenesAgenda;
    }

    function obtenerOrdenAgendaAutorizada(id) {
        const orden = ordenesAgendaPorId.get(String(id)) || null;
        if (!orden) return null;
        return typeof puedeVerOrden !== "function" || puedeVerOrden(orden) ? orden : null;
    }

    document.addEventListener("DOMContentLoaded", iniciarAgendaProfesional);
    window.addEventListener("ordenes:supabase-actualizadas", () => refrescarAgendaProfesional({ actualizarFiltros: true }));

    function iniciarAgendaProfesional() {
        if (agendaInicializada) return;
        agendaInicializada = true;
        if (typeof protegerPaginaPorPermiso === "function") protegerPaginaPorPermiso();
        else if (typeof protegerPagina === "function") protegerPagina();

        const calendarioEl = document.getElementById("calendarioAgenda");
        if (!calendarioEl) return;

        configurarControles();

        if (!window.FullCalendar) {
            calendarioEl.innerHTML = "<div class='agenda-empty'>No se pudo cargar FullCalendar.</div>";
            return;
        }

        calendario = new FullCalendar.Calendar(calendarioEl, {
            locale: "es",
            firstDay: 1,
            timeZone: "local",
            initialView: "timeGridDay",
            nowIndicator: true,
            selectable: puedeCrearOrdenAgenda(),
            editable: typeof tienePermiso !== "function" || tienePermiso(permisoAgenda("ORDENES_MOVER_AGENDA")) || tienePermiso(permisoAgenda("ORDENES_REDIMENSIONAR_AGENDA")),
            allDaySlot: true,
            slotMinTime: "07:00:00",
            slotMaxTime: "22:00:00",
            slotDuration: "00:30:00",
            scrollTime: obtenerScrollInicialAgenda(),
            scrollTimeReset: false,
            height: calcularAlturaCalendario(),
            expandRows: true,
            dayMaxEvents: 3,
            moreLinkText: cantidad => `+${cantidad} trabajos`,
            buttonText: { today: "Hoy", year: "Año", month: "Mes", week: "Semana", day: "Día" },
            headerToolbar: false,
            views: {
                multiMonthYear: { type: "multiMonth", duration: { years: 1 }, buttonText: "Año", multiMonthMaxColumns: 4 },
                dayGridMonth: { buttonText: "Mes" },
                timeGridWeek: { buttonText: "Semana" },
                timeGridDay: { buttonText: "Día" },
                listWeek: { buttonText: "Lista" }
            },
            events: cargarEventosSupabase,
            eventClassNames: obtenerClasesEvento,
            eventContent: renderizarEvento,
            eventClick: abrirDetalleDesdeEvento,
            dateClick: crearOrdenDesdeFecha,
            select: crearOrdenDesdeSeleccion,
            eventDrop: confirmarMovimientoEvento,
            eventResize: confirmarResizeEvento,
            datesSet: actualizarCabeceraCalendario
        });

        calendario.render();
        window.addEventListener("resize", ajustarAlturaCalendario);
        actualizarCabeceraCalendario();
        actualizarResumenAgenda();
        actualizarFiltrosDinamicos();
        abrirNuevaOrdenDesdeHash();
        abrirOrdenDesdeUrl();
    }

    function configurarControles() {
        const btnNueva = document.getElementById("btnNuevaOrdenAgenda");
        const buscador = document.getElementById("agendaSearch");
        const vistaSelector = document.getElementById("agendaViewSelect");
        const estadoSelector = document.getElementById("agendaEstadoFilter");
        const tecnicoSelector = document.getElementById("agendaTecnicoFilter");
        const prioridadSelector = document.getElementById("agendaPrioridadFilter");
        const categoriaSelector = document.getElementById("agendaCategoriaFilter");
        const limpiarFiltros = document.getElementById("agendaClearFilters");
        const cerrarDetalle = document.getElementById("cerrarDetalleAgenda");
        const contenidoDetalle = document.getElementById("agendaDetalleContenido");
        const filtroToggle = document.getElementById("agendaFilterToggle");
        const filtroMenu = document.getElementById("agendaFilterMenu");
        const agendaPrev = document.getElementById("agendaPrev");
        const agendaNext = document.getElementById("agendaNext");
        const agendaToday = document.getElementById("agendaToday");

        if (btnNueva) {
            btnNueva.disabled = !puedeCrearOrdenAgenda();
            btnNueva.addEventListener("click", () => prepararNuevaOrden(obtenerHorarioFuturoAgenda()));
        }
        if (buscador) buscador.addEventListener("input", e => { textoBusqueda = e.target.value.trim().toLowerCase(); refrescarAgendaProfesional(); });
        if (vistaSelector) vistaSelector.addEventListener("change", () => {
            calendario?.changeView(vistaSelector.value);
            actualizarCabeceraCalendario();
        });
        if (estadoSelector) estadoSelector.addEventListener("change", () => { estadoFiltro = estadoSelector.value; refrescarAgendaProfesional(); actualizarEstadoVisualFiltros(); });
        if (tecnicoSelector) tecnicoSelector.addEventListener("change", () => { tecnicoFiltro = tecnicoSelector.value; refrescarAgendaProfesional(); actualizarEstadoVisualFiltros(); });
        if (prioridadSelector) prioridadSelector.addEventListener("change", () => { prioridadFiltro = prioridadSelector.value; refrescarAgendaProfesional(); actualizarEstadoVisualFiltros(); });
        if (categoriaSelector) categoriaSelector.addEventListener("change", () => { categoriaFiltro = categoriaSelector.value; refrescarAgendaProfesional(); actualizarEstadoVisualFiltros(); });
        if (limpiarFiltros) limpiarFiltros.addEventListener("click", limpiarFiltrosAgenda);
        if (cerrarDetalle) cerrarDetalle.addEventListener("click", cerrarDetalleOrden);
        if (agendaPrev) agendaPrev.addEventListener("click", () => { calendario?.prev(); actualizarCabeceraCalendario(); });
        if (agendaNext) agendaNext.addEventListener("click", () => { calendario?.next(); actualizarCabeceraCalendario(); });
        if (agendaToday) agendaToday.addEventListener("click", () => {
            calendario?.today();
            calendario?.changeView("timeGridDay");
            actualizarCabeceraCalendario();
        });

        document.querySelectorAll("[data-calendar-view]").forEach(boton => {
            if (boton.id === "agendaToday") return;
            boton.addEventListener("click", () => {
                calendario?.changeView(boton.dataset.calendarView);
                actualizarCabeceraCalendario();
            });
        });

        document.querySelectorAll(".agenda-filter-chip[data-filter-kind]").forEach(boton => {
            boton.addEventListener("click", () => aplicarFiltroDesdeMenu(boton.dataset.filterKind, boton.dataset.filterValue));
        });

        if (filtroToggle && filtroMenu) {
            filtroToggle.addEventListener("click", event => {
                event.stopPropagation();
                alternarMenuFiltros();
            });

            filtroMenu.addEventListener("click", event => {
                event.stopPropagation();
                const parent = event.target.closest("[data-submenu-target]");
                if (parent) {
                    alternarSubmenu(parent.dataset.submenuTarget);
                    return;
                }

                const opcion = event.target.closest("[data-filter-kind]");
                if (!opcion || opcion.disabled) return;
                aplicarFiltroDesdeMenu(opcion.dataset.filterKind, opcion.dataset.filterValue);
            });

            document.addEventListener("click", event => {
                if (!filtroMenu.contains(event.target) && event.target !== filtroToggle) cerrarMenuFiltros();
            });

            document.addEventListener("keydown", event => {
                if (event.key === "Escape") cerrarMenuFiltros();
            });
        }

        if (contenidoDetalle) {
            contenidoDetalle.addEventListener("click", event => {
                const accion = event.target.closest("[data-action]");
                if (accion && detalleOrdenActualId !== null) ejecutarAccionDetalle(accion.dataset.action, detalleOrdenActualId);
            });

            contenidoDetalle.addEventListener("change", event => {
                if (event.target.id !== "agendaDetalleEstado" || detalleOrdenActualId === null) return;
                const ordenActual = obtenerOrdenAgendaAutorizada(detalleOrdenActualId);
                if (!puedeCambiarEstadoAgenda(ordenActual)) {
                    denegarAccionAgenda();
                    return;
                }
                cambiarEstadoManual(detalleOrdenActualId, event.target.value);
                const actualizada = obtenerOrdenAgendaAutorizada(detalleOrdenActualId);
                if (actualizada) abrirDetalleOrden(actualizada);
            });
        }

        actualizarEstadoVisualFiltros();
    }

    function refrescarAgendaProfesional(opciones = {}) {
        if (opciones.actualizarFiltros) actualizarFiltrosDinamicos();
        if (calendario) calendario.refetchEvents();
        actualizarResumenAgenda();
    }

    async function cargarEventosSupabase(info, successCallback, failureCallback) {
        try {
            const service = window.OrdenesSupabaseService;
            if (!service?.consultarAgenda) throw new Error("El servicio Supabase de órdenes no está disponible.");

            const desde = obtenerFechaInput(info.start);
            const hastaExclusivo = obtenerFechaInput(info.end);

            const resultado = await service.consultarAgenda(desde, hastaExclusivo);
            if (!resultado?.ok) {
                throw resultado?.error instanceof Error
                    ? resultado.error
                    : new Error(resultado?.error?.message || resultado?.error || "No se pudieron cargar las órdenes de Supabase.");
            }

            errorCargaAgenda = null;
            ordenesAgenda = (resultado.data || []).map(normalizarOrdenSupabase);
            ordenesAgendaPorId = new Map(ordenesAgenda.map(orden => [String(orden.id), orden]));
            actualizarFiltrosDinamicos();
            actualizarResumenAgenda();

            const ordenesFiltradas = obtenerOrdenesFiltradas();
            const eventos = convertirOrdenesAEventos(ordenesFiltradas);

            mostrarEstadoCargaAgenda(ordenesAgenda.length ? "" : "No hay órdenes programadas en este período.", false);
            abrirOrdenDesdeUrl();
            successCallback(eventos);
            window.requestAnimationFrame(() => enfocarHorarioRelevante(ordenesFiltradas));
        } catch (error) {
            errorCargaAgenda = error;
            console.error("[Agenda] Error al cargar eventos", {
                message: error?.message || String(error),
                code: error?.code || null
            });
            mostrarEstadoCargaAgenda(error?.message || "No se pudieron cargar las órdenes de Supabase.", true);
            failureCallback(error);
        }
    }

    function calcularAlturaCalendario() {
        return Math.max(500, Math.min(760, window.innerHeight - 250));
    }

    function ajustarAlturaCalendario() {
        if (!calendario) return;
        calendario.setOption("height", calcularAlturaCalendario());
    }

    function enfocarHorarioRelevante(ordenes) {
        if (!calendario || !["timeGridDay", "timeGridWeek"].includes(calendario.view?.type)) return;

        const hoy = obtenerFechaInput(new Date());
        const conHora = ordenes
            .filter(orden => orden.fecha === hoy && esHoraValida(orden.hora))
            .sort((a, b) => a.hora.localeCompare(b.hora));
        if (!conHora.length) return;

        const ahora = obtenerHoraInput(new Date());
        const relevante = conHora.find(orden => orden.hora >= ahora) || conHora[conHora.length - 1];
        const [hora] = relevante.hora.split(":").map(Number);
        const horaInicio = Math.max(7, hora - 1);
        calendario.scrollToTime(`${String(horaInicio).padStart(2, "0")}:00:00`);
    }

    function obtenerOrdenesFiltradas() {
        return obtenerOrdenesAgendaBase().filter(orden => {
            if (!orden.fecha || !esFechaValida(orden.fecha)) return false;
            if (estadoFiltro !== "todas" && orden.estado !== estadoFiltro) return false;
            if (tecnicoFiltro !== "todos" && String(orden.tecnicoId || orden.tecnicoNombre || "Sin asignar") !== tecnicoFiltro) return false;
            if (categoriaFiltro !== "todas" && orden.categoria !== categoriaFiltro) return false;
            if (prioridadFiltro !== "todas" && orden.prioridad !== prioridadFiltro) return false;
            if (!textoBusqueda) return true;
            return [orden.numeroOrden, orden.cliente, orden.direccion, orden.trabajo, orden.descripcion, orden.telefono, orden.tecnicoNombre].join(" ").toLowerCase().includes(textoBusqueda);
        });
    }

    function convertirOrdenesAEventos(ordenes) {
        return ordenes.map(orden => {
            const tieneHora = esHoraValida(orden.hora);
            const start = tieneHora ? construirFechaHoraISO(orden.fecha, orden.hora) : orden.fecha;
            const end = tieneHora
                ? (orden.horaFin && esHoraValida(orden.horaFin)
                    ? construirFechaHoraISO(orden.fecha, orden.horaFin)
                    : sumarMinutosISO(orden.fecha, orden.hora, DURACION_VISUAL_MINUTOS))
                : undefined;
            return {
                id: String(orden.id),
                title: orden.trabajo || "Orden sin trabajo",
                start,
                end,
                allDay: !tieneHora,
                extendedProps: {
                    ...orden,
                    ordenId: orden.id,
                    numero_orden: orden.numeroOrden,
                    cliente: orden.cliente,
                    telefono: orden.telefono,
                    direccion: orden.direccion,
                    trabajo: orden.trabajo,
                    estado: orden.estado,
                    prioridad: orden.prioridad,
                    tecnico: orden.tecnicoNombre
                }
            };
        });
    }

    function normalizarOrdenSupabase(orden) {
        const direccionRelacion = Array.isArray(orden.direcciones_clientes) ? orden.direcciones_clientes[0] : orden.direcciones_clientes;
        const clienteRelacion = Array.isArray(orden.clientes) ? orden.clientes[0] : orden.clientes;
        const categoriaRelacion = Array.isArray(orden.categorias_trabajo) ? orden.categorias_trabajo[0] : orden.categorias_trabajo;

        return {
            id: orden.id,
            numeroOrden: orden.numero_orden,
            clienteId: orden.cliente_id,
            cliente: clienteRelacion?.nombre_completo || "Cliente sin nombre",
            telefono: orden.telefono_contacto || clienteRelacion?.telefono_principal || "",
            direccion: construirDireccionAgenda(direccionRelacion, orden.direccion_snapshot),
            direccionId: orden.direccion_cliente_id || null,
            tecnicoId: orden.tecnico_id || null,
            tecnicoNombre: orden.tecnico_id ? "Técnico asignado" : "Sin asignar",
            categoriaId: orden.categoria_id || null,
            categoria: categoriaRelacion?.slug || normalizarClase(categoriaRelacion?.nombre || "otros"),
            fecha: orden.fecha_programada || "",
            hora: normalizarHoraAgenda(orden.hora_inicio),
            horaFin: normalizarHoraAgenda(orden.hora_fin),
            estado: estadoDBALocal(orden.estado),
            prioridad: orden.prioridad || "media",
            trabajo: orden.titulo || orden.descripcion_solicitud || "Orden sin trabajo",
            descripcion: orden.descripcion_solicitud || orden.titulo || "",
            createdAt: orden.created_at
        };
    }

    function construirDireccionAgenda(direccion, snapshot) {
        if (direccion?.direccion_completa) return direccion.direccion_completa;
        const partes = [
            [direccion?.calle, direccion?.numero].filter(Boolean).join(" "),
            direccion?.piso ? `Piso ${direccion.piso}` : "",
            direccion?.departamento ? `Dpto. ${direccion.departamento}` : "",
            direccion?.ciudad,
            direccion?.provincia
        ].filter(Boolean);
        if (partes.length) return partes.join(", ");
        if (typeof snapshot === "string") return snapshot;
        return snapshot?.direccion || snapshot?.direccion_completa || "Sin dirección";
    }

    function normalizarHoraAgenda(hora) {
        const coincidencia = String(hora || "").match(/^(\d{2}):(\d{2})/);
        return coincidencia ? `${coincidencia[1]}:${coincidencia[2]}` : "";
    }

    function estadoDBALocal(estado) {
        const valor = String(estado || "pendiente").toLowerCase();
        return valor === "en_proceso" ? "en proceso" : valor;
    }

    function mostrarEstadoCargaAgenda(mensaje, esError) {
        const estado = document.getElementById("agendaDataStatus");
        if (!estado) return;
        estado.textContent = mensaje || "";
        estado.hidden = !mensaje;
        estado.classList.toggle("is-error", Boolean(esError));
    }

    window.convertirOrdenesAEventos = convertirOrdenesAEventos;
    window.actualizarAgendaProfesional = refrescarAgendaProfesional;

    function renderizarEvento(arg) {
        const props = arg.event.extendedProps;
        const nodo = document.createElement("div");
        nodo.className = "agenda-event-content";
        nodo.innerHTML = `
            <strong><span aria-hidden="true">${iconoCategoria(props.categoria)}</span>${formatearHora(arg.event.start)} · ${escaparHtml(props.trabajo || arg.event.title)}</strong>
            <span>${escaparHtml(props.cliente || "Cliente sin nombre")}</span>
            <small>${escaparHtml(props.direccion || props.tecnicoNombre || "Sin asignar")}</small>
            <i>${escaparHtml(etiquetaEstadoAgenda(props.estado))}</i>
        `;
        return { domNodes: [nodo] };
    }

    function obtenerClasesEvento(arg) {
        const props = arg.event.extendedProps;
        return [`agenda-cat-${normalizarClase(props.categoria || "otros")}`, `agenda-estado-${normalizarClase(props.estado || "pendiente")}`];
    }

    function abrirDetalleDesdeEvento(info) {
        info.jsEvent.preventDefault();
        const orden = obtenerOrdenAgendaAutorizada(info.event.extendedProps.ordenId || info.event.id);
        if (orden) abrirDetalleOrden(orden);
    }

    function abrirDetalleOrden(orden) {
        cerrarMenuFiltros();
        const panel = document.getElementById("agendaDetalle");
        const contenido = document.getElementById("agendaDetalleContenido");
        if (!panel || !contenido) return;

        panel.classList.add("is-open");
        detalleOrdenActualId = orden.id;
        contenido.innerHTML = `
            <div class="agenda-detail-hero agenda-cat-bg-${normalizarClase(orden.categoria)}">
                <button id="cerrarDetalleAgendaInterno" class="agenda-detail-close-inline" type="button" aria-label="Cerrar detalle">&times;</button>
                <span class="agenda-status-pill agenda-status-${normalizarClase(orden.estado)}">${escaparHtml(etiquetaEstadoAgenda(orden.estado))}</span>
                <span class="agenda-detail-hero-icon" aria-hidden="true">${iconoCategoria(orden.categoria)}</span>
                <h2>${escaparHtml(orden.numeroOrden ? `Orden N.º ${orden.numeroOrden} · ${orden.trabajo}` : orden.trabajo)}</h2>
                <p>${escaparHtml(orden.cliente)}</p>
            </div>
            <dl class="agenda-detail-list">
                <div><dt>Fecha</dt><dd>${formatearFechaLarga(orden.fecha)}</dd></div>
                <div><dt>Hora</dt><dd>${escaparHtml(orden.hora || "Sin hora definida")}</dd></div>
                <div><dt>Teléfono</dt><dd>${escaparHtml(orden.telefono || "Sin teléfono")}</dd></div>
                <div><dt>Dirección</dt><dd>${escaparHtml(orden.direccion || "Sin dirección")}</dd></div>
                <div><dt>Técnico</dt><dd>${escaparHtml(orden.tecnicoNombre || "Sin asignar")}</dd></div>
                <div><dt>Categoría</dt><dd>${escaparHtml(orden.categoria || "otros")}</dd></div>
                <div><dt>Prioridad</dt><dd>${escaparHtml(orden.prioridad || "normal")}</dd></div>
                <div><dt>ID</dt><dd>${escaparHtml(String(orden.id))}</dd></div>
            </dl>
            <section class="agenda-detail-description"><h3>Descripción del trabajo</h3><p>${escaparHtml(orden.descripcion || orden.trabajo || "Sin descripción")}</p></section>
            <label class="agenda-detail-state">Cambiar estado
                <select id="agendaDetalleEstado" ${puedeCambiarEstadoAgenda(orden) ? "" : "disabled"}>
                    <option value="pendiente" ${orden.estado === "pendiente" ? "selected" : ""}>Pendiente</option>
                    <option value="en proceso" ${orden.estado === "en proceso" ? "selected" : ""}>En proceso</option>
                    <option value="terminado" ${orden.estado === "terminado" ? "selected" : ""}>Terminado</option>
                </select>
            </label>
            <div class="agenda-detail-actions">
                <button class="agenda-action agenda-action-whatsapp" type="button" data-action="whatsapp">Enviar WhatsApp</button>
                <button class="agenda-action agenda-action-maps" type="button" data-action="maps">Abrir en Google Maps</button>
                ${puedeEditarOrdenAgenda(orden) ? '<button class="agenda-action" type="button" data-action="editar">Editar orden</button>' : ''}
                <a class="agenda-action" href="ordenes.html">Ver orden completa</a>
                ${puedeEliminarOrdenAgenda(orden) ? '<button class="agenda-action agenda-action-danger" type="button" data-action="eliminar">Eliminar orden</button>' : ''}
            </div>
        `;
        document.getElementById("cerrarDetalleAgendaInterno")?.addEventListener("click", cerrarDetalleOrden);
    }

    function ejecutarAccionDetalle(accion, ordenId) {
        const orden = obtenerOrdenAgendaAutorizada(ordenId);
        if (!orden) return;
        if (accion === "whatsapp") abrirWhatsApp(orden);
        if (accion === "maps") abrirMaps(orden);
        if (accion === "editar") editarOrden(orden.id);
        if (accion === "eliminar") { eliminarOrden(orden.id); cerrarDetalleOrden(); }
    }

    function cerrarDetalleOrden() {
        document.getElementById("agendaDetalle")?.classList.remove("is-open");
        detalleOrdenActualId = null;
    }

    function crearOrdenDesdeFecha(info) {
        if (!puedeCrearOrdenAgenda()) {
            denegarAccionAgenda();
            return;
        }
        prepararNuevaOrden(obtenerHorarioFuturoAgenda(
            obtenerFechaInput(info.date),
            info.dateStr.includes("T") ? obtenerHoraInput(info.date) : ""
        ));
    }

    function crearOrdenDesdeSeleccion(info) {
        if (!puedeCrearOrdenAgenda()) {
            denegarAccionAgenda();
            calendario?.unselect();
            return;
        }
        prepararNuevaOrden(obtenerHorarioFuturoAgenda(obtenerFechaInput(info.start), obtenerHoraInput(info.start)));
        calendario?.unselect();
    }

    function abrirOrdenDesdeUrl() {
        const params = new URLSearchParams(window.location.search);
        const ordenId = params.get("orden");
        if (!ordenId) return;

        const orden = obtenerOrdenAgendaAutorizada(ordenId);
        if (orden) abrirDetalleOrden(orden);
    }

    function abrirNuevaOrdenDesdeHash() {
        if (window.location.hash !== "#nueva-orden") return;
        if (puedeCrearOrdenAgenda()) prepararNuevaOrden(obtenerHorarioFuturoAgenda());
        if (window.history && typeof window.history.replaceState === "function") {
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
    }

    function prepararNuevaOrden(valores) {
        if (!puedeCrearOrdenAgenda()) {
            denegarAccionAgenda();
            return;
        }
        cerrarMenuFiltros();
        if (typeof reiniciarEdicionOrden === "function") reiniciarEdicionOrden();
        if (typeof limpiarFormularioOrden === "function") limpiarFormularioOrden();
        abrirAgenda(valores);
    }

    function obtenerScrollInicialAgenda() {
        const ahora = new Date();
        const minutos = Math.max(7 * 60, Math.min(20 * 60, ahora.getHours() * 60 + ahora.getMinutes() - 90));
        const horas = String(Math.floor(minutos / 60)).padStart(2, "0");
        const resto = String(minutos % 60).padStart(2, "0");
        return `${horas}:${resto}:00`;
    }
    function obtenerHorarioFuturoAgenda(fecha = "", hora = "") {
        if (typeof obtenerHorarioInicialOrden === "function") return obtenerHorarioInicialOrden(fecha, hora);
        const ahora = new Date();
        return { fecha: obtenerFechaInput(ahora), hora: obtenerHoraInput(ahora) };
    }

    function confirmarMovimientoEvento(info) {
        const orden = obtenerOrdenAgendaAutorizada(info.event.id);
        if (!puedeMoverOrdenAgenda(orden)) {
            denegarAccionAgenda();
            info.revert();
            return;
        }
        const nuevaFecha = obtenerFechaInput(info.event.start);
        const nuevaHora = obtenerHoraInput(info.event.start);
        if (!confirm(`¿Querés mover esta orden al ${formatearFechaLarga(nuevaFecha)} a las ${nuevaHora}?`)) { info.revert(); return; }
        actualizarOrden(info.event.id, { fecha: nuevaFecha, hora: nuevaHora });
    }

    function confirmarResizeEvento(info) {
        const orden = obtenerOrdenAgendaAutorizada(info.event.id);
        if (!puedeRedimensionarOrdenAgenda(orden)) {
            denegarAccionAgenda();
            info.revert();
            return;
        }
        const horaFin = obtenerHoraInput(info.event.end);
        const duracion = Math.max(30, Math.round((info.event.end - info.event.start) / 60000));
        if (!confirm(`¿Querés actualizar la duración hasta las ${horaFin}?`)) { info.revert(); return; }
        actualizarOrden(info.event.id, { horaFin, duracion });
    }

    function actualizarFiltrosDinamicos() {
        const contenedor = document.getElementById("agendaTecnicoFilter");
        if (!contenedor) return;

        const tecnicos = new Map();
        obtenerOrdenesAgendaBase().forEach(orden => {
            const clave = String(orden.tecnicoId || orden.tecnicoNombre || "Sin asignar");
            const nombre = orden.tecnicoNombre || "Sin asignar";
            if (nombre !== "Sin asignar" || clave !== "Sin asignar") tecnicos.set(clave, nombre);
        });

        const nuevaFirma = JSON.stringify([...tecnicos.entries()]);
        if (nuevaFirma === firmaTecnicos) {
            actualizarEstadoVisualFiltros();
            return;
        }

        firmaTecnicos = nuevaFirma;
        const fragmento = document.createDocumentFragment();
        fragmento.appendChild(new Option("Todos los técnicos", "todos"));
        fragmento.appendChild(new Option("Sin asignar", "Sin asignar"));
        tecnicos.forEach((nombre, clave) => fragmento.appendChild(new Option(nombre, clave)));

        contenedor.replaceChildren(fragmento);
        contenedor.value = [...contenedor.options].some(opcion => opcion.value === tecnicoFiltro) ? tecnicoFiltro : "todos";
        actualizarEstadoVisualFiltros();
    }

    function alternarMenuFiltros() {
        const menu = document.getElementById("agendaFilterMenu");
        const toggle = document.getElementById("agendaFilterToggle");
        if (!menu || !toggle) return;
        const abrir = !menu.classList.contains("is-open");
        menu.classList.toggle("is-open", abrir);
        toggle.setAttribute("aria-expanded", String(abrir));
        if (!abrir) cerrarSubmenusFiltros();
    }

    function cerrarMenuFiltros() {
        const menu = document.getElementById("agendaFilterMenu");
        const toggle = document.getElementById("agendaFilterToggle");
        if (!menu || !toggle) return;
        menu.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        cerrarSubmenusFiltros();
    }

    function cerrarSubmenusFiltros() {
        document.querySelectorAll(".agenda-filter-group.is-open").forEach(grupo => grupo.classList.remove("is-open"));
        document.querySelectorAll(".agenda-filter-parent[aria-expanded='true']").forEach(boton => boton.setAttribute("aria-expanded", "false"));
    }

    function alternarSubmenu(nombre) {
        const selector = '.agenda-filter-group [data-submenu-target="' + nombre + '"]';
        const grupo = document.querySelector(selector)?.closest(".agenda-filter-group");
        if (!grupo) return;
        const abrir = !grupo.classList.contains("is-open");
        cerrarSubmenusFiltros();
        grupo.classList.toggle("is-open", abrir);
        grupo.querySelector(".agenda-filter-parent")?.setAttribute("aria-expanded", String(abrir));
    }

    function aplicarFiltroDesdeMenu(tipo, valor) {
        if (tipo === "estado") estadoFiltro = valor || "todas";
        if (tipo === "tecnico") tecnicoFiltro = valor || "todos";
        if (tipo === "categoria") categoriaFiltro = valor || "todas";
        if (tipo === "prioridad") prioridadFiltro = valor || "todas";
        actualizarEstadoVisualFiltros();
        cerrarMenuFiltros();
        refrescarAgendaProfesional();
    }

    function crearBotonFiltro(tipo, valor, texto) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.setAttribute("role", "menuitem");
        boton.dataset.filterKind = tipo;
        boton.dataset.filterValue = valor;
        boton.textContent = texto;
        return boton;
    }

    function actualizarEstadoVisualFiltros() {
        const filtrosActivos = [estadoFiltro !== "todas", tecnicoFiltro !== "todos", categoriaFiltro !== "todas", prioridadFiltro !== "todas", Boolean(textoBusqueda)].filter(Boolean).length;
        const toggle = document.getElementById("agendaFilterToggle");
        const contador = document.getElementById("agendaFilterCount");
        if (toggle) toggle.classList.toggle("is-active", filtrosActivos > 0);
        if (contador) {
            contador.textContent = filtrosActivos ? String(filtrosActivos) : "";
            contador.hidden = filtrosActivos === 0;
        }
        document.querySelectorAll("[data-filter-kind]").forEach(boton => {
            const tipo = boton.dataset.filterKind;
            const valorActivo = tipo === "estado" ? estadoFiltro : tipo === "tecnico" ? tecnicoFiltro : tipo === "prioridad" ? prioridadFiltro : categoriaFiltro;
            const activo = boton.dataset.filterValue === valorActivo;
            boton.classList.toggle("is-active", activo);
            if (!boton.classList.contains("agenda-filter-chip")) {
                const textoBase = boton.textContent.startsWith("✓ ") ? boton.textContent.slice(2) : boton.textContent;
                boton.textContent = activo ? "✓ " + textoBase : textoBase;
            }
        });
    }

    function actualizarCabeceraCalendario() {
        if (!calendario) return;

        const vista = calendario.view;
        const rango = document.getElementById("agendaCurrentRange");
        if (rango) rango.textContent = obtenerTituloRango(vista);
        const vistaSelector = document.getElementById("agendaViewSelect");
        if (vistaSelector) vistaSelector.value = vista.type;

        const fechaActual = obtenerFechaInput(new Date());
        const fechaVista = obtenerFechaInput(vista.currentStart);
        document.querySelectorAll("[data-calendar-view]").forEach(boton => {
            const esAccesoHoy = boton.id === "agendaToday";
            const activo = esAccesoHoy
                ? vista.type === "timeGridDay" && fechaVista === fechaActual
                : boton.dataset.calendarView === vista.type;
            boton.classList.toggle("is-active", activo);
            boton.setAttribute("aria-pressed", String(activo));
        });
    }

    function actualizarResumenAgenda() {
        const ordenes = obtenerOrdenesAgendaBase().filter(orden => orden.fecha && esFechaValida(orden.fecha));
        const hoy = obtenerFechaInput(new Date());
        const total = ordenes.length || 0;
        const hoyOrdenes = ordenes.filter(orden => orden.fecha === hoy);
        const tecnicos = new Set(ordenes.map(orden => orden.tecnicoId || orden.tecnicoNombre).filter(valor => valor && valor !== "Sin asignar"));
        const enProceso = ordenes.filter(orden => orden.estado === "en proceso");
        const completadasHoy = hoyOrdenes.filter(orden => orden.estado === "terminado");

        asignarTexto("agendaMetricHoy", hoyOrdenes.length);
        asignarTexto("agendaMetricHoyDetalle", hoyOrdenes.length === 1 ? "1 trabajo para hoy" : `${hoyOrdenes.length} trabajos para hoy`);
        asignarTexto("agendaMetricTecnicos", tecnicos.size);
        asignarTexto("agendaMetricTecnicosDetalle", tecnicos.size === 1 ? "1 técnico activo" : `${tecnicos.size} técnicos activos`);
        asignarTexto("agendaMetricProceso", enProceso.length);
        asignarTexto("agendaMetricProcesoDetalle", `${total ? Math.round((enProceso.length / total) * 100) : 0}% del total`);
        asignarTexto("agendaMetricCompletadas", completadasHoy.length);
        asignarTexto("agendaMetricCompletadasDetalle", completadasHoy.length === 1 ? "1 cierre hoy" : `${completadasHoy.length} cierres hoy`);
    }

    function asignarTexto(id, valor) {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = String(valor);
    }

    function obtenerTituloRango(vista) {
        if (!vista) return "Agenda";
        const inicio = vista.currentStart;
        const fin = new Date(vista.currentEnd.getTime() - 86400000);

        if (vista.type === "timeGridDay") return formatearFechaConMes(inicio);
        if (vista.type === "dayGridMonth") return inicio.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
        if (vista.type === "multiMonthYear") return String(inicio.getFullYear());

        const mismoMes = inicio.getMonth() === fin.getMonth() && inicio.getFullYear() === fin.getFullYear();
        const inicioTexto = mismoMes ? String(inicio.getDate()).padStart(2, "0") : formatearFechaCorta(inicio);
        return `${inicioTexto} - ${formatearFechaCorta(fin)}`;
    }

    function formatearFechaConMes(fecha) {
        return fecha.toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    }

    function formatearFechaCorta(fecha) {
        return fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
    }

    function etiquetaEstadoAgenda(estado) {
        const valor = String(estado || "pendiente").toLowerCase();
        if (valor === "en proceso") return "En proceso";
        if (valor === "terminado") return "Terminado";
        return "Pendiente";
    }

    function iconoCategoria(categoria) {
        const valor = normalizarClase(categoria);
        if (valor === "agua") return "●";
        if (valor === "calefaccion") return "▲";
        if (valor === "refrigeracion") return "✳";
        if (valor === "gas") return "◆";
        return "○";
    }

    window.aplicarFiltroTecnicoParaUsuario = function (ordenes, usuarioActual) {
        if (!usuarioActual || usuarioActual.rol !== "tecnico" || !usuarioActual.id) return ordenes;
        return ordenes.filter(orden => String(orden.tecnicoId) === String(usuarioActual.id));
    };

    function limpiarFiltrosAgenda() {
        estadoFiltro = "todas";
        tecnicoFiltro = "todos";
        categoriaFiltro = "todas";
        prioridadFiltro = "todas";
        textoBusqueda = "";
        const valores = {
            agendaEstadoFilter: "todas",
            agendaTecnicoFilter: "todos",
            agendaCategoriaFilter: "todas",
            agendaPrioridadFilter: "todas",
            agendaSearch: ""
        };
        Object.entries(valores).forEach(([id, valor]) => {
            const control = document.getElementById(id);
            if (control) control.value = valor;
        });
        actualizarEstadoVisualFiltros();
        cerrarMenuFiltros();
        refrescarAgendaProfesional();
    }

    function construirFechaHoraISO(fecha, hora) { return `${fecha}T${normalizarHoraAgenda(hora)}:00`; }
    function sumarMinutosISO(fecha, hora, minutos) {
        const [a, m, d] = fecha.split("-").map(Number);
        const [h, min] = normalizarHoraAgenda(hora).split(":").map(Number);
        const fin = new Date(a, m - 1, d, h, min + minutos, 0);
        return `${obtenerFechaInput(fin)}T${obtenerHoraInput(fin)}:00`;
    }
    function obtenerFechaInput(fecha) { return [fecha.getFullYear(), String(fecha.getMonth() + 1).padStart(2, "0"), String(fecha.getDate()).padStart(2, "0")].join("-"); }
    function obtenerHoraInput(fecha) { return [String(fecha.getHours()).padStart(2, "0"), String(fecha.getMinutes()).padStart(2, "0")].join(":"); }
    function formatearHora(fecha) { return fecha ? fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "--:--"; }
    function formatearFechaLarga(fecha) { return typeof window.formatearFechaArgentina === "function" ? window.formatearFechaArgentina(fecha) : (fecha || "Sin fecha"); }
    function esFechaValida(fecha) { return /^\d{4}-\d{2}-\d{2}$/.test(fecha || ""); }
    function esHoraValida(hora) { return /^\d{2}:\d{2}$/.test(hora || ""); }
    function normalizarClase(valor) { return String(valor || "otros").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-"); }
    function escaparHtml(valor) { return String(valor ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
})();










