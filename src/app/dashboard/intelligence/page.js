'use client';

import { useState, useEffect } from "react";
import { Search, Crosshair, Loader2, BarChart3, Sparkles, Database, CircleDollarSign, Flame, LineChart } from "lucide-react";
import { suggestTitleExpansion } from "@/lib/sniper-helpers";

// Components
import ScoreChart from "@/components/intelligence/ScoreChart";
import AnalysisModeBadge from "@/components/intelligence/AnalysisModeBadge";
import SpamAlert from "@/components/intelligence/SpamAlert";
import LogisticsCard from "@/components/intelligence/LogisticsCard";
import WinnerCard from "@/components/intelligence/WinnerCard";
import ActionPlan from "@/components/intelligence/ActionPlan";
import CompetitorGrid from "@/components/intelligence/CompetitorGrid";

export default function IntelligencePage() {
    const [query, setQuery] = useState("");
    const [sku, setSku] = useState("");
    const [ourItemId, setOurItemId] = useState("");
    const [accountId, setAccountId] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingCompare, setLoadingCompare] = useState(false);
    const [error, setError] = useState(null);
    const [selectedZones, setSelectedZones] = useState([]);
    const [displayLimit, setDisplayLimit] = useState(10);

    const [result, setResult] = useState(null);
    const [compareResult, setCompareResult] = useState(null);

    // Cargar cuenta activa del cookie
    useEffect(() => {
        const match = document.cookie.match(/meli_erp_account=([^;]+)/);
        if (match) setAccountId(match[1]);
    }, []);

    // Sugerencia de expansión para nuestro ítem o el líder
    const getExpansionSuggestion = (item) => {
        if (!item) return null;
        const expanded = suggestTitleExpansion(item.title, {
            brand: item.attributes?.find(a => a.id === 'BRAND')?.value_name,
            oem: item.attributes?.find(a => a.id === 'PART_NUMBER')?.value_name,
            isOriginal: item.title.toLowerCase().includes('original')
        });
        return expanded !== item.title ? expanded : null;
    };

    const canAnalyze = query.trim() || sku.trim() || ourItemId.trim();

    const handleAnalyze = async () => {
        if (!canAnalyze) return;
        setLoading(true);
        setError(null);
        setResult(null);
        setCompareResult(null);
        setSelectedZones([]);
        setDisplayLimit(10);

        try {
            // PASO 1: Intentar búsqueda directa desde el navegador
            let mlSearchData = { results: [] };
            try {
                const mlSearchRes = await fetch(
                    `https://api.mercadolibre.com/sites/MLV/search?q=${encodeURIComponent(query.trim())}&limit=20`,
                    { headers: { Accept: "application/json" } }
                );
                if (mlSearchRes.ok) {
                    mlSearchData = await mlSearchRes.json();
                } else {
                    console.warn(`Browser search failed (${mlSearchRes.status}), falling back to server...`);
                }
            } catch (err) {
                console.warn("Browser search blocked by CORS/WAF, falling back to server...");
            }

            // PASO 2: Enviar resultados (si hay) o solo la query a nuestra API
            // Si mlSearchData.results está vacío, la API hará la búsqueda por nosotros usando el token
            const res = await fetch("/api/tools/sniper/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: query.trim(),
                    sku: sku.trim() || undefined,
                    ourItemId: ourItemId.trim() || undefined,
                    accountId: accountId || undefined,
                    rawSearchResults: mlSearchData.results.length > 0 ? mlSearchData.results : undefined,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error en análisis");
            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCompare = async () => {
        if (!ourItemId.trim() || !result?.batch_id) {
            setError("Necesitas ingresar tu ML Item ID y ejecutar el análisis primero.");
            return;
        }
        setLoadingCompare(true);
        setError(null);

        try {
            const res = await fetch("/api/tools/sniper/compare", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ourItemId: ourItemId.trim(),
                    batchId: result.batch_id,
                    mode: "auto",
                    accountId: accountId || undefined,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error en comparación");
            setCompareResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingCompare(false);
        }
    };

    const scoreBreakdown = compareResult?.score_breakdown || {};
    
    // Zone Filtering Logic
    const availableZones = result ? [...new Set(result.competitors.map(c => c.logistics_data?.seller_state).filter(Boolean))] : [];
    
    const filteredByZone = result ? result.competitors.filter(c => 
        selectedZones.length === 0 || selectedZones.includes(c.logistics_data?.seller_state)
    ) : [];

    const displayedCompetitors = filteredByZone.slice(0, displayLimit);

    const displayStats = {
        avg_price: displayedCompetitors.length > 0 ? parseFloat((displayedCompetitors.reduce((acc, c) => acc + (c.price_usd || 0), 0) / displayedCompetitors.length).toFixed(2)) : 0,
        max_sales: displayedCompetitors.length > 0 ? Math.max(...displayedCompetitors.map(c => c.sold_quantity || 0)) : 0,
        min_price: displayedCompetitors.length > 0 ? Math.min(...displayedCompetitors.map(c => c.price_usd || Infinity)) : 0,
        max_price: displayedCompetitors.length > 0 ? Math.max(...displayedCompetitors.map(c => c.price_usd || 0)) : 0,
    };

    const toggleZone = (zone) => {
        setSelectedZones(prev => 
            prev.includes(zone) 
                ? prev.filter(z => z !== zone)
                : [...prev, zone]
        );
    };

    const handleDeleteCompetitor = (idToRemove) => {
        setResult(prev => {
            if (!prev) return prev;
            const newCompetitors = prev.competitors.filter(c => c.ml_item_id !== idToRemove);
            
            return {
                ...prev,
                competitors: newCompetitors,
            };
        });
    };

    return (
        <div className="dashboard-wrapper">
            {/* Header */}
            <div className="dashboard-title-container">
                <h1 className="dashboard-title">
                    <Crosshair className="w-7 h-7 text-cyan-400" />
                    Inteligencia de Mercado
                </h1>
                <p className="dashboard-subtitle">
                    Analiza a tus competidores en MLV y descubre por qué te están ganando.
                </p>
            </div>

            {/* Search Panel - Premium Vanilla CSS */}
            <div className="search-panel">
                <div className="search-panel-row">
                    <div className="search-input-group">
                        <div className="search-input-label-row">
                            <div className="search-input-icon-bg icon-cyan">
                                <Search className="w-3.5 h-3.5" />
                            </div>
                            <label className="search-input-label">Término de búsqueda</label>
                        </div>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Ej: amortiguador delantero corolla 2015"
                            className="input-glass"
                            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                        />
                    </div>
                    
                    <div style={{ width: '100%', maxWidth: '240px' }} className="search-input-group">
                        <div className="search-input-label-row">
                            <div className="search-input-icon-bg icon-amber">
                                <Search className="w-3.5 h-3.5" />
                            </div>
                            <label className="search-input-label">SKU Interno</label>
                        </div>
                        <input
                            type="text"
                            value={sku}
                            onChange={(e) => setSku(e.target.value)}
                            placeholder="11-001..."
                            className="input-glass"
                            style={{ borderColor: 'rgba(245, 158, 11, 0.2)' }}
                            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                        />
                    </div>

                    <div style={{ width: '100%', maxWidth: '240px' }} className="search-input-group">
                        <div className="search-input-label-row">
                            <div className="search-input-icon-bg icon-purple">
                                <Search className="w-3.5 h-3.5" />
                            </div>
                            <label className="search-input-label">ML Item ID</label>
                        </div>
                        <input
                            type="text"
                            value={ourItemId}
                            onChange={(e) => setOurItemId(e.target.value)}
                            placeholder="MLV..."
                            className="input-glass"
                            style={{ borderColor: 'rgba(168, 85, 247, 0.2)' }}
                            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                        />
                    </div>

                    <button
                        onClick={handleAnalyze}
                        disabled={loading || !canAnalyze}
                        className="btn-glow"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <Crosshair className="w-5 h-5" />
                                ANALIZAR
                            </>
                        )}
                    </button>
                </div>

                {error && (
                    <div className="error-banner">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span>Error: {error}</span>
                    </div>
                )}
            </div>

            {/* Results */}
            {result && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Stats Bar */}
                    <div className="stat-cards-grid">
                        <StatCard 
                            label="Resultados filtrados" 
                            value={displayedCompetitors.length} 
                            icon={Database} 
                            iconColor="#3b82f6"
                            bgColor="rgba(59, 130, 246, 0.05)"
                            borderColor="rgba(59, 130, 246, 0.2)"
                        />
                        <StatCard 
                            label="Precio promedio" 
                            value={`$${displayStats.avg_price?.toFixed(2) || "—"}`} 
                            icon={CircleDollarSign} 
                            iconColor="#10b981"
                            bgColor="rgba(16, 185, 129, 0.05)"
                            borderColor="rgba(16, 185, 129, 0.2)"
                        />
                        <StatCard 
                            label="Mayor ventas" 
                            value={displayStats.max_sales || 0} 
                            icon={Flame} 
                            iconColor="#f59e0b"
                            bgColor="rgba(245, 158, 11, 0.05)"
                            borderColor="rgba(245, 158, 11, 0.2)"
                        />
                        <StatCard 
                            label="Rango precios" 
                            value={`$${displayStats.min_price?.toFixed(0) || "—"} - $${displayStats.max_price?.toFixed(0) || "—"}`} 
                            icon={LineChart} 
                            iconColor="#8b5cf6"
                            bgColor="rgba(139, 92, 246, 0.05)"
                            borderColor="rgba(139, 92, 246, 0.2)"
                        />
                    </div>

                    {/* Analysis Mode & Compare Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <AnalysisModeBadge mode={result.analysis_mode} />
                        {result.ourItem && (
                            <button
                                onClick={handleCompare}
                                disabled={loadingCompare}
                                className="btn-compare-green"
                            >
                                {loadingCompare ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
                                COMPARAR CON MI PUBLICACIÓN
                            </button>
                        )}
                    </div>

                    {/* SEO Expansion Suggestion */}
                    {(getExpansionSuggestion(result.ourItem) || getExpansionSuggestion(result.leader)) && (
                        <div className="seo-card">
                            <div className="seo-card-sparkle">
                                <Sparkles className="w-24 h-24 text-cyan-400" />
                            </div>
                            <div className="seo-card-content">
                                <div className="seo-card-icon-bg">
                                    <Sparkles className="w-6 h-6 text-cyan-400 animate-pulse" />
                                </div>
                                <div className="seo-card-text">
                                    <h3 className="seo-card-title">💡 Sugerencia de Expansión SEO</h3>
                                    <p className="seo-card-desc">Hemos detectado una oportunidad para optimizar tu título y aprovechar los 60 caracteres permitidos en MercadoLibre.</p>
                                    
                                    <div className="seo-suggested-box">
                                        <div className="seo-suggested-label">Título Sugerido:</div>
                                        <div className="seo-suggested-title">
                                            {getExpansionSuggestion(result.ourItem) || getExpansionSuggestion(result.leader)}
                                        </div>
                                        <div className="seo-char-progress-row">
                                            <div className="seo-char-progress-track">
                                                <div 
                                                    className="seo-char-progress-bar" 
                                                    style={{ width: `${Math.min(((getExpansionSuggestion(result.ourItem) || getExpansionSuggestion(result.leader)).length / 60) * 100, 100)}%` }} 
                                                />
                                            </div>
                                            <span className="seo-char-count">
                                                {(getExpansionSuggestion(result.ourItem) || getExpansionSuggestion(result.leader)).length}/60
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Leader + WinnerCard in responsive grid */}
                    <div className="compare-row-grid">
                        <WinnerCard ourItem={result.ourItem} leader={result.leader} />
                        <LogisticsCard data={result.leader?.logistics_data} />
                    </div>

                    {/* Compare Results */}
                    {compareResult && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="score-board">
                                <div className="score-board-header">
                                    <h3 className="score-board-title">⚔️ Score Competitivo vs Líder</h3>
                                    <div className="score-board-value">
                                        {compareResult.score_total}<span>/100</span>
                                    </div>
                                </div>

                                {/* Spam Alert */}
                                <SpamAlert words={compareResult.gaps?.spam_words} />

                                {/* Score Charts */}
                                <div className="score-charts-grid">
                                    {Object.entries(scoreBreakdown).map(([key, val]) => (
                                        <ScoreChart key={key} score={val} label={key.replace(/_/g, " ").toUpperCase()} />
                                    ))}
                                </div>
                            </div>

                            {/* Action Plan */}
                            <div>
                                <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#cbd5e1', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    📝 Plan de Acción
                                </h3>
                                <ActionPlan actions={compareResult.action_plan} />
                            </div>
                        </div>
                    )}

                    {/* Competitor Grid with Zone Filter */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                            {/* Zones Pills */}
                            {availableZones.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>Zonas:</label>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {availableZones.map(zone => {
                                            const isSelected = selectedZones.includes(zone);
                                            return (
                                                <button
                                                    key={zone}
                                                    onClick={() => toggleZone(zone)}
                                                    style={{
                                                        padding: '4px 10px',
                                                        borderRadius: '999px',
                                                        fontSize: '11px',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        backgroundColor: isSelected ? '#3b82f6' : 'rgba(30, 41, 59, 0.8)',
                                                        color: isSelected ? '#ffffff' : '#94a3b8',
                                                        border: `1px solid ${isSelected ? '#60a5fa' : '#334155'}`
                                                    }}
                                                >
                                                    {zone}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Display Limit Dropdown */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>Mostrar:</label>
                                <select 
                                    className="input-glass" 
                                    style={{ width: 'auto', padding: '4px 12px', height: '32px', fontSize: '12px' }}
                                    value={displayLimit}
                                    onChange={(e) => setDisplayLimit(Number(e.target.value))}
                                >
                                    <option value={10}>Top 10</option>
                                    <option value={15}>Top 15</option>
                                    <option value={20}>Top 20</option>
                                    <option value={25}>Top 25</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ animationDelay: '0.4s' }} className="animate-slide-up">
                            <CompetitorGrid 
                                competitors={displayedCompetitors} 
                                leaderId={result.stats?.price_leader_id} 
                                onDelete={handleDeleteCompetitor}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, icon: Icon, iconColor, bgColor, borderColor }) {
    return (
        <div className="stat-card-custom" style={{ border: `1px solid ${borderColor}` }}>
            <div className="stat-card-header">
                <div className="stat-card-icon-bg" style={{ backgroundColor: bgColor }}>
                    <Icon className="w-5 h-5" style={{ color: iconColor }} />
                </div>
                <div className="stat-card-label">{label}</div>
            </div>
            <div className="stat-card-value">{value}</div>
        </div>
    );
}

