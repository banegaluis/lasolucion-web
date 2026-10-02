(function () {
    'use strict';
    async function ejecutar(action, usuario) {
        const client = await window.LaSolucionSupabase.getClient();
        if (!client) throw new Error('No se pudo conectar con Usuarios.');
        let requestId, key;
        if (action === 'create') {
            const { data, error } = await client.auth.getUser();
            if (error || !data?.user) throw new Error('Iniciá sesión nuevamente.');
            key = 'crm-alta-usuario:' + data.user.id + ':' + usuario.email.toLowerCase();
            requestId = sessionStorage.getItem(key) || crypto.randomUUID();
            sessionStorage.setItem(key, requestId);
        }
        const { data, error } = await client.functions.invoke('usuarios-admin', { body: { action, usuario, requestId } });
        if (error || !data?.ok) {
            let mensaje = data?.error;
            if (!mensaje && error?.context?.json) {
                try { mensaje = (await error.context.json()).error; } catch (_) { /* Respuesta de red sin JSON. */ }
            }
            throw new Error(mensaje || 'No se completó la operación online. Reintentá sin cambiar los datos.');
        }
        if (key) { try { sessionStorage.removeItem(key); } catch (_) { /* El servidor ya confirmó el alta. */ } }
        return data;
    }
    window.UsuariosSupabaseService = Object.freeze({ ejecutar });
})();
