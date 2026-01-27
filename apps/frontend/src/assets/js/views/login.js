window.views = window.views || {};

// Icono cacao (SVG inline) - no depende de lucide
const cacaoIconLogin = (className = "w-8 h-8") => `
  <svg class="${className}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 2.5c4.8 0 8 4.8 8 9.9 0 5.6-3.6 9.1-8 9.1s-8-3.5-8-9.1c0-5.1 3.2-9.9 8-9.9Z"
          fill="currentColor" opacity="0.92"/>
    <path d="M12 4.3v16.4" stroke="white" stroke-opacity="0.55" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M8.3 6.2c.9 2.2.9 9.4 0 11.6" stroke="white" stroke-opacity="0.28" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M15.7 6.2c-.9 2.2-.9 9.4 0 11.6" stroke="white" stroke-opacity="0.28" stroke-width="1.2" stroke-linecap="round"/>
  </svg>
`;

views.login = {
  render() {
    return `
    <div class="h-full w-full flex items-center justify-center bg-slate-100 p-4">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden fade-in">
        <div class="p-8">
          <div class="flex justify-center mb-6">
            <div class="bg-primary/10 p-3 rounded-full text-primary flex items-center justify-center">
              ${cacaoIconLogin("w-8 h-8")}
            </div>
          </div>

          <h2 class="text-2xl font-bold text-center text-slate-800 mb-2">AgroCacao S.A.</h2>
          <p class="text-center text-slate-500 text-sm mb-8">Ingresa tus credenciales para acceder</p>

          <form id="loginForm" class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Usuario</label>
              <input type="text" id="username"
                class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                placeholder="bodega | oficina | admin" required>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Contraseña</label>
              <input type="password" id="password"
                class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                placeholder="(vacía si aplica)">
            </div>

            <button id="btnLogin" type="submit"
              class="w-full bg-primary hover:bg-primaryHover text-white font-medium py-2.5 rounded-lg transition-colors shadow-lg shadow-primary/30">
              Iniciar Sesión
            </button>
          </form>

          <div class="mt-6 pt-6 border-t border-slate-100 text-center">
            <p class="text-xs text-slate-400">
              Usuarios:
              <span class="font-mono bg-slate-100 px-1 rounded">bodega</span>,
              <span class="font-mono bg-slate-100 px-1 rounded">oficina</span>,
              <span class="font-mono bg-slate-100 px-1 rounded">admin</span>
            </p>
          </div>
        </div>
      </div>
    </div>
    `;
  },

  bind() {
    const form = $("#loginForm");
    if (!form) return;

    const prettyRoleName = (r) => {
      const key = (r || "").toLowerCase();
      return (
        roles?.[key]?.name ||
        (key === "bodega" ? "Empleado Bodega" : key === "oficina" ? "Empleado Oficina" : key === "admin" ? "Administrador" : key)
      );
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const u = $("#username").value.trim().toLowerCase();
      const p = $("#password").value;

      const btn = $("#btnLogin");
      const original = btn.innerHTML;

      $("#username")?.classList.remove("border-red-500");

      try {
        btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin mx-auto"></i>`;
        lucide.createIcons();

        const res = await api.login(u, p);
        const role = (res.role || "").toLowerCase();

        session.set(role, res.token);

        state.currentUser = {
          name: prettyRoleName(role),
          role: role,
        };

        toast.show(`Bienvenido, ${state.currentUser.name}`, "success");
        window.appRender();
      } catch (err) {
        try {
          await api.health();
          toast.show(err.message || "Error al iniciar sesión", "error");
        } catch {
          toast.show("API no disponible. Prueba /api/health y revisa el proxy del frontend.", "error");
        }
        $("#username")?.classList.add("border-red-500");
      } finally {
        btn.innerHTML = original;
        lucide.createIcons();
      }
    });
  }
};
