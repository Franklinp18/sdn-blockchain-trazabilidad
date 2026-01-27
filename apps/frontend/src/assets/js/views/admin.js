window.views = window.views || {};

// Fallback de format (por si no existe en tu proyecto)
window.format = window.format || {
  moneyUSD(v) {
    const n = Number(v ?? 0);
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(isNaN(n) ? 0 : n);
  },
  truncHash(h) {
    const s = String(h ?? "");
    return s.length > 16 ? `${s.slice(0, 8)}…${s.slice(-6)}` : s || "-";
  },
};

window.views.admin = {
  async render() {
    const rows = await api.getPendingApprovals();

    const body =
      rows.length === 0
        ? `<tr><td class="p-6 text-sm text-slate-500" colspan="8">No hay facturas pendientes.</td></tr>`
        : rows
            .map((r) => {
              const lotLabel = `${r.lot || "—"}`;
              const lotMeta = `${r.lot_category || ""}`.trim();
              const total = typeof r.total === "number" ? r.total : Number(r.total);

              return `
                <tr class="hover:bg-slate-50 transition-colors">
                  <td class="p-4 text-sm text-slate-600 whitespace-nowrap">${r.date}</td>
                  <td class="p-4 text-sm font-medium text-slate-900">#${r.id}</td>
                  <td class="p-4 text-sm text-slate-800">${r.client}</td>
                  <td class="p-4 text-sm text-slate-700">
                    <div class="font-medium">${lotLabel}</div>
                    <div class="text-xs text-slate-500">${lotMeta} • Cant: <span class="font-mono">${r.lot_qty ?? "-"}</span></div>
                  </td>
                  <td class="p-4 text-sm text-emerald-700 font-bold text-right font-mono">${format.moneyUSD(total)}</td>
                  <td class="p-4 text-sm text-slate-500">${r.created_by || "-"}</td>
                  <td class="p-4">
                    <span class="text-xs font-semibold px-2 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                      PENDING_APPROVAL
                    </span>
                  </td>
                  <td class="p-4 text-right">
                    <div class="flex justify-end gap-2">
                      <button
                        class="rejectBtn px-3 py-2 rounded-lg text-xs font-medium border border-red-200 text-red-700 hover:bg-red-50 transition inline-flex items-center gap-2"
                        data-id="${r.id}">
                        <i data-lucide="x-circle" class="w-4 h-4"></i>
                        Rechazar
                      </button>

                      <button
                        class="approveBtn px-3 py-2 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primaryHover transition inline-flex items-center gap-2 shadow-sm"
                        data-id="${r.id}">
                        <i data-lucide="check-circle" class="w-4 h-4"></i>
                        Aprobar
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            })
            .join("");

    return `
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <i data-lucide="layout-dashboard" class="w-6 h-6 text-primary"></i>
            Pendientes de aprobación
          </h1>
          <p class="text-slate-500 text-sm">
            El blockchain se registra únicamente cuando el admin aprueba.
          </p>
        </div>

        <div class="flex gap-2">
          <button id="btnGoLedger" class="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-sm font-medium transition flex items-center gap-2">
            <i data-lucide="shield-check" class="w-4 h-4"></i>
            Ver Ledger
          </button>
        </div>
      </div>

      <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200">
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Factura</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Lote</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Total</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Creada por</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                <th class="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
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
    // Ir a ledger
    $("#btnGoLedger")?.addEventListener("click", () => {
      state.activeView = "ledger";
      window.appRender();
    });

    // Aprobar
    document.querySelectorAll(".approveBtn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        if (!id) return;

        const original = btn.innerHTML;
        try {
          btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Aprobando...`;
          lucide.createIcons();
          btn.classList.add("opacity-75", "cursor-not-allowed");

          const res = await api.approveInvoice(id);

          toast.show(`Aprobada. Hash: ${format.truncHash(res.hash)}`, "success");
          window.appRender();
        } catch (e) {
          toast.show(e.message || "No se pudo aprobar", "error");
        } finally {
          btn.innerHTML = original;
          btn.classList.remove("opacity-75", "cursor-not-allowed");
          lucide.createIcons();
        }
      });
    });

    // Rechazar
    document.querySelectorAll(".rejectBtn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        if (!id) return;

        modal.confirmDelete({
          title: "¿Rechazar factura?",
          message: "La factura quedará REJECTED y el lote vuelve a AVAILABLE (aparecerá de nuevo en bodega).",
          onConfirm: async () => {
            const original = btn.innerHTML;
            try {
              btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Rechazando...`;
              lucide.createIcons();
              btn.classList.add("opacity-75", "cursor-not-allowed");

              await api.rejectInvoice(id);

              toast.show("Factura rechazada. Lote liberado.", "info");
              window.appRender();
            } catch (e) {
              toast.show(e.message || "No se pudo rechazar", "error");
            } finally {
              btn.innerHTML = original;
              btn.classList.remove("opacity-75", "cursor-not-allowed");
              lucide.createIcons();
            }
          },
        });
      });
    });
  }
};
