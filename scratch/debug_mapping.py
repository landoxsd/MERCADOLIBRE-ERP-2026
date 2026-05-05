import requests
import os
import pandas as pd

SUPABASE_URL = "https://zqxesjcchykncxpekmbz.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxeGVzamNjaHlrbmN4cGVrbWJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjY1NTMzNywiZXhwIjoyMDkyMjMxMzM3fQ.xrJXFm1WI7rNrDIUeir5IDAfk4Exbhf_k5vzPQzp51I"

headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}

p = requests.get(f"{SUPABASE_URL}/rest/v1/products?select=sku,category_id&limit=5", headers=headers).json()
i = requests.get(f"{SUPABASE_URL}/rest/v1/internal_inventory?select=sku,subcategory&limit=5", headers=headers).json()

print("--- PRODUCTS SAMPLE ---")
print(p)
print("--- INVENTORY SAMPLE ---")
print(i)
