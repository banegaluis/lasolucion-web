/* =====================================================
   La Solución CRM
   Módulo administrativo de usuarios
===================================================== */

(function () {
    const ESTADOS_USUARIO = ["activo", "pendiente", "inactivo", "bloqueado"];
    const ROLES_USUARIO = ["administrador", "colaborador", "tecnico", "cliente", "cliente_pendiente"];
    const STORAGE_ADMIN_ORIGINAL = "sesionAdministradorOriginal";

    const estado = { busqueda: "", rol: "todos", estado: "todos", editandoId: null };

    document.addEventListener("DOMContentLoaded", iniciarModuloUsuarios);

    function iniciarModuloUsuarios() {
        if (typeof protegerPaginaPorPermisos === "function") protegerPaginaPorPermisos(PERMISOS.USUARIOS_VER);
        if (typeof tienePermiso === "function" && !tienePermiso(PERMISOS.USUARIOS_VER)) return;
        registrarEventosUsuarios();
        if (usuariosStorageInvalido()) mostrarMensaje("No se pudo leer la colección local de usuarios. No se guardarán cambios hasta revisar localStorage.", "error");
        cargarSelectoresFormulario();
        renderizarUsuarios();
    }

    function registrarEventosUsuarios() {
        document.getElementById("btnNuevoUsuario")?.addEventListener("click", abrirModalNuevoUsuario);
        document.getElementById("btnCerrarUsuarioModal")?.addEventListener("click", cerrarModalUsuario);
        document.getElementById("btnCancelarUsuario")?.addEventListener("click", cerrarModalUsuario);
        document.querySelector("[data-close-modal]")?.addEventListener("click", cerrarModalUsuario);
        document.getElementById("usuarioForm")?.addEventListener("submit", guardarDesdeFormularioUsuario);
        document.getElementById("buscarUsuarios")?.addEventListener("input", evento => { estado.busqueda = evento.target.value; renderizarUsuarios(); });
        document.getElementById("filtroRolUsuarios")?.addEventListener("change", evento => { estado.rol = evento.target.value; renderizarUsuarios(); });
        document.getElementById("filtroEstadoUsuarios")?.addEventListener("change", evento => { estado.estado = evento.target.value; renderizarUsuarios(); });
        document.getElementById("btnLimpiarFiltrosUsuarios")?.addEventListener("click", limpiarFiltrosUsuarios);
        document.getElementById("usuarioRol")?.addEventListener("change", actualizarCamposRelacion);
        document.getElementById("btnTogglePasswordUsuario")?.addEventListener("click", alternarPasswordVisible);
        document.getElementById("usuariosListado")?.addEventListener("click", evento => {
            const boton = evento.target.closest("[data-user-action]");
            if (boton) ejecutarAccionUsuario(boton.dataset.userAction, boton.dataset.userId);
        });
        document.addEventListener("keydown", evento => {
            if (evento.key === "Escape" && !document.getElementById("usuarioModal")?.hidden) cerrarModalUsuario();
        });
    }

    function leerUsuarios() {
        if (typeof obtenerUsuarios !== "function") return [];
        return obtenerUsuarios().map(normalizarUsuarioAdmin);
    }

    function usuariosStorageInvalido() {
        if (typeof storageUsuariosInvalido === "function") return storageUsuariosInvalido();
        try {
            const valor = localStorage.getItem("usuarios");
            return Boolean(valor) && !Array.isArray(JSON.parse(valor));
        } catch (error) {
            return true;
        }
    }

    function persistirUsuarios(usuarios) {
        if (usuariosStorageInvalido()) {
            return false;
        }
        if (typeof guardarUsuarios === "function") guardarUsuarios(usuarios.map(normalizarUsuarioAdmin));
        return true;
    }

    function obtenerUsuarioPorId(id) {
        return leerUsuarios().find(usuario => String(usuario.id) === String(id)) || null;
    }

    function normalizarUsuarioAdmin(usuario) {
        const seguro = { ...usuario };
        delete seguro.passwordConfirm;
        const nombre = limpiarEspacios(seguro.nombre);
        const apellido = limpiarEspacios(seguro.apellido);
        const username = limpiarUsername(seguro.username || seguro.usuario);
        const email = limpiarEmail(seguro.email);
        const rol = ROLES_USUARIO.includes(seguro.rol) ? seguro.rol : "cliente";
        const estadoUsuario = ESTADOS_USUARIO.includes(seguro.estado) ? seguro.estado : (rol === "cliente_pendiente" ? "pendiente" : "activo");

        return {
            ...seguro,
            id: seguro.id || generarIdUsuario(),
            nombre,
            apellido,
            nombreCompleto: limpiarEspacios(`${nombre} ${apellido}`) || limpiarEspacios(seguro.nombreCompleto) || username || email,
            username,
            usuario: username,
            email,
            password: seguro.password || "",
            telefono: limpiarEspacios(seguro.telefono),
            rol,
            estado: estadoUsuario,
            tecnicoId: rol === "tecnico" ? (seguro.tecnicoId || null) : null,
            clienteId: rol === "cliente" || rol === "cliente_pendiente" ? (seguro.clienteId || null) : null,
            origen: seguro.origen || "admin",
            emailConfirmado: seguro.emailConfirmado ?? true,
            fechaConfirmacionEmail: seguro.fechaConfirmacionEmail ?? (seguro.emailConfirmado === false ? null : seguro.fechaCreacion || null),
            permisosAdicionales: Array.isArray(seguro.permisosAdicionales) ? seguro.permisosAdicionales : [],
            creadoPor: seguro.creadoPor || "sistema",
            fechaCreacion: seguro.fechaCreacion || new Date().toISOString(),
            fechaModificacion: seguro.fechaModificacion || seguro.fechaCreacion || new Date().toISOString()
        };
    }

    function migrarUsuariosNoDestructivo() {
        const usuarios = leerUsuarios();
        persistirUsuarios(usuarios);
        return usuarios;
    }

    function generarIdUsuario() {
        return `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function limpiarEspacios(valor) { return String(valor || "").trim().replace(/\s+/g, " "); }
    function limpiarUsername(valor) { return limpiarEspacios(valor).replace(/\s+/g, "").toLowerCase(); }
    function limpiarEmail(valor) { return String(valor || "").trim().toLowerCase(); }
    function normalizarBusqueda(valor) { return String(valor || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

    function usernameDisponible(username, usuarioIgnoradoId = null) {
        const normalizado = limpiarUsername(username);
        return !leerUsuarios().some(usuario => limpiarUsername(usuario.username) === normalizado && String(usuario.id) !== String(usuarioIgnoradoId));
    }

    function emailDisponible(email, usuarioIgnoradoId = null) {
        const normalizado = limpiarEmail(email);
        return !leerUsuarios().some(usuario => limpiarEmail(usuario.email) === normalizado && String(usuario.id) !== String(usuarioIgnoradoId));
    }

    function emailValido(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
    function obtenerSesionAdminActual() { return typeof obtenerSesionActual === "function" ? obtenerSesionActual() : null; }
    function contarAdminsActivos(usuarios = leerUsuarios()) { return usuarios.filter(usuario => usuario.rol === "administrador" && usuario.estado === "activo").length; }

    function validarAdministradorMinimo(usuarioId, cambios) {
        const simulados = leerUsuarios().map(usuario => String(usuario.id) === String(usuarioId) ? { ...usuario, ...cambios } : usuario);
        return contarAdminsActivos(simulados) >= 1;
    }

    function tecnicoVinculadoAUsuarioActivo(tecnicoId, usuarioIgnoradoId = null) {
        return leerUsuarios().some(usuario => usuario.rol === "tecnico" && usuario.estado === "activo" && usuario.tecnicoId && String(usuario.tecnicoId) === String(tecnicoId) && String(usuario.id) !== String(usuarioIgnoradoId));
    }

    function validarDatosUsuario(datos, opciones = {}) {
        const errores = [];
        const editandoId = opciones.editandoId || null;
        const esEdicion = Boolean(editandoId);

        if (!datos.nombre) errores.push("El nombre es obligatorio.");
        if (!datos.apellido) errores.push("El apellido es obligatorio.");
        if (!datos.username) errores.push("El username es obligatorio.");
        if (!datos.email) errores.push("El email es obligatorio.");
        if (!datos.rol) errores.push("El rol es obligatorio.");
        if (!datos.estado) errores.push("El estado es obligatorio.");
        if (datos.username && /\s/.test(datos.username)) errores.push("El username no debe contener espacios.");
        if (datos.email && !emailValido(datos.email)) errores.push("El email no tiene un formato válido.");
        if (datos.username && !usernameDisponible(datos.username, editandoId)) errores.push("Ya existe un usuario con ese username.");
        if (datos.email && !emailDisponible(datos.email, editandoId)) errores.push("Ya existe un usuario con ese email.");
        if (!ROLES_USUARIO.includes(datos.rol)) errores.push("El rol seleccionado no es válido.");
        if (!ESTADOS_USUARIO.includes(datos.estado)) errores.push("El estado seleccionado no es válido.");

        const password = datos.password || "";
        const passwordConfirm = datos.passwordConfirm || "";
        if (!esEdicion && !password) errores.push("La contraseña temporal es obligatoria.");
        if (!esEdicion && !passwordConfirm) errores.push("La confirmación de contraseña es obligatoria.");
        if (esEdicion && (password || passwordConfirm) && (!password || !passwordConfirm)) errores.push("Para cambiar la contraseña completá ambos campos.");
        if (password && password.length < 6) errores.push("La contraseña temporal debe tener al menos 6 caracteres.");
        if ((password || passwordConfirm) && password !== passwordConfirm) errores.push("Las contraseñas no coinciden.");

        if (datos.rol === "tecnico" && datos.tecnicoId && tecnicoVinculadoAUsuarioActivo(datos.tecnicoId, editandoId)) errores.push("Ese técnico ya está vinculado a otra cuenta activa.");

        const sesion = obtenerSesionAdminActual();
        const esUsuarioActual = sesion && String(sesion.usuarioId) === String(editandoId);
        if (esEdicion && esUsuarioActual && ["inactivo", "bloqueado"].includes(datos.estado)) errores.push("No podés desactivar la cuenta con la que estás trabajando.");
        if (esEdicion && !validarAdministradorMinimo(editandoId, { rol: datos.rol, estado: datos.estado })) errores.push("Debe existir al menos un administrador activo.");

        return errores;
    }

    function crearUsuario(datos) {
        if (!requerirPermiso(PERMISOS.USUARIOS_CREAR)) return { ok: false };
        const sesion = obtenerSesionAdminActual();
        const usuario = normalizarUsuarioAdmin({
            id: generarIdUsuario(), ...datos, password: datos.password,
            creadoPor: sesion?.usuarioId || "sistema", modificadoPor: sesion?.usuarioId || "sistema",
            fechaCreacion: new Date().toISOString(), fechaModificacion: new Date().toISOString(),
            origen: "admin", emailConfirmado: true, fechaConfirmacionEmail: new Date().toISOString()
        });
        const errores = validarDatosUsuario({ ...usuario, password: datos.password, passwordConfirm: datos.passwordConfirm });
        if (errores.length) return { ok: false, errores };
        if (!persistirUsuarios([...leerUsuarios(), usuario])) return { ok: false, errores: ["No se pudo guardar porque la colección local de usuarios no se puede leer."] };
        return { ok: true, usuario };
    }

    function actualizarUsuario(id, cambios) {
        if (!requerirPermiso(PERMISOS.USUARIOS_EDITAR)) return { ok: false };
        const usuarios = leerUsuarios();
        const actual = usuarios.find(usuario => String(usuario.id) === String(id));
        if (!actual) return { ok: false, errores: ["No se encontró el usuario."] };
        if (actual.rol !== cambios.rol && !requerirPermiso(PERMISOS.USUARIOS_CAMBIAR_ROL)) return { ok: false };
        if (actual.estado !== cambios.estado && !requerirPermiso(PERMISOS.USUARIOS_DESACTIVAR)) return { ok: false };
        const errores = validarDatosUsuario({ ...actual, ...cambios }, { editandoId: id });
        if (errores.length) return { ok: false, errores };

        const sesion = obtenerSesionAdminActual();
        const { password, passwordConfirm, ...cambiosSinPassword } = cambios;
        const actualizados = usuarios.map(usuario => {
            if (String(usuario.id) !== String(id)) return usuario;
            return normalizarUsuarioAdmin({
                ...usuario,
                ...cambiosSinPassword,
                ...(password ? { password } : {}),
                creadoPor: usuario.creadoPor,
                fechaCreacion: usuario.fechaCreacion,
                modificadoPor: sesion?.usuarioId || "sistema",
                fechaModificacion: new Date().toISOString()
            });
        });
        if (!persistirUsuarios(actualizados)) return { ok: false, errores: ["No se pudo guardar porque la colección local de usuarios no se puede leer."] };
        const usuarioActualizado = leerUsuarios().find(usuario => String(usuario.id) === String(id));
        return { ok: true, usuario: usuarioActualizado };
    }

    function cambiarEstadoUsuario(id, nuevoEstado) {
        if (!requerirPermiso(PERMISOS.USUARIOS_DESACTIVAR)) return { ok: false };
        const usuario = obtenerUsuarioPorId(id);
        if (!usuario) return { ok: false, errores: ["No se encontró el usuario."] };
        const sesion = obtenerSesionAdminActual();
        if (sesion && String(sesion.usuarioId) === String(id) && ["inactivo", "bloqueado"].includes(nuevoEstado)) return { ok: false, errores: ["No podés desactivar la cuenta con la que estás trabajando."] };
        if (!validarAdministradorMinimo(id, { estado: nuevoEstado })) return { ok: false, errores: ["Debe existir al menos un administrador activo."] };
        return actualizarUsuario(id, { ...usuario, estado: nuevoEstado, ultimoCambioEstadoPor: sesion?.usuarioId || "sistema", fechaUltimoCambioEstado: new Date().toISOString(), password: "", passwordConfirm: "" });
    }

    function cambiarPasswordUsuario(id, nuevaPassword) {
        const usuario = obtenerUsuarioPorId(id);
        if (!usuario) return { ok: false, errores: ["No se encontró el usuario."] };
        return actualizarUsuario(id, { ...usuario, password: nuevaPassword, passwordConfirm: nuevaPassword });
    }

    function usuarioPuedeIniciarSesionLocal(usuario) {
        return usuario && (usuario.estado === "activo" || (usuario.estado === "pendiente" && usuario.rol === "cliente_pendiente"));
    }

    function leerLocalStorageLista(clave) {
        try { const valor = JSON.parse(localStorage.getItem(clave) || "[]"); return Array.isArray(valor) ? valor : []; } catch (error) { return []; }
    }

    function obtenerTecnicosDisponibles() {
        const tecnicos = new Map();
        leerLocalStorageLista("tecnicos").forEach(t => tecnicos.set(String(t.id), t.nombre || t.nombreCompleto || t.username || `Técnico ${t.id}`));
        leerLocalStorageLista("ordenes").forEach(o => { const id = o.tecnicoId || o.tecnicoNombre; const nombre = o.tecnicoNombre || o.tecnicoId; if (id && nombre && nombre !== "Sin asignar") tecnicos.set(String(id), nombre); });
        return [...tecnicos.entries()].map(([id, nombre]) => ({ id, nombre }));
    }

    function obtenerClientesDisponibles() {
        const clientes = new Map();
        leerLocalStorageLista("clientes").forEach(c => clientes.set(String(c.id), c.nombre || c.nombreCompleto || c.cliente || `Cliente ${c.id}`));
        leerLocalStorageLista("ordenes").forEach(o => { const id = o.clienteId || o.cliente; if (id && o.cliente) clientes.set(String(id), o.cliente); });
        return [...clientes.entries()].map(([id, nombre]) => ({ id, nombre }));
    }

    function cargarSelectoresFormulario() {
        cargarOpciones("usuarioRol", [["administrador", "Administrador"], ["colaborador", "Colaborador"], ["tecnico", "Técnico"], ["cliente", "Cliente"], ["cliente_pendiente", "Cliente pendiente"]]);
        cargarOpciones("usuarioEstado", [["activo", "Activo"], ["pendiente", "Pendiente"], ["inactivo", "Inactivo"], ["bloqueado", "Bloqueado"]]);
        cargarOpciones("usuarioTecnicoId", [["", "Sin vínculo"]].concat(obtenerTecnicosDisponibles().map(item => [item.id, item.nombre])));
        cargarOpciones("usuarioClienteId", [["", "Sin vínculo"]].concat(obtenerClientesDisponibles().map(item => [item.id, item.nombre])));
    }

    function cargarOpciones(id, opciones) {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = "";
        opciones.forEach(([valor, texto]) => { const option = document.createElement("option"); option.value = valor; option.textContent = texto; select.appendChild(option); });
    }

    function renderizarUsuarios() {
        const todos = leerUsuarios();
        renderizarMetricas(todos);
        renderizarListadoUsuarios(filtrarUsuarios(todos));
    }

    function filtrarUsuarios(usuarios) {
        const texto = normalizarBusqueda(estado.busqueda);
        return usuarios.filter(usuario => {
            if (estado.rol !== "todos" && usuario.rol !== estado.rol) return false;
            if (estado.estado !== "todos" && usuario.estado !== estado.estado) return false;
            if (!texto) return true;
            return normalizarBusqueda([usuario.nombre, usuario.apellido, usuario.nombreCompleto, usuario.username, usuario.email, usuario.telefono].join(" ")).includes(texto);
        });
    }

    function renderizarMetricas(usuarios) {
        const set = (id, valor) => { const el = document.getElementById(id); if (el) el.textContent = valor; };
        set("metricTotalUsuarios", usuarios.length);
        set("metricUsuariosActivos", usuarios.filter(u => u.estado === "activo").length);
        set("metricUsuariosPendientes", usuarios.filter(u => u.estado === "pendiente").length);
        set("metricUsuariosInactivos", usuarios.filter(u => u.estado === "inactivo").length);
        set("metricAdministradores", usuarios.filter(u => u.rol === "administrador").length);
        set("metricColaboradores", usuarios.filter(u => u.rol === "colaborador").length);
        set("metricTecnicos", usuarios.filter(u => u.rol === "tecnico").length);
        set("metricClientes", usuarios.filter(u => u.rol === "cliente" || u.rol === "cliente_pendiente").length);
    }

    function renderizarListadoUsuarios(usuarios) {
        const tbody = document.getElementById("usuariosListado");
        const vacio = document.getElementById("usuariosVacio");
        if (!tbody) return;
        tbody.innerHTML = "";
        if (vacio) vacio.hidden = usuarios.length > 0;
        usuarios.forEach(usuario => tbody.appendChild(crearFilaUsuario(usuario)));
    }

    function crearFilaUsuario(usuario) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td data-label="Usuario"><div class="usuario-main"><strong>${escaparHtml(usuario.nombreCompleto)}</strong><span>${escaparHtml(usuario.username)}</span><small>${escaparHtml(usuario.email)}</small><div class="usuario-badges-extra">${badgesOrigen(usuario)}</div></div></td>
            <td data-label="Rol"><span class="usuario-badge">${escaparHtml(etiquetaRol(usuario.rol))}</span></td>
            <td data-label="Estado"><span class="usuario-badge estado-${escaparHtml(usuario.estado)}">${escaparHtml(etiquetaEstado(usuario.estado))}</span></td>
            <td data-label="Teléfono"><span class="usuario-muted">${escaparHtml(usuario.telefono || "—")}</span></td>
            <td data-label="Creación"><span class="usuario-muted">${escaparHtml(formatearFecha(usuario.fechaCreacion))}</span></td>
            <td data-label="Vínculo"><span class="usuario-muted">${escaparHtml(describirVinculo(usuario))}</span></td>
            <td data-label="Acciones"><div class="usuarios-actions">${accionesUsuario(usuario)}</div></td>`;
        return tr;
    }

    function accionesUsuario(usuario) {
        const puedeProbar = usuarioPuedeIniciarSesionLocal(usuario);
        return [
            `<button class="usuarios-action" type="button" data-user-action="editar" data-user-id="${escaparHtml(usuario.id)}">Editar</button>`,
            usuario.estado === "activo" || usuario.estado === "pendiente"
                ? `<button class="usuarios-action danger" type="button" data-user-action="desactivar" data-user-id="${escaparHtml(usuario.id)}">Desactivar</button>`
                : `<button class="usuarios-action" type="button" data-user-action="activar" data-user-id="${escaparHtml(usuario.id)}">Activar</button>`,
            puedeProbar ? `<button class="usuarios-action" type="button" data-user-action="probar" data-user-id="${escaparHtml(usuario.id)}">Probar acceso</button>` : ""
        ].join("");
    }

    function abrirModalNuevoUsuario() {
        if (!requerirPermiso(PERMISOS.USUARIOS_CREAR)) return;
        estado.editandoId = null;
        cargarSelectoresFormulario();
        document.getElementById("usuarioForm")?.reset();
        document.getElementById("usuarioIdEdicion").value = "";
        document.getElementById("usuarioModalTitulo").textContent = "Nuevo usuario";
        document.getElementById("btnGuardarUsuario").textContent = "Crear usuario";
        document.getElementById("passwordSectionTitle").textContent = "Contraseña temporal";
        document.getElementById("usuarioPasswordHelp").textContent = "Contraseña temporal para desarrollo local.";
        document.getElementById("usuarioEstado").value = "activo";
        actualizarCamposRelacion();
        abrirModalUsuario();
    }

    function abrirModalEditarUsuario(id) {
        if (!requerirPermiso(PERMISOS.USUARIOS_EDITAR)) return;
        const usuario = obtenerUsuarioPorId(id);
        if (!usuario) return mostrarMensaje("No se encontró el usuario.", "error");
        estado.editandoId = usuario.id;
        cargarSelectoresFormulario();
        document.getElementById("usuarioIdEdicion").value = usuario.id;
        document.getElementById("usuarioNombre").value = usuario.nombre;
        document.getElementById("usuarioApellido").value = usuario.apellido;
        document.getElementById("usuarioTelefono").value = usuario.telefono || "";
        document.getElementById("usuarioUsername").value = usuario.username;
        document.getElementById("usuarioEmail").value = usuario.email;
        document.getElementById("usuarioPassword").value = "";
        document.getElementById("usuarioPasswordConfirm").value = "";
        document.getElementById("usuarioRol").value = usuario.rol;
        document.getElementById("usuarioEstado").value = usuario.estado;
        document.getElementById("usuarioTecnicoId").value = usuario.tecnicoId || "";
        document.getElementById("usuarioClienteId").value = usuario.clienteId || "";
        document.getElementById("usuarioModalTitulo").textContent = "Editar usuario";
        document.getElementById("btnGuardarUsuario").textContent = "Guardar cambios";
        document.getElementById("passwordSectionTitle").textContent = "Cambiar contraseña temporal";
        document.getElementById("usuarioPasswordHelp").textContent = "Dejá estos campos vacíos para mantener la contraseña actual.";
        actualizarCamposRelacion();
        abrirModalUsuario();
    }

    function abrirModalUsuario() {
        document.getElementById("usuarioModal").hidden = false;
        document.body.classList.add("modal-scroll-locked");
        document.documentElement.classList.add("modal-scroll-locked");
        setTimeout(() => document.getElementById("usuarioNombre")?.focus({ preventScroll: true }), 0);
    }

    function cerrarModalUsuario() {
        const modal = document.getElementById("usuarioModal");
        if (modal) modal.hidden = true;
        document.body.classList.remove("modal-scroll-locked");
        document.documentElement.classList.remove("modal-scroll-locked");
    }

    function obtenerDatosFormulario() {
        const rol = document.getElementById("usuarioRol").value;
        return {
            nombre: limpiarEspacios(document.getElementById("usuarioNombre").value),
            apellido: limpiarEspacios(document.getElementById("usuarioApellido").value),
            telefono: limpiarEspacios(document.getElementById("usuarioTelefono").value),
            username: limpiarUsername(document.getElementById("usuarioUsername").value),
            email: limpiarEmail(document.getElementById("usuarioEmail").value),
            password: document.getElementById("usuarioPassword").value,
            passwordConfirm: document.getElementById("usuarioPasswordConfirm").value,
            rol,
            estado: document.getElementById("usuarioEstado").value,
            tecnicoId: rol === "tecnico" ? (document.getElementById("usuarioTecnicoId").value || null) : null,
            clienteId: rol === "cliente" || rol === "cliente_pendiente" ? (document.getElementById("usuarioClienteId").value || null) : null
        };
    }

    function guardarDesdeFormularioUsuario(evento) {
        evento.preventDefault();
        const datos = obtenerDatosFormulario();
        const id = document.getElementById("usuarioIdEdicion").value;
        const resultado = id ? actualizarUsuario(id, datos) : crearUsuario(datos);
        if (!resultado.ok) return mostrarMensaje((resultado.errores || ["No se pudo guardar el usuario."]).join(" "), "error");
        cerrarModalUsuario();
        renderizarUsuarios();
        mostrarMensaje(id ? "Usuario actualizado correctamente." : "Usuario creado correctamente.", "success");
    }

    function actualizarCamposRelacion() {
        const rol = document.getElementById("usuarioRol")?.value;
        const estadoSelect = document.getElementById("usuarioEstado");
        if (estadoSelect && rol !== "cliente_pendiente" && estadoSelect.value === "pendiente") estadoSelect.value = "activo";
        if (estadoSelect && rol === "cliente_pendiente" && !estado.editandoId && estadoSelect.value === "activo") estadoSelect.value = "pendiente";
        document.getElementById("usuarioTecnicoBox").hidden = rol !== "tecnico";
        document.getElementById("usuarioClienteBox").hidden = rol !== "cliente" && rol !== "cliente_pendiente";
    }

    function ejecutarAccionUsuario(accion, id) {
        if (accion === "editar") abrirModalEditarUsuario(id);
        if (accion === "desactivar") desactivarUsuario(id);
        if (accion === "activar") activarUsuario(id);
        if (accion === "probar") probarAccesoUsuario(id);
    }

    function desactivarUsuario(id) {
        const usuario = obtenerUsuarioPorId(id);
        if (!usuario) return;
        if (!confirm(`¿Desactivar a ${usuario.nombreCompleto}?\n\nNo podrá iniciar sesión, pero se conservará su historial.`)) return;
        const resultado = cambiarEstadoUsuario(id, "inactivo");
        if (!resultado.ok) return mostrarMensaje((resultado.errores || ["No se pudo desactivar el usuario."]).join(" "), "error");
        renderizarUsuarios();
        mostrarMensaje("Usuario desactivado.", "success");
    }

    function activarUsuario(id) {
        const usuario = obtenerUsuarioPorId(id);
        if (!usuario) return;
        const estadoDestino = usuario.rol === "cliente_pendiente" ? "pendiente" : "activo";
        const resultado = cambiarEstadoUsuario(id, estadoDestino);
        if (!resultado.ok) return mostrarMensaje((resultado.errores || ["No se pudo activar el usuario."]).join(" "), "error");
        renderizarUsuarios();
        mostrarMensaje("Usuario activado.", "success");
    }

    function probarAccesoUsuario(id) {
        if (!requerirPermiso(PERMISOS.USUARIOS_EDITAR)) return;
        const usuario = obtenerUsuarioPorId(id);
        const sesionAdmin = obtenerSesionAdminActual();
        if (!usuario || !sesionAdmin || sesionAdmin.rol !== "administrador") return mostrarMensaje("Solo un administrador puede probar accesos.", "error");
        if (localStorage.getItem(STORAGE_ADMIN_ORIGINAL)) return mostrarMensaje("Ya hay una sesión de prueba activa.", "error");
        if (!usuarioPuedeIniciarSesionLocal(usuario)) return mostrarMensaje("No se puede probar una cuenta que no tiene acceso habilitado.", "error");
        if (!confirm(`¿Probar la aplicación como ${usuario.nombreCompleto}?`)) return;
        localStorage.setItem(STORAGE_ADMIN_ORIGINAL, JSON.stringify({ ...sesionAdmin, fechaInicioPrueba: new Date().toISOString() }));
        iniciarSesion(usuario);
        window.location.href = "dashboard.html";
    }

    function limpiarFiltrosUsuarios() {
        estado.busqueda = ""; estado.rol = "todos"; estado.estado = "todos";
        document.getElementById("buscarUsuarios").value = "";
        document.getElementById("filtroRolUsuarios").value = "todos";
        document.getElementById("filtroEstadoUsuarios").value = "todos";
        renderizarUsuarios();
    }

    function alternarPasswordVisible() {
        ["usuarioPassword", "usuarioPasswordConfirm"].forEach(id => { const campo = document.getElementById(id); if (campo) campo.type = campo.type === "password" ? "text" : "password"; });
    }

    function mostrarMensaje(texto, tipo = "") {
        const mensaje = document.getElementById("usuariosMensaje");
        if (!mensaje) return;
        mensaje.textContent = texto || "";
        mensaje.className = `usuarios-message ${tipo ? `is-${tipo}` : ""}`.trim();
    }

    function etiquetaRol(rol) { return { administrador: "Administrador", colaborador: "Colaborador", tecnico: "Técnico", cliente: "Cliente", cliente_pendiente: "Cliente pendiente" }[rol] || "Sin rol"; }
    function etiquetaEstado(valor) { return { activo: "Activo", pendiente: "Pendiente", inactivo: "Inactivo", bloqueado: "Bloqueado" }[valor] || "Sin estado"; }
    function badgesOrigen(usuario) {
        const origen = usuario.origen === "registro" ? "Registro público" : "Creado por administrador";
        const email = usuario.emailConfirmado === false ? "Email no confirmado" : "Email confirmado";
        return `<span class="usuario-origin-badge">${escaparHtml(origen)}</span><span class="usuario-origin-badge">${escaparHtml(email)}</span>`;
    }
    function describirVinculo(usuario) { if (usuario.rol === "tecnico") return usuario.tecnicoId ? `Técnico: ${usuario.tecnicoId}` : "Técnico sin vínculo"; if (usuario.rol === "cliente" || usuario.rol === "cliente_pendiente") return usuario.clienteId ? `Cliente: ${usuario.clienteId}` : "Cliente sin vínculo"; return "—"; }
    function formatearFecha(valor) { if (!valor) return "—"; const fecha = new Date(valor); return Number.isNaN(fecha.getTime()) ? "—" : fecha.toLocaleDateString("es-AR"); }
    function escaparHtml(valor) { return String(valor ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }

    window.UsuariosAdmin = { obtenerUsuarioPorId, crearUsuario, actualizarUsuario, cambiarEstadoUsuario, cambiarPasswordUsuario, usernameDisponible, emailDisponible, generarIdUsuario, validarDatosUsuario, obtenerTecnicosDisponibles, obtenerClientesDisponibles, migrarUsuariosNoDestructivo };
})();






