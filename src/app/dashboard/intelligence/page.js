'use client';

import { useState, useEffect } from "react";
import { Search, Crosshair, Loader2, BarChart3 } from "lucide-react";

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

    const handleAnalyze = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setError(null);
        setResult(null);
        setCompareResult(null);

        try {
            const res = await fetch("/api/tools/sniper/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: query.trim(),
                    sku: sku.trim() || undefined,
                    ourItemId: ourItemId.trim() || undefined,
                    accountId: accountId || undefined,
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

            {/* Search Panel */}
            <div className="bg-slate-900 rounded-xl border border-slate-700 p-5 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-5">
                        <label className="block text-xs font-medium text-slate-400 mb-1">🔎 Término de búsqueda</label>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Ej: amortiguador delantero corolla 2015"
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                        />
                    </div>
                    <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-slate-400 mb-1">🏷️ SKU interno (opcional)</label>
                        <input
                            type="text"
                            value={sku}
                            onChange={(e) => setSku(e.target.value)}
                            placeholder="Ej: 11-001-ABC"
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                        />
                    </div>
                    <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-slate-400 mb-1">🆔 Tu ML Item ID (opcional)</label>
                        <input
                            type="text"
                            value={ourItemId}
                            onChange={(e) => setOurItemId(e.target.value)}
                            placeholder="Ej: MLV123456789"
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                        />
                    </div>
                    <div className="md:col-span-1 flex items-end">
                        <button
                            onClick={handleAnalyze}
                            disabled={loading || !query.trim()}
                            className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-2 px-3 rounded-lg text-sm transition-all flex items-center justify-center gap-1"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mt-3 bg-red-900/30 border border-red-700 text-red-300 text-sm px-3 py-2 rounded-lg">
                        {error}
                    </div>
                )}
            </div>

            {/* Results */}
            {result && (
                <div className="space-y-6">
                    {/* Stats Bar */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard label="Resultados totales" value={result.totalResults} icon="📊" />
                        <StatCard label="Precio promedio" value={`$${result.stats?.avg_price?.toFixed(2) || "—"}`} icon="💰" />
                        <StatCard label="Mayor ventas" value={result.stats?.max_sales || 0} icon="🔥" />
                        <StatCard label="Rango precios" value={`$${result.stats?.min_price?.toFixed(0) || "—"} - $${result.stats?.max_price?.toFixed(0) || "—"}`} icon="📈" />
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

function StatCard({ label, value, icon }) {
    return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
            <div className="text-xs text-slate-400">{icon} {label}</div>
            <div className="text-lg font-bold text-white mt-1">{value}</div>
        </div>
    );
}
