'use client';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import styles from './Inventory.module.css';

// Componente para cargar fotos locales bajo demanda
const LocalPhoto = ({ sku, index = 0, filename = null, size = 150 }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPhoto = async () => {
      try {
        const url = filename 
          ? `/api/media/local/${encodeURIComponent(sku)}?filename=${encodeURIComponent(filename)}`
          : `/api/media/local/${encodeURIComponent(sku)}?index=${index}`;
          
        const res = await fetch(url);
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (e) {} finally {
        setLoading(false);
      }
    };
    fetchPhoto();
  }, [sku, index, filename]);

  if (loading) return <div style={{width: size, height: size, display:'flex', alignItems:'center', justifyContent:'center', background:'#111', borderRadius: '12px', fontSize:'0.7rem'}}>Cargando...</div>;
  if (!data) return <div style={{width: size, height: size, display:'flex', alignItems:'center', justifyContent:'center', background:'#111', borderRadius: '12px', fontSize:'0.7rem'}}>No disponible</div>;

  return <img src={data} style={{ width: size, height: size, objectFit: 'cover', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }} alt="Preview" />;
};

const LocalPhotoGallery = ({ sku }) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchList = async () => {
      console.log(`[Gallery] Iniciando búsqueda para: ${sku}`);
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/media/list/${encodeURIComponent(sku)}`);
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        const json = await res.json();
        if (isMounted) {
          if (json.success) {
            setPhotos(json.files || []);
          } else {
            setError(json.error || 'Error en API');
          }
        }
      } catch (e) {
        console.error("[Gallery] Error:", e);
        if (isMounted) setError(e.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchList();
    return () => { isMounted = false; };
  }, [sku]);

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>🔍 Buscando fotos para {sku}...</div>;
  if (error) return <div style={{ color: '#ef4444', fontSize: '0.8rem' }}>❌ Error: {error}</div>;
  if (photos.length === 0) return <div style={{ color: '#fbbf24', fontSize: '0.8rem' }}>⚠️ No se encontraron fotos exactas para "{sku}".</div>;

  return (
    <div style={{ display: 'flex', gap: '0.8rem', overflowX: 'auto', paddingBottom: '1rem', scrollbarWidth: 'thin' }}>
      {photos.map((f, i) => (
        <div key={i} style={{ flexShrink: 0, textAlign: 'center' }}>
          <LocalPhoto sku={sku} filename={f} size={120} />
          <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.3rem' }}>{f}</div>
        </div>
      ))}
    </div>
  );
};

const CategoryPredictor = ({ title }) => {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrediction = async () => {
      try {
        const res = await fetch(`https://api.mercadolibre.com/sites/MLV/domain_discovery/search?q=${encodeURIComponent(title)}`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setPrediction(data[0]);
        }
      } catch (e) {} finally {
        setLoading(false);
      }
    };
    fetchPrediction();
  }, [title]);

  if (loading) return <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>🔮 Prediciendo categoría...</div>;
  if (!prediction) return <div style={{ fontSize: '0.8rem', color: '#ef4444' }}>⚠️ No se pudo predecir la categoría.</div>;

  return (
    <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', padding: '0.8rem', borderRadius: '8px' }}>
      <div style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: 'bold', marginBottom: '0.2rem' }}>CATEGORÍA SUGERIDA:</div>
      <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{prediction.category_name}</div>
      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>ID: {prediction.category_id}</div>
    </div>
  );
};

export default function InventoryAuditPage() {
  const [activeAccount, setActiveAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [pausing, setPausing] = useState(false);
  const [auditMode, setAuditMode] = useState('master'); // 'master' o 'inbound'
  
  // Memoria Dual: Estados independientes para cada modo
  const [fileMaster, setFileMaster] = useState(null);
  const [resultsMaster, setResultsMaster] = useState(null);
  const [fileInbound, setFileInbound] = useState(null);
  const [resultsInbound, setResultsInbound] = useState(null);
  const [photoStatus, setPhotoStatus] = useState({}); // { SKU: true/false }
  const [filterPhoto, setFilterPhoto] = useState('all'); // 'all', 'yes', 'no'
  const [searchQuery, setSearchQuery] = useState('');
  const [publishStatus, setPublishStatus] = useState({}); // { SKU: 'idle' | 'loading' | 'success' | 'error' }
  const [publishedLinks, setPublishedLinks] = useState({}); // { SKU: permalink }
  
  // Preview State
  const [previewItem, setPreviewItem] = useState(null); // { item, subline }


  useEffect(() => {
    const fetchActiveAccount = async () => {
      try {
        const cookies = document.cookie.split('; ');
        const activeCookie = cookies.find(row => row.startsWith('meli_erp_account='));
        const cookieId = activeCookie ? activeCookie.split('=')[1] : null;

        if (cookieId) {
          setActiveAccount(cookieId);
        } else {
          const res = await fetch('/api/auth/accounts');
          const data = await res.json();
          if (data.accounts?.length > 0) {
            setActiveAccount(data.accounts[0].id);
          }
        }
      } catch(e) {}
    };

    fetchActiveAccount();

    const checkAccountChange = setInterval(() => {
      const cookies = document.cookie.split('; ');
      const activeCookie = cookies.find(row => row.startsWith('meli_erp_account='));
      const cookieId = activeCookie ? activeCookie.split('=')[1] : null;
      if (cookieId && cookieId !== activeAccount) {
        setActiveAccount(cookieId);
      }
    }, 1000);

    return () => clearInterval(checkAccountChange);
  }, [activeAccount]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!activeAccount) return;
      try {
        const res = await fetch(`/api/inventory/last?accountId=${activeAccount}`);
        const data = await res.json();
        if (data.success) {
          setResultsMaster(data.master || null);
          setResultsInbound(data.inbound || null);
        } else {
          setResultsMaster(null);
          setResultsInbound(null);
        }
      } catch(e) {}
    };

    fetchHistory();
  }, [activeAccount]);

  // Auditor de Fotos Locales
  useEffect(() => {
    const checkPhotos = async () => {
      const allMissingSkus = [];
      if (resultsMaster?.missing) allMissingSkus.push(...resultsMaster.missing.map(m => m.sku));
      if (resultsInbound?.missing) allMissingSkus.push(...resultsInbound.missing.map(m => m.sku));
      
      if (allMissingSkus.length === 0) return;

      try {
        const res = await fetch('/api/media/check-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skus: allMissingSkus.slice(0, 5000) }) // Limite de seguridad
        });
        const data = await res.json();
        if (data.photoMap) setPhotoStatus(data.photoMap);
      } catch(e) {}
    };

    checkPhotos();
  }, [resultsMaster, resultsInbound]);

  useEffect(() => {
    let interval;
    if (loading) {
      interval = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Alias dinámico para los resultados actuales
  const results = auditMode === 'master' ? resultsMaster : resultsInbound;
  const currentFile = auditMode === 'master' ? fileMaster : fileInbound;

  const [suggestedAttrs, setSuggestedAttrs] = useState([]);
  const [suggesting, setSuggesting] = useState(false);

  const handleSuggestAttributes = async () => {
    if (!previewItem || !activeAccount) return;
    setSuggesting(true);
    try {
      const res = await fetch('/api/account/publications/suggest-attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: previewItem.item.title,
          accountId: activeAccount
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuggestedAttrs(data.attributes);
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert("Error al obtener sugerencias");
    } finally {
      setSuggesting(false);
    }
  };

  const handleUpload = async () => {
    if (!currentFile || !activeAccount) return;
    setLoading(true);
    setElapsedTime(0);
    const formData = new FormData();
    formData.append('file', currentFile);
    formData.append('accountId', activeAccount);
    formData.append('mode', auditMode);

    try {
      const res = await fetch('/api/inventory/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        if (auditMode === 'master') setResultsMaster(data);
        else setResultsInbound(data);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Error al procesar archivo');
    } finally {
      setLoading(false);
    }
  };

  const handlePauseOrphans = async () => {
    if (auditMode !== 'master' || !resultsMaster?.orphans?.length) return;
    if (!confirm(`¿Estás seguro de pausar ${resultsMaster.orphans.length} publicaciones huérfanas?`)) return;
    
    setPausing(true);
    try {
      const res = await fetch('/api/inventory/orphans/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          accountId: activeAccount, 
          itemIds: resultsMaster.orphans.map(o => o.meli_item_id) 
        }),
      });
      const data = await res.json();
      alert(data.message);
    } catch (err) {
      alert('Error al pausar huérfanos');
    } finally {
      setPausing(false);
    }
  };

  const handleDownloadIntegraly = () => {
    if (!results?.orphans?.length) return;

    const integralyData = results.orphans.map(o => ({
      "Código de Mercado Libre": o.meli_item_id,
      "Título": o.title || "",
      "Precio de Venta": o.price || 0,
      "SKU": o.sku || "",
      "Estado de la publicación": o.status === "active" ? "Activa" : (o.status === "paused" ? "Pausada" : o.status),
      "URL Directa (Uso Interno)": o.permalink || ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(integralyData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Hoja1");
    worksheet['!cols'] = [{ wch: 18 }, { wch: 60 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 50 }];
    XLSX.writeFile(workbook, "Huerfanas_Para_Integraly.xlsx");
  };

  const handleDownloadMissingIntegraly = () => {
    if (!results?.missing?.length) return;

    const integralyData = results.missing.map(i => ({
      "SKU": i.sku,
      "Título Sugerido": i.title || "",
      "Precio (Profit)": i.price || 0,
      "Stock / Cantidad": i.stock || 0,
      "ML Sugerido (Excel)": i.suggestedMeliId || "-",
      "Sugerencia": "Publicar en Mercado Libre"
    }));

    const worksheet = XLSX.utils.json_to_sheet(integralyData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sugerencias");
    worksheet['!cols'] = [{ wch: 20 }, { wch: 60 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 30 }];
    XLSX.writeFile(workbook, "Sugerencias_Para_Publicar.xlsx");
  };

  const handleDownloadMassiveExcel = (items, subline) => {
    const origin = window.location.origin;
    
    const massiveData = items.map(i => {
      // Intentar obtener la primera foto para el Excel si existe
      // Nota: ML Masivo pide URLs absolutas. 
      const photoUrl = photoStatus[i.sku] ? `${origin}/api/inventory/photos/view?sku=${i.sku}` : "";
      
      return {
        "Título": i.title,
        "Precio (USD)": i.price,
        "Condición": "Nuevo",
        "Stock": i.stock,
        "Fotos (URL)": photoUrl,
        "Descripción": `Producto Original. SKU: ${i.sku}. Código OEM: ${i.oem || 'N/A'}.`,
        "Marca": i.brand || "Genérico",
        "Modelo": "Genérico",
        "Código OEM": i.oem || "",
        "SKU / Código Interno": i.sku
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(massiveData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, subline.substring(0, 30));
    
    // Auto-ajustar columnas
    worksheet['!cols'] = [
      { wch: 50 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, 
      { wch: 60 }, { wch: 60 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }
    ];

    XLSX.writeFile(workbook, `Masivo_ML_${subline.replace(/\s+/g, '_')}.xlsx`);
  };

  const handlePublish = (item, subline) => {
    setPreviewItem({ item, subline });
  };

  const confirmPublish = async (item, subline, extraAttrs = []) => {
    if (!activeAccount) return;
    
    setPublishStatus(prev => ({ ...prev, [item.sku]: 'loading' }));
    setPreviewItem(null);

    try {
      const res = await fetch('/api/account/publications/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: activeAccount,
          sku: item.sku,
          title: item.title,
          price: item.price,
          stock: item.stock,
          subline: subline,
          brand: item.brand,
          oem: item.oem,
          extraAttrs: extraAttrs
        })
      });
      const data = await res.json();
      if (data.success) {
        setPublishStatus(prev => ({ ...prev, [item.sku]: 'success' }));
        if (data.permalink) {
          setPublishedLinks(prev => ({ ...prev, [item.sku]: data.permalink }));
        }
      } else {
        alert(`Error al publicar ${item.sku}: ${data.error}`);
        setPublishStatus(prev => ({ ...prev, [item.sku]: 'error' }));
      }
    } catch (err) {
      setPublishStatus(prev => ({ ...prev, [item.sku]: 'error' }));
    }
  };

  const handlePublishGroup = async (items, subline) => {
    const readyItems = items.filter(i => photoStatus[i.sku]);
    if (readyItems.length === 0) {
      alert("No hay productos con foto listos para publicar en este grupo.");
      return;
    }
    if (!confirm(`¿Deseas publicar ${readyItems.length} productos del grupo "${subline}"?`)) return;

    for (const item of readyItems) {
      // Para grupos, publicamos directo sin preview por cada uno
      await confirmPublish(item, subline);
    }
  };


  // Función para agrupar faltantes por sublínea
  const renderMissingGroups = () => {
    const results = auditMode === 'master' ? resultsMaster : resultsInbound;
    if (!results?.missing?.length) return null;

    const groups = results.missing.reduce((acc, item) => {
      // Aplicar Filtros de Foto
      if (filterPhoto === 'yes' && !photoStatus[item.sku]) return acc;
      if (filterPhoto === 'no' && photoStatus[item.sku]) return acc;

      // Aplicar Filtro de Búsqueda
      if (searchQuery && 
          !item.sku.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !item.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return acc;
      }

      const sub = item.subcategory || 'SIN CATEGORÍA';
      if (!acc[sub]) acc[sub] = [];
      acc[sub].push(item);
      return acc;
    }, {});

    return Object.entries(groups).map(([sub, items]) => (
      <div key={sub} style={{ marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#fbbf24' }}>📂 {sub} ({items.length} items)</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className={styles.secondaryBtn} 
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: '#3b82f6', color: 'white', border: 'none' }}
              onClick={() => handleDownloadMassiveExcel(items, sub)}
            >
              📥 Excel Masivo ML
            </button>
            <button 
              className={styles.primaryBtn} 
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: '#10b981' }}
              onClick={() => handlePublishGroup(items, sub)}
            >
              🚀 Publicar Grupo
            </button>
          </div>
        </div>
        <table className={styles.table}>
          <thead><tr><th>FOTO</th><th>SKU</th><th>Título Profit</th><th>Precio</th><th>Stock</th><th>ML Sugerido</th><th>ACCIÓN</th></tr></thead>
          <tbody>
            {items.map((m, idx) => {
              const status = publishStatus[m.sku] || 'idle';
              return (
                <tr key={idx} style={{ opacity: status === 'success' ? 0.5 : 1 }}>
                  <td>
                    {photoStatus[m.sku] ? (
                      <div className={styles.photoPreviewContainer}>
                        <span title="Foto local encontrada" style={{ cursor: 'pointer', fontSize: '1.2rem' }}>📸</span>
                        <div className={styles.photoHover}>
                          <LocalPhoto sku={m.sku} />
                        </div>
                      </div>
                    ) : (
                      <span title="Sin foto local" style={{ opacity: 0.3 }}>❌</span>
                    )}
                  </td>
                  <td style={{fontWeight:'bold', color:'#fbbf24'}}>{m.sku}</td>
                  <td>{m.title}</td><td>${m.price}</td><td>{m.stock}</td><td>{m.suggestedMeliId || '-'}</td>
                  <td>
                    {status === 'loading' ? (
                      <span style={{ fontSize: '0.8rem', color: '#60a5fa' }}>⌛ Publicando...</span>
                    ) : status === 'success' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#10b981' }}>✅ Publicado</span>
                        {publishedLinks[m.sku] && (
                          <a 
                            href={publishedLinks[m.sku]} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.7rem', color: '#3b82f6', textDecoration: 'underline' }}
                          >
                            Ver en ML
                          </a>
                        )}
                      </div>
                    ) : (
                      <button 
                        className={styles.primaryBtn} 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.7rem', opacity: photoStatus[m.sku] ? 1 : 0.3 }}
                        onClick={() => handlePublish(m, sub)}
                        disabled={!photoStatus[m.sku]}
                      >
                        Publicar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ));
  };

  return (
    <div style={{ padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '800' }}>Auditoría de Inventario</h1>
        <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
          Cruce de datos inteligente entre Profit Plus y Mercado Libre.
        </p>
      </header>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
        <button 
          onClick={() => setAuditMode('master')}
          style={{
            padding: '1rem 2rem', borderRadius: '12px', cursor: 'pointer', border: 'none', fontWeight: 'bold',
            background: auditMode === 'master' ? '#3b82f6' : 'rgba(255,255,255,0.05)',
            color: auditMode === 'master' ? 'white' : 'rgba(255,255,255,0.5)',
            transition: 'all 0.3s'
          }}
        >
          🏢 Auditoría Maestro (Global)
        </button>
        <button 
          onClick={() => setAuditMode('inbound')}
          style={{
            padding: '1rem 2rem', borderRadius: '12px', cursor: 'pointer', border: 'none', fontWeight: 'bold',
            background: auditMode === 'inbound' ? '#fbbf24' : 'rgba(255,255,255,0.05)',
            color: auditMode === 'inbound' ? 'black' : 'rgba(255,255,255,0.5)',
            transition: 'all 0.3s'
          }}
        >
          📦 Recepción de Mercancía (Novedades)
        </button>
      </div>

      <div style={{ background: auditMode === 'master' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(251, 191, 36, 0.1)', borderLeft: `4px solid ${auditMode === 'master' ? '#3b82f6' : '#fbbf24'}`, padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
        <h3 style={{ color: auditMode === 'master' ? '#60a5fa' : '#fbbf24', marginBottom: '0.8rem', fontSize: '1.1rem' }}>
          💡 Modo: {auditMode === 'master' ? 'AUDITORÍA MAESTRA' : 'ENTRADA DE MERCANCÍA'}
        </h3>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)' }}>
          {auditMode === 'master' 
            ? 'Usa este modo para comparar todo tu almacén. Detecta qué publicaciones sobran (Huérfanos) para pausarlas.' 
            : 'Usa este modo al recibir mercancía nueva. El sistema ignorará los huérfanos y se enfocará solo en lo que falta publicar.'}
        </p>
      </div>

      <section className={styles.uploadCard}>
        <h2>Subir archivo de {auditMode === 'master' ? 'Inventario Completo' : 'Nota de Recepción'}</h2>
        <div className={styles.dropzone}>
          <input 
            type="file" 
            onChange={(e) => {
              if (auditMode === 'master') setFileMaster(e.target.files[0]);
              else setFileInbound(e.target.files[0]);
            }} 
            accept=".xlsx, .xls, .csv" 
          />
          <button className={styles.primaryBtn} 
                  style={{ background: auditMode === 'inbound' ? '#fbbf24' : '#3b82f6', color: auditMode === 'inbound' ? 'black' : 'white' }}
                  onClick={handleUpload} disabled={loading || !currentFile}>
            {loading ? `🔍 Procesando... (${elapsedTime}s)` : (auditMode === 'master' ? '🔍 Iniciar Auditoría' : '📦 Procesar Entrada')}
          </button>
        </div>
      </section>

      {results && (
        <div className={styles.resultsGrid}>
          <div 
            className={styles.statCard} 
            style={{ cursor: 'pointer', border: '1px solid rgba(16, 185, 129, 0.2)' }}
            onClick={() => document.getElementById('matched-section')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <h3>Sincronizados</h3>
            <div className={styles.statValue} style={{color: '#10b981'}}>{results.summary.matched}</div>
            <p>SKUs que ya están publicados correctamente.</p>
          </div>

          {auditMode === 'master' && (
            <div 
              className={styles.statCard} 
              style={{ cursor: 'pointer', border: '1px solid rgba(239, 68, 68, 0.2)' }}
              onClick={() => document.getElementById('orphans-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <h3>Huérfanos (ML)</h3>
              <div className={styles.statValue} style={{color: '#ef4444'}}>{results.summary.orphansCount}</div>
              <p>Publicaciones que NO están en este Excel.</p>
              <button className={styles.dangerBtn} onClick={(e) => { e.stopPropagation(); handlePauseOrphans(); }} disabled={pausing}>
                {pausing ? 'Pausando...' : '⏸️ Pausar Huérfanos'}
              </button>
            </div>
          )}

          <div 
            className={styles.statCard} 
            style={{ cursor: 'pointer', border: '1px solid rgba(251, 191, 36, 0.2)' }}
            onClick={() => document.getElementById('missing-section')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <h3>Faltantes (ML)</h3>
            <div className={styles.statValue} style={{color: '#fbbf24'}}>{results.summary.missingCount}</div>
            <p>Productos de este Excel que NO están publicados.</p>
          </div>
        </div>
      )}

      {/* DETALLE SINCRONIZADOS */}
      {results?.matchedItems?.length > 0 && (
        <div id="matched-section" className={styles.detailsSection} style={{ borderTop: '2px solid #10b981', marginTop: '2rem' }}>
          <h2 style={{ margin: 0, color: '#10b981', marginBottom: '1.5rem' }}>✅ Productos Sincronizados</h2>
          <table className={styles.table}>
            <thead><tr><th>ID ML</th><th>SKU</th><th>Título</th><th>Precio</th></tr></thead>
            <tbody>
              {results.matchedItems.slice(0, 500).map(m => (
                <tr key={m.sku}>
                  <td><a href={m.permalink} target="_blank" style={{color:'#60a5fa'}}>{m.meli_item_id} ↗</a></td>
                  <td>{m.sku}</td><td>{m.title}</td><td>${m.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DETALLE HUÉRFANOS */}
      {auditMode === 'master' && results?.orphans?.length > 0 && (
        <div id="orphans-section" className={styles.detailsSection} style={{ borderTop: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, color: '#f87171' }}>Huérfanos a Limpiar</h2>
            <button className={styles.secondaryBtn} onClick={handleDownloadIntegraly}>📥 XLS Integraly</button>
          </div>
          <table className={styles.table}>
            <thead><tr><th>ID ML</th><th>SKU</th><th>Título</th><th>Precio</th></tr></thead>
            <tbody>
              {results.orphans.map(o => (
                <tr key={o.meli_item_id}>
                  <td><a href={o.permalink} target="_blank" style={{color:'#60a5fa'}}>{o.meli_item_id} ↗</a></td>
                  <td>{o.sku}</td><td>{o.title}</td><td>${o.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DETALLE FALTANTES AGRUPADOS */}
      {results?.missing?.length > 0 && (
        <div id="missing-section" className={styles.detailsSection} style={{ marginTop: '3rem', borderTop: '2px solid #fbbf24' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(251, 191, 36, 0.05)', padding: '1rem', borderRadius: '12px', marginBottom: '2rem' }}>
            <div>
              <h2 style={{ margin: 0, color: '#fbbf24' }}>
                {auditMode === 'master' ? '🕵️‍♂️ Faltantes Globales detectados' : '🔥 Prioridad: Mercancía por Publicar'}
              </h2>
              <p style={{ margin: 0, opacity: 0.7 }}>{results.missing.length} productos organizados por Sublínea.</p>
            </div>
            <button 
              onClick={handleDownloadMissingIntegraly}
              style={{
                background: '#fbbf24', color: 'black', padding: '1rem 1.5rem', borderRadius: '10px', 
                border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}
            >
              📥 Descargar Plan Completo (Excel)
            </button>
          </div>

          {/* BARRA DE FILTROS */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.5rem', fontWeight: 'bold' }}>🔍 BUSCAR PRODUCTO</label>
              <input 
                type="text" 
                placeholder="Busca por SKU o nombre..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '0.8rem', background: 'black', border: '1px solid #333', color: 'white', borderRadius: '8px' }}
              />
            </div>
            
            <div style={{ width: '200px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.5rem', fontWeight: 'bold' }}>📸 ESTADO FOTO</label>
              <select 
                value={filterPhoto}
                onChange={(e) => setFilterPhoto(e.target.value)}
                style={{ width: '100%', padding: '0.8rem', background: 'black', border: '1px solid #333', color: 'white', borderRadius: '8px' }}
              >
                <option value="all">Todos (Faltantes)</option>
                <option value="yes">Con Foto Local (Listos) ✅</option>
                <option value="no">Sin Foto ❌</option>
              </select>
            </div>
          </div>
          
          {renderMissingGroups()}

          {/* Modal de Vista Previa */}
          {previewItem && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)'
            }}>
              <div style={{
                background: '#1a1a1a', padding: '2.5rem', borderRadius: '24px', maxWidth: '600px', width: '90%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <h2 style={{ marginBottom: '1.5rem', fontSize: '1.8rem', fontWeight: '800' }}>Confirmar Publicación</h2>
                
                <div style={{ marginBottom: '2rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '0.8rem', fontWeight: 'bold', letterSpacing: '0.05em' }}>📸 GALERÍA DE FOTOS DETECTADAS</label>
                  <LocalPhotoGallery sku={previewItem.item.sku} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '0.3rem' }}>TÍTULO DE LA PUBLICACIÓN</label>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {previewItem.item.title}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '0.3rem' }}>PRECIO FINAL (USD)</label>
                    <div style={{ fontSize: '1.3rem', color: '#fbbf24', fontWeight: '800' }}>${previewItem.item.price}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '0.3rem' }}>STOCK DISPONIBLE</label>
                    <div style={{ fontSize: '1.3rem', fontWeight: '800' }}>{previewItem.item.stock} unidades</div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
                  <label style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '0.8rem', fontWeight: 'bold' }}>SUBLÍNEA / CATEGORÍA ML</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      📂 {previewItem.subline}
                    </div>
                    {previewItem.subline === 'SIN CATEGORÍA' ? (
                      <CategoryPredictor title={previewItem.item.title} />
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: '#10b981' }}>✅ Categoría Mapeada</div>
                    )}
                  </div>
                </div>

                {/* NUEVO: Atributos Obligatorios Detectados */}
                <div style={{ background: 'rgba(251, 191, 36, 0.05)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.7rem', color: '#fbbf24', margin: 0, fontWeight: 'bold' }}>📝 ATRIBUTOS TÉCNICOS</label>
                    <button 
                      onClick={handleSuggestAttributes}
                      disabled={suggesting}
                      style={{ background: '#fbbf24', color: 'black', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer', opacity: suggesting ? 0.5 : 1 }}
                    >
                      {suggesting ? '🔍 Buscando...' : '✨ Mejorar con Competencia'}
                    </button>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.6rem', opacity: 0.5, display: 'block' }}>MARCA</label>
                      <div style={{ fontSize: '0.9rem', color: '#fbbf24' }}>{previewItem.item.brand || 'Genérico'}</div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.6rem', opacity: 0.5, display: 'block' }}>MODELO</label>
                      <div style={{ fontSize: '0.9rem' }}>Genérico</div>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '0.6rem', opacity: 0.5, display: 'block' }}>CÓDIGO OEM / ALTERNO</label>
                      <div style={{ fontSize: '0.9rem', color: '#60a5fa' }}>{previewItem.item.oem || 'No Aplica'}</div>
                    </div>
                  </div>

                  {suggestedAttrs.length > 0 && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                      <label style={{ fontSize: '0.6rem', opacity: 0.5, display: 'block', marginBottom: '0.5rem' }}>SUGERENCIAS DE LA COMPETENCIA:</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {suggestedAttrs.slice(0, 8).map((at, idx) => (
                          <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.6rem' }}>
                            <span style={{ opacity: 0.5 }}>{at.name}:</span> {at.value_name}
                          </div>
                        ))}
                      </div>
                      <p style={{ fontSize: '0.6rem', color: '#10b981', marginTop: '0.5rem' }}>✅ Estos datos se incluirán automáticamente para mejorar el SEO.</p>
                    </div>
                  )}

                  {!suggestedAttrs.length && (
                    <p style={{ fontSize: '0.6rem', marginTop: '1rem', opacity: 0.5 }}>* El sistema completará automáticamente otros campos requeridos por la categoría con valores estándar.</p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => { setPreviewItem(null); setSuggestedAttrs([]); }}
                    style={{ padding: '0.8rem 1.5rem', borderRadius: '12px', background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                      confirmPublish(previewItem.item, previewItem.subline, suggestedAttrs);
                      setSuggestedAttrs([]);
                    }}
                    style={{ padding: '0.8rem 2rem', borderRadius: '12px', background: '#10b981', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    🚀 Publicar Ahora
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
