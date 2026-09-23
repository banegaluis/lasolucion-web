(function () {
    "use strict";

    const estado = { todos: [], clientes: [], seleccionado: null, busqueda: "", filtroEstado: "activos", orden: "nombre", guardando: false, duplicadosPendientes: null, clienteIdEditando: null, direccionPrincipalIdEditando: null };
    let guardandoCliente = false;
    const $ = (id) => document.getElementById(id);
    const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);
    const tel = (v) => String(v || "").replace(/[^0-9+]/g, "");
    const debounce = (fn, ms = 260) => { let id; return (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), ms); }; };

    function mensaje(texto, tipo = "") {
        const nodo = $("clientesMensaje");
        if (!nodo) return;
        nodo.textContent = texto || "";
        nodo.className = `clientes-message ${tipo ? `is-${tipo}` : ""}`.trim();
    }

    function mensajeModal(id, texto, tipo = "") {
        const nodo = $(id);
        if (!nodo) return;
        nodo.hidden = !texto;
        nodo.textContent = texto || "";
        nodo.className = `clientes-modal-message ${tipo ? `is-${tipo}` : ""}`.trim();
    }

    function textoError(error) {
        if (typeof error === "string") return error;
        if (!error) return "No se pudo completar la operación.";
        try { return JSON.stringify(error, null, 2); }
        catch { return String(error); }
    }

    async function verificarSesion() {
        const r = await window.AuthSupabaseService?.verificarSesionOperativa?.();
        if (!r?.ok) {
            mensaje(r?.error || "Iniciá sesión Supabase como admin o colaborador para gestionar clientes.", "error");
            renderEstado("error", "No se pudo validar la sesión Supabase", "La sesión local está activa, pero falta una sesión Supabase operativa para gestionar clientes.");
            return false;
        }
        return true;
    }

    function ordenesLocales() {
        if (typeof window.obtenerOrdenes === "function") return window.obtenerOrdenes();
        try { return JSON.parse(localStorage.getItem("ordenes") || "[]"); } catch { return []; }
    }

    function trabajos(cliente) {
        const nombre = String(cliente.nombre_completo || cliente.nombre || "").trim().toLowerCase();
        const telefono = tel(cliente.telefono_principal);
        const lista = ordenesLocales().filter(o => String(o.clienteIdSupabase || "") === String(cliente.id) || (nombre && String(o.cliente || "").trim().toLowerCase() === nombre) || (telefono && tel(o.telefono) === telefono));
        const terminadas = lista.filter(o => String(o.estado || "").toLowerCase() === "terminado");
        const ordenadas = [...lista].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
        const futuras = [...lista].filter(o => String(o.estado || "").toLowerCase() !== "terminado" && o.fecha).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        return { total: lista.length, terminadas: terminadas.length, ultimo: ordenadas[0] || null, proxima: futuras[0] || null };
    }

    function fecha(v) { const d = new Date(v); return v && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : ""; }
    function direccionPrincipal(c) { return window.ClientesSupabaseService?.obtenerDireccionPrincipalCliente?.(c) || (c.direcciones_clientes || []).find(d => d.activo && d.es_principal) || (c.direcciones_clientes || []).find(d => d.activo) || (c.direcciones_clientes || [])[0] || null; }

    async function cargarClientes() {
        if (!await verificarSesion()) return;
        mensaje("Cargando clientes...", "loading");
        renderEstado("loading", "Cargando clientes", "Estamos consultando la base de clientes.");
        const r = await window.ClientesSupabaseService.listarClientes({ busqueda: estado.busqueda, incluirInactivos: true });
        if (!r.ok) { mensaje(textoError(r.error), "error"); renderEstado("error", "No se pudieron cargar los clientes", textoError(r.error)); return; }
        estado.todos = r.data || [];
        aplicarFiltros();
        mensaje(estado.todos.length ? "" : "No hay clientes para mostrar.");
    }

    function aplicarFiltros() {
        let lista = [...estado.todos];
        if (estado.filtroEstado === "activos") lista = lista.filter(c => c.activo !== false);
        if (estado.filtroEstado === "inactivos") lista = lista.filter(c => c.activo === false);
        lista.sort((a, b) => {
            if (estado.orden === "recientes") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            if (estado.orden === "ultimoTrabajo") return new Date(trabajos(b).ultimo?.fecha || 0) - new Date(trabajos(a).ultimo?.fecha || 0);
            return String(a.nombre_completo || a.nombre || "").localeCompare(String(b.nombre_completo || b.nombre || ""), "es");
        });
        estado.clientes = lista;
        if (estado.seleccionado && !lista.some(c => String(c.id) === String(estado.seleccionado))) estado.seleccionado = lista[0]?.id || null;
        if (!estado.seleccionado && lista[0]) estado.seleccionado = lista[0].id;
        renderResumen(); renderClientes(); renderDetalle();
    }

    function renderResumen() {
        const total = estado.todos.length, activos = estado.todos.filter(c => c.activo !== false).length;
        $("metricTotalClientes").textContent = total;
        $("metricClientesActivos").textContent = activos;
        $("metricClientesInactivos").textContent = total - activos;
        $("metricTrabajosTerminados").textContent = estado.todos.reduce((acc, c) => acc + trabajos(c).terminadas, 0);
    }

    function icono() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.8 19a4.8 4.8 0 0 1 9.4 0M16 11.2a2.5 2.5 0 1 0 0-5M14.8 14.2A4.3 4.3 0 0 1 20.2 19"/></svg>'; }
    function renderEstado(tipo, titulo, texto) {
        const accion = tipo === "empty" ? '<div class="cliente-empty-actions"><button type="button" class="primary" data-action="crear-primer-cliente">+ CREAR PRIMER CLIENTE</button></div>' : "";
        $("listaClientes").innerHTML = `<section class="clientes-empty clientes-state-${esc(tipo)}"><div><div class="clientes-empty-icon">${icono()}</div><h2>${esc(titulo)}</h2><p>${esc(texto)}</p>${accion}</div></section>`;
    }

    function renderClientes() {
        const lista = $("listaClientes"); lista.innerHTML = "";
        if (!estado.clientes.length) { renderEstado(estado.todos.length ? "no-results" : "empty", estado.todos.length ? "No encontramos clientes con esos filtros" : "Todavía no hay clientes registrados", estado.todos.length ? "Probá ajustar la búsqueda, el estado o el orden del listado." : "Los clientes que cargues podrán reutilizarse en nuevas órdenes, presupuestos e informes."); return; }
        estado.clientes.forEach(c => {
            const d = direccionPrincipal(c), t = trabajos(c), ultimo = t.ultimo ? `${t.ultimo.trabajo || t.ultimo.descripcion || "Último trabajo"}${t.ultimo.fecha ? ` · ${fecha(t.ultimo.fecha)}` : ""}` : "Sin trabajos";
            const el = document.createElement("article"); el.className = `cliente-card role-order-card ${String(c.id) === String(estado.seleccionado) ? "is-active" : ""}`;
            el.innerHTML = `<div class="cliente-card-main"><h3>${esc(c.nombre_completo || c.nombre)}</h3><p>${esc(c.telefono_principal || "Sin teléfono principal")}${c.email ? ` · ${esc(c.email)}` : ""}</p><small>${esc(d?.direccion_completa || "Sin dirección principal")}</small><div class="cliente-card-meta"><span class="cliente-status ${c.activo ? "is-active" : "is-inactive"}">${c.activo ? "Activo" : "Inactivo"}</span><span class="cliente-meta-item"><strong>${t.total}</strong><span>órdenes</span></span><span class="cliente-meta-item"><strong>${t.terminadas}</strong><span>terminadas</span></span><span class="cliente-meta-item"><span>${esc(ultimo)}</span></span></div></div><div class="cliente-card-actions"><button type="button" class="role-action-button primary" data-action="ver-cliente" data-client-id="${esc(c.id)}">Ver</button><button type="button" class="role-action-button" data-action="editar-cliente" data-client-id="${esc(c.id)}">Editar</button><button type="button" class="role-action-button danger" data-action="toggle-cliente" data-client-id="${esc(c.id)}">${c.activo ? "Desactivar" : "Reactivar"}</button></div>`;
            lista.appendChild(el);
        });
    }

    function seleccionado() { return estado.todos.find(c => String(c.id) === String(estado.seleccionado)) || null; }
    function renderDetalle() {
        const c = seleccionado();
        if (!c) { $("clienteDetalle").innerHTML = '<section class="clientes-state-card"><h2>Seleccioná un cliente</h2><p>El detalle mostrará datos, direcciones y resumen de trabajos.</p></section>'; return; }
        const d = direccionPrincipal(c), t = trabajos(c);
        $("clienteDetalle").innerHTML = `<section class="clientes-detail-card cliente-detail-card"><header><div><p class="clientes-eyebrow">Ficha del cliente</p><h2>${esc(c.nombre_completo || c.nombre)}</h2><p>${esc(c.telefono_principal || "Sin teléfono")}</p></div><span class="cliente-status ${c.activo ? "is-active" : "is-inactive"}">${c.activo ? "Activo" : "Inactivo"}</span></header><dl class="cliente-data">${c.telefono_alternativo ? `<div><dt>Teléfono alternativo</dt><dd>${esc(c.telefono_alternativo)}</dd></div>` : ""}${c.email ? `<div><dt>Email</dt><dd>${esc(c.email)}</dd></div>` : ""}${c.dni ? `<div><dt>DNI</dt><dd>${esc(c.dni)}</dd></div>` : ""}<div><dt>Dirección principal</dt><dd>${esc(d?.direccion_completa || "Sin dirección principal")}</dd></div><div><dt>Notas</dt><dd>${esc(c.notas || "Sin notas cargadas")}</dd></div></dl><div class="cliente-job-summary"><span>Resumen de trabajos</span><strong>${t.total} órdenes · ${t.terminadas} terminadas</strong><p>${t.ultimo ? `Última orden: ${esc(t.ultimo.trabajo || t.ultimo.descripcion || "Trabajo")} ${t.ultimo.fecha ? `· ${fecha(t.ultimo.fecha)}` : ""}` : "Sin trabajos registrados"}</p><p>${t.proxima ? `Próxima orden: ${esc(t.proxima.trabajo || t.proxima.descripcion || "Trabajo")} ${fecha(t.proxima.fecha)}` : "Sin próxima orden"}</p></div><div class="cliente-actions"><button type="button" class="primary" class="role-action-button" data-action="editar-cliente">Editar cliente</button><button type="button" class="role-action-button" data-action="nueva-direccion">Agregar dirección</button><button type="button" class="role-action-button" data-action="nueva-orden-cliente">Nueva orden para este cliente</button><button type="button" class="role-action-button danger" data-action="toggle-cliente">${c.activo ? "Desactivar" : "Reactivar"}</button></div><h3>Direcciones</h3><div class="cliente-direcciones">${(c.direcciones_clientes || []).map(renderDireccion).join("") || "<p>No hay direcciones cargadas.</p>"}</div></section>`;
    }

    function renderDireccion(d) { return `<article class="cliente-address ${d.activo ? "" : "is-inactive"}"><div><strong>${esc(d.alias || "Dirección")}</strong><span>${esc(d.direccion_completa || "")}</span><div class="cliente-card-meta">${d.es_principal ? '<em class="is-primary">Principal</em>' : ""}${!d.activo ? "<em>Inactiva</em>" : ""}</div></div><div class="cliente-address-actions"><button type="button" class="role-action-button" data-action="editar-direccion" data-address-id="${esc(d.id)}">Editar</button>${d.activo && !d.es_principal ? `<button type="button" class="role-action-button" data-action="principal-direccion" data-address-id="${esc(d.id)}">Principal</button>` : ""}${d.activo ? `<button type="button" class="role-action-button danger" data-action="desactivar-direccion" data-address-id="${esc(d.id)}">Desactivar</button>` : ""}</div></article>`; }

    function lock(v) { document.body.classList.toggle("modal-scroll-locked", v); document.documentElement.classList.toggle("modal-scroll-locked", v); }
    function setVal(id, v = "") { const n = $(id); if (n) n.value = v || ""; }
    function datosCliente() { return { nombre: $("clienteNombre").value, apellido: "", telefono_principal: $("clienteTelefono").value, telefono_alternativo: $("clienteTelefonoAlternativo").value, email: $("clienteEmail").value, dni: $("clienteDni").value, notas: $("clienteNotas").value }; }
    function datosDireccionInicial() { return { alias: $("clienteDireccionAlias")?.value || "", calle: $("clienteDireccionCalle").value, numero: $("clienteDireccionNumero").value, piso: $("clienteDireccionPiso").value, departamento: $("clienteDireccionDepartamento").value, barrio: $("clienteDireccionBarrio").value, ciudad: $("clienteDireccionCiudad").value, provincia: $("clienteDireccionProvincia").value, codigo_postal: $("clienteDireccionCodigoPostal").value, activo: true }; }
    function datosDireccion() { return { calle: $("direccionCalle").value, numero: $("direccionNumero").value, piso: $("direccionPiso").value, departamento: $("direccionDepartamento").value, barrio: $("direccionBarrio").value, ciudad: $("direccionCiudad").value, provincia: $("direccionProvincia").value, codigo_postal: $("direccionCodigoPostal").value, activo: $("direccionActiva").checked }; }

    function limpiarDirInicial() { ["Calle", "Numero", "Piso", "Departamento", "Barrio", "CodigoPostal"].forEach(x => setVal(`clienteDireccion${x}`)); setVal("clienteDireccionAlias", ""); setVal("clienteDireccionCiudad", "Córdoba"); setVal("clienteDireccionProvincia", "Córdoba"); $("clienteDireccionPrincipal").checked = true; }
    function cargarDireccionPrincipalEnFormulario(direccion = null) { setVal("clienteDireccionAlias", direccion?.alias); setVal("clienteDireccionCalle", direccion?.calle); setVal("clienteDireccionNumero", direccion?.numero); setVal("clienteDireccionPiso", direccion?.piso); setVal("clienteDireccionDepartamento", direccion?.departamento); setVal("clienteDireccionBarrio", direccion?.barrio); setVal("clienteDireccionCiudad", direccion?.ciudad || "Córdoba"); setVal("clienteDireccionProvincia", direccion?.provincia || "Córdoba"); setVal("clienteDireccionCodigoPostal", direccion?.codigo_postal); $("clienteDireccionPrincipal").checked = true; }
    function abrirModalCliente(c = null) { const direccion = direccionPrincipal(c); estado.duplicadosPendientes = null; estado.clienteIdEditando = c?.id || null; estado.direccionPrincipalIdEditando = direccion?.id || null; $("clienteForm").dataset.clienteId = estado.clienteIdEditando || ""; $("clienteForm").dataset.direccionPrincipalId = estado.direccionPrincipalIdEditando || ""; $("clienteModalTitulo").textContent = c ? "Editar cliente" : "Nuevo cliente"; setVal("clienteNombre", c?.nombre_completo || c?.nombre); setVal("clienteTelefono", c?.telefono_principal); setVal("clienteTelefonoAlternativo", c?.telefono_alternativo); setVal("clienteEmail", c?.email); setVal("clienteDni", c?.dni); setVal("clienteNotas", c?.notas); $("clienteDireccionInicial").hidden = false; if (c) cargarDireccionPrincipalEnFormulario(direccion); else limpiarDirInicial(); mensajeModal("clienteModalMensaje", ""); $("clienteDuplicados").hidden = true; $("clienteDuplicados").innerHTML = ""; $("clienteModal").hidden = false; lock(true); setTimeout(() => $("clienteNombre")?.focus(), 0); }
    function cerrarModalCliente() { mensajeModal("clienteModalMensaje", ""); $("clienteModal").hidden = true; estado.clienteIdEditando = null; estado.direccionPrincipalIdEditando = null; $("clienteForm").dataset.clienteId = ""; $("clienteForm").dataset.direccionPrincipalId = ""; guardandoCliente = false; estado.guardando = false; const btnGuardar = $("btnGuardarCliente"); if (btnGuardar) btnGuardar.disabled = false; lock(!$("direccionModal")?.hidden); }
    function abrirModalDireccion(d = null) { const c = seleccionado(); if (!c) return; $("direccionForm").dataset.addressId = d?.id || ""; $("direccionModalTitulo").textContent = d ? "Editar dirección" : "Nueva dirección"; setVal("direccionCalle", d?.calle); setVal("direccionNumero", d?.numero); setVal("direccionPiso", d?.piso); setVal("direccionDepartamento", d?.departamento); setVal("direccionBarrio", d?.barrio); setVal("direccionCiudad", d?.ciudad || "Córdoba"); setVal("direccionProvincia", d?.provincia || "Córdoba"); setVal("direccionCodigoPostal", d?.codigo_postal); $("direccionPrincipal").checked = d ? d.es_principal : !(c.direcciones_clientes || []).some(x => x.activo); $("direccionActiva").checked = d ? d.activo !== false : true; mensajeModal("direccionModalMensaje", ""); $("direccionModal").hidden = false; lock(true); }
    function cerrarModalDireccion() { mensajeModal("direccionModalMensaje", ""); $("direccionModal").hidden = true; estado.guardando = false; lock(!$("clienteModal")?.hidden); }

    function valor(id) { return String($(id)?.value || "").trim(); }
    function enfocar(id) { const n = $(id); if (n) { n.focus(); n.scrollIntoView({ block: "center", behavior: "smooth" }); } }
    function emailValido(email) { return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
    function validarClienteAntesDeGuardar(esEdicion) {
        const reglas = [
            ["clienteNombre", "Ingresá el nombre o razón social."],
            ["clienteTelefono", "Ingresá el teléfono principal."]
        ];
        if (!esEdicion) reglas.push(
            ["clienteDireccionCalle", "Ingresá la calle."],
            ["clienteDireccionNumero", "Ingresá el número."]
        );
        for (const [id, texto] of reglas) {
            if (!valor(id)) { mensajeModal("clienteModalMensaje", texto, "error"); enfocar(id); return false; }
        }
        const email = valor("clienteEmail");
        if (!emailValido(email)) { mensajeModal("clienteModalMensaje", "Ingresá un email válido o dejalo vacío.", "error"); enfocar("clienteEmail"); return false; }
        mensajeModal("clienteModalMensaje", "");
        return true;
    }

    async function guardarCliente(e, forzar = false) {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        if (guardandoCliente) {
            console.warn("[Clientes] Submit ignorado: ya hay una creación/edición de cliente en curso.");
            return;
        }

        const id = $("clienteForm").dataset.clienteId;
        if (!validarClienteAntesDeGuardar(Boolean(id))) return;

        const btnGuardar = $("btnGuardarCliente");
        guardandoCliente = true;
        estado.guardando = true;
        if (btnGuardar) btnGuardar.disabled = true;

        try {
            mensajeModal("clienteModalMensaje", "Guardando cliente...", "loading");
            const dir = datosDireccionInicial();
            let r;
            if (id) {
                r = await window.ClientesSupabaseService.actualizarCliente(id, datosCliente(), { omitirDuplicados: forzar });
                if (r.ok) {
                    const direccionId = estado.direccionPrincipalIdEditando || $("clienteForm").dataset.direccionPrincipalId;
                    const direccion = direccionId
                        ? await window.ClientesSupabaseService.actualizarDireccion(direccionId, id, dir, true)
                        : await window.ClientesSupabaseService.crearDireccion(id, dir, true);
                    if (!direccion.ok) r = { ok: false, data: r.data, error: direccion.error };
                }
            } else {
                r = await window.ClientesSupabaseService.crearCliente(datosCliente(), dir, { omitirDuplicados: forzar });
            }

            if (r.duplicados?.length) {
                mostrarDuplicados(r.duplicados);
                mensajeModal("clienteModalMensaje", "Revisá posibles duplicados antes de continuar.", "error");
                return;
            }
            if (!r.ok) {
                mensajeModal("clienteModalMensaje", textoError(r.error), "error");
                return;
            }

            cerrarModalCliente();
            estado.seleccionado = r.data?.id || id || estado.seleccionado;
            await cargarClientes();
            mensaje("Cliente guardado correctamente.", "success");
        } finally {
            guardandoCliente = false;
            estado.guardando = false;
            if (btnGuardar) btnGuardar.disabled = false;
        }
    }
    function mostrarDuplicados(ds) { const box = $("clienteDuplicados"); box.hidden = false; box.innerHTML = `<strong>Encontramos un cliente que podría ser el mismo</strong>${ds.map(i => `<article class="cliente-duplicate-card"><h4>${esc(i.cliente.nombre_completo || i.cliente.nombre)}</h4><p>${esc(i.cliente.telefono_principal || "Sin teléfono")}</p><small>Coincidencias: ${esc((i.motivos || []).join(", "))}</small></article>`).join("")}<div class="cliente-duplicates-actions"><button type="button" data-duplicate-action="usar">Usar cliente existente</button><button type="button" data-duplicate-action="revisar">Revisar datos</button><button type="button" class="primary" data-duplicate-action="crear">Crear nuevo de todos modos</button></div>`; estado.duplicadosPendientes = ds; }
    async function guardarDireccion(e) { e.preventDefault(); const c = seleccionado(); if (!c || estado.guardando) return; estado.guardando = true; mensajeModal("direccionModalMensaje", "Guardando dirección...", "loading"); const id = $("direccionForm").dataset.addressId; const r = id ? await window.ClientesSupabaseService.actualizarDireccion(id, c.id, datosDireccion(), $("direccionPrincipal").checked) : await window.ClientesSupabaseService.crearDireccion(c.id, datosDireccion(), $("direccionPrincipal").checked); estado.guardando = false; if (!r.ok) return mensajeModal("direccionModalMensaje", textoError(r.error), "error"); cerrarModalDireccion(); await cargarClientes(); mensaje("Dirección guardada correctamente.", "success"); }
    async function toggleCliente(c) { if (!c || estado.guardando) return; estado.guardando = true; const fn = c.activo ? window.ClientesSupabaseService.desactivarCliente : window.ClientesSupabaseService.reactivarCliente; const r = await fn(c.id); estado.guardando = false; if (!r.ok) return mensaje(textoError(r.error), "error"); await cargarClientes(); mensaje(c.activo ? "Cliente desactivado." : "Cliente reactivado.", "success"); }

    async function acciones(e) { const btn = e.target?.closest("[data-action]"); if (!btn) return; const a = btn.dataset.action; const cid = e.target.closest("[data-client-id]")?.dataset.clientId; if (cid) estado.seleccionado = cid; const c = seleccionado(); if (a === "crear-primer-cliente") return abrirModalCliente(); if (!c) return; if (a === "ver-cliente") { renderClientes(); renderDetalle(); return; } if (a === "editar-cliente") return abrirModalCliente(c); if (a === "nueva-direccion") return abrirModalDireccion(); if (a === "toggle-cliente") return toggleCliente(c); if (a === "nueva-orden-cliente") { sessionStorage.setItem("clienteOrdenPendiente", JSON.stringify({ clienteIdSupabase: c.id, nombre: c.nombre_completo || c.nombre, telefono: c.telefono_principal, direccionIdSupabase: direccionPrincipal(c)?.id || "" })); window.location.href = "ordenes.html"; return; } const did = e.target.closest("[data-address-id]")?.dataset.addressId; const d = (c.direcciones_clientes || []).find(x => String(x.id) === String(did)); if (a === "editar-direccion" && d) return abrirModalDireccion(d); if (a === "principal-direccion" && d) { const r = await window.ClientesSupabaseService.establecerDireccionPrincipal(c.id, d.id); if (!r.ok) return mensaje(textoError(r.error), "error"); await cargarClientes(); mensaje("Dirección principal actualizada.", "success"); } if (a === "desactivar-direccion" && d) { const r = await window.ClientesSupabaseService.desactivarDireccion(d.id); if (!r.ok) return mensaje(textoError(r.error), "error"); await cargarClientes(); mensaje("Dirección desactivada.", "success"); } }

    function eventos() { if (window.__clientesModuloInicializado) { console.warn("[Clientes] Inicialización duplicada ignorada."); return; } window.__clientesModuloInicializado = true; const buscar = debounce(cargarClientes); $("btnNuevoCliente")?.addEventListener("click", () => abrirModalCliente()); $("btnCerrarClienteModal")?.addEventListener("click", cerrarModalCliente); $("btnCancelarCliente")?.addEventListener("click", cerrarModalCliente); $("clienteForm")?.addEventListener("submit", guardarCliente); $("btnCerrarDireccionModal")?.addEventListener("click", cerrarModalDireccion); $("btnCancelarDireccion")?.addEventListener("click", cerrarModalDireccion); $("direccionForm")?.addEventListener("submit", guardarDireccion); $("listaClientes")?.addEventListener("click", acciones); $("clienteDetalle")?.addEventListener("click", acciones); document.querySelector("[data-close-cliente-modal]")?.addEventListener("click", cerrarModalCliente); document.querySelector("[data-close-direccion-modal]")?.addEventListener("click", cerrarModalDireccion); $("buscarClientes")?.addEventListener("input", e => { estado.busqueda = e.target.value; buscar(); }); $("filtroEstadoClientes")?.addEventListener("change", e => { estado.filtroEstado = e.target.value; aplicarFiltros(); }); $("ordenClientes")?.addEventListener("change", e => { estado.orden = e.target.value; aplicarFiltros(); }); document.addEventListener("keydown", e => { if (e.key !== "Escape") return; if (!$("direccionModal")?.hidden) cerrarModalDireccion(); else if (!$("clienteModal")?.hidden) cerrarModalCliente(); }); $("clienteDuplicados")?.addEventListener("click", e => { const a = e.target?.dataset?.duplicateAction; if (!a || !estado.duplicadosPendientes?.length) return; if (a === "usar" || a === "revisar") { estado.seleccionado = estado.duplicadosPendientes[0].cliente.id; cerrarModalCliente(); aplicarFiltros(); } if (a === "crear") guardarCliente(null, true); }); }
    document.addEventListener("DOMContentLoaded", () => { eventos(); cargarClientes(); });
})();