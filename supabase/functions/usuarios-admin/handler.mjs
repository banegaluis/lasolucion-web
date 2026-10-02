const ROLES = ['admin', 'colaborador', 'tecnico'];
const ESTADOS = ['activo', 'inactivo', 'bloqueado', 'pendiente'];
const ORIGIN = 'https://banegaluis.github.io';
export function crearHandler(admin) {
  return async function handler(req) {
    const headers = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
    const responder = (status, body) => new Response(JSON.stringify(body), { status, headers });
    if (req.headers.get('origin') && req.headers.get('origin') !== ORIGIN) return responder(403, { error: 'Origen no permitido.' });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') return responder(405, { error: 'Método no permitido.' });
    try {
      const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
      if (!token) return responder(401, { error: 'Iniciá sesión nuevamente.' });
      const identidad = await admin.auth.getUser(token);
      if (identidad.error || !identidad.data?.user) return responder(401, { error: 'Sesión inválida.' });
      const actor = identidad.data.user.id;
      const perfil = await admin.from('perfiles').select('rol,estado,activo').eq('id', actor).single();
      if (perfil.error || perfil.data?.rol !== 'admin' || perfil.data?.estado !== 'activo' || perfil.data?.activo !== true) return responder(403, { error: 'Solo un administrador activo puede gestionar usuarios.' });
      const body = await req.json();
      if (body.action === 'list') {
        const perfiles = await admin.from('perfiles').select('id,nombre,apellido,telefono,rol,estado,activo,created_at,updated_at').in('rol', ROLES).order('created_at');
        if (perfiles.error) throw new Error('No se pudieron cargar los perfiles.');
        const usuarios = await Promise.all(perfiles.data.map(async p => {
          const result = await admin.auth.admin.getUserById(p.id);
          if (result.error) throw new Error('No se pudieron cargar las cuentas.');
          return { ...p, email: result.data.user.email, emailConfirmado: Boolean(result.data.user.email_confirmed_at) };
        }));
        return responder(200, { ok: true, usuarios });
      }
      const d = body.usuario || {};
      const rol = d.rol === 'administrador' ? 'admin' : d.rol;
      if (!ROLES.includes(rol) || !ESTADOS.includes(d.estado)) return responder(400, { error: 'Elegí un rol interno y un estado válido. Los clientes no tienen acceso.' });
      if (!String(d.nombre || '').trim() || !String(d.apellido || '').trim()) return responder(400, { error: 'Completá nombre y apellido.' });
      if ([d.nombre, d.apellido, d.telefono || ''].some(v => typeof v !== 'string' || v.length > 200)) return responder(400, { error: 'Datos personales inválidos.' });
      const datosPerfil = { p_nombre: d.nombre.trim(), p_apellido: d.apellido.trim(), p_telefono: d.telefono || '', p_rol: rol, p_estado: d.estado, p_actor: actor };
      if (body.action === 'update') {
        if (d.password) return responder(400, { error: 'Para cambiar una clave usá la recuperación desde el login.' });
        const existente = await admin.auth.admin.getUserById(d.id);
        if (existente.error || existente.data.user.email?.toLowerCase() !== String(d.email).toLowerCase()) return responder(400, { error: 'El email de una cuenta existente no se cambia desde este formulario.' });
        const saved = await admin.rpc('administrar_perfil_interno', { ...datosPerfil, p_id: d.id, p_crear: false });
        if (saved.error) return responder(400, { error: 'No se guardó el perfil. No podés deshabilitarte ni quitar el último administrador activo.' });
        return responder(200, { ok: true });
      }
      if (body.action !== 'create') return responder(400, { error: 'Acción inválida.' });
      const email = String(d.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof d.password !== 'string' || d.password.length < 10 || d.password.length > 128) return responder(400, { error: 'Ingresá un email válido y una contraseña de 10 a 128 caracteres.' });
      if (!/^[0-9a-f-]{36}$/i.test(body.requestId || '')) return responder(400, { error: 'Identificador de alta inválido.' });
      const creado = await admin.auth.admin.createUser({ email, password: d.password, email_confirm: true, app_metadata: { crm_alta_id: body.requestId, crm_creado_por: actor } });
      let cuenta = creado.data?.user;
      if (creado.error) {
        // Solo se recupera el mismo envío del mismo administrador; nunca se adopta otra cuenta.
        if (!['email_exists', 'user_already_exists'].includes(creado.error.code)) return responder(400, { error: 'No se pudo crear la cuenta. Revisá los datos e intentá nuevamente.' });
        for (let page = 1; ; page++) {
          const lista = await admin.auth.admin.listUsers({ page, perPage: 1000 });
          if (lista.error) throw new Error('No se pudo comprobar el alta anterior.');
          cuenta = lista.data.users.find(u => u.email?.toLowerCase() === email && u.app_metadata?.crm_alta_id === body.requestId && u.app_metadata?.crm_creado_por === actor);
          if (cuenta || lista.data.users.length < 1000) break;
        }
        if (!cuenta) return responder(409, { error: 'Ese email ya tiene una cuenta. No se modificó su contraseña ni sus permisos.' });
      }
      const saved = await admin.rpc('administrar_perfil_interno', { ...datosPerfil, p_id: cuenta.id, p_crear: true });
      if (saved.error) return responder(503, { error: 'La cuenta fue creada, pero falta completar el perfil. Reintentá el mismo alta; no se duplicará.' });
      return responder(200, { ok: true, id: cuenta.id, recuperado: Boolean(creado.error) });
    } catch (_) {
      return responder(500, { error: 'No se pudo completar la operación. Reintentá sin cambiar los datos.' });
    }
  };
}
