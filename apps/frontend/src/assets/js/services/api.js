// Cliente de API (mock vs real)
window.api = (function () {
  const cfg = window.APP_CONFIG || { API_BASE: "/api", USE_MOCK: true };

  function token() {
    return localStorage.getItem(state.tokenKey) || "";
  }

  async function request(path, { method = "GET", body = null, auth = true } = {}) {
    const headers = {};

    if (body !== null) headers["Content-Type"] = "application/json";

    if (auth) {
      const t = token();
      if (t) headers["Authorization"] = `Bearer ${t}`;
    }

    let res;
    try {
      res = await fetch(`${cfg.API_BASE}${path}`, {
        method,
        headers,
        body: body !== null ? JSON.stringify(body) : null,
      });
    } catch (e) {
      throw new Error("No se pudo conectar con la API (/api). Revisa Ingress/port-forward y el proxy del frontend.");
    }

    let data = null;
    const ct = res.headers.get("content-type") || "";

    if (ct.includes("application/json")) {
      data = await res.json().catch(() => null);
    } else {
      const text = await res.text().catch(() => "");
      data = text ? { message: text } : null;
    }

    if (!res.ok) {
      const msg = (data && (data.detail || data.message)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return data;
  }

  function mockLogin(username) {
    const u = (username || "").trim().toLowerCase();
    if (!roles[u]) throw new Error("Usuario o contraseña incorrectos");
    return { role: u, token: `mock-${u}` };
  }

  // Helpers mock: evita que se rompa si no están definidos
  function mockInventory() {
    return (state?.data?.inventory || []).map((x) => ({
      ...x,
      status: x.status || "AVAILABLE",
    }));
  }

  function mockInvoices() {
    return (state?.data?.invoices || []).map((x) => ({
      ...x,
      status: x.status || "PENDING_APPROVAL",
      hash: x.hash || "PENDING",
    }));
  }

  return {
    async health() {
      return await request("/health", { auth: false });
    },

    async login(username, password) {
      if (cfg.USE_MOCK) return mockLogin(username, password);
      return await request("/auth/login", { method: "POST", body: { username, password }, auth: false });
    },

    // -----------------------------
    // BODEGA: LOTES
    // -----------------------------
    async getInventory() {
      if (cfg.USE_MOCK) return mockInventory().filter((x) => (x.status || "AVAILABLE") === "AVAILABLE");
      return await request("/inventory");
    },

    // payload esperado: {date,item,category,qty}
    async createInventory(payload) {
      if (cfg.USE_MOCK) return { ok: true, id: Date.now() };
      return await request("/inventory", { method: "POST", body: payload });
    },

    // -----------------------------
    // OFICINA: LOTES DISPONIBLES -> FACTURA PENDIENTE
    // -----------------------------
    async getAvailableLots() {
      if (cfg.USE_MOCK) return mockInventory().filter((x) => (x.status || "AVAILABLE") === "AVAILABLE");
      return await request("/lots/available");
    },

    async getInvoices() {
      if (cfg.USE_MOCK) return mockInvoices();
      return await request("/invoices");
    },

    // payload esperado: {inventory_id,date,client,total}
    async createInvoice(payload) {
      if (cfg.USE_MOCK) return { ok: true, id: Date.now() };
      return await request("/invoices", { method: "POST", body: payload });
    },

    // -----------------------------
    // ADMIN: PENDIENTES + APROBAR/RECHAZAR
    // -----------------------------
    async getPendingApprovals() {
      if (cfg.USE_MOCK) return mockInvoices().filter((x) => (x.status || "PENDING_APPROVAL") === "PENDING_APPROVAL");
      return await request("/admin/pending");
    },

    async approveInvoice(id) {
      if (cfg.USE_MOCK) return { ok: true, id, tx_id: "MOCK_TX", hash: "mock-hash" };
      return await request(`/admin/invoices/${id}/approve`, { method: "POST" });
    },

    async rejectInvoice(id) {
      if (cfg.USE_MOCK) return { ok: true, id };
      return await request(`/admin/invoices/${id}/reject`, { method: "POST" });
    },

    // -----------------------------
    // LEDGER (solo admin)
    // -----------------------------
    async getLedger() {
      if (cfg.USE_MOCK) return state?.data?.ledger || [];
      return await request("/ledger");
    },

    async verifyChain() {
      if (cfg.USE_MOCK) return { ok: true, message: "Integridad OK (mock)" };
      return await request("/ledger/verify");
    },
  };
})();
