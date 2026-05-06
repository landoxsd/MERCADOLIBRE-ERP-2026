'use client';

import { ExternalLink, Camera, Hash } from "lucide-react";

/**
 * CompetitorGrid — Tabla de competidores Top 10
 */
export default function CompetitorGrid({ competitors, leaderId }) {
    if (!competitors || competitors.length === 0) return null;

    const formatNumber = (n) => {
        if (!n && n !== 0) return "—";
        return n.toLocaleString("es-VE");
    };

    return (
        <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
                <h3 className="text-sm font-bold text-slate-200">📋 Competidores Analizados</h3>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-xs text-slate-400 border-b border-slate-700">
                            <th className="px-4 py-2 text-left">#</th>
                            <th className="px-4 py-2 text-left">Vendedor</th>
                            <th className="px-4 py-2 text-right">Precio</th>
                            <th className="px-4 py-2 text-right">Vendidos</th>
                            <th className="px-4 py-2 text-center">📸</th>
                            <th className="px-4 py-2 text-center">🏷️</th>
                            <th className="px-4 py-2 text-center">Link</th>
                        </tr>
                    </thead>
                    <tbody>
                        {competitors.map((c, idx) => {
                            const isLeader = c.ml_item_id === leaderId;
                            return (
                                <tr
                                    key={c.ml_item_id}
                                    className={`border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors ${isLeader ? 'bg-amber-900/10' : ''
                                        }`}
                                >
                                    <td className="px-4 py-2">
                                        <span className={`text-xs font-bold ${isLeader ? 'text-amber-400' : 'text-slate-400'}`}>
                                            {isLeader ? '🥇' : idx + 1}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="max-w-[140px] truncate" title={c.seller_nickname}>
                                            <span className="text-slate-300 font-medium">{c.seller_nickname || "—"}</span>
                                        </div>
                                        <div className="max-w-[140px] truncate text-[10px] text-slate-500" title={c.title}>
                                            {c.title}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 text-right font-mono text-slate-200">
                                        ${c.price_usd?.toFixed(2) || "—"}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        <span className="text-emerald-400 font-semibold">{formatNumber(c.sold_quantity)}</span>
                                    </td>
                                    <td className="px-4 py-2 text-center text-slate-400">
                                        <Camera className="w-3 h-3 inline mr-1" />
                                        {c.pictures_count || 0}
                                    </td>
                                    <td className="px-4 py-2 text-center text-slate-400">
                                        <Hash className="w-3 h-3 inline mr-1" />
                                        {c.attributes_count || 0}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <a
                                            href={c.permalink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-cyan-400 hover:text-cyan-300 transition-colors"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5 inline" />
                                        </a>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
