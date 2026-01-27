window.views = window.views || {};

views.invoices = {
  async render() {
    // 1) Lotes disponibles (para seleccionar)
    const lots = await api.getAvailableLots();

    const lotsBody =
      lots.length === 0
        ? `<tr><td class="p-6 text-sm text-slate-500" colspan="6">No hay lotes disponibles para facturar.</td></tr>`
        : lots
            .map(
              (l) => `
              <tr class="hover:bg-slate-50 transition-colors">
                <td class="p-4 text-sm text-slate-600 whitespace-nowrap">${l.date}</td>
                <td class="p-4 text-sm font-medium text-slate-900">${l.item}</td>
                <td class="p-4 text-sm text-slate-600">${l.category}</td>
                <td class="p-4 text-sm text-slate-600 text-right font-mono">${l.qty}</td>
                <td class="p-4">
                  <span class="text-xs font-semibold px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
                    ${l.status || "AVAILABLE"}
                  </span>
                </td>
                <td class="p-4 text-right">
                  <button
                    class="pickLotBtn px-3 py-2 bg-primary hover:bg-primaryHover text-white rounded-lg text-xs font-medium shadow-sm transition inline-flex items-center gap-2"
                    data-lot='${encodeURIComponent(JSON.stringify(l))}'>
                    <i data-lucide="file-plus" class="w-4 h-4"></i>
                    Facturar
                  </button>
                </td>
              </tr>
            `
            )
            .join("");

    // 2) Mis facturas
    const rows = await api.getInvoices();

    const invBody =
      rows.length === 0
        ? `<tr><td class="p-6 text-sm text-slate-500" colspan="7">Sin facturas todavía.</td></tr>`
        : rows
            .map((r) => {
              const st = r.status || "—";
              const badge =
                st === "APPROVED"
                  ? `bg-emerald-50 text-emerald-700 border-emerald-200`
                  : st === "REJECTED"
                  ? `bg-red-50 text-red-700 border-red-200`
                  : `bg-amber-50 text-amber-700 border-amber-200`;

              const hashText = (r.hash || "PENDING").toString();
              const showHashBtn = hashText !== "PENDING";

              return `
                <tr class="hover:bg-slate-50 transition-colors">
                  <td class="p-4 text-sm text-slate-600 whitespace-nowrap">${r.date}</td>
                  <td class="p-4 text-sm font-medium text-slate-900">${r.client}</td>
                  <td class="p-4 text-sm text-slate-600">${r.lot || "-"}</td>
                  <td class="p-4 text-sm text-emerald-600 font-bold text-right font-mono">${format.moneyUSD(r.total)}</td>
                  <td class="p-4">
                    <span class="text-xs font-semibold px-2 py-1 rounded-full border ${badge}">
                      ${st}
                    </span>
                  </td>
                  <td class="p-4 text-sm text-slate-500">${r.user}</td>
                  <td class="p-4">
                    ${
                      showHashBtn
                        ? `
                          <button class="hashBtn text-xs font-mono text-slate-400 bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded border border-slate-200 transition-all flex items-center gap-2"
                            data-hash="${hashText}">
                            <i data-lucide="shield" class="w-3 h-3"></i>
                            ${format.truncHash(hashText)}
                          </button>
                        `
                        : `
                          <span class="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-200 inline-flex items-center gap-2">
                            <i data-lucide="clock" class="w-3 h-3"></i>
                            PENDING
                          </span>
                        `
                    }
                  </td>
                </tr>
              `;
            })
            .join("");

    return `
      <div class="mb-8">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-slate-900">Facturación</h1>
            <p class="text-slate-500 text-sm">
              Selecciona un lote disponible para emitir factura. La factura pasa a aprobación y el hash real se genera cuando el admin aprueba.
            </p>
          </div>
          <div class="flex gap-2">
            <button id="facDelete" class="px-4 py-2 text-danger hover:bg-red-50 rounded-lg text-sm font-medium transition flex items-center gap-2">
              <i data-lucide="trash-2" class="w-4 h-4"></i> Anular
            </button>
          </div>
        </div>
      </div>

      <!-- Lotes disponibles -->
      <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-8">
        <div class="p-4 border-b border-slate-200 bg-slate-50">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2">
                <i data-lucide="package" class="w-4 h-4 text-primary"></i>
                Lotes disponibles
              </h2>
              <p class="text-xs text-slate-500 mt-1">Elige un lote para completar los datos y enviar la factura a aprobación.</p>
            </div>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-white border-b border-slate-200">
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Lote</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Categoría</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Cantidad</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Acción</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${lotsBody}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mis facturas -->
      <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div class="p-4 border-b border-slate-200 bg-slate-50">
          <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2">
            <i data-lucide="receipt" class="w-4 h-4 text-primary"></i>
            Mis facturas
          </h2>
          <p class="text-xs text-slate-500 mt-1">Estado: PENDING_APPROVAL → APPROVED/REJECTED.</p>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-white border-b border-slate-200">
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Lote</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Total</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Emisor</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Hash</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${invBody}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  bind() {
    // Hash modal (solo si hay hash real)
    document.querySelectorAll(".hashBtn").forEach((btn) => {
      btn.addEventListener("click", () => modal.showHash(btn.dataset.hash));
    });

    // Seleccionar lote -> abrir modal de factura
    document.querySelectorAll(".pickLotBtn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const lot = JSON.parse(decodeURIComponent(btn.dataset.lot || "%7B%7D"));

        const today = new Date().toISOString().slice(0, 10);

        modal.open(`
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2">
                <i data-lucide="file-plus" class="w-5 h-5 text-primary"></i>
                Emitir factura (desde lote)
              </h3>
              <button id="facClose" class="text-slate-400 hover:text-slate-600">
                <i data-lucide="x" class="w-5 h-5"></i>
              </button>
            </div>

            <div class="mb-4 p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div class="text-xs text-slate-500 uppercase font-semibold mb-1">Lote seleccionado</div>
              <div class="text-sm text-slate-800 font-medium">${lot.item}</div>
              <div class="text-xs text-slate-500 mt-1">${lot.category} • Cantidad: <span class="font-mono">${lot.qty}</span></div>
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
                  Enviar a aprobación
                </button>
              </div>
            </form>

            <p class="text-xs text-slate-500 mt-3">
              Nota: el hash real se genera cuando el administrador aprueba.
            </p>
          </div>
        `);

        const close = () => modal.close();
        $("#facCancel")?.addEventListener("click", close);
        $("#facClose")?.addEventListener("click", close);

        $("#facForm")?.addEventListener("submit", async (e) => {
          e.preventDefault();

          const payload = {
            inventory_id: Number(lot.id),
            date: $("#facDate").value,
            client: $("#facClient").value.trim(),
            total: Number($("#facTotal").value),
          };

          const btnSave = $("#facSave");
          const original = btnSave.innerHTML;

          try {
            btnSave.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>`;
            lucide.createIcons();
            btnSave.classList.add("opacity-75", "cursor-not-allowed");

            await api.createInvoice(payload);

            modal.close();
            toast.show("Factura enviada a aprobación.", "success");
            window.appRender();
          } catch (err) {
            toast.show(err.message || "No se pudo emitir la factura", "error");
          } finally {
            btnSave.innerHTML = original;
            btnSave.classList.remove("opacity-75", "cursor-not-allowed");
            lucide.createIcons();
          }
        });
      });
    });

    // Mantengo tu botón anular como no implementado
    $("#facDelete")?.addEventListener("click", () => {
      modal.confirmDelete({
        title: "¿Anular factura?",
        message: "No recomendado borrar: lo ideal es anular y registrar auditoría (nuevo bloque).",
        onConfirm: () => toast.show("Acción no implementada (mejor: anulación/auditoría).", "info"),
      });
    });
  }
};

