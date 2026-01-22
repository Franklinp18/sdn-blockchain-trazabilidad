from __future__ import annotations

import hashlib
import hmac
import os
import time
import uuid
from typing import Dict, List, Literal, Optional

from fastapi import FastAPI, Header, HTTPException, status
from pydantic import BaseModel

from db import fetch_all, fetch_one

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


def verify_chain_rows(rows: List[dict]) -> bool:
    if not rows:
        return True
    # Ordenados por id: cada bloque i debe tener prev_hash == hash del i-1
    for i in range(1, len(rows)):
        if str(rows[i]["prev_hash"]) != str(rows[i - 1]["hash"]):
            return False
    return True


app = FastAPI(title="Nexus API", version="0.2.0")


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
    user = fetch_one(
        "SELECT username, password, role FROM users WHERE username = %s;",
        (username,),
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario o contraseña incorrectos")

    expected = (user.get("password") or "").strip()
    provided = (body.password or "").strip()

    # Password simple por ahora (luego lo hashéas)
    if expected != provided:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario o contraseña incorrectos")

    role: RoleKey = user["role"]  # type: ignore
    return LoginResponse(role=role, token=issue_token(role))


@app.get("/inventory")
def get_inventory(authorization: Optional[str] = Header(default=None)):
    role = require_auth(authorization)
    require_role(role, ["bodega"])

    rows = fetch_all(
        """
        SELECT id, date, item, category, type, qty, username AS "user", hash
        FROM inventory
        ORDER BY id;
        """
    )
    return rows


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
    # Convert total to float to avoid JSON issues
    for r in rows:
        if "total" in r and r["total"] is not None:
            r["total"] = float(r["total"])
    return rows


@app.get("/ledger")
def get_ledger(authorization: Optional[str] = Header(default=None)):
    role = require_auth(authorization)
    require_role(role, ["admin"])

    rows = fetch_all(
        """
        SELECT id, ts AS "timestamp", actor, action, tx_id, prev_hash, hash
        FROM ledger
        ORDER BY id;
        """
    )
    return rows


@app.get("/ledger/verify", response_model=VerifyResponse)
def verify(authorization: Optional[str] = Header(default=None)):
    role = require_auth(authorization)
    require_role(role, ["admin"])

    rows = fetch_all("SELECT id, prev_hash, hash FROM ledger ORDER BY id;")
    ok = verify_chain_rows(rows)
    return VerifyResponse(ok=ok, message=("Integridad OK" if ok else "Integridad con errores"))
