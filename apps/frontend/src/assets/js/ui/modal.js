window.modal = {
  open(html) {
    const overlay = $("#modal-overlay");
    const content = $("#modal-content");
    if (!overlay || !content) return;

    content.innerHTML = html;
    overlay.classList.remove("hidden");

    // Re-render icons inside modal
    if (window.lucide) window.lucide.createIcons();
  },

  close() {
    const overlay = $("#modal-overlay");
    if (!overlay) return;
    overlay.classList.add("hidden");
  },

  confirmDelete({ title = "¿Confirmar eliminación?", message = "Esta acción no se puede deshacer.", onConfirm }) {
    const html = `
      <div class="p-6 text-center">
        <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
          <i data-lucide="alert-triangle" class="w-6 h-6"></i>
        </div>
        <h3 class="text-lg font-bold text-slate-800 mb-2">${title}</h3>
        <p class="text-slate-500 text-sm mb-6">${message}</p>
        <div class="flex gap-3 justify-center">
          <button id="modalCancel" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition">Cancelar</button>
          <button id="modalOk" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-red-500/30">Confirmar</button>
        </div>
      </div>
    `;
    this.open(html);

    $("#modalCancel").addEventListener("click", () => this.close());
    $("#modalOk").addEventListener("click", () => {
      this.close();
      onConfirm?.();
    });
  },

  showHash(hash) {
    const safe = String(hash || "");
    const html = `
      <div class="p-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-sm font-bold text-slate-800 uppercase tracking-wide">Detalle del Hash</h3>
          <button id="modalClose" class="text-slate-400 hover:text-slate-600">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div class="bg-slate-900 p-4 rounded-lg text-slate-300 font-mono text-xs break-all leading-relaxed shadow-inner">
          <span class="text-slate-500 block mb-1 font-bold text-[10px]">FULL HASH:</span>
          ${safe}
        </div>
        <div class="mt-4 flex justify-end">
          <button id="copyHash" class="text-primary text-xs font-medium hover:underline flex items-center gap-1">
            <i data-lucide="copy" class="w-3 h-3"></i> Copiar
          </button>
        </div>
      </div>
    `;
    this.open(html);

    $("#modalClose").addEventListener("click", () => this.close());
    $("#copyHash").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(safe);
        toast.show("Hash copiado al portapapeles", "success");
      } catch {
        toast.show("No se pudo copiar el hash", "error");
      }
    });
  }
};

// Cerrar modal al dar click afuera
document.addEventListener("click", (e) => {
  const overlay = $("#modal-overlay");
  if (!overlay) return;
  if (!overlay.classList.contains("hidden") && e.target === overlay) {
    modal.close();
  }
});

