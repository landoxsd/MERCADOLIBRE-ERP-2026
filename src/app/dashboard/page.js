'use client';
import { ShoppingBag, TrendingUp, HelpCircle, Package, Settings, Users } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="container animate-fade-in" style={{ paddingBottom: '4rem' }}>
      <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Mercado Libre ERP</h1>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginTop: '0.5rem' }}>Gestión Integral de E-commerce</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-glass" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={18} /> Configuración
          </button>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingBag size={18} /> Sincronizar
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ color: '#cbd5e1', fontSize: '1rem' }}>Ventas del Mes</h3>
            <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.2)', borderRadius: '12px', color: 'var(--primary)' }}>
              <TrendingUp size={24} />
            </div>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>1,248</p>
          <p style={{ color: 'var(--success)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '0.5rem' }}>
            +14% <span style={{ color: '#64748b' }}>vs mes anterior</span>
          </p>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ color: '#cbd5e1', fontSize: '1rem' }}>Órdenes Abiertas</h3>
            <div style={{ padding: '8px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '12px', color: 'var(--success)' }}>
              <Package size={24} />
            </div>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>42</p>
          <p style={{ color: '#64748b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '0.5rem' }}>
            2 para despachar hoy
          </p>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ color: '#cbd5e1', fontSize: '1rem' }}>Preguntas Pendientes</h3>
            <div style={{ padding: '8px', background: 'rgba(139, 92, 246, 0.2)', borderRadius: '12px', color: 'var(--accent)' }}>
              <HelpCircle size={24} />
            </div>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>7</p>
          <p style={{ color: 'var(--error)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '0.5rem' }}>
            3 con más de 1 hora
          </p>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ color: '#cbd5e1', fontSize: '1rem' }}>EPC (Earnings per Click)</h3>
            <div style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.2)', borderRadius: '12px', color: 'var(--error)' }}>
              <Users size={24} />
            </div>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>$0.84</p>
          <p style={{ color: 'var(--success)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '0.5rem' }}>
            +2% <span style={{ color: '#64748b' }}>en conversiones diarias</span>
          </p>
        </div>
      </section>

      {/* Main Content Area */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '2rem' }}>
        <section className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package size={20} /> Órdenes Recientes
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                  <th style={{ padding: '12px' }}>ID</th>
                  <th style={{ padding: '12px' }}>Cliente</th>
                  <th style={{ padding: '12px' }}>Estado</th>
                  <th style={{ padding: '12px' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { id: '200045612', name: 'Juan Carlos', status: 'Por Despachar', color: 'var(--accent)' },
                  { id: '200045601', name: 'Maria Fernanda', status: 'Entregado', color: 'var(--success)' },
                  { id: '200045580', name: 'Orlando Vargas', status: 'Reclamo', color: 'var(--error)' }
                ].map((order, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s', cursor: 'pointer' }} className="table-row-hover">
                    <td style={{ padding: '16px 12px', fontWeight: '500' }}>#{order.id}</td>
                    <td style={{ padding: '16px 12px' }}>{order.name}</td>
                    <td style={{ padding: '16px 12px' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', backgroundColor: `${order.color}20`, color: order.color }}>
                        {order.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 12px' }}>
                      <button className="btn-glass" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>Ver Detalle</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <style dangerouslySetInnerHTML={{__html: `
            .table-row-hover:hover { background: rgba(255,255,255,0.02); }
          `}} />
        </section>

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
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)'}}></div>
              Server MCP Conectado
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
