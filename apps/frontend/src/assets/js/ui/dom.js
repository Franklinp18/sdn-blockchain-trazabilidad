// Helpers DOM
window.$ = (sel) => document.querySelector(sel);

window.dom = {
  setHTML(idOrEl, html) {
    const el = typeof idOrEl === "string" ? $(idOrEl) : idOrEl;
    if (!el) return;
    el.innerHTML = html;
  }
};

window.format = {
  moneyUSD(v) {
    try {
      return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(v);
    } catch {
      return `$${Number(v).toFixed(2)}`;
    }
  },
  truncHash(hash) {
    if (!hash) return "—";
    if (hash.length <= 18) return hash;
    return hash.substring(0, 10) + "..." + hash.substring(hash.length - 8);
  }
};

