(function () {
    "use strict";

    const ROLES_OPERATIVOS = Object.freeze(["admin", "colaborador"]);

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

        const puedeOperar = perfilPuedeOperar(perfil.data);
        return {
            ok: puedeOperar,
            sesion: sesion.data,
            perfil: perfil.data,
            puedeOperar,
            error: puedeOperar ? null : "El perfil Supabase existe, pero no está activo o no tiene rol admin/colaborador."
        };
    }

    async function registrarClientePendiente({ email, password, nombre, apellido, telefono }) {
        const client = await window.LaSolucionSupabase?.getClient();
        if (!client) return respuestaSinConfig();

        const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
                data: {
                    nombre,
                    apellido,
                    telefono,
                    rol_solicitado: "cliente_pendiente"
                }
            }
        });

        return { ok: !error, data, error };
    }

    window.AuthSupabaseService = Object.freeze({
        ROLES_OPERATIVOS,
        obtenerSesion,
        refrescarSesion,
        iniciarSesion,
        cerrarSesion,
        obtenerPerfilActual,
        verificarSesionOperativa,
        perfilPuedeOperar,
        registrarClientePendiente
    });
})();
