window.views = window.views || {};

views.inventory = {
  async render() {
    const rows = await api.getInventory();

    const body =
      rows.length === 0
        ? `<tr><td class="p-6 text-sm text-slate-500" colspan="7">Sin registros todavía.</td></tr>`
        : rows
            .map(
              (r) => `
              <tr class="hover:bg-slate-50 transition-colors">
                <td class="p-4 text-sm text-slate-600 whitespace-nowrap">${r.date}</td>
                <td class="p-4 text-sm font-medium text-slate-900">${r.item}</td>
                <td class="p-4 text-sm text-slate-600">
                  <span class="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">${r.category}</span>
                </td>
                <td class="p-4">
                  <span class="px-2 py-1 text-xs rounded-full font-medium ${
                    r.type === "Entrada" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }">
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
            `
            )
            .join("");

    return `
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Inventario</h1>
          <p class="text-slate-500 text-sm">Registro de movimientos con bloque (hash) asociado.</p>
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
              ${body}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  bind() {
    // Hash detail
    document.querySelectorAll(".hashBtn").forEach((btn) => {
      btn.addEventListener("click", () => modal.showHash(btn.dataset.hash));
    });

    // Registrar (REAL)
    $("#invAdd")?.addEventListener("click", () => {
      const today = new Date().toISOString().slice(0, 10);

      modal.open(`
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2">
              <i data-lucide="edit-3" class="w-5 h-5 text-primary"></i> Registrar Movimiento
            </h3>
            <button id="invClose" class="text-slate-400 hover:text-slate-600">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <form id="invForm" class="space-y-3">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Fecha</label>
                <input id="invDate" type="date" value="${today}" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" required>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Tipo</label>
                <select id="invType" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" required>
                  <option value="Entrada">Entrada</option>
                  <option value="Salida">Salida</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Ítem</label>
              <input id="invItem" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Ej: Fertilizante NPK" required>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Categoría</label>
                <input id="invCategory" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Ej: Fertilizante" required>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Cantidad</label>
                <input id="invQty" type="number" min="1" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Ej: 10" required>
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button type="button" id="invCancel" class="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg text-sm transition">Cancelar</button>
              <button id="invSave" type="submit" class="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium shadow-lg hover:bg-primaryHover transition">
                Guardar
              </button>
            </div>
          </form>
        </div>
      `);

      const close = () => modal.close();
      $("#invCancel")?.addEventListener("click", close);
      $("#invClose")?.addEventListener("click", close);

      $("#invForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();

        const payload = {
          date: $("#invDate").value,
          item: $("#invItem").value.trim(),
          category: $("#invCategory").value.trim(),
          type: $("#invType").value,
          qty: Number($("#invQty").value),
        };

        const btn = $("#invSave");
        const original = btn.innerHTML;

        try {
          btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>`;
          lucide.createIcons();
          btn.classList.add("opacity-75", "cursor-not-allowed");

          const res = await api.createInventory(payload);
          modal.close();
          toast.show(`Movimiento registrado. Hash: ${format.truncHash(res.hash)}`, "success");
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

    // Borrar (no implementado a propósito)
    $("#invDelete")?.addEventListener("click", () => {
      modal.confirmDelete({
        title: "¿Borrar movimiento?",
        message: "No recomendado: en trazabilidad se anula con un nuevo registro (auditoría).",
        onConfirm: () => toast.show("Acción no implementada (mejor: anulación/auditoría).", "info"),
      });
    });
  }
};
