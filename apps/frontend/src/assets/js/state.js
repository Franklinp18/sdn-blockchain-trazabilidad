// Estado global (simple y explícito)
window.state = {
  currentUser: null,
  view: "login", // "login" | "dashboard"
  activeView: null, // "inventory" | "invoices" | "admin" | "ledger"
  roleKey: "nexus_role", // localStorage key
  tokenKey: "nexus_token", // localStorage key

  // Data mock (solo para USE_MOCK=true)
  data: {
    inventory: [
      { id: 1, date: "2023-10-24", item: "Lote-CCN51-0001", category: "Cacao CCN-51", qty: 50, status: "AVAILABLE", user: "bodega", hash: "PENDING" },
      { id: 2, date: "2023-10-25", item: "Lote-CCN51-0002", category: "Cacao CCN-51", qty: 12, status: "AVAILABLE", user: "bodega", hash: "PENDING" },
    ],
    invoices: [
      {
        id: 101,
        inventory_id: 1,
        date: "2023-10-26",
        client: "Comprador Local",
        total: 4500.0,
        status: "PENDING_APPROVAL",
        user: "oficina",
        lot: "Lote-CCN51-0001",
        lot_category: "Cacao CCN-51",
        lot_qty: 50,
        hash: "PENDING",
      },
      {
        id: 102,
        inventory_id: 2,
        date: "2023-10-27",
        client: "Consumidor Final",
        total: 120.5,
        status: "PENDING_APPROVAL",
        user: "oficina",
        lot: "Lote-CCN51-0002",
        lot_category: "Cacao CCN-51",
        lot_qty: 12,
        hash: "PENDING",
      },
    ],
    ledger: [
      { id: 1, timestamp: "2023-10-24 08:30:00", actor: "system", action: "INIT_GENESIS", tx_id: "TX_0000", prev_hash: "0000000000000000", hash: "INIT_HASH_GENESIS_BLOCK_SECURE" },
    ],
  },
};

// Roles demo (nombres bonitos), pero el ROL real siempre será: bodega | oficina | admin
window.roles = {
  bodega: { name: "Juan Pérez", badge: "bg-blue-100 text-blue-700" },
  oficina: { name: "Ana López", badge: "bg-purple-100 text-purple-700" },
  admin: { name: "Carlos Master", badge: "bg-slate-800 text-white" },
};

// Helpers de sesión
window.session = {
  load() {
    const role = (localStorage.getItem(state.roleKey) || "").toLowerCase();
    const token = (localStorage.getItem(state.tokenKey) || "").trim();

    if (role && token && roles[role]) {
      state.currentUser = { name: roles[role].name, role, username: role };
      state.view = "dashboard";
    }
  },

  set(role, token) {
    const r = (role || "").toLowerCase();
    localStorage.setItem(state.roleKey, r);
    localStorage.setItem(state.tokenKey, token);

    // currentUser.role = rol real del sistema (bodega/oficina/admin)
    state.currentUser = { name: roles[r]?.name || r, role: r, username: r };
    state.view = "dashboard";
  },

  clear() {
    localStorage.removeItem(state.roleKey);
    localStorage.removeItem(state.tokenKey);
    state.currentUser = null;
    state.view = "login";
    state.activeView = null;
  },
};


