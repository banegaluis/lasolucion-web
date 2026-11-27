// La intención extraída no sustituye el mensaje escrito del operador.
export function confirmacionExacta(mensaje, codigo, alta = false) {
 if (mensaje?.tipo !== 'texto' || typeof mensaje.texto !== 'string'
   || typeof codigo !== 'string' || !/^[0-9a-f]{8}$/.test(codigo)) return false;
 return mensaje.texto.trim().toLowerCase() === `confirmar ${alta ? 'alta ' : ''}${codigo}`;
}
