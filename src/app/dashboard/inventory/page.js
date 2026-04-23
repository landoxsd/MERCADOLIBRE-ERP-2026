'use client';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import styles from './Inventory.module.css';

// Componente para cargar fotos locales bajo demanda
const LocalPhoto = ({ sku }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPhoto = async () => {
      try {
        const res = await fetch(`/api/media/local/${sku}?index=0`);
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (e) {} finally {
        setLoading(false);
      }
    };
    fetchPhoto();
  }, [sku]);

  if (loading) return <div style={{width: 150, height: 150, display:'flex', alignItems:'center', justifyContent:'center', background:'#111', fontSize:'0.7rem'}}>Cargando...</div>;
  if (!data) return <div style={{width: 150, height: 150, display:'flex', alignItems:'center', justifyContent:'center', background:'#111', fontSize:'0.7rem'}}>No disponible</div>;

  return <img src={data} style={{ width: 150, height: 150, objectFit: 'cover', borderRadius: '12px' }} alt="Preview" />;
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
        </div>
        <table className={styles.table}>
          <thead><tr><th>FOTO</th><th>SKU</th><th>Título Profit</th><th>Precio</th><th>Stock</th><th>ML Sugerido</th></tr></thead>
          <tbody>
            {items.map((m, idx) => (
              <tr key={idx}>
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
              </tr>
            ))}
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
        </div>
      )}
    </div>
  );
}
