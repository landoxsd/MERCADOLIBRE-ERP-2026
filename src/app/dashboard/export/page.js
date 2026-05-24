"use client";

import { useState, useEffect } from "react";
import { Download, Database, Layers, CheckSquare, Square, Loader2, FileJson, FileSpreadsheet, AlertTriangle, Users } from "lucide-react";

export default function ExportPage() {
    const [sessions, setSessions] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [loadingSessions, setLoadingSessions] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState(null);

    // Cargar sesiones al inicio
    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        setLoadingSessions(true);
        setError(null);
        try {
            const res = await fetch("/api/tools/sniper/seller/history");
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error cargando sesiones");
            setSessions(data.sessions || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingSessions(false);
        }
    };

    const toggleSelection = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const selectAll = () => {
        if (selectedIds.size === sessions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(sessions.map(s => s.id)));
        }
    };

    const handleExport = async (format = 'csv') => {
        if (selectedIds.size === 0) return;
        setExporting(true);
        setError(null);

        try {
            const res = await fetch("/api/tools/export/combined", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_ids: Array.from(selectedIds) })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error en exportación combinada");

            const items = data.items;

            if (format === 'json') {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                triggerDownload(blob, `export_maestro_${selectedIds.size}_sellers.json`);
            } else {
                // Formato CSV Enriquecido
                const headers = [
                    "ID MercadoLibre",
                    "SKU",
                    "Título",
                    "Vendedor",
                    "Categoría",
                    "Precio USD",
                    "Unidades Vendidas",
                    "Ingresos Estimados USD",
                    "Visitas",
                    "Salud %",
                    "Envío Gratis",
                    "Enlace"
                ];

                const rows = items.map(i => [
                    i.ml_item_id,
                    i.sku || "",
                    `"${(i.title || "").replace(/"/g, '""')}"`,
                    i.seller_nickname,
                    i.category_name || i.category_id,
                    i.price_usd || 0,
                    i.sold_quantity || 0,
                    i.revenue_usd || 0,
                    i.visits || 0,
                    i.health_score || 0,
                    i.has_free_shipping ? "Si" : "No",
                    i.permalink || ""
                ]);

                const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
                const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
                triggerDownload(blob, `export_maestro_${selectedIds.size}_sellers.csv`);
            }
            
            // Refrescar selección
            setSelectedIds(new Set());
        } catch (err) {
            setError(err.message);
        } finally {
            setExporting(false);
        }
    };

    const triggerDownload = (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const formatDate = (ds) => {
        return new Intl.DateTimeFormat('es-VE', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        }).format(new Date(ds));
    };

    // Calculate totals of selected sessions
    const selectedStats = {
        sellers: selectedIds.size,
        items: sessions.filter(s => selectedIds.has(s.id)).reduce((acc, s) => acc + (s.total_items || 0), 0),
        revenue: sessions.filter(s => selectedIds.has(s.id)).reduce((acc, s) => acc + (s.total_revenue_usd || 0), 0)
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 backdrop-blur-xl p-6 rounded-2xl flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Database className="text-blue-400" size={28} />
                        Big Data Export
                    </h1>
                    <p className="text-slate-400 mt-1 text-sm max-w-xl">
                        Combina múltiples análisis de Seller Spy en un único catálogo maestro deduplicado. 
                        Ideal para crear bases de datos masivas de competidores e inyectarlas en Power BI o Excel.
                    </p>
                </div>

                <div className="flex gap-3 shrink-0">
                    <button
                        onClick={() => handleExport('csv')}
                        disabled={selectedIds.size === 0 || exporting}
                        className="flex items-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/50 text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    >
                        {exporting ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}
                        Exportar CSV
                    </button>
                    <button
                        onClick={() => handleExport('json')}
                        disabled={selectedIds.size === 0 || exporting}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    >
                        {exporting ? <Loader2 size={18} className="animate-spin" /> : <FileJson size={18} />}
                        Exportar JSON RAW
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-900/20 border border-red-800/50 rounded-xl text-red-300 flex items-center gap-3">
                    <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Stats Sidebar */}
                <div className="space-y-4">
                    <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl">
                        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Layers size={14} />
                            Resumen de Selección
                        </h3>
                        
                        <div className="space-y-4">
                            <div className="flex justify-between items-end border-b border-slate-800 pb-3">
                                <div className="text-slate-400 text-sm">Sesiones (Vendedores)</div>
                                <div className="text-xl font-bold text-white">{selectedStats.sellers}</div>
                            </div>
                            <div className="flex justify-between items-end border-b border-slate-800 pb-3">
                                <div className="text-slate-400 text-sm">Ítems Estimados (Bruto)</div>
                                <div className="text-xl font-bold text-blue-400">{selectedStats.items.toLocaleString()}</div>
                            </div>
                            <div className="flex justify-between items-end">
                                <div className="text-slate-400 text-sm">Revenue Estimado</div>
                                <div className="text-xl font-bold text-emerald-400">${selectedStats.revenue >= 1000000 ? (selectedStats.revenue/1000000).toFixed(2)+'M' : (selectedStats.revenue/1000).toFixed(1)+'k'}</div>
                            </div>
                        </div>

                        <div className="mt-5 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 leading-relaxed">
                            💡 <strong>Nota:</strong> El sistema deduplicará automáticamente los productos (por ml_item_id) que aparezcan repetidos en múltiples escaneos. Se conservará la data del escaneo más reciente.
                        </div>
                    </div>
                </div>

                {/* Main Table */}
                <div className="md:col-span-2 bg-slate-900/30 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                            <button 
                                onClick={selectAll}
                                className="text-slate-400 hover:text-white transition-colors focus:outline-none"
                            >
                                {selectedIds.size === sessions.length && sessions.length > 0 ? <CheckSquare size={18} className="text-blue-500" /> : <Square size={18} />}
                            </button>
                            <span>Seleccionar Todos ({sessions.length} disponibles)</span>
                        </div>
                        <button onClick={fetchSessions} className="text-xs text-blue-400 hover:text-blue-300">
                            🔄 Actualizar Lista
                        </button>
                    </div>

                    <div className="overflow-y-auto max-h-[600px] flex-1">
                        {loadingSessions ? (
                            <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                                <Loader2 size={32} className="animate-spin mb-4 text-blue-500" />
                                <span>Cargando sesiones históricas...</span>
                            </div>
                        ) : sessions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 text-slate-500 text-center">
                                <Users size={48} className="mb-4 opacity-20" />
                                <h3 className="text-lg font-medium text-slate-300 mb-1">Sin historial de espionaje</h3>
                                <p className="text-sm max-w-sm">No tienes ninguna sesión guardada. Ve a Seller Spy y escanea al menos a un competidor para generar datos exportables.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-900/80 text-xs text-slate-400 sticky top-0 backdrop-blur-md">
                                    <tr>
                                        <th className="p-3 w-10 text-center"></th>
                                        <th className="p-3">Vendedor</th>
                                        <th className="p-3 text-right">Ítems</th>
                                        <th className="p-3 text-right">Rev. Mensual</th>
                                        <th className="p-3 text-right">Fecha Escaneo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {sessions.map(s => {
                                        const isSelected = selectedIds.has(s.id);
                                        return (
                                            <tr 
                                                key={s.id} 
                                                onClick={() => toggleSelection(s.id)}
                                                className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-500/10 hover:bg-blue-500/20' : 'hover:bg-slate-800/50'}`}
                                            >
                                                <td className="p-3 text-center">
                                                    {isSelected ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} className="text-slate-600" />}
                                                </td>
                                                <td className="p-3 font-medium text-slate-200">
                                                    {s.seller_nickname}
                                                </td>
                                                <td className="p-3 text-right text-slate-400 font-mono">
                                                    {s.total_items}
                                                </td>
                                                <td className="p-3 text-right text-emerald-400/90 font-mono">
                                                    ${(s.total_revenue_usd || 0) >= 1000 ? ((s.total_revenue_usd || 0)/1000).toFixed(1)+'k' : s.total_revenue_usd}
                                                </td>
                                                <td className="p-3 text-right text-slate-500 text-xs">
                                                    {formatDate(s.scanned_at)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
