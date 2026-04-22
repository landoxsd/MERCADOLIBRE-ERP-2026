/* src/app/dashboard/inventory/page.js */
'use client';
import { useState, useEffect } from 'react';
import styles from './Inventory.module.css';

export default function InventoryAuditPage() {
  const [activeAccount, setActiveAccount] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [pausing, setPausing] = useState(false);

  useEffect(() => {
    const fetchActiveAccount = async () => {
      const res = await fetch('/api/auth/accounts');
      const data = await res.json();
      if (data.accounts?.length > 0) setActiveAccount(data.accounts[0].id);
    };
    fetchActiveAccount();
  }, []);

  const handleUpload = async () => {
    if (!file || !activeAccount) return;
    setLoading(true);
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
    if (!confirm(`¿Estás seguro de pausar ${results.orphans.length} publicaciones huérfanas?`)) return;
    
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
      handleUpload(); // Refrescar auditoría
    } catch (err) {
      alert('Error al pausar huérfanos');
    } finally {
      setPausing(false);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '800' }}>Auditoría de Inventario</h1>
        <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
          Cruce de datos entre tu sistema local (Excel) y Mercado Libre para detectar huérfanos y faltantes.
        </p>
      </header>

      <section className={styles.uploadCard}>
        <h2>Subir Inventario Local</h2>
        <p>Carga tu archivo Excel (.xlsx o .csv) con columnas: <strong>SKU, Titulo, Precio, Stock.</strong></p>
        <div className={styles.dropzone}>
          <input type="file" onChange={(e) => setFile(e.target.files[0])} accept=".xlsx, .xls, .csv" />
          <button className={styles.primaryBtn} onClick={handleUpload} disabled={loading || !file}>
            {loading ? 'Procesando...' : '🔍 Iniciar Auditoría'}
          </button>
        </div>
      </section>

      {results && (
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
      )}

      {results?.orphans?.length > 0 && (
        <div className={styles.detailsSection}>
          <h2>Detalle de Publicaciones Huérfanas</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID Mercado Libre</th>
                <th>SKU detectado</th>
                <th>Título</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {results.orphans.map(o => (
                <tr key={o.id}>
                  <td>{o.meli_item_id}</td>
                  <td style={{fontWeight: 'bold'}}>{o.sku}</td>
                  <td>{o.title}</td>
                  <td>{o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
