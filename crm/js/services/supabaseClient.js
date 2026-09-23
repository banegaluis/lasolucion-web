(function () {
    "use strict";

    const CDN_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    let clientPromise = null;

    function getConfig() {
        const config = window.LA_SOLUCION_SUPABASE_CONFIG || {};
        return {
            url: typeof config.url === "string" ? config.url.trim() : "",
            anonKey: typeof config.anonKey === "string" ? config.anonKey.trim() : ""
        };
    }

    function isConfigured() {
        const config = getConfig();
        return /^https:\/\/.+\.supabase\.co$/.test(config.url) && config.anonKey.length > 20;
    }

    function loadScript() {
        if (window.supabase?.createClient) return Promise.resolve(window.supabase);

        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${CDN_URL}"]`);
            if (existing) {
                existing.addEventListener("load", () => resolve(window.supabase), { once: true });
                existing.addEventListener("error", () => reject(new Error("No se pudo cargar Supabase JS.")), { once: true });
                return;
            }

            const script = document.createElement("script");
            script.src = CDN_URL;
            script.async = true;
            script.onload = () => resolve(window.supabase);
            script.onerror = () => reject(new Error("No se pudo cargar Supabase JS."));
            document.head.appendChild(script);
        });
    }

    async function getClient() {
        if (!isConfigured()) return null;
        if (!clientPromise) {
            clientPromise = loadScript().then((supabaseModule) => {
                if (!supabaseModule?.createClient) throw new Error("Supabase JS no esta disponible.");
                const config = getConfig();
                return supabaseModule.createClient(config.url, config.anonKey, {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true
                    }
                });
            });
        }
        return clientPromise;
    }

    async function testConnection() {
        if (!isConfigured()) {
            return {
                ok: false,
                configured: false,
                message: "Supabase no esta configurado. La aplicacion puede seguir usando localStorage."
            };
        }

        try {
            const client = await getClient();
            const health = await client.rpc("healthcheck");
            const categorias = await client.from("categorias_trabajo").select("id, nombre").limit(1);

            if (health.error) {
                return { ok: false, configured: true, message: health.error.message, error: health.error };
            }

            return {
                ok: true,
                configured: true,
                data: health.data,
                categorias: {
                    ok: !categorias.error,
                    data: categorias.data || [],
                    error: categorias.error ? categorias.error.message : null
                },
                message: "Conexion Supabase disponible."
            };
        } catch (error) {
            return { ok: false, configured: true, message: error.message, error };
        }
    }

    window.LaSolucionSupabase = Object.freeze({
        getConfig,
        isConfigured,
        getClient,
        testConnection
    });
})();
