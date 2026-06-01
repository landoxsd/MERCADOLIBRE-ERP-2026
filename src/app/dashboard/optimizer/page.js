'use client';
import { useState, useEffect, useCallback } from 'react';
import { Tag, Target, Search, ArrowRight, ArrowLeft, Loader2, Play, CheckCircle, ChevronRight, ExternalLink } from 'lucide-react';

import AttributeGapTable from '@/components/optimizer/AttributeGapTable';
import PhotoComparisonGrid from '@/components/optimizer/PhotoComparisonGrid';
import QualityScoreBadge from '@/components/optimizer/QualityScoreBadge';
import TitleAnalyzer from '@/components/optimizer/TitleAnalyzer';
import ActionPlanList from '@/components/optimizer/ActionPlanList';

export default function SEOOptimizerPage() {
    const [accountId, setAccountId] = useState('');
    const [activeTab, setActiveTab] = useState(0); // 0: Radar (Inventario), 1: Quirófano (Ejecución)

    // Inventario
    const [items, setItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Quirófano (Ejecución)
    const [executionQueue, setExecutionQueue] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    // Datos del ítem actual en análisis
    const [analysisData, setAnalysisData] = useState(null);
    const [performanceData, setPerformanceData] = useState(null);
    const [error, setError] = useState(null);

    // ─── Inicialización ──────────────────────────────────────────────
    useEffect(() => {
        const match = document.cookie.match(/meli_erp_account=([^;]+)/);
        if (match) {
            setAccountId(match[1]);
        } else {
            fetch('/api/auth/accounts')
                .then(res => res.json())
                .then(data => {
                    if (data.accounts && data.accounts.length > 0) setAccountId(data.accounts[0].id);
                });
        }
    }, []);

    // ─── Cargar Inventario ──────────────────────────────────────────
    const fetchItems = useCallback(async () => {
        if (!accountId) return;
        setLoadingItems(true);
        try {
            const res = await fetch(`/api/account/publications?accountId=${accountId}&status=active&search=${search}`);
            const data = await res.json();
            if (data.products) {
                setItems(data.products.map(p => ({
                    id: p.meli_item_id || p.id,
                    title: p.title,
                    price: p.price,
                    thumbnail: p.thumbnail,
                    sku: p.sku
                })));
            }
        } catch (err) {
            console.error('Error cargando inventario:', err);
        } finally {
            setLoadingItems(false);
        }
    }, [accountId, search]);

    useEffect(() => {
        if (accountId && activeTab === 0) fetchItems();
    }, [accountId, activeTab]);

    // ─── Selección de Ítems ─────────────────────────────────────────
    const toggleAll = (e) => {
        if (e.target.checked) setSelectedIds(new Set(items.map(i => i.id)));
        else setSelectedIds(new Set());
    };

    const toggleOne = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    // ─── Iniciar Ejecución ──────────────────────────────────────────
    const handleStartExecution = () => {
        if (selectedIds.size === 0) return;
        const queue = Array.from(selectedIds);
        setExecutionQueue(queue);
        setCurrentIndex(0);
        setActiveTab(1); // Mover al Quirófano
    };

    // ─── Auto-Analizar Ítem Actual ──────────────────────────────────
    useEffect(() => {
        if (activeTab === 1 && executionQueue.length > 0) {
            runAnalysis(executionQueue[currentIndex]);
        }
    }, [activeTab, currentIndex, executionQueue]);

    const runAnalysis = async (ourItemId) => {
        setIsAnalyzing(true);
        setError(null);
        setAnalysisData(null);
        setPerformanceData(null);

        try {
            // 1. Obtener Performance (Quality Score)
            const perfRes = await fetch(`/api/tools/optimizer/performance?accountId=${accountId}&itemIds=${ourItemId}`);
            const perfData = await perfRes.json();
            if (perfData.success && perfData.results.length > 0) {
                setPerformanceData(perfData.results[0]);
            }

            // 2. Ejecutar Sniper V3 para auto-encontrar al competidor líder
            const sniperRes = await fetch('/api/tools/sniper/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId, ourItemId })
            });
            const sniperData = await sniperRes.json();
            
            if (!sniperData.success || !sniperData.competitors || sniperData.competitors.length === 0) {
                throw new Error("No se pudo encontrar un competidor válido para comparar.");
            }

            // Seleccionamos al competidor más fuerte (el líder, index 0 porque vienen ordenados por ventas/relevancia)
            const compItemId = sniperData.competitors[0].id;

            // 3. Comparar nuestra publicación vs la del Líder
            const compRes = await fetch('/api/tools/optimizer/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId, ourItemId, competitorItemId: compItemId })
            });
            const compData = await compRes.json();
            
            if (!compData.success) throw new Error(compData.error || "Error al comparar");
            
            setAnalysisData(compData);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleUpdateTitle = async (newTitle) => {
        const ourItemId = executionQueue[currentIndex];
        const res = await fetch('/api/tools/optimizer/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId, itemId: ourItemId, updates: { title: newTitle } })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Error al actualizar título");
        
        setAnalysisData(prev => ({
            ...prev,
            ourItem: { ...prev.ourItem, title: newTitle },
            analysis: { ...prev.analysis, titleAnalysis: { ...prev.analysis.titleAnalysis, ourTitle: newTitle } }
        }));
    };

    const goToNext = () => {
        if (currentIndex < executionQueue.length - 1) setCurrentIndex(prev => prev + 1);
    };

    const goToPrev = () => {
        if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
    };

    // ─── RENDERIZADO PRINCIPAL ──────────────────────────────────────
    return (
        <div style={styles.page}>
            <header style={styles.header}>
                <div>
                    <h1 style={styles.title}><Target color="#38bdf8" size={28} /> SEO Optimizer</h1>
                    <p style={styles.subtitle}>Selecciona productos, auto-detecta al líder de ventas y aplica mejoras orgánicas (Glassmorphism UX).</p>
                </div>
            </header>

            {/* TABS */}
            <div style={styles.tabsContainer}>
                <button 
                    style={activeTab === 0 ? styles.tabActive : styles.tab} 
                    onClick={() => setActiveTab(0)}
                >
                    1. Radar SEO (Selección)
                </button>
                <button 
                    style={activeTab === 1 ? styles.tabActive : styles.tab} 
                    onClick={() => { if (executionQueue.length > 0) setActiveTab(1); }}
                    disabled={executionQueue.length === 0}
                >
                    2. Quirófano (Ejecución) {executionQueue.length > 0 && `(${currentIndex + 1}/${executionQueue.length})`}
                </button>
            </div>

            {/* TAB 1: RADAR (Inventario) */}
            {activeTab === 0 && (
                <div style={styles.panel}>
                    <div style={styles.toolbar}>
                        <div style={styles.searchBox}>
                            <Search size={18} color="#94a3b8" />
                            <input 
                                style={styles.input} 
                                placeholder="Buscar publicación o SKU..." 
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && fetchItems()}
                            />
                        </div>
                        <button 
                            style={selectedIds.size > 0 ? styles.btnPrimary : styles.btnDisabled}
                            onClick={handleStartExecution}
                            disabled={selectedIds.size === 0}
                        >
                            <Play size={16} /> Ejecutar Optimización ({selectedIds.size})
                        </button>
                    </div>

                    <div style={styles.tableWrapper}>
                        <table style={styles.table}>
                            <thead style={styles.thead}>
                                <tr>
                                    <th style={styles.thCheck}>
                                        <input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleAll} style={styles.checkbox} />
                                    </th>
                                    <th style={styles.th}>Publicación</th>
                                    <th style={styles.th}>SKU</th>
                                    <th style={styles.th}>Precio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingItems ? (
                                    <tr><td colSpan="4" style={styles.tdEmpty}><Loader2 className="animate-spin" /> Cargando inventario...</td></tr>
                                ) : items.length === 0 ? (
                                    <tr><td colSpan="4" style={styles.tdEmpty}>No hay publicaciones que coincidan.</td></tr>
                                ) : (
                                    items.map(item => (
                                        <tr key={item.id} style={{...styles.tr, backgroundColor: selectedIds.has(item.id) ? 'rgba(56, 189, 248, 0.05)' : 'transparent'}}>
                                            <td style={styles.tdCheck}>
                                                <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleOne(item.id)} style={styles.checkbox} />
                                            </td>
                                            <td style={styles.td}>
                                                <div style={styles.itemCell}>
                                                    <img src={item.thumbnail} alt="" style={styles.thumbnail} />
                                                    <div>
                                                        <a href={`https://articulo.mercadolibre.com.ve/${item.id.replace('MLV', 'MLV-')}`} target="_blank" rel="noreferrer" style={styles.itemLink}>
                                                            {item.id} <ExternalLink size={12} />
                                                        </a>
                                                        <div style={styles.itemTitle}>{item.title}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={styles.td}>{item.sku || '-'}</td>
                                            <td style={styles.td}>${item.price?.toFixed(2)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 2: QUIRÓFANO (Ejecución) */}
            {activeTab === 1 && (
                <div>
                    {/* Navigation Bar */}
                    <div style={styles.navBar}>
                        <button onClick={goToPrev} disabled={currentIndex === 0} style={currentIndex === 0 ? styles.navBtnDisabled : styles.navBtn}>
                            <ArrowLeft size={16} /> Anterior
                        </button>
                        <div style={styles.navProgress}>
                            Optimizando ítem {currentIndex + 1} de {executionQueue.length}
                        </div>
                        <button onClick={goToNext} disabled={currentIndex === executionQueue.length - 1} style={currentIndex === executionQueue.length - 1 ? styles.navBtnDisabled : styles.navBtn}>
                            Siguiente <ArrowRight size={16} />
                        </button>
                    </div>

                    <div style={styles.panel}>
                        {isAnalyzing ? (
                            <div style={styles.loadingBox}>
                                <Loader2 size={32} className="animate-spin" color="#38bdf8" style={{marginBottom: '16px'}} />
                                <h3>Analizando el Mercado</h3>
                                <p>Buscando al competidor líder, evaluando SEO, fotos y atributos de {executionQueue[currentIndex]}...</p>
                            </div>
                        ) : error ? (
                            <div style={styles.errorBox}>
                                <h3>Error de Análisis</h3>
                                <p>{error}</p>
                                <button onClick={() => runAnalysis(executionQueue[currentIndex])} style={styles.btnPrimary}>Reintentar</button>
                            </div>
                        ) : analysisData && (
                            <div style={styles.analysisGrid}>
                                {/* Columna Izquierda: Plan de Acción y Herramientas */}
                                <div style={styles.colLeft}>
                                    <div style={styles.infoCard}>
                                        <div style={styles.itemCell}>
                                            <img src={analysisData.ourItem.thumbnail} alt="" style={styles.thumbnailLg} />
                                            <div>
                                                <div style={styles.itemLink}>{analysisData.ourItem.id}</div>
                                                <h2 style={{margin: '0 0 8px 0', fontSize: '1.2rem', color: '#f8fafc'}}>{analysisData.ourItem.title}</h2>
                                                <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
                                                    <span style={{fontSize: '1.2rem', fontWeight: 'bold', color: '#38bdf8'}}>${analysisData.ourItem.price}</span>
                                                    {performanceData && <QualityScoreBadge score={performanceData.score} level={performanceData.level} />}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Plan */}
                                    <h3 style={styles.sectionTitle}>Plan de Optimización (Sugerencias)</h3>
                                    <ActionPlanList 
                                        analysis={analysisData} 
                                        performance={performanceData} 
                                        onActionClick={(id) => console.log('Action:', id)} 
                                    />
                                    
                                    {/* Title Analyzer */}
                                    {analysisData.analysis.titleAnalysis.missingKeywords.length > 0 && (
                                        <div style={{marginTop: '24px'}}>
                                            <TitleAnalyzer 
                                                initialTitle={analysisData.analysis.titleAnalysis.ourTitle}
                                                missingKeywords={analysisData.analysis.titleAnalysis.missingKeywords}
                                                onSaveTitle={handleUpdateTitle}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Columna Derecha: El Líder y las Brechas */}
                                <div style={styles.colRight}>
                                    <div style={styles.infoCardCompetitor}>
                                        <span style={styles.badgeLeader}>🏆 Competidor Líder</span>
                                        <div style={{...styles.itemCell, marginTop: '12px'}}>
                                            <img src={analysisData.compItem.thumbnail} alt="" style={styles.thumbnailLg} />
                                            <div>
                                                <a href={analysisData.compItem.permalink} target="_blank" rel="noreferrer" style={styles.itemLink}>
                                                    {analysisData.compItem.id} <ExternalLink size={12} />
                                                </a>
                                                <h2 style={{margin: '0 0 8px 0', fontSize: '1rem', color: '#f8fafc'}}>{analysisData.compItem.title}</h2>
                                                <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
                                                    <span style={{fontSize: '1.1rem', fontWeight: 'bold', color: '#f8fafc'}}>${analysisData.compItem.price}</span>
                                                    <span style={{color: '#94a3b8', fontSize: '0.85rem'}}>Ventas: {analysisData.compItem.sold_quantity}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <h3 style={styles.sectionTitle}>Brecha de Ficha Técnica (Atributos)</h3>
                                    <AttributeGapTable 
                                        ourAttributes={analysisData.ourItem.attributes}
                                        compAttributes={analysisData.analysis.attrGap}
                                        onCompleteAttribute={(attr) => alert(`Modificar atributo ${attr.id} en desarrollo...`)}
                                    />

                                    <h3 style={{...styles.sectionTitle, marginTop: '24px'}}>Brecha de Galería (Fotos)</h3>
                                    <PhotoComparisonGrid 
                                        ourPhotos={analysisData.analysis.photoGap.ourPhotos}
                                        compPhotos={analysisData.analysis.photoGap.compPhotos}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── ESTILOS GLASSMORPHISM (Dark Theme) ──────────────────────────
const styles = {
    page: { padding: '32px', minHeight: '100vh', fontFamily: "'Inter', sans-serif", color: '#e2e8f0' },
    header: { marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    title: { display: 'flex', alignItems: 'center', gap: '12px', fontSize: '2rem', fontWeight: 800, margin: '0 0 8px 0', color: '#f8fafc' },
    subtitle: { fontSize: '0.95rem', color: '#94a3b8', margin: 0 },
    
    tabsContainer: { display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' },
    tab: { background: 'transparent', border: 'none', color: '#94a3b8', padding: '10px 20px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', borderRadius: '8px', transition: 'all 0.2s' },
    tabActive: { background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', padding: '10px 20px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', borderRadius: '8px', boxShadow: '0 0 15px rgba(56, 189, 248, 0.1)' },
    
    panel: { background: 'rgba(255, 255, 255, 0.02)', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(20px)' },
    
    // Toolbar (Search & Actions)
    toolbar: { display: 'flex', justifyContent: 'space-between', marginBottom: '24px' },
    searchBox: { display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '10px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', flex: 1, maxWidth: '400px' },
    input: { background: 'transparent', border: 'none', color: '#fff', outline: 'none', flex: 1, fontSize: '0.9rem' },
    btnPrimary: { background: 'linear-gradient(135deg, #0284c7, #38bdf8)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'transform 0.2s', boxShadow: '0 4px 12px rgba(56,189,248,0.2)' },
    btnDisabled: { background: 'rgba(255,255,255,0.1)', color: '#64748b', border: 'none', padding: '10px 24px', borderRadius: '12px', fontWeight: 700, cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: '8px' },
    
    // Table (Inventory)
    tableWrapper: { overflowX: 'auto', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' },
    table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' },
    thead: { backgroundColor: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.1)' },
    th: { padding: '14px 16px', color: '#cbd5e1', fontWeight: 600 },
    thCheck: { padding: '14px 16px', width: '40px' },
    tr: { borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background-color 0.2s' },
    td: { padding: '14px 16px', color: '#f8fafc' },
    tdCheck: { padding: '14px 16px' },
    tdEmpty: { padding: '32px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' },
    checkbox: { accentColor: '#38bdf8', width: '16px', height: '16px', cursor: 'pointer' },
    
    // Item Cell
    itemCell: { display: 'flex', alignItems: 'center', gap: '12px' },
    thumbnail: { width: '48px', height: '48px', borderRadius: '6px', objectFit: 'contain', backgroundColor: '#fff' },
    thumbnailLg: { width: '80px', height: '80px', borderRadius: '8px', objectFit: 'contain', backgroundColor: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
    itemLink: { color: '#38bdf8', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' },
    itemTitle: { fontSize: '0.9rem', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '400px' },
    
    // Navigation (Quirófano)
    navBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '12px 24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' },
    navProgress: { fontWeight: 600, color: '#38bdf8' },
    navBtn: { background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'background-color 0.2s' },
    navBtnDisabled: { background: 'transparent', color: '#475569', border: '1px solid rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'not-allowed' },
    
    // Execution States
    loadingBox: { textAlign: 'center', padding: '64px 24px', color: '#94a3b8' },
    errorBox: { textAlign: 'center', padding: '64px 24px', color: '#f87171', backgroundColor: 'rgba(239,68,68,0.05)', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.1)' },
    
    // Analysis Grid
    analysisGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' },
    colLeft: { display: 'flex', flexDirection: 'column', gap: '16px' },
    colRight: { display: 'flex', flexDirection: 'column', gap: '16px' },
    
    infoCard: { backgroundColor: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' },
    infoCardCompetitor: { backgroundColor: 'rgba(56, 189, 248, 0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)', position: 'relative' },
    badgeLeader: { position: 'absolute', top: '-10px', right: '16px', backgroundColor: '#eab308', color: '#000', padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, boxShadow: '0 4px 10px rgba(234, 179, 8, 0.3)' },
    
    sectionTitle: { margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 700, color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }
};
