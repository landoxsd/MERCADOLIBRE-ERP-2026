import requests
import os

SUPABASE_URL = "https://zqxesjcchykncxpekmbz.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxeGVzamNjaHlrbmN4cGVrbWJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjY1NTMzNywiZXhwIjoyMDkyMjMxMzM3fQ.xrJXFm1WI7rNrDIUeir5IDAfk4Exbhf_k5vzPQzp51I"

headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Prefer": "count=exact"}

res = requests.get(f"{SUPABASE_URL}/rest/v1/internal_inventory?subcategory=not.is.null", headers=headers, params={"limit": 1})
count = res.headers.get("Content-Range", "0-0/0").split("/")[-1]
print(f"Filas con subcategory NO NULL: {count}")
