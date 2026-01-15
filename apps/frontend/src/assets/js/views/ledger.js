window.views = window.views || {};

views.ledger = {
  async render() {
    const rows = await api.getLedger();
    return `
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
            Auditoría / Ledger
          </h1>
          <p class="text-slate-500 text-sm">Registro encadenado de acciones (hash + prev_hash).</p>
        </div>
        <div>
          <button id="verify-btn" class="px-6 py-2.5 bg-slate-800 hover:bg-black text-white rounded-lg text-sm font-medium shadow-lg shadow-slate-500/30 transition flex items-center gap-2">
            <i data-lucide="check-circle" class="w-4 h-4"></i> VERIFICAR CADENA
          </button>
        </div>
      </div>

      <div class="bg-slate-900 rounded-xl shadow-xl overflow-hidden border border-slate-800 text-slate-300 font-mono text-xs md:text-sm">
        <div class="bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center">
          <span class="text-slate-400 uppercase tracking-widest text-[10px] font-bold">Ledger Stream</span>
          <div class="flex gap-1.5">
            <div class="w-2.5 h-2.5 rounded-full bg-red-500/20"></div>
            <div class="w-2.5 h-2.5 rounded-full bg-yellow-500/20"></div>
            <div class="w-2.5 h-2.5 rounded-full bg-emerald-500/20"></div>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-slate-800/50 text-slate-400">
              <tr>
                <th class="p-4 font-normal">Timestamp</th>
                <th class="p-4 font-normal">Actor</th>
                <th class="p-4 font-normal">Action</th>
                <th class="p-4 font-normal">Tx_ID</th>
                <th class="p-4 font-normal">Prev_Hash</th>
                <th class="p-4 font-normal">Current_Hash</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/50">
              ${rows.map(r => `
                <tr class="hover:bg-slate-800/30 transition-colors">
                  <td class="p-4 text-emerald-400 whitespace-nowrap">${r.timestamp}</td>
                  <td class="p-4 text-yellow-200">${r.actor}</td>
                  <td class="p-4 font-bold text-white">${r.action}</td>
                  <td class="p-4 opacity-50">${r.tx_id}</td>
                  <td class="p-4 opacity-50 truncate max-w-[120px]" title="${r.prev_hash}">${r.prev_hash}</td>
                  <td class="p-4 text-blue-300 truncate max-w-[160px]" title="${r.hash}">${r.hash}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="p-3 bg-slate-950 text-center text-slate-600 text-[10px]">
          END OF LEDGER • ${rows.length} BLOCKS
        </div>
      </div>
    `;
  },

  bind() {
    $("#verify-btn")?.addEventListener("click", async () => {
      const btn = $("#verify-btn");
      const original = btn.innerHTML;

      btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> VERIFICANDO...`;
      lucide.createIcons();
      btn.classList.add("opacity-75", "cursor-not-allowed");

      try {
        const res = await api.verifyChain();
        toast.show(res.message || (res.ok ? "Cadena OK" : "Cadena con errores"), res.ok ? "success" : "error");
      } catch (e) {
        toast.show(e.message || "Error al verificar", "error");
      } finally {
        btn.innerHTML = original;
        btn.classList.remove("opacity-75", "cursor-not-allowed");
        lucide.createIcons();
      }
    });
  }
};

