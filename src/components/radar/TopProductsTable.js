"use client";

import { useState } from "react";
import { ArrowUpRight, Eye, ShieldAlert, Award, TrendingUp, DollarSign, Package, Percent, ShoppingBag, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function TopProductsTable({ data }) {
    const { category_id, category_name, total_listings, sample_size, global_metrics, top_products, market_distribution } = data;
    const [filterFreeShipping, setFilterFreeShipping] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const formatMoney = (n) => {
        if (!n && n !== 0) return "—";
        return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatNumber = (n) => {
        if (!n && n !== 0) return "0";
        return n.toLocaleString("en-US");
    };

    // Filter and search
    const filteredProducts = top_products.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.seller_nickname.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesShipping = !filterFreeShipping || item.free_shipping;
        return matchesSearch && matchesShipping;
    });

    // Get Monopoly Status and Details
    const hasMonopoly = market_distribution?.has_monopoly;
    const monopolists = market_distribution?.monopolists || [];

    const getRankStyle = (rank) => {
        switch (rank) {
            case 1: return "bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 shadow-yellow-500/20";
            case 2: return "bg-gradient-to-r from-slate-300 to-slate-400 text-slate-950 shadow-slate-400/20";
            case 3: return "bg-gradient-to-r from-amber-600 to-amber-800 text-white shadow-amber-700/20";
            default: return "bg-slate-800 border border-slate-700 text-slate-300";
        }
    };

    const getMarketShareColor = (pct) => {
        if (pct >= 30) return "text-rose-400 bg-rose-500/10 border-rose-500/30";
        if (pct >= 15) return "text-amber-400 bg-amber-500/10 border-amber-500/30";
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    };

    const getMarketShareBarColor = (pct) => {
        if (pct >= 30) return "bg-rose-500";
        if (pct >= 15) return "bg-amber-500";
        return "bg-emerald-500";
    };

    return (
        <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/40 border border-slate-800 backdrop-blur-xl p-5 rounded-2xl flex items-center justify-between">
                    <div className="space-y-1">
                        <span className="text-xs text-slate-400 uppercase font-medium tracking-wider">Volumen Escaneado</span>
                        <h4 className="text-xl font-bold text-white">{formatMoney(global_metrics?.total_revenue)}</h4>
                        <span className="text-xs text-indigo-400 flex items-center gap-1 mt-1 font-mono">
                            Categoría: {category_id}
                        </span>
                    </div>
                    <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                        <DollarSign size={22} />
                    </div>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 backdrop-blur-xl p-5 rounded-2xl flex items-center justify-between">
                    <div className="space-y-1">
                        <span className="text-xs text-slate-400 uppercase font-medium tracking-wider">Unidades Vendidas</span>
                        <h4 className="text-xl font-bold text-white">{formatNumber(global_metrics?.total_sold)}</h4>
                        <span className="text-xs text-slate-400 mt-1 block">En {sample_size} publicaciones</span>
                    </div>
                    <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                        <Package size={22} />
                    </div>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 backdrop-blur-xl p-5 rounded-2xl flex items-center justify-between">
                    <div className="space-y-1">
                        <span className="text-xs text-slate-400 uppercase font-medium tracking-wider">Precio Promedio</span>
                        <h4 className="text-xl font-bold text-white">{formatMoney(global_metrics?.avg_price)}</h4>
                        <span className="text-xs text-slate-400 mt-1 block">De toda la categoría</span>
                    </div>
                    <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                        <TrendingUp size={22} />
                    </div>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 backdrop-blur-xl p-5 rounded-2xl flex items-center justify-between">
                    <div className="space-y-1">
                        <span className="text-xs text-slate-400 uppercase font-medium tracking-wider">Monitoreo Global</span>
                        <h4 className="text-xl font-bold text-white">{formatNumber(total_listings)}</h4>
                        <span className="text-xs text-slate-400 mt-1 block">Publicaciones activas</span>
                    </div>
                    <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
                        <ShoppingBag size={22} />
                    </div>
                </div>
            </div>

            {/* Monopoly alert & Distribution panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Monopoly Alert */}
                <div className="bg-slate-900/30 border border-slate-800 backdrop-blur-xl rounded-2xl p-6 lg:col-span-2 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            {hasMonopoly ? (
                                <>
                                    <ShieldAlert className="text-rose-500" size={24} />
                                    <h3 className="text-lg font-bold text-rose-400">Riesgo de Monopolio Detectado</h3>
                                </>
                            ) : (
                                <>
                                    <Award className="text-emerald-500" size={24} />
                                    <h3 className="text-lg font-bold text-emerald-400">Mercado Abierto y Competitivo</h3>
                                </>
                            )}
                        </div>
                        <p className="text-slate-300 text-sm leading-relaxed">
                            {hasMonopoly 
                                ? `¡Atención! Hemos detectado que uno o más vendedores acaparan más del 30% del volumen financiero o unidades de esta categoría. Entrar a competir en este mercado requiere una estrategia agresiva de precios o diferenciación extrema de producto.`
                                : `Excelente noticia. La distribución del mercado es saludable y participativa. Ningún vendedor domina más del 30% de la categoría, lo cual representa una gran oportunidad para penetrar el mercado con productos de alta calidad.`
                            }
                        </p>
                        
                        {hasMonopoly && (
                            <div className="mt-4 space-y-3">
                                {monopolists.map(m => (
                                    <div key={m.seller_id} className="flex flex-col md:flex-row items-start md:items-center justify-between bg-rose-500/5 border border-rose-500/10 rounded-xl p-3 text-sm">
                                        <div className="font-semibold text-rose-200">
                                            {m.seller_nickname} <span className="text-xs text-rose-400 font-mono">({m.seller_id})</span>
                                        </div>
                                        <div className="flex items-center gap-4 mt-2 md:mt-0 font-mono">
                                            <span className="text-slate-400">Participación Financiera:</span>
                                            <span className="text-rose-400 font-bold">{m.market_share_revenue_pct}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                        <span>Algoritmo de detección basado en el índice Herfindahl-Hirschman modificado</span>
                        <span className="font-mono">MLV - 2026</span>
                    </div>
                </div>

                {/* Top Sellers share */}
                <div className="bg-slate-900/30 border border-slate-800 backdrop-blur-xl rounded-2xl p-6 space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Top 5 Vendedores (Market Share)</h3>
                    <div className="space-y-3">
                        {market_distribution?.top_sellers?.map((seller, idx) => (
                            <div key={seller.seller_id} className="space-y-1">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-300 font-semibold truncate max-w-[150px]">
                                        {idx + 1}. {seller.seller_nickname}
                                    </span>
                                    <span className="text-slate-400 font-mono">
                                        {seller.market_share_revenue_pct}% ({formatMoney(seller.total_revenue)})
                                    </span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full ${idx === 0 && hasMonopoly ? 'bg-rose-500' : 'bg-indigo-500'}`} 
                                        style={{ width: `${seller.market_share_revenue_pct}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Catalog list section */}
            <div className="bg-slate-900/30 border border-slate-800 backdrop-blur-xl rounded-2xl overflow-hidden">
                {/* Search & Filter tools */}
                <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/20">
                    <div>
                        <h3 className="text-base font-bold text-white">Billboard de Productos Ganadores</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Muestra de {sample_size} publicaciones ordenadas por volumen de ventas.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                        {/* Search Input */}
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar producto o vendedor..."
                            className="bg-slate-900/80 border border-slate-700/60 text-slate-300 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-60"
                        />

                        {/* Free Shipping Filter */}
                        <button
                            onClick={() => setFilterFreeShipping(!filterFreeShipping)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 justify-center ${
                                filterFreeShipping 
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                                    : "bg-slate-900/60 text-slate-400 border-slate-700/60 hover:text-slate-300"
                            }`}
                        >
                            <Percent size={14} />
                            Envío Gratis
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800/60 bg-slate-900/10 text-xs text-slate-400 font-semibold">
                                <th className="p-4 w-12 text-center">Rank</th>
                                <th className="p-4">Producto</th>
                                <th className="p-4 text-right">Precio</th>
                                <th className="p-4 text-right">Ventas</th>
                                <th className="p-4 text-right">Ingresos Est.</th>
                                <th className="p-4 text-center w-36">Market Share (Ingresos)</th>
                                <th className="p-4">Vendedor</th>
                                <th className="p-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40 text-xs">
                            {filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="p-8 text-center text-slate-500">
                                        No se encontraron productos con los criterios seleccionados.
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-800/10 transition-colors">
                                        {/* Rank */}
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs shadow-md ${getRankStyle(item.rank)}`}>
                                                #{item.rank}
                                            </span>
                                        </td>

                                        {/* Product info */}
                                        <td className="p-4 max-w-sm">
                                            <div className="flex items-center gap-3">
                                                {item.thumbnail ? (
                                                    <img 
                                                        src={item.thumbnail} 
                                                        alt="preview" 
                                                        className="w-10 h-10 object-cover rounded-lg border border-slate-800 bg-slate-950 flex-shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-center text-slate-500 font-bold flex-shrink-0">
                                                        N/A
                                                    </div>
                                                )}
                                                <div className="space-y-1">
                                                    <div className="font-semibold text-white line-clamp-2" title={item.title}>
                                                        {item.title}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-slate-500 font-mono">{item.id}</span>
                                                        {item.free_shipping && (
                                                            <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1 rounded-sm font-medium">
                                                                Envío Gratis
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Price */}
                                        <td className="p-4 text-right font-medium text-white">
                                            {formatMoney(item.price)}
                                        </td>

                                        {/* Sold quantity */}
                                        <td className="p-4 text-right font-semibold text-slate-300">
                                            {formatNumber(item.sold_quantity)}
                                        </td>

                                        {/* Estimated Revenue */}
                                        <td className="p-4 text-right font-bold text-emerald-400">
                                            {formatMoney(item.revenue)}
                                        </td>

                                        {/* Market Share Progress Bar */}
                                        <td className="p-4">
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center text-[10px]">
                                                    <span className={`px-1.5 py-0.5 rounded font-bold font-mono border ${getMarketShareColor(item.market_share_revenue_pct)}`}>
                                                        {item.market_share_revenue_pct}%
                                                    </span>
                                                </div>
                                                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full ${getMarketShareBarColor(item.market_share_revenue_pct)}`} 
                                                        style={{ width: `${Math.min(100, item.market_share_revenue_pct * 2)}%` }} // Escala visual para que no sea diminuta
                                                    />
                                                </div>
                                            </div>
                                        </td>

                                        {/* Seller */}
                                        <td className="p-4">
                                            <div className="space-y-0.5">
                                                <div className="font-semibold text-slate-200">
                                                    {item.seller_nickname}
                                                </div>
                                                <span className="text-[10px] text-slate-500 font-mono">ID: {item.seller_id}</span>
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {/* Espiar Vendedor (Redirects to Sprint 1 module) */}
                                                <Link 
                                                    href={`/dashboard/spy/${item.seller_id}`}
                                                    className="inline-flex items-center gap-1 bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/20 hover:border-indigo-500 text-indigo-400 hover:text-white px-2 py-1 rounded transition-all font-semibold"
                                                >
                                                    <Eye size={12} />
                                                    Espiar
                                                </Link>

                                                {/* External ML Link */}
                                                <a 
                                                    href={item.permalink} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center justify-center p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded border border-slate-700"
                                                    title="Ver en Mercado Libre"
                                                >
                                                    <ExternalLink size={12} />
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
