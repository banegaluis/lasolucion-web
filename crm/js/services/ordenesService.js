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

    const relacionUnica = valor => Array.isArray(valor) ? valor[0] : valor;
    const horaCorta = valor => String(valor || "").slice(0, 5);

function mapearOrden(orden) {
    const cliente = relacionUnica(orden.clientes);
    const direccion = relacionUnica(orden.direcciones_clientes);
    const tecnico = relacionUnica(orden.tecnicos);
    const perfilTecnico = relacionUnica(tecnico?.perfiles);
    const categoria = relacionUnica(orden.categorias_trabajo);
    const tecnicoNombre = [perfilTecnico?.nombre, perfilTecnico?.apellido].filter(Boolean).join(" ").trim();
    const snapshot = orden.direccion_snapshot || {};
    const domicilio = { ...snapshot, ...(direccion || {}) };
    const direccionCompleta = domicilio.direccion_completa || domicilio.direccion || [
        [domicilio.calle, domicilio.numero].filter(Boolean).join(" "),
        domicilio.piso && domicilio.piso !== "-" ? `Piso ${domicilio.piso}` : "",
        domicilio.departamento && domicilio.departamento !== "-" ? `Dpto. ${domicilio.departamento}` : "",
        domicilio.ciudad, domicilio.provincia
    ].filter(Boolean).join(", ");
    const estado = String(orden.estado || "pendiente").replace("en_proceso", "en proceso");

    return {
        id: orden.id,
        numeroOrden: orden.numero_orden,
        clienteId: orden.cliente_id,
        clienteIdSupabase: orden.cliente_id,
        direccionIdSupabase: orden.direccion_cliente_id || "",
        cliente: cliente?.nombre_completo || "Cliente sin nombre",
        telefono: orden.telefono_contacto || cliente?.telefono_principal || "",
        calle: direccion?.calle || snapshot.calle || "",
        numero: direccion?.numero || snapshot.numero || "",
        piso: direccion?.piso || snapshot.piso || "-",
        departamento: direccion?.departamento || snapshot.departamento || "-",
        ciudad: direccion?.ciudad || snapshot.ciudad || "Córdoba",
        provincia: direccion?.provincia || snapshot.provincia || "Córdoba",
        direccion: direccionCompleta || "Sin dirección",
        fecha: orden.fecha_programada || "",
        hora: horaCorta(orden.hora_inicio),
        horaFin: horaCorta(orden.hora_fin),
        trabajo: orden.titulo || orden.descripcion_solicitud || "Sin descripción",
        descripcion: orden.descripcion_solicitud || orden.titulo || "",
        estado,
        prioridad: orden.prioridad || "media",
        tecnicoId: orden.tecnico_id || "",
        tecnicoNombre: tecnicoNombre || tecnico?.especialidad || "Sin asignar",
        categoriaId: orden.categoria_id || "",
        categoria: categoria?.nombre || categoria?.slug || "Sin categoría",
        createdAt: orden.created_at,
        updatedAt: orden.updated_at,
        historial: ["terminado", "cancelado"].includes(estado),
        raw: orden
    };
}

    async function resumenAdministrativo() {
        const conexion = await obtenerClienteAutenticado();
        if (!conexion.ok) return { ok: false, error: conexion.error };
        const [pendientes, tecnicos] = await Promise.all([
            conexion.client.from("perfiles").select("id", { count: "exact", head: true })
                .or("estado.eq.pendiente,rol.eq.cliente_pendiente"),
            conexion.client.from("tecnicos").select("id", { count: "exact", head: true }).eq("activo", true)
        ]);
        const error = pendientes.error || tecnicos.error;
        return { ok: !error, error, pendientes: pendientes.count, tecnicos: tecnicos.count };
    }

    async function obtenerClienteAutenticado() {
        const client = await window.LaSolucionSupabase?.getClient();
        if (!client) return { ok: false, client: null, error: "Supabase no configurado." };
        const { data, error } = await client.auth.getSession();
        if (error || !data?.session?.user?.id) {
            return { ok: false, client: null, error: error || new Error("No hay una sesión Supabase Auth activa.") };
        }
        return { ok: true, client, usuarioId: data.session.user.id, error: null };
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
        if (!Object.hasOwn(ESTADOS_LOCAL_A_DB, String(estado || "").trim().toLowerCase())) {
            return { ok: false, data: null, error: new Error("Estado de orden inválido.") };
        }
        return actualizarOrden(id, { estado });
    }

    async function consultarConflictosHorario(fecha, horaInicio, duracionMinutos = 60, margenMinutos = 30, { tecnicoId = "", excluirId = null } = {}) {
        const client = await window.LaSolucionSupabase?.getClient();
        if (!client) return { ok: false, data: [], error: "Supabase no configurado." };

        try {
            const { data: sessionData, error: sessionError } = await client.auth.getSession();
            if (sessionError || !sessionData?.session?.user?.id) {
                return { ok: false, data: [], error: sessionError || new Error("No hay una sesión Supabase Auth activa.") };
            }

            const { data, error } = await client
                .from("ordenes")
                .select("id, numero_orden, tecnico_id, fecha_programada, hora_inicio, hora_fin, estado, titulo")
                .eq("fecha_programada", fecha)
                .neq("estado", "cancelado")
                .not("hora_inicio", "is", null)
                .order("hora_inicio", { ascending: true });

            if (error) return { ok: false, data: [], error };

            const inicioNuevo = horaAMinutos(horaInicio);
            const finBloqueNuevo = inicioNuevo + duracionMinutos + margenMinutos;
            const conflictos = (data || []).filter(orden => {
                if (excluirId && String(orden.id) === String(excluirId)) return false;
                if (tecnicoId && orden.tecnico_id && String(orden.tecnico_id) !== String(tecnicoId)) return false;
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

    function claveEnvio(conexion) {
        const proyecto = conexion.client.supabaseUrl || window.LA_SOLUCION_SUPABASE_CONFIG?.url || "crm";
        return `lasolucion:orden-pendiente:v1:${proyecto}:${conexion.usuarioId}`;
    }

    function leerEnvio(conexion) {
        const texto = window.sessionStorage.getItem(claveEnvio(conexion));
        if (!texto) return null;
        const envio = JSON.parse(texto);
        if (envio.version !== 1 || envio.usuarioId !== conexion.usuarioId ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(envio.id) ||
            !envio.payload || typeof envio.payload !== "object" || Array.isArray(envio.payload)) {
            throw new Error("El registro del envío pendiente no es válido. No se enviará otra orden; revisá el listado antes de continuar.");
        }
        return envio;
    }

    async function obtenerCreacionPendiente() {
        try {
            const conexion = await obtenerClienteAutenticado();
            if (!conexion.ok) return { ok: false, data: null, error: conexion.error };
            const envio = leerEnvio(conexion);
            return { ok: true, data: envio?.payload || null, error: null };
        } catch (error) {
            return { ok: false, data: null, error };
        }
    }

    async function consultarEnvio(conexion, envio) {
        return conexion.client.from("ordenes").select(SELECT_ORDEN_COMPLETA)
            .eq("id", envio.id).eq("created_by", conexion.usuarioId).maybeSingle();
    }

    function confirmarEnvio(conexion, envio, data, recuperada) {
        // El UUID se conserva si falla la limpieza; el próximo intento solo recuperará esta orden.
        try { window.sessionStorage.removeItem(claveEnvio(conexion)); } catch (_) { /* Reconciliar al reintentar. */ }
        window.dispatchEvent(new CustomEvent("ordenes:supabase-actualizadas", {
            detail: { id: data.id, operation: recuperada ? "recover" : "insert" }
        }));
        return { ok: true, data, error: null, recuperada };
    }

    async function crearOrden(orden) {
        let envio, conexion, eraPendiente = false, persistido = false;
        try {
            conexion = await obtenerClienteAutenticado();
            if (!conexion.ok) return { ok: false, data: null, error: conexion.error };
            envio = leerEnvio(conexion);
            eraPendiente = Boolean(envio);
            persistido = eraPendiente;
            const payload = prepararPayloadCreacion(orden);
            // La identidad se toma de Auth; el servidor sigue aplicando RLS.
            payload.created_by = conexion.usuarioId;
            if (envio) {
                if (JSON.stringify(payload) !== JSON.stringify(envio.payload)) {
                    return { ok: false, data: null, pendiente: true, error: new Error("Hay una orden pendiente de confirmar. Recuperá ese envío antes de iniciar otro.") };
                }
                const existente = await consultarEnvio(conexion, envio);
                if (existente.error) throw existente.error;
                if (existente.data) return confirmarEnvio(conexion, envio, existente.data, true);
            } else {
                envio = { version: 1, usuarioId: conexion.usuarioId, id: window.crypto.randomUUID(), payload };
                // Persistir antes de escribir: si el navegador no puede conservarlo, no enviar.
                window.sessionStorage.setItem(claveEnvio(conexion), JSON.stringify(envio));
                persistido = true;
            }
            const { data, error } = await conexion.client.from("ordenes")
                .insert({ ...envio.payload, id: envio.id })
                .select(SELECT_ORDEN_COMPLETA).single();
            if (!error && data) return confirmarEnvio(conexion, envio, data, eraPendiente);
            // Otro intento puede haber confirmado el mismo UUID mientras consultábamos.
            if (error?.code === "23505") {
                const existente = await consultarEnvio(conexion, envio);
                if (!existente.error && existente.data) return confirmarEnvio(conexion, envio, existente.data, true);
            }
            // Solo una primera respuesta SQL inequívoca permite corregir el formulario.
            // Un reintento jamás descarta la incertidumbre de un envío anterior.
            if (!eraPendiente && /^(22[0-9A-Z]{3}|23502|23503|23514|42501)$/.test(error?.code || "")) {
                window.sessionStorage.removeItem(claveEnvio(conexion));
                return { ok: false, data: null, error };
            }
            throw error || new Error("No llegó la confirmación del guardado.");
        } catch (error) {
            return { ok: false, data: null, pendiente: persistido, error: new Error(
                persistido
                    ? "No pudimos confirmar el envío. Volvé a pulsar Guardar para recuperar la misma orden; mantené esta pestaña abierta."
                    : (error?.message || "No se pudo preparar un envío seguro.")
            ) };
        }
    }

    window.OrdenesSupabaseService = Object.freeze({
        mapearOrden,
        resumenAdministrativo,
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
        crearOrden,
        obtenerCreacionPendiente
    });
})();
