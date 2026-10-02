const { test } = require('node:test');
const assert = require('node:assert/strict');
const base = { nombre:'Prueba', apellido:'Interna', email:'prueba@example.invalid', password:'UnaClaveDePrueba123', rol:'colaborador', estado:'activo' };
function cliente({rol='admin', activo=true, profileError=false, createError=null, recovered=null, rpcError=null}={}) {
  const calls=[];
  const admin={calls, auth:{getUser:async()=>({data:{user:{id:'actor'}}}),admin:{
    createUser:async d=>{calls.push(['create',d]);return {data:{user:createError?null:{id:'nuevo'}},error:createError};},
    listUsers:async()=>({data:{users:recovered?[recovered]:[]}}),
    getUserById:async()=>({data:{user:{id:'nuevo',email:base.email}}})
  }},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{rol,estado:'activo',activo},error:profileError})})})}),rpc:async(name,args)=>{calls.push(['rpc',args]);return {error:rpcError};}};
  return admin;
}
async function run(admin, body, token='real-token') {
  const {crearHandler}=await import('../supabase/functions/usuarios-admin/handler.mjs');
  const req=new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
  const res=await crearHandler(admin)(req);return {status:res.status,body:await res.json()};
}
const requestId='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
test('rechaza anónimo antes de crear cuentas',async()=>{const a=cliente();assert.equal((await run(a,{action:'create',usuario:base},null)).status,401);assert.equal(a.calls.length,0);});
test('rechaza colaborador, técnico, cliente y admin inactivo',async()=>{for(const opts of [{rol:'colaborador'},{rol:'tecnico'},{rol:'cliente'},{activo:false},{profileError:true}]) {const a=cliente(opts);assert.equal((await run(a,{action:'create',usuario:base})).status,403);assert.equal(a.calls.length,0);}});
test('rechaza alta de clientes aun con administrador',async()=>{const a=cliente();assert.equal((await run(a,{action:'create',usuario:{...base,rol:'cliente'},requestId})).status,400);assert.equal(a.calls.length,0);});
test('alta real confirma solo después de crear perfil',async()=>{const a=cliente();const r=await run(a,{action:'create',usuario:base,requestId});assert.equal(r.status,200);assert.equal(a.calls[0][0],'create');assert.equal(a.calls[1][0],'rpc');assert.equal(a.calls[1][1].p_actor,'actor');assert.equal(a.calls[1][1].p_id,'nuevo');assert.equal(JSON.stringify(r).includes(base.password),false);});
test('perfil fallido no informa éxito',async()=>{const a=cliente({rpcError:{message:'db'}});assert.equal((await run(a,{action:'create',usuario:base,requestId})).status,503);});
test('duplicado ajeno no se adopta ni cambia contraseña',async()=>{const a=cliente({createError:{code:'email_exists'},recovered:{id:'otro',email:base.email,app_metadata:{crm_alta_id:requestId,crm_creado_por:'otro-admin'}}});assert.equal((await run(a,{action:'create',usuario:base,requestId})).status,409);assert.equal(a.calls.length,1);});
test('reintento propio recupera el perfil sin otra contraseña',async()=>{const a=cliente({createError:{code:'email_exists'},recovered:{id:'original',email:base.email,app_metadata:{crm_alta_id:requestId,crm_creado_por:'actor'}}});const r=await run(a,{action:'create',usuario:base,requestId});assert.equal(r.status,200);assert.equal(r.body.recuperado,true);assert.equal(a.calls[1][1].p_id,'original');});
test('no admite cambio de contraseña por edición',async()=>{const a=cliente();assert.equal((await run(a,{action:'update',usuario:{...base,id:'otro'}})).status,400);assert.equal(a.calls.length,0);});
