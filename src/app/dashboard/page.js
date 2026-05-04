'use client';
import { useEffect, useState } from 'react';
import { ShoppingBag, TrendingUp, HelpCircle, Package, Settings, Users, Loader2 } from 'lucide-react';
import AccountOverview from '@/components/AccountOverview';

// Hook reutilizable para fetch con loading/error
function useApi(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(url)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
        return json;
      })
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e.message); setLoading(false); } });

    return () => { cancelled = true; };
  }, [url]);

  return { data, loading, error };
}

// Skeleton para KPI cards
function KpiSkeleton() {
  return (
    <div className="glass-card" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div style={{ height: '16px', width: '120px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px' }} />
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)' }} />
      </div>
      <div style={{ height: '40px', width: '80px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', marginBottom: '0.5rem' }} />
      <div style={{ height: '14px', width: '140px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
    </div>
  );
}

// Card de KPI con datos reales
function KpiCard({ title, value, subtext, icon, iconBg, iconColor, loading }) {
  if (loading) return <KpiSkeleton />;

  return (
    <div className="glass-card" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <h3 style={{ color: '#cbd5e1', fontSize: '1rem' }}>{title}</h3>
        <div style={{ padding: '8px', background: iconBg, borderRadius: '12px', color: iconColor }}>
          {icon}
        </div>
      </div>
      <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{value}</p>
      <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>{subtext}</p>
    </div>
  );
}

export default function Dashboard() {
  const { data: overview, loading: ovLoading, error: ovError } = useApi('/api/account/overview');
  const { data: ordersData, loading: ordLoading, error: ordError } = useApi('/api/orders?limit=10');

  const orders = ordersData?.orders || [];
  const paging = ordersData?.paging || {};

  // Determinar KPIs dinámicos desde los datos reales
  const sales30d = overview?.sales30d;
  const sales7d = overview?.sales7d;
  const reputation = overview?.reputation;

  const kpiSalesMonth = sales30d ? sales30d.totalOrders.toLocaleString() : '—';
  const kpiSalesGrowth = sales30d && sales7d
    ? (sales7d.totalOrders > 0 ? `+${((sales7d.totalOrders / Math.max(sales30d.totalOrders, 1) * 100).toFixed(0))}%` : '0%')
    : 'vs mes anterior';

  const kpiOpenOrders = paging?.total !== undefined ? paging.total.toString() : '—';
  const kpiOpenSub = ordLoading ? 'Cargando...' : `${orders.filter(o => o.status === 'paid').length} pagadas`;

  const kpiQuestions = '—'; // TODO: endpoint de preguntas
  const kpiQuestionsSub = 'Pendientes';

  const kpiEPC = sales30d && sales30d.totalOrders > 0
    ? `$${(sales30d.totalRevenue / sales30d.totalOrders).toFixed(2)}`
    : '$0.00';
  const kpiEPCSub = sales30d ? `Ingresos: $${sales30d.totalRevenue.toFixed(0)}` : 'Sin ventas';

  // Estado visual para órdenes
  const getStatusStyle = (status) => {
    const map = {
      paid: { label: 'Pagada', color: 'var(--success)' },
      pending: { label: 'Pendiente', color: 'var(--accent)' },
      cancelled: { label: 'Cancelada', color: 'var(--error)' },
      confirmed: { label: 'Confirmada', color: '#60a5fa' },
    };
    return map[status] || { label: status, color: '#94a3b8' };
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="container animate-fade-in" style={{ paddingBottom: '4rem' }}>
      {/* Header */}
      <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Mercado Libre ERP</h1>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginTop: '0.5rem' }}>
            {overview?.account?.nickname
              ? `Cuenta activa: ${overview.account.nickname}`
              : 'Gestión Integral de E-commerce'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-glass" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={18} /> Configuración
          </button>
          <button
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            onClick={() => window.location.reload()}
          >
            <ShoppingBag size={18} /> Sincronizar
          </button>
        </div>
      </header>

      {/* Account Overview - Datos reales de ML */}
      <section style={{ marginBottom: '2rem' }}>
        <AccountOverview />
      </section>

      {/* KPI Cards - Dinámicos */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <KpiCard
          title="Ventas del Mes"
          value={kpiSalesMonth}
          subtext={kpiSalesGrowth}
          icon={<TrendingUp size={24} />}
          iconBg="rgba(59, 130, 246, 0.2)"
          iconColor="var(--primary)"
          loading={ovLoading}
        />
        <KpiCard
          title="Órdenes Abiertas"
          value={kpiOpenOrders}
          subtext={kpiOpenSub}
          icon={<Package size={24} />}
          iconBg="rgba(16, 185, 129, 0.2)"
          iconColor="var(--success)"
          loading={ordLoading}
        />
        <KpiCard
          title="Preguntas Pendientes"
          value={kpiQuestions}
          subtext={kpiQuestionsSub}
          icon={<HelpCircle size={24} />}
          iconBg="rgba(139, 92, 246, 0.2)"
          iconColor="var(--accent)"
          loading={false}
        />
        <KpiCard
          title="Ticket Promedio"
          value={kpiEPC}
          subtext={kpiEPCSub}
          icon={<Users size={24} />}
          iconBg="rgba(239, 68, 68, 0.2)"
          iconColor="var(--error)"
          loading={ovLoading}
        />
      </section>

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '2rem' }}>
        {/* Órdenes Recientes - Datos reales */}
        <section className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package size={20} /> Órdenes Recientes
          </h2>

          {ordLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: '#94a3b8' }}>
              <Loader2 size={32} className="animate-spin" />
            </div>
          )}

          {ordError && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444', background: 'rgba(239,68,68,0.08)', borderRadius: '8px' }}>
              <p>Error cargando órdenes: {ordError}</p>
              {ordError.includes('TOKEN_EXPIRED') && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                  El token expiró. Por favor reconecta la cuenta en Configuración.
                </p>
              )}
            </div>
          )}

          {!ordLoading && !ordError && orders.length === 0 && (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <Package size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <p>No hay órdenes en esta cuenta</p>
              <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                Las órdenes aparecerán aquí cuando tengas ventas en Mercado Libre.
              </p>
            </div>
          )}

          {!ordLoading && !ordError && orders.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                    <th style={{ padding: '12px' }}>ID</th>
                    <th style={{ padding: '12px' }}>Cliente</th>
                    <th style={{ padding: '12px' }}>Producto</th>
                    <th style={{ padding: '12px' }}>Monto</th>
                    <th style={{ padding: '12px' }}>Estado</th>
                    <th style={{ padding: '12px' }}>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const status = getStatusStyle(order.status);
                    const buyerName = order.buyer
                      ? `${order.buyer.firstName || ''} ${order.buyer.lastName || ''}`.trim() || order.buyer.nickname || '—'
                      : '—';
                    const firstItem = order.items?.[0];
                    const itemTitle = firstItem
                      ? (firstItem.title?.length > 35 ? firstItem.title.slice(0, 35) + '...' : firstItem.title)
                      : '—';

                    return (
                      <tr
                        key={order.id}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s', cursor: 'pointer' }}
                        className="table-row-hover"
                        onClick={() => window.open(`https://www.mercadolibre.com.ve/ventas/${order.id}/detalle`, '_blank')}
                      >
                        <td style={{ padding: '16px 12px', fontWeight: '500' }}>#{order.id}</td>
                        <td style={{ padding: '16px 12px' }}>{buyerName}</td>
                        <td style={{ padding: '16px 12px', color: '#94a3b8', fontSize: '0.9rem' }}>{itemTitle}</td>
                        <td style={{ padding: '16px 12px', fontWeight: '600' }}>
                          {order.currencyId} {order.totalAmount?.toFixed(2)}
                        </td>
                        <td style={{ padding: '16px 12px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            backgroundColor: `${status.color}20`,
                            color: status.color,
                            display: 'inline-block'
                          }}>
                            {status.label}
                          </span>
                        </td>
                        <td style={{ padding: '16px 12px', color: '#64748b', fontSize: '0.85rem' }}>
                          {formatDate(order.dateCreated)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <style dangerouslySetInnerHTML={{
            __html: `
            .table-row-hover:hover { background: rgba(255,255,255,0.02); }
            .animate-spin { animation: spin 1s linear infinite; }
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          ` }} />
        </section>

        {/* Acciones Rápidas */}
        <section className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Acciones Rápidas
          </h2>
          <button className="btn-glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '16px' }}>
            WhatsApp Marketing Masivo <span>→</span>
          </button>
          <button className="btn-glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '16px' }}>
            Analizar Competencia <span>→</span>
          </button>
          <button className="btn-glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '16px' }}>
            Gestión de Cookies ML <span>→</span>
          </button>

          <div style={{ marginTop: 'auto', padding: '1rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <p style={{ color: 'var(--success)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)', display: 'inline-block' }} />
              Server MCP Conectado
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}