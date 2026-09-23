/* =====================================================
   La Solución CRM
   Autorización local centralizada
===================================================== */

// Esta autorización frontend ordena la experiencia y evita accesos casuales.
// No reemplaza autorización de servidor, RLS ni sesiones seguras en producción.
const ROLES = Object.freeze({
    ADMINISTRADOR: "administrador",
    COLABORADOR: "colaborador",
    TECNICO: "tecnico",
    CLIENTE: "cliente",
    CLIENTE_PENDIENTE: "cliente_pendiente"
});

const PERMISOS = Object.freeze({
    DASHBOARD_VER_GENERAL: "dashboard.verGeneral",
    DASHBOARD_VER_OPERATIVO: "dashboard.verOperativo",
    DASHBOARD_VER_TECNICO: "dashboard.verTecnico",
    DASHBOARD_VER_CLIENTE: "dashboard.verCliente",
    DASHBOARD_VER_CLIENTE_PENDIENTE: "dashboard.verClientePendiente",

    AGENDA_VER_COMPLETA: "agenda.verCompleta",
    AGENDA_VER_PROPIA: "agenda.verPropia",

    ORDENES_VER_TODAS: "ordenes.verTodas",
    ORDENES_VER_ASIGNADAS: "ordenes.verAsignadas",
    ORDENES_VER_PROPIAS: "ordenes.verPropias",
    ORDENES_CREAR: "ordenes.crear",
    ORDENES_EDITAR: "ordenes.editar",
    ORDENES_EDITAR_ADMINISTRACION: "ordenes.editarAdministracion",
    ORDENES_EDITAR_TRABAJO_REALIZADO: "ordenes.editarTrabajoRealizado",
    ORDENES_ELIMINAR: "ordenes.eliminar",
    ORDENES_CANCELAR: "ordenes.cancelar",
    ORDENES_ASIGNAR_TECNICO: "ordenes.asignarTecnico",
    ORDENES_REPROGRAMAR: "ordenes.reprogramar",
    ORDENES_CAMBIAR_ESTADO: "ordenes.cambiarEstado",
    ORDENES_CAMBIAR_ESTADO_TECNICO: "ordenes.cambiarEstadoTecnico",
    ORDENES_MOVER_AGENDA: "ordenes.moverAgenda",
    ORDENES_REDIMENSIONAR_AGENDA: "ordenes.redimensionarAgenda",
    ORDENES_ABRIR_MAPS: "ordenes.abrirMaps",
    ORDENES_CONTACTAR_CLIENTE: "ordenes.contactarCliente",
    ORDENES_CONTACTAR: "ordenes.contactarCliente",
    ORDENES_AGREGAR_DIAGNOSTICO: "ordenes.agregarDiagnostico",
    ORDENES_AGREGAR_EVIDENCIA: "ordenes.agregarEvidencia",

    CLIENTES_VER_TODOS: "clientes.verTodos",
    CLIENTES_VER_VINCULADOS: "clientes.verVinculados",
    CLIENTES_CREAR: "clientes.crear",
    CLIENTES_EDITAR: "clientes.editar",
    CLIENTES_DESACTIVAR: "clientes.desactivar",

    TECNICOS_VER: "tecnicos.ver",
    TECNICOS_ADMINISTRAR: "tecnicos.administrar",

    USUARIOS_VER: "usuarios.ver",
    USUARIOS_CREAR: "usuarios.crear",
    USUARIOS_EDITAR: "usuarios.editar",
    USUARIOS_CAMBIAR_ROL: "usuarios.cambiarRol",
    USUARIOS_DESACTIVAR: "usuarios.desactivar",

    PRESUPUESTOS_VER: "presupuestos.ver",
    PRESUPUESTOS_EDITAR: "presupuestos.editar",
    PRESUPUESTOS_VER_PROPIOS: "presupuestos.verPropios",

    ECONOMIA_VER: "economia.ver",
    ECONOMIA_VER_COSTOS: "economia.verCostos",
    ECONOMIA_VER_RENTABILIDAD: "economia.verRentabilidad",

    GASTOS_CREAR_PROPIOS: "gastos.crearPropios",
    GASTOS_VER_PROPIOS: "gastos.verPropios",
    GASTOS_VER_TODOS: "gastos.verTodos",
    GASTOS_REVISAR: "gastos.revisar",

    ESTADISTICAS_VER_GENERALES: "estadisticas.verGenerales",
    ESTADISTICAS_VER_OPERATIVAS: "estadisticas.verOperativas",
    ESTADISTICAS_VER_PROPIAS: "estadisticas.verPropias",

    CONFIGURACION_VER: "configuracion.ver",
    CONFIGURACION_EDITAR: "configuracion.editar",

    MENSAJES_VER: "mensajes.ver",
    PERFIL_EDITAR_PROPIO: "perfil.editarPropio",
    SOLICITUDES_CREAR: "solicitudes.crear",
    SOLICITUDES_VER_PROPIAS: "solicitudes.verPropias"
});

const PERMISOS_POR_ROL = Object.freeze({
    [ROLES.ADMINISTRADOR]: Object.freeze(Object.values(PERMISOS)),

    [ROLES.COLABORADOR]: Object.freeze([
        PERMISOS.DASHBOARD_VER_OPERATIVO,
        PERMISOS.AGENDA_VER_COMPLETA,
        PERMISOS.ORDENES_VER_TODAS,
        PERMISOS.ORDENES_CREAR,
        PERMISOS.ORDENES_EDITAR,
        PERMISOS.ORDENES_EDITAR_ADMINISTRACION,
        PERMISOS.ORDENES_CANCELAR,
        PERMISOS.ORDENES_ASIGNAR_TECNICO,
        PERMISOS.ORDENES_REPROGRAMAR,
        PERMISOS.ORDENES_CAMBIAR_ESTADO,
        PERMISOS.ORDENES_MOVER_AGENDA,
        PERMISOS.ORDENES_REDIMENSIONAR_AGENDA,
        PERMISOS.ORDENES_ABRIR_MAPS,
        PERMISOS.ORDENES_CONTACTAR_CLIENTE,
        PERMISOS.CLIENTES_VER_TODOS,
        PERMISOS.CLIENTES_CREAR,
        PERMISOS.CLIENTES_EDITAR,
        PERMISOS.TECNICOS_VER,
        PERMISOS.MENSAJES_VER,
        PERMISOS.ESTADISTICAS_VER_OPERATIVAS,
        PERMISOS.GASTOS_VER_TODOS
    ]),

    [ROLES.TECNICO]: Object.freeze([
        PERMISOS.DASHBOARD_VER_TECNICO,
        PERMISOS.AGENDA_VER_PROPIA,
        PERMISOS.ORDENES_VER_ASIGNADAS,
        PERMISOS.ORDENES_CAMBIAR_ESTADO_TECNICO,
        PERMISOS.ORDENES_EDITAR_TRABAJO_REALIZADO,
        PERMISOS.ORDENES_AGREGAR_DIAGNOSTICO,
        PERMISOS.ORDENES_AGREGAR_EVIDENCIA,
        PERMISOS.ORDENES_ABRIR_MAPS,
        PERMISOS.ORDENES_CONTACTAR_CLIENTE,
        PERMISOS.CLIENTES_VER_VINCULADOS,
        PERMISOS.GASTOS_CREAR_PROPIOS,
        PERMISOS.GASTOS_VER_PROPIOS,
        PERMISOS.MENSAJES_VER,
        PERMISOS.PERFIL_EDITAR_PROPIO
    ]),

    [ROLES.CLIENTE]: Object.freeze([
        PERMISOS.DASHBOARD_VER_CLIENTE,
        PERMISOS.SOLICITUDES_CREAR,
        PERMISOS.SOLICITUDES_VER_PROPIAS,
        PERMISOS.ORDENES_VER_PROPIAS,
        PERMISOS.PRESUPUESTOS_VER_PROPIOS,
        PERMISOS.PERFIL_EDITAR_PROPIO
    ]),

    [ROLES.CLIENTE_PENDIENTE]: Object.freeze([
        PERMISOS.DASHBOARD_VER_CLIENTE_PENDIENTE,
        PERMISOS.SOLICITUDES_CREAR,
        PERMISOS.SOLICITUDES_VER_PROPIAS,
        PERMISOS.PERFIL_EDITAR_PROPIO
    ])
});

const ACCESO_PAGINAS = Object.freeze({
    "dashboard.html": Object.freeze([
        PERMISOS.DASHBOARD_VER_GENERAL,
        PERMISOS.DASHBOARD_VER_OPERATIVO,
        PERMISOS.DASHBOARD_VER_TECNICO,
        PERMISOS.DASHBOARD_VER_CLIENTE,
        PERMISOS.DASHBOARD_VER_CLIENTE_PENDIENTE
    ]),
    "ordenes.html": Object.freeze([PERMISOS.ORDENES_VER_TODAS, PERMISOS.ORDENES_VER_ASIGNADAS]),
    "agenda.html": Object.freeze([PERMISOS.AGENDA_VER_COMPLETA, PERMISOS.AGENDA_VER_PROPIA]),
    "clientes.html": Object.freeze([PERMISOS.CLIENTES_VER_TODOS]),
    "tecnicos.html": Object.freeze([PERMISOS.TECNICOS_VER, PERMISOS.TECNICOS_ADMINISTRAR]),
    "usuarios.html": Object.freeze([PERMISOS.USUARIOS_VER]),
    "mensajes.html": Object.freeze([PERMISOS.MENSAJES_VER]),
    "estadisticas.html": Object.freeze([PERMISOS.ESTADISTICAS_VER_GENERALES]),
    "configuracion.html": Object.freeze([PERMISOS.CONFIGURACION_VER, PERMISOS.CONFIGURACION_EDITAR])
});

function normalizarRolPermisos(rol) {
    const valor = String(rol || "").trim().toLowerCase();
    if (valor === "admin") return ROLES.ADMINISTRADOR;
    if (valor === "administrador") return ROLES.ADMINISTRADOR;
    if (valor === "técnico" || valor === "tecnico") return ROLES.TECNICO;
    if (valor === "colaborador") return ROLES.COLABORADOR;
    if (valor === "cliente_pendiente") return ROLES.CLIENTE_PENDIENTE;
    if (valor === "cliente") return ROLES.CLIENTE;
    return valor;
}

function obtenerUsuarioParaPermisos() {
    if (typeof window.obtenerSesionActual === "function") {
        const sesion = window.obtenerSesionActual();
        if (sesion) return sesion;
    }

    if (typeof window.obtenerUsuarioActual !== "function") return null;
    const usuario = window.obtenerUsuarioActual();
    return usuario && typeof usuario === "object" ? usuario : null;
}

function obtenerRolActual() {
    const rol = normalizarRolPermisos(obtenerUsuarioParaPermisos()?.rol);
    return Object.values(ROLES).includes(rol) ? rol : "";
}

function obtenerRolActualPermisos() {
    return obtenerRolActual();
}

function obtenerPermisosDelRol(rol) {
    return PERMISOS_POR_ROL[normalizarRolPermisos(rol)] || [];
}

function obtenerPermisosRol(rol = obtenerRolActual()) {
    return obtenerPermisosDelRol(rol);
}

function obtenerPermisosUsuarioActual() {
    return obtenerPermisosDelRol(obtenerRolActual());
}

function tienePermiso(permiso) {
    if (!permiso) return false;
    return obtenerPermisosUsuarioActual().includes(permiso);
}

function tieneAlgunPermiso(permisos) {
    const lista = Array.isArray(permisos) ? permisos : [permisos];
    return lista.some(tienePermiso);
}

function tieneTodosLosPermisos(permisos) {
    const lista = Array.isArray(permisos) ? permisos : [permisos];
    return lista.every(tienePermiso);
}

function tieneRol(rol) {
    return obtenerRolActual() === normalizarRolPermisos(rol);
}

function tieneAlgunRol(roles) {
    const lista = Array.isArray(roles) ? roles : [roles];
    return lista.some(tieneRol);
}

function obtenerRutaInicioPorRol() {
    return "dashboard.html";
}

function obtenerPaginaActual() {
    return window.location.pathname.split("/").pop() || "dashboard.html";
}

function protegerSesionLocal() {
    if (typeof window.protegerPagina === "function") window.protegerPagina();
    if (typeof window.haySesionActiva === "function") return window.haySesionActiva();
    if (typeof window.obtenerSesionActual === "function") return Boolean(window.obtenerSesionActual());
    return true;
}

function protegerPaginaPorRoles(rolesPermitidos) {
    if (!protegerSesionLocal()) return;
    if (!tieneAlgunRol(rolesPermitidos)) window.location.href = obtenerRutaInicioPorRol(obtenerRolActual());
}

function protegerPaginaPorPermisos(permisosRequeridos, modo = "alguno") {
    if (!protegerSesionLocal()) return;

    const autorizado = modo === "todos"
        ? tieneTodosLosPermisos(permisosRequeridos)
        : tieneAlgunPermiso(permisosRequeridos);

    if (!autorizado) window.location.href = obtenerRutaInicioPorRol(obtenerRolActual());
}

function usuarioPuedeAccederPagina(pagina = obtenerPaginaActual()) {
    const permisos = ACCESO_PAGINAS[pagina];
    return !permisos || tieneAlgunPermiso(permisos);
}

function protegerPaginaPorPermiso() {
    if (!protegerSesionLocal()) return;
    if (!usuarioPuedeAccederPagina()) window.location.href = obtenerRutaInicioPorRol(obtenerRolActual());
}

function aplicarVisibilidadPorPermisos(raiz = document) {
    if (!raiz || !raiz.querySelectorAll) return;

    raiz.querySelectorAll("[data-permiso]").forEach((elemento) => {
        elemento.hidden = !tienePermiso(elemento.dataset.permiso);
    });

    raiz.querySelectorAll("[data-permisos-alguno]").forEach((elemento) => {
        const permisos = elemento.dataset.permisosAlguno.split(",").map(item => item.trim()).filter(Boolean);
        elemento.hidden = !tieneAlgunPermiso(permisos);
    });

    raiz.querySelectorAll("[data-roles]").forEach((elemento) => {
        const roles = elemento.dataset.roles.split(",").map(item => item.trim()).filter(Boolean);
        elemento.hidden = !tieneAlgunRol(roles);
    });
}

function alertarPermisoDenegado() {
    alert("No tenés permisos para realizar esta acción.");
}

function requerirPermiso(permiso, opciones = {}) {
    const autorizado = opciones.modo === "todos"
        ? tieneTodosLosPermisos(permiso)
        : tieneAlgunPermiso(permiso);

    if (!autorizado && opciones.mostrarMensaje !== false) alertarPermisoDenegado();
    return autorizado;
}

function coincideIdentidad(valor, candidatos) {
    const normalizado = String(valor ?? "").trim().toLowerCase();
    return Boolean(normalizado) && candidatos.some(candidato => String(candidato ?? "").trim().toLowerCase() === normalizado);
}

function obtenerIdentificadoresUsuario(usuario = obtenerUsuarioParaPermisos()) {
    if (!usuario) return [];
    return [
        usuario.id,
        usuario.usuarioId,
        usuario.tecnicoId,
        usuario.clienteId,
        usuario.username,
        usuario.usuario,
        usuario.email,
        usuario.nombreCompleto,
        usuario.nombre
    ].filter(valor => valor !== null && valor !== undefined && String(valor).trim() !== "");
}

function ordenAsignadaAlUsuario(orden, usuario = obtenerUsuarioParaPermisos()) {
    const ids = obtenerIdentificadoresUsuario(usuario);
    const tecnicosAsignados = Array.isArray(orden?.tecnicosAsignados) ? orden.tecnicosAsignados : [];

    return coincideIdentidad(orden?.tecnicoId, ids) ||
        coincideIdentidad(orden?.tecnicoUsuarioId, ids) ||
        coincideIdentidad(orden?.tecnicoEmail, ids) ||
        coincideIdentidad(orden?.tecnicoNombre, ids) ||
        tecnicosAsignados.some(tecnico => coincideIdentidad(tecnico?.id || tecnico?.tecnicoId || tecnico?.email || tecnico?.nombre, ids));
}

function ordenPropiaDelUsuario(orden, usuario = obtenerUsuarioParaPermisos()) {
    const ids = obtenerIdentificadoresUsuario(usuario);
    return coincideIdentidad(orden?.clienteId, ids) ||
        coincideIdentidad(orden?.clienteUsuarioId, ids) ||
        coincideIdentidad(orden?.clienteEmail, ids) ||
        coincideIdentidad(orden?.email, ids);
}

function puedeUsuarioVerOrden(usuario, orden) {
    if (!usuario || !orden) return false;
    const permisos = obtenerPermisosDelRol(usuario.rol);
    if (permisos.includes(PERMISOS.ORDENES_VER_TODAS)) return true;
    if (permisos.includes(PERMISOS.ORDENES_VER_ASIGNADAS)) return ordenAsignadaAlUsuario(orden, usuario);
    if (permisos.includes(PERMISOS.ORDENES_VER_PROPIAS)) return ordenPropiaDelUsuario(orden, usuario);
    return false;
}

function puedeVerOrden(orden, usuario = obtenerUsuarioParaPermisos()) {
    return puedeUsuarioVerOrden(usuario, orden);
}

function puedeUsuarioEditarOrden(usuario, orden) {
    if (!puedeUsuarioVerOrden(usuario, orden)) return false;
    const permisos = obtenerPermisosDelRol(usuario?.rol);
    return permisos.includes(PERMISOS.ORDENES_EDITAR) || permisos.includes(PERMISOS.ORDENES_EDITAR_ADMINISTRACION);
}

function puedeGestionarOrden(permiso, orden, usuario = obtenerUsuarioParaPermisos()) {
    if (!usuario || !orden) return false;
    const permisos = obtenerPermisosDelRol(usuario.rol);
    if (!permisos.includes(permiso)) return false;
    if (permisos.includes(PERMISOS.ORDENES_VER_TODAS)) return true;
    return puedeUsuarioVerOrden(usuario, orden);
}

function obtenerOrdenesVisiblesParaUsuario(ordenes, usuario = obtenerUsuarioParaPermisos()) {
    return (Array.isArray(ordenes) ? ordenes : []).filter(orden => puedeUsuarioVerOrden(usuario, orden));
}

function obtenerOrdenesVisibles() {
    if (typeof window.obtenerOrdenes !== "function") return [];
    return obtenerOrdenesVisiblesParaUsuario(window.obtenerOrdenes());
}

window.ROLES = ROLES;
window.PERMISOS = PERMISOS;
window.PERMISOS_POR_ROL = PERMISOS_POR_ROL;
window.ACCESO_PAGINAS = ACCESO_PAGINAS;
window.normalizarRolPermisos = normalizarRolPermisos;
window.obtenerRolActual = obtenerRolActual;
window.obtenerRolActualPermisos = obtenerRolActualPermisos;
window.obtenerPermisosDelRol = obtenerPermisosDelRol;
window.obtenerPermisosRol = obtenerPermisosRol;
window.obtenerPermisosUsuarioActual = obtenerPermisosUsuarioActual;
window.tienePermiso = tienePermiso;
window.tieneAlgunPermiso = tieneAlgunPermiso;
window.tieneTodosLosPermisos = tieneTodosLosPermisos;
window.tieneRol = tieneRol;
window.tieneAlgunRol = tieneAlgunRol;
window.obtenerRutaInicioPorRol = obtenerRutaInicioPorRol;
window.protegerPaginaPorRoles = protegerPaginaPorRoles;
window.protegerPaginaPorPermisos = protegerPaginaPorPermisos;
window.usuarioPuedeAccederPagina = usuarioPuedeAccederPagina;
window.protegerPaginaPorPermiso = protegerPaginaPorPermiso;
window.aplicarVisibilidadPorPermisos = aplicarVisibilidadPorPermisos;
window.requerirPermiso = requerirPermiso;
window.alertarPermisoDenegado = alertarPermisoDenegado;
window.ordenAsignadaAlUsuario = ordenAsignadaAlUsuario;
window.ordenPropiaDelUsuario = ordenPropiaDelUsuario;
window.puedeUsuarioVerOrden = puedeUsuarioVerOrden;
window.puedeUsuarioEditarOrden = puedeUsuarioEditarOrden;
window.puedeVerOrden = puedeVerOrden;
window.puedeGestionarOrden = puedeGestionarOrden;
window.obtenerOrdenesVisiblesParaUsuario = obtenerOrdenesVisiblesParaUsuario;
window.obtenerOrdenesVisibles = obtenerOrdenesVisibles;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => aplicarVisibilidadPorPermisos());
} else {
    aplicarVisibilidadPorPermisos();
}




