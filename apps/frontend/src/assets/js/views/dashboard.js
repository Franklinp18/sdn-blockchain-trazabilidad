window.views = window.views || {};

views.dashboard = {
  async render() {
    const user = state.currentUser;
    // Decide vista por rol
    let nav = "";
    let content = "";

    if (user.role === "EmpleadoDeBodega") {
      nav = `<button class="w-full text-left px-4 py-3 bg-primary/10 text-primary font-medium rounded-lg flex items-center gap-3">
               <i data-lucide="package"></i> Inventario
             </button>`;
      content = await views.inventory.render();
      state.activeView = "inventory";
    } else if (user.role === "EmpleadoDeAdministración") {
      nav = `<button class="w-full text-left px-4 py-3 bg-primary/10 text-primary font-medium rounded-lg flex items-center gap-3">
               <i data-lucide="file-text"></i> Facturas
             </button>`;
      content = await views.invoices.render();
      state.activeView = "invoices";
    } else {
      nav = `<button class="w-full text-left px-4 py-3 bg-primary/10 text-primary font-medium rounded-lg flex items-center gap-3">
               <i data-lucide="shield-check"></i> Auditoría / Ledger
             </button>`;
      content = await views.ledger.render();
      state.activeView = "ledger";
    }

    return `
      <div class="flex h-full">
        <!-- Sidebar -->
        <aside class="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex z-20">
          <div class="p-6 flex items-center gap-3 border-b border-slate-100">
            <div class="bg-primary text-white p-1.5 rounded-lg">
              <i data-lucide="layers" class="w-5 h-5"></i>
            </div>
            <span class="font-bold text-lg tracking-tight text-slate-800">NEXUS</span>
          </div>

          <nav class="flex-1 p-4 space-y-1">
            <div class="text-xs font-bold text-slate-400 uppercase px-4 mb-2">Principal</div>
            ${nav}
          </nav>

          <div class="p-4 border-t border-slate-100">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                ${user.name.charAt(0)}
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
              <i data-lucide="layers" class="text-primary"></i>
              <span class="font-bold">NEXUS</span>
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

    // Bind de vista activa
    if (state.activeView === "inventory") views.inventory.bind();
    if (state.activeView === "invoices") views.invoices.bind();
    if (state.activeView === "ledger") views.ledger.bind();
  }
};

