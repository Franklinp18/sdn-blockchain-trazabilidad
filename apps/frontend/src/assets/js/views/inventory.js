window.views = window.views || {};

views.inventory = {
  async render() {
    const rows = await api.getInventory();
    return `
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Inventario</h1>
          <p class="text-slate-500 text-sm">Gestión de movimientos y stock.</p>
        </div>
        <div class="flex gap-2">
          <button id="invDelete" class="px-4 py-2 text-danger hover:bg-red-50 rounded-lg text-sm font-medium transition flex items-center gap-2">
            <i data-lucide="trash-2" class="w-4 h-4"></i> Borrar
          </button>
          <button id="invAdd" class="px-4 py-2 bg-primary hover:bg-primaryHover text-white rounded-lg text-sm font-medium shadow-lg shadow-primary/20 transition flex items-center gap-2">
            <i data-lucide="plus" class="w-4 h-4"></i> Registrar
          </button>
        </div>
      </div>

      <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200">
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ítem</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Categoría</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Cant.</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuario</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bloque (Hash)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${rows.map(r => `
                <tr class="hover:bg-slate-50 transition-colors">
                  <td class="p-4 text-sm text-slate-600 whitespace-nowrap">${r.date}</td>
                  <td class="p-4 text-sm font-medium text-slate-900">${r.item}</td>
                  <td class="p-4 text-sm text-slate-600">
                    <span class="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">${r.category}</span>
                  </td>
                  <td class="p-4">
                    <span class="px-2 py-1 text-xs rounded-full font-medium ${r.type === 'Entrada' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                      ${r.type}
                    </span>
                  </td>
                  <td class="p-4 text-sm text-slate-900 font-bold text-right font-mono">${r.qty}</td>
                  <td class="p-4 text-sm text-slate-500">${r.user}</td>
                  <td class="p-4">
                    <button class="hashBtn text-xs font-mono text-slate-400 hover:text-primary hover:bg-primary/5 px-2 py-1 rounded border border-slate-200 hover:border-primary/30 transition-all flex items-center gap-2"
                      data-hash="${r.hash}">
                      <i data-lucide="link" class="w-3 h-3"></i>
                      ${format.truncHash(r.hash)}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  bind() {
    // Hash detail
    document.querySelectorAll(".hashBtn").forEach(btn => {
      btn.addEventListener("click", () => modal.showHash(btn.dataset.hash));
    });

    // Registrar (demo)
    $("#invAdd")?.addEventListener("click", () => {
      modal.open(`
        <div class="p-6">
          <h3 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <i data-lucide="edit-3" class="w-5 h-5 text-primary"></i> Registrar Movimiento
          </h3>
          <form id="invForm">
            <input id="invItem" class="w-full p-2 border rounded mb-2 text-sm" placeholder="Nombre del ítem" required>
            <input id="invQty" class="w-full p-2 border rounded mb-2 text-sm" placeholder="Cantidad" type="number" required>
            <div class="flex justify-end gap-2">
              <button type="button" id="invCancel" class="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg text-sm transition">Cancelar</button>
              <button type="submit" class="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium shadow-lg hover:bg-primaryHover transition">Guardar</button>
            </div>
          </form>
        </div>
      `);

      $("#invCancel")?.addEventListener("click", () => modal.close());
      $("#invForm")?.addEventListener("submit", (e) => {
        e.preventDefault();
        modal.close();
        toast.show("Movimiento registrado (demo).", "success");
      });
    });

    // Borrar (demo)
    $("#invDelete")?.addEventListener("click", () => {
      modal.confirmDelete({
        title: "¿Borrar movimiento?",
        message: "En un sistema con trazabilidad, normalmente se anula y se registra auditoría.",
        onConfirm: () => toast.show("Acción de borrado simulada (demo).", "info"),
      });
    });
  }
};

