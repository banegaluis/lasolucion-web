(function () {
    "use strict";

    function normalizarTexto(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .replace(/\s+/g, " ")
            .toLowerCase();
    }

    function normalizarTelefono(valor) {
        return String(valor || "").replace(/[^0-9+]/g, "");
    }

    function escaparFiltroIlike(valor) {
        return String(valor || "").replace(/[%,]/g, "");
    }

    function construirDireccionCompleta(direccion) {
        if (direccion?.direccion_completa) return String(direccion.direccion_completa).trim();
        return [
            [direccion?.calle, direccion?.numero].filter(Boolean).join(" ").trim(),
            direccion?.piso ? `Piso ${direccion.piso}` : "",
            direccion?.departamento ? `Dpto. ${direccion.departamento}` : "",
            direccion?.barrio,
            direccion?.ciudad,
            direccion?.provincia
        ].filter(Boolean).join(", ");
    }

    function dividirNombre(nombreCompleto) {
        const partes = String(nombreCompleto || "").trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
        if (partes.length <= 1) return { nombre: partes[0] || "", apellido: "" };
        return { nombre: partes.slice(0, -1).join(" "), apellido: partes.slice(-1).join(" ") };
    }

    async function obtenerClienteSupabase() {
        if (!window.AuthSupabaseService?.verificarSesionOperativa) {
            return { ok: false, client: null, error: "La sesi?n Supabase operativa no est? disponible." };
        }

        const estado = await window.AuthSupabaseService.verificarSesionOperativa();
        if (!estado.ok) return { ok: false, client: null, error: estado.error || "No hay sesi?n Supabase operativa." };

        const client = await window.LaSolucionSupabase?.getClient();
        if (!client) return { ok: false, client: null, error: "Supabase no configurado." };

        return { ok: true, client, perfil: estado.perfil, session: estado.sesion?.session || null };
    }

    async function listarClientes({ busqueda = "", incluirInactivos = false } = {}) {
        const conexion = await obtenerClienteSupabase();
        if (!conexion.ok) return { ok: false, data: [], error: conexion.error };

        let query = conexion.client
            .from("clientes")
            .select("*, direcciones_clientes(*)")
            .order("nombre", { ascending: true });

        if (!incluirInactivos) query = query.eq("activo", true);

        const { data, error } = await query;
        if (error) return { ok: false, data: [], error };

        const texto = normalizarTexto(busqueda);
        const filtrados = texto
            ? (data || []).filter(cliente => clienteCoincide(cliente, texto))
            : (data || []);

        return { ok: true, data: ordenarDireccionesClientes(filtrados), error: null };
    }

    function clienteCoincide(cliente, texto) {
        const direcciones = Array.isArray(cliente.direcciones_clientes) ? cliente.direcciones_clientes : [];
        const valores = [
            cliente.nombre_completo,
            cliente.nombre,
            cliente.apellido,
            cliente.telefono_principal,
            cliente.telefono_normalizado,
            cliente.email,
            cliente.dni,
            ...direcciones.map(direccion => direccion.direccion_completa),
            ...direcciones.map(direccion => direccion.direccion_normalizada)
        ].join(" ");

        return normalizarTexto(valores).includes(texto) || normalizarTelefono(valores).includes(normalizarTelefono(texto));
    }

    function ordenarDireccionesClientes(clientes) {
        return (clientes || []).map(cliente => ({
            ...cliente,
            direcciones_clientes: [...(cliente.direcciones_clientes || [])].sort((a, b) => {
                if (a.es_principal !== b.es_principal) return a.es_principal ? -1 : 1;
                if (a.activo !== b.activo) return a.activo ? -1 : 1;
                return String(a.alias || a.calle || "").localeCompare(String(b.alias || b.calle || ""));
            })
        }));
    }

    async function obtenerCliente(id) {
        const conexion = await obtenerClienteSupabase();
        if (!conexion.ok) return { ok: false, data: null, error: conexion.error };

        const { data, error } = await conexion.client
            .from("clientes")
            .select("*, direcciones_clientes(*)")
            .eq("id", id)
            .maybeSingle();

        return { ok: !error, data: data ? ordenarDireccionesClientes([data])[0] : null, error };
    }

    async function buscarClientes(busqueda, limite = 20) {
        const texto = normalizarTexto(busqueda);
        if (!texto) return { ok: true, data: [], error: null };

        const conexion = await obtenerClienteSupabase();
        if (!conexion.ok) return { ok: false, data: [], error: conexion.error };

        const termino = escaparFiltroIlike(String(busqueda || "").trim());
        const telefono = normalizarTelefono(busqueda);
        if (!termino && !telefono) return { ok: true, data: [], error: null };

        const filtros = [
            `nombre.ilike.%${termino}%`,
            `apellido.ilike.%${termino}%`,
            `nombre_completo.ilike.%${termino}%`
        ];

        if (telefono) {
            filtros.push(`telefono_principal.ilike.%${telefono}%`);
            filtros.push(`telefono_normalizado.ilike.%${telefono}%`);
        }

        const { data, error } = await conexion.client
            .from("clientes")
            .select("id,nombre,apellido,nombre_completo,telefono_principal,telefono_normalizado,activo,direcciones_clientes(id,cliente_id,alias,calle,numero,piso,departamento,barrio,ciudad,provincia,codigo_postal,direccion_completa,direccion_normalizada,es_principal,activo)")
            .eq("activo", true)
            .or(filtros.join(","))
            .order("nombre", { ascending: true })
            .limit(limite);

        if (error) {
            console.error("[Clientes] Error al buscar clientes", { code: error.code, message: error.message, table: "public.clientes", operation: "select" });
            return { ok: false, data: [], error };
        }

        return { ok: true, data: ordenarDireccionesClientes(data || []), error: null };
    }

    async function detectarDuplicados({ cliente = {}, direccion = {}, excluirClienteId = null } = {}) {
        const resultado = await listarClientes({ incluirInactivos: true });
        if (!resultado.ok) return resultado;

        const telefono = normalizarTelefono(cliente.telefono_principal || cliente.telefono || "");
        const email = normalizarTexto(cliente.email);
        const dni = normalizarTexto(cliente.dni);
        const nombre = normalizarTexto(cliente.nombre_completo || [cliente.nombre, cliente.apellido].filter(Boolean).join(" "));
        const direccionTexto = normalizarTexto(construirDireccionCompleta(direccion));

        const coincidencias = [];
        resultado.data.forEach(actual => {
            if (excluirClienteId && String(actual.id) === String(excluirClienteId)) return;
            const motivos = [];
            if (telefono && normalizarTelefono(actual.telefono_principal) === telefono) motivos.push("tel?fono");
            if (email && normalizarTexto(actual.email) === email) motivos.push("email");
            if (dni && normalizarTexto(actual.dni) === dni) motivos.push("DNI");

            const direcciones = actual.direcciones_clientes || [];
            const coincideDireccion = direccionTexto && direcciones.some(dir => normalizarTexto(dir.direccion_completa || dir.direccion_normalizada) === direccionTexto);
            if (nombre && direccionTexto && normalizarTexto(actual.nombre_completo) === nombre && coincideDireccion) motivos.push("nombre y direcci?n");
            if (direccionTexto && coincideDireccion) motivos.push("direcci?n");

            if (motivos.length) coincidencias.push({ cliente: actual, motivos: [...new Set(motivos)] });
        });

        return { ok: true, data: coincidencias, error: null };
    }

    function prepararCliente(cliente) {
        const nombres = dividirNombre(cliente.nombre_completo || cliente.cliente || cliente.nombre);
        return {
            nombre: String(cliente.nombre || nombres.nombre || "").trim(),
            apellido: String(cliente.apellido || nombres.apellido || "").trim() || null,
            telefono_principal: String(cliente.telefono_principal || cliente.telefono || "").trim(),
            telefono_alternativo: String(cliente.telefono_alternativo || "").trim() || null,
            email: String(cliente.email || "").trim().toLowerCase() || null,
            dni: String(cliente.dni || "").trim() || null,
            notas: String(cliente.notas || "").trim() || null,
            activo: cliente.activo !== false
        };
    }

    function normalizarDireccionParaGuardar(direccion = {}) {
        const normalizada = {
            alias: String(direccion.alias || "").trim() || null,
            calle: String(direccion.calle || "").trim(),
            numero: String(direccion.numero || "").trim() || null,
            piso: String(direccion.piso || "").trim() || null,
            departamento: String(direccion.departamento || "").trim() || null,
            barrio: String(direccion.barrio || "").trim() || null,
            ciudad: String(direccion.ciudad || "").trim() || "Córdoba",
            provincia: String(direccion.provincia || "").trim() || "Córdoba",
            codigo_postal: String(direccion.codigo_postal || "").trim() || null,
            activo: direccion.activo !== false
        };
        return {
            ...normalizada,
            direccion_completa: construirDireccionCompleta(normalizada)
        };
    }

    function prepararDireccion(direccion, esPrincipal = false) {
        return {
            ...normalizarDireccionParaGuardar(direccion),
            es_principal: Boolean(esPrincipal)
        };
    }

    function emailValido(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim()); }

    async function crearCliente(cliente, direccion = null, opciones = {}) {
        const conexion = await obtenerClienteSupabase();
        if (!conexion.ok) return { ok: false, data: null, error: conexion.error };

        const payload = prepararCliente(cliente);
        const userId = conexion.session?.user?.id;
        if (!userId) return { ok: false, data: null, error: "No hay usuario Supabase activo para crear el cliente." };
        if (!payload.nombre || !payload.telefono_principal) {
            return { ok: false, data: null, error: "Nombre o razón social y teléfono principal son obligatorios." };
        }
        if (payload.email && !emailValido(payload.email)) {
            return { ok: false, data: null, error: "Email inválido." };
        }
        const direccionPreparada = prepararDireccion(direccion || {}, true);
        if (!direccionPreparada.calle || !direccionPreparada.numero) {
            return { ok: false, data: null, error: "Calle y número son obligatorios." };
        }
        payload.created_by = userId;

        if (!opciones.omitirDuplicados) {
            const duplicados = await detectarDuplicados({ cliente: payload, direccion: direccionPreparada });
            if (!duplicados.ok) return duplicados;
            if (duplicados.data.length) return { ok: false, data: null, duplicados: duplicados.data, error: "Encontramos un cliente que podría ser el mismo." };
        }

        const respuestaCliente = await conexion.client.from("clientes").insert(payload).select().single();
        const { data, error } = respuestaCliente;
        if (error) {
            console.error("[Clientes] Error al crear cliente", { code: error.code, message: error.message, table: "public.clientes", operation: "insert" });
            return { ok: false, data: null, error };
        }
        console.log("[Clientes] cliente creado:", data.id);

        const creada = await crearDireccion(data.id, direccionPreparada, true);
        if (!creada.ok) return { ok: false, data, error: creada.error };

        return obtenerCliente(data.id);
    }

    async function actualizarCliente(id, cliente, opciones = {}) {
        const conexion = await obtenerClienteSupabase();
        if (!conexion.ok) return { ok: false, data: null, error: conexion.error };

        const payload = prepararCliente(cliente);
        delete payload.created_by;
        if (payload.email && !emailValido(payload.email)) {
            return { ok: false, data: null, error: "Email inválido." };
        }
        if (!opciones.omitirDuplicados) {
            const duplicados = await detectarDuplicados({ cliente: payload, excluirClienteId: id });
            if (!duplicados.ok) return duplicados;
            if (duplicados.data.length) return { ok: false, data: null, duplicados: duplicados.data, error: "Encontramos un cliente que podr?a ser el mismo." };
        }

        const { error } = await conexion.client.from("clientes").update(payload).eq("id", id);
        if (error) return { ok: false, data: null, error };
        return obtenerCliente(id);
    }

    async function cambiarEstadoCliente(id, activo) {
        const conexion = await obtenerClienteSupabase();
        if (!conexion.ok) return { ok: false, data: null, error: conexion.error };
        const { error } = await conexion.client.from("clientes").update({ activo: Boolean(activo) }).eq("id", id);
        return { ok: !error, error };
    }

    async function desactivarCliente(id) {
        return cambiarEstadoCliente(id, false);
    }

    async function reactivarCliente(id) {
        return cambiarEstadoCliente(id, true);
    }

    async function crearDireccion(clienteId, direccion, esPrincipal = false) {
        const conexion = await obtenerClienteSupabase();
        if (!conexion.ok) return { ok: false, data: null, error: conexion.error };

        if (esPrincipal) await quitarPrincipalDirecciones(conexion.client, clienteId);

        const payload = { ...prepararDireccion(direccion, esPrincipal), cliente_id: clienteId };
        if (!payload.calle || !payload.numero) return { ok: false, data: null, error: "Calle y número son obligatorios." };

        const respuestaDireccion = await conexion.client.from("direcciones_clientes").insert(payload).select().single();
        const { data, error } = respuestaDireccion;
        if (error) {
            console.error("[Clientes] Error al crear dirección", { code: error.code, message: error.message, table: "public.direcciones_clientes", operation: "insert" });
            return { ok: false, data, error };
        }
        console.log("[Clientes] dirección creada:", data.id);
        return { ok: true, data, error: null };
    }

    function obtenerDireccionPrincipalCliente(cliente) {
        const direcciones = Array.isArray(cliente?.direcciones_clientes) ? cliente.direcciones_clientes : [];
        return direcciones.find(d => d.activo !== false && d.es_principal)
            || direcciones.find(d => d.activo !== false)
            || direcciones[0]
            || null;
    }

    async function actualizarDireccion(id, clienteId, direccion, esPrincipal = false) {
        const conexion = await obtenerClienteSupabase();
        if (!conexion.ok) return { ok: false, data: null, error: conexion.error };

        if (esPrincipal) await quitarPrincipalDirecciones(conexion.client, clienteId);
        const { data, error } = await conexion.client
            .from("direcciones_clientes")
            .update(prepararDireccion(direccion, esPrincipal))
            .eq("id", id)
            .select()
            .single();
        if (error) {
            console.error("[Clientes] Error al actualizar dirección", { code: error.code, message: error.message, table: "public.direcciones_clientes", operation: "update" });
            return { ok: false, data, error };
        }
        console.log("[Clientes] dirección actualizada:", data.id);
        return { ok: true, data, error: null };
    }

    async function quitarPrincipalDirecciones(client, clienteId) {
        await client.from("direcciones_clientes").update({ es_principal: false }).eq("cliente_id", clienteId).eq("es_principal", true);
    }

    async function establecerDireccionPrincipal(clienteId, direccionId) {
        const conexion = await obtenerClienteSupabase();
        if (!conexion.ok) return { ok: false, data: null, error: conexion.error };
        await quitarPrincipalDirecciones(conexion.client, clienteId);
        const { error } = await conexion.client.from("direcciones_clientes").update({ es_principal: true, activo: true }).eq("id", direccionId);
        return { ok: !error, error };
    }

    async function desactivarDireccion(id) {
        const conexion = await obtenerClienteSupabase();
        if (!conexion.ok) return { ok: false, data: null, error: conexion.error };
        const { error } = await conexion.client.from("direcciones_clientes").update({ activo: false, es_principal: false }).eq("id", id);
        return { ok: !error, error };
    }

    window.ClientesSupabaseService = Object.freeze({
        normalizarTexto,
        normalizarTelefono,
        construirDireccionCompleta,
        listarClientes,
        obtenerCliente,
        buscarClientes,
        detectarDuplicados,
        obtenerDireccionPrincipalCliente,
        normalizarDireccionParaGuardar,
        crearCliente,
        actualizarCliente,
        desactivarCliente,
        reactivarCliente,
        crearDireccion,
        actualizarDireccion,
        establecerDireccionPrincipal,
        desactivarDireccion
    });
})();
