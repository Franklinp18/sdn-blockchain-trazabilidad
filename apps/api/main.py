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
    date: str = Field(..., description="YYYY-MM-DD")
    client: str
    total: float


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

    # Validaremos solo bloques "reales" (sha256 de 64 hex).
    real = [r for r in rows if is_sha256_hex(str(r[7]))]

    # Si aún no hay bloques reales, no podemos verificar criptográficamente.
    if not real:
        return True

    # 1) Encadenamiento SOLO entre bloques reales:
    #    cada prev_hash de un bloque real debe ser igual al hash del bloque real anterior.
    for i in range(1, len(real)):
        if str(real[i][5]) != str(real[i - 1][7]):
            return False

    # 2) Recalcular hash SHA256 y comparar (estricto)
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
# App
# -----------------------------
app = FastAPI(title="Nexus API", version="0.4.0")


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


@app.get("/inventory")
def get_inventory(authorization: Optional[str] = Header(default=None)):
    role = require_auth(authorization)
    require_role(role, ["bodega"])
    return fetch_all(
        """
        SELECT id, date, item, category, type, qty, username AS "user", hash
        FROM inventory
        ORDER BY id;
        """
    )


@app.post("/inventory")
def create_inventory(body: InventoryCreate, authorization: Optional[str] = Header(default=None)):
    role = require_auth(authorization)
    require_role(role, ["bodega"])

    with psycopg.connect(dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO inventory(date, item, category, type, qty, username, hash)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id;
                """,
                (body.date, body.item, body.category, body.type, body.qty, role, "PENDING"),
            )
            inv_id = int(cur.fetchone()[0])
            tx_id = make_tx_id("INV", inv_id)

            payload = {
                "inventory_id": inv_id,
                "date": body.date,
                "item": body.item,
                "category": body.category,
                "type": body.type,
                "qty": body.qty,
                "user": role,
            }
            block_hash = insert_ledger(cur, actor=role, action="INVENTORY_CREATE", tx_id=tx_id, payload=payload)

            cur.execute("UPDATE inventory SET hash = %s WHERE id = %s;", (block_hash, inv_id))
            return {"ok": True, "id": inv_id, "tx_id": tx_id, "hash": block_hash}


@app.get("/invoices")
def get_invoices(authorization: Optional[str] = Header(default=None)):
    role = require_auth(authorization)
    require_role(role, ["oficina"])
    rows = fetch_all(
        """
        SELECT id, date, client, total, username AS "user", hash
        FROM invoices
        ORDER BY id;
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
            cur.execute(
                """
                INSERT INTO invoices(date, client, total, username, hash)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id;
                """,
                (body.date, body.client, body.total, role, "PENDING"),
            )
            invc_id = int(cur.fetchone()[0])
            tx_id = make_tx_id("BILL", invc_id)

            payload = {
                "invoice_id": invc_id,
                "date": body.date,
                "client": body.client,
                "total": float(body.total),
                "user": role,
            }
            block_hash = insert_ledger(cur, actor=role, action="INVOICE_CREATE", tx_id=tx_id, payload=payload)

            cur.execute("UPDATE invoices SET hash = %s WHERE id = %s;", (block_hash, invc_id))
            return {"ok": True, "id": invc_id, "tx_id": tx_id, "hash": block_hash}


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
