window.views = window.views || {};

// Icono cacao (SVG inline) - no depende de lucide
const cacaoIcon = (className = "w-5 h-5") => `
  <svg class="${className}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <!-- vaina -->
    <path d="M12 2.5c4.8 0 8 4.8 8 9.9 0 5.6-3.6 9.1-8 9.1s-8-3.5-8-9.1c0-5.1 3.2-9.9 8-9.9Z"
          fill="currentColor" opacity="0.92"/>
    <!-- surcos -->
    <path d="M12 4.3v16.4" stroke="white" stroke-opacity="0.55" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M8.3 6.2c.9 2.2.9 9.4 0 11.6" stroke="white" stroke-opacity="0.28" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M15.7 6.2c-.9 2.2-.9 9.4 0 11.6" stroke="white" stroke-opacity="0.28" stroke-width="1.2" stroke-linecap="round"/>
  </svg>
`;

views.dashboard = {
  async render() {
    const user = state.currentUser;

    // Rol del backend: bodega | oficina | admin
    const role = (user?.role || "").toLowerCase();

    // Selección por defecto si no hay vista activa
    if (!state.activeView) {
      state.activeView = role === "bodega" ? "inventory" : role === "oficina" ? "invoices" : "admin";
    }

    // Helpers para botones de nav
    const navBtn = (id, icon, label) => `
      <button
        class="navBtn w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition
               ${state.activeView === id ? "bg-primary/10 text-primary font-medium" : "hover:bg-slate-50 text-slate-700"}"
        data-view="${id}">
        <i data-lucide="${icon}"></i> ${label}
      </button>
    `;

    let nav = "";
    let content = "";

    if (role === "bodega") {
      nav = `
        <div class="text-xs font-bold text-slate-400 uppercase px-4 mb-2">Principal</div>
        ${navBtn("inventory", "package", "Lotes / Inventario")}
      `;
      content = await views.inventory.render();
      state.activeView = "inventory";
    } else if (role === "oficina") {
      nav = `
        <div class="text-xs font-bold text-slate-400 uppercase px-4 mb-2">Principal</div>
        ${navBtn("invoices", "file-text", "Facturación")}
      `;
      content = await views.invoices.render();
      state.activeView = "invoices";
    } else {
      // admin
      nav = `
        <div class="text-xs font-bold text-slate-400 uppercase px-4 mb-2">Admin</div>
        ${navBtn("admin", "layout-dashboard", "Pendientes de aprobación")}
        ${navBtn("ledger", "shield-check", "Auditoría / Ledger")}
      `;

      // Render según la vista activa elegida por el admin
      if (state.activeView === "ledger") {
        content = await views.ledger.render();
      } else {
        state.activeView = "admin";

        // Fallback: evita crash si admin.js no está cargado
        if (!window.views?.admin || typeof window.views.admin.render !== "function") {
          content = `
            <div class="bg-white border border-slate-200 rounded-xl p-6">
              <h2 class="text-lg font-bold text-slate-900 mb-1">Panel Admin</h2>
              <p class="text-slate-500 text-sm">
                La vista <span class="font-mono">admin.js</span> no está disponible.
                Revisa que <span class="font-mono">/assets/js/views/admin.js</span> cargue como JavaScript (no HTML) y recarga sin cache.
              </p>
            </div>
          `;
        } else {
          content = await window.views.admin.render();
        }
      }
    }

    const initial = (user?.name || "?").charAt(0);

    return `
      <div class="flex h-full">
        <!-- Sidebar -->
        <aside class="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex z-20">
          <div class="p-6 flex items-center gap-3 border-b border-slate-100">
            <div class="bg-primary text-white p-1.5 rounded-lg flex items-center justify-center">
              ${cacaoIcon("w-5 h-5")}
            </div>
            <span class="font-bold text-lg tracking-tight text-slate-800">AgroCacao S.A.</span>
          </div>

          <nav class="flex-1 p-4 space-y-1">
            ${nav}
          </nav>

          <div class="p-4 border-t border-slate-100">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                ${initial}
              </div>
              <div class="overflow-hidden">
                <p class="text-sm font-medium text-slate-900 truncate">${user.name}</p>
                <p class="text-xs text-slate-500 truncate">${user.role}</p>
              </div>
            </div>

            <button id="btnLogout" class="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-danger transition-colors">
              <i data-lucide="log-out" class="w-4 h-4"></i> Cerrar Sesión
            </button>
          </div>
        </aside>

        <!-- Main -->
        <main class="flex-1 flex flex-col min-w-0 bg-slate-50/50">
          <header class="bg-white border-b border-slate-200 p-4 md:hidden flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-primary">${cacaoIcon("w-5 h-5")}</span>
              <span class="font-bold">AgroCacao S.A.</span>
            </div>
            <button id="btnLogoutMobile" class="text-slate-500">
              <i data-lucide="log-out"></i>
            </button>
          </header>

          <div class="flex-1 overflow-auto p-4 md:p-8">
            <div class="max-w-7xl mx-auto fade-in">
              ${content}
            </div>
          </div>
        </main>
      </div>
    `;
  },

  bind() {
    const logout = () => {
      session.clear();
      toast.show("Sesión cerrada", "info");
      window.appRender();
    };

    $("#btnLogout")?.addEventListener("click", logout);
    $("#btnLogoutMobile")?.addEventListener("click", logout);

    // Navegación (cambia vista)
    document.querySelectorAll(".navBtn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const view = btn.dataset.view;
        if (!view) return;
        state.activeView = view;
        window.appRender();
      });
    });

    // Bind de vista activa
    if (state.activeView === "inventory") views.inventory.bind();
    if (state.activeView === "invoices") views.invoices.bind();
    if (state.activeView === "ledger") views.ledger.bind();
    if (state.activeView === "admin" && views.admin?.bind) views.admin.bind();
  }
};
