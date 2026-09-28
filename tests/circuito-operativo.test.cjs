const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function entorno({ session = true, rows = [] } = {}) {
    const writes = [];
    const client = {
        auth: { getSession: async () => ({ data: { session: session ? { user: { id: 'usuario-prueba' } } : null } }) },
        from() {
            const q = { then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve); } };
            for (const method of ['select','eq','neq','not','order','gte','lt']) q[method] = () => q;
            q.insert = payload => { writes.push(payload); return q; };
            q.update = payload => { writes.push(payload); return q; };
            q.single = async () => ({ data: { id: 'orden-prueba', ...writes.at(-1) }, error: null });
            return q;
        }
    };
    const window = { LaSolucionSupabase: { getClient: async () => client }, dispatchEvent() {} };
    const context = vm.createContext({ window, CustomEvent: class {}, console });
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../crm/js/services/ordenesService.js'),'utf8'),context);
    return { service: window.OrdenesSupabaseService, writes, window, context };
}
test('Una sesión ausente nunca inserta una orden', async () => {
    const { service, writes } = entorno({ session: false });
    assert.equal((await service.crearOrden({titulo:'Trabajo'})).ok, false);
    assert.equal(writes.length, 0);
});
test('Un estado desconocido no convierte una orden a pendiente', async () => {
    const { service, writes } = entorno();
    assert.equal((await service.cambiarEstado('1','cualquier cosa')).ok, false);
    assert.equal(writes.length, 0);
    assert.equal((await service.cambiarEstado('1','en proceso')).data.estado,'en_proceso');
});
test('Reprogramar excluye la misma orden y otros técnicos, mantiene cruces sin asignar', async () => {
    const rows = [
        {id:'propia',tecnico_id:'a',hora_inicio:'10:00',hora_fin:'11:00'},
        {id:'otro',tecnico_id:'b',hora_inicio:'10:00',hora_fin:'11:00'},
        {id:'sin-asignar',tecnico_id:null,hora_inicio:'10:00',hora_fin:'11:00'},
        {id:'posterior',tecnico_id:'a',hora_inicio:'12:00',hora_fin:'13:00'}
    ];
    const { service } = entorno({ rows });
    const result = await service.consultarConflictosHorario('2026-10-01','10:00',60,30,{tecnicoId:'a',excluirId:'propia'});
    assert.deepEqual(result.data.map(x=>x.id),['sin-asignar']);
});
test('Listado y dashboard comparten cliente, dirección, horario y estado', () => {
    const { service } = entorno();
    const orden = service.mapearOrden({ id:'1',cliente_id:'c',estado:'en_proceso',fecha_programada:'2026-10-01',hora_inicio:'10:00:00',clientes:[{nombre_completo:'Cliente de prueba'}],direccion_snapshot:{calle:'Prueba',numero:'10',ciudad:'Córdoba'} });
    assert.equal(orden.cliente,'Cliente de prueba');
    assert.equal(orden.hora,'10:00');
    assert.equal(orden.estado,'en proceso');
    assert.equal(orden.direccion,'Prueba 10, Córdoba');
    assert.equal(orden.tecnicoId,'');
});
test('La búsqueda de texto no devuelve todos los clientes por un teléfono vacío', async () => {
    const env = entorno({ rows:[{id:'1',nombre:'Ana',telefono_principal:'3511234567'},{id:'2',nombre:'Bruno',telefono_principal:'3517654321'}] });
    env.window.AuthSupabaseService = { verificarSesionOperativa: async()=>({ok:true,perfil:{},sesion:{session:{user:{id:'x'}}}}) };
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../crm/js/services/clientesService.js'),'utf8'),env.context);
    const resultado = await env.window.ClientesSupabaseService.listarClientes({busqueda:'Ana'});
    assert.equal(resultado.data.length,1);
    assert.equal(resultado.data[0].id,'1');
});
function dashboardEntorno() {
    const callbacks = {};
    const root = {innerHTML:'',dataset:{},querySelector:()=>({addEventListener(){}})};
    const user={id:'u',usuarioId:'u',rol:'administrador',nombre:'Prueba'};
    const env=entorno();
    env.context.document={addEventListener:(n,fn)=>callbacks[n]=fn,getElementById:()=>root};
    env.window.addEventListener=(n,fn)=>callbacks[n]=fn;
    env.context.obtenerSesionActual=()=>user;
    env.context.obtenerUsuarios=()=>[user];
    env.context.obtenerUsuarioActual=()=>user;
    env.context.localStorage={getItem:()=>{throw new Error('No consultar órdenes locales');}};
    env.context.console={...console,error(){}};
    const rows=['pendiente','en_proceso','terminado','cancelado'].map((estado,i)=>({id:String(i),estado}));
    env.window.OrdenesSupabaseService={...env.service,listarOrdenes:async()=>({ok:true,data:rows}),resumenAdministrativo:async()=>({ok:true,pendientes:0,tecnicos:2})};
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../crm/js/dashboard.js'),'utf8'),env.context);
    return {...env,root,callbacks};
}
test('Dashboard usa órdenes remotas; canceladas no son terminadas, sin fecha no son atrasadas', async()=>{
    const env=dashboardEntorno();
    await env.callbacks.DOMContentLoaded();
    assert.match(env.root.innerHTML,/Órdenes totales/);
    assert.match(env.root.innerHTML,/Canceladas/);
    assert.equal(env.window.obtenerOrdenesDashboard().length,4);
    const resumen=env.window.DashboardRoles.obtenerResumenAdministrador(env.window.obtenerOrdenesDashboard());
    assert.equal(resumen.terminadas,1);
    assert.equal(resumen.canceladas,1);
    assert.equal(resumen.sinTecnico,2);
    assert.equal(resumen.atrasadas,0);
});
test('Dashboard elimina métricas anteriores si falla la consulta y permite recuperarse', async()=>{
    const env=dashboardEntorno();
    await env.callbacks.DOMContentLoaded();
    const listar=env.window.OrdenesSupabaseService.listarOrdenes;
    env.window.OrdenesSupabaseService.listarOrdenes=async()=>({ok:false,error:'Sin conexión'});
    await env.callbacks['ordenes:supabase-actualizadas']();
    assert.match(env.root.innerHTML,/reintentarDashboard/);
    assert.doesNotMatch(env.root.innerHTML,/executive-metric-card/);
    assert.equal(env.window.obtenerOrdenesDashboard().length,0);
    env.window.OrdenesSupabaseService.listarOrdenes=listar;
    await env.callbacks['ordenes:supabase-actualizadas']();
    assert.equal(env.window.obtenerOrdenesDashboard().length,4);
});
