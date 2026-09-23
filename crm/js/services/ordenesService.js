(function () {
    "use strict";

    const ESTADOS_LOCAL_A_DB = Object.freeze({
        "pendiente": "pendiente",
        "en proceso": "en_proceso",
        "en_proceso": "en_proceso",
        "terminado": "terminado",
        "cancelado": "cancelado"
    });

    function estadoLocalADB(estado) {
        return ESTADOS_LOCAL_A_DB[String(estado || "").trim().toLowerCase()] || "pendiente";
    }

    const PRIORIDADES_VALIDAS = Object.freeze(["baja", "media", "alta", "urgente"]);
    const ESTADOS_DB_VALIDOS = Object.freeze(["pendiente", "en_proceso", "terminado", "cancelado"]);
    const SELECT_ORDEN_COMPLETA = `
        id,
        numero_orden,
        cliente_id,
        direccion_cliente_id,
        tecnico_id,
        categoria_id,
        titulo,
        descripcion_solicitud,
        descripcion_trabajo_realizado,
        telefono_contacto,
        direccion_snapshot,
        fecha_programada,
        hora_inicio,
        hora_fin,
        estado,
        prioridad,
        notas_internas,
        created_by,
        created_at,
        updated_at,
        completed_at,
        cancelled_at,
        clientes(id, nombre_completo, telefono_principal),
        direcciones_clientes!ordenes_direccion_cliente_id_fkey(id, calle, numero, piso, departamento, ciudad, provincia, direccion_completa),
        tecnicos(id, especialidad, perfiles(nombre, apellido)),
        categorias_trabajo(id, nombre, slug)
    `;
    const COLUMNAS_ORDEN = Object.freeze([
        "cliente_id",
        "direccion_cliente_id",
        "tecnico_id",
        "categoria_id",
        "titulo",
        "descripcion_solicitud",
        "descripcion_trabajo_realizado",
        "telefono_contacto",
        "direccion_snapshot",
        "fecha_programada",
        "hora_inicio",
        "hora_fin",
        "estado",
        "prioridad",
        "notas_internas",
        "created_by"
    ]);

    function prioridadLocalADB(prioridad) {
        const valor = String(prioridad || "").trim().toLowerCase();
        if (valor === "normal") return "media";
        return PRIORIDADES_VALIDAS.includes(valor) ? valor : "media";
    }

    function prepararPayloadCreacion(orden = {}) {
        const payload = {};
        COLUMNAS_ORDEN.forEach(columna => {
            if (Object.prototype.hasOwnProperty.call(orden, columna)) payload[columna] = orden[columna];
        });
        payload.estado = estadoLocalADB(payload.estado);
        payload.prioridad = prioridadLocalADB(payload.prioridad);
        return payload;
    }

    function prepararPayloadActualizacion(cambios = {}) {
        const columnasActualizables = [
            "cliente_id",
            "direccion_cliente_id",
            "tecnico_id",
            "categoria_id",
            "titulo",
            "descripcion_solicitud",
            "descripcion_trabajo_realizado",
            "telefono_contacto",
            "direccion_snapshot",
            "fecha_programada",
            "hora_inicio",
            "hora_fin",
            "estado",
            "prioridad",
            "notas_internas"
        ];
        const nullable = new Set([
            "direccion_cliente_id",
            "tecnico_id",
            "categoria_id",
            "descripcion_solicitud",
            "descripcion_trabajo_realizado",
            "telefono_contacto",
            "fecha_programada",
            "hora_inicio",
            "hora_fin",
            "notas_internas"
        ]);
        const payload = {};

        columnasActualizables.forEach(columna => {
            if (!Object.prototype.hasOwnProperty.call(cambios, columna)) return;
            let valor = cambios[columna];
            if (valor === undefined) return;
            if (nullable.has(columna) && valor === "") valor = null;
            payload[columna] = valor;
        });

        if (Object.prototype.hasOwnProperty.call(payload, "estado")) {
            payload.estado = estadoLocalADB(payload.estado);
        }
        if (Object.prototype.hasOwnProperty.call(payload, "prioridad")) {
            payload.prioridad = prioridadLocalADB(payload.prioridad);
        }
        return payload;
    }

    async function obtenerClienteAutenticado() {
        const client = await window.LaSolucionSupabase?.getClient();
        if (!client) return { ok: false, client: null, error: "Supabase no configurado." };
        const { data, error } = await client.auth.getSession();
        if (error || !data?.session?.user?.id) {
            return { ok: false, client: null, error: error || new Error("No hay una sesión Supabase Auth activa.") };
        }
        return { ok: true, client, error: null };
    }

    async function listarOrdenes() {
        const conexion = await obtenerClienteAutenticado();
        if (!conexion.ok) return { ok: false, data: [], error: conexion.error };

        const { data, error } = await conexion.client
            .from("ordenes")
            .select(SELECT_ORDEN_COMPLETA)
            .order("fecha_programada", { ascending: false, nullsFirst: false })
            .order("hora_inicio", { ascending: true, nullsFirst: false })
            .order("numero_orden", { ascending: false });

        return { ok: !error, data: data || [], error };
    }

    async function consultarAgenda(desde, hastaExclusivo) {
        const client = await window.LaSolucionSupabase?.getClient();
        if (!client) return { ok: false, data: [], error: "Supabase no configurado." };

        try {
            const { data: sessionData, error: sessionError } = await client.auth.getSession();
            if (sessionError || !sessionData?.session?.user?.id) {
                return { ok: false, data: [], error: sessionError || new Error("No hay una sesión Supabase Auth activa en Agenda.") };
            }

            const { data, error } = await client
                .from("ordenes")
                .select(`
                    id,
                    numero_orden,
                    cliente_id,
                    direccion_cliente_id,
                    tecnico_id,
                    categoria_id,
                    titulo,
                    descripcion_solicitud,
                    telefono_contacto,
                    direccion_snapshot,
                    fecha_programada,
                    hora_inicio,
                    hora_fin,
                    estado,
                    prioridad,
                    created_at,
                    clientes(nombre_completo, telefono_principal),
                    direcciones_clientes!ordenes_direccion_cliente_id_fkey(calle, numero, piso, departamento, ciudad, provincia, direccion_completa),
                    categorias_trabajo(nombre, slug)
                `)
                .gte("fecha_programada", desde)
                .lt("fecha_programada", hastaExclusivo)
                .order("fecha_programada", { ascending: true })
                .order("hora_inicio", { ascending: true, nullsFirst: false });

            return {
                ok: !error,
                data: data || [],
                error,
                meta: {
                    desde,
                    hastaExclusivo,
                    authenticated: true
                }
            };
        } catch (error) {
            return { ok: false, data: [], error };
        }
    }

    async function obtenerOrden(id) {
        const conexion = await obtenerClienteAutenticado();
        if (!conexion.ok) return { ok: false, data: null, error: conexion.error };

        const { data, error } = await conexion.client
            .from("ordenes")
            .select(SELECT_ORDEN_COMPLETA)
            .eq("id", id)
            .maybeSingle();

        return { ok: !error, data, error };
    }

    async function obtenerHistorial(id) {
        const conexion = await obtenerClienteAutenticado();
        if (!conexion.ok) return { ok: false, data: [], error: conexion.error };

        const { data, error } = await conexion.client
            .from("historial_ordenes")
            .select("id, orden_id, tipo_evento, estado_anterior, estado_nuevo, descripcion, datos_anteriores, datos_nuevos, created_by, created_at")
            .eq("orden_id", id)
            .order("created_at", { ascending: false });

        return { ok: !error, data: data || [], error };
    }

    async function obtenerOrdenConHistorial(id) {
        const [orden, historial] = await Promise.all([obtenerOrden(id), obtenerHistorial(id)]);
        if (!orden.ok) return { ok: false, data: null, historial: [], error: orden.error };
        if (!historial.ok) return { ok: false, data: orden.data, historial: [], error: historial.error };
        return { ok: true, data: orden.data, historial: historial.data, error: null };
    }

    async function listarTecnicos() {
        const conexion = await obtenerClienteAutenticado();
        if (!conexion.ok) return { ok: false, data: [], error: conexion.error };

        const { data, error } = await conexion.client
            .from("tecnicos")
            .select("id, especialidad, activo, perfiles(nombre, apellido)")
            .eq("activo", true)
            .order("especialidad", { ascending: true });

        return { ok: !error, data: data || [], error };
    }

    async function listarCategorias() {
        const conexion = await obtenerClienteAutenticado();
        if (!conexion.ok) return { ok: false, data: [], error: conexion.error };

        const { data, error } = await conexion.client
            .from("categorias_trabajo")
            .select("id, nombre, slug")
            .eq("activo", true)
            .order("nombre", { ascending: true });

        return { ok: !error, data: data || [], error };
    }

    async function actualizarOrden(id, cambios) {
        const conexion = await obtenerClienteAutenticado();
        if (!conexion.ok) return { ok: false, data: null, error: conexion.error };

        const payload = prepararPayloadActualizacion(cambios);
        if (!Object.keys(payload).length) {
            return { ok: false, data: null, error: new Error("No hay cambios válidos para actualizar.") };
        }

        const { data, error } = await conexion.client
            .from("ordenes")
            .update(payload)
            .eq("id", id)
            .select(SELECT_ORDEN_COMPLETA)
            .single();

        if (!error && data) {
            window.dispatchEvent(new CustomEvent("ordenes:supabase-actualizadas", {
                detail: { id: data.id, operation: "update" }
            }));
        }
        return { ok: !error, data: data || null, error };
    }

    async function cambiarEstado(id, estado) {
        if (!ESTADOS_DB_VALIDOS.includes(estadoLocalADB(estado))) {
            return { ok: false, data: null, error: new Error("Estado de orden inválido.") };
        }
        return actualizarOrden(id, { estado });
    }

    async function consultarConflictosHorario(fecha, horaInicio, duracionMinutos = 60, margenMinutos = 30) {
        const client = await window.LaSolucionSupabase?.getClient();
        if (!client) return { ok: false, data: [], error: "Supabase no configurado." };

        try {
            const { data: sessionData, error: sessionError } = await client.auth.getSession();
            if (sessionError || !sessionData?.session?.user?.id) {
                return { ok: false, data: [], error: sessionError || new Error("No hay una sesión Supabase Auth activa.") };
            }

            const { data, error } = await client
                .from("ordenes")
                .select("id, numero_orden, fecha_programada, hora_inicio, hora_fin, estado, titulo")
                .eq("fecha_programada", fecha)
                .neq("estado", "cancelado")
                .not("hora_inicio", "is", null)
                .order("hora_inicio", { ascending: true });

            if (error) return { ok: false, data: [], error };

            const inicioNuevo = horaAMinutos(horaInicio);
            const finBloqueNuevo = inicioNuevo + duracionMinutos + margenMinutos;
            const conflictos = (data || []).filter(orden => {
                const inicioExistente = horaAMinutos(orden.hora_inicio);
                if (!Number.isFinite(inicioExistente)) return false;
                const finTrabajoExistente = Number.isFinite(horaAMinutos(orden.hora_fin))
                    ? horaAMinutos(orden.hora_fin)
                    : inicioExistente + duracionMinutos;
                const finBloqueExistente = finTrabajoExistente + margenMinutos;
                return inicioNuevo < finBloqueExistente && finBloqueNuevo > inicioExistente;
            });

            return { ok: true, data: conflictos, error: null };
        } catch (error) {
            return { ok: false, data: [], error };
        }
    }

    function horaAMinutos(hora) {
        const coincidencia = String(hora || "").match(/^(\d{2}):(\d{2})/);
        if (!coincidencia) return NaN;
        return Number(coincidencia[1]) * 60 + Number(coincidencia[2]);
    }

    async function crearOrden(orden) {
        const client = await window.LaSolucionSupabase?.getClient();
        if (!client) return { ok: false, data: null, error: "Supabase no configurado." };

        try {
            const payload = prepararPayloadCreacion(orden);
            const { data, error } = await client
                .from("ordenes")
                .insert(payload)
                .select("id, numero_orden, cliente_id, direccion_cliente_id, tecnico_id, categoria_id, titulo, descripcion_solicitud, descripcion_trabajo_realizado, telefono_contacto, direccion_snapshot, fecha_programada, hora_inicio, hora_fin, estado, prioridad, notas_internas, created_by, created_at, updated_at")
                .single();

            if (!error && data) {
                window.dispatchEvent(new CustomEvent("ordenes:supabase-actualizadas", {
                    detail: { id: data.id, operation: "insert" }
                }));
            }

            return { ok: !error, data: data || null, error: error || null };
        } catch (error) {
            return { ok: false, data: null, error };
        }
    }

    window.OrdenesSupabaseService = Object.freeze({
        estadoLocalADB,
        prioridadLocalADB,
        consultarAgenda,
        consultarConflictosHorario,
        listarOrdenes,
        obtenerOrden,
        obtenerHistorial,
        obtenerOrdenConHistorial,
        listarTecnicos,
        listarCategorias,
        actualizarOrden,
        cambiarEstado,
        crearOrden
    });
})();
