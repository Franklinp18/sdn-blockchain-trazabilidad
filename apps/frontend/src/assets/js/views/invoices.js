window.views = window.views || {};

views.invoices = {
  async render() {
    const rows = await api.getInvoices();
    return `
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Facturación</h1>
          <p class="text-slate-500 text-sm">Registro de ventas con hash asociado.</p>
        </div>
        <div class="flex gap-2">
          <button id="facDelete" class="px-4 py-2 text-danger hover:bg-red-50 rounded-lg text-sm font-medium transition flex items-center gap-2">
            <i data-lucide="trash-2" class="w-4 h-4"></i> Anular
          </button>
          <button id="facAdd" class="px-4 py-2 bg-primary hover:bg-primaryHover text-white rounded-lg text-sm font-medium shadow-lg shadow-primary/20 transition flex items-center gap-2">
            <i data-lucide="file-plus" class="w-4 h-4"></i> Nueva Factura
          </button>
        </div>
      </div>

      <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200">
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Total</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Emisor</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Hash</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${rows.map(r => `
                <tr class="hover:bg-slate-50 transition-colors">
                  <td class="p-4 text-sm text-slate-600 whitespace-nowrap">${r.date}</td>
                  <td class="p-4 text-sm font-medium text-slate-900">${r.client}</td>
                  <td class="p-4 text-sm text-emerald-600 font-bold text-right font-mono">${format.moneyUSD(r.total)}</td>
                  <td class="p-4 text-sm text-slate-500">${r.user}</td>
                  <td class="p-4">
                    <button class="hashBtn text-xs font-mono text-slate-400 bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded border border-slate-200 transition-all flex items-center gap-2"
                      data-hash="${r.hash}">
                      <i data-lucide="shield" class="w-3 h-3"></i>
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
    document.querySelectorAll(".hashBtn").forEach(btn => {
      btn.addEventListener("click", () => modal.showHash(btn.dataset.hash));
    });

    $("#facAdd")?.addEventListener("click", () => {
      modal.open(`
        <div class="p-6">
          <h3 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <i data-lucide="edit-3" class="w-5 h-5 text-primary"></i> Nueva Factura
          </h3>
          <form id="facForm">
            <input id="facClient" class="w-full p-2 border rounded mb-2 text-sm" placeholder="Cliente" required>
            <input id="facTotal" class="w-full p-2 border rounded mb-2 text-sm" placeholder="Total (USD)" type="number" step="0.01" required>
            <div class="flex justify-end gap-2">
              <button type="button" id="facCancel" class="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg text-sm transition">Cancelar</button>
              <button type="submit" class="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium shadow-lg hover:bg-primaryHover transition">Guardar</button>
            </div>
          </form>
        </div>
      `);

      $("#facCancel")?.addEventListener("click", () => modal.close());
      $("#facForm")?.addEventListener("submit", (e) => {
        e.preventDefault();
        modal.close();
        toast.show("Factura registrada (demo).", "success");
      });
    });

    $("#facDelete")?.addEventListener("click", () => {
      modal.confirmDelete({
        title: "¿Anular factura?",
        message: "La anulación idealmente genera un nuevo bloque de auditoría.",
        onConfirm: () => toast.show("Anulación simulada (demo).", "info"),
      });
    });
  }
};

