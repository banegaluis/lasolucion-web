(function () {
    "use strict";

    function leerLista(clave) {
        try {
            const data = JSON.parse(localStorage.getItem(clave) || "[]");
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return [];
        }
    }

    function normalizarTelefono(valor) {
        return String(valor || "").replace(/[^0-9+]/g, "");
    }

    function normalizarTexto(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .replace(/\s+/g, " ")
            .toLowerCase();
    }

    function estadoOrdenLocalADB(estado) {
        return window.OrdenesSupabaseService?.estadoLocalADB(estado) || "pendiente";
    }

    function construirDireccionOrden(orden) {
        return [orden.calle, orden.numero, orden.piso, orden.departamento, orden.ciudad, orden.provincia]
            .filter(Boolean)
            .join(" ");
    }

    function prepararMigracionLocalStorage() {
        const usuarios = leerLista("usuarios");
        const ordenes = leerLista("ordenes");
        const clientesLocales = leerLista("clientes");
        const tecnicosLocales = leerLista("tecnicos");
        const clientesPorClave = new Map();
        const casosDudosos = [];

        clientesLocales.forEach((cliente) => {
            const telefono = normalizarTelefono(cliente.telefono_principal || cliente.telefono || cliente.whatsapp);
            const nombre = cliente.nombre_completo || cliente.nombreCompleto || cliente.nombre || cliente.cliente;
            const clave = telefono || normalizarTexto(nombre);
            if (!clave) return;
            clientesPorClave.set(clave, { origen: "clientes", cliente });
        });

        ordenes.forEach((orden) => {
            const telefono = normalizarTelefono(orden.telefono);
            const nombre = orden.cliente || orden.nombre || orden.nombreCompleto;
            const direccion = construirDireccionOrden(orden) || orden.direccion;
            const clave = telefono || normalizarTexto([nombre, direccion].filter(Boolean).join(" "));
            if (!clave) {
                casosDudosos.push({ tipo: "cliente_sin_identificador", ordenId: orden.id, orden });
                return;
            }

            const existente = clientesPorClave.get(clave);
            if (!existente) {
                clientesPorClave.set(clave, {
                    origen: "ordenes",
                    cliente: {
                        nombre,
                        telefono_principal: orden.telefono,
                        direccion
                    }
                });
                return;
            }

            if (existente.cliente?.nombre && nombre && normalizarTexto(existente.cliente.nombre) !== normalizarTexto(nombre)) {
                casosDudosos.push({ tipo: "posible_cliente_duplicado", clave, ordenId: orden.id, existente, orden });
            }
        });

        const ordenesNormalizadas = ordenes.map((orden) => ({
            origen_id: orden.id,
            cliente_nombre: orden.cliente || "",
            telefono_contacto: orden.telefono || "",
            direccion_snapshot: {
                direccion: orden.direccion || construirDireccionOrden(orden),
                calle: orden.calle || "",
                numero: orden.numero || "",
                piso: orden.piso || "",
                departamento: orden.departamento || "",
                ciudad: orden.ciudad || "",
                provincia: orden.provincia || ""
            },
            fecha_programada: orden.fecha || null,
            hora_inicio: orden.hora || null,
            hora_fin: orden.horaFin || null,
            titulo: orden.trabajo || orden.descripcion || "Orden importada",
            descripcion_solicitud: orden.descripcion || orden.trabajo || "",
            descripcion_trabajo_realizado: orden.historial ? orden.descripcion || "" : "",
            estado: estadoOrdenLocalADB(orden.estado),
            prioridad: orden.prioridad || "media",
            tecnico_local: orden.tecnicoId || orden.tecnicoNombre || null,
            categoria: orden.categoria || null
        }));

        return {
            usuarios,
            clientes: [...clientesPorClave.values()],
            tecnicos: tecnicosLocales,
            ordenes: ordenesNormalizadas,
            casosDudosos,
            resumen: {
                usuarios: usuarios.length,
                clientesDetectados: clientesPorClave.size,
                tecnicosLocales: tecnicosLocales.length,
                ordenes: ordenes.length,
                casosDudosos: casosDudosos.length
            }
        };
    }

    async function importarLocalStorageASupabase({ dryRun = true } = {}) {
        const preparacion = prepararMigracionLocalStorage();
        if (dryRun) return { ok: true, dryRun: true, ...preparacion };
        return {
            ok: false,
            dryRun: false,
            error: "Importacion real deshabilitada en esta etapa. Revisar casos dudosos antes de insertar datos."
        };
    }

    window.LocalStorageMigrationService = Object.freeze({
        prepararMigracionLocalStorage,
        importarLocalStorageASupabase
    });
})();
