import psycopg2
conn = psycopg2.connect("postgresql://nulip_user:Nulip2026R8mQwX9@localhost:5432/nulip_inventory")
cur = conn.cursor()

try:
    cur.execute("SELECT COUNT(*) FROM item_types")
    print("Item types:", cur.fetchall())
except Exception as e:
    print("Error:", e)

cur.close()
conn.close()
