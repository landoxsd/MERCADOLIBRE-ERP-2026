/* src/components/ProductsTable.js */
'use client';
import { useState, useEffect } from 'react';
import styles from './ProductsTable.module.css';
import QualityScoreBadge from '@/components/optimizer/QualityScoreBadge';

export default function ProductsTable({ accountId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({ all: 0, active: 0, paused: 0, closed: 0 });
  
  // Procesamiento masivo
  const [syncing, setSyncing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState('');

  // SEO Optimizer
  const [qualityScores, setQualityScores] = useState({});

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/account/publications?accountId=${accountId}&search=${search}&status=${filter}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accountId) fetchProducts();
  }, [accountId, search, filter]);

  // Fetch quality scores for visible products
  useEffect(() => {
    if (products.length === 0 || !accountId) return;
    
    // Solo pedir scores de ítems que no tenemos en el estado local
    const itemIdsToFetch = products
      .map(p => p.meli_item_id)
      .filter(id => qualityScores[id] === undefined);

    if (itemIdsToFetch.length === 0) return;

    const fetchScores = async () => {
      try {
        const batchIds = itemIdsToFetch.slice(0, 20).join(',');
        const res = await fetch(`/api/tools/optimizer/performance?accountId=${accountId}&itemIds=${batchIds}`);
        const data = await res.json();
        
        if (data.success && data.results) {
          setQualityScores(prev => {
            const newScores = { ...prev };
            data.results.forEach(r => {
              newScores[r.id] = r;
            });
            return newScores;
          });
        }
      } catch (err) {
        console.error('Error fetching quality scores:', err);
      }
    };
    
    fetchScores();
  }, [products, accountId]);

  useEffect(() => {
    let interval;
    if (syncing) {
      interval = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [syncing]);

  const handleSync = async () => {
    setSyncing(true);
    setElapsedTime(0);
    setProgress(0);
    setSyncStatus('Iniciando...');

    try {
      const initRes = await fetch('/api/account/publications/sync/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId })
      });
      const initData = await initRes.json();
      if (!initData.success) throw new Error(initData.error || 'Error al iniciar');

      const allIds = initData.itemIds || [];
      const total = allIds.length;
      if (total === 0) {
        setSyncStatus(`✅ ¡Al día! ${initData.alreadySynced || 0} publicaciones ya están en tu base de datos.`);
        setTimeout(() => {
          setSyncing(false);
          fetchProducts();
        }, 2000);
        return;
      }

      let processedCount = 0;
      const chunkSize = 500;
      const prefix = initData.alreadySynced ? `(Reanudando +${initData.alreadySynced}) ` : '';

      for (let i = 0; i < allIds.length; i += chunkSize) {
        const batch = allIds.slice(i, i + chunkSize);
        setSyncStatus(`${prefix}Lote ${i + 1} a ${Math.min(i + chunkSize, total)} de ${total}...`);
        
        let retries = 3;
        while (retries > 0) {
          try {
            const batchRes = await fetch('/api/account/publications/sync/batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accountId, itemIds: batch })
            });
            if (batchRes.ok) break;
            throw new Error(`HTTP ${batchRes.status}`);
          } catch (e) {
            retries--;
            if (retries === 0) throw e;
            await new Promise(r => setTimeout(r, 2500));
          }
        }

        processedCount += batch.length;
        setProgress((processedCount / total) * 100);
      }

      setSyncStatus(`✅ Completado en ${elapsedTime}s`);
      setTimeout(() => {
        setSyncing(false);
        fetchProducts();
      }, 4000);
    } catch (err) {
      alert('Error en sincronización: ' + err.message);
      setSyncing(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.tableHeader}>
        <div className={styles.searchWrapper}>
          <input 
            type="text" 
            placeholder="Buscar publicación o SKU..." 
            className={styles.searchBox}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button 
          className={styles.syncBtn} 
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? `⌛ Sincronizando... (${elapsedTime}s)` : '🚀 Sincronización Total'}
        </button>
      </header>

      {syncing && (
        <div className={styles.progressContainer}>
          <div className={styles.progressHeader}>
            <span>{syncStatus}</span>
            <span>{Math.round(progress)}% | Demora: {elapsedTime}s</span>
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className={styles.filterBar}>
        <div className={styles.statusTabs}>
          {[
            { id: 'all', label: 'Todos', count: stats.all },
            { id: 'active', label: 'Activos', count: stats.active },
            { id: 'paused', label: 'Pausados', count: stats.paused },
            { id: 'closed', label: 'Finalizados', count: stats.closed }
          ].map(tab => (
            <button
              key={tab.id}
              className={`${styles.tab} ${filter === tab.id ? styles.tabActive : ''}`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
              <span className={styles.tabCount}>{tab.count?.toLocaleString()}</span>
            </button>
          ))}
        </div>
        <div className={styles.resultsCount}>
          Mostrando {products.length} de {stats[filter] || stats.all} productos
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>PRODUCTO</th>
              <th className={styles.th}>SKU / SISTEMA</th>
              <th className={styles.th}>ESTADO</th>
              <th className={styles.th}>STOCK</th>
              <th className={styles.th}>CALIDAD</th>
              <th className={styles.th}>PRECIO</th>
              <th className={styles.th}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className={styles.emptyState}>Cargando catálogo...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan="7" className={styles.emptyState}>No hay productos para mostrar.</td></tr>
            ) : (
              products.map(p => (
                <tr key={p.id} className={`${styles.tr} ${p.is_orphan ? styles.orphanRow : ''}`}>
                  <td className={styles.td}>
                    <div className={styles.productCell}>
                      <a href={p.permalink} target="_blank" rel="noopener noreferrer" className={styles.imgLink}>
                        <img src={p.thumbnail} alt="" className={styles.thumbnail} />
                      </a>
                      <div className={styles.productMain}>
                        <div className={styles.titleWrapper}>
                          <span className={styles.title} title={p.title}>{p.title}</span>
                          {p.is_orphan && (
                            <div className={styles.orphanBadge} title="Este SKU no existe en el Maestro de Inventario">
                              <span className={styles.star}>★</span>
                              <span className={styles.orphanText}>HUÉRFANA</span>
                            </div>
                          )}
                        </div>
                        <span className={styles.itemId}>{p.meli_item_id}</span>
                        <div className={styles.metrics}>
                          <span className={styles.metric}>👀 {p.visits_count?.toLocaleString() || 0} visitas</span>
                          <span className={styles.metricSeparator}>|</span>
                          <span className={styles.metric}>💰 {p.sold_quantity?.toLocaleString() || 0} vendidos</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <code className={styles.skuTag}>{p.sku || 'SIN SKU'}</code>
                  </td>
                  <td className={styles.td}>
                    <span className={`${styles.status} ${styles['status_' + p.status]}`}>
                      {p.status === 'active' ? '🟢 Activo' : p.status === 'paused' ? '🟡 Pausado' : '🔴 Finalizado'}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span className={p.available_qty === 0 ? styles.lowStock : ''}>
                      {p.available_qty} uds
                    </span>
                  </td>
                  <td className={styles.td}>
                    {qualityScores[p.meli_item_id] ? (
                      <QualityScoreBadge 
                        score={qualityScores[p.meli_item_id].score} 
                        level={qualityScores[p.meli_item_id].level} 
                      />
                    ) : (
                      <div style={{ display: 'inline-block', width: '60px', height: '24px', backgroundColor: '#e2e8f0', borderRadius: '4px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
                    )}
                  </td>
                  <td className={styles.td}>
                    <span className={styles.price}>${p.price?.toLocaleString()}</span>
                  </td>
                  <td className={styles.td}>
                    <button className={styles.actionBtn}>Auditar</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
