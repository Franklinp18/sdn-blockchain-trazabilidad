// Estado global (simple y explícito)
window.state = {
  currentUser: null,
  view: "login", // "login" | "dashboard"
  roleKey: "nexus_role", // localStorage key
  tokenKey: "nexus_token", // localStorage key
  data: {
    inventory: [
      { id: 1, date: '2023-10-24', item: 'Fertilizante NPK', category: 'Fertilizante', type: 'Entrada', qty: 50, user: 'bodega', hash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4' },
      { id: 2, date: '2023-10-25', item: 'Semilla Cacao CCN-51', category: 'Semilla', type: 'Salida', qty: 12, user: 'bodega', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
    ],
    invoices: [
      { id: 101, date: '2023-10-24', client: 'Comprador Local', total: 4500.00, user: 'oficina', hash: 'a1b2c3d4e5f67890123456789abcdef1234567890abcdef1234567890abcde' },
      { id: 102, date: '2023-10-25', client: 'Consumidor Final', total: 120.50, user: 'oficina', hash: 'f1e2d3c4b5a69870123456789abcdef1234567890abcdef1234567890abcde' },
    ],
    ledger: [
      { id: 1, timestamp: '2023-10-24 08:30:00', actor: 'system', action: 'INIT_GENESIS', tx_id: 'TX_0000', prev_hash: '0000000000000000', hash: 'INIT_HASH_GENESIS_BLOCK_SECURE' },
      { id: 2, timestamp: '2023-10-24 09:15:22', actor: 'bodega', action: 'INV_ADD', tx_id: 'TX_3921', prev_hash: 'INIT_HASH_GEN...', hash: '8f434346648f6b96df89dda901c5' },
      { id: 3, timestamp: '2023-10-25 10:00:01', actor: 'oficina', action: 'INV_CREATE', tx_id: 'TX_4022', prev_hash: '8f434346648...', hash: 'a1b2c3d4e5f67890123456789abc' },
    ]
  }
};

// Roles demo (simulación)
window.roles = {
  bodega:   { name: "Juan Pérez", role: "EmpleadoDeBodega", badge: "bg-blue-100 text-blue-700" },
  oficina:  { name: "Ana López",  role: "EmpleadoDeAdministración", badge: "bg-purple-100 text-purple-700" },
  admin:    { name: "Carlos Master", role: "Administrador", badge: "bg-slate-800 text-white" },
};

// Helpers de sesión
window.session = {
  load() {
    const role = localStorage.getItem(state.roleKey);
    const token = localStorage.getItem(state.tokenKey);
    if (role && token && roles[role]) {
      state.currentUser = { ...roles[role], username: role };
      state.view = "dashboard";
    }
  },
  set(role, token) {
    localStorage.setItem(state.roleKey, role);
    localStorage.setItem(state.tokenKey, token);
    state.currentUser = { ...roles[role], username: role };
    state.view = "dashboard";
  },
  clear() {
    localStorage.removeItem(state.roleKey);
    localStorage.removeItem(state.tokenKey);
    state.currentUser = null;
    state.view = "login";
  }
};

