import os
import sys
import psycopg

sys.path.append("/app")

from ledger import canonical_payload, compute_block_hash, is_sha256_hex

host = os.getenv("DB_HOST", "postgres")
port = int(os.getenv("DB_PORT", "5432"))
name = os.getenv("DB_NAME", "nexusdb")
user = os.getenv("DB_USER", "nexus")
pwd  = os.getenv("DB_PASSWORD", "nexuspass")
dsn = f"host={host} port={port} dbname={name} user={user} password={pwd}"

updated = 0
skipped = 0

with psycopg.connect(dsn) as conn:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, ts, actor, action, tx_id, prev_hash, hash, payload_json
            FROM ledger
            WHERE action IN ('INVENTORY_CREATE','INVOICE_CREATE')
            ORDER BY id;
        """)
        rows = cur.fetchall()

        for (lid, ts, actor, action, tx_id, prev_hash, h, payload_json) in rows:
            h = str(h)
            payload_json = str(payload_json or "{}")

            if not is_sha256_hex(h) or payload_json != "{}":
                continue

            if action == "INVENTORY_CREATE":
                cur.execute("""
                    SELECT id, date, item, category, type, qty, username
                    FROM inventory
                    WHERE hash = %s
                    LIMIT 1;
                """, (h,))
                rec = cur.fetchone()
                if not rec:
                    skipped += 1
                    continue

                inv_id, date, item, category, typ, qty, username = rec
                payload = {
                    "inventory_id": int(inv_id),
                    "date": date.isoformat(),
                    "item": str(item),
                    "category": str(category),
                    "type": str(typ),
                    "qty": int(qty),
                    "user": str(username),
                }

            elif action == "INVOICE_CREATE":
                cur.execute("""
                    SELECT id, date, client, total, username
                    FROM invoices
                    WHERE hash = %s
                    LIMIT 1;
                """, (h,))
                rec = cur.fetchone()
                if not rec:
                    skipped += 1
                    continue

                invc_id, date, client, total, username = rec
                payload = {
                    "invoice_id": int(invc_id),
                    "date": date.isoformat(),
                    "client": str(client),
                    "total": float(total),
                    "user": str(username),
                }

            else:
                continue

            pj = canonical_payload(payload)
            expected = compute_block_hash(str(prev_hash), ts.isoformat(), str(actor), str(action), str(tx_id), pj)

            if expected != h:
                skipped += 1
                continue

            cur.execute("UPDATE ledger SET payload_json = %s WHERE id = %s;", (pj, lid))
            updated += 1

print(f"Backfill listo. updated={updated}, skipped={skipped}")

