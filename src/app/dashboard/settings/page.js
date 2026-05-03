'use client';
import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    photosPath: '',
    defaultMargin: 30,
    categoryMap: {}
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data);
    } catch (e) {
      console.error("Error cargando settings");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        setMessage('✅ Configuración guardada con éxito');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (e) {
      alert("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleAutoDetectCategory = async (profitKey) => {
    const url = prompt("Pega el link de Mercado Libre (o ID del producto) para detectar su categoría EXACTA:");
    if (!url) return;

    try {
      // Hacemos la consulta al BACKEND para usar el Token de Autorización y evitar bloqueos
      const res = await fetch('/api/utils/extract-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();

      if (data.success) {
        const newMap = {...settings.categoryMap};
        newMap[profitKey] = data.category_id;
        setSettings({...settings, categoryMap: newMap});
        alert(`✅ Categoría EXACTA detectada: ${data.category_id}\n(${data.title})`);
      } else {
        alert("❌ Error: " + data.error);
      }
    } catch (e) {
      alert("Error al conectar con el servidor del ERP.");
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '800' }}>Configuración del Sistema</h1>
        <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
          Ajustes globales para el flujo de publicaciones, inventarios y mapeos de categorías.
        </p>
      </header>

      {message && (
        <div style={{ background: '#10b981', color: 'white', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontWeight: 'bold' }}>
          {message}
        </div>
      )}

      {/* SECCIÓN 1: RUTAS Y ARCHIVOS */}
      <section style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '2rem', borderRadius: '15px', marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1.5rem', color: '#60a5fa' }}>📁 Rutas de Archivos</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>📍 Ruta de Fotos (Local):</label>
            <input 
              type="text" 
              placeholder="Ej: C:\MisFotos\Repuestos"
              value={settings.photosPath}
              onChange={(e) => setSettings({...settings, photosPath: e.target.value})}
              style={{ width: '100%', padding: '0.8rem', background: 'black', border: '1px solid #333', color: 'white', borderRadius: '8px' }}
            />
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem' }}>
              El sistema buscará fotos con el patrón <strong>SKU-0.jpg</strong> en esta ubicación.
            </p>
          </div>
        </div>
      </section>

      {/* SECCIÓN 2: MARGENES Y PRECIOS */}
      <section style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '2rem', borderRadius: '15px', marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1.5rem', color: '#fbbf24' }}>💰 Reglas de Precios</h2>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>📈 Margen de Ganancia por Defecto (%):</label>
          <input 
            type="number" 
            value={settings.defaultMargin}
            onChange={(e) => setSettings({...settings, defaultMargin: parseInt(e.target.value)})}
            style={{ width: '150px', padding: '0.8rem', background: 'black', border: '1px solid #333', color: 'white', borderRadius: '8px' }}
          />
        </div>
      </section>

      {/* SECCIÓN 3: MAPEO DE CATEGORÍAS */}
      <section style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '2rem', borderRadius: '15px', marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1.5rem', color: '#10b981' }}>🏷️ Mapeo de Sublíneas (Profit → Mercado Libre)</h2>
        <p style={{ marginBottom: '1.5rem', opacity: 0.7 }}>Define qué ID de categoría en ML corresponde a cada sublínea de tu sistema.</p>
        
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #333' }}>
              <th style={{ padding: '0.8rem' }}>Sublínea Profit</th>
              <th style={{ padding: '0.8rem' }}>ML Category ID</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(settings.categoryMap || {}).map(([profit, ml]) => (
              <tr key={profit} style={{ borderBottom: '1px solid #222' }}>
                <td style={{ padding: '0.8rem' }}>{profit}</td>
                <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem' }}>
                  <input 
                    type="text" 
                    value={ml}
                    onChange={(e) => {
                      const newMap = {...settings.categoryMap};
                      newMap[profit] = e.target.value;
                      setSettings({...settings, categoryMap: newMap});
                    }}
                    placeholder="MLVXXXXXX"
                    style={{ padding: '0.5rem', background: 'transparent', border: '1px solid #333', color: 'white', flex: 1 }}
                  />
                  <button 
                    onClick={() => handleAutoDetectCategory(profit)}
                    title="Detectar desde link de ML"
                    style={{ background: '#3b82f6', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    🔍
                  </button>
                </td>
                <td>
                  <button 
                    onClick={() => {
                      if (confirm(`¿Estás seguro de eliminar el mapeo para "${profit}"?`)) {
                        const newMap = {...settings.categoryMap};
                        delete newMap[profit];
                        setSettings({...settings, categoryMap: newMap});
                      }
                    }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <button 
          onClick={() => {
            const prof = prompt("Nombre de la sublínea en Profit:");
            if (prof) {
              const newMap = {...settings.categoryMap, [prof.toUpperCase()]: ''};
              setSettings({...settings, categoryMap: newMap});
            }
          }}
          style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#3b82f6', border: 'none', color: 'white', borderRadius: '5px', cursor: 'pointer' }}
        >
          + Agregar Mapeo
        </button>
      </section>

      <button 
        onClick={handleSave}
        disabled={saving}
        style={{
          width: '100%', padding: '1.5rem', borderRadius: '15px', border: 'none',
          background: '#3b82f6', color: 'white', fontWeight: 'bold', fontSize: '1.2rem', cursor: 'pointer'
        }}
      >
        {saving ? 'Guardando...' : '💾 Guardar Cambios'}
      </button>
    </div>
  );
}
