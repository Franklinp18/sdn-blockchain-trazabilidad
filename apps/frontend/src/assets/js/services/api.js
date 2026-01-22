// Cliente de API (mock vs real)
window.api = (function () {
  const cfg = window.APP_CONFIG || { API_BASE: "/api", USE_MOCK: true };

  function token() {
    return localStorage.getItem(state.tokenKey) || "";
  }

  async function request(path, { method = "GET", body = null, auth = true } = {}) {
    const headers = { "Content-Type": "application/json" };

    if (auth) {
      const t = token();
      if (t) headers["Authorization"] = `Bearer ${t}`;
    }

    const res = await fetch(`${cfg.API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

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

  return {
    async login(username, password) {
      if (cfg.USE_MOCK) return mockLogin(username, password);
      return await request("/auth/login", { method: "POST", body: { username, password }, auth: false });
    },

    async getInventory() {
      if (cfg.USE_MOCK) return state.data.inventory;
      return await request("/inventory");
    },

    async getInvoices() {
      if (cfg.USE_MOCK) return state.data.invoices;
      return await request("/invoices");
    },

    async getLedger() {
      if (cfg.USE_MOCK) return state.data.ledger;
      return await request("/ledger");
    },

    async verifyChain() {
      if (cfg.USE_MOCK) return { ok: true, message: "Integridad OK (mock)" };
      return await request("/ledger/verify");
    },
  };
})();
