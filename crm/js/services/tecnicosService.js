(function () {
    "use strict";

    async function obtenerTecnicosActivos() {
        const client = await window.LaSolucionSupabase?.getClient();
        if (!client) return { ok: false, data: [], error: "Supabase no configurado." };

        const { data, error } = await client
            .from("tecnicos")
            .select("id, especialidad, matricula, perfil_id, perfiles(nombre, apellido)")
            .eq("activo", true)
            .order("especialidad", { ascending: true });

        return { ok: !error, data: data || [], error };
    }

    window.TecnicosSupabaseService = Object.freeze({
        obtenerTecnicosActivos
    });
})();
