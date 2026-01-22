from __future__ import annotations

import hashlib
import hmac
import os
import time
import uuid
from typing import Dict, List, Literal, Optional

from fastapi import FastAPI, Header, HTTPException, status
from pydantic import BaseModel

TOKEN_SECRET = os.getenv("NEXUS_TOKEN_SECRET", "dev-secret-change-me")
TOKEN_TTL_SECONDS = int(os.getenv("NEXUS_TOKEN_TTL", "86400"))  # 24h

RoleKey = Literal["bodega", "oficina", "admin"]

USERS: Dict[str, Dict[str, str]] = {
    "bodega": {"password": "", "role": "bodega"},
    "oficina": {"password": "", "role": "oficina"},
    "admin": {"password": "", "role": "admin"},
}

SESSIONS: Dict[str, Dict[str, object]] = {}

INVENTORY = [
    {"id": 1, "date": "2023-10-24", "item": "Fertilizante NPK", "category": "Fertilizante", "type": "Entrada", "qty": 50, "user": "bodega", "hash": "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4"},
    {"id": 2, "date": "2023-10-25", "item": "Semilla Cacao CCN-51", "category": "Semilla", "type": "Salida", "qty": 12, "user": "bodega", "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},
]

INVOICES = [
    {"id": 101, "date": "2023-10-24", "client": "Comprador Local", "total": 4500.00, "user": "oficina", "hash": "a1b2c3d4e5f67890123456789abcdef1234567890abcdef1234567890abcde"},
    {"id": 102, "date": "2023-10-25", "client": "Consumidor Final", "total": 120.50, "user": "oficina", "hash": "f1e2d3c4b5a69870123456789abcdef1234567890abcdef1234567890abcde"},
]

LEDGER = [
    {"id": 1, "timestamp": "2023-10-24 08:30:00", "actor": "system", "action": "INIT_GENESIS", "tx_id": "TX_0000", "prev_hash": "0000000000000000", "hash": "INIT_HASH_GENESIS_BLOCK_SECURE"},
    {"id": 2, "timestamp": "2023-10-24 09:15:22", "actor": "bodega", "action": "INV_ADD", "tx_id": "TX_3921", "prev_hash": "INIT_HASH_GEN...", "hash": "8f434346648f6b96df89dda901c5"},
    {"id": 3, "timestamp": "2023-10-25 10:00:01", "actor": "oficina", "action": "INV_CREATE", "tx_id": "TX_4022", "prev_hash": "8f434346648...", "hash": "a1b2c3d4e5f67890123456789abc"},
]

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

def verify_chain() -> bool:
    if not LEDGER:
        return True
    for i in range(1, len(LEDGER)):
        if not str(LEDGER[i].get("prev_hash", "")).strip():
            return False
    return True

app = FastAPI(title="Nexus API", version="0.1.0")

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/auth/login", response_model=LoginResponse)
def login(body: LoginRequest):
    username = body.username.strip().lower()
    if username not in USERS:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario o contraseña incorrectos")
    expected = USERS[username]["password"]
    if expected and (body.password or "") != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario o contraseña incorrectos")
    role: RoleKey = USERS[username]["role"]  # type: ignore
    return LoginResponse(role=role, token=issue_token(role))

@app.get("/inventory")
def get_inventory(authorization: Optional[str] = Header(default=None)):
    role = require_auth(authorization)
    require_role(role, ["bodega"])
    return INVENTORY

@app.get("/invoices")
def get_invoices(authorization: Optional[str] = Header(default=None)):
    role = require_auth(authorization)
    require_role(role, ["oficina"])
    return INVOICES

@app.get("/ledger")
def get_ledger(authorization: Optional[str] = Header(default=None)):
    role = require_auth(authorization)
    require_role(role, ["admin"])
    return LEDGER

@app.get("/ledger/verify", response_model=VerifyResponse)
def verify(authorization: Optional[str] = Header(default=None)):
    role = require_auth(authorization)
    require_role(role, ["admin"])
    ok = verify_chain()
    return VerifyResponse(ok=ok, message=("Integridad OK" if ok else "Integridad con errores"))
