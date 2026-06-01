'use client';
import { useState, useEffect, useCallback } from 'react';
import { Tag, Target, Crosshair, Loader2, Filter, Clock, ExternalLink, CheckCircle, AlertTriangle, RefreshCw, ChevronDown } from 'lucide-react';

import CampaignSelector from './components/CampaignSelector';
import CampaignStatusBadge from './components/CampaignStatusBadge';
import DiscountSlider from './components/DiscountSlider';
import CompetitorPriceGauge from './components/CompetitorPriceGauge';
import ItemsPromotionTable from './components/ItemsPromotionTable';

export default function PromotionsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [accountId, setAccountId] = useState('');

  // Campañas
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // Items (compartido entre Lotes y Línea)
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsPage, setItemsPage] = useState(0);
  const [itemsTotalCount, setItemsTotalCount] = useState(0);
  const [itemsFilter, setItemsFilter] = useState({ search: '', status: 'active' });
  const ITEMS_PER_PAGE = 50;

  // Tab 1: Lotes
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchDiscount, setBatchDiscount] = useState(10);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState(null);

  // Tab 2: Línea — descuento por categoría
  const [lineDiscounts, setLineDiscounts] = useState({}); // { catId: pct }
  const [applyingLine, setApplyingLine] = useState(null);
  const [lineResults, setLineResults] = useState({});

  // Tab 3: Competencia
  const [analysisFilter, setAnalysisFilter] = useState('highest_ticket');
  const [analysisCategory, setAnalysisCategory] = useState('');
  const [analyzedItems, setAnalyzedItems] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);

  // ─── Cuenta activa ──────────────────────────────────────────────
  useEffect(() => {
    const getCookie = (name) => {
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
      if (match) return match[2];
      return null;
    };

    const cookieAccountId = getCookie('meli_erp_account');
    
    if (cookieAccountId) {
      setAccountId(cookieAccountId);
    } else {
      fetch('/api/auth/accounts')
        .then(res => res.json())
        .then(data => {
          if (data.accounts && data.accounts.length > 0) {
            setAccountId(data.accounts[0].id);
          }
        })
        .catch(console.error);
    }
  }, []);

  // ─── Cargar campañas ────────────────────────────────────────────
  useEffect(() => {
    if (!accountId) return;
    setLoadingCampaigns(true);
    fetch(`/api/promotions/campaigns?accountId=${accountId}`)
      .then(r => r.json())
      .then(d => setCampaigns(d.campaigns || []))
      .finally(() => setLoadingCampaigns(false));
  }, [accountId]);

  // ─── Cargar publicaciones desde Supabase ────────────────────────
  const fetchItems = useCallback(async (page = 0, filters = itemsFilter) => {
    if (!accountId) return;
    setLoadingItems(true);
    setApplyResult(null);
    try {
      const params = new URLSearchParams({
        accountId,
        status: filters.status || 'active',
      });
      if (filters.search) params.set('search', filters.search);

      const res = await fetch(`/api/account/publications?${params}`);
      const data = await res.json();

      if (data.products) {
        // Adaptar los datos de Supabase al formato que espera la tabla
        const mapped = data.products.map(p => ({
          id: p.meli_item_id || p.id,
          title: p.title,
          price: p.price || 0,
          category_id: p.category_id || 'Sin categoría',
          status: p.status,
          promotions: [], // Se enriquece en el paso siguiente
          dealPrice: '',
        }));
        setItems(mapped);
        setItemsTotalCount(data.count || mapped.length);

        // Buscar promociones en ML para los IDs válidos
        const mlvIds = mapped.map(i => i.id).filter(id => typeof id === 'string' && id.startsWith('MLV'));
        if (mlvIds.length > 0) {
            fetch(`/api/promotions/items?accountId=${accountId}&ids=${mlvIds.join(',')}`)
              .then(r => r.json())
              .then(promoData => {
                  if (promoData.results) {
                      setItems(prevItems => prevItems.map(item => {
                          const promoResult = promoData.results.find(pr => pr.id === item.id);
                          return promoResult ? { ...item, promotions: promoResult.promos || [] } : item;
                      }));
                  }
              })
              .catch(console.error);
        }
      }
    } catch (err) {
      console.error('Error cargando publicaciones:', err);
    } finally {
      setLoadingItems(false);
    }
  }, [accountId, itemsFilter]);

  // Cargar items cuando cambia la cuenta o el tab activo (Lotes o Línea)
  useEffect(() => {
    if ((activeTab === 1 || activeTab === 2) && accountId) {
      fetchItems(0, itemsFilter);
    }
  }, [activeTab, accountId]);

  // ─── Aplicar a Lote ─────────────────────────────────────────────
  const handleApplyBatch = async () => {
    if (selectedIds.size === 0 || !selectedCampaignId) return;
    setApplying(true);
    setApplyResult(null);
    try {
      const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
      const itemsToApply = [...selectedIds].map(id => {
        const item = items.find(i => i.id === id);
        const dealPrice = item?.dealPrice
          ? parseFloat(item.dealPrice)
          : parseFloat((item.price * (1 - batchDiscount / 100)).toFixed(2));
        return { id, price: dealPrice };
      });

      const res = await fetch('/api/promotions/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          items: itemsToApply,
          promotionId: selectedCampaignId,
          promotionType: selectedCampaign?.type || 'DEAL',
        }),
      });
      const data = await res.json();
      setApplyResult({
        ok: data.success || 0,
        errors: data.errors?.length || 0,
        total: itemsToApply.length,
      });
      // Refrescar items para ver el estado actualizado
      setTimeout(() => fetchItems(0, itemsFilter), 1500);
    } catch (err) {
      setApplyResult({ ok: 0, errors: selectedIds.size, total: selectedIds.size });
    } finally {
      setApplying(false);
    }
  };

  // ─── Retirar de campaña ─────────────────────────────────────────
  const handleRetireBatch = async () => {
    if (selectedIds.size === 0 || !selectedCampaignId) return;
    setApplying(true);
    setApplyResult(null);
    try {
      const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
      const res = await fetch('/api/promotions/items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          itemIds: [...selectedIds],
          promotionId: selectedCampaignId,
          promotionType: selectedCampaign?.type || 'DEAL',
        }),
      });
      const data = await res.json();
      const ok = data.results?.filter(r => r.success).length || 0;
      setApplyResult({ ok, errors: selectedIds.size - ok, total: selectedIds.size, isRetire: true });
    } catch (err) {
      setApplyResult({ ok: 0, errors: selectedIds.size, total: selectedIds.size });
    } finally {
      setApplying(false);
    }
  };

  // ─── Aplicar por Línea ──────────────────────────────────────────
  const handleApplyLine = async (catId) => {
    if (!selectedCampaignId) {
      alert('Selecciona una campaña primero en la pestaña "Gestión por Lotes"');
      return;
    }
    setApplyingLine(catId);
    setLineResults(prev => ({ ...prev, [catId]: null }));
    try {
      const catItems = items.filter(i => i.category_id === catId);
      const discountPct = lineDiscounts[catId] ?? 10;
      const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
      const itemsToApply = catItems.map(item => ({
        id: item.id,
        price: parseFloat((item.price * (1 - discountPct / 100)).toFixed(2)),
      }));

      const res = await fetch('/api/promotions/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          items: itemsToApply,
          promotionId: selectedCampaignId,
          promotionType: selectedCampaign?.type || 'DEAL',
        }),
      });
      const data = await res.json();
      setLineResults(prev => ({
        ...prev,
        [catId]: { ok: data.success || 0, errors: data.errors?.length || 0 }
      }));
    } catch (err) {
      setLineResults(prev => ({ ...prev, [catId]: { ok: 0, errors: catItems.length } }));
    } finally {
      setApplyingLine(null);
    }
  };

  // ─── Analizar vs Competencia ────────────────────────────────────
  const handleAnalyzeCompetitors = async () => {
    if (!accountId) return;
    setAnalyzing(true);
    setAnalyzedItems([]);
    try {
      // Usar los primeros items cargados para el análisis, ordenados por precio desc
      const topItems = [...items]
        .sort((a, b) => {
          if (analysisFilter === 'most_sold') return (b.sold_quantity || 0) - (a.sold_quantity || 0);
          if (analysisFilter === 'least_sold') return (a.sold_quantity || 0) - (b.sold_quantity || 0);
          return b.price - a.price; // highest_ticket por defecto
        })
        .slice(0, 8)
        .map(i => i.id);

      const queryFilter = analysisFilter === 'by_line' ? `by_line:${analysisCategory}` : analysisFilter;

      const res = await fetch('/api/promotions/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          itemIds: topItems.length > 0 ? topItems : items.slice(0, 5).map(i => i.id),
          filter: queryFilter,
          includeCompetitors: true,
        }),
      });
      const data = await res.json();
      if (data.analysis) setAnalyzedItems(data.analysis);
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  // ─── KPIs ────────────────────────────────────────────────────────
  const activeCampaignsCount = campaigns.filter(c => c.status === 'started').length;
  const closestExpiry = campaigns
    .filter(c => c.status === 'started' && c.finish_date)
    .sort((a, b) => new Date(a.finish_date) - new Date(b.finish_date))[0];

  // ─── Categorías agrupadas ────────────────────────────────────────
  const categoryGroups = Array.from(new Set(items.map(i => i.category_id)))
    .map(catId => ({
      id: catId,
      name: catId, // Supabase no tiene nombre; mostramos el ID. Se puede enriquecer con la API de categorías
      items: items.filter(i => i.category_id === catId),
      discount: lineDiscounts[catId] ?? 10,
    }));

  const handlePriceEdit = (id, newPrice) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, dealPrice: newPrice } : i));
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchItems(0, itemsFilter);
  };

  return (
    <div className="dashboard-wrapper">
      <div className="container">

        {/* Header */}
        <div className="dashboard-title-container" style={{ marginBottom: '24px' }}>
          <div>
            <h1 className="dashboard-title">Promociones y Descuentos</h1>
            <p className="dashboard-subtitle">Gestiona campañas y optimiza tus precios en Mercado Libre.</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0' }}>
          {['Vista General', 'Gestión por Lotes', 'Por Línea', 'vs Competencia'].map((tab, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              style={{
                background: 'transparent',
                color: activeTab === i ? '#3b82f6' : '#64748b',
                border: 'none',
                borderBottom: activeTab === i ? '2px solid #3b82f6' : '2px solid transparent',
                padding: '10px 18px',
                cursor: 'pointer',
                fontWeight: activeTab === i ? '600' : '400',
                fontSize: '0.9rem',
                transition: 'all 0.2s',
                marginBottom: '-1px',
              }}
            >{tab}</button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════
            TAB 0: VISTA GENERAL
        ══════════════════════════════════════════════════ */}
        {activeTab === 0 && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="stat-cards-grid">
              <div className="stat-card-custom glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Campañas Activas</span>
                  <Tag size={20} color="#3b82f6" />
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#f1f5f9', marginTop: '12px' }}>{activeCampaignsCount}</div>
              </div>
              <div className="stat-card-custom glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Próxima Expiración</span>
                  <Clock size={20} color="#f59e0b" />
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#f1f5f9', marginTop: '12px' }}>
                  {closestExpiry ? new Date(closestExpiry.finish_date).toLocaleDateString('es-VE') : 'N/A'}
                </div>
                {closestExpiry?.name && <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{closestExpiry.name}</div>}
              </div>
              <div className="stat-card-custom glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Campañas Totales</span>
                  <Target size={20} color="#8b5cf6" />
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#f1f5f9', marginTop: '12px' }}>{campaigns.length}</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#f1f5f9', marginBottom: '16px' }}>Mis Campañas</h3>
              {loadingCampaigns ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader2 className="animate-spin" size={28} color="#3b82f6" /></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {campaigns.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: '#f1f5f9' }}>{c.name || c.id}</div>
                        <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '2px' }}>Tipo: {c.type} · ID: {c.id}</div>
                      </div>
                      <CampaignStatusBadge status={c.status} finishDate={c.finish_date} name={c.name} />
                    </div>
                  ))}
                  {campaigns.length === 0 && <div style={{ color: '#94a3b8', textAlign: 'center', padding: '24px' }}>No se encontraron campañas.</div>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB 1: GESTIÓN POR LOTES
        ══════════════════════════════════════════════════ */}
        {activeTab === 1 && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Panel de control */}
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 260px' }}>
                <CampaignSelector campaigns={campaigns} selectedId={selectedCampaignId} onChange={setSelectedCampaignId} />
              </div>
              <div style={{ flex: '1 1 260px' }}>
                <DiscountSlider basePrice={0} value={batchDiscount} onChange={setBatchDiscount} />
              </div>
              <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                <button
                  className="btn-primary"
                  disabled={selectedIds.size === 0 || !selectedCampaignId || applying}
                  onClick={handleApplyBatch}
                  style={{ height: '42px', padding: '0 20px' }}
                >
                  {applying ? <Loader2 className="animate-spin" size={16} /> : `Aplicar (${selectedIds.size})`}
                </button>
                <button
                  className="btn-glass"
                  disabled={selectedIds.size === 0 || !selectedCampaignId || applying}
                  onClick={handleRetireBatch}
                  style={{ height: '42px', padding: '0 16px', color: '#ef4444' }}
                >
                  Retirar
                </button>
              </div>
            </div>

            {/* Resultado de la operación */}
            {applyResult && (
              <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: applyResult.errors === 0 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${applyResult.errors === 0 ? '#10b981' : '#f59e0b'}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
                {applyResult.errors === 0
                  ? <CheckCircle size={18} color="#10b981" />
                  : <AlertTriangle size={18} color="#f59e0b" />}
                <span style={{ color: '#f1f5f9', fontSize: '0.9rem' }}>
                  {applyResult.isRetire ? 'Retiradas' : 'Aplicadas'}: <strong>{applyResult.ok}</strong> de {applyResult.total} publicaciones.
                  {applyResult.errors > 0 && ` · ${applyResult.errors} con errores (la publicación puede no estar activa o requerir otro mínimo de descuento).`}
                </span>
              </div>
            )}

            {/* Barra de búsqueda y filtros */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', flex: '1 1 300px' }}>
                <input
                  type="text"
                  className="input-glass"
                  placeholder="Buscar por título o SKU..."
                  value={itemsFilter.search}
                  onChange={e => setItemsFilter(prev => ({ ...prev, search: e.target.value }))}
                  style={{ flex: 1, height: '38px' }}
                />
                <button type="submit" className="btn-glass" style={{ height: '38px', padding: '0 14px' }}>Buscar</button>
              </form>
              <select
                className="input-glass"
                value={itemsFilter.status}
                onChange={e => { const s = e.target.value; setItemsFilter(prev => ({ ...prev, status: s })); fetchItems(0, { ...itemsFilter, status: s }); }}
                style={{ height: '38px', minWidth: '140px' }}
              >
                <option value="active">Activas</option>
                <option value="paused">Pausadas</option>
                <option value="closed">Cerradas</option>
                <option value="all">Todas</option>
              </select>
              <button
                className="btn-glass"
                onClick={() => fetchItems(0, itemsFilter)}
                style={{ height: '38px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={14} /> Recargar
              </button>
              <span style={{ color: '#64748b', fontSize: '0.85rem', flexShrink: 0 }}>
                {loadingItems ? 'Cargando...' : `${items.length} de ${itemsTotalCount} publicaciones`}
              </span>
            </div>

            {/* Tabla de ítems */}
            {loadingItems
              ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader2 className="animate-spin" size={32} color="#3b82f6" /></div>
              : <ItemsPromotionTable items={items} selectedIds={selectedIds} onSelectionChange={setSelectedIds} onPriceEdit={handlePriceEdit} />
            }
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB 2: POR LÍNEA
        ══════════════════════════════════════════════════ */}
        {activeTab === 2 && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Info campaña seleccionada */}
            <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Filter size={18} color="#3b82f6" />
              <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Campaña destino:</span>
              {selectedCampaignId
                ? <span style={{ color: '#f1f5f9', fontWeight: '600' }}>{campaigns.find(c => c.id === selectedCampaignId)?.name || selectedCampaignId}</span>
                : <span style={{ color: '#f59e0b', fontSize: '0.85rem' }}>⚠ Ninguna seleccionada. Ve a "Gestión por Lotes" y elige una campaña primero.</span>
              }
              {!selectedCampaignId && (
                <select className="input-glass" value={selectedCampaignId} onChange={e => setSelectedCampaignId(e.target.value)} style={{ marginLeft: 'auto', minWidth: '200px', height: '36px' }}>
                  <option value="">-- Seleccionar campaña --</option>
                  {campaigns.filter(c => c.status !== 'finished').map(c => (
                    <option key={c.id} value={c.id}>{c.name || c.id} ({c.status === 'started' ? 'Activa' : 'Candidata'})</option>
                  ))}
                </select>
              )}
            </div>

            {loadingItems
              ? <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader2 className="animate-spin" size={32} color="#3b82f6" /></div>
              : items.length === 0
                ? <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No hay publicaciones cargadas. Ve a "Gestión por Lotes" primero.</div>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {categoryGroups.map(({ id: catId, items: catItems, discount }) => {
                      const result = lineResults[catId];
                      return (
                        <div key={catId} className="glass-panel" style={{ padding: '18px 20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                            <div>
                              <div style={{ fontWeight: '600', color: '#3b82f6', fontSize: '1rem' }}>
                                Categoría: {catId}
                              </div>
                              <div style={{ color: '#64748b', fontSize: '0.82rem', marginTop: '3px' }}>
                                {catItems.length} publicación{catItems.length !== 1 ? 'es' : ''} · Precio promedio: ${(catItems.reduce((s, i) => s + i.price, 0) / catItems.length).toFixed(2)}
                              </div>
                              {result && (
                                <div style={{ marginTop: '6px', fontSize: '0.8rem', color: result.errors === 0 ? '#10b981' : '#f59e0b' }}>
                                  {result.errors === 0 ? `✓ ${result.ok} aplicadas` : `⚠ ${result.ok} OK · ${result.errors} errores`}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                              <div style={{ minWidth: '260px' }}>
                                <DiscountSlider
                                  basePrice={0}
                                  value={discount}
                                  onChange={val => setLineDiscounts(prev => ({ ...prev, [catId]: val }))}
                                />
                              </div>
                              <button
                                className="btn-primary"
                                style={{ height: '40px', padding: '0 18px', whiteSpace: 'nowrap' }}
                                disabled={applyingLine === catId || !selectedCampaignId}
                                onClick={() => handleApplyLine(catId)}
                              >
                                {applyingLine === catId ? <Loader2 className="animate-spin" size={15} /> : `Aplicar ${discount}% (${catItems.length})`}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
            }
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB 3: VS COMPETENCIA
        ══════════════════════════════════════════════════ */}
        {activeTab === 3 && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            <div className="glass-panel search-panel" style={{ padding: '20px' }}>
              <div className="search-panel-row" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="search-input-group" style={{ flex: 1, minWidth: '200px' }}>
                  <label className="search-input-label">Criterio de Priorización</label>
                  <select className="input-glass" value={analysisFilter} onChange={e => setAnalysisFilter(e.target.value)}>
                    <option value="highest_ticket">Mayor Ticket (precio)</option>
                    <option value="most_sold">Más Vendidos</option>
                    <option value="least_sold">Menos Vendidos (impulsar)</option>
                    <option value="by_line">Por Línea/Categoría</option>
                  </select>
                </div>
                {analysisFilter === 'by_line' && (
                  <div className="search-input-group" style={{ flex: 1 }}>
                    <label className="search-input-label">Categoría ML (ID)</label>
                    <input type="text" className="input-glass" value={analysisCategory} onChange={e => setAnalysisCategory(e.target.value)} placeholder="Ej: MLV12345" />
                  </div>
                )}
                <button
                  className="btn-compare-green"
                  onClick={handleAnalyzeCompetitors}
                  disabled={analyzing || items.length === 0}
                  style={{ height: '42px', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {analyzing ? <><Loader2 className="animate-spin" size={16} /> Analizando...</> : <><Crosshair size={16} /> ANALIZAR</>}
                </button>
                {items.length === 0 && (
                  <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>⚠ Carga publicaciones en "Gestión por Lotes" primero.</span>
                )}
              </div>
            </div>

            {analyzedItems.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {analyzedItems.map(item => (
                  <div key={item.id} className="glass-panel" style={{ padding: '20px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: '2 1 260px' }}>
                      <a
                        href={`https://articulo.mercadolibre.com.ve/${item.id.replace('MLV', 'MLV-')}`}
                        target="_blank" rel="noreferrer"
                        style={{ fontSize: '0.8rem', color: '#3b82f6', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                      >
                        {item.id} <ExternalLink size={11} />
                      </a>
                      <a
                        href={`https://articulo.mercadolibre.com.ve/${item.id.replace('MLV', 'MLV-')}`}
                        target="_blank" rel="noreferrer"
                        style={{ display: 'block', textDecoration: 'none', marginTop: '4px' }}
                      >
                        <div style={{ fontSize: '1rem', fontWeight: '500', color: '#f1f5f9' }}>{item.title}</div>
                      </a>
                      <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '6px' }}>
                        Nuestro precio: <strong style={{ color: '#f1f5f9' }}>${item.price.toFixed(2)}</strong>
                      </div>
                    </div>
                    <div style={{ flex: '1 1 120px', display: 'flex', justifyContent: 'center' }}>
                      {item.competitorAnalysis?.success
                        ? <CompetitorPriceGauge ourPrice={item.price} minCompetitorPrice={item.competitorAnalysis.minCompetitorPrice} />
                        : <div style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center' }}>Sin datos de competencia</div>
                      }
                    </div>
                    <div style={{ flex: '1 1 180px', backgroundColor: 'rgba(0,0,0,0.25)', padding: '14px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      {item.competitorAnalysis?.success && item.competitorAnalysis.suggestedDealPrice ? (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Precio Ganador Sugerido:</span>
                            {item.competitorAnalysis.championPermalink && (
                              <a href={item.competitorAnalysis.championPermalink} target="_blank" rel="noreferrer" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none', fontSize: '0.75rem' }}>
                                Competencia <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#10b981', marginBottom: '10px' }}>
                            ${item.competitorAnalysis.suggestedDealPrice.toFixed(2)}
                          </div>
                          <button className="btn-primary" style={{ width: '100%', padding: '7px', fontSize: '0.85rem' }}>Aplicar Oferta</button>
                        </>
                      ) : (
                        <div style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center' }}>No se pudo calcular</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
