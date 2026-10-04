(function (raiz) {
    "use strict";

    const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

    function sinAcentos(valor) {
        return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    function fechaISO(fecha) {
        return [fecha.getFullYear(), String(fecha.getMonth() + 1).padStart(2, "0"), String(fecha.getDate()).padStart(2, "0")].join("-");
    }

    function sumarDias(base, cantidad) {
        const fecha = new Date(base.getFullYear(), base.getMonth(), base.getDate());
        fecha.setDate(fecha.getDate() + cantidad);
        return fecha;
    }

    function extraerFecha(texto, ahora) {
        const normal = sinAcentos(texto).toLowerCase();
        if (/\bpasado manana\b/.test(normal)) return fechaISO(sumarDias(ahora, 2));
        if (/\bmanana\b/.test(normal.replace(/\bde\s+la\s+manana\b/g, ""))) return fechaISO(sumarDias(ahora, 1));
        if (/\bhoy\b/.test(normal)) return fechaISO(ahora);

        const numerica = normal.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
        if (numerica) {
            let anio = numerica[3] ? Number(numerica[3]) : ahora.getFullYear();
            if (anio < 100) anio += 2000;
            const fecha = new Date(anio, Number(numerica[2]) - 1, Number(numerica[1]));
            if (fecha.getFullYear() === anio && fecha.getMonth() === Number(numerica[2]) - 1 && fecha.getDate() === Number(numerica[1])) return fechaISO(fecha);
        }

        const indice = DIAS.findIndex(dia => new RegExp(`\\b${dia}\\b`).test(normal));
        if (indice >= 0) {
            let distancia = (indice - ahora.getDay() + 7) % 7;
            if (distancia === 0) distancia = 7;
            return fechaISO(sumarDias(ahora, distancia));
        }
        return "";
    }

    function extraerHora(texto) {
        const normal = sinAcentos(texto).toLowerCase();
        const coincidencia = normal.match(/\b(\d{1,2})(?:(?::|\s+y\s+)(\d{1,2}))?\s+de\s+la\s+(manana|tarde|noche)\b/) || normal.match(/\ba\s+las?\s+(\d{1,2})(?:(?::|\s+y\s+)(\d{1,2}))?\b/) || normal.match(/\b(\d{1,2})(?::(\d{2}))\s*(?:hs?|horas?)?\b/);
        if (!coincidencia) return "";
        let hora = Number(coincidencia[1]);
        const minutos = Number(coincidencia[2] || 0);
        if (coincidencia[3]) {
            if (hora < 1 || hora > 12) return "";
            if (coincidencia[3] === "manana" && hora === 12) hora = 0;
            if (coincidencia[3] !== "manana" && hora < 12) hora += 12;
        }
        if (hora > 23 || minutos > 59) return "";
        return `${String(hora).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
    }

    function limpiarSegmentosTemporales(texto) {
        return String(texto || "")
            .replace(/\b(?:a\s+las?\s+)?\d{1,2}(?:(?::|\s+y\s+)\d{1,2})?\s+de\s+la\s+(?:mañana|manana|tarde|noche)\b/gi, " ")
            .replace(/\b(?:el\s+)?(?:pasado\s+mañana|mañana|hoy|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b/gi, " ")
            .replace(/\b(?:el\s+)?\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/g, " ")
            .replace(/\ba\s+las?\s+\d{1,2}(?:(?::|\s+y\s+)\d{1,2})?\b/gi, " ")
            .replace(/\b\d{1,2}:\d{2}\s*(?:hs?|horas?)?\b/gi, " ")
            .replace(/\s+/g, " ").trim();
    }

    function interpretar(texto, ahora = new Date()) {
        const limpio = limpiarSegmentosTemporales(texto);
        const separacion = limpio.match(/^(.+?)\s+para\s+(.+)$/i);
        const tareaMarcada = limpio.match(/\btarea\s+(.+?)(?=\s+cliente\s+|$)/i);
        const clienteMarcado = limpio.match(/\bcliente\s+(.+?)(?=\s+tarea\s+|$)/i);
        const visita = limpio.match(/^(?:hay\s+que\s+)?ir\s+al\s+local\s+de(?:l)?\s+(.+?)(?:\s+en\s+(.+))?$/i);
        const datos = {
            tarea: (tareaMarcada?.[1] || separacion?.[1] || (visita ? `Ir al local${visita[2] ? ` en ${visita[2]}` : ""}` : "")).trim(),
            cliente: (clienteMarcado?.[1] || separacion?.[2] || visita?.[1] || "").trim(),
            fecha: extraerFecha(texto, ahora),
            hora: extraerHora(texto)
        };
        datos.faltantes = ["tarea", "cliente", "fecha", "hora"].filter(campo => !datos[campo]);
        return datos;
    }

    function iniciarInterfaz() {
        const $ = id => document.getElementById(id);
        const modal = $("agendaVozModal");
        const botonAbrir = $("btnVozAgenda");
        if (!modal || !botonAbrir) return;
        let reconocimiento = null;

        function estado(texto, error = false) {
            const nodo = $("agendaVozEstado");
            nodo.textContent = texto || "";
            nodo.classList.toggle("is-error", error);
        }

        function actualizar(datos) {
            if (datos.tarea) $("agendaVozTarea").value = datos.tarea;
            if (datos.cliente) $("agendaVozCliente").value = datos.cliente;
            if (datos.fecha) $("agendaVozFecha").value = datos.fecha;
            if (datos.hora) $("agendaVozHora").value = datos.hora;
            estado(datos.faltantes.length ? `Falta completar: ${datos.faltantes.join(", ")}.` : "Borrador completo. Revisalo antes de continuar.", Boolean(datos.faltantes.length));
        }

        function abrir() {
            if (typeof raiz.puedeCrearOrdenDesdeAgenda === "function" && !raiz.puedeCrearOrdenDesdeAgenda()) return;
            modal.hidden = false;
            document.body.classList.add("modal-scroll-locked");
            estado("Dictá o escribí los cuatro datos obligatorios.");
            $("agendaVozTexto").focus();
        }

        function cerrar() {
            reconocimiento?.abort?.();
            modal.hidden = true;
            document.body.classList.remove("modal-scroll-locked");
        }

        function escuchar() {
            const Reconocimiento = raiz.SpeechRecognition || raiz.webkitSpeechRecognition;
            if (!Reconocimiento) {
                estado("Este navegador no permite dictado directo. Podés usar el micrófono del teclado y pegar el texto acá.", true);
                $("agendaVozTexto").focus();
                return;
            }
            reconocimiento = new Reconocimiento();
            reconocimiento.lang = "es-AR";
            reconocimiento.interimResults = false;
            reconocimiento.maxAlternatives = 1;
            reconocimiento.onstart = () => estado("Escuchando… Decí tarea, cliente, fecha y hora.");
            reconocimiento.onerror = () => estado("No pude escuchar el dictado. Intentá otra vez o escribilo.", true);
            reconocimiento.onresult = evento => {
                const texto = evento.results[0][0].transcript;
                $("agendaVozTexto").value = texto;
                actualizar(interpretar(texto));
            };
            reconocimiento.start();
        }

        function revisar() {
            const datos = {
                tarea: $("agendaVozTarea").value.trim(), cliente: $("agendaVozCliente").value.trim(),
                fecha: $("agendaVozFecha").value, hora: $("agendaVozHora").value
            };
            const faltantes = Object.entries(datos).filter(([, valor]) => !valor).map(([campo]) => campo);
            if (faltantes.length) { estado(`Falta completar: ${faltantes.join(", ")}.`, true); return; }
            const resultado = raiz.abrirBorradorOrdenVoz?.(datos);
            if (!resultado?.ok) { estado(resultado?.mensaje || "No se pudo preparar la orden.", true); return; }
            cerrar();
        }

        botonAbrir.addEventListener("click", abrir);
        $("btnCerrarAgendaVoz").addEventListener("click", cerrar);
        $("btnCancelarAgendaVoz").addEventListener("click", cerrar);
        modal.querySelector("[data-close-agenda-voz]").addEventListener("click", cerrar);
        $("btnEscucharAgendaVoz").addEventListener("click", escuchar);
        $("agendaVozTexto").addEventListener("input", evento => actualizar(interpretar(evento.target.value)));
        $("agendaVozTexto").addEventListener("change", evento => actualizar(interpretar(evento.target.value)));
        $("btnRevisarAgendaVoz").addEventListener("click", revisar);
    }

    const api = { interpretar, extraerFecha, extraerHora };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    raiz.AgendaVoz = api;
    if (typeof document !== "undefined") {
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciarInterfaz);
        else iniciarInterfaz();
    }
})(typeof window !== "undefined" ? window : globalThis);
