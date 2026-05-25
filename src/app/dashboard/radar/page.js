"use client";

import { useState, useEffect } from "react";
import { Search, Radar, TrendingUp, TrendingDown, Minus, ArrowRight, Loader2, Plus, Zap, AlertTriangle } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import Link from "next/link";

export default function RadarPage() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newCategoryId, setNewCategoryId] = useState("");
    const [error, setError] = useState(null);

    // Initial load: We would typically load tracked categories from DB, 
    // but for now let's allow dynamic addition and state storage.
    
    const handleScanCategory = async (e) => {
        e.preventDefault();
        if (!newCategoryId) return;

        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/tools/radar/category", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category_id: newCategoryId.trim().toUpperCase() })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al escanear categoría");

            // Update categories list (prevent duplicates)
            setCategories(prev => {
                const filtered = prev.filter(c => c.snapshot.category_id !== data.snapshot.category_id);
                return [data, ...filtered];
            });
            setNewCategoryId("");

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatMoney = (n) => {
        if (!n && n !== 0) return "—";
        if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
        if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
        return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    };

    const formatNumber = (n) => {
        if (!n && n !== 0) return "0";
        if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
        return n.toLocaleString();
    };

    const getTrendIcon = (label) => {
        switch (label) {
            case 'hot': return <Zap className="text-yellow-400" size={20} />;
            case 'growing': return <TrendingUp className="text-emerald-400" size={20} />;
            case 'declining': return <TrendingDown className="text-red-400" size={20} />;
            default: return <Minus className="text-slate-400" size={20} />;
        }
    };

    const getTrendColor = (label) => {
        switch (label) {
            case 'hot': return "from-yellow-500/20 to-yellow-900/10 border-yellow-500/30 text-yellow-400";
            case 'growing': return "from-emerald-500/20 to-emerald-900/10 border-emerald-500/30 text-emerald-400";
            case 'declining': return "from-red-500/20 to-red-900/10 border-red-500/30 text-red-400";
            default: return "from-slate-700/50 to-slate-800/50 border-slate-700 text-slate-300";
        }
    };

    return (
        <div className="dashboard-wrapper">
            {/* Cabecera Premium */}
            <div className="dashboard-title-container">
                <h1 className="dashboard-title">
                    <span><Radar className="inline-block text-indigo-400 mb-1" size={32} /></span> Radar de Nichos
                </h1>
                <p className="dashboard-subtitle">
                    Escanea categorías completas o palabras clave para detectar tendencias y volumen de mercado.
                </p>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="error-banner mb-6">
                    <AlertTriangle size={16} className="text-red-400" />
                    <span>{error}</span>
                </div>
            )}

            {/* Panel de Búsqueda Inteligente */}
            <div className="search-panel">
                <form onSubmit={handleScanCategory} className="search-panel-row">
                    <div className="search-input-group">
                        <div className="search-input-label-row">
                            <div className="search-input-icon-bg icon-indigo">
                                <Search size={12} />
                            </div>
                            <span className="search-input-label">Explorador de Categorías</span>
                        </div>
                        <input
                            type="text"
                            value={newCategoryId}
                            onChange={(e) => setNewCategoryId(e.target.value)}
                            placeholder="Escribe un rubro (Ej: Mesetas) o ID (Ej: MLV1500)"
                            className="input-glass"
                            disabled={loading}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !newCategoryId}
                        className="btn-glow bg-indigo-600/80 hover:bg-indigo-500 border border-indigo-500/50 shadow-[0_0_15px_rgba(79,70,229,0.3)] text-white"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={16} />
                                Escaneando...
                            </>
                        ) : (
                            <>
                                <Plus size={16} />
                                Escanear Nicho
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* Grid de Resultados (Bento Grid) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                {categories.length === 0 && !loading && (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 text-slate-500 bg-slate-900/20 border border-slate-800 rounded-2xl text-center">
                        <Radar size={40} className="mb-4 opacity-20 text-slate-400" />
                        <h4 className="text-slate-300 font-semibold mb-1">Ningún nicho rastreado</h4>
                        <p className="text-xs text-slate-500 max-w-sm">Ingresa una palabra clave o el ID de una categoría para comenzar el análisis macro.</p>
                    </div>
                )}

                {categories.map((cat) => {
                    const snap = cat.snapshot;
                    const history = cat.history || [];
                    const chartData = history.length > 1 ? history.map(h => ({ val: h.total_revenue_usd })) : [{val: snap.total_revenue_usd}, {val: snap.total_revenue_usd}];
                    
                    return (
                        <div key={snap.category_id} className={`glass-card relative overflow-hidden flex flex-col ${getTrendColor(snap.trend_label)} hover:-translate-y-1 transition-transform`}>
                            {/* Background Sparkline */}
                            <div className="absolute bottom-0 left-0 right-0 h-24 opacity-20 pointer-events-none">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <Area type="monotone" dataKey="val" stroke="currentColor" fill="currentColor" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="relative z-10 flex-1">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-white truncate max-w-[200px]" title={snap.category_name}>
                                            {snap.category_name}
                                        </h3>
                                        <span className="text-xs opacity-70 font-mono text-indigo-300">{snap.category_id}</span>
                                    </div>
                                    <div className="flex items-center gap-1 bg-black/40 border border-white/5 px-2 py-1 rounded-md backdrop-blur-md shadow-lg">
                                        {getTrendIcon(snap.trend_label)}
                                        <span className="text-xs font-bold text-white">
                                            {snap.trend_pct > 0 ? '+' : ''}{snap.trend_pct}%
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5">
                                        <div className="text-[10px] opacity-70 uppercase tracking-wider mb-1 text-slate-400">Volumen USD</div>
                                        <div className="text-xl font-bold text-white">{formatMoney(snap.total_revenue_usd)}</div>
                                    </div>
                                    <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5">
                                        <div className="text-[10px] opacity-70 uppercase tracking-wider mb-1 text-slate-400">Items Vendidos</div>
                                        <div className="text-lg font-semibold text-white/90">{formatNumber(snap.total_sold_qty)}</div>
                                    </div>
                                    <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5">
                                        <div className="text-[10px] opacity-70 uppercase tracking-wider mb-1 text-slate-400">Competidores</div>
                                        <div className="text-lg font-medium text-white/80">{formatNumber(snap.total_sellers)}</div>
                                    </div>
                                    <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5">
                                        <div className="text-[10px] opacity-70 uppercase tracking-wider mb-1 text-slate-400">Precio Prom.</div>
                                        <div className="text-lg font-medium text-white/80">{formatMoney(snap.avg_price)}</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="relative z-10 mt-auto">
                                <Link 
                                    href={`/dashboard/radar/${snap.category_id}`}
                                    className="w-full flex items-center justify-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/40 transition-colors py-3 rounded-xl text-sm font-medium border border-indigo-500/30 text-indigo-100 backdrop-blur-sm"
                                >
                                    Ver Top Productos
                                    <ArrowRight size={16} />
                                </Link>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
