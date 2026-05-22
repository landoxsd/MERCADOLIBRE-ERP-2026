'use client';

import { ExternalLink, Camera, Hash, Trophy, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
import { useState } from "react";

/**
 * CompetitorGrid — Tabla de competidores Top 10
 */
export default function CompetitorGrid({ competitors, leaderId, onDelete }) {
    const [sortConfig, setSortConfig] = useState({ key: 'sold_quantity', direction: 'desc' });

    if (!competitors || competitors.length === 0) return null;

    const exportToExcel = () => {
        // 1. Extraer todos los nombres de atributos únicos presentes en los competidores visibles
        const uniqueAttributeNames = new Set();
        sortedCompetitors.forEach(c => {
            if (c.attributes_raw && Array.isArray(c.attributes_raw)) {
                c.attributes_raw.forEach(attr => {
                    if (attr.name) uniqueAttributeNames.add(attr.name);
                });
            }
        });
        const dynamicAttributeHeaders = Array.from(uniqueAttributeNames).sort();

        const baseHeader = ["Rnk", "Vendedor", "Titulo", "SKU", "Marca", "Precio", "Ventas", "Vistas", "Fotos", "Atributos Principales", "Atributos Secundarios", "ID", "URL"];
        const header = [...baseHeader, ...dynamicAttributeHeaders.map(name => `Atributo ${name}`)];

        const rows = sortedCompetitors.map((c, idx) => {
            const baseRow = [
                idx + 1,
                c.seller_nickname || "—",
                c.title,
                c.sku || "—",
                c.brand || "—",
                c.price_usd?.toFixed(2) || "0",
                c.sold_quantity || 0,
                c.visits || 0,
                c.pictures_count || 0,
                c.primary_attributes_count || 0,
                c.secondary_attributes_count || 0,
                c.ml_item_id,
                c.permalink || `https://articulo.mercadolibre.com.ve/MLV-${(c.ml_item_id || "").replace('MLV', '')}`
            ];

            // Rellenar valores de atributos dinámicos
            const attrValues = dynamicAttributeHeaders.map(attrName => {
                if (!c.attributes_raw || !Array.isArray(c.attributes_raw)) return "N/A";
                const found = c.attributes_raw.find(a => a.name === attrName);
                return found ? found.value_name : "N/A";
            });

            return [...baseRow, ...attrValues];
        });

        const csvContent = [
            header.join(","),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Analisis_MLV_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formatNumber = (n) => {
        if (!n && n !== 0) return "—";
        return n.toLocaleString("es-VE");
    };

    // Obtenemos el máximo de ventas para la barra de rendimiento relativo
    const maxSales = Math.max(...competitors.map(c => c.sold_quantity || 0), 1); // evitamos dividir por cero

    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const sortedCompetitors = [...competitors].sort((a, b) => {
        if (!sortConfig.key) return 0;
        const aVal = a[sortConfig.key] || 0;
        const bVal = b[sortConfig.key] || 0;
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} style={{display:'inline', opacity: 0.3, marginLeft: '4px'}}/>;
        if (sortConfig.direction === 'asc') return <ArrowUp size={12} style={{display:'inline', marginLeft: '4px'}}/>;
        return <ArrowDown size={12} style={{display:'inline', marginLeft: '4px'}}/>;
    };

    return (
        <div className="competitor-card">
            <div className="competitor-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="competitor-card-icon-bg">
                        <Trophy size={16} />
                    </div>
                    <h3 className="competitor-card-title">📋 Top {competitors.length} Competidores</h3>
                </div>
                <button onClick={exportToExcel} className="export-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <Download size={14} /> Descargar Excel
                </button>
            </div>

            <div className="competitor-table-container">
                <table className="competitor-table">
                    <thead>
                        <tr>
                            <th className="competitor-th">Rnk</th>
                            <th className="competitor-th" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => handleSort('pictures_count')}>📷 Fotos <SortIcon columnKey="pictures_count"/></th>
                            <th className="competitor-th">Vendedor / Título / SKU / Marca</th>
                            <th className="competitor-th" style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('price_usd')}>Precio <SortIcon columnKey="price_usd"/></th>
                            <th className="competitor-th" style={{ width: '180px', cursor: 'pointer' }} onClick={() => handleSort('sold_quantity')}>Volumen (Ventas) <SortIcon columnKey="sold_quantity"/></th>
                            <th className="competitor-th" style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('visits')}>Vistas <SortIcon columnKey="visits"/></th>
                            <th className="competitor-th" style={{ textAlign: 'center' }}>Conv. Est</th>
                            <th className="competitor-th" style={{ textAlign: 'center' }}>Atributos</th>
                            <th className="competitor-th" style={{ textAlign: 'center' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedCompetitors.map((c, idx) => {
                            const isLeader = c.ml_item_id === leaderId;
                            const isSalesLeader = idx === 0 && sortConfig.key === 'sold_quantity' && sortConfig.direction === 'desc';
                            const isBestPrice = c.price_usd === Math.min(...competitors.map(comp => comp.price_usd || Infinity));
                            const hasOffer = c.original_price_usd && c.original_price_usd > c.price_usd;
                            
                            const salesRatio = ((c.sold_quantity || 0) / maxSales) * 100;
                            const conversionRate = (c.visits > 0 && c.sold_quantity > 0) ? ((c.sold_quantity / c.visits) * 100).toFixed(1) : "—";
                            
                            return (
                                <tr
                                    key={c.ml_item_id}
                                    className={`competitor-tr ${isLeader ? 'competitor-tr-leader' : ''}`}
                                >
                                    {/* Rank */}
                                    <td className="competitor-td">
                                        <div className={`rank-badge ${isLeader ? 'rank-badge-leader' : 'rank-badge-normal'}`}>
                                            {isLeader ? '1' : idx + 1}
                                        </div>
                                    </td>
                                    
                                    {/* Fotos */}
                                    <td className="competitor-td" style={{ textAlign: 'center' }}>
                                        {c.thumbnail ? (
                                            <a 
                                                href={c.permalink || `https://articulo.mercadolibre.com.ve/MLV-${(c.ml_item_id || "").replace('MLV', '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ width: '48px', height: '48px', borderRadius: '6px', overflow: 'hidden', display: 'inline-block', backgroundColor: '#1e293b', position: 'relative' }}
                                                title={`Ver publicación (${c.pictures_count || 0} fotos)`}
                                            >
                                                <img src={c.thumbnail} alt={c.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                <div style={{ position: 'absolute', bottom: 0, right: 0, background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '10px', padding: '1px 4px', borderTopLeftRadius: '4px' }}>
                                                    {c.pictures_count || 0}
                                                </div>
                                            </a>
                                        ) : (
                                            <span style={{ color: '#64748b' }}>—</span>
                                        )}
                                    </td>
                                    
                                    {/* Vendedor / Título */}
                                    <td className="competitor-td">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div className="competitor-name-wrap">
                                                {c.seller_id && c.seller_id !== "0" ? (
                                                    <a 
                                                        href={`https://listado.mercadolibre.com.ve/_CustId_${c.seller_id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="competitor-name hover:text-cyan-400"
                                                        title="Ver catálogo del vendedor"
                                                        style={{ textDecoration: 'none' }}
                                                    >
                                                        {c.seller_nickname || "—"} <ExternalLink size={10} style={{display: 'inline', marginLeft: '2px'}}/>
                                                    </a>
                                                ) : (
                                                    <div className="competitor-name" title={c.seller_nickname}>
                                                        {c.seller_nickname || "—"}
                                                    </div>
                                                )}
                                                
                                                <div className="competitor-item-title" title={c.title}>
                                                    <span style={{color: '#94a3b8', marginRight: '4px', fontSize: '11px', fontFamily: 'monospace'}}>[{c.ml_item_id}]</span>
                                                    {c.title}
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                                    {c.sku && <span><strong>SKU:</strong> <span style={{color: '#cbd5e1'}}>{c.sku}</span></span>}
                                                    {c.brand && <span><strong>Marca:</strong> <span style={{color: '#cbd5e1'}}>{c.brand}</span></span>}
                                                </div>
                                                
                                                {/* Insignias de Aceleradores */}
                                                <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                    {isSalesLeader && <span style={{ fontSize: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>🔥 Top Ventas</span>}
                                                    {isBestPrice && <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>💰 Mejor Precio</span>}
                                                    {hasOffer && <span style={{ fontSize: '10px', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>📉 Oferta Activa</span>}
                                                    {c.logistics_data?.local_pickup && <span style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>🏬 Pickup</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    
                                    {/* Precio */}
                                    <td className="competitor-td price-cell">
                                        ${c.price_usd?.toFixed(2) || "—"}
                                    </td>
                                    
                                    {/* Volumen y Barra Relativa */}
                                    <td className="competitor-td">
                                        <div className="volume-container">
                                            <span className={`volume-value ${isLeader ? 'volume-value-leader' : 'volume-value-normal'}`}>
                                                {formatNumber(c.sold_quantity)}
                                            </span>
                                            <div className="progress-track">
                                                <div 
                                                    className={`progress-bar ${isLeader ? 'progress-bar-leader' : 'progress-bar-normal'}`}
                                                    style={{ width: `${Math.max(salesRatio, 1)}%` }} 
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    
                                    {/* Vistas */}
                                    <td className="competitor-td" style={{ textAlign: 'right', fontWeight: '500', color: '#cbd5e1' }}>
                                        {formatNumber(c.visits)}
                                    </td>
                                    
                                    {/* Conversión Estimada */}
                                    <td className="competitor-td" style={{ textAlign: 'center' }}>
                                        <span style={{ color: conversionRate !== "—" && parseFloat(conversionRate) > 5 ? '#34d399' : '#94a3b8' }}>
                                            {conversionRate !== "—" ? `${conversionRate}%` : "—"}
                                        </span>
                                    </td>
                                    
                                    {/* Atributos (Principales / Secundarios) */}
                                    <td className="competitor-td">
                                        <div className="media-badge-group">
                                            <div className="media-badge" title="Atributos (Principales / Secundarios)">
                                                <Hash size={12} />
                                                <span>{c.primary_attributes_count || 0}/{c.secondary_attributes_count || 0}</span>
                                            </div>
                                        </div>
                                    </td>
                                    
                                    {/* Acciones */}
                                    <td className="competitor-td">
                                        <div style={{display: 'flex', gap: '8px', justifyContent: 'center'}}>
                                            <a
                                                href={c.permalink || `https://articulo.mercadolibre.com.ve/MLV-${(c.ml_item_id || "").replace('MLV', '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="link-btn"
                                                title="Ver en MercadoLibre"
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                            <button
                                                onClick={() => onDelete && onDelete(c.ml_item_id)}
                                                className="link-btn"
                                                style={{color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)'}}
                                                title="Eliminar de la lista"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
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

