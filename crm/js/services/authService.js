(function () {
    "use strict";

    const ROLES_OPERATIVOS = Object.freeze(["admin", "colaborador", "tecnico"]);

    function respuestaSinConfig(data = null) {
        return { ok: false, data, error: "Supabase no configurado." };
    }

    function normalizarPerfil(perfil) {
        if (!perfil) return null;
        return {
            ...perfil,
            rol: String(perfil.rol || "").trim().toLowerCase(),
            estado: String(perfil.estado || "").trim().toLowerCase(),
            activo: perfil.activo === true
        };
    }

    function perfilPuedeOperar(perfil) {
        const normalizado = normalizarPerfil(perfil);
        return Boolean(
            normalizado &&
            normalizado.activo &&
            normalizado.estado === "activo" &&
            ROLES_OPERATIVOS.includes(normalizado.rol)
        );
    }

    async function obtenerSesion() {
        const client = await window.LaSolucionSupabase?.getClient();
        if (!client) return respuestaSinConfig();

        const { data, error } = await client.auth.getSession();
        return { ok: !error, data, error };
    }

    async function refrescarSesion() {
        const client = await window.LaSolucionSupabase?.getClient();
        if (!client) return respuestaSinConfig();

        const { data, error } = await client.auth.refreshSession();
        return { ok: !error, data, error };
    }

    async function iniciarSesion(email, password) {
        const client = await window.LaSolucionSupabase?.getClient();
        if (!client) return respuestaSinConfig();

        const { data, error } = await client.auth.signInWithPassword({ email, password });
        return { ok: !error, data, error };
    }

    async function enviarRecuperacionClave(email, redirectTo) {
        const client = await window.LaSolucionSupabase?.getClient();
        if (!client) return respuestaSinConfig();

        const options = redirectTo ? { redirectTo } : {};
        const { data, error } = await client.auth.resetPasswordForEmail(email, options);
        return { ok: !error, data, error };
    }

    async function actualizarClave(password) {
        const client = await window.LaSolucionSupabase?.getClient();
        if (!client) return respuestaSinConfig();

        const { data, error } = await client.auth.updateUser({ password });
        return { ok: !error, data, error };
    }

    async function cerrarSesion() {
        const client = await window.LaSolucionSupabase?.getClient();
        if (!client) return { ok: false, error: "Supabase no configurado." };

        const { error } = await client.auth.signOut();
        return { ok: !error, error };
    }

    async function obtenerPerfilActual() {
        const client = await window.LaSolucionSupabase?.getClient();
        if (!client) return respuestaSinConfig();

        const sesion = await obtenerSesion();
        const userId = sesion.data?.session?.user?.id;
        if (!sesion.ok || !userId) {
            return { ok: false, data: null, error: "No hay sesión Supabase activa." };
        }

        const { data, error } = await client
            .from("perfiles")
            .select("id, nombre, apellido, telefono, rol, estado, activo, created_at, updated_at")
            .eq("id", userId)
            .maybeSingle();

        if (error) return { ok: false, data: null, error };
        if (!data) return { ok: false, data: null, error: "La sesión Supabase no tiene perfil operativo vinculado." };

        return { ok: true, data: normalizarPerfil(data), error: null };
    }

    async function verificarSesionOperativa() {
        const sesion = await obtenerSesion();
        if (!sesion.ok || !sesion.data?.session) {
            return { ok: false, sesion: sesion.data || null, perfil: null, puedeOperar: false, error: sesion.error || "No hay sesión Supabase activa." };
        }

        const perfil = await obtenerPerfilActual();
        if (!perfil.ok) {
            return { ok: false, sesion: sesion.data, perfil: null, puedeOperar: false, error: perfil.error };
        }

        let tecnicoId = null;
        if (perfil.data.rol === "tecnico") {
            const client = await window.LaSolucionSupabase.getClient();
            const tecnico = await client.from("tecnicos").select("id").eq("perfil_id", perfil.data.id).eq("activo", true).maybeSingle();
            if (tecnico.error || !tecnico.data) return { ok: false, puedeOperar: false, error: "Falta vincular tu cuenta a un técnico activo." };
            tecnicoId = tecnico.data.id;
        }
        const puedeOperar = perfilPuedeOperar(perfil.data);
        return {
            ok: puedeOperar,
            sesion: sesion.data,
            perfil: perfil.data,
            puedeOperar,
            tecnicoId,
            error: puedeOperar ? null : "El perfil Supabase existe, pero no está activo o no tiene un rol interno habilitado."
        };
    }

    async function registrarClientePendiente() {
        return { ok: false, error: "Los clientes no tienen acceso al CRM." };
    }

    window.AuthSupabaseService = Object.freeze({
        ROLES_OPERATIVOS,
        obtenerSesion,
        refrescarSesion,
        iniciarSesion,
        enviarRecuperacionClave,
        actualizarClave,
        cerrarSesion,
        obtenerPerfilActual,
        verificarSesionOperativa,
        perfilPuedeOperar,
        registrarClientePendiente
    });
})();
