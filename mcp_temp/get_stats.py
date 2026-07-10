import psycopg2
conn = psycopg2.connect("postgresql://nulip_user:Nulip2026R8mQwX9@localhost:5432/nulip_inventory")
cur = conn.cursor()

cur.execute("SELECT role, COUNT(id) FROM users GROUP BY role")
print("Roles:", cur.fetchall())

cur.execute("SELECT COUNT(id) FROM warehouses")
print("Warehouses:", cur.fetchall())

cur.execute("SELECT COUNT(id) FROM items")
print("Items:", cur.fetchall())

cur.execute("SELECT COUNT(DISTINCT city) FROM users WHERE city IS NOT NULL AND city != ''")
print("Cities:", cur.fetchall())

cur.close()
conn.close()
