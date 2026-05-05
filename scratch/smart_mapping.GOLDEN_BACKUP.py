import pandas as pd
import requests
import json
import time
import urllib.parse
from difflib import SequenceMatcher

print("--- Lanzando Mapeador Definitivo (Experiencia + IA Automotriz) ---")

# 1. Cargar Mapa de Experiencia
try:
    with open(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\scratch\experience_map_v3.json', 'r') as f:
        experience_map = json.load(f)
    print(f"Cargadas {len(experience_map)} reglas de oro del historial.")
except:
    experience_map = {}
    print("No se pudo cargar el historial. Usando solo IA.")

category_cache = {}

def get_similarity(a, b):
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def get_category_path(cat_id):
    if cat_id in category_cache: return category_cache[cat_id]
    try:
        res = requests.get(f"https://api.mercadolibre.com/categories/{cat_id}", timeout=5)
        data = res.json()
        path = " > ".join([step['name'] for step in data.get('path_from_root', [])])
        category_cache[cat_id] = path
        return path
    except: return ""

def predict_category_ultimate(subline, line):
    subline_up = subline.upper()
    
    # --- NIVEL 1: EXPERIENCIA HISTORICA ---
    if subline_up in experience_map:
        path = experience_map[subline_up]
        # Intentar obtener el ID desde el path (MLV...)
        # Nota: Como el path es texto, usaremos busqueda de ML para obtener el ID real
        try:
            safe_query = urllib.parse.quote(path.split(">")[-1].strip())
            res = requests.get(f"https://api.mercadolibre.com/sites/MLV/domain_discovery/search?q={safe_query}", timeout=5)
            data = res.json()
            if data and len(data) > 0:
                best = data[0]
                return best['category_name'], best['category_id'], path, 100.0
        except: pass
        return "Historica", "Ver Breadcrumb", path, 100.0

    # --- NIVEL 2: IA AUTOMOTRIZ ---
    try:
        query = f"{line} {subline}"
        safe_query = urllib.parse.quote(query)
        url = f"https://api.mercadolibre.com/sites/MLV/domain_discovery/search?q={safe_query}"
        response = requests.get(url, timeout=10)
        data = response.json()

        if not isinstance(data, list) or len(data) == 0:
            return "No encontrada", "N/A", "N/A", 0

        candidates = []
        for candidate in data[:5]:
            cat_id = candidate.get('category_id')
            cat_name = candidate.get('category_name')
            full_path = get_category_path(cat_id)
            score = get_similarity(subline, cat_name) * 30
            
            if "Repuestos Carros y Camionetas" in full_path: score += 65
            elif "Accesorios para Vehículos" in full_path: score += 45
            else: score -= 75
            
            if line.lower() in full_path.lower(): score += 25

            candidates.append({
                'name': cat_name, 'id': cat_id, 'path': full_path, 
                'score': min(max(round(score, 2), 0), 100)
            })

        candidates.sort(key=lambda x: x['score'], reverse=True)
        best = candidates[0]
        return best['name'], best['id'], best['path'], best['score']

    except Exception as e:
        return f"Error: {str(e)}", "N/A", "N/A", 0

input_file = r"c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\lineas sublineas.xlsx"
output_path = r"c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\mapeo_categorias_GOLDEN.xlsx"

try:
    df = pd.read_excel(input_file, skiprows=5)
    df.columns = [c.strip() if isinstance(c, str) else c for c in df.columns]
    df = df.dropna(subset=['SUB LINEA'])

    print(f"Mapeando {len(df)} sublineas con el motor GOLDEN...")

    results = []
    for index, row in df.iterrows():
        subline = str(row['SUB LINEA']).strip()
        line = str(row['LINEA']).strip()
        
        print(f"[{index+1}/{len(df)}] {'Experiencia' if subline.upper() in experience_map else 'IA'} -> {subline}...")
        
        cat_name, cat_id, full_path, confidence = predict_category_ultimate(subline, line)
        
        results.append({
            'CODIGO LINEA': row['CODIGO LINEA'],
            'LINEA': line,
            'CODIGO SUB LINEA': row['CODIGO SUB LINEA'],
            'SUB LINEA': subline,
            'CATEGORIA ML ENCONTRADA': cat_name,
            'BREADCRUMB': full_path,
            'ML_CATEGORY_ID': cat_id,
            'CONFIANZA (%)': confidence
        })
        
        if index % 50 == 0:
            pd.DataFrame(results).to_excel(output_path, index=False)

    final_df = pd.DataFrame(results)
    final_df.to_excel(output_path, index=False)
    print(f"--- PROCESO GOLDEN COMPLETADO ---")
    print(f"Archivo final: {output_path}")

except Exception as e:
    print(f"ERROR: {e}")
