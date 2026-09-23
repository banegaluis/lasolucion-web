/* =====================================================
   La Solución CRM
   Autenticación local y sesión actual
===================================================== */

const AUTH_STORAGE_KEYS = {
    usuarios: "usuarios",
    sesionActual: "sesionActual",
    legacySession: "session",
    legacyCurrentUser: "currentUser",
    sesionAdministradorOriginal: "sesionAdministradorOriginal"
};

const AUTH_FECHA_SEMILLA = "2026-07-11T00:00:00.000Z";

// SOLO DESARROLLO LOCAL:
// Nunca guardar contraseñas en texto plano ni en localStorage en producción.
const USUARIOS_INICIALES = [
    {
        id: "usr-admin-001",
        nombre: "Luis",
        apellido: "Banega",
        nombreCompleto: "Luis Banega",
        username: "admin",
        email: "admin@lasolucion.local",
        password: "admin123",
        rol: "administrador",
        estado: "activo",
        telefono: "",
        tecnicoId: null,
        clienteId: null,
        creadoPor: "sistema",
        fechaCreacion: AUTH_FECHA_SEMILLA,
        fechaModificacion: AUTH_FECHA_SEMILLA
    },
    {
        id: "usr-colaborador-001",
        nombre: "Colaborador",
        apellido: "Prueba",
        nombreCompleto: "Colaborador Prueba",
        username: "colaborador",
        email: "colaborador@lasolucion.local",
        password: "colaborador123",
        rol: "colaborador",
        estado: "activo",
        telefono: "",
        tecnicoId: null,
        clienteId: null,
        creadoPor: "sistema",
        fechaCreacion: AUTH_FECHA_SEMILLA,
        fechaModificacion: AUTH_FECHA_SEMILLA
    },
    {
        id: "usr-tecnico-001",
        nombre: "Técnico",
        apellido: "Prueba",
        nombreCompleto: "Técnico Prueba",
        username: "tecnico",
        email: "tecnico@lasolucion.local",
        password: "tecnico123",
        rol: "tecnico",
        estado: "activo",
        telefono: "",
        tecnicoId: null,
        clienteId: null,
        creadoPor: "sistema",
        fechaCreacion: AUTH_FECHA_SEMILLA,
        fechaModificacion: AUTH_FECHA_SEMILLA
    },
    {
        id: "usr-cliente-001",
        nombre: "Cliente",
        apellido: "Prueba",
        nombreCompleto: "Cliente Prueba",
        username: "cliente",
        email: "cliente@lasolucion.local",
        password: "cliente123",
        rol: "cliente",
        estado: "activo",
        telefono: "",
        tecnicoId: null,
        clienteId: null,
        creadoPor: "sistema",
        fechaCreacion: AUTH_FECHA_SEMILLA,
        fechaModificacion: AUTH_FECHA_SEMILLA
    },
    {
        id: "usr-pendiente-001",
        nombre: "Cliente",
        apellido: "Pendiente",
        nombreCompleto: "Cliente Pendiente",
        username: "pendiente",
        email: "pendiente@lasolucion.local",
        password: "pendiente123",
        rol: "cliente_pendiente",
        estado: "pendiente",
        telefono: "",
        tecnicoId: null,
        clienteId: null,
        creadoPor: "sistema",
        fechaCreacion: AUTH_FECHA_SEMILLA,
        fechaModificacion: AUTH_FECHA_SEMILLA
    }
];

function leerJSONLocalStorage(clave, valorPorDefecto) {
    try {
        const valor = localStorage.getItem(clave);
        if (!valor) return valorPorDefecto;
        return JSON.parse(valor);
    } catch (error) {
        console.error(`No se pudo leer ${clave}. Se usará un valor seguro.`);
        return valorPorDefecto;
    }
}

function escribirJSONLocalStorage(clave, valor) {
    localStorage.setItem(clave, JSON.stringify(valor));
}

function storageUsuariosInvalido() {
    const valor = localStorage.getItem(AUTH_STORAGE_KEYS.usuarios);
    if (!valor) return false;

    try {
        return !Array.isArray(JSON.parse(valor));
    } catch (error) {
        console.error("No se pudo leer la colección local de usuarios.");
        return true;
    }
}

function normalizarTexto(valor) {
    return String(valor || "").trim().toLowerCase();
}

function normalizarUsuario(usuario) {
    const nombre = String(usuario.nombre || "").trim();
    const apellido = String(usuario.apellido || "").trim();
    const username = String(usuario.username || usuario.usuario || "").trim();
    const email = String(usuario.email || "").trim().toLowerCase();
    const nombreCompleto = String(usuario.nombreCompleto || `${nombre} ${apellido}` || username || email || "Usuario").trim();

    return {
        ...usuario,
        id: usuario.id,
        nombre,
        apellido,
        nombreCompleto: nombreCompleto || username || email || "Usuario",
        username,
        usuario: username,
        email,
        password: usuario.password || "",
        rol: usuario.rol || "cliente",
        estado: usuario.estado || (usuario.activo === false ? "inactivo" : "activo"),
        telefono: usuario.telefono || "",
        tecnicoId: usuario.tecnicoId ?? null,
        clienteId: usuario.clienteId ?? null,
        origen: usuario.origen || "admin",
        emailConfirmado: usuario.emailConfirmado ?? true,
        fechaConfirmacionEmail: usuario.fechaConfirmacionEmail ?? null,
        permisosAdicionales: Array.isArray(usuario.permisosAdicionales) ? usuario.permisosAdicionales : [],
        creadoPor: usuario.creadoPor || "sistema",
        fechaCreacion: usuario.fechaCreacion || new Date().toISOString(),
        fechaModificacion: usuario.fechaModificacion || usuario.fechaCreacion || new Date().toISOString()
    };
}

function obtenerUsuarios() {
    const usuarios = leerJSONLocalStorage(AUTH_STORAGE_KEYS.usuarios, []);
    if (!Array.isArray(usuarios)) return [];
    return usuarios.map(normalizarUsuario);
}

function guardarUsuarios(usuarios) {
    if (!Array.isArray(usuarios)) return;
    escribirJSONLocalStorage(AUTH_STORAGE_KEYS.usuarios, usuarios.map(normalizarUsuario));
}

function existeUsuarioInicial(usuarios, usuarioInicial) {
    const id = normalizarTexto(usuarioInicial.id);
    const username = normalizarTexto(usuarioInicial.username);
    const email = normalizarTexto(usuarioInicial.email);

    return usuarios.some((usuario) => (
        normalizarTexto(usuario.id) === id ||
        normalizarTexto(usuario.username || usuario.usuario) === username ||
        normalizarTexto(usuario.email) === email
    ));
}

function inicializarUsuarios() {
    if (storageUsuariosInvalido()) {
        return [];
    }

    const usuariosActuales = obtenerUsuarios();
    const usuariosActualizados = [...usuariosActuales];

    USUARIOS_INICIALES.forEach((usuarioInicial) => {
        if (!existeUsuarioInicial(usuariosActualizados, usuarioInicial)) {
            usuariosActualizados.push({ ...usuarioInicial });
        }
    });

    if (usuariosActualizados.length !== usuariosActuales.length || !localStorage.getItem(AUTH_STORAGE_KEYS.usuarios)) {
        guardarUsuarios(usuariosActualizados);
    }

    return usuariosActualizados.map(normalizarUsuario);
}

function limpiarUsernamePublico(valor) {
    return String(valor || "").trim().replace(/\s+/g, "").toLowerCase();
}

function limpiarEmailPublico(valor) {
    return String(valor || "").trim().toLowerCase();
}

function generarIdUsuarioLocal() {
    return `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emailValidoLocal(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function usuarioDisponible(username) {
    const normalizado = limpiarUsernamePublico(username);
    return !obtenerUsuarios().some(usuario => limpiarUsernamePublico(usuario.username || usuario.usuario) === normalizado);
}

function emailDisponibleRegistro(email) {
    const normalizado = limpiarEmailPublico(email);
    return !obtenerUsuarios().some(usuario => limpiarEmailPublico(usuario.email) === normalizado);
}

function crearCuentaPublica(datos) {
    if (storageUsuariosInvalido()) {
        return { ok: false, errores: ["No se pudo crear la cuenta porque la colección local de usuarios no se puede leer."] };
    }

    inicializarUsuarios();

    const nombre = String(datos.nombre || "").trim().replace(/\s+/g, " ");
    const apellido = String(datos.apellido || "").trim().replace(/\s+/g, " ");
    const username = limpiarUsernamePublico(datos.username);
    const email = limpiarEmailPublico(datos.email);
    const password = String(datos.password || "");
    const passwordConfirm = String(datos.passwordConfirm || "");
    const errores = [];

    if (!nombre) errores.push("El nombre es obligatorio.");
    if (!apellido) errores.push("El apellido es obligatorio.");
    if (!username) errores.push("El nombre de usuario es obligatorio.");
    if (!email) errores.push("El email es obligatorio.");
    if (!password) errores.push("La contraseña es obligatoria.");
    if (!passwordConfirm) errores.push("La confirmación de contraseña es obligatoria.");
    if (username && /\s/.test(String(datos.username || ""))) errores.push("El nombre de usuario no debe contener espacios.");
    if (email && !emailValidoLocal(email)) errores.push("El email no tiene un formato válido.");
    if (username && !usuarioDisponible(username)) errores.push("Ya existe una cuenta con ese nombre de usuario.");
    if (email && !emailDisponibleRegistro(email)) errores.push("Ya existe una cuenta con ese email.");
    if (password && password.length < 6) errores.push("La contraseña debe tener al menos 6 caracteres.");
    if ((password || passwordConfirm) && password !== passwordConfirm) errores.push("Las contraseñas no coinciden.");

    if (errores.length) return { ok: false, errores };

    const ahora = new Date().toISOString();
    const usuario = normalizarUsuario({
        id: generarIdUsuarioLocal(),
        nombre,
        apellido,
        nombreCompleto: `${nombre} ${apellido}`.trim(),
        username,
        usuario: username,
        email,
        password,
        rol: "cliente_pendiente",
        estado: "pendiente",
        telefono: String(datos.telefono || "").trim(),
        tecnicoId: null,
        clienteId: null,
        origen: "registro",
        emailConfirmado: false,
        fechaConfirmacionEmail: null,
        creadoPor: "registro_publico",
        modificadoPor: "registro_publico",
        fechaCreacion: ahora,
        fechaModificacion: ahora
    });

    guardarUsuarios([...obtenerUsuarios(), usuario]);
    return { ok: true, usuario };
}
function buscarUsuarioPorIdentificador(identificador) {
    const identificadorNormalizado = normalizarTexto(identificador);
    if (!identificadorNormalizado) return null;

    return obtenerUsuarios().find((usuario) => (
        normalizarTexto(usuario.username) === identificadorNormalizado ||
        normalizarTexto(usuario.usuario) === identificadorNormalizado ||
        normalizarTexto(usuario.email) === identificadorNormalizado ||
        normalizarTexto(usuario.id) === identificadorNormalizado
    )) || null;
}

function puedeIngresarPorEstado(usuario) {
    if (!usuario) return false;
    const estado = normalizarTexto(usuario.estado);
    const rol = normalizarTexto(usuario.rol);
    return estado === "activo" || (estado === "pendiente" && rol === "cliente_pendiente");
}

function obtenerMensajeEstado(usuario) {
    const estado = normalizarTexto(usuario && usuario.estado);
    if (estado === "inactivo") return "Tu cuenta está inactiva.";
    if (estado === "bloqueado") return "Tu cuenta está bloqueada.";
    if (estado === "pendiente") return "Tu cuenta está pendiente de validación.";
    return "Tu cuenta no tiene acceso habilitado.";
}

function autenticarUsuario(identificador, password) {
    inicializarUsuarios();
    const usuario = buscarUsuarioPorIdentificador(identificador);

    if (!usuario || String(usuario.password || "") !== String(password || "")) {
        return { ok: false, mensaje: "Usuario, email o contraseña incorrectos." };
    }

    if (!puedeIngresarPorEstado(usuario)) {
        return { ok: false, mensaje: obtenerMensajeEstado(usuario) };
    }

    return { ok: true, usuario };
}

function crearSesionDesdeUsuario(usuario) {
    return {
        usuarioId: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        nombreCompleto: usuario.nombreCompleto,
        username: usuario.username,
        email: usuario.email,
        rol: usuario.rol,
        estado: usuario.estado,
        telefono: usuario.telefono || "",
        tecnicoId: usuario.tecnicoId ?? null,
        clienteId: usuario.clienteId ?? null,
        origen: usuario.origen || "admin",
        emailConfirmado: usuario.emailConfirmado ?? true,
        fechaCreacion: usuario.fechaCreacion || null,
        fechaInicio: new Date().toISOString()
    };
}

function crearCurrentUserLegacy(usuario) {
    return {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        nombreCompleto: usuario.nombreCompleto,
        username: usuario.username,
        usuario: usuario.username,
        email: usuario.email,
        rol: usuario.rol,
        estado: usuario.estado,
        telefono: usuario.telefono || "",
        tecnicoId: usuario.tecnicoId ?? null,
        clienteId: usuario.clienteId ?? null,
        origen: usuario.origen || "admin",
        emailConfirmado: usuario.emailConfirmado ?? true
    };
}

function iniciarSesion(usuario) {
    if (!usuario) return null;
    const sesion = crearSesionDesdeUsuario(usuario);
    escribirJSONLocalStorage(AUTH_STORAGE_KEYS.sesionActual, sesion);
    localStorage.setItem(AUTH_STORAGE_KEYS.legacySession, "true");
    escribirJSONLocalStorage(AUTH_STORAGE_KEYS.legacyCurrentUser, crearCurrentUserLegacy(usuario));
    return sesion;
}

function leerCurrentUserLegacy() {
    const valor = localStorage.getItem(AUTH_STORAGE_KEYS.legacyCurrentUser);
    if (!valor) return null;

    try {
        const parseado = JSON.parse(valor);
        return typeof parseado === "object" && parseado !== null ? parseado : { username: String(parseado) };
    } catch (error) {
        return { username: String(valor) };
    }
}

function buscarUsuarioDesdeLegacy() {
    const currentUser = leerCurrentUserLegacy();
    if (!currentUser) return null;

    const candidatos = [
        currentUser.id,
        currentUser.usuarioId,
        currentUser.username,
        currentUser.usuario,
        currentUser.email,
        currentUser.nombre
    ].filter(Boolean);

    for (const candidato of candidatos) {
        const usuario = buscarUsuarioPorIdentificador(candidato);
        if (usuario) return usuario;
    }

    return null;
}

function cargarScriptAuth(ruta, estaDisponible) {
    if (estaDisponible()) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const existente = document.querySelector(`script[src="${ruta}"]`);
        const script = existente || document.createElement("script");

        script.addEventListener("load", () => {
            if (estaDisponible()) resolve();
            else reject(new Error("El servicio de autenticación no quedó disponible."));
        }, { once: true });
        script.addEventListener("error", () => reject(new Error("No se pudo cargar el servicio de autenticación.")), { once: true });

        if (!existente) {
            script.src = ruta;
            script.async = false;
            document.head.appendChild(script);
        }
    });
}

async function asegurarServicioAuthSupabase() {
    if (window.AuthSupabaseService?.cerrarSesion) return window.AuthSupabaseService;

    await cargarScriptAuth("js/config/supabase-config.js", () => Boolean(window.LA_SOLUCION_SUPABASE_CONFIG));
    await cargarScriptAuth("js/services/supabaseClient.js", () => Boolean(window.LaSolucionSupabase?.getClient));
    await cargarScriptAuth("js/services/authService.js", () => Boolean(window.AuthSupabaseService?.cerrarSesion));
    return window.AuthSupabaseService;
}

function limpiarSesionLocal() {
    localStorage.removeItem(AUTH_STORAGE_KEYS.sesionActual);
    localStorage.removeItem(AUTH_STORAGE_KEYS.legacySession);
    localStorage.removeItem(AUTH_STORAGE_KEYS.legacyCurrentUser);
    localStorage.removeItem(AUTH_STORAGE_KEYS.sesionAdministradorOriginal);
}

async function cerrarSesion(opciones = {}) {
    const { redirigir = true, cerrarSupabase = redirigir } = opciones;
    let cierreSupabase = Promise.resolve();

    if (cerrarSupabase) {
        cierreSupabase = asegurarServicioAuthSupabase()
            .then((servicio) => servicio.cerrarSesion())
            .catch(() => null);
    }

    limpiarSesionLocal();
    await cierreSupabase;

    if (redirigir) {
        window.location.href = "index.html";
    }
}

function migrarSesionLegacySiEsSegura() {
    const tieneLegacy = localStorage.getItem(AUTH_STORAGE_KEYS.legacySession) === "true";
    if (!tieneLegacy) return null;

    inicializarUsuarios();
    const usuario = buscarUsuarioDesdeLegacy();

    if (!usuario || !puedeIngresarPorEstado(usuario)) {
        cerrarSesion({ redirigir: false });
        return null;
    }

    return iniciarSesion(usuario);
}

function obtenerSesionActual() {
    inicializarUsuarios();
    const sesion = leerJSONLocalStorage(AUTH_STORAGE_KEYS.sesionActual, null);

    if (!sesion || !sesion.usuarioId) {
        return migrarSesionLegacySiEsSegura();
    }

    const usuario = obtenerUsuarios().find((item) => item.id === sesion.usuarioId);

    if (!usuario || !puedeIngresarPorEstado(usuario)) {
        cerrarSesion({ redirigir: false });
        return null;
    }

    return {
        ...sesion,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        nombreCompleto: usuario.nombreCompleto,
        username: usuario.username,
        email: usuario.email,
        rol: usuario.rol,
        estado: usuario.estado
    };
}

function haySesionActiva() {
    return Boolean(obtenerSesionActual());
}

function obtenerUsuarioActual() {
    const sesion = obtenerSesionActual();

    if (!sesion) {
        return null;
    }

    return {
        id: sesion.usuarioId,
        usuarioId: sesion.usuarioId,
        nombre: sesion.nombre || sesion.username || "Usuario",
        apellido: sesion.apellido || "",
        nombreCompleto: sesion.nombreCompleto || sesion.nombre || sesion.username || "Usuario",
        username: sesion.username,
        usuario: sesion.username,
        email: sesion.email,
        rol: sesion.rol,
        estado: sesion.estado
    };
}

function obtenerSesionAdministradorOriginal() {
    return leerJSONLocalStorage(AUTH_STORAGE_KEYS.sesionAdministradorOriginal, null);
}

function restaurarSesionAdministrador() {
    const sesionAdmin = obtenerSesionAdministradorOriginal();
    if (!sesionAdmin || sesionAdmin.rol !== "administrador") {
        cerrarSesion();
        return;
    }

    const usuarioAdmin = obtenerUsuarios().find(usuario => usuario.id === sesionAdmin.usuarioId && usuario.rol === "administrador" && usuario.estado === "activo");
    if (!usuarioAdmin) {
        cerrarSesion();
        return;
    }

    localStorage.removeItem(AUTH_STORAGE_KEYS.sesionAdministradorOriginal);
    iniciarSesion(usuarioAdmin);
    window.location.href = "usuarios.html";
}

async function logout() {
    await cerrarSesion({ cerrarSupabase: true });
}

function sesionActiva() {
    return haySesionActiva();
}

function protegerPagina() {
    if (!haySesionActiva()) {
        window.location.href = "index.html";
    }
}

function redireccionarSiLogueado() {
    if (haySesionActiva()) {
        window.location.href = "dashboard.html";
    }
}

function cambiarUsuario(nombre) {
    const usuarioActual = obtenerUsuarioActual();

    if (!usuarioActual) return;

    escribirJSONLocalStorage(AUTH_STORAGE_KEYS.legacyCurrentUser, {
        ...usuarioActual,
        nombre: nombre || usuarioActual.nombre,
        username: usuarioActual.username,
        usuario: usuarioActual.usuario
    });
}

inicializarUsuarios();

window.AUTH_STORAGE_KEYS = AUTH_STORAGE_KEYS;
window.USUARIOS_INICIALES = USUARIOS_INICIALES;
window.leerJSONLocalStorage = leerJSONLocalStorage;
window.storageUsuariosInvalido = storageUsuariosInvalido;
window.inicializarUsuarios = inicializarUsuarios;
window.obtenerUsuarios = obtenerUsuarios;
window.guardarUsuarios = guardarUsuarios;
window.buscarUsuarioPorIdentificador = buscarUsuarioPorIdentificador;
window.autenticarUsuario = autenticarUsuario;
window.crearCuentaPublica = crearCuentaPublica;
window.usuarioDisponible = usuarioDisponible;
window.emailDisponibleRegistro = emailDisponibleRegistro;
window.iniciarSesion = iniciarSesion;
window.obtenerSesionActual = obtenerSesionActual;
window.haySesionActiva = haySesionActiva;
window.obtenerSesionAdministradorOriginal = obtenerSesionAdministradorOriginal;
window.restaurarSesionAdministrador = restaurarSesionAdministrador;
window.cerrarSesion = cerrarSesion;
window.logout = logout;
window.sesionActiva = sesionActiva;
window.protegerPagina = protegerPagina;
window.redireccionarSiLogueado = redireccionarSiLogueado;
window.obtenerUsuarioActual = obtenerUsuarioActual;
window.cambiarUsuario = cambiarUsuario;








