'use client';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import styles from './Inventory.module.css';

export default function InventoryAuditPage() {
  const [activeAccount, setActiveAccount] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [results, setResults] = useState(null);
  const [pausing, setPausing] = useState(false);
  const [auditMode, setAuditMode] = useState('master'); // 'master' o 'inbound'

  useEffect(() => {
    const fetchActiveAccount = async () => {
      try {
        const cookies = document.cookie.split('; ');
        const activeCookie = cookies.find(row => row.startsWith('meli_erp_account='));
        const cookieId = activeCookie ? activeCookie.split('=')[1] : null;

        if (cookieId) {
          setActiveAccount(cookieId);
          fetchLastAudit(cookieId);
          return;
        }

        const res = await fetch('/api/auth/accounts');
        const data = await res.json();
        if (data.accounts?.length > 0) {
          setActiveAccount(data.accounts[0].id);
          fetchLastAudit(data.accounts[0].id);
        }
      } catch(e) {}
    };

    const fetchLastAudit = async (accId) => {
      try {
        const res = await fetch(`/api/inventory/last?accountId=${accId}`);
        const data = await res.json();
        if (data.success) {
          // Solo cargar si el modo coincide para evitar confusiones visuales
          if (data.mode === auditMode) {
            setResults(data);
          }
        } else {
          setResults(null); 
        }
      } catch(e) {}
    };

    fetchActiveAccount();
  }, []);

  useEffect(() => {
    let interval;
    if (loading) {
      interval = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleUpload = async () => {
    if (!file || !activeAccount) return;
    setLoading(true);
    setElapsedTime(0);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('accountId', activeAccount);
    formData.append('mode', auditMode); // <--- PASAMOS EL MODO AL BACKEND

    try {
      const res = await fetch('/api/inventory/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setResults(data);
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
    if (auditMode !== 'master' || !results?.orphans?.length) return;
    if (!confirm(`¿Estás seguro de pausar ${results.orphans.length} publicaciones huérfanas?\nSolo hazlo si subiste el INVENTARIO MAESTRO COMPLETO.`)) return;
    
    setPausing(true);
    try {
      const res = await fetch('/api/inventory/orphans/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          accountId: activeAccount, 
          itemIds: results.orphans.map(o => o.meli_item_id) 
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
          onClick={() => { 
            setAuditMode('master'); 
            setResults(null); 
            setFile(null); // <--- LIMPIAR ARCHIVO
            document.querySelector('input[type="file"]').value = ""; // <--- RESETEAR INPUT
          }}
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
          onClick={() => { 
            setAuditMode('inbound'); 
            setResults(null); 
            setFile(null); // <--- LIMPIAR ARCHIVO
            document.querySelector('input[type="file"]').value = ""; // <--- RESETEAR INPUT
          }}
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
          <input type="file" onChange={(e) => setFile(e.target.files[0])} accept=".xlsx, .xls, .csv" />
          <button className={styles.primaryBtn} 
                  style={{ background: auditMode === 'inbound' ? '#fbbf24' : '#3b82f6', color: auditMode === 'inbound' ? 'black' : 'white' }}
                  onClick={handleUpload} disabled={loading || !file}>
            {loading ? `🔍 Procesando... (${elapsedTime}s)` : (auditMode === 'master' ? '🔍 Iniciar Auditoría' : '📦 Procesar Entrada')}
          </button>
        </div>
      </section>

      {results && (
        <div className={styles.resultsGrid}>
          <div className={styles.statCard}>
            <h3>Sincronizados</h3>
            <div className={styles.statValue} style={{color: '#10b981'}}>{results.summary.matched}</div>
            <p>SKUs que ya están publicados correctamente.</p>
          </div>

          {auditMode === 'master' && (
            <div className={styles.statCard}>
              <h3>Huérfanos (ML)</h3>
              <div className={styles.statValue} style={{color: '#ef4444'}}>{results.summary.orphansCount}</div>
              <p>Publicaciones que NO están en este Excel.</p>
              <button className={styles.dangerBtn} onClick={handlePauseOrphans} disabled={pausing}>
                {pausing ? 'Pausando...' : '⏸️ Pausar Huérfanos'}
              </button>
            </div>
          )}

          <div className={styles.statCard}>
            <h3>Faltantes (ML)</h3>
            <div className={styles.statValue} style={{color: '#fbbf24'}}>{results.summary.missingCount}</div>
            <p>Productos de este Excel que NO están publicados.</p>
          </div>
        </div>
      )}

      {/* DETALLE HUÉRFANOS */}
      {auditMode === 'master' && results?.orphans?.length > 0 && (
        <div className={styles.detailsSection} style={{ borderTop: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, color: '#f87171' }}>Huérfanos a Limpiar</h2>
            <button className={styles.secondaryBtn} onClick={handleDownloadIntegraly}>📥 XLS Integraly</button>
          </div>
          <table className={styles.table}>
            <thead><tr><th>ID ML</th><th>SKU</th><th>Título</th><th>Precio</th></tr></thead>
            <tbody>
              {results.orphans.map(o => (
                <tr key={o.id}>
                  <td><a href={o.permalink} target="_blank" style={{color:'#60a5fa'}}>{o.meli_item_id} ↗</a></td>
                  <td>{o.sku}</td><td>{o.title}</td><td>${o.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DETALLE FALTANTES */}
      {results?.missing?.length > 0 && (
        <div className={styles.detailsSection} style={{ marginTop: '3rem', borderTop: '2px solid #fbbf24' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, color: '#fbbf24' }}>
              {auditMode === 'master' ? 'Faltantes Globales' : '🔥 Prioridad de Publicación (Mercancía Nueva)'}
            </h2>
            <button className={styles.secondaryBtn} onClick={handleDownloadMissingIntegraly}>📥 XLS Para Publicar</button>
          </div>
          <table className={styles.table}>
            <thead><tr><th>SKU</th><th>Título</th><th>Precio</th><th>{auditMode === 'master' ? 'Existencia' : 'Llegada'}</th><th>ML Sugerido</th></tr></thead>
            <tbody>
              {results.missing.map((m, idx) => (
                <tr key={idx}>
                  <td style={{fontWeight:'bold', color:'#fbbf24'}}>{m.sku}</td>
                  <td>{m.title}</td><td>${m.price}</td><td>{m.stock}</td><td>{m.suggestedMeliId || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
