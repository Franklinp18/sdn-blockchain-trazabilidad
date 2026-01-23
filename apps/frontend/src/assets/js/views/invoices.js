window.views = window.views || {};

views.invoices = {
  async render() {
    const rows = await api.getInvoices();

    const body =
      rows.length === 0
        ? `<tr><td class="p-6 text-sm text-slate-500" colspan="5">Sin facturas todavía.</td></tr>`
        : rows
            .map(
              (r) => `
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
            `
            )
            .join("");

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
              ${body}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  bind() {
    document.querySelectorAll(".hashBtn").forEach((btn) => {
      btn.addEventListener("click", () => modal.showHash(btn.dataset.hash));
    });

    $("#facAdd")?.addEventListener("click", () => {
      const today = new Date().toISOString().slice(0, 10);

      modal.open(`
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2">
              <i data-lucide="edit-3" class="w-5 h-5 text-primary"></i> Nueva Factura
            </h3>
            <button id="facClose" class="text-slate-400 hover:text-slate-600">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <form id="facForm" class="space-y-3">
            <div>
              <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Fecha</label>
              <input id="facDate" type="date" value="${today}" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" required>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Cliente</label>
              <input id="facClient" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Ej: Comprador Local" required>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Total (USD)</label>
              <input id="facTotal" type="number" step="0.01" min="0.01" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Ej: 120.50" required>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button type="button" id="facCancel" class="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg text-sm transition">Cancelar</button>
              <button id="facSave" type="submit" class="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium shadow-lg hover:bg-primaryHover transition">
                Guardar
              </button>
            </div>
          </form>
        </div>
      `);

      const close = () => modal.close();
      $("#facCancel")?.addEventListener("click", close);
      $("#facClose")?.addEventListener("click", close);

      $("#facForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();

        const payload = {
          date: $("#facDate").value,
          client: $("#facClient").value.trim(),
          total: Number($("#facTotal").value),
        };

        const btn = $("#facSave");
        const original = btn.innerHTML;

        try {
          btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>`;
          lucide.createIcons();
          btn.classList.add("opacity-75", "cursor-not-allowed");

          const res = await api.createInvoice(payload);
          modal.close();
          toast.show(`Factura registrada. Hash: ${format.truncHash(res.hash)}`, "success");
          window.appRender();
        } catch (err) {
          toast.show(err.message || "No se pudo registrar", "error");
        } finally {
          btn.innerHTML = original;
          btn.classList.remove("opacity-75", "cursor-not-allowed");
          lucide.createIcons();
        }
      });
    });

    $("#facDelete")?.addEventListener("click", () => {
      modal.confirmDelete({
        title: "¿Anular factura?",
        message: "No recomendado borrar: lo ideal es anular y registrar auditoría (nuevo bloque).",
        onConfirm: () => toast.show("Acción no implementada (mejor: anulación/auditoría).", "info"),
      });
    });
  }
};
