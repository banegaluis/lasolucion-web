(function () {
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    if (currentPage === "index.html") return;

    function ensureLayoutStylesheet() {
        if (document.querySelector('link[href*="css/layout.css"]')) return;
        const stylesheet = document.createElement("link");
        stylesheet.rel = "stylesheet";
        stylesheet.href = "css/layout.css?v=20260719-2";
        document.head.appendChild(stylesheet);
    }

    ensureLayoutStylesheet();

const navIcons = {
        inicio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5v8A1.5 1.5 0 0 1 18.5 20H15v-5.2H9V20H5.5A1.5 1.5 0 0 1 4 18.5v-8Z"/></svg>',
        agenda: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4.5 9h15M6 5h12a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 18 19H6a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 6 5Z"/></svg>',
        ordenes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10M7 8h10M6 12h12M6 16h8M5 3.5h14a1.5 1.5 0 0 1 1.5 1.5v14A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5Z"/></svg>',
        clientes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.8 19a4.8 4.8 0 0 1 9.4 0M16 11.2a2.5 2.5 0 1 0 0-5M14.8 14.2A4.3 4.3 0 0 1 20.2 19"/></svg>',
        tecnicos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 11.5a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6ZM5 20a7 7 0 0 1 14 0"/></svg>',
        usuarios: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0"/><path d="M18.5 8v4M16.5 10h4"/></svg>',
        mensajes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 18H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 6Z"/><path d="m5 8 7 5 7-5"/></svg>',
        estadisticas: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5h16M7 16v-5M12 16V6M17 16V9"/></svg>',
        configuracion: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"/><path d="M19.3 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.4 1a7.4 7.4 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.6A7.4 7.4 0 0 0 7 6.6l-2.4-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.4-1a7.4 7.4 0 0 0 2.6 1.5l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 2.6-1.5l2.4 1 2-3.4-2.1-1.5Z"/></svg>'
    };

    const navigationItems = [
        { href: "dashboard.html", label: "Inicio", icon: navIcons.inicio, permission: ["dashboard.verGeneral", "dashboard.verOperativo", "dashboard.verTecnico", "dashboard.verCliente", "dashboard.verClientePendiente"] },
        { href: "agenda.html", label: "Agenda", icon: navIcons.agenda, permission: ["agenda.verCompleta", "agenda.verPropia"] },
        { href: "ordenes.html", label: "Órdenes", icon: navIcons.ordenes, permission: ["ordenes.verTodas", "ordenes.verAsignadas"] },
        { href: "clientes.html", label: "Clientes", icon: navIcons.clientes, permission: "clientes.verTodos" },
        { href: "tecnicos.html", label: "Técnicos", icon: navIcons.tecnicos, permission: "tecnicos.ver" },
        { href: "usuarios.html", label: "Usuarios", icon: navIcons.usuarios, permission: "usuarios.ver" },
        { href: "mensajes.html", label: "Mensajes", icon: navIcons.mensajes, permission: "mensajes.ver" },
        { href: "estadisticas.html", label: "Estadísticas", icon: navIcons.estadisticas, permission: "estadisticas.verGenerales" },
        { href: "configuracion.html", label: "Configuración", icon: navIcons.configuracion, permission: "configuracion.ver" }
    ];

    function userCan(permission) {
        if (!permission) return true;
        if (Array.isArray(permission)) return typeof window.tieneAlgunPermiso === "function" && window.tieneAlgunPermiso(permission);
        return typeof window.tienePermiso === "function" && window.tienePermiso(permission);
    }

    function getVisibleNavigationItems() {
        const usuario = typeof window.obtenerUsuarioActual === "function" ? window.obtenerUsuarioActual() : null;
        return navigationItems.filter(item => userCan(item.permission)).map(item => {
            if (usuario?.rol === "tecnico" && item.href === "ordenes.html") return { ...item, label: "Mis órdenes" };
            if (usuario?.rol === "tecnico" && item.href === "agenda.html") return { ...item, label: "Agenda propia" };
            return item;
        });
    }

    function getUserName() {
        if (typeof window.obtenerUsuarioActual !== "function") return "admin";

        const user = window.obtenerUsuarioActual();
        return user && user.nombre ? user.nombre : "admin";
    }

    function getUserRoleLabel() {
        const user = typeof window.obtenerUsuarioActual === "function" ? window.obtenerUsuarioActual() : null;
        const labels = { administrador: "Administrador", colaborador: "Colaborador", tecnico: "Técnico", cliente: "Cliente", cliente_pendiente: "Cliente pendiente" };
        return labels[String(user?.rol || "").toLowerCase()] || "Usuario";
    }

    function formatClock(date) {
        return date.toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        });
    }

    function formatTopbarDate(date) {
        return date.toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
    }

    function startClock() {
        const clock = document.querySelector(".app-clock");
        if (!clock) return;

        const updateClock = () => {
            const now = new Date();
            clock.innerHTML = '<strong class="app-clock-time">' + formatClock(now) + '</strong><span class="app-clock-date">' + formatTopbarDate(now) + '</span>';
        };

        updateClock();
        window.setInterval(updateClock, 1000);
    }
    function getNotificationCount() {
        if (!userCan("usuarios.ver") || typeof window.obtenerUsuarios !== "function") return 0;
        const usuarios = window.obtenerUsuarios();
        if (!Array.isArray(usuarios)) return 0;
        return usuarios.filter(usuario => usuario.estado === "pendiente" || usuario.rol === "cliente_pendiente").length;
    }

    function setSidebarState(isOpen) {
        document.body.classList.toggle("sidebar-open", isOpen);
        const bloquearScroll = isOpen && window.matchMedia("(max-width: 900px)").matches;
        document.body.classList.toggle("layout-scroll-locked", bloquearScroll);
        document.documentElement.classList.toggle("layout-scroll-locked", bloquearScroll);

        const toggle = document.querySelector(".app-menu-toggle");
        if (toggle) {
            toggle.setAttribute("aria-expanded", String(isOpen));
            toggle.setAttribute("aria-label", isOpen ? "Cerrar menú principal" : "Abrir menú principal");
        }
    }

    function closeSidebar() {
        setSidebarState(false);
    }

    function toggleSidebar() {
        setSidebarState(!document.body.classList.contains("sidebar-open"));
    }

    function handleOutsideSidebarClick(event) {
        if (!document.body.classList.contains("sidebar-open")) return;

        const sidebar = document.querySelector(".app-sidebar");
        const toggle = document.querySelector(".app-menu-toggle");
        const target = event.target;

        if (sidebar && sidebar.contains(target)) return;
        if (toggle && toggle.contains(target)) return;

        closeSidebar();
    }

    function normalizeSearchText(value) {
        return String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\u00f1/g, "n");
    }

    function getStoredOrdersForSearch() {
        if (typeof window.obtenerOrdenesVisibles === "function") return window.obtenerOrdenesVisibles();
        if (typeof window.obtenerOrdenes === "function") return window.obtenerOrdenes();

        try {
            const data = JSON.parse(localStorage.getItem("ordenes") || "[]");
            return Array.isArray(data) ? data : [];
        }
        catch (error) {
            return [];
        }
    }

    function buildSearchIndex() {
        const actions = [
            { type: "Función", title: "+ NUEVA ORDEN", description: "Crear una orden de trabajo", href: "agenda.html#nueva-orden", keywords: "crear nueva orden trabajo cargar" },
            { type: "Módulo", title: "Inicio", description: "Dashboard principal", href: "dashboard.html", keywords: "inicio dashboard métricas resumen" },
            { type: "M\u00f3dulo", title: "\u00d3rdenes", description: "Ver \u00f3rdenes activas e historial", href: "ordenes.html", keywords: "ordenes \u00f3rdenes trabajos historial activas" },
            { type: "M\u00f3dulo", title: "Agenda", description: "Calendario de trabajos", href: "agenda.html", keywords: "agenda calendario turnos semana mes dia a\u00f1o" },
            { type: "Módulo", title: "Clientes", description: "Gestión de clientes", href: "clientes.html", keywords: "clientes nombres telefonos" },
            { type: "M\u00f3dulo", title: "T\u00e9cnicos", description: "Gesti\u00f3n de t\u00e9cnicos", href: "tecnicos.html", keywords: "tecnicos t\u00e9cnicos asignados colaboradores" },
            { type: "Módulo", title: "Mensajes", description: "Centro de mensajes", href: "mensajes.html", keywords: "mensajes whatsapp comunicacion" },
            { type: "Módulo", title: "Estadísticas", description: "Indicadores y reportes", href: "estadisticas.html", keywords: "estadisticas reportes métricas indicadores" },
            { type: "Módulo", title: "Configuración", description: "Ajustes del sistema", href: "configuracion.html", keywords: "configuracion ajustes sistema" }
        ].filter(item => {
            if (item.href === "agenda.html#nueva-orden") return userCan("ordenes.crear") && (userCan("agenda.verCompleta") || userCan("agenda.verPropia"));
            const page = item.href.split("#")[0].split("?")[0];
            const navItem = navigationItems.find(nav => nav.href === page);
            return !navItem || userCan(navItem.permission);
        });

        const orders = getStoredOrdersForSearch().map(order => ({
            type: "Orden",
            title: order.cliente || "Cliente sin nombre",
            description: [order.trabajo, order.direccion, order.telefono].filter(Boolean).join(" ? "),
            href: "agenda.html?orden=" + encodeURIComponent(order.id || ""),
            keywords: [order.cliente, order.telefono, order.direccion, order.trabajo, order.descripcion, order.tecnicoNombre, order.categoria, order.estado].join(" ")
        }));

        return actions.concat(orders).map(item => ({
            ...item,
            searchText: normalizeSearchText([item.type, item.title, item.description, item.keywords].join(" "))
        }));
    }

    function escapeSearchHtml(value) {
        return String(value || "").replace(/[&<>'"]/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            '"': "&quot;"
        }[char]));
    }

    function getSearchWords(value) {
        return normalizeSearchText(value).split(/[^a-z0-9]+/).filter(Boolean);
    }

    function calculateEditDistance(a, b) {
        if (a === b) return 0;
        if (!a || !b) return Math.max(a.length, b.length);

        const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
        const current = Array(b.length + 1).fill(0);

        for (let i = 1; i <= a.length; i += 1) {
            current[0] = i;
            for (let j = 1; j <= b.length; j += 1) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                current[j] = Math.min(
                    previous[j] + 1,
                    current[j - 1] + 1,
                    previous[j - 1] + cost
                );
            }
            previous.splice(0, previous.length, ...current);
        }

        return previous[b.length];
    }

    function termMatchesSearchItem(term, item) {
        if (item.searchText.includes(term)) return true;

        const tolerance = term.length >= 5 ? 2 : term.length >= 4 ? 1 : 0;
        if (tolerance === 0) return false;

        return getSearchWords(item.searchText).some(word => {
            if (word.includes(term) || term.includes(word)) return true;
            return Math.abs(word.length - term.length) <= tolerance && calculateEditDistance(term, word) <= tolerance;
        });
    }

    function scoreSearchItem(item, terms, query) {
        if (terms.length === 0) return 0;
        if (!terms.every(term => termMatchesSearchItem(term, item))) return 0;

        const title = normalizeSearchText(item.title);
        if (title === query) return 100;
        if (title.startsWith(query)) return 80;
        if (item.searchText.includes(query)) return 60;
        return 40;
    }

    function renderSearchResults(container, results, query) {
        if (!query) {
            container.innerHTML = '<p class="app-search-empty">Busc&aacute; funciones, m&oacute;dulos, clientes u &oacute;rdenes.</p>';
            container.classList.add("is-open");
            return;
        }

        if (results.length === 0) {
            container.innerHTML = '<p class="app-search-empty">Sin resultados.</p>';
            container.classList.add("is-open");
            return;
        }

        container.innerHTML = results.slice(0, 8).map((item, index) =>
            '<a class="app-search-result" href="' + item.href + '" data-search-result="' + index + '">' +
                '<span>' + escapeSearchHtml(item.type) + '</span>' +
                '<strong>' + escapeSearchHtml(item.title) + '</strong>' +
                '<small>' + escapeSearchHtml(item.description || item.href) + '</small>' +
            '</a>'
        ).join("");
        container.classList.add("is-open");
    }

    function setupGlobalSearch(topbar) {
        const usuario = typeof window.obtenerUsuarioActual === "function" ? window.obtenerUsuarioActual() : null;
        const search = topbar.querySelector(".app-search-cluster");
        if (usuario && usuario.rol === "cliente_pendiente") {
            if (search) search.hidden = true;
            return;
        }
        const input = topbar.querySelector(".app-search input");
        if (!input || !search) return;

        const results = document.createElement("div");
        results.className = "app-search-results";
        results.setAttribute("role", "listbox");
        results.setAttribute("aria-label", "Resultados de búsqueda");
        search.appendChild(results);

        let currentResults = [];

        const closeResults = () => {
            results.classList.remove("is-open");
        };

        const openSearchResult = href => {
            if (!href) return;

            const target = new URL(href, window.location.href);
            const current = window.location.pathname.split("/").pop() || "dashboard.html";
            const targetPage = target.pathname.split("/").pop();

            if (targetPage === current && target.hash === "#nueva-orden" && typeof window.abrirAgenda === "function") {
                window.location.hash = "nueva-orden";
                window.abrirAgenda({});
                closeResults();
                return;
            }

            window.location.href = target.href;
        };

        const updateResults = () => {
            const query = normalizeSearchText(input.value.trim());
            const terms = query.split(/\s+/).filter(Boolean);
            const index = buildSearchIndex();
            currentResults = index
                .map(item => ({ ...item, score: scoreSearchItem(item, terms, query) }))
                .filter(item => item.score > 0)
                .sort((a, b) => b.score - a.score);
            renderSearchResults(results, currentResults, query);
        };

        results.dataset.searchClickBound = "true";
        results.addEventListener("click", event => {
            const link = event.target.closest(".app-search-result");
            if (!link) return;

            event.preventDefault();
            openSearchResult(link.getAttribute("href"));
        });

        input.addEventListener("input", updateResults);
        input.addEventListener("focus", updateResults);
        input.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                closeResults();
                input.blur();
                return;
            }

            if (event.key === "Enter" && currentResults[0]) {
                openSearchResult(currentResults[0].href);
            }
        });

        document.addEventListener("click", event => {
            if (!search.contains(event.target)) closeResults();
        });
    }
    function createTopbar() {
        const existingTopbar = document.querySelector(".app-topbar");
        if (existingTopbar) existingTopbar.remove();

        const topbar = document.createElement("header");
        topbar.className = "app-topbar";

        topbar.innerHTML = `
            <button class="app-menu-toggle"
                    type="button"
                    aria-label="Abrir menú principal"
                    aria-controls="appSidebar"
                    aria-expanded="false">
                <span aria-hidden="true"></span>
                <span aria-hidden="true"></span>
                <span aria-hidden="true"></span>
            </button>

            <a class="app-topbar-logo" href="dashboard.html" aria-label="Ir al dashboard">
                <img src="assets/logo/logo.png" alt="La Solución Servicios Profesionales">
            </a>

            <div class="app-topbar-spacer"></div>

            <div class="app-search-cluster">
                <label class="app-search" aria-label="Buscar">
                    <input type="search" placeholder="Buscar órdenes, clientes, direcciones..." autocomplete="off">
                    <span aria-hidden="true">⌕</span>
                </label>
            </div>

            <button class="app-notifications" type="button" aria-label="Notificaciones">
                <svg class="app-notification-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M18 9.8c0-3.2-1.8-5.4-4.7-6V3a1.3 1.3 0 0 0-2.6 0v.8C7.8 4.4 6 6.6 6 9.8v3.7l-1.6 2.7a.9.9 0 0 0 .8 1.3h13.6a.9.9 0 0 0 .8-1.3L18 13.5V9.8Z"/>
                    <path d="M9.7 19.1a2.4 2.4 0 0 0 4.6 0"/>
                </svg>
                ${getNotificationCount() > 0 ? `<strong>${getNotificationCount()}</strong>` : ""}
            </button>

            <div class="app-clock" aria-label="Hora y fecha actuales"></div>
        `;

        document.body.prepend(topbar);
        topbar.querySelector(".app-menu-toggle").addEventListener("click", toggleSidebar);
        setupGlobalSearch(topbar);
        startClock();
    }

    function createSidebar() {
        const existingSidebar = document.querySelector(".app-sidebar");
        if (existingSidebar) existingSidebar.remove();

        const sidebar = document.createElement("aside");
        sidebar.id = "appSidebar";
        sidebar.className = "app-sidebar";
        sidebar.setAttribute("aria-label", "Menú principal");

        const nav = getVisibleNavigationItems()
            .map(item => {
                const isActive = item.href === currentPage;
                return `
                    <a class="app-nav-link${isActive ? " is-active" : ""}"
                       href="${item.href}"
                       ${isActive ? "aria-current=\"page\"" : ""}>
                        <span class="app-nav-icon" aria-hidden="true">${item.icon}</span>
                        <span>${item.label}</span>
                    </a>
                `;
            })
            .join("");

        const usuario = typeof window.obtenerUsuarioActual === "function" ? window.obtenerUsuarioActual() : null;
        const nombreUsuario = escapeSearchHtml(usuario?.nombreCompleto || usuario?.nombre || getUserName());
        const rolUsuario = escapeSearchHtml(getUserRoleLabel());

        sidebar.innerHTML = `
            <nav class="app-nav">
                ${nav}
            </nav>

            <div class="app-sidebar-footer">
                <div class="app-sidebar-user">
                    <span class="app-sidebar-avatar" aria-hidden="true">
                        <svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="8" r="4"/><path d="M4.6 21a7.4 7.4 0 0 1 14.8 0Z"/></svg>
                    </span>
                    <span class="app-sidebar-user-copy"><strong>${nombreUsuario}</strong><small>${rolUsuario}</small></span>
                </div>
                <button class="app-logout" type="button">
                    <span>Cerrar sesión</span>
                </button>
            </div>
        `;

        document.body.appendChild(sidebar);        sidebar.querySelector(".app-logout").addEventListener("click", function () {
            if (typeof window.logout === "function") window.logout();
        });

        sidebar.querySelectorAll(".app-nav-link").forEach(link => {
            link.addEventListener("click", closeSidebar);
        });
    }

    function createOverlay() {
        const existingOverlay = document.querySelector(".sidebar-overlay");
        if (existingOverlay) existingOverlay.remove();

        const overlay = document.createElement("button");
        overlay.className = "sidebar-overlay";
        overlay.type = "button";
        overlay.setAttribute("aria-label", "Cerrar menú");
        overlay.addEventListener("click", closeSidebar);
        document.body.appendChild(overlay);
    }

    function getAdminTestSession() {
        try {
            const value = localStorage.getItem("sesionAdministradorOriginal");
            return value ? JSON.parse(value) : null;
        } catch (error) {
            return null;
        }
    }

    function createAdminTestBanner() {
        const existing = document.querySelector(".admin-test-banner");
        if (existing) existing.remove();

        const adminSession = getAdminTestSession();
        if (!adminSession || currentPage === "index.html") return;

        const user = typeof window.obtenerUsuarioActual === "function" ? window.obtenerUsuarioActual() : null;
        const banner = document.createElement("div");
        banner.className = "admin-test-banner";
        banner.innerHTML =
            '<span>Modo de prueba: est\u00e1s viendo la aplicaci\u00f3n como <strong>' + escapeSearchHtml(user?.nombreCompleto || user?.nombre || "usuario") + '</strong>.</span>' +
            '<button type="button">Volver a administrador</button>';
        banner.querySelector("button").addEventListener("click", function () {
            if (typeof window.restaurarSesionAdministrador === "function") window.restaurarSesionAdministrador();
        });
        document.body.appendChild(banner);
    }

    function enhancePage() {
        if (typeof window.protegerPaginaPorPermiso === "function") {
            window.protegerPaginaPorPermiso();
        }

        document.body.classList.add("layout-shell");
        setSidebarState(false);
        document.body.dataset.page = currentPage.replace(/\.html$/i, "") || "dashboard";
        createTopbar();
        createSidebar();
        createOverlay();
        createAdminTestBanner();

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") closeSidebar();
        });

        document.addEventListener("click", handleOutsideSidebarClick);
    }

    document.addEventListener("DOMContentLoaded", enhancePage);
})();





















