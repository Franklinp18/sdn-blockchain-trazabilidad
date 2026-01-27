from __future__ import annotations

import hashlib
import hmac
import os
import time
import uuid
from datetime import datetime
from typing import Dict, List, Literal, Optional

import psycopg
from fastapi import FastAPI, Header, HTTPException, status
from pydantic import BaseModel, Field

from db import dsn, fetch_all, fetch_one
from ledger import (
    canonical_payload,
    compute_block_hash,
    is_sha256_hex,
    make_tx_id,
    now_utc,
    normalize_hash,
)

TOKEN_SECRET = os.getenv("NEXUS_TOKEN_SECRET", "dev-secret-change-me")
TOKEN_TTL_SECONDS = int(os.getenv("NEXUS_TOKEN_TTL", "86400"))

RoleKey = Literal["bodega", "oficina", "admin"]
SESSIONS: Dict[str, Dict[str, object]] = {}

InventoryStatus = Literal["AVAILABLE", "RESERVED", "SOLD"]
InvoiceStatus = Literal["PENDING_APPROVAL", "APPROVED", "REJECTED"]


class LoginRequest(BaseModel):
    username: str
    password: Optional[str] = ""


class LoginResponse(BaseModel):
    role: RoleKey
    token: str


class VerifyResponse(BaseModel):
    ok: bool
    message: str


class InventoryCreate(BaseModel):
    date: str = Field(..., description="YYYY-MM-DD")
    item: str
    category: str
    type: str
    qty: int


class InvoiceCreate(BaseModel):
    # ahora oficina emite factura DESDE un lote
    inventory_id: int = Field(..., ge=1, description="ID del lote/inventario a facturar")
    date: str = Field(..., description="YYYY-MM-DD")
    client: str
    total: float


class ApproveResponse(BaseModel):
    ok: bool
    invoice_id: int
    status: InvoiceStatus
    hash: Optional[str] = None


# -----------------------------
# Auth
# -----------------------------
def _now() -> int:
    return int(time.time())


def _sign(payload: str) -> str:
    return hmac.new(TOKEN_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()


def issue_token(role: RoleKey) -> str:
    token_id = str(uuid.uuid4())
    exp = _now() + TOKEN_TTL_SECONDS
    payload = f"{token_id}.{exp}.{role}"
    sig = _sign(payload)
    token = f"{token_id}.{exp}.{role}.{sig}"
    SESSIONS[token] = {"role": role, "exp": exp}
    return token


def require_auth(authorization: Optional[str]) -> RoleKey:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Falta token Bearer")

    token = authorization.split(" ", 1)[1].strip()
    sess = SESSIONS.get(token)
    if not sess:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    exp = int(sess.get("exp", 0))
    if _now() > exp:
        SESSIONS.pop(token, None)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")

    role = sess.get("role")
    if role not in ("bodega", "oficina", "admin"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token sin rol")
    return role  # type: ignore


def require_role(actual: RoleKey, allowed: List[RoleKey]) -> None:
    if actual not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado para este recurso")


# -----------------------------
# Ledger helpers
# -----------------------------
def get_last_ledger_hash(cur) -> str:
    cur.execute("SELECT hash FROM ledger ORDER BY id DESC LIMIT 1;")
    row = cur.fetchone()
    if not row:
        return "0" * 64
    return str(row[0])


def insert_ledger(cur, actor: str, action: str, tx_id: str, payload: dict) -> str:
    prev_hash = normalize_hash(get_last_ledger_hash(cur))
    ts: datetime = now_utc()
    ts_iso = ts.isoformat()

    payload_json = canonical_payload(payload)
    block_hash = compute_block_hash(prev_hash, ts_iso, actor, action, tx_id, payload_json)

    cur.execute(
        """
        INSERT INTO ledger(ts, actor, action, tx_id, prev_hash, payload_json, hash)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING hash;
        """,
        (ts, actor, action, tx_id, prev_hash, payload_json, block_hash),
    )
    return str(cur.fetchone()[0])


def verify_chain_full(cur) -> bool:
    cur.execute(
        """
        SELECT id, ts, actor, action, tx_id, prev_hash, payload_json, hash
        FROM ledger
        ORDER BY id;
        """
    )
    rows = cur.fetchall()
    if not rows:
        return True

    real = [r for r in rows if is_sha256_hex(str(r[7]))]
    if not real:
        return True

    for i in range(1, len(real)):
        if str(real[i][5]) != str(real[i - 1][7]):
            return False

    for r in real:
        ts: datetime = r[1]
        ts_iso = ts.isoformat()
        actor = str(r[2])
        action = str(r[3])
        tx_id = str(r[4])
        prev_hash = str(r[5])
        payload_json = str(r[6] or "{}")
        stored_hash = str(r[7])

        expected = compute_block_hash(prev_hash, ts_iso, actor, action, tx_id, payload_json)
        if expected != stored_hash:
            return False

    return True


# -----------------------------
# Schema migration (safe)
# -----------------------------
def ensure_schema() -> None:
    with psycopg.connect(dsn()) as conn:
        with conn.cursor() as cur:
            # ledger.payload_json (tu API ya lo usa)
            cur.execute("ALTER TABLE ledger ADD COLUMN IF NOT EXISTS payload_json TEXT;")

            # inventory.status
            cur.execute("ALTER TABLE inventory ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'AVAILABLE';")

            # invoices: status + relación a inventory
            cur.execute("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'APPROVED';")
            cur.execute("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS inventory_id INT;")
            # FK si no existe (Postgres no tiene IF NOT EXISTS para FK, así que lo intentamos)
            try:
                cur.execute(
                    """
                    ALTER TABLE invoices
                    ADD CONSTRAINT invoices_inventory_fk
                    FOREIGN KEY (inventory_id) REFERENCES inventory(id);
                    """
                )
            except Exception:
                conn.rollback()
                # si ya existe o falla por datos previos, seguimos (no es crítico para arrancar)
            else:
                conn.commit()

        conn.commit()


# -----------------------------
# App
# -----------------------------
app = FastAPI(title="Nexus API", version="0.5.0")


@app.on_event("startup")
def _startup():
    ensure_schema()


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/db/ping")
def db_ping():
    row = fetch_one("SELECT 1 AS ok;")
    return {"ok": bool(row and row.get("ok") == 1)}


@app.post("/auth/login", response_model=LoginResponse)
def login(body: LoginRequest):
    username = body.username.strip().lower()
    user = fetch_one("SELECT username, password, role FROM users WHERE username = %s;", (username,))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario o contraseña incorrectos")

    expected = (user.get("password") or "").strip()
    provided = (body.password or "").strip()
    if expected != provided:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario o contraseña incorrectos")

    role: RoleKey = user["role"]  # type: ignore
    return LoginResponse(role=role, token=issue_token(role))


# -----------------------------
# Bodega
# -----------------------------
@app.get("/inventory")
def get_inventory(authorization: Optional[str] = Header(default=None)):
    role = require_auth(authorization)
    require_role(role, ["bodega"])
    # bodega solo ve lo disponible (los reservados/vendidos ya no deben salir)
    return fetch_all(
        """
        SELECT id, date, item, category, type, qty, username AS "user", hash
        FROM inventory
        WHERE status = 'AVAILABLE'
        ORDER BY id;
        """
    )


@app.post("/inventory")
def create_inventory(body: InventoryCreate, authorization: Optional[str] = Header(default=None)):
    role = require_auth(authorization)
    require_role(role, ["bodega"])

    # Crear lote: NO ledger aún. Queda AVAILABLE y hash PENDING
    with psycopg.connect(dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO inventory(date, item, category, type, qty, username, hash, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'AVAILABLE')
                RETURNING id;
                """,
                (body.date, body.item, body.category, body.type, body.qty, role, "PENDING"),
            )
            inv_id = int(cur.fetchone()[0])
            return {"ok": True, "id": inv_id, "status": "AVAILABLE"}


# -----------------------------
# Oficina
# -----------------------------
@app.get("/lots/available")
def lots_available(authorization: Optional[str] = Header(default=None)):
    role = require_auth(authorization)
    require_role(role, ["oficina"])
    return fetch_all(
        """
        SELECT id, date, item, category, type, qty, username AS "user", hash
        FROM inventory
        WHERE status = 'AVAILABLE'
        ORDER BY id;
        """
    )


@app.get("/invoices")
def get_invoices(authorization: Optional[str] = Header(default=None)):
    role = require_auth(authorization)
    require_role(role, ["oficina"])
    rows = fetch_all(
        """
        SELECT id, inventory_id, date, client, total, status, username AS "user", hash
        FROM invoices
        ORDER BY id DESC;
        """
    )
    for r in rows:
        if "total" in r and r["total"] is not None:
            r["total"] = float(r["total"])
    return rows


@app.post("/invoices")
def create_invoice(body: InvoiceCreate, authorization: Optional[str] = Header(default=None)):
    role = require_auth(authorization)
    require_role(role, ["oficina"])

    with psycopg.connect(dsn()) as conn:
        with conn.cursor() as cur:
            # 1) validar lote disponible
            cur.execute("SELECT status, qty, item, category FROM inventory WHERE id = %s;", (body.inventory_id,))
            inv = cur.fetchone()
            if not inv:
                raise HTTPException(status_code=404, detail="Lote no encontrado")
            if str(inv[0]) != "AVAILABLE":
                raise HTTPException(status_code=409, detail="El lote ya no está disponible")

            # 2) crear factura pendiente
            cur.execute(
                """
                INSERT INTO invoices(inventory_id, date, client, total, status, username, hash)
                VALUES (%s, %s, %s, %s, 'PENDING_APPROVAL', %s, %s)
                RETURNING id;
                """,
                (body.inventory_id, body.date, body.client, body.total, role, "PENDING"),
            )
            invc_id = int(cur.fetchone()[0])

            # 3) reservar lote para que no aparezca en bodega
            cur.execute("UPDATE inventory SET status = 'RESERVED' WHERE id = %s;", (body.inventory_id,))

            return {"ok": True, "id": invc_id, "status": "PENDING_APPROVAL"}


# -----------------------------
# Admin (pendientes + aprobación)
# -----------------------------
@app.get("/admin/pending")
def admin_pending(authorization: Optional[str] = Header(default=None)):
    role = require_auth(authorization)
    require_role(role, ["admin"])
    return fetch_all(
        """
        SELECT i.id,
               i.inventory_id,
               i.date,
               i.client,
               i.total,
               i.status,
               i.username AS "user",
               i.hash,
               inv.item AS lot_item,
               inv.category AS lot_category,
               inv.qty AS lot_qty,
               inv.status AS lot_status
        FROM invoices i
        LEFT JOIN inventory inv ON inv.id = i.inventory_id
        WHERE i.status = 'PENDING_APPROVAL'
        ORDER BY i.id DESC;
        """
    )


@app.post("/admin/invoices/{invoice_id}/approve", response_model=ApproveResponse)
def admin_approve(invoice_id: int, authorization: Optional[str] = Header(default=None)):
    role = require_auth(authorization)
    require_role(role, ["admin"])

    with psycopg.connect(dsn()) as conn:
        with conn.cursor() as cur:
            # leer invoice + lote
            cur.execute(
                """
                SELECT i.id, i.inventory_id, i.date, i.client, i.total, i.status,
                       inv.item, inv.category, inv.qty, inv.status
                FROM invoices i
                LEFT JOIN inventory inv ON inv.id = i.inventory_id
                WHERE i.id = %s;
                """,
                (invoice_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Factura no encontrada")

            inv_id = row[1]
            inv_status = str(row[9] or "")
            inv_item = row[6]
            inv_cat = row[7]
            inv_qty = row[8]

            if str(row[5]) != "PENDING_APPROVAL":
                raise HTTPException(status_code=409, detail="La factura no está pendiente")

            if inv_id is None:
                raise HTTPException(status_code=409, detail="Factura sin lote asociado")

            if inv_status not in ("RESERVED", "AVAILABLE"):
                raise HTTPException(status_code=409, detail="El lote no está en estado aprobable")

            # 1) aprobar + marcar lote como SOLD
            cur.execute("UPDATE invoices SET status = 'APPROVED' WHERE id = %s;", (invoice_id,))
            cur.execute("UPDATE inventory SET status = 'SOLD' WHERE id = %s;", (inv_id,))

            # 2) escribir blockchain (ledger) recién aquí
            tx_id = make_tx_id("APPROVE", invoice_id)
            payload = {
                "invoice_id": invoice_id,
                "inventory_id": inv_id,
                "date": str(row[2]),
                "client": str(row[3]),
                "total": float(row[4]),
                "lot": {"item": inv_item, "category": inv_cat, "qty": inv_qty},
                "approved_by": role,
            }
            block_hash = insert_ledger(cur, actor=role, action="INVOICE_APPROVED", tx_id=tx_id, payload=payload)

            # 3) guardar hash real
            cur.execute("UPDATE invoices SET hash = %s WHERE id = %s;", (block_hash, invoice_id))
            cur.execute("UPDATE inventory SET hash = %s WHERE id = %s;", (block_hash, inv_id))

            return ApproveResponse(ok=True, invoice_id=invoice_id, status="APPROVED", hash=block_hash)


@app.post("/admin/invoices/{invoice_id}/reject", response_model=ApproveResponse)
def admin_reject(invoice_id: int, authorization: Optional[str] = Header(default=None)):
    role = require_auth(authorization)
    require_role(role, ["admin"])

    with psycopg.connect(dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, inventory_id, status FROM invoices WHERE id = %s;", (invoice_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Factura no encontrada")
            if str(row[2]) != "PENDING_APPROVAL":
                raise HTTPException(status_code=409, detail="La factura no está pendiente")

            inv_id = row[1]
            cur.execute("UPDATE invoices SET status = 'REJECTED' WHERE id = %s;", (invoice_id,))
            # liberar lote (vuelve a AVAILABLE)
            if inv_id is not None:
                cur.execute("UPDATE inventory SET status = 'AVAILABLE' WHERE id = %s;", (inv_id,))

            return ApproveResponse(ok=True, invoice_id=invoice_id, status="REJECTED", hash=None)


# -----------------------------
# Ledger (auditoría)
# -----------------------------
@app.get("/ledger")
def get_ledger(authorization: Optional[str] = Header(default=None)):
    role = require_auth(authorization)
    require_role(role, ["admin"])
    return fetch_all(
        """
        SELECT id,
               ts AS "timestamp",
               actor, action, tx_id, prev_hash,
               payload_json,
               hash
        FROM ledger
        ORDER BY id;
        """
    )


@app.get("/ledger/verify", response_model=VerifyResponse)
def ledger_verify(authorization: Optional[str] = Header(default=None)):
    role = require_auth(authorization)
    require_role(role, ["admin"])
    with psycopg.connect(dsn()) as conn:
        with conn.cursor() as cur:
            ok = verify_chain_full(cur)
    return VerifyResponse(ok=ok, message=("Integridad OK" if ok else "Integridad con errores"))
