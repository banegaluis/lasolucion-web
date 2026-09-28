const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function entorno({ editar = false, falloEscritura = false, listar } = {}) {
    const id = '11111111-1111-4111-8111-111111111111';
    const avisos = [];
    const boton = { dataset: {}, textContent: 'Guardar orden', disabled: false };
    const campos = Object.fromEntries(Object.entries({cliente:'Prueba',telefono:'3511111111',fecha:'2099-10-01',hora:'10:00',trabajo:'Revisión',tecnicoId:'',estadoOrden:'pendiente'}).map(([k,value])=>[k,{value}]));
    campos.listaOrdenes = campos.historialOrdenes = { replaceChildren() {} };
    let escrituras = 0, cerrados = 0, limpiezas = 0;
    const guardar = async () => {
        escrituras++;
        return falloEscritura ? {ok:false,error:{message:'Fallo simulado'}} : {ok:true,data:{id,numero_orden:42}};
    };
    const ctx = vm.createContext({
        window:{OrdenesSupabaseService:{crearOrden:guardar,actualizarOrden:guardar,mapearOrden:x=>x,consultarConflictosHorario:async()=>({ok:true,data:[]}),listarOrdenes:listar || (async()=>({ok:true,data:[{id}]}))}},
        document:{addEventListener(){},getElementById:id=>campos[id] || null,querySelector:()=>boton},
        console:{error(){}},alert:msg=>avisos.push(msg),confirm:()=>true,
        limpiarFormularioOrden:()=>{limpiezas++; for(const k of ['cliente','telefono','trabajo']) campos[k].value='';},
        cerrarAgenda:()=>cerrados++
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../crm/js/ordenes.js'),'utf8'),ctx);
    ctx.obtenerDatosDireccion=()=>({direccion:'Dirección de prueba'});
    ctx.resolverClienteSupabaseParaOrden=async()=>({ok:true,clienteId:id});
    ctx.construirPayloadNuevaOrden=ctx.construirPayloadActualizacionOrden=()=>({titulo:'Revisión'});
    ctx.renderizarHistorialRealOrden=ctx.renderizarOrdenes=ctx.renderizarVacioOrdenes=ctx.actualizarResumenOrdenes=()=>{};
    ctx.mostrarErrorClienteOrden=msg=>avisos.push(msg);
    ctx.usuarioPuedeEditarOrden=()=>true;
    if(editar) vm.runInContext(`ordenEditando='${id}'; ordenesSupabaseState.porId.set('${id}',{fecha:'2099-10-01',hora:'10:00',tecnicoId:''});`,ctx);
    return {ctx,boton,avisos,campos,estado:()=>vm.runInContext('({guardando:clientesOrdenState.guardando,cargando:ordenesSupabaseState.cargando,editando:ordenEditando})',ctx),conteos:()=>({escrituras,cerrados,limpiezas})};
}
for(const editar of [false,true]) {
    for(const tipoFallo of ['rechazo','resultado']) {
        test(`${editar?'Editar':'Crear'}: una falla posterior de listado (${tipoFallo}) conserva el éxito y libera el formulario`,async()=>{
            const env=entorno({editar,listar:async()=>{if(tipoFallo==='rechazo') throw new Error('Sin red'); return {ok:false,error:{message:'Sin red'}};}});
            await env.ctx.guardarOrden();
            assert.deepEqual(env.conteos(),{escrituras:1,cerrados:1,limpiezas:1});
            assert.equal(env.estado().guardando,false);
            assert.equal(env.estado().cargando,false);
            assert.equal(env.estado().editando,null);
            assert.equal(env.boton.disabled,false);
            assert.match(env.avisos[0],editar?/actualizada correctamente/:/42 creada correctamente/);
            assert.match(env.avisos[0],/no vuelvas a crear/);
            await env.ctx.guardarOrden();
            assert.equal(env.conteos().escrituras,1);
            env.ctx.window.OrdenesSupabaseService.listarOrdenes=async()=>({ok:true,data:[]});
            assert.equal(await env.ctx.cargarOrdenes(),true);
        });
    }
}
test('Escritura fallida: mantiene los datos y no informa éxito',async()=>{
    const env=entorno({falloEscritura:true});
    await env.ctx.guardarOrden();
    assert.equal(env.campos.cliente.value,'Prueba');
    assert.equal(env.conteos().cerrados,0);
    assert.equal(env.conteos().limpiezas,0);
    assert.equal(env.estado().guardando,false);
    assert.doesNotMatch(env.avisos.join(' '),/correctamente/);
});
test('Un segundo envío durante la lectura posterior no repite la escritura',async()=>{
    let completar, lecturaIniciada;
    const inicio = new Promise(resolve=>lecturaIniciada=resolve);
    const env=entorno({listar:()=>{lecturaIniciada();return new Promise(resolve=>completar=resolve);}});
    const primero=env.ctx.guardarOrden();
    await inicio;
    assert.equal(env.boton.disabled,true);
    await env.ctx.guardarOrden();
    assert.equal(env.conteos().escrituras,1);
    completar({ok:true,data:[]});
    await primero;
    assert.equal(env.avisos[0],'Orden N.º 42 creada correctamente.');
    assert.equal(env.boton.disabled,false);
});
