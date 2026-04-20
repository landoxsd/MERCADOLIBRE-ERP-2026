'use client';
import { useEffect, useState } from 'react';
import styles from './AccountOverview.module.css';

// Widget principal del resumen de cuenta que va en el Dashboard
export default function AccountOverview({ accountId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const url = accountId
      ? `/api/account/overview?accountId=${accountId}`
      : `/api/account/overview`;

    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [accountId]);

  if (loading) return <div className={styles.skeleton} />;
  if (error || !data) return null;

  const { reputation, billing, sales7d, sales30d } = data;

  return (
    <div className={styles.wrapper}>

      {/* 1. Alerta de Deuda (prominente si hay deuda) */}
      {billing && (
        <div className={`${styles.billingAlert} ${billing.isUpToDate ? styles.green : styles.red}`}>
          <span className={styles.alertIcon}>{billing.isUpToDate ? '✅' : '🚨'}</span>
          <div>
            <strong>{billing.isUpToDate ? '¡Estás al día con tus pagos!' : 'Tienes deuda pendiente con ML'}</strong>
            {!billing.isUpToDate && (
              <p>Deuda estimada: <b>{billing.currency} {billing.estimatedDebt.toFixed(2)}</b> — Puede afectar tu posicionamiento</p>
            )}
            {billing.isUpToDate && billing.totalCharges > 0 && (
              <p>Cargos del mes: {billing.currency} {billing.totalCharges.toFixed(2)}</p>
            )}
          </div>
          <a href="https://www.mercadolibre.com/facturacion" target="_blank" rel="noopener noreferrer"
             className={styles.billingLink}>
            Ver Facturación →
          </a>
        </div>
      )}

      {/* 2. Grid de Métricas */}
      <div className={styles.grid}>

        {/* Reputación */}
        {reputation && (
          <div className={`glass-card ${styles.repCard}`}>
            <div className={styles.cardHeader}>
              <span>🏆 Reputación</span>
              <a href={reputation.permalink} target="_blank" rel="noopener noreferrer"
                 className={styles.permaLink} title="Ver Mi Página">
                Mi Página ↗
              </a>
            </div>
            <div className={styles.repLevel} style={{ color: reputation.levelColor }}>
              <span className={styles.repDot} style={{ background: reputation.levelColor }} />
              {reputation.levelEmoji} {reputation.levelLabel}
              {reputation.powerSeller && (
                <span className={styles.powerBadge}>{reputation.powerSeller.toUpperCase()}</span>
              )}
            </div>
            <div className={styles.repStats}>
              <div className={styles.repStat}>
                <span>{reputation.transactions.total}</span>
                <small>Transacciones</small>
              </div>
              <div className={styles.repStat}>
                <span style={{ color: '#10b981' }}>
                  {(reputation.transactions.ratings.positive * 100).toFixed(1)}%
                </span>
                <small>Positivas</small>
              </div>
              <div className={styles.repStat}>
                <span style={{ color: '#ef4444' }}>
                  {(reputation.transactions.ratings.negative * 100).toFixed(1)}%
                </span>
                <small>Negativas</small>
              </div>
            </div>
          </div>
        )}

        {/* Ventas 7 días */}
        {sales7d && (
          <div className="glass-card">
            <div className={styles.cardHeader}><span>📦 Últimos 7 días</span></div>
            <p className={styles.bigNumber}>{sales7d.totalOrders}</p>
            <small style={{ color: '#94a3b8' }}>órdenes completadas</small>
            <div className={styles.subStats}>
              <span>Ingresos: <b>{sales7d.totalRevenue.toFixed(0)}</b></span>
              <span>Ticket Prom: <b>{sales7d.averageTicket.toFixed(0)}</b></span>
            </div>
          </div>
        )}

        {/* Ventas 30 días */}
        {sales30d && (
          <div className="glass-card">
            <div className={styles.cardHeader}><span>📈 Últimos 30 días</span></div>
            <p className={styles.bigNumber}>{sales30d.totalOrders}</p>
            <small style={{ color: '#94a3b8' }}>órdenes completadas</small>
            <div className={styles.subStats}>
              <span>Ingresos: <b>{sales30d.totalRevenue.toFixed(0)}</b></span>
              <span>Unidades: <b>{sales30d.totalUnits}</b></span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
