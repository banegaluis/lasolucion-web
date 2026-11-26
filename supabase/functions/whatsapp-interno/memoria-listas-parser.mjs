// Prototipo puro para revisión. No ejecuta escrituras ni envía mensajes; no está conectado al receptor.
export function interpretarLista(texto){
 const s=String(texto??'').trim().replace(/^laso[,:]?\s+/i,'').replace(/[.!?]+$/,'').trim();
 const clave=x=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
 const t=clave(s).replace(/^¿/,'');
 if(/^(mis listas|mostrar mis listas|mostrame mis listas|que listas tengo|ver listas)$/.test(t))return {accion:'listar'};
 if(/^(ayuda listas|ayuda de listas|memoria de laso)$/.test(t))return {accion:'ayuda'};
 let m,accion,nombre,items=[],indice=null,pagina=1;
 if((m=s.match(/^(?:cre[aá](?:me|r)?|arm[aá](?:me|r)?|guard[aá](?:me|r)?)\s+(?:una\s+)?lista\s+(?:de\s+)?([^:]+?)(?::\s*([\s\S]+))?$/i))){accion='crear';nombre=m[1];items=(m[2]||'').split(/[;\n]|,(?!\d)/).map(x=>x.trim()).filter(Boolean);}
 else if((m=s.match(/^(?:agreg[aá](?:le|r)?|sum[aá](?:le|r)?)\s+(?:a\s+)?(?:la\s+)?lista\s+([^:]+):\s*([\s\S]+)$/i))){accion='agregar';nombre=m[1];items=m[2].split(/[;\n]|,(?!\d)/).map(x=>x.trim()).filter(Boolean);}
 else if((m=s.match(/^(?:ver|mostr[aá](?:me|r)?|consult[aá](?:me|r)?|d[aá]me)\s+(?:la\s+)?lista\s+(?:de\s+)?(.+?)(?:\s+p[aá]gina\s+(\d+))?$/i))){accion='ver';nombre=m[1];pagina=+(m[2]||1);}
 else if((m=s.match(/^(?:marc[aá](?:r)?\s+(?:como\s+)?)?(comprado|pendiente|quitar|quit[aá]|sac[aá])\s+(?:el\s+)?(?:[ií]tem\s+)?(\d+)\s+(?:de\s+)?(?:la\s+)?lista\s+(.+)$/i))){accion=/^comprado$/i.test(m[1])?'comprado':/^pendiente$/i.test(m[1])?'pendiente':'quitar';indice=+m[2];nombre=m[3];}
 else return null;
 nombre=nombre.trim().replace(/^materiales\s+para\s+/i,'Materiales ');
 if(!nombre||nombre.length>120||items.length>40||items.some(x=>x.length>240)||!Number.isSafeInteger(pagina)||pagina<1||pagina>150||(indice!==null&&(!Number.isSafeInteger(indice)||indice<1||indice>150)))return {accion:'invalido'};
 return {accion,nombre,clave:clave(nombre),items,indice,pagina};
}
