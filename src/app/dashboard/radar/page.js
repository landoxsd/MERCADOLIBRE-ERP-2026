"use client";

import { useState, useEffect } from "react";
import { Search, Radar, TrendingUp, TrendingDown, Minus, ArrowRight, Loader2, Plus, Zap, AlertTriangle } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

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
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-xl">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Radar className="text-indigo-400" size={28} />
                        Radar de Nichos
                    </h1>
                    <p className="text-slate-400 mt-1">Escanea categorías completas para detectar tendencias y volumen de mercado.</p>
                </div>
                
                <form onSubmit={handleScanCategory} className="flex w-full md:w-auto gap-2">
                    <div className="relative flex-1 md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-slate-500" />
                        </div>
                        <input
                            type="text"
                            value={newCategoryId}
                            onChange={(e) => setNewCategoryId(e.target.value)}
                            placeholder="ID Categoría (Ej: MLV1500)"
                            className="block w-full pl-10 pr-3 py-2 border border-slate-700 rounded-lg leading-5 bg-slate-900 text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            disabled={loading}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !newCategoryId}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        Escanear
                    </button>
                </form>
            </div>

            {error && (
                <div className="p-4 bg-red-900/30 border border-red-800 rounded-xl text-red-200 flex items-center gap-3">
                    <AlertTriangle size={20} className="text-red-400" />
                    {error}
                </div>
            )}

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.length === 0 && !loading && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-2xl">
                        <Radar className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                        <h3 className="text-lg font-medium text-slate-300">Ninguna categoría rastreada</h3>
                        <p className="text-slate-500 mt-1">Ingresa el ID de una categoría (Ej: MLV1500) para comenzar.</p>
                    </div>
                )}

                {categories.map((cat) => {
                    const snap = cat.snapshot;
                    const history = cat.history || [];
                    const chartData = history.length > 1 ? history.map(h => ({ val: h.total_revenue_usd })) : [{val: snap.total_revenue_usd}, {val: snap.total_revenue_usd}];
                    
                    return (
                        <div key={snap.category_id} className={`relative overflow-hidden bg-gradient-to-br border rounded-2xl p-5 ${getTrendColor(snap.trend_label)}`}>
                            {/* Background Sparkline */}
                            <div className="absolute bottom-0 left-0 right-0 h-24 opacity-20 pointer-events-none">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <Area type="monotone" dataKey="val" stroke="currentColor" fill="currentColor" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-white truncate max-w-[200px]" title={snap.category_name}>
                                            {snap.category_name}
                                        </h3>
                                        <span className="text-xs opacity-70 font-mono">{snap.category_id}</span>
                                    </div>
                                    <div className="flex items-center gap-1 bg-black/20 px-2 py-1 rounded-md">
                                        {getTrendIcon(snap.trend_label)}
                                        <span className="text-xs font-bold">
                                            {snap.trend_pct > 0 ? '+' : ''}{snap.trend_pct}%
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-5">
                                    <div>
                                        <div className="text-xs opacity-70 uppercase tracking-wider mb-1">Volumen USD</div>
                                        <div className="text-2xl font-bold text-white">{formatMoney(snap.total_revenue_usd)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs opacity-70 uppercase tracking-wider mb-1">Items Vendidos</div>
                                        <div className="text-xl font-semibold text-white/90">{formatNumber(snap.total_sold_qty)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs opacity-70 uppercase tracking-wider mb-1">Competidores</div>
                                        <div className="text-lg font-medium text-white/80">{formatNumber(snap.total_sellers)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs opacity-70 uppercase tracking-wider mb-1">Precio Prom.</div>
                                        <div className="text-lg font-medium text-white/80">{formatMoney(snap.avg_price)}</div>
                                    </div>
                                </div>

                                <button 
                                    className="w-full flex items-center justify-center gap-2 bg-black/20 hover:bg-black/40 transition-colors py-2 rounded-lg text-sm font-medium border border-white/10"
                                    onClick={() => alert('Próximamente: Top 20 Ganadores')}
                                >
                                    Ver Top Productos
                                    <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
