/* =====================================================
   La Solución CRM
   Módulo Login
===================================================== */

function obtenerValorCampo(id) {
    const campo = document.getElementById(id);
    return campo ? campo.value.trim() : "";
}

function mostrarMensajeLogin(texto) {
    const mensaje = document.getElementById("msg");
    if (mensaje) mensaje.textContent = texto || "";
}

let loginEnProceso = false;

function obtenerMensajeErrorSupabase(error, mensajePorDefecto) {
    if (typeof error === "string" && error.trim()) return error;
    if (error && typeof error.message === "string" && error.message.trim()) return error.message;
    return mensajePorDefecto;
}

function crearUsuarioEspejoSupabase(verificacion) {
    const usuarioAuth = verificacion?.sesion?.session?.user;
    const perfil = verificacion?.perfil;

    if (!usuarioAuth?.id || !usuarioAuth.email || !perfil) return null;

    const rol = perfil.rol === "admin" ? "administrador" : perfil.rol;
    if (!['administrador', 'colaborador'].includes(rol)) return null;

    const usuarios = obtenerUsuarios();
    const email = String(usuarioAuth.email).trim().toLowerCase();
    const existente = usuarios.find((item) => item.id === usuarioAuth.id || String(item.email || "").trim().toLowerCase() === email);
    const ahora = new Date().toISOString();
    const nombre = String(perfil.nombre || existente?.nombre || "").trim();
    const apellido = String(perfil.apellido || existente?.apellido || "").trim();
    const usuarioEspejo = {
        ...(existente || {}),
        id: usuarioAuth.id,
        nombre,
        apellido,
        nombreCompleto: `${nombre} ${apellido}`.trim() || email,
        username: existente?.username || email,
        usuario: existente?.username || email,
        email,
        password: "",
        rol,
        estado: "activo",
        telefono: perfil.telefono || existente?.telefono || "",
        origen: "supabase",
        emailConfirmado: Boolean(usuarioAuth.email_confirmed_at),
        fechaConfirmacionEmail: usuarioAuth.email_confirmed_at || null,
        creadoPor: existente?.creadoPor || "supabase",
        fechaCreacion: existente?.fechaCreacion || perfil.created_at || usuarioAuth.created_at || ahora,
        fechaModificacion: perfil.updated_at || ahora
    };

    guardarUsuarios([
        ...usuarios.filter((item) => item.id !== usuarioAuth.id && String(item.email || "").trim().toLowerCase() !== email),
        usuarioEspejo
    ]);

    return buscarUsuarioPorIdentificador(usuarioAuth.id);
}


function obtenerValorRegistro(id) {
    const campo = document.getElementById(id);
    return campo ? campo.value.trim() : "";
}

function mostrarMensajeRegistro(texto, tipo = "") {
    const mensaje = document.getElementById("registroMensaje");
    if (!mensaje) return;
    mensaje.textContent = texto || "";
    mensaje.className = `registro-message ${tipo ? `is-${tipo}` : ""}`.trim();
}

function abrirRegistro() {
    const modal = document.getElementById("registroModal");
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add("modal-scroll-locked");
    document.documentElement.classList.add("modal-scroll-locked");
    mostrarMensajeRegistro("");
    setTimeout(() => document.getElementById("registroNombre")?.focus({ preventScroll: true }), 0);
}

function cerrarRegistro() {
    const modal = document.getElementById("registroModal");
    if (modal) modal.hidden = true;
    document.body.classList.remove("modal-scroll-locked");
    document.documentElement.classList.remove("modal-scroll-locked");
}

function registrarCuentaPublicaDesdeFormulario(evento) {
    evento.preventDefault();

    if (typeof crearCuentaPublica !== "function" || typeof iniciarSesion !== "function") {
        mostrarMensajeRegistro("No se pudo crear la cuenta. Recargá la página.", "error");
        return;
    }

    const resultado = crearCuentaPublica({
        nombre: obtenerValorRegistro("registroNombre"),
        apellido: obtenerValorRegistro("registroApellido"),
        username: obtenerValorRegistro("registroUsername"),
        email: obtenerValorRegistro("registroEmail"),
        telefono: obtenerValorRegistro("registroTelefono"),
        password: document.getElementById("registroPassword")?.value || "",
        passwordConfirm: document.getElementById("registroPasswordConfirm")?.value || ""
    });

    if (!resultado.ok) {
        mostrarMensajeRegistro((resultado.errores || ["No se pudo crear la cuenta."]).join(" "), "error");
        return;
    }

    mostrarMensajeRegistro("Cuenta creada correctamente. Tu cuenta quedó pendiente de validación.", "success");
    iniciarSesion(resultado.usuario);
    setTimeout(() => ingresarSistema(), 450);
}
async function login() {
    if (loginEnProceso) return;

    const usuario = obtenerValorCampo("user");
    const password = obtenerValorCampo("pass");

    if (!usuario || !password) {
        mostrarMensajeLogin("Completá usuario o email y contraseña.");
        return;
    }

    if (typeof autenticarUsuario !== "function" || typeof iniciarSesion !== "function") {
        mostrarMensajeLogin("No se pudo iniciar sesión. Recargá la página.");
        return;
    }

    loginEnProceso = true;
    const boton = document.querySelector('.btn-login[onclick="login()"]');
    if (boton) boton.disabled = true;
    mostrarMensajeLogin("");

    try {
        if (usuario.includes("@")) {
            if (!window.AuthSupabaseService) {
                mostrarMensajeLogin("No se pudo conectar con el servicio de acceso. Recargá la página.");
                return;
            }

            const acceso = await window.AuthSupabaseService.iniciarSesion(usuario, password);
            if (!acceso.ok) {
                mostrarMensajeLogin(obtenerMensajeErrorSupabase(acceso.error, "Email o contraseña incorrectos."));
                return;
            }

            const verificacion = await window.AuthSupabaseService.verificarSesionOperativa();
            if (!verificacion.ok || !verificacion.puedeOperar) {
                await window.AuthSupabaseService.cerrarSesion();
                mostrarMensajeLogin(obtenerMensajeErrorSupabase(verificacion.error, "Tu cuenta no tiene acceso operativo habilitado."));
                return;
            }

            const usuarioEspejo = crearUsuarioEspejoSupabase(verificacion);
            if (!usuarioEspejo) {
                await window.AuthSupabaseService.cerrarSesion();
                mostrarMensajeLogin("No se pudo preparar la sesión local compatible.");
                return;
            }

            iniciarSesion(usuarioEspejo);
            ingresarSistema();
            return;
        }

        const resultado = autenticarUsuario(usuario, password);

        if (!resultado.ok) {
            mostrarMensajeLogin(resultado.mensaje || "Usuario, email o contraseña incorrectos.");
            return;
        }

        iniciarSesion(resultado.usuario);
        ingresarSistema();
    } catch (error) {
        mostrarMensajeLogin(obtenerMensajeErrorSupabase(error, "No se pudo iniciar sesión. Intentá nuevamente."));
    } finally {
        loginEnProceso = false;
        if (boton) boton.disabled = false;
    }
}

function ingresarSistema() {
    window.location.href = "dashboard.html";
}

function limpiarMensajeLogin() {
    mostrarMensajeLogin("");
}

function registrarEventosLogin() {
    const user = document.getElementById("user");
    const pass = document.getElementById("pass");
    const btnAbrirRegistro = document.getElementById("btnAbrirRegistro");
    const btnCerrarRegistro = document.getElementById("btnCerrarRegistro");
    const btnCancelarRegistro = document.getElementById("btnCancelarRegistro");
    const registroForm = document.getElementById("registroForm");
    const registroOverlay = document.querySelector("[data-close-registro]");

    btnAbrirRegistro?.addEventListener("click", abrirRegistro);
    btnCerrarRegistro?.addEventListener("click", cerrarRegistro);
    btnCancelarRegistro?.addEventListener("click", cerrarRegistro);
    registroOverlay?.addEventListener("click", cerrarRegistro);
    registroForm?.addEventListener("submit", registrarCuentaPublicaDesdeFormulario);

    [user, pass].forEach((campo) => {
        if (!campo || campo.dataset.loginListener === "true") return;

        campo.addEventListener("keydown", function (e) {
            if (e.key === "Enter") login();
        });

        campo.dataset.loginListener = "true";
    });
}

function iniciarLogin() {
    if (typeof inicializarUsuarios === "function") {
        inicializarUsuarios();
    }

    const pagina = window.location.pathname.split("/").pop().toLowerCase();

    if (pagina === "" || pagina === "index.html") {
        if (typeof redireccionarSiLogueado === "function") {
            redireccionarSiLogueado();
        }

        registrarEventosLogin();
        limpiarMensajeLogin();
        return;
    }

    if (typeof protegerPaginaPorPermiso === "function") {
        protegerPaginaPorPermiso();
        return;
    }

    if (typeof protegerPagina === "function") {
        protegerPagina();
    }
}

window.login = login;
window.iniciarLogin = iniciarLogin;
window.ingresarSistema = ingresarSistema;
window.abrirRegistro = abrirRegistro;
window.cerrarRegistro = cerrarRegistro;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarLogin);
} else {
    iniciarLogin();
}

