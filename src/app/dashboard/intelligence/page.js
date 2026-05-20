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

    const handleAnalyze = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setError(null);
        setResult(null);
        setCompareResult(null);

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

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Crosshair className="w-6 h-6 text-cyan-400" />
                    Inteligencia de Mercado
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                    Analiza a tus competidores en MLV y descubre por qué te están ganando.
                </p>
            </div>

            {/* Search Panel - Premium Overhaul */}
            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 mb-8 shadow-2xl shadow-cyan-500/5">
                <div className="flex flex-col lg:flex-row items-end gap-4">
                    <div className="flex-1 w-full">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-full bg-cyan-500/10 flex items-center justify-center">
                                <Search className="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Término de búsqueda</label>
                        </div>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Ej: amortiguador delantero corolla 2015"
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all duration-300"
                            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                        />
                    </div>
                    
                    <div className="w-full lg:w-48">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center">
                                <Search className="w-3.5 h-3.5 text-amber-400" />
                            </div>
                            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">SKU Interno</label>
                        </div>
                        <input
                            type="text"
                            value={sku}
                            onChange={(e) => setSku(e.target.value)}
                            placeholder="11-001..."
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all duration-300"
                            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                        />
                    </div>

                    <div className="w-full lg:w-48">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center">
                                <Search className="w-3.5 h-3.5 text-purple-400" />
                            </div>
                            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">ML Item ID</label>
                        </div>
                        <input
                            type="text"
                            value={ourItemId}
                            onChange={(e) => setOurItemId(e.target.value)}
                            placeholder="MLV..."
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-300"
                            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                        />
                    </div>

                    <button
                        onClick={handleAnalyze}
                        disabled={loading || !query.trim()}
                        className="h-[46px] px-8 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl text-sm transition-all duration-300 shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2 group"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <Crosshair className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                ANALIZAR
                            </>
                        )}
                    </button>
                </div>

                {error && (
                    <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2 animate-pulse">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        {error}
                    </div>
                )}
            </div>

            {/* Results */}
            {result && (
                <div className="space-y-6">
                    {/* Stats Bar */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard label="Resultados totales" value={result.totalResults} icon={Database} colorClass="border-blue-500/30" />
                        <StatCard label="Precio promedio" value={`$${result.stats?.avg_price?.toFixed(2) || "—"}`} icon={CircleDollarSign} colorClass="border-emerald-500/30" />
                        <StatCard label="Mayor ventas" value={result.stats?.max_sales || 0} icon={Flame} colorClass="border-orange-500/30" />
                        <StatCard label="Rango precios" value={`$${result.stats?.min_price?.toFixed(0) || "—"} - $${result.stats?.max_price?.toFixed(0) || "—"}`} icon={LineChart} colorClass="border-purple-500/30" />
                    </div>

                    {/* Analysis Mode */}
                    <div className="flex items-center gap-3">
                        <AnalysisModeBadge mode={result.analysis_mode} />
                        {result.ourItem && (
                            <button
                                onClick={handleCompare}
                                disabled={loadingCompare}
                                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                            >
                                {loadingCompare ? <Loader2 className="w-3 h-3 animate-spin" /> : <BarChart3 className="w-3 h-3" />}
                                Comparar con mi publicación
                            </button>
                        )}
                    </div>

                    {/* SEO Expansion Suggestion */}
                    {(getExpansionSuggestion(result.ourItem) || getExpansionSuggestion(result.leader)) && (
                        <div className="bg-gradient-to-r from-blue-900/40 to-cyan-900/40 border border-cyan-500/30 rounded-2xl p-5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Sparkles className="w-24 h-24 text-cyan-400" />
                            </div>
                            <div className="flex items-start gap-4 relative z-10">
                                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0 border border-cyan-500/30">
                                    <Sparkles className="w-6 h-6 text-cyan-400 animate-pulse" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">💡 Sugerencia de Expansión SEO</h3>
                                    <p className="text-xs text-slate-300 mb-3">Hemos detectado una oportunidad para optimizar tu título y aprovechar los 60 caracteres permitidos.</p>
                                    
                                    <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800">
                                        <div className="text-xs text-slate-500 mb-2 uppercase font-bold">Título Sugerido:</div>
                                        <div className="text-cyan-400 font-medium text-sm leading-relaxed">
                                            {getExpansionSuggestion(result.ourItem) || getExpansionSuggestion(result.leader)}
                                        </div>
                                        <div className="mt-2 flex items-center gap-2">
                                            <div className="h-1.5 flex-1 bg-slate-800 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-cyan-500" 
                                                    style={{ width: `${((getExpansionSuggestion(result.ourItem) || getExpansionSuggestion(result.leader)).length / 60) * 100}%` }} 
                                                />
                                            </div>
                                            <span className="text-[10px] font-mono text-slate-500">
                                                {(getExpansionSuggestion(result.ourItem) || getExpansionSuggestion(result.leader)).length}/60
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Leader + WinnerCard */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <WinnerCard ourItem={result.ourItem} leader={result.leader} />
                        <LogisticsCard data={result.leader?.logistics_data} />
                    </div>

                    {/* Compare Results */}
                    {compareResult && (
                        <>
                            <div className="bg-slate-900 rounded-xl border border-slate-700 p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-white">⚔️ Score Competitivo</h3>
                                    <div className="text-3xl font-black text-cyan-400">{compareResult.score_total}<span className="text-sm text-slate-400 font-normal">/100</span></div>
                                </div>

                                {/* Spam Alert */}
                                <SpamAlert words={compareResult.gaps?.spam_words} />

                                {/* Score Charts */}
                                <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-4">
                                    {Object.entries(scoreBreakdown).map(([key, val]) => (
                                        <ScoreChart key={key} score={val} label={key.replace(/_/g, " ").toUpperCase()} />
                                    ))}
                                </div>
                            </div>

                            {/* Action Plan */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-300 mb-3">📝 Plan de Acción</h3>
                                <ActionPlan actions={compareResult.action_plan} />
                            </div>
                        </>
                    )}

                    {/* Competitor Grid */}
                    <div>
                        <CompetitorGrid
                            competitors={result.competitors}
                            leaderId={result.leader?.ml_item_id}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, icon: Icon, colorClass }) {
    return (
        <div className={`bg-slate-900/60 backdrop-blur-xl border ${colorClass} rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-cyan-500/5`}>
            <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClass.replace('border-', 'bg-').replace('/30', '/10')}`}>
                    <Icon className={`w-4 h-4 ${colorClass.replace('border-', 'text-').replace('/30', '')}`} />
                </div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</div>
            </div>
            <div className="text-2xl font-black text-white">{value}</div>
        </div>
    );
}
