// Render central
window.appRender = async function () {
  const app = $("#app");
  if (!app) return;

  try {
    // Intenta reconstruir usuario si hay sesión pero no hay currentUser
    if (!state.currentUser) {
      const role =
        (state.role || state.currentRole || state.userRole || localStorage.getItem(state.roleKey) || "").toLowerCase();

      const tkn =
        (localStorage.getItem(state.tokenKey) || "").trim();

      if (role && tkn) {
        // nombre bonito
        const pretty =
          roles?.[role]?.name ||
          (role === "bodega" ? "Empleado Bodega" : role === "oficina" ? "Empleado Oficina" : role === "admin" ? "Administrador" : role);

        state.currentUser = { name: pretty, role };
      }
    }

    // Decide view
    if (!state.currentUser) {
      app.innerHTML = views.login.render();
      lucide.createIcons();
      views.login.bind();
      return;
    }

    app.innerHTML = await views.dashboard.render();
    lucide.createIcons();
    views.dashboard.bind();
  } catch (err) {
    const msg = (err && err.message) ? err.message : "Error inesperado en la interfaz";

    app.innerHTML = `
      <div class="h-full w-full flex items-center justify-center p-6 bg-slate-50">
        <div class="max-w-lg w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <i data-lucide="alert-triangle"></i>
            </div>
            <div>
              <h2 class="text-lg font-bold text-slate-900">No se pudo cargar la vista</h2>
              <p class="text-sm text-slate-500">Revisa conexión con la API o permisos del rol.</p>
            </div>
          </div>

          <div class="bg-slate-900 text-slate-200 font-mono text-xs p-3 rounded-lg break-words mb-4">${msg}</div>

          <div class="flex gap-2 justify-end">
            <button id="btnRetry" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-sm font-medium">Reintentar</button>
            <button id="btnForceLogout" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">Cerrar sesión</button>
          </div>
        </div>
      </div>
    `;
    lucide.createIcons();

    $("#btnRetry")?.addEventListener("click", () => window.appRender());
    $("#btnForceLogout")?.addEventListener("click", () => {
      session.clear();
      state.currentUser = null;
      state.activeView = null;
      window.appRender();
    });
  }
};

// Boot
(function init() {
  session.load();
  window.appRender();
})();
