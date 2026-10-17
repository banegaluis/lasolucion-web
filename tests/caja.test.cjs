const {test}=require('node:test');const assert=require('node:assert/strict');
const c=require('../crm/js/cajaCore.js');
test('Importes argentinos en pesos y centavos',()=>{assert.equal(c.monto('25.000,50'),25000.50);assert.equal(c.monto('0'),null);assert.equal(c.monto('-100'),null);assert.equal(c.monto('25.50'),null);});
test('Dictado de un gasto con unidad explícita',()=>{const d=c.interpretar('Hoy gasté 25 mil pesos en caños para García, en efectivo');assert.equal(d.monto,25000);assert.equal(d.tipo,'gasto');assert.equal(d.cuenta,'efectivo');});
test('No adivina unidades, negaciones ni múltiples operaciones',()=>{for(const s of ['Cobré 150 de García','No cobré 150 mil pesos','Me pagó 150 mil y me debe 80 mil'])assert.equal(c.interpretar(s).monto,null);});
test('Monto decimal y advertencia de fecha',()=>{const d=c.interpretar('Ayer pagué 1.250,50 pesos');assert.equal(d.monto,1250.50);assert.ok(d.avisos.some(a=>a.includes('fecha')));});
test('Cobrar una deuda no duplica ingresos; transferencias no son ingresos',()=>{const rows=[{id:'a',tipo:'por_cobrar',monto:80,fecha:'2026-09-01'},{tipo:'cobro',monto:30,deuda_id:'a',fecha:'2026-10-01'},{tipo:'transferencia',monto:100,fecha:'2026-10-01'},{tipo:'retiro',monto:10,fecha:'2026-10-01'},{tipo:'gasto',monto:5,fecha:'2026-10-01'}];const r=c.resumir(rows,'2026-10-01','2026-10-31');assert.equal(r.pendiente,50);assert.equal(r.cobro,30);assert.equal(r.flujo,15);});
const fs=require('node:fs'),vm=require('node:vm');
function servicio({admin=true,existing=false,fail=false}={}){
 let inserts=0;
 const client={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:existing?{id:'m1'}:null,error:null})})}),insert:()=>{inserts++;return {select:()=>({single:async()=>({data:fail?null:{id:'m1'},error:fail?{message:'falló'}:null})})};}})};
 const window={AuthSupabaseService:{verificarSesionOperativa:async()=>({ok:true,perfil:{rol:admin?'admin':'tecnico'}})},LaSolucionSupabase:{getClient:async()=>client}};
 vm.runInNewContext(fs.readFileSync('crm/js/services/cajaService.js','utf8'),{window});
 return {s:window.CajaService,inserts:()=>inserts};
}
test('Reintento de registro confirmado no vuelve a insertarlo',async()=>{const t=servicio({existing:true});await t.s.guardar({id:'m1'});assert.equal(t.inserts(),0);});
test('Rechaza técnico antes de consultar movimientos',async()=>{const t=servicio({admin:false});await assert.rejects(t.s.guardar({id:'m1'}),/administrador/);assert.equal(t.inserts(),0);});
test('Un error de guardado no se anuncia como éxito',async()=>{const t=servicio({fail:true});await assert.rejects(t.s.guardar({id:'m1'}),{message:'falló'});assert.equal(t.inserts(),1);});
