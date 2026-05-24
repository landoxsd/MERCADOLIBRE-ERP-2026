"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Search, Key, Loader2, AlertTriangle, BarChart2, Layers,
    TrendingUp, Award, DollarSign, Zap, Download
} from "lucide-react";
import KeywordHeatmapTable from "@/components/keywords/KeywordHeatmapTable";
import KeywordBubbleChart from "@/components/keywords/KeywordBubbleChart";

// Tab IDs
const TABS = {
    HEATMAP: "heatmap",
    BUBBLE: "bubble",
};

export default function KeywordsPage() {
    const router = useRouter();
    const [categoryId, setCategoryId] = useState("");
    const [seedKeyword, setSeedKeyword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [activeTab, setActiveTab] = useState(TABS.HEATMAP);

    const handleAnalyze = async (e) => {
        e.preventDefault();
        if (!categoryId.trim() && !seedKeyword.trim()) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const res = await fetch("/api/tools/keywords", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    category_id: categoryId.trim().toUpperCase() || undefined,
                    seed_keyword: seedKeyword.trim() || undefined,
                    max_keywords: 25,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al analizar keywords");
            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Redirect to Sniper with pre-filled keyword
    const handleKeywordSearch = useCallback((keyword) => {
        router.push(`/dashboard/intelligence?q=${encodeURIComponent(keyword)}`);
    }, [router]);

    const formatMoney = (n) => {
        if (!n && n !== 0) return "—";
        if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
        if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
        return `$${n.toFixed(0)}`;
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header + Search Form */}
            <div className="bg-slate-900/50 border border-slate-800 backdrop-blur-xl p-6 rounded-2xl space-y-5">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Key className="text-violet-400" size={28} />
                        Keywords Inverso
                    </h1>
                    <p className="text-slate-400 mt-1 text-sm">
                        Descubre qué buscan los compradores vs. qué se vende realmente. Detecta brechas de oportunidad antes que la competencia.
                    </p>
                </div>

                <form onSubmit={handleAnalyze} className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-slate-500" />
                        </div>
                        <input
                            type="text"
                            value={seedKeyword}
                            onChange={e => setSeedKeyword(e.target.value)}
                            placeholder='Keyword semilla (Ej: "amortiguador delantero")'
                            className="block w-full pl-10 pr-3 py-2.5 border border-slate-700 rounded-xl bg-slate-900 text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 text-sm"
                            disabled={loading}
                        />
                    </div>

                    <div className="md:w-48 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Layers className="h-4 w-4 text-slate-500" />
                        </div>
                        <input
                            type="text"
                            value={categoryId}
                            onChange={e => setCategoryId(e.target.value)}
                            placeholder="Categoría (MLV1500)"
                            className="block w-full pl-10 pr-3 py-2.5 border border-slate-700 rounded-xl bg-slate-900 text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 text-sm"
                            disabled={loading}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || (!categoryId.trim() && !seedKeyword.trim())}
                        className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-800 disabled:text-slate-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />}
                        Analizar Keywords
                    </button>
                </form>

                {/* Tips */}
                <div className="text-xs text-slate-500 flex flex-wrap gap-4">
                    <span>💡 Usa una <strong className="text-slate-400">keyword semilla</strong> para analizar variaciones de ese término.</span>
                    <span>💡 Usa un <strong className="text-slate-400">ID de categoría</strong> para extraer keywords de tu propio catálogo.</span>
                    <span>💡 Combina ambos para máxima cobertura.</span>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 bg-red-900/20 border border-red-800/50 rounded-xl text-red-300 flex items-center gap-3">
                    <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* Loading state */}
            {loading && (
                <div className="flex flex-col items-center justify-center py-32 space-y-4 bg-slate-900/10 border border-slate-800 rounded-2xl">
                    <Loader2 size={40} className="text-violet-500 animate-spin" />
                    <div className="text-center space-y-1">
                        <h3 className="text-sm font-bold text-white">Analizando Keywords del Mercado</h3>
                        <p className="text-xs text-slate-500 max-w-xs">
                            Extrayendo términos de tu catálogo y midiendo el pulso del mercado en tiempo real...
                        </p>
                    </div>
                </div>
            )}

            {/* Results */}
            {result && !loading && (
                <div className="space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex justify-between items-center">
                            <div>
                                <div className="text-xs text-slate-400 uppercase font-medium tracking-wider">Keywords Analizadas</div>
                                <div className="text-2xl font-bold text-white mt-1">{result.global_stats.valid_with_data}</div>
                                <div className="text-xs text-slate-500 mt-0.5">de {result.global_stats.total_keywords_analyzed} candidatas</div>
                            </div>
                            <div className="p-3 bg-violet-500/10 text-violet-400 rounded-xl"><Key size={22} /></div>
                        </div>

                        <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex justify-between items-center">
                            <div>
                                <div className="text-xs text-slate-400 uppercase font-medium tracking-wider">Keyword Top</div>
                                <div className="text-base font-bold text-white mt-1 truncate max-w-[140px]">{result.global_stats.top_keyword || "—"}</div>
                                <div className="text-xs text-emerald-400 mt-0.5">Mayor conversión</div>
                            </div>
                            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl"><Award size={22} /></div>
                        </div>

                        <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex justify-between items-center">
                            <div>
                                <div className="text-xs text-slate-400 uppercase font-medium tracking-wider">Rev. Total Muestra</div>
                                <div className="text-2xl font-bold text-white mt-1">{formatMoney(result.global_stats.total_market_revenue)}</div>
                                <div className="text-xs text-slate-500 mt-0.5">Ingresos estimados</div>
                            </div>
                            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl"><DollarSign size={22} /></div>
                        </div>

                        <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex justify-between items-center">
                            <div>
                                <div className="text-xs text-slate-400 uppercase font-medium tracking-wider">Oportunidades</div>
                                <div className="text-2xl font-bold text-white mt-1">{result.global_stats.opportunities}</div>
                                <div className="text-xs text-slate-500 mt-0.5">Nichos poco competidos</div>
                            </div>
                            <div className="p-3 bg-yellow-500/10 text-yellow-400 rounded-xl"><Zap size={22} /></div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="bg-slate-900/30 border border-slate-800 rounded-2xl overflow-hidden">
                        {/* Tab selector */}
                        <div className="flex border-b border-slate-800 bg-slate-900/30">
                            <button
                                onClick={() => setActiveTab(TABS.HEATMAP)}
                                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors border-b-2 ${
                                    activeTab === TABS.HEATMAP
                                        ? "border-violet-500 text-violet-400 bg-violet-500/5"
                                        : "border-transparent text-slate-500 hover:text-slate-300"
                                }`}
                            >
                                <BarChart2 size={15} />
                                Tabla Heatmap
                            </button>
                            <button
                                onClick={() => setActiveTab(TABS.BUBBLE)}
                                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors border-b-2 ${
                                    activeTab === TABS.BUBBLE
                                        ? "border-violet-500 text-violet-400 bg-violet-500/5"
                                        : "border-transparent text-slate-500 hover:text-slate-300"
                                }`}
                            >
                                <TrendingUp size={15} />
                                Mapa de Burbujas
                            </button>
                        </div>

                        {/* Tab content */}
                        <div className="p-5">
                            {activeTab === TABS.HEATMAP && (
                                <KeywordHeatmapTable
                                    keywords={result.keywords}
                                    onKeywordSearch={handleKeywordSearch}
                                />
                            )}
                            {activeTab === TABS.BUBBLE && (
                                <KeywordBubbleChart keywords={result.keywords} />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Empty initial state */}
            {!result && !loading && !error && (
                <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-slate-800 rounded-2xl text-center">
                    <Key className="h-12 w-12 text-slate-600 mb-3" />
                    <h3 className="text-lg font-semibold text-slate-300">Analiza el Lenguaje del Comprador</h3>
                    <p className="text-slate-500 mt-1 max-w-sm text-sm">
                        Ingresa una keyword semilla o un ID de categoría para descubrir qué términos reales mueven unidades en Mercado Libre Venezuela.
                    </p>
                </div>
            )}
        </div>
    );
}
