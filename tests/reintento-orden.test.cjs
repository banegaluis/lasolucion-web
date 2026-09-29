const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../crm/js/services/ordenesService.js'),'utf8');
const payload={cliente_id:'cliente-prueba',titulo:'Revisar calefón',fecha_programada:'2099-10-01'};
function entorno() {
    const storage=new Map(), rows=new Map(), attempts=[];
    const state={user:'usuario-a',mode:'normal',readError:false};
    const client={supabaseUrl:'https://proyecto.invalid',auth:{getSession:async()=>({data:{session:state.user?{user:{id:state.user}}:null}})},from(){
        let inserted, filters={};
        const query={select(){return this;},eq(k,v){filters[k]=v;return this;},insert(p){inserted=p;return this;},
            async maybeSingle(){
                if(state.readError) return {error:{message:'Sin lectura'}};
                let row=rows.get(filters.id);
                if(state.mode==='carrera' && !row) {
                    rows.set(filters.id,{...JSON.parse([...storage.values()][0]).payload,id:filters.id,numero_orden:17});
                    return {data:null};
                }
                return {data:row?.created_by===filters.created_by?row:null};
            },
            async single(){
                attempts.push(inserted);
                if(state.mode==='rechazo') return {error:{code:'42501',message:'No autorizado'}};
                if(rows.has(inserted.id)) return {error:{code:'23505',message:'Clave duplicada'}};
                if(state.mode==='sin-envio') throw new Error('Corte antes de llegar');
                const row={...inserted,numero_orden:17}; rows.set(row.id,row);
                if(state.mode==='respuesta-perdida') throw new Error('Corte después de guardar');
                return {data:row};
            }};return query;
    }};
    const window={LaSolucionSupabase:{getClient:async()=>client},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:{randomUUID},dispatchEvent(){}};
    function cargar(){const context=vm.createContext({window,CustomEvent:class{},console});vm.runInContext(source,context);return window.OrdenesSupabaseService;}
    return {state,storage,rows,attempts,window,cargar,service:cargar()};
}
test('Respuesta perdida y recarga: recuperar devuelve la misma fila sin repetir INSERT',async()=>{
    const e=entorno();e.state.mode='respuesta-perdida';
    assert.equal((await e.service.crearOrden(payload)).ok,false);
    assert.equal(e.rows.size,1);assert.equal(e.storage.size,1);
    e.state.mode='normal';const service=e.cargar();
    const pending=await service.obtenerCreacionPendiente();
    const result=await service.crearOrden(pending.data);
    assert.equal(result.ok,true);assert.equal(result.recuperada,true);
    assert.equal(e.attempts.length,1);assert.equal(e.rows.size,1);assert.equal(e.storage.size,0);
});
test('Corte antes de llegar: reintenta exactamente el mismo UUID y payload',async()=>{
    const e=entorno();e.state.mode='sin-envio';await e.service.crearOrden(payload);
    e.state.mode='normal';const result=await e.service.crearOrden(payload);
    assert.equal(result.ok,true);assert.equal(e.rows.size,1);
    assert.deepEqual(e.attempts[0],e.attempts[1]);
});
test('Conflicto de clave en carrera: consulta la fila confirmada y no la actualiza',async()=>{
    const e=entorno();e.state.mode='sin-envio';await e.service.crearOrden(payload);
    e.state.mode='carrera';const result=await e.service.crearOrden(payload);
    assert.equal(result.ok,true);assert.equal(result.recuperada,true);assert.equal(e.rows.size,1);
    assert.equal(e.attempts[0].id,e.attempts[1].id);
});
test('No acepta cambiar datos de un envío incierto ni generar otro UUID',async()=>{
    const e=entorno();e.state.mode='respuesta-perdida';await e.service.crearOrden(payload);
    const result=await e.service.crearOrden({...payload,titulo:'Otro trabajo'});
    assert.equal(result.ok,false);assert.equal(result.pendiente,true);assert.equal(e.attempts.length,1);
});
test('Cuenta distinta no ve ni reintenta el envío pendiente de otra cuenta',async()=>{
    const e=entorno();e.state.mode='respuesta-perdida';await e.service.crearOrden(payload);
    e.state.user='usuario-b';assert.equal((await e.service.obtenerCreacionPendiente()).data,null);
    e.state.mode='normal';assert.equal((await e.service.crearOrden(payload)).ok,true);
    assert.equal(e.rows.size,2);assert.equal(e.storage.size,1);
    e.state.user='usuario-a';assert.equal((await e.service.crearOrden(payload)).recuperada,true);
});
test('Sin sesión no lee ni escribe el registro o la base',async()=>{
    const e=entorno();e.state.user=null;
    assert.equal((await e.service.crearOrden(payload)).ok,false);
    assert.equal((await e.service.obtenerCreacionPendiente()).ok,false);
    assert.equal(e.attempts.length,0);assert.equal(e.storage.size,0);
});
test('Almacenamiento bloqueado: no se envía una orden sin recuperación posible',async()=>{
    const e=entorno();e.window.sessionStorage.setItem=()=>{throw new Error('Almacenamiento bloqueado');};
    assert.equal((await e.service.crearOrden(payload)).ok,false);assert.equal(e.attempts.length,0);
});
test('Registro corrupto bloquea nuevas escrituras sin borrarlo',async()=>{
    const e=entorno();e.state.mode='sin-envio';await e.service.crearOrden(payload);
    e.storage.set([...e.storage.keys()][0],'{inválido');
    assert.equal((await e.service.crearOrden(payload)).ok,false);assert.equal(e.attempts.length,1);assert.equal(e.storage.size,1);
});
test('Rechazo SQL inicial permite corregir sin declarar éxito',async()=>{
    const e=entorno();e.state.mode='rechazo';
    const result=await e.service.crearOrden(payload);
    assert.equal(result.ok,false);assert.equal(e.storage.size,0);assert.equal(e.rows.size,0);
});
test('Lectura fallida durante recuperación no inicia otra escritura',async()=>{
    const e=entorno();e.state.mode='sin-envio';await e.service.crearOrden(payload);
    e.state.readError=true;
    assert.equal((await e.service.crearOrden(payload)).ok,false);assert.equal(e.attempts.length,1);assert.equal(e.storage.size,1);
});
test('UUID y creador suministrados por el llamador no reemplazan los del envío',async()=>{
    const e=entorno();const result=await e.service.crearOrden({...payload,id:'forzado',created_by:'otra-cuenta'});
    assert.equal(result.ok,true);assert.notEqual(result.data.id,'forzado');assert.equal(result.data.created_by,'usuario-a');
});
test('Dos llamadas concurrentes conservan una sola fila',async()=>{
    const e=entorno();const results=await Promise.all([e.service.crearOrden(payload),e.service.crearOrden(payload)]);
    assert.ok(results.every(r=>r.ok));assert.equal(e.rows.size,1);
    assert.equal(new Set(e.attempts.map(p=>p.id)).size,1);
});
