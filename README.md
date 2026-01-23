# SDN + Blockchain — Trazabilidad Agroindustrial (AgroCacao SA) | Nexus System

Sistema web (SPA + API) para **trazabilidad y auditoría** de operaciones agroindustriales (ej. inventario de insumos y facturación), con **integridad tipo blockchain** (cadena de hashes) almacenada en PostgreSQL y desplegable en Kubernetes.

---

## Vista rápida

**Componentes**
- **Frontend (SPA)**: HTML/CSS/JS (Tailwind CDN + Lucide), servido por **Nginx**.
- **API**: **FastAPI** (Python) con autenticación y control por roles.
- **DB**: **PostgreSQL** con tablas de negocio y **ledger** (cadena de hashes).

**Roles**
- `bodega` → Inventario (listar/crear)
- `oficina` → Facturas (listar/crear)
- `admin` → Ledger completo + verificación de integridad

---

## Diagramas (colócalos aquí)

Recomendación: crear `docs/assets/` y colocar aquí imágenes para entender el sistema.

### 1) Arquitectura (recomendado)
> Diagrama tipo C4 o arquitectura general (Frontend ↔ API ↔ Postgres, Ingress, Services, Deployments).

![Arquitectura del sistema](docs/assets/arquitectura.png)

### 2) Modelo de datos (ERD)
![Modelo de datos](docs/assets/modelo-datos.png)

### 3) Secuencia (crear registro + hash + ledger)
![Secuencia: Creación de inventario/factura](docs/assets/secuencia-creacion.png)

---

## Estructura del repositorio

```txt
.
├── README.md
├── apps/
│   ├── frontend/
│   │   ├── Dockerfile
│   │   ├── nginx.conf
│   │   └── src/
│   │       ├── index.html
│   │       └── assets/
│   │           ├── css/base.css
│   │           └── js/
│   │               ├── app.js
│   │               ├── config.js
│   │               ├── state.js
│   │               ├── services/api.js
│   │               └── views/ (login, dashboard, inventory, invoices, ledger)
│   └── api/
│       ├── Dockerfile
│       ├── main.py
│       ├── db.py
│       ├── ledger.py
│       ├── backfill_payload.py
│       └── requirements.txt
├── infra/
│   └── k8s/
│       ├── 00-namespace.yaml
│       ├── 10-postgres.yaml
│       ├── 20-ledger.yaml              # placeholder (vacío)
│       ├── 30-api.yaml
│       ├── 40-frontend.yaml
│       ├── 50-ingress.yaml
│       └── 60-networkpolicies.yaml     # placeholder (vacío)
└── docs/
    ├── arquitectura.md       # placeholder (vacío)
    ├── endpoints.md          # placeholder (vacío)
    ├── modelo-datos.md       # placeholder (vacío)
    └── demo-script.md        # placeholder (vacío)
```

---

## Cómo funciona (alto nivel)

1. El usuario inicia sesión en el **Frontend**.
2. El Frontend llama a la **API** `POST /auth/login` → recibe `{ role, token }`.
3. El token se guarda en `localStorage` y se envía como `Authorization: Bearer <token>`.
4. Al crear un registro (inventario o factura), la API:
   - Inserta el registro de negocio (`inventory` o `invoices`).
   - Construye un **payload canónico** (JSON determinista).
   - Calcula el **hash** del bloque usando `prev_hash + ts + actor + action + tx_id + payload_json`.
   - Inserta un bloque en `ledger` y guarda el `hash` asociado.
5. El rol `admin` puede ejecutar verificación de integridad con `GET /ledger/verify` para recalcular la cadena completa.

---

## Credenciales (seed en DB)

En el `init.sql` del manifiesto de Postgres se crean usuarios:
- `bodega`
- `oficina`
- `admin`

**Nota:** en el seed actual, el password está vacío (`''`). En el login, la API compara texto plano; por tanto, puedes iniciar sesión dejando el password vacío si el seed está activo.

---

## Endpoints principales (API)

El Frontend usa `API_BASE` (por defecto `/api`) y Nginx proxya `/api/` hacia el Service de la API.

**Salud**
- `GET /health` → estado API
- `GET /db/ping` → prueba DB

**Auth**
- `POST /auth/login` → `{ username, password }` → `{ role, token }`

**Inventario (solo `bodega`)**
- `GET /inventory`
- `POST /inventory`

**Facturas (solo `oficina`)**
- `GET /invoices`
- `POST /invoices`

**Ledger (solo `admin`)**
- `GET /ledger`
- `GET /ledger/verify`

---

## Variables de entorno (API)

Definidas en `infra/k8s/30-api.yaml`:

- `NEXUS_TOKEN_SECRET` → firma HMAC del token
- `NEXUS_TOKEN_TTL` → tiempo de vida (segundos)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

---

## Modelo de datos (mínimo)

Tablas usadas por la app:

- `users(username, password, role)`
- `inventory(id, date, item, category, type, qty, username, hash)`
- `invoices(id, date, client, total, username, hash)`
- `ledger(id, ts, actor, action, tx_id, prev_hash, payload_json, hash)`

---

## Nota importante (para evitar errores al desplegar)

En `infra/k8s/10-postgres.yaml`, el `init.sql` actualmente crea `ledger` **sin** la columna `payload_json`, pero la API inserta y consulta `payload_json`.

Si despliegas Postgres usando ese init tal cual, la API puede fallar al insertar en `ledger`.

**Solución recomendada:** en `init.sql`, define `ledger` así (agrega `payload_json`):

```sql
CREATE TABLE IF NOT EXISTS ledger (
  id           SERIAL PRIMARY KEY,
  ts           TIMESTAMPTZ NOT NULL,
  actor        TEXT NOT NULL,
  action       TEXT NOT NULL,
  tx_id        TEXT NOT NULL,
  prev_hash    TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  hash         TEXT NOT NULL
);
```

---

## Ejecución rápida en Kubernetes

### Requisitos
- Cluster Kubernetes (kind/minikube/otro)
- `kubectl`
- Ingress controller NGINX instalado (Ingress usa `ingressClassName: nginx`)

### 1) Construir imágenes
Desde la raíz del repo:

```bash
docker build -t nexus-api:dev ./apps/api
docker build -t nexus-frontend:dev ./apps/frontend
```

> En kind/minikube normalmente debes “cargar” imágenes al cluster según tu entorno (p. ej. `kind load docker-image ...`).

### 2) Aplicar manifiestos
```bash
kubectl apply -f infra/k8s/00-namespace.yaml
kubectl apply -f infra/k8s/10-postgres.yaml
kubectl apply -f infra/k8s/30-api.yaml
kubectl apply -f infra/k8s/40-frontend.yaml
kubectl apply -f infra/k8s/50-ingress.yaml
```

### 3) Acceso
**Opción A: Ingress**
- Si tu Ingress expone host/IP, entra por `/`.

**Opción B: Port-forward (rápido)**
```bash
kubectl -n nexus port-forward svc/frontend 8080:80
```

Abrir: `http://localhost:8080`

---

## Modo “mock” (sin backend)

En `apps/frontend/src/assets/js/config.js`:

```js
window.APP_CONFIG = {
  API_BASE: "/api",
  USE_MOCK: false
};
```

Cambia `USE_MOCK: true` para usar datos simulados (útil para demo sin API/DB).

---

## Utilidad: backfill de payload_json

`apps/api/backfill_payload.py` sirve para completar `payload_json` en el ledger (si existen bloques sin payload).

Ejecuta el script dentro del contenedor de API (o con acceso directo a la DB) con las variables `DB_*` configuradas.

---

## Documentación (carpeta `docs/`)

Plantillas listas para completar:
- `docs/arquitectura.md` → explicación + diagrama C4
- `docs/modelo-datos.md` → ERD + diccionario de datos
- `docs/endpoints.md` → tabla de endpoints + ejemplos
- `docs/demo-script.md` → guion para demo (roles y flujo)

---

## Troubleshooting rápido

- **Login falla**: verifica que el usuario exista en `users` y que el password coincida (texto plano).
- **Frontend no llega a API**: revisa el proxy Nginx (ConfigMap `frontend-nginx`) y que el Service `api` esté activo.
- **Error de ledger / payload_json**: actualiza el `init.sql` y vuelve a inicializar DB (o aplica migración).

---

## Roadmap sugerido
- Hash de contraseñas (bcrypt/argon2) + tokens JWT estándar.
- NetworkPolicies reales (`60-networkpolicies.yaml`).
- Ledger como microservicio (`20-ledger.yaml`).
- Migraciones con Alembic (en vez de depender solo de init.sql).
