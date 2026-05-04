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
  const [detecting, setDetecting] = useState(false);
  const [batchResults, setBatchResults] = useState([]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleBatchDetect = async () => {
    const sublines = Object.keys(settings.categoryMap || {});
    if (sublines.length === 0) {
      alert("No hay sublíneas configuradas para detectar. Agrega al menos una sublínea primero.");
      return;
    }

    setDetecting(true);
    setBatchResults([]);
    try {
      const res = await fetch('/api/categories/batch-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sublines })
      });
      const data = await res.json();

      if (data.success) {
        setBatchResults(data.results);
        const suggestedCount = data.results.filter(r => r.status === 'suggested').length;
        const notFoundCount = data.results.filter(r => r.status === 'not_found').length;
        setMessage(`🤖 Detección completada: ${data.mapped} ya mapeadas, ${suggestedCount} sugeridas, ${notFoundCount} sin coincidencia.`);
      } else {
        alert("❌ Error: " + data.error);
      }
    } catch (e) {
      alert("Error al conectar con el servidor del ERP.");
    } finally {
      setDetecting(false);
    }
  };

  const applySuggestion = (subline, categoryId) => {
    const newMap = { ...settings.categoryMap };
    newMap[subline] = categoryId;
    setSettings({ ...settings, categoryMap: newMap });
    // Marcar como aplicada
    setBatchResults(prev => prev.map(r =>
      r.subline === subline ? { ...r, status: 'mapped', applied: true } : r
    ));
  };

  const rejectSuggestion = (subline) => {
    setBatchResults(prev => prev.map(r =>
      r.subline === subline ? { ...r, status: 'rejected', rejected: true } : r
    ));
  };

  const getSublineStatus = (subline) => {
    const result = batchResults.find(r => r.subline === subline);
    if (!result) return null;
    return result;
  };

  const getAllSublines = () => {
    return Object.entries(settings.categoryMap || {});
  };

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
        const newMap = { ...settings.categoryMap };
        newMap[profitKey] = data.category_id;
        setSettings({ ...settings, categoryMap: newMap });
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
              onChange={(e) => setSettings({ ...settings, photosPath: e.target.value })}
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
            onChange={(e) => setSettings({ ...settings, defaultMargin: parseInt(e.target.value) })}
            style={{ width: '150px', padding: '0.8rem', background: 'black', border: '1px solid #333', color: 'white', borderRadius: '8px' }}
          />
        </div>
      </section>

      {/* SECCIÓN 3: MAPEO DE CATEGORÍAS */}
      <section style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '2rem', borderRadius: '15px', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ color: '#10b981' }}>🏷️ Mapeo de Sublíneas (Profit → Mercado Libre)</h2>
            <p style={{ opacity: 0.7, marginTop: '0.5rem' }}>Define qué ID de categoría en ML corresponde a cada sublínea de tu sistema.</p>
          </div>
          <button
            onClick={handleBatchDetect}
            disabled={detecting}
            title="Detectar automáticamente todas las categorías usando la API de ML"
            style={{
              padding: '0.8rem 1.5rem',
              background: detecting ? '#555' : '#8b5cf6',
              border: 'none',
              color: 'white',
              borderRadius: '8px',
              cursor: detecting ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '0.95rem'
            }}
          >
            {detecting ? '⏳ Detectando...' : '🤖 Detectar Todas'}
          </button>
        </div>

        {/* Resumen de detección */}
        {batchResults.length > 0 && (
          <div style={{
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            fontSize: '0.9rem'
          }}>
            <strong>📊 Resultados de detección:</strong>{' '}
            <span style={{ color: '#10b981' }}>
              {batchResults.filter(r => r.status === 'mapped').length} ✅ Ya mapeadas
            </span>{' '}|{' '}
            <span style={{ color: '#fbbf24' }}>
              {batchResults.filter(r => r.status === 'suggested').length} 💡 Sugeridas
            </span>{' '}|{' '}
            <span style={{ color: '#ef4444' }}>
              {batchResults.filter(r => r.status === 'not_found').length} ❌ Sin coincidencia
            </span>
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #333' }}>
              <th style={{ padding: '0.8rem' }}>Sublínea Profit</th>
              <th style={{ padding: '0.8rem' }}>ML Category ID</th>
              <th style={{ padding: '0.8rem' }}>Estado</th>
              <th style={{ padding: '0.8rem' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {getAllSublines().map(([profit, ml]) => {
              const status = getSublineStatus(profit);
              return (
                <tr key={profit} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '0.8rem' }}>{profit}</td>
                  <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem' }}>
                    <input
                      type="text"
                      value={ml}
                      onChange={(e) => {
                        const newMap = { ...settings.categoryMap };
                        newMap[profit] = e.target.value;
                        setSettings({ ...settings, categoryMap: newMap });
                      }}
                      placeholder="MLVXXXXXX"
                      style={{ padding: '0.5rem', background: 'transparent', border: '1px solid #333', color: 'white', flex: 1 }}
                    />
                    <button
                      onClick={() => handleAutoDetectCategory(profit)}
                      title="Detectar desde link de ML (precisión exacta)"
                      style={{ background: '#3b82f6', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      🔍
                    </button>
                  </td>
                  <td style={{ padding: '0.8rem' }}>
                    {status ? (
                      status.status === 'mapped' ? (
                        <span style={{ color: '#10b981', fontSize: '0.85rem' }}>✅ Mapeada</span>
                      ) : status.status === 'suggested' ? (
                        <span style={{ color: '#fbbf24', fontSize: '0.85rem' }}>💡 Sugerida: {status.category_id}</span>
                      ) : status.status === 'not_found' ? (
                        <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>❌ Sin coincidencia</span>
                      ) : status.status === 'rejected' ? (
                        <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>🚫 Rechazada</span>
                      ) : (
                        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>—</span>
                      )
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '0.85rem' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '0.8rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {status && status.status === 'suggested' && !status.applied && !status.rejected && (
                        <>
                          <button
                            onClick={() => applySuggestion(profit, status.category_id)}
                            title="Aplicar esta sugerencia"
                            style={{ background: '#10b981', border: 'none', color: 'white', padding: '0.4rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                          >
                            ✅ Aplicar
                          </button>
                          <button
                            onClick={() => rejectSuggestion(profit)}
                            title="Rechazar esta sugerencia"
                            style={{ background: '#ef4444', border: 'none', color: 'white', padding: '0.4rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                          >
                            ❌ Rechazar
                          </button>
                        </>
                      )}
                      {status && status.applied && (
                        <span style={{ color: '#10b981', fontSize: '0.85rem' }}>✅ Aplicada</span>
                      )}
                      {status && status.rejected && (
                        <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>🚫 Rechazada</span>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`¿Estás seguro de eliminar el mapeo para "${profit}"?`)) {
                            const newMap = { ...settings.categoryMap };
                            delete newMap[profit];
                            setSettings({ ...settings, categoryMap: newMap });
                          }
                        }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button
            onClick={() => {
              const prof = prompt("Nombre de la sublínea en Profit:");
              if (prof) {
                const newMap = { ...settings.categoryMap, [prof.toUpperCase()]: '' };
                setSettings({ ...settings, categoryMap: newMap });
              }
            }}
            style={{ padding: '0.5rem 1rem', background: '#3b82f6', border: 'none', color: 'white', borderRadius: '5px', cursor: 'pointer' }}
          >
            + Agregar Mapeo
          </button>
        </div>
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
