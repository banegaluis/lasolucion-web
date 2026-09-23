let ordenEditando = null;

// ================= LOGIN =================

function login() {

    const user = document.getElementById("user").value;
    const pass = document.getElementById("pass").value;

    if (typeof autenticarUsuario !== "function" || typeof iniciarSesion !== "function") {
        document.getElementById("msg").textContent = "No se pudo iniciar sesión.";
        return;
    }

    const resultado = autenticarUsuario(user, pass);

    if (resultado.ok) {
        iniciarSesion(resultado.usuario);
        mostrarApp();
        return;
    }

    document.getElementById("msg").textContent = resultado.mensaje || "Usuario, email o contraseña incorrectos.";
}

async function logout() {

    if (typeof cerrarSesion === "function") {
        await cerrarSesion({ redirigir: false, cerrarSupabase: true });
    }

    location.reload();
}

window.onload = function () {

    if (typeof haySesionActiva === "function" && haySesionActiva()) {
        mostrarApp();
    }
};

function mostrarApp() {

    document.getElementById("loginView").style.display = "none";
    document.getElementById("appView").style.display = "block";

    cargarOrdenes();
}

// ================= AGENDA =================

function abrirAgenda() {

    document.getElementById("agenda").style.display = "flex";
}
function editarOrden(id) {

    let ordenes =
        JSON.parse(localStorage.getItem("ordenes")) || [];

    const orden =
        ordenes.find(o => o.id === id);

    if (!orden) return;

    ordenEditando = id;

    document.getElementById("cliente").value =
        orden.cliente;

    document.getElementById("telefono").value =
        orden.telefono;

    document.getElementById("direccion").value =
        orden.direccion;

    document.getElementById("fecha").value =
        orden.fecha;

    document.getElementById("hora").value =
        orden.hora;

    document.getElementById("trabajo").value =
        orden.trabajo;

    abrirAgenda();
}
function cerrarAgenda() {

    document.getElementById("agenda").style.display = "none";
}

// ================= GUARDAR =================

function guardarOrden() {

    let ordenes =
        JSON.parse(localStorage.getItem("ordenes")) || [];


    const datosOrden = {

        cliente: document.getElementById("cliente").value,
        telefono: document.getElementById("telefono").value,
        direccion: document.getElementById("direccion").value,
        fecha: document.getElementById("fecha").value,
        hora: document.getElementById("hora").value,
        trabajo: document.getElementById("trabajo").value
    };
    if (
    !datosOrden.cliente.trim() ||
    !datosOrden.telefono.trim() ||
    !datosOrden.direccion.trim() ||
    !datosOrden.fecha ||
    !datosOrden.hora ||
    !datosOrden.trabajo.trim()
) {
    alert("TenÃ©s que completar todos los datos.");
    return;
}


    // SI ESTAMOS EDITANDO
    if (ordenEditando) {

        ordenes = ordenes.map(orden => {

            if (orden.id === ordenEditando) {

                return {
                    ...orden,
                    ...datosOrden
                };

            }

            return orden;

        });

    } 
    
    // SI ES UNA ORDEN NUEVA
    else {

        const nuevaOrden = {

            id: Date.now(),

            ...datosOrden,

            estado: "pendiente",
            historial: false
        };


        ordenes.push(nuevaOrden);

    }


    localStorage.setItem(
        "ordenes",
        JSON.stringify(ordenes)
    );


    ordenEditando = null;

    document.getElementById("cliente").value = "";
    document.getElementById("telefono").value = "";
    document.getElementById("direccion").value = "";
    document.getElementById("fecha").value = "";
    document.getElementById("hora").value = "";
    document.getElementById("trabajo").value = "";

    cerrarAgenda();

    cargarOrdenes();

}

// ================= CAMBIAR ESTADO =================

function cambiarEstadoManual(id, nuevoEstado) {

    let ordenes =
        JSON.parse(localStorage.getItem("ordenes")) || [];

    ordenes = ordenes.map(o => {

        if (o.id === id) {

            o.estado = nuevoEstado;

            if (nuevoEstado === "terminado") {
                o.historial = true;
            }
        }

        return o;
    });

    localStorage.setItem(
        "ordenes",
        JSON.stringify(ordenes)
    );

    cargarOrdenes();
}

// ================= ELIMINAR =================

function eliminarOrden(id) {

    if (!confirm("Â¿Posta querÃ©s eliminar esta orden?")) {
        return;
    }

    let ordenes =
        JSON.parse(localStorage.getItem("ordenes")) || [];

    ordenes =
        ordenes.filter(o => o.id !== id);

    localStorage.setItem(
        "ordenes",
        JSON.stringify(ordenes)
    );

    cargarOrdenes();
}

// ================= WHATSAPP =================

function abrirWhatsApp(orden) {

    const mensaje =
        `Hola ${orden.cliente}`;

    const url =
        `https://wa.me/549${orden.telefono}?text=${encodeURIComponent(mensaje)}`;

    window.open(url, "_blank");
}

// ================= RENDER =================

function cargarOrdenes() {

    const lista =
        document.getElementById("listaOrdenes");

    const hist =
        document.getElementById("historialOrdenes");

    lista.innerHTML = "";
    hist.innerHTML = "";

    let ordenes =
        JSON.parse(localStorage.getItem("ordenes")) || [];

    ordenes.forEach(orden => {

        const card = document.createElement("div");
card.classList.add("card");

if (orden.estado === "pendiente") {
    card.classList.add("pendiente");
}

if (orden.estado === "en proceso") {
    card.classList.add("en-proceso");
}

if (orden.estado === "terminado") {
    card.classList.add("terminado");
}

        const cliente = document.createElement("p");
        cliente.textContent =
            "Cliente: " + orden.cliente;

        const tel = document.createElement("p");
        tel.textContent =
            "Tel: " + orden.telefono;

        tel.style.cursor = "pointer";
        tel.style.color = "#25D366";
        tel.title = "Abrir WhatsApp";
        tel.onclick = () =>
            abrirWhatsApp(orden);

        const direccion = document.createElement("p");

        direccion.textContent = "DirecciÃ³n: " + orden.direccion;

        direccion.style.cursor = "pointer";
        direccion.style.color = "#4285F4";
        direccion.title = "Abrir en Google Maps";

        direccion.onclick = () => abrirMaps(orden);

        const trabajo =
            document.createElement("p");

        trabajo.textContent =
            "Trabajo: " + orden.trabajo;
        const fecha = document.createElement("p");
        fecha.textContent = "Fecha: " + orden.fecha;

        const hora = document.createElement("p");
        hora.textContent = "Hora: " + orden.hora;

        const estadoLinha = document.createElement("div");
        estadoLinha.classList.add("estado-linha");

        const labelEstado = document.createElement("span");
        labelEstado.textContent = "Estado:";

        const estado = document.createElement("select");

        ["pendiente", "en proceso", "terminado"]
            .forEach(est => {

                const option =
                    document.createElement("option");

                option.value = est;
                option.textContent = est;

                if (orden.estado === est) {
                    option.selected = true;
                }

                estado.appendChild(option);
            });
function pintarEstado() {

    estado.classList.remove(
        "estado-pendiente",
        "estado-proceso",
        "estado-terminado"
    );

    if (estado.value === "pendiente") {
        estado.classList.add("estado-pendiente");
    }

    if (estado.value === "en proceso") {
        estado.classList.add("estado-proceso");
    }

    if (estado.value === "terminado") {
        estado.classList.add("estado-terminado");
    }
}

        pintarEstado();
        estado.onchange = () => {

            cambiarEstadoManual(
                orden.id,
                estado.value
            );
        };

        const acciones =
            document.createElement("div");

        acciones.classList.add("acciones");

        const btnEdit =
        document.createElement("button");

        btnEdit.textContent = "Editar";

        btnEdit.onclick = () => {
        editarOrden(orden.id);
        };

        const btnDelete =
            document.createElement("button");

        btnDelete.textContent = "Eliminar";

        btnDelete.onclick = () =>
            eliminarOrden(orden.id);

        acciones.appendChild(btnEdit);
        acciones.appendChild(btnDelete);

        card.appendChild(cliente);
        card.appendChild(tel);
        card.appendChild(direccion);
        card.appendChild(fecha);
        card.appendChild(hora);
        card.appendChild(trabajo);
        card.appendChild(labelEstado);
        card.appendChild(estado);
        card.appendChild(acciones);

        if (orden.historial) {
            hist.appendChild(card);
        } else {
            lista.appendChild(card);
        }
    });
}
function abrirWhatsApp(orden) {

    const mensaje = `Hola ${orden.cliente}, te escribo de LaSoluciÃ³n por el trabajo programado para el dÃ­a ${orden.fecha} a las ${orden.hora}.`;

    const telefono = orden.telefono.replace(/\D/g, "");

    const url = `https://wa.me/54${telefono}?text=${encodeURIComponent(mensaje)}`;

    window.open(url, "_blank");

}

function abrirMaps(orden) {

    let direccion = orden.direccion.trim();

    // Si no escribiÃ³ CÃ³rdoba, la agregamos automÃ¡ticamente
    if (!direccion.toLowerCase().includes("cÃ³rdoba")) {
        direccion += ", CÃ³rdoba, Argentina";
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;

    window.open(url, "_blank");

}

function obtenerFechaHoy() {

    const hoy = new Date();

    const dia = String(hoy.getDate()).padStart(2, "0");

    const mes = String(hoy.getMonth() + 1).padStart(2, "0");

    const anio = hoy.getFullYear();

    return `${dia}/${mes}/${anio}`;

}
