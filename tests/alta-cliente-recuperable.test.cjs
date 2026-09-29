const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../crm/js/services/clientesService.js'),'utf8');
const cliente={nombre_completo:'Persona Prueba',telefono_principal:'3511111111'};
const direccion={calle:'Calle Prueba',numero:'10'};
function entorno(){
    const db={clientes:new Map(),direcciones_clientes:new Map()},storage=new Map(),writes=[];
    const state={user:'usuario-a',fallo:null,updates:0};
    const client={supabaseUrl:'https://proyecto.invalid',from(table){
        const filters={};let payload,columns='';
        const q={select(s=''){columns=s;return this;},eq(k,v){filters[k]=v;return this;},order(){return this;},
            update(){state.updates++;throw new Error('No actualizar al recuperar');},
            insert(p){payload=p;return this;},
            then(resolve,reject){return Promise.resolve({data:[...db[table].values()].map(row=>({...row,direcciones_clientes:[]}))}).then(resolve,reject);},
            async maybeSingle(){
                if(state.fallo===`${table}:lectura`) throw new Error('Sin conexión');
                if(columns.includes('direcciones_clientes') && state.fallo==='final') throw new Error('Se perdió la lectura final');
                const row=[...db[table].values()].find(r=>Object.entries(filters).every(([k,v])=>r[k]===v));
                if(!row) return {data:null};
                return {data:columns.includes('direcciones_clientes')?{...row,direcciones_clientes:[...db.direcciones_clientes.values()].filter(d=>d.cliente_id===row.id)}:{...row}};
            },
            async single(){
                writes.push({table,payload});
                if(state.fallo===`${table}:rechazo`) return {error:{code:'42501',message:'Sin permiso'}};
                if(state.fallo===`${table}:antes`) throw new Error('Corte previo');
                if(db[table].has(payload.id)) return {error:{code:'23505'}};
                const data={...payload,nombre_completo:table==='clientes'?`${payload.nombre} ${payload.apellido||''}`.trim():undefined};
                db[table].set(data.id,data);
                if(state.fallo===`${table}:despues`) throw new Error('Respuesta perdida');
                return {data};
            }};return q;
    }};
    const window={AuthSupabaseService:{verificarSesionOperativa:async()=>({ok:Boolean(state.user),sesion:{session:{user:{id:state.user}}}})},LaSolucionSupabase:{getClient:async()=>client},crypto:{randomUUID},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
    function cargar(){vm.runInContext(source,vm.createContext({window,console}));return window.ClientesSupabaseService;}
    return {state,db,storage,writes,window,cargar,service:cargar()};
}
for(const fallo of ['clientes:antes','clientes:despues','direcciones_clientes:antes','direcciones_clientes:despues','final']){
    test(`Alta recuperable tras ${fallo}: un cliente y una dirección`,async()=>{
        const e=entorno();e.state.fallo=fallo;
        const first=await e.service.crearCliente(cliente,direccion);
        assert.equal(first.ok,false);assert.equal(first.pendiente,true);assert.equal(e.storage.size,1);
        e.state.fallo=null;
        const result=await e.cargar().crearCliente(cliente,direccion);
        assert.equal(result.ok,true);assert.equal(result.recuperada,true);
        assert.equal(e.db.clientes.size,1);assert.equal(e.db.direcciones_clientes.size,1);
        assert.equal(result.data.direcciones_clientes.length,1);assert.equal(e.storage.size,0);assert.equal(e.state.updates,0);
        for(const table of ['clientes','direcciones_clientes']) assert.equal(new Set(e.writes.filter(w=>w.table===table).map(w=>w.payload.id)).size,1);
    });
}
test('Cambiar datos requiere recuperar explícitamente el alta original',async()=>{
    const e=entorno();e.state.fallo='direcciones_clientes:antes';await e.service.crearCliente(cliente,direccion);
    e.state.fallo=null;
    const changed=await e.service.crearCliente({...cliente,nombre_completo:'Otra Persona'},{...direccion,numero:'20'},{omitirDuplicados:true});
    assert.equal(changed.ok,false);assert.equal(changed.altaPendiente.nombre,'Persona Prueba');assert.equal(e.db.clientes.size,1);
    const recovered=await e.service.crearCliente({},null,{recuperarPendiente:true});
    assert.equal(recovered.ok,true);assert.equal(recovered.data.nombre,'Persona');assert.equal(recovered.data.direcciones_clientes[0].numero,'10');
});
test('No confirma el cliente si se deniega guardar la dirección',async()=>{
    const e=entorno();e.state.fallo='direcciones_clientes:rechazo';
    const result=await e.service.crearCliente(cliente,direccion);
    assert.equal(result.ok,false);assert.equal(result.data,null);assert.equal(e.storage.size,1);assert.equal(e.db.clientes.size,1);assert.equal(e.db.direcciones_clientes.size,0);
});
test('Rechazo inicial del cliente permite corregir sin dejar envío incierto',async()=>{
    const e=entorno();e.state.fallo='clientes:rechazo';
    const result=await e.service.crearCliente(cliente,direccion);
    assert.equal(result.ok,false);assert.equal(result.pendiente,false);assert.equal(e.storage.size,0);
});
test('Almacenamiento bloqueado no permite iniciar ninguna escritura',async()=>{
    const e=entorno();e.window.sessionStorage.setItem=()=>{throw new Error('Bloqueado');};
    assert.equal((await e.service.crearCliente(cliente,direccion)).ok,false);assert.equal(e.writes.length,0);
});
test('Sin sesión no se escribe en la base ni en el almacenamiento',async()=>{
    const e=entorno();e.state.user=null;
    assert.equal((await e.service.crearCliente(cliente,direccion)).ok,false);assert.equal(e.writes.length,0);assert.equal(e.storage.size,0);
});
test('Otra cuenta no recupera el alta pendiente de la primera',async()=>{
    const e=entorno();e.state.fallo='clientes:antes';await e.service.crearCliente(cliente,direccion);
    e.state.user='usuario-b';e.state.fallo=null;
    assert.equal((await e.service.crearCliente({},null,{recuperarPendiente:true})).ok,false);assert.equal(e.writes.length,1);
    e.state.user='usuario-a';assert.equal((await e.service.crearCliente({},null,{recuperarPendiente:true})).ok,true);
});
test('Dos llamadas simultáneas no generan dos clientes',async()=>{
    const e=entorno();const results=await Promise.all([e.service.crearCliente(cliente,direccion),e.service.crearCliente(cliente,direccion)]);
    assert.equal(results.filter(r=>r.ok).length,1);assert.equal(e.db.clientes.size,1);assert.equal(e.db.direcciones_clientes.size,1);
});
test('Las altas nuevas siguen mostrando posibles duplicados',async()=>{
    const e=entorno();await e.service.crearCliente(cliente,direccion);
    const result=await e.service.crearCliente(cliente,direccion);
    assert.equal(result.ok,false);assert.equal(result.duplicados.length,1);assert.equal(e.db.clientes.size,1);
});
