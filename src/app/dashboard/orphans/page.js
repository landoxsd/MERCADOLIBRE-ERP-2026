// src/app/dashboard/orphans/page.js
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  ExternalLink, 
  ArrowRight,
  ShieldCheck,
  Search,
  Sparkles
} from 'lucide-react';
import styles from './Orphans.module.css';

export default function OrphansPage() {
  const [filter, setFilter] = useState('pending'); // pending, approved, rejected
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [processingId, setProcessingId] = useState(null);
  const [notification, setNotification] = useState(null);

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/profit/orphans?filter=${filter}`);
      const data = await res.json();
      if (data.success && data.data) {
        setItems(data.data.items || []);
        setTotal(data.data.total || 0);
      }
    } catch (err) {
      console.error('Error cargando propuestas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, [filter]);

  const handleApprove = async (item) => {
    if (!confirm(`¿Aprobar cambio de SKU a "${item.suggested_sku}" para "${item.title}"?\n\nEsto actualizará la publicación en Mercado Libre (SELLER_SKU=${item.suggested_sku}, Stock=${item.profit_stock}, Precio=$${parseFloat(item.profit_price).toFixed(2)}) y la reactivará.`)) {
      return;
    }

    setProcessingId(item.id);
    try {
      const res = await fetch('/api/profit/orphans/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          meli_item_id: item.meli_item_id,
          suggested_sku: item.suggested_sku,
          update_ml: true
        })
      });
      const data = await res.json();
      if (data.success) {
        setNotification({
          type: 'success',
          text: `✅ ${data.result?.message || 'Cambio aprobado y publicación actualizada en Mercado Libre'}`
        });
        fetchProposals();
      } else {
        alert(`Error al aprobar: ${data.error}`);
      }
    } catch (err) {
      alert(`Error de red: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (item) => {
    if (!confirm(`¿Descartar sugerencia de código para "${item.current_sku}"?`)) return;

    setProcessingId(item.id);
    try {
      const res = await fetch('/api/profit/orphans/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id })
      });
      const data = await res.json();
      if (data.success) {
        setNotification({
          type: 'info',
          text: 'Propuesta descartada.'
        });
        fetchProposals();
      }
    } catch (err) {
      alert(`Error de red: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const matchTypeLabels = {
    discontinued_replacement: '🔄 Descontinuado con Stock',
    equivalence_stock: '🔗 Equivalencia con Existencia',
    multimarca_generic: '🏷️ Multimarca Genérico (E)'
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>
          <span>🔄 Aprobación de Huérfanos y Códigos</span>
        </h1>
        <p className={styles.subtitle}>
          Detecta publicaciones de Mercado Libre que tienen stock físico en Profit Plus bajo códigos descontinuados
          (ej. <code>10384</code> vs <code>K9009</code>), equivalencias o versiones multimarcas con sufijo <code>E</code>.
          Revisa y aprueba el cambio para sincronizar SKU, stock y precio en Mercado Libre de forma segura.
        </p>
      </div>

      {/* Info Banner de Regla de Negocio */}
      <div className={styles.infoBanner}>
        <div className={styles.infoIcon}>🛡️</div>
        <div className={styles.infoText}>
          <h4>Flujo Seguro de Aprobación Obligatoria</h4>
          <p>
            Ninguna publicación huérfana o código descontinuado se modifica automáticamente. 
            El motor de Profit Plus analiza en modo <strong>Solo Lectura (WITH NOLOCK)</strong> las tablas 
            <code>art</code>, <code>st_almac</code> y <code>equivalencia</code> y te presenta la propuesta 
            para que valides el código físico exacto antes de enviar la actualización a la API de Mercado Libre.
          </p>
        </div>
      </div>

      {/* Notificación temporal */}
      {notification && (
        <div style={{
          background: notification.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
          border: `1px solid ${notification.type === 'success' ? '#10b981' : '#3b82f6'}`,
          borderRadius: '10px',
          padding: '0.8rem 1.2rem',
          marginBottom: '1.5rem',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{notification.text}</span>
          <button 
            onClick={() => setNotification(null)}
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabsContainer}>
        <button
          className={`${styles.tabBtn} ${filter === 'pending' ? styles.tabBtnActive : ''}`}
          onClick={() => setFilter('pending')}
        >
          <span>Pendientes de Aprobación</span>
          {filter === 'pending' && <span className={styles.tabBadge}>{total}</span>}
        </button>
        <button
          className={`${styles.tabBtn} ${filter === 'approved' ? styles.tabBtnActive : ''}`}
          onClick={() => setFilter('approved')}
        >
          <span>Aprobadas / Actualizadas</span>
          {filter === 'approved' && <span className={styles.tabBadge}>{total}</span>}
        </button>
        <button
          className={`${styles.tabBtn} ${filter === 'rejected' ? styles.tabBtnActive : ''}`}
          onClick={() => setFilter('rejected')}
        >
          <span>Descartadas</span>
          {filter === 'rejected' && <span className={styles.tabBadge}>{total}</span>}
        </button>

        <button 
          onClick={fetchProposals}
          disabled={loading}
          style={{
            marginLeft: 'auto',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#cbd5e1',
            borderRadius: '8px',
            padding: '0.4rem 0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.85rem'
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refrescar</span>
        </button>
      </div>

      {/* Contenido / Lista de Propuestas */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'rgba(255, 255, 255, 0.5)' }}>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
          <p>Consultando base de datos de publicaciones y Profit Plus...</p>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🎉</div>
          <h3 className={styles.emptyTitle}>
            {filter === 'pending' ? 'No hay propuestas pendientes' : 'No hay propuestas en esta sección'}
          </h3>
          <p className={styles.emptyDesc}>
            {filter === 'pending'
              ? 'Todas las publicaciones con stock en códigos equivalentes o descontinuados ya han sido procesadas.'
              : 'Selecciona la pestaña de Pendientes para revisar nuevas coincidencias detectadas.'}
          </p>
        </div>
      ) : (
        <div className={styles.cardsList}>
          {items.map((item) => {
            const isProcessing = processingId === item.id;
            const priceProfit = parseFloat(item.profit_price) || 0;
            const priceML = parseFloat(item.ml_price) || 0;

            return (
              <div key={item.id} className={styles.proposalCard}>
                {/* 1. Publicación Mercado Libre */}
                <div className={styles.mlCol}>
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.title} className={styles.itemThumb} />
                  ) : (
                    <div className={styles.itemThumb} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                      📷
                    </div>
                  )}
                  <div className={styles.itemInfo}>
                    <h3 className={styles.itemTitle}>
                      {item.permalink ? (
                        <a href={item.permalink} target="_blank" rel="noopener noreferrer">
                          {item.title} <ExternalLink size={12} style={{ display: 'inline' }} />
                        </a>
                      ) : (
                        item.title
                      )}
                    </h3>
                    <div className={styles.itemMeta}>
                      <span className={styles.skuTag} title="SKU actual en Mercado Libre">
                        SKU ML: {item.current_sku || 'Sin SKU'}
                      </span>
                      <span className={`${styles.mlStatusTag} ${item.ml_status === 'active' ? styles.statusActive : styles.statusPaused}`}>
                        {item.ml_status === 'active' ? '🟢 Activa' : '🟡 Pausada'}
                      </span>
                      <span className={styles.mlStats}>
                        Stock ML: <strong>{item.ml_stock}</strong> | Precio ML: <strong>${priceML.toFixed(2)}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Detección en Profit Plus */}
                <div className={styles.profitCol}>
                  <div className={styles.profitBadgeRow}>
                    <span className={styles.matchTypeBadge}>
                      {matchTypeLabels[item.match_type] || '🔍 Coincidencia Profit'}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      Código Sugerido:
                    </span>
                    <span className={styles.suggestedSkuHighlight}>
                      {item.suggested_sku}
                    </span>
                  </div>

                  {item.profit_art_des && (
                    <p className={styles.profitDesc}>
                      "{item.profit_art_des.trim()}"
                    </p>
                  )}

                  <p className={styles.profitReason}>
                    {item.reason}
                  </p>

                  <div className={styles.profitStatsRow}>
                    <span className={styles.stockHighlight}>
                      📦 Existencia en Profit: {item.profit_stock} unid.
                    </span>
                    <span className={styles.priceHighlight}>
                      💵 Precio Venta: ${priceProfit.toFixed(2)} USD
                    </span>
                  </div>
                </div>

                {/* 3. Acciones de Aprobación */}
                <div className={styles.actionCol}>
                  {filter === 'pending' ? (
                    <>
                      <button
                        className={styles.approveBtn}
                        onClick={() => handleApprove(item)}
                        disabled={isProcessing}
                      >
                        <CheckCircle size={16} />
                        <span>{isProcessing ? 'Actualizando...' : 'Aprobar Cambio'}</span>
                      </button>

                      <button
                        className={styles.rejectBtn}
                        onClick={() => handleReject(item)}
                        disabled={isProcessing}
                      >
                        <XCircle size={14} />
                        <span>Descartar</span>
                      </button>
                    </>
                  ) : filter === 'approved' ? (
                    <div className={styles.statusApprovedTag}>
                      ✅ Aprobado
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '2px' }}>
                        {item.applied_at ? new Date(item.applied_at).toLocaleDateString() : ''}
                      </div>
                    </div>
                  ) : (
                    <div className={styles.statusRejectedTag}>
                      ❌ Descartado
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
