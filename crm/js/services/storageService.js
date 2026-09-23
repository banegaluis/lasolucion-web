(function () {
    "use strict";

    const BUCKETS = Object.freeze({
        evidenciasOrdenes: "evidencias-ordenes",
        comprobantesGastos: "comprobantes-gastos",
        documentosClientes: "documentos-clientes"
    });

    async function subirArchivo(bucket, path, file, options = {}) {
        const client = await window.LaSolucionSupabase?.getClient();
        if (!client) return { ok: false, data: null, error: "Supabase no configurado." };

        const { data, error } = await client.storage.from(bucket).upload(path, file, {
            cacheControl: options.cacheControl || "3600",
            upsert: options.upsert === true
        });

        return { ok: !error, data, error };
    }

    function pathEvidenciaOrden(ordenId, fileName) {
        return `ordenes/${ordenId}/${Date.now()}-${fileName}`;
    }

    function pathComprobanteTecnico(tecnicoId, fileName) {
        return `tecnicos/${tecnicoId}/${Date.now()}-${fileName}`;
    }

    function pathDocumentoCliente(clienteId, fileName) {
        return `clientes/${clienteId}/${Date.now()}-${fileName}`;
    }

    async function obtenerUrlFirmada(bucket, path, segundos = 300) {
        const client = await window.LaSolucionSupabase?.getClient();
        if (!client) return { ok: false, data: null, error: "Supabase no configurado." };

        const { data, error } = await client.storage.from(bucket).createSignedUrl(path, segundos);
        return { ok: !error, data, error };
    }

    window.StorageSupabaseService = Object.freeze({
        BUCKETS,
        subirArchivo,
        pathEvidenciaOrden,
        pathComprobanteTecnico,
        pathDocumentoCliente,
        obtenerUrlFirmada
    });
})();
