/* =====================================================
   La Solución CRM
   Dashboard dinámico por rol
===================================================== */

(function () {
    const ESTADOS_FINALIZADOS = ["terminado", "terminada", "cancelado", "cancelada", "cerrada", "cerrado", "historial"];

    document.addEventListener("DOMContentLoaded", cargarDashboard);

    function cargarDashboard() {
        const root = document.getElementById("dashboardRoot");

        try {
            if (typeof protegerPaginaPorPermiso === "function") protegerPaginaPorPermiso();

            if (!root) {
                console.error("[Dashboard] No se encontró el contenedor #dashboardRoot.");
                return;
            }

            const usuario = obtenerUsuarioDashboard();
            if (!usuario) {
                root.innerHTML = crearEstadoVacio("Sesión inválida", "Volvé a iniciar sesión para continuar.");
                return;
            }

            root.dataset.rol = normalizarRol(usuario.rol) || "sin-rol";
            renderizarDashboardPorRol(root, usuario);
        } catch (error) {
            console.error("[Dashboard] Error al renderizar:", error);
            if (root) {
                root.innerHTML = crearErrorDashboard();
            }
        }
    }
    function obtenerUsuarioDashboard() {
        const sesion = typeof obtenerSesionActual === "function" ? obtenerSesionActual() : null;
        if (!sesion) return null;

        const usuarios = typeof obtenerUsuarios === "function" ? obtenerUsuarios() : [];
        const completo = usuarios.find(usuario => String(usuario.id) === String(sesion.usuarioId));
        return completo ? { ...sesion, ...completo } : sesion;
    }

    function renderizarDashboardPorRol(root, usuario) {
        const rol = normalizarRol(usuario.rol);
        const ordenes = obtenerOrdenesSeguras();

        if (rol === "administrador") return renderizarDashboardAdministrador(root, usuario, ordenes);
        if (rol === "colaborador") return renderizarDashboardColaborador(root, usuario, ordenes);
        if (rol === "tecnico") return renderizarDashboardTecnico(root, usuario, ordenes);
        if (rol === "cliente") return renderizarDashboardCliente(root, usuario, ordenes);
        if (rol === "cliente_pendiente") return renderizarDashboardClientePendiente(root, usuario);

        root.innerHTML = crearBienvenida(usuario, { subtitulo: "Tu cuenta no tiene una experiencia configurada todavía." }) +
            crearEstadoVacio("Rol no reconocido", "Solicitá al administrador que revise tu cuenta.");
    }

    function renderizarDashboardAdministrador(root, usuario, ordenes) {
        const resumen = obtenerResumenAdministrador(ordenes);
        const usuariosPendientes = obtenerUsuariosLocales().filter(u => u.estado === "pendiente" || u.rol === "cliente_pendiente").length;
        root.innerHTML = crearDashboardEjecutivoAdministrador(usuario, ordenes, resumen, usuariosPendientes);
    }

    function crearDashboardEjecutivoAdministrador(usuario, ordenes, resumen, usuariosPendientes) {
        const total = ordenes.length;
        return `
            ${crearBienvenida(usuario)}
            ${crearMetricasEjecutivas([
                metricaEjecutiva("Órdenes totales", total, "▤", "Dato actual", "is-yellow", "ordenes.html"),
                metricaEjecutiva("Pendientes", resumen.pendientes, "◷", "Dato actual", "is-red", "ordenes.html"),
                metricaEjecutiva("En proceso", resumen.enProceso, "◉", "Dato actual", "is-amber", "ordenes.html"),
                metricaEjecutiva("Terminadas", resumen.terminadas, "✓", "Dato actual", "is-green", "ordenes.html")
            ])}
            <section class="executive-grid executive-grid-main">
                ${crearSituacionEjecutiva(resumen, total)}
                ${crearPanelAdministrativoEjecutivo(resumen, usuariosPendientes)}
            </section>
            ${crearAccesosEjecutivos(usuariosPendientes)}
        `;
    }

    function crearPanelAdministrativoEjecutivo(resumen, usuariosPendientes) {
        const usuarios = obtenerUsuariosLocales();
        const tecnicosActivos = usuarios.filter(usuario => normalizarRol(usuario.rol) === "tecnico" && normalizar(usuario.estado) === "activo").length;
        const tecnicosSinVinculo = usuarios.filter(usuario => normalizarRol(usuario.rol) === "tecnico" && normalizar(usuario.estado) === "activo" && !usuario.tecnicoId).length;
        const alertas = [
            { label: "Usuarios pendientes", value: usuariosPendientes, detail: "Cuentas por revisar", href: "usuarios.html", tone: "is-amber" },
            { label: "\u00d3rdenes sin t\u00e9cnico", value: resumen.sinTecnico, detail: "Requieren asignaci\u00f3n", href: "ordenes.html", tone: "is-red" },
            { label: "\u00d3rdenes demoradas", value: resumen.atrasadas, detail: "Seg\u00fan fecha cargada", href: "ordenes.html", tone: "is-red" },
            { label: "T\u00e9cnicos activos", value: tecnicosActivos, detail: tecnicosSinVinculo ? String(tecnicosSinVinculo) + " sin v\u00ednculo" : "Vinculaci\u00f3n correcta", href: "usuarios.html", tone: "is-green" }
        ];
        return `
            <article class="executive-panel executive-admin-panel">
                <div class="executive-panel-heading">
                    <h2>Control administrativo</h2>
                    <span>Datos reales del sistema</span>
                </div>
                <div class="executive-admin-list">
                    ${alertas.map(item => `
                        <a class="executive-admin-item" href="${escaparAttr(item.href)}">
                            <span class="${escaparAttr(item.tone)}" aria-hidden="true"></span>
                            <small>${escapar(item.label)}</small>
                            <strong>${escapar(item.value)}</strong>
                            <em>${escapar(item.detail)}</em>
                        </a>
                    `).join("")}
                </div>
            </article>
        `;
    }

    function metricaEjecutiva(titulo, valor, icono, detalle, tono, href) {
        return { titulo, valor, icono, detalle, tono, href };
    }

    function crearMetricasEjecutivas(items) {
        return `<section class="executive-metrics" aria-label="Indicadores principales">${items.map(item => `
            <a class="executive-metric-card ${escaparAttr(item.tono)}" href="${escaparAttr(item.href || "#")}">
                <span class="executive-metric-icon" aria-hidden="true">${escapar(item.icono)}</span>
                <span class="executive-metric-copy">
                    <small>${escapar(item.titulo)}</small>
                    <strong>${escapar(item.valor)}</strong>
                    <em>${escapar(item.detalle)}</em>
                </span>
            </a>
        `).join("")}</section>`;
    }

    function crearSituacionEjecutiva(resumen, total) {
        const pendientes = resumen.pendientes;
        const enProceso = resumen.enProceso;
        const terminadas = resumen.terminadas;
        const totalBase = Math.max(total, pendientes + enProceso + terminadas, 1);
        const pendienteDeg = Math.round((pendientes / totalBase) * 360);
        const procesoDeg = Math.round((enProceso / totalBase) * 360);
        const terminadoDeg = Math.round((terminadas / totalBase) * 360);
        const pendientePct = Math.round((pendientes / totalBase) * 100);
        const procesoPct = Math.round((enProceso / totalBase) * 100);
        const terminadoPct = Math.round((terminadas / totalBase) * 100);
        const estados = [
            { label: "Pendientes", value: pendientes, tono: "is-red" },
            { label: "En proceso", value: enProceso, tono: "is-amber" },
            { label: "Terminadas", value: terminadas, tono: "is-green" }
        ];
        const maxEstado = Math.max(...estados.map(item => item.value), 1);

        return `
            <article class="executive-panel executive-situation">
                <h2>Situación operativa</h2>
                <div class="executive-donut-wrap">
                    <div class="executive-donut" style="--pending-deg:${pendienteDeg}deg;--process-deg:${procesoDeg}deg;--done-deg:${terminadoDeg}deg">
                        <span><strong>${escapar(total)}</strong><small>Total</small></span>
                    </div>
                    <dl class="executive-legend">
                        ${crearLeyendaEjecutiva("Pendientes", pendientes, pendientePct, "is-red")}
                        ${crearLeyendaEjecutiva("En proceso", enProceso, procesoPct, "is-amber")}
                        ${crearLeyendaEjecutiva("Terminadas", terminadas, terminadoPct, "is-green")}
                    </dl>
                </div>
                <div class="executive-situation-status">
                    <div class="executive-situation-status-heading">
                        <h3>Órdenes por estado</h3>
                        <a href="ordenes.html">Ver todas →</a>
                    </div>
                    <div class="executive-bars executive-bars-compact">${estados.map(item => `
                        <div class="executive-bar-row">
                            <span>${escapar(item.label)}</span>
                            <i><b class="${escaparAttr(item.tono)}" style="width:${Math.max(6, Math.round((item.value / maxEstado) * 100))}%"></b></i>
                            <strong>${escapar(item.value)}</strong>
                        </div>
                    `).join("")}</div>
                </div>
            </article>
        `;
    }
    function crearLeyendaEjecutiva(label, valor, pct, tono) {
        return `<div><dt><span class="${escaparAttr(tono)}"></span>${escapar(label)}</dt><dd>${escapar(valor)} (${escapar(pct)}%)</dd></div>`;
    }

    function crearAccesosEjecutivos(usuariosPendientes) {
        const accesos = obtenerAccesosDashboardCompartidos();
        return `
            <article class="executive-panel executive-quick">
                <div class="executive-panel-heading">
                    <h2>Accesos rápidos</h2>
                    ${usuariosPendientes ? `<span>${escapar(usuariosPendientes)} usuario(s) pendiente(s)</span>` : ""}
                </div>
                <div>${accesos.map(item => `
                    <a href="${escaparAttr(item.href)}" class="executive-quick-link"><span aria-hidden="true">${escapar(item.icono)}</span>${escapar(item.texto)}</a>
                `).join("")}</div>
            </article>
        `;
    }

    function accesoEjecutivo(texto, href, icono) { return { texto, href, icono }; }

    function obtenerAccesosDashboardCompartidos() {
        const permisos = window.PERMISOS || {};
        const usuario = typeof obtenerUsuarioActual === "function" ? obtenerUsuarioActual() : null;
        const rol = normalizarRol(usuario?.rol);
        return [
            acceso("+ NUEVA ORDEN", "agenda.html#nueva-orden", "+", permisos.ORDENES_CREAR),
            acceso("Clientes", "clientes.html", "♧", permisos.CLIENTES_VER_TODOS),
            acceso("Técnicos", "tecnicos.html", "♙", [permisos.TECNICOS_VER, permisos.TECNICOS_ADMINISTRAR]),
            acceso("Agenda", "agenda.html", "□", [permisos.AGENDA_VER_COMPLETA, permisos.AGENDA_VER_PROPIA], rol === "tecnico" ? "Agenda propia" : "Agenda"),
            acceso("Órdenes", "ordenes.html", "▤", [permisos.ORDENES_VER_TODAS, permisos.ORDENES_VER_ASIGNADAS], rol === "tecnico" ? "Mis órdenes" : "Órdenes"),
            acceso("Usuarios", "usuarios.html", "♙", permisos.USUARIOS_VER),
            acceso("Mensajes", "mensajes.html", "✉", permisos.MENSAJES_VER),
            acceso("Estadísticas", "estadisticas.html", "▥", permisos.ESTADISTICAS_VER_GENERALES),
            acceso("Configuración", "configuracion.html", "⚙", permisos.CONFIGURACION_VER)
        ].filter(accesoDashboardPermitido);
    }

    function accesoDashboardPermitido(item) {
        if (!item) return false;
        const permisos = Array.isArray(item.permiso) ? item.permiso.filter(Boolean) : [];
        if (item.permiso && !Array.isArray(item.permiso)) permisos.push(item.permiso);
        if (!permisos.length) return true;
        if (typeof tieneAlgunPermiso === "function") return tieneAlgunPermiso(permisos);
        if (typeof tienePermiso === "function") return permisos.some(permiso => tienePermiso(permiso));
        return false;
    }
    function renderizarDashboardColaborador(root, usuario, ordenes) {
        const visibles = obtenerOrdenesVisiblesPorUsuario(usuario, ordenes);
        const resumen = obtenerResumenAdministrador(visibles);
        const hoy = obtenerOrdenesDeHoy(visibles);
        const proximo = obtenerProximoTrabajo(visibles.filter(ordenActivaOperativa));
        const alertas = crearAlertas([
            resumen.sinTecnico ? `${resumen.sinTecnico} órdenes sin técnico asignado.` : "",
            visibles.filter(o => !o.fecha).length ? "Hay órdenes sin fecha." : "",
            visibles.filter(o => !o.hora).length ? "Hay órdenes sin hora." : "",
            visibles.filter(o => !o.direccion).length ? "Hay órdenes con dirección incompleta." : "",
            visibles.filter(o => !o.telefono).length ? "Hay clientes sin teléfono." : "",
            resumen.atrasadas ? `${resumen.atrasadas} trabajos atrasados.` : ""
        ]);

        root.innerHTML = crearBienvenida(usuario, { subtitulo: "Coordinación diaria", accionTexto: "+ NUEVA ORDEN", accionHref: "agenda.html#nueva-orden" }) +
            crearSeccion("Agenda diaria", crearListaOrdenesTecnico(hoy)) +
            crearSeccion("Próximo trabajo", crearTarjetaProximoTrabajo(proximo, { mostrarTecnico: true, mostrarAcciones: true })) +
            crearPanelSituacion([
                metrica("Trabajos de hoy", hoy.length, "agenda.html"),
                metrica("Pendientes", resumen.pendientes, "ordenes.html"),
                metrica("Sin técnico", resumen.sinTecnico, "ordenes.html"),
                metrica("En proceso", resumen.enProceso, "ordenes.html")
            ]) +
            crearSeccion("Pendientes operativos", alertas || crearEstadoVacio("Sin pendientes operativos", "No hay desvíos visibles para coordinar.")) +
            crearAccesosRapidos(obtenerAccesosDashboardCompartidos());
    }

    function renderizarDashboardTecnico(root, usuario, ordenes) {
        if (!usuario.tecnicoId) {
            root.innerHTML = crearBienvenida(usuario, { subtitulo: "Dashboard técnico", accionTexto: "VER MIS ÓRDENES", accionHref: "ordenes.html" }) +
                crearEstadoVacio("Tu cuenta todavía no está vinculada a un técnico.", "Solicitá al administrador que complete la vinculación para poder ver tus trabajos.") +
                crearAccesosRapidos(obtenerAccesosDashboardCompartidos());
            return;
        }

        const propias = obtenerOrdenesDelTecnico(usuario.tecnicoId, ordenes);
        const hoy = obtenerOrdenesDeHoy(propias);
        const futuras = propias.filter(ordenActivaOperativa).sort(compararFechaHora);
        const proximo = obtenerProximoTrabajo(futuras);
        const enProceso = propias.filter(o => normalizar(o.estado).includes("proceso")).length;
        const realizadas = propias.filter(o => normalizar(o.estado).includes("realizado") || normalizar(o.estado).includes("terminado")).length;
        const accionTexto = proximo ? "VER PRÓXIMO TRABAJO" : "VER MIS ÓRDENES";

        root.innerHTML = crearBienvenida(usuario, { subtitulo: `${hoy.length} trabajos para hoy`, accionTexto, accionHref: proximo ? `ordenes.html?orden=${encodeURIComponent(proximo.id || "")}` : "ordenes.html" }) +
            crearSeccion("Mis órdenes asignadas", crearListaOrdenesTecnico(futuras, { destacadaId: proximo?.id })) +
            crearMetricas([
                metrica("Trabajos de hoy", hoy.length, "ordenes.html"),
                metrica("En proceso", enProceso, "ordenes.html"),
                metrica("Realizados", realizadas, "ordenes.html"),
                metrica("Próximos", futuras.length, "ordenes.html")
            ]) +
            crearAccesosRapidos(obtenerAccesosDashboardCompartidos());
    }

    function renderizarDashboardCliente(root, usuario, ordenes) {
        if (!usuario.clienteId) {
            root.innerHTML = crearBienvenida(usuario, { subtitulo: "Portal de cliente", accionTexto: "MIS SERVICIOS" }) +
                crearEstadoVacio("Tu cuenta todavía no está vinculada a una ficha de cliente.", "La administración debe completar la vinculación para mostrar tus servicios.") +
                crearSeccion("Servicios", crearEstadoVacio("Sin servicios visibles", "Cuando tu ficha esté vinculada, vas a ver tus servicios registrados.")) +
                crearAccesosRapidos(obtenerAccesosDashboardCompartidos());
            return;
        }

        const propias = obtenerOrdenesDelCliente(usuario.clienteId, ordenes);
        const proximo = obtenerProximoTrabajo(propias.filter(ordenActivaOperativa));
        const ultimo = propias.slice().sort((a, b) => compararFechaHora(b, a))[0];

        root.innerHTML = crearBienvenida(usuario, { subtitulo: "Mis servicios", accionTexto: "MIS SERVICIOS" }) +
            crearMetricas([
                metrica("Servicios propios", propias.length, ""),
                metrica("Próximos", propias.filter(ordenActivaOperativa).length, ""),
                metrica("Finalizados", propias.filter(ordenFinalizada).length, "")
            ]) +
            crearSeccion("Próximo servicio", crearTarjetaProximoTrabajo(proximo, { mostrarAcciones: false })) +
            crearSeccion("Último servicio", ultimo ? crearTarjetaProximoTrabajo(ultimo, { mostrarAcciones: false, tituloFecha: "Último" }) : crearEstadoVacio("Sin servicios registrados", "Todavía no hay trabajos vinculados a tu ficha.")) +
            crearAccesosRapidos(obtenerAccesosDashboardCompartidos());
    }

    function renderizarDashboardClientePendiente(root, usuario) {
        root.innerHTML = crearBienvenida(usuario, { subtitulo: "Cuenta pendiente de validación", accionTexto: "CUENTA PENDIENTE DE VALIDACIÓN" }) +
            crearSeccion("Estado de la cuenta", `
                <article class="role-panel pending-panel">
                    <h2>Tu cuenta está pendiente de validación.</h2>
                    <p>Tu cuenta fue creada correctamente. Un administrador debe revisar y asignar tu perfil definitivo.</p>
                    <dl class="role-details">
                        <div><dt>Nombre</dt><dd>${escapar(usuario.nombreCompleto || usuario.nombre || "Usuario")}</dd></div>
                        <div><dt>Email</dt><dd>${escapar(usuario.email || "Sin email")}</dd></div>
                        <div><dt>Teléfono</dt><dd>${escapar(usuario.telefono || "Sin teléfono")}</dd></div>
                        <div><dt>Estado</dt><dd>Cliente pendiente</dd></div>
                        <div><dt>Fecha de registro</dt><dd>${formatearFechaHumana(usuario.fechaCreacion)}</dd></div>
                        <div><dt>Origen</dt><dd>${usuario.origen === "registro" ? "Registro público" : "Creado por administración"}</dd></div>
                    </dl>
                    <ol class="pending-steps">
                        <li>Completá tus datos básicos.</li>
                        <li>Esperá la validación administrativa.</li>
                        <li>Accedé a tus servicios cuando tu cuenta sea aprobada.</li>
                    </ol>
                </article>
            `) +
            crearAccesosRapidos(obtenerAccesosDashboardCompartidos());
    }

    function crearBienvenida(usuario, opciones = {}) {
        const { subtitulo = "", accionTexto = "", accionHref = "" } = opciones;
        const saludo = obtenerSaludo();
        const rol = etiquetaRol(usuario.rol);
        const nombre = usuario.nombreCompleto || [usuario.nombre, usuario.apellido].filter(Boolean).join(" ") || usuario.nombre || "Usuario";
        const accion = accionTexto
            ? (accionHref ? `<a class="dashboard-primary-action" href="${escaparAttr(accionHref)}">${escapar(accionTexto)}</a>` : `<span class="dashboard-primary-action is-disabled">${escapar(accionTexto)}</span>`)
            : "";

        return `
            <section class="executive-welcome dashboard-welcome" aria-label="Bienvenida">
                <div class="executive-welcome-accent" aria-hidden="true"></div>
                ${crearAvatarSaludo(usuario, "executive-welcome-avatar")}
                <div class="executive-welcome-copy">
                    <span class="executive-role-label">${escapar(rol)}</span>
                    <h1>${escapar(saludo)}, <strong>${escapar(nombre)}</strong></h1>
                    <p>${escapar(obtenerFechaActualTexto())}</p>
                    ${subtitulo ? `<small>${escapar(subtitulo)}</small>` : ""}
                </div>
                ${accion}
            </section>
        `;
    }

    function crearMetricas(items) {
        const visibles = items.filter(Boolean);
        if (!visibles.length) return "";
        return `<section class="dashboard-metrics role-metrics" aria-label="Resumen">${visibles.map(item => `
            <article class="metric-card role-metric-card">
                <strong>${escapar(item.valor)}</strong>
                <span>${escapar(item.titulo)}</span>
                ${item.href ? `<a href="${escaparAttr(item.href)}">Ver <span aria-hidden="true">→</span></a>` : `<small>Solo información propia</small>`}
            </article>
        `).join("")}</section>`;
    }

    function crearSeccion(titulo, contenido) {
        return `<section class="dashboard-section role-section"><h2>${escapar(titulo)}</h2>${contenido}</section>`;
    }

    function crearAccesosRapidos(items) {
        const visibles = items.filter(item => item && item.href && accesoDashboardPermitido(item));
        if (!visibles.length) return "";
        return crearSeccion("Accesos rápidos", `<div class="quick-actions role-quick-actions">${visibles.map(item => `
            <a href="${escaparAttr(item.href)}" class="quick-action"><span aria-hidden="true">${escapar(item.icono)}</span>${escapar(item.texto)}</a>
        `).join("")}</div>`);
    }
    function crearPanelSituacion(items) {
        const visibles = items.filter(Boolean);
        if (!visibles.length) return "";
        return `<section class="admin-situation-panel" aria-label="Situación operativa">${visibles.map(item => `
            <a class="admin-situation-item" href="${escaparAttr(item.href || "#")}">
                <span>${escapar(item.titulo)}</span>
                <strong>${escapar(item.valor)}</strong>
            </a>
        `).join("")}</section>`;
    }

    function crearPanelFuturo() {
        return `
            <article class="admin-future-panel">
                <strong>Módulos administrativos preparados</strong>
                <p>Presupuestos, gastos, costos, facturación, rentabilidad y estadísticas avanzadas se van a integrar cuando existan datos reales. No se muestran cifras simuladas.</p>
            </article>
        `;
    }

    function crearTarjetaProximoTrabajo(orden, opciones = {}) {
        if (!orden) return crearEstadoVacio("Sin trabajos próximos", "No hay trabajos programados visibles para tu rol.");
        const direccion = construirDireccionOrden(orden);
        const maps = opciones.mostrarAcciones && direccion ? crearBotonMaps(orden, direccion) : "";
        const whatsapp = opciones.mostrarAcciones && orden.telefono ? crearBotonWhatsApp(orden) : "";
        const ver = opciones.mostrarAcciones ? `<a class="next-work-action" href="ordenes.html?orden=${encodeURIComponent(orden.id || "")}">Ver orden</a>` : "";
        return `
            <article class="next-work-card role-next-work-card">
                <div class="next-work-time">
                    <span>${escapar(opciones.tituloFecha || etiquetaFechaOrden(orden))}</span>
                    <strong>${escapar(orden.hora || "--:--")}</strong>
                </div>
                <div class="next-work-info">
                    <strong>${escapar(orden.cliente || "Cliente sin nombre")}</strong>
                    <span>${escapar(orden.trabajo || orden.descripcion || "Trabajo sin descripción")}</span>
                    ${direccion ? `<a class="role-address" href="${mapsUrl(direccion)}" target="_blank" rel="noopener">⌖ ${escapar(direccion)}</a>` : `<small>Sin dirección cargada</small>`}
                    <small>${escapar(orden.tecnicoNombre || orden.tecnicoId || "Sin técnico asignado")} · ${escapar(etiquetaEstado(orden.estado))}</small>
                    ${orden.telefono ? `<small>Teléfono: ${escapar(orden.telefono)}</small>` : ""}
                </div>
                <div class="role-card-actions">${maps}${whatsapp}${ver}</div>
            </article>
        `;
    }

    function crearListaOrdenesTecnico(ordenes, opciones = {}) {
        if (!ordenes.length) return crearEstadoVacio("No tenés trabajos asignados para hoy.", "Si tenés trabajos futuros, aparecerán como próximo trabajo.");
        return `<div class="role-order-list">${ordenes.sort(compararFechaHora).map(orden => `
            <article class="role-order-card${String(orden.id || "") === String(opciones.destacadaId || "") ? " is-next" : ""}">
                <strong>${escapar(etiquetaFechaOrden(orden))} · ${escapar(orden.hora || "--:--")} · ${escapar(orden.cliente || "Cliente")}</strong>
                <a class="role-address" href="${mapsUrl(construirDireccionOrden(orden))}" target="_blank" rel="noopener">${escapar(construirDireccionOrden(orden) || "Sin dirección")}</a>
                <span>${escapar(orden.trabajo || "Trabajo sin descripción")}</span>
                <small>${escapar(etiquetaEstado(orden.estado))}</small>
            </article>
        `).join("")}</div>`;
    }

    function crearAlertas(alertas) {
        const limpias = alertas.filter(Boolean);
        if (!limpias.length) return "";
        return `<div class="role-alerts">${limpias.map(alerta => `<article>${escapar(alerta)}</article>`).join("")}</div>`;
    }

    function crearEstadoVacio(titulo, texto) {
        return `<article class="role-empty"><strong>${escapar(titulo)}</strong><span>${escapar(texto || "")}</span></article>`;
    }

    function crearErrorDashboard() {
        return crearEstadoVacio("No se pudo cargar el Dashboard.", "Revisá la consola para obtener más información.");
    }
    function obtenerOrdenesSeguras() {
        if (typeof obtenerOrdenes === "function") return obtenerOrdenes();
        try {
            const data = JSON.parse(localStorage.getItem("ordenes") || "[]");
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return [];
        }
    }

    function obtenerUsuariosLocales() {
        return typeof obtenerUsuarios === "function" ? obtenerUsuarios() : [];
    }

    function obtenerOrdenesVisiblesPorUsuario(usuario, ordenes) {
        if (typeof obtenerOrdenesVisiblesParaUsuario === "function") return obtenerOrdenesVisiblesParaUsuario(ordenes, usuario);
        return [];
    }

    function obtenerOrdenesDelTecnico(tecnicoId, ordenes) {
        const id = normalizar(tecnicoId);
        if (!id) return [];
        return ordenes.filter(orden => normalizar(orden.tecnicoId) === id || (Array.isArray(orden.tecnicosAsignados) && orden.tecnicosAsignados.some(t => normalizar(t.id || t.tecnicoId) === id)));
    }

    function obtenerOrdenesDelCliente(clienteId, ordenes) {
        const id = normalizar(clienteId);
        if (!id) return [];
        return ordenes.filter(orden => normalizar(orden.clienteId) === id || normalizar(orden.clienteUsuarioId) === id);
    }

    function obtenerOrdenesDeHoy(ordenes) {
        const hoy = fechaLocalISO(new Date());
        return ordenes.filter(orden => fechaOrdenISO(orden.fecha) === hoy && !ordenFinalizada(orden));
    }

    function obtenerProximoTrabajo(ordenes) {
        const ahora = new Date();
        return ordenes
            .filter(orden => !ordenFinalizada(orden))
            .filter(orden => fechaHoraOrden(orden) >= inicioDelDia(ahora))
            .sort(compararFechaHora)[0] || null;
    }

    function obtenerResumenAdministrador(ordenes) {
        return {
            pendientes: ordenes.filter(o => normalizar(o.estado || "pendiente").includes("pendiente")).length,
            enProceso: ordenes.filter(o => normalizar(o.estado).includes("proceso")).length,
            realizados: ordenes.filter(o => normalizar(o.estado).includes("realizado")).length,
            terminadas: ordenes.filter(ordenFinalizada).length,
            sinTecnico: ordenes.filter(o => !o.tecnicoId && !o.tecnicoNombre).length,
            atrasadas: obtenerOrdenesAtrasadas(ordenes).length
        };
    }

    function obtenerOrdenesAtrasadas(ordenes) {
        const hoy = inicioDelDia(new Date());
        return ordenes.filter(orden => !ordenFinalizada(orden) && fechaHoraOrden(orden) < hoy);
    }

    function ordenFinalizada(orden) {
        const estado = normalizar(orden.estado);
        return Boolean(orden.historial) || ESTADOS_FINALIZADOS.some(final => estado.includes(final));
    }

    function ordenActivaOperativa(orden) {
        return !ordenFinalizada(orden) && Boolean(orden.fecha);
    }

    function fechaHoraOrden(orden) {
        const fecha = fechaOrdenISO(orden.fecha) || fechaLocalISO(new Date(0));
        const hora = /^\d{2}:\d{2}/.test(String(orden.hora || "")) ? orden.hora : "23:59";
        return new Date(`${fecha}T${hora}`);
    }

    function compararFechaHora(a, b) {
        return fechaHoraOrden(a) - fechaHoraOrden(b);
    }

    function fechaOrdenISO(valor) {
        const texto = String(valor || "").trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
        const match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
        return "";
    }

    function inicioDelDia(fecha) {
        return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    }

    function fechaLocalISO(fecha) {
        return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
    }

    function construirDireccionOrden(orden) {
        if (orden.direccion) return String(orden.direccion).trim();
        const partes = [orden.calle, orden.numero].filter(Boolean).join(" ").trim();
        const extra = [];
        if (orden.piso && orden.piso !== "-") extra.push(`Piso ${orden.piso}`);
        if (orden.departamento && orden.departamento !== "-") extra.push(`Dpto. ${orden.departamento}`);
        const ciudad = orden.ciudad || "Córdoba";
        const provincia = orden.provincia || "Córdoba";
        return [partes, ...extra, ciudad, provincia, "Argentina"].filter(Boolean).join(", ");
    }

    function crearBotonMaps(orden, direccion) {
        if (typeof tienePermiso === "function" && !tienePermiso("ordenes.abrirMaps")) return "";
        return `<a class="role-action-button" href="${mapsUrl(direccion)}" target="_blank" rel="noopener">Maps</a>`;
    }

    function crearBotonWhatsApp(orden) {
        if (typeof tienePermiso === "function" && !tienePermiso("ordenes.contactarCliente")) return "";
        const telefono = normalizarTelefono(orden.telefono);
        if (!telefono) return "";
        const mensaje = encodeURIComponent(`Hola ${orden.cliente || ""}, te escribo de La Solución por el trabajo programado para el ${formatearFechaHumana(orden.fecha)} a las ${orden.hora || "hora acordada"}.`);
        return `<a class="role-action-button" href="https://wa.me/${telefono}?text=${mensaje}" target="_blank" rel="noopener">WhatsApp</a>`;
    }

    function mapsUrl(direccion) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion || "Córdoba, Argentina")}`;
    }

    function normalizarTelefono(telefono) {
        const limpio = String(telefono || "").replace(/\D/g, "");
        if (!limpio) return "";
        return limpio.startsWith("54") ? limpio : `54${limpio}`;
    }

    function metrica(titulo, valor, href) { return { titulo, valor, href }; }
    function acceso(texto, href, icono, permiso, etiquetaVisible) { return { texto: etiquetaVisible || texto, href, icono, permiso }; }
    function normalizarRol(rol) { return String(rol || "").trim().toLowerCase(); }
    function normalizar(valor) { return String(valor || "").trim().toLowerCase(); }
    function etiquetaRol(rol) { return { administrador: "Administrador", colaborador: "Colaborador", tecnico: "Técnico", cliente: "Cliente", cliente_pendiente: "Cliente pendiente" }[normalizarRol(rol)] || "Sin rol"; }
    function etiquetaEstado(estado) { return { pendiente: "Pendiente", asignada: "Asignada", confirmada: "Confirmada", "en proceso": "En proceso", terminado: "Terminado", terminada: "Terminada", cancelada: "Cancelada", realizado: "Trabajo realizado" }[normalizar(estado)] || (estado || "Pendiente"); }
    function etiquetaFechaOrden(orden) { return fechaOrdenISO(orden.fecha) === fechaLocalISO(new Date()) ? `Hoy · ${formatearFechaVisible(orden.fecha)}` : formatearFechaVisible(orden.fecha); }
    function crearAvatarSaludo(usuario, clase) {
        const nombre = usuario?.nombreCompleto || [usuario?.nombre, usuario?.apellido].filter(Boolean).join(" ") || usuario?.nombre || "Usuario";
        const iniciales = nombre
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(parte => parte.charAt(0).toUpperCase())
            .join("") || "U";
        return `<span class="${escaparAttr(clase)}" aria-label="Avatar de ${escaparAttr(nombre)}"><span>${escapar(iniciales)}</span></span>`;
    }

    function formatearFechaVisible(valor) { return typeof window.formatearFechaArgentina === "function" ? window.formatearFechaArgentina(valor) : (fechaOrdenISO(valor) || valor || "Sin fecha"); }
    function obtenerFechaActualTexto() { return capitalizarPrimeraLetra(typeof window.formatearFechaConDiaArgentina === "function" ? window.formatearFechaConDiaArgentina(new Date()) : formatearFechaVisible(fechaLocalISO(new Date()))); }
    function obtenerSaludo() { const hora = new Date().getHours(); return hora < 12 ? "Buen día" : hora < 20 ? "Buenas tardes" : "Buenas noches"; }
    function capitalizarPrimeraLetra(valor) { const texto = String(valor || ""); return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto; }
    function formatearFechaHumana(valor) { return formatearFechaVisible(valor); }
    function escapar(valor) { return String(valor ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
    function escaparAttr(valor) { return escapar(valor).replace(/`/g, "&#96;"); }

    window.DashboardRoles = { obtenerOrdenesDelTecnico, obtenerOrdenesDelCliente, obtenerOrdenesDeHoy, obtenerProximoTrabajo, obtenerOrdenesAtrasadas, obtenerResumenAdministrador, construirDireccionOrden };
})();












