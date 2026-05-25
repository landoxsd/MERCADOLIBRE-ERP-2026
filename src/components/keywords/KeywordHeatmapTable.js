"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, TrendingUp, TrendingDown, Award, Zap, ShieldAlert, ExternalLink, Download } from "lucide-react";

// ─────────────────────────────────────
// Heatmap color helper (0–100 → color)
// ─────────────────────────────────────
function heatColor(value, alpha = 0.15) {
    if (value >= 80) return { bg: `rgba(16, 185, 129, ${alpha})`, border: "rgba(16, 185, 129, 0.3)", text: "#10b981" }; // emerald
    if (value >= 60) return { bg: `rgba(52, 211, 153, ${alpha * 0.8})`, border: "rgba(52, 211, 153, 0.25)", text: "#34d399" };
    if (value >= 40) return { bg: `rgba(245, 158, 11, ${alpha})`, border: "rgba(245, 158, 11, 0.3)", text: "#f59e0b" }; // amber
    if (value >= 20) return { bg: `rgba(249, 115, 22, ${alpha})`, border: "rgba(249, 115, 22, 0.3)", text: "#f97316" }; // orange
    return { bg: `rgba(239, 68, 68, ${alpha * 0.7})`, border: "rgba(239, 68, 68, 0.2)", text: "#ef4444" };             // red
}

function HeatCell({ value, label, children }) {
    const colors = heatColor(value);
    return (
        <div
            className="px-2 py-1 rounded-md border text-xs font-mono text-center min-w-[60px]"
            style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
            title={label}
        >
            {children}
        </div>
    );
}

function OpportunityBadge({ keyword }) {
    const isOpportunity = keyword.competitors < 10 && keyword.conversion_score > 2;
    const isSaturated   = keyword.competitors >= 15 && keyword.conversion_heat < 30;
    const isHot         = keyword.conversion_heat >= 70;

    if (isOpportunity) return (
        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-semibold">
            <Award size={10} /> Oportunidad
        </span>
    );
    if (isHot) return (
        <span className="inline-flex items-center gap-1 text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded font-semibold">
            <Zap size={10} /> Hot
        </span>
    );
    if (isSaturated) return (
        <span className="inline-flex items-center gap-1 text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded font-semibold">
            <ShieldAlert size={10} /> Saturado
        </span>
    );
    return null;
}

const SortIcon = ({ field, sortField, sortDir }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="opacity-30" />;
    return sortDir === "desc" ? <TrendingDown size={12} className="text-indigo-400" /> : <TrendingUp size={12} className="text-indigo-400" />;
};

const SortableHeader = ({ field, sortField, sortDir, toggleSort, children, className = "" }) => (
    <th
        className={`p-3 cursor-pointer select-none hover:text-white transition-colors ${className}`}
        onClick={() => toggleSort(field)}
    >
        <div className="flex items-center gap-1.5">
            {children}
            <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
        </div>
    </th>
);

export default function KeywordHeatmapTable({ keywords, onKeywordSearch }) {
    const [sortField, setSortField] = useState("conversion_score");
    const [sortDir, setSortDir] = useState("desc");
    const [search, setSearch] = useState("");

    const sorted = useMemo(() => {
        let list = keywords.filter(k =>
            k.keyword.toLowerCase().includes(search.toLowerCase())
        );
        list.sort((a, b) => {
            const va = a[sortField] ?? 0;
            const vb = b[sortField] ?? 0;
            return sortDir === "desc" ? vb - va : va - vb;
        });
        return list;
    }, [keywords, sortField, sortDir, search]);

    const toggleSort = (field) => {
        if (sortField === field) {
            setSortDir(d => d === "desc" ? "asc" : "desc");
        } else {
            setSortField(field);
            setSortDir("desc");
        }
    };

    const downloadCSV = () => {
        const headers = ["Keyword", "Competidores", "Conversión (ventas/ítem)", "Precio Promedio", "Precio Min", "Precio Max", "Rev. Estimado", "Envío Gratis %", "Calor Conversión %"];
        const rows = sorted.map(k => [
            k.keyword,
            k.competitors,
            k.conversion_score,
            k.avg_price,
            k.min_price,
            k.max_price,
            k.estimated_revenue,
            k.free_shipping_pct,
            k.conversion_heat,
        ]);
        const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `keywords_mlv_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4">
            {/* Search + Download */}
            <div className="flex flex-col sm:flex-row justify-between gap-3">
                <input
                    type="text"
                    placeholder="Filtrar keywords..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="bg-slate-900/80 border border-slate-700/60 text-slate-300 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-64"
                />
                <button
                    onClick={downloadCSV}
                    className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                    <Download size={13} />
                    Exportar CSV
                </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-xs text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-900/60 text-slate-400 font-semibold border-b border-slate-800">
                            <th className="p-3 w-8 text-center">#</th>
                            <th className="p-3">Keyword</th>
                            <SortableHeader field="competitors" sortField={sortField} sortDir={sortDir} toggleSort={toggleSort}>Competidores</SortableHeader>
                            <SortableHeader field="conversion_score" sortField={sortField} sortDir={sortDir} toggleSort={toggleSort} className="text-right">Conv. (ventas/ítem)</SortableHeader>
                            <SortableHeader field="avg_price" sortField={sortField} sortDir={sortDir} toggleSort={toggleSort} className="text-right">Precio Prom.</SortableHeader>
                            <SortableHeader field="estimated_revenue" sortField={sortField} sortDir={sortDir} toggleSort={toggleSort} className="text-right">Rev. Estimado</SortableHeader>
                            <SortableHeader field="free_shipping_pct" sortField={sortField} sortDir={sortDir} toggleSort={toggleSort} className="text-center">Env. Gratis</SortableHeader>
                            <th className="p-3 text-center">Calor</th>
                            <th className="p-3 text-center">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                        {sorted.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="p-8 text-center text-slate-500">
                                    Sin resultados para "{search}"
                                </td>
                            </tr>
                        ) : sorted.map((kw, idx) => (
                            <tr key={kw.keyword} className="hover:bg-slate-800/10 transition-colors">
                                {/* Rank */}
                                <td className="p-3 text-center text-slate-500 font-mono">{idx + 1}</td>

                                {/* Keyword + badge */}
                                <td className="p-3">
                                    <div className="flex flex-col gap-1">
                                        <span className="font-semibold text-white">{kw.keyword}</span>
                                        <OpportunityBadge keyword={kw} />
                                    </div>
                                </td>

                                {/* Competitors with heatmap */}
                                <td className="p-3">
                                    <HeatCell value={100 - Math.min(kw.competitors * 5, 100)} label="Menos competidores es mejor">
                                        {kw.competitors}
                                    </HeatCell>
                                </td>

                                {/* Conversion score */}
                                <td className="p-3 text-right">
                                    <HeatCell value={kw.conversion_heat} label="Ventas promedio por ítem (conversión)">
                                        {kw.conversion_score.toFixed(1)}
                                    </HeatCell>
                                </td>

                                {/* Avg price */}
                                <td className="p-3 text-right font-mono text-slate-300">
                                    <div>${kw.avg_price.toFixed(2)}</div>
                                    <div className="text-[10px] text-slate-500">
                                        ${kw.min_price.toFixed(0)}–${kw.max_price.toFixed(0)}
                                    </div>
                                </td>

                                {/* Estimated Revenue */}
                                <td className="p-3 text-right">
                                    <HeatCell value={kw.revenue_heat} label="Ingresos totales estimados de la muestra">
                                        ${kw.estimated_revenue >= 1000
                                            ? `${(kw.estimated_revenue / 1000).toFixed(1)}k`
                                            : kw.estimated_revenue.toFixed(0)}
                                    </HeatCell>
                                </td>

                                {/* Free shipping % */}
                                <td className="p-3 text-center font-mono text-slate-400">
                                    {kw.free_shipping_pct.toFixed(0)}%
                                </td>

                                {/* Heat bar */}
                                <td className="p-3">
                                    <div className="flex flex-col items-center gap-1 min-w-[60px]">
                                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full"
                                                style={{
                                                    width: `${kw.conversion_heat}%`,
                                                    backgroundColor: heatColor(kw.conversion_heat).text,
                                                }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-mono" style={{ color: heatColor(kw.conversion_heat).text }}>
                                            {kw.conversion_heat.toFixed(0)}%
                                        </span>
                                    </div>
                                </td>

                                {/* Action: spy this keyword */}
                                <td className="p-3 text-center">
                                    {onKeywordSearch && (
                                        <button
                                            onClick={() => onKeywordSearch(kw.keyword)}
                                            className="inline-flex items-center gap-1 bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/20 hover:border-indigo-500 text-indigo-400 hover:text-white px-2 py-1 rounded transition-all font-semibold text-[10px]"
                                            title="Analizar esta keyword en el Sniper"
                                        >
                                            <ExternalLink size={10} />
                                            Espiar
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
