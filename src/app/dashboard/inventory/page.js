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
          setResults(data);
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
    if (!results?.orphans?.length) return;
    if (!confirm(`¿Estás seguro de pausar ${results.orphans.length} publicaciones huérfanas?\nEsto también bajará su stock a 0.`)) return;
    
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
      
      let finalMessage = data.message;
      if (data.errors && data.errors.length > 0) {
        finalMessage += '\n\nDetalles del rechazo de ML:\n' + data.errors.join('\n');
      }
      alert(finalMessage);
      
      // Ya no recargamos de inmediato para no perder la caché, el usuario debe subir nuevo Excel si las arregló.
    } catch (err) {
      alert('Error al pausar huérfanos');
    } finally {
      setPausing(false);
    }
  };

  const handleDownloadIntegraly = () => {
    if (!results?.orphans?.length) return;

    // Formatear la base de datos de huérfanas haciéndose pasar por Integraly
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
    
    // Auto-ajustar ancho de columnas para que se vea limpio
    worksheet['!cols'] = [
      { wch: 18 },  // ML ID
      { wch: 60 },  // Titulo
      { wch: 15 },  // Precio
      { wch: 20 },  // SKU
      { wch: 15 },  // Estado
      { wch: 50 },  // URL
    ];

    XLSX.writeFile(workbook, "Huerfanas_Para_Integraly.xlsx");
  };

  return (
    <div style={{ padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '800' }}>Auditoría de Inventario</h1>
        <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
          Cruce de datos entre tu sistema local (Excel) y Mercado Libre para detectar huérfanos y faltantes.
        </p>
      </header>

      <div style={{ background: 'rgba(59, 130, 246, 0.1)', borderLeft: '4px solid #3b82f6', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
        <h3 style={{ color: '#60a5fa', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
          💡 Flujo de Trabajo Operativo Recomendado
        </h3>
        <ol style={{ marginLeft: '1.5rem', color: 'rgba(255, 255, 255, 0.8)', lineHeight: '1.6' }}>
          <li>Ve al menú lateral izquierdo, entra en <strong>Publicaciones</strong> y presiona el botón <strong>Sincronizar</strong> (para bajar los catálogos en vivo).</li>
          <li>Descarga de tu ERP (Profit Plus) un archivo Excel actualizado del momento.</li>
          <li>Regresa aquí, sube el Excel y presiona <strong>Iniciar Auditoría</strong> comparando datos simétricamente frescos.</li>
        </ol>
      </div>

      <section className={styles.uploadCard}>
        <h2>Subir Inventario Local</h2>
        <p>Carga tu archivo Excel (.xlsx o .csv) con columnas: <strong>SKU, Titulo, Precio, Stock.</strong></p>
        <div className={styles.dropzone}>
          <input type="file" onChange={(e) => setFile(e.target.files[0])} accept=".xlsx, .xls, .csv" />
          <button className={styles.primaryBtn} onClick={handleUpload} disabled={loading || !file}>
            {loading ? `🔍 Procesando... (${elapsedTime}s)` : '🔍 Iniciar Auditoría'}
          </button>
        </div>
      </section>

      {results && (
        <>
          {results.timestamp && (
            <div style={{ marginBottom: '1rem', color: '#60a5fa', fontWeight: 'bold' }}>
              🕰️ Mostrando última auditoría generada el: {results.timestamp}
            </div>
          )}
          <div className={styles.resultsGrid}>
            <div className={styles.statCard}>
              <h3>Sincronizados</h3>
              <div className={styles.statValue} style={{color: '#10b981'}}>{results.summary.matched}</div>
              <p>SKUs coinciden perfectamente.</p>
            </div>

            <div className={styles.statCard}>
              <h3>Huérfanos en ML</h3>
              <div className={styles.statValue} style={{color: '#ef4444'}}>{results.summary.orphansCount}</div>
              <p>Están en ML pero no en tu sistema.</p>
              <button 
                className={styles.dangerBtn} 
                onClick={handlePauseOrphans}
                disabled={pausing || results.summary.orphansCount === 0}
              >
                {pausing ? 'Pausando...' : '⏸️ Pausar Todos los Huérfanos'}
              </button>
            </div>

            <div className={styles.statCard}>
              <h3>Faltantes en ML</h3>
              <div className={styles.statValue} style={{color: '#eab308'}}>{results.summary.missingCount}</div>
              <p>En tu sistema pero no publicados.</p>
              <button className={styles.secondaryBtn}>📦 Sugerir Publicación</button>
            </div>
          </div>
        </>
      )}

      {results?.orphans?.length > 0 && (
        <div className={styles.detailsSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>Detalle de Publicaciones Huérfanas</h2>
            <button className={styles.secondaryBtn} onClick={handleDownloadIntegraly}>📥 Descargar XLS (Integraly)</button>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID Mercado Libre</th>
                <th>SKU detectado (Antiguo)</th>
                <th>Título</th>
                <th>Precio</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {results.orphans.map(o => (
                <tr key={o.id}>
                  <td>
                    {o.permalink ? (
                      <a href={o.permalink} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>
                        {o.meli_item_id} ↗
                      </a>
                    ) : (
                      o.meli_item_id
                    )}
                  </td>
                  <td style={{fontWeight: 'bold', color: '#f87171'}}>{o.sku || 'SIN SKU'}</td>
                  <td>{o.title}</td>
                  <td>${o.price}</td>
                  <td>
                    <span className={o.status === 'active' ? styles.statusActive : styles.statusPaused}>
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
