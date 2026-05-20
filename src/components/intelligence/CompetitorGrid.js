'use client';

import { ExternalLink, Camera, Hash, Trophy } from "lucide-react";

/**
 * CompetitorGrid — Tabla de competidores Top 10
 */
export default function CompetitorGrid({ competitors, leaderId }) {
    if (!competitors || competitors.length === 0) return null;

    const formatNumber = (n) => {
        if (!n && n !== 0) return "—";
        return n.toLocaleString("es-VE");
    };

    // Obtenemos el máximo de ventas para la barra de rendimiento relativo
    const maxSales = Math.max(...competitors.map(c => c.sold_quantity || 0), 1); // evitamos dividir por cero

    return (
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700/50 bg-slate-800/30 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                    <Trophy className="w-4 h-4 text-cyan-400" />
                </div>
                <h3 className="text-sm font-black text-slate-200 tracking-wide uppercase">📋 Top 10 Competidores</h3>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-700/50 bg-slate-950/40">
                            <th className="px-5 py-3 text-left font-bold">Rnk</th>
                            <th className="px-5 py-3 text-left font-bold">Vendedor / Título</th>
                            <th className="px-5 py-3 text-right font-bold">Precio</th>
                            <th className="px-5 py-3 text-left font-bold w-48">Volumen (Vendidos)</th>
                            <th className="px-5 py-3 text-center font-bold">Media</th>
                            <th className="px-5 py-3 text-center font-bold">Link</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {competitors.map((c, idx) => {
                            const isLeader = c.ml_item_id === leaderId;
                            const salesRatio = ((c.sold_quantity || 0) / maxSales) * 100;
                            
                            return (
                                <tr
                                    key={c.ml_item_id}
                                    className={`group hover:bg-slate-800/40 transition-colors ${isLeader ? 'bg-amber-900/10' : ''}`}
                                >
                                    {/* Rank */}
                                    <td className="px-5 py-3">
                                        <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-black ${isLeader ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_8px_rgba(252,211,77,0.2)]' : 'bg-slate-800 text-slate-400'}`}>
                                            {isLeader ? '1' : idx + 1}
                                        </div>
                                    </td>
                                    
                                    {/* Vendedor / Título */}
                                    <td className="px-5 py-3">
                                        <div className="max-w-[200px] sm:max-w-[300px]">
                                            <div className="text-sm font-bold text-slate-200 truncate group-hover:text-cyan-300 transition-colors" title={c.seller_nickname}>
                                                {c.seller_nickname || "—"}
                                            </div>
                                            <div className="text-[11px] text-slate-500 truncate mt-0.5" title={c.title}>
                                                {c.title}
                                            </div>
                                        </div>
                                    </td>
                                    
                                    {/* Precio */}
                                    <td className="px-5 py-3 text-right">
                                        <span className="font-mono text-slate-300 font-medium">
                                            ${c.price_usd?.toFixed(2) || "—"}
                                        </span>
                                    </td>
                                    
                                    {/* Volumen y Barra Relativa */}
                                    <td className="px-5 py-3">
                                        <div className="flex flex-col gap-1.5">
                                            <span className={`text-xs font-bold ${isLeader ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                {formatNumber(c.sold_quantity)}
                                            </span>
                                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full ${isLeader ? 'bg-amber-500 shadow-[0_0_8px_rgba(252,211,77,0.6)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'}`}
                                                    style={{ width: `${Math.max(salesRatio, 1)}%` }} 
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    
                                    {/* Media (Fotos/Atributos) */}
                                    <td className="px-5 py-3 text-center">
                                        <div className="flex items-center justify-center gap-3 text-xs text-slate-400">
                                            <div className="flex items-center gap-1 bg-slate-800/50 px-2 py-1 rounded border border-slate-700/50" title="Fotos">
                                                <Camera className="w-3 h-3" />
                                                <span>{c.pictures_count || 0}</span>
                                            </div>
                                            <div className="flex items-center gap-1 bg-slate-800/50 px-2 py-1 rounded border border-slate-700/50" title="Atributos">
                                                <Hash className="w-3 h-3" />
                                                <span>{c.attributes_count || 0}</span>
                                            </div>
                                        </div>
                                    </td>
                                    
                                    {/* Link */}
                                    <td className="px-5 py-3 text-center">
                                        <a
                                            href={`https://articulo.mercadolibre.com.ve/MLV-${(c.ml_item_id || "").replace('MLV', '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center mx-auto text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 border border-slate-700 hover:border-cyan-500/30 transition-all"
                                            title="Ver en MercadoLibre"
                                        >
                                            <ExternalLink className="w-4 h-4" />
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
