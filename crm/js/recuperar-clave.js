(function () {
    "use strict";

    let enlaceValido = false;
    let guardadoEnProceso = false;

    function mostrarMensaje(texto) {
        const mensaje = document.getElementById("recoveryMsg");
        if (mensaje) mensaje.textContent = texto || "";
    }

    function mostrarIntro(texto) {
        const intro = document.getElementById("recoveryIntro");
        if (intro) intro.textContent = texto || "";
    }

    function parametrosCombinados() {
        const query = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        return { query, hash };
    }

    function obtenerErrorEnlace() {
        const { query, hash } = parametrosCombinados();
        return query.get("error_description") || hash.get("error_description") || "";
    }

    function tieneIndicadorRecuperacion() {
        const { query, hash } = parametrosCombinados();
        return (
            query.get("type") === "recovery" ||
            hash.get("type") === "recovery" ||
            query.has("code") ||
            hash.has("access_token")
        );
    }

    function habilitarFormulario() {
        enlaceValido = true;
        ["newPass", "newPassConfirm", "btnGuardarNuevaClave"].forEach((id) => {
            const elemento = document.getElementById(id);
            if (elemento) elemento.disabled = false;
        });
        mostrarIntro("Elegí una nueva contraseña para tu cuenta de La Solución.");
        document.getElementById("newPass")?.focus();
    }

    async function validarEnlace() {
        const errorEnlace = obtenerErrorEnlace();
        if (errorEnlace) {
            mostrarIntro("El enlace de recuperación no pudo validarse.");
            mostrarMensaje("El enlace venció o ya fue utilizado. Volvé al login y pedí uno nuevo.");
            return;
        }

        if (!tieneIndicadorRecuperacion()) {
            mostrarIntro("Abrí esta pantalla desde el enlace que recibiste por email.");
            mostrarMensaje("Si necesitás otro enlace, volvé al login y elegí “¿Olvidaste tu contraseña?”.");
            return;
        }

        try {
            const client = await window.LaSolucionSupabase?.getClient();
            if (!client) {
                mostrarIntro("No se pudo conectar con el servicio de acceso.");
                mostrarMensaje("Volvé al login e intentá nuevamente.");
                return;
            }

            const { data, error } = await client.auth.getSession();
            if (error || !data?.session) {
                mostrarIntro("El enlace de recuperación no pudo validarse.");
                mostrarMensaje("El enlace venció o ya fue utilizado. Volvé al login y pedí uno nuevo.");
                return;
            }

            habilitarFormulario();
        } catch (error) {
            mostrarIntro("No se pudo validar el enlace de recuperación.");
            mostrarMensaje("Revisá tu conexión e intentá nuevamente.");
        }
    }

    async function guardarNuevaClave(evento) {
        evento.preventDefault();
        if (!enlaceValido || guardadoEnProceso) return;

        const password = document.getElementById("newPass")?.value || "";
        const confirmacion = document.getElementById("newPassConfirm")?.value || "";

        if (password.length < 8) {
            mostrarMensaje("La contraseña debe tener al menos 8 caracteres.");
            return;
        }

        if (password !== confirmacion) {
            mostrarMensaje("Las contraseñas no coinciden.");
            return;
        }

        guardadoEnProceso = true;
        const boton = document.getElementById("btnGuardarNuevaClave");
        if (boton) boton.disabled = true;
        mostrarMensaje("Guardando la nueva contraseña…");

        try {
            const resultado = await window.AuthSupabaseService?.actualizarClave(password);
            if (!resultado?.ok) {
                mostrarMensaje("No se pudo actualizar la contraseña. Pedí un nuevo enlace e intentá otra vez.");
                return;
            }

            mostrarMensaje("Contraseña actualizada correctamente.");
            await window.AuthSupabaseService?.cerrarSesion();
            window.location.replace("index.html?clave=actualizada");
        } catch (error) {
            mostrarMensaje("No se pudo actualizar la contraseña. Intentá nuevamente.");
        } finally {
            guardadoEnProceso = false;
            if (boton && enlaceValido) boton.disabled = false;
        }
    }

    function iniciar() {
        document.getElementById("recoveryForm")?.addEventListener("submit", guardarNuevaClave);
        validarEnlace();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar);
    } else {
        iniciar();
    }
})();
