'use client';
import { useState, useMemo } from "react";
import { ExternalLink, Download, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

function MarketShareBar({ pct }) {
    const color = pct > 30 ? "#ef4444" : pct > 15 ? "#f59e0b" : "#10b981";
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{
                flex: 1,
                height: "6px",
                background: "rgba(255,255,255,0.08)",
                borderRadius: "999px",
                overflow: "hidden",
            }}>
                <div style={{
                    width: `${Math.min(pct, 100)}%`,
                    height: "100%",
                    background: color,
                    borderRadius: "999px",
                }} />
            </div>
            <span style={{ fontSize: "11px", color, fontWeight: 600, minWidth: "38px" }}>{pct?.toFixed(1)}%</span>
        </div>
    );
}

function SortIcon({ col, sortConfig }) {
    if (sortConfig.key !== col) return <ArrowUpDown size={12} style={{ opacity: 0.3 }} />;
    return sortConfig.dir === "desc"
        ? <ArrowDown size={12} style={{ color: "#06b6d4" }} />
        : <ArrowUp size={12} style={{ color: "#06b6d4" }} />;
}

/**
 * SellerCatalogTable — Tabla completa del catálogo del competidor
 */
export default function SellerCatalogTable({ items, sellerNickname }) {
    const [search, setSearch] = useState("");
    const [filterFreeShip, setFilterFreeShip] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: "revenue_usd", dir: "desc" });
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 25;

    const toggleSort = (key) => {
        setSortConfig(prev => ({
            key,
            dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc",
        }));
        setPage(1);
    };

    const filtered = useMemo(() => {
        let result = items || [];
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(i =>
                i.title?.toLowerCase().includes(q) ||
                i.sku?.toLowerCase().includes(q) ||
                i.brand?.toLowerCase().includes(q)
            );
        }
        if (filterFreeShip) result = result.filter(i => i.has_free_shipping);

        result = [...result].sort((a, b) => {
            const av = a[sortConfig.key] ?? 0;
            const bv = b[sortConfig.key] ?? 0;
            return sortConfig.dir === "desc" ? bv - av : av - bv;
        });
        return result;
    }, [items, search, filterFreeShip, sortConfig]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const exportCsv = () => {
        const uniqueAttrs = new Set();
        filtered.forEach(item => {
            (item.attributes_raw || []).forEach(a => { if (a.name) uniqueAttrs.add(a.name); });
        });
        const attrHeaders = Array.from(uniqueAttrs).sort();

        const header = ["#", "Título", "SKU", "Marca", "Categoría", "Precio $", "Ventas", "Visitas", "Conversión %", "Market Share %", "Envío Gratis", "Salud", "URL", ...attrHeaders.map(a => `Attr: ${a}`)];
        const rows = filtered.map((item, i) => {
            const attrValues = attrHeaders.map(attrName => {
                const found = (item.attributes_raw || []).find(a => a.name === attrName);
                return found?.value_name || "N/A";
            });
            return [
                i + 1,
                item.title,
                item.sku || "—",
                item.brand || "—",
                item.category_name || "—",
                item.price_usd?.toFixed(2) || "0",
                item.sold_quantity || 0,
                item.visits || 0,
                item.conversion_rate ? (item.conversion_rate * 100).toFixed(2) : "0",
                item.market_share_pct?.toFixed(2) || "0",
                item.has_free_shipping ? "Sí" : "No",
                item.health_score?.toFixed(0) || "—",
                item.permalink || "",
                ...attrValues,
            ];
        });

        const csv = [header, ...rows]
            .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
            .join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Spy_${sellerNickname || "competidor"}_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
    };

    const colStyle = (key) => ({
        padding: "10px 12px",
        textAlign: "left",
        fontSize: "11px",
        fontWeight: 600,
        color: "#64748b",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
    });

    return (
        <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "16px",
            padding: "20px",
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                <h3 style={{ color: "#e2e8f0", fontSize: "14px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                    <span>🏆</span> Catálogo Completo
                    <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 400 }}>({filtered.length} productos)</span>
                </h3>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    {/* Search */}
                    <div style={{ position: "relative" }}>
                        <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                        <input
                            placeholder="Buscar título, SKU..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            style={{
                                background: "rgba(255,255,255,0.06)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "8px",
                                padding: "7px 12px 7px 32px",
                                color: "#e2e8f0",
                                fontSize: "13px",
                                width: "200px",
                                outline: "none",
                            }}
                        />
                    </div>
                    {/* Free shipping filter */}
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "12px", color: "#94a3b8" }}>
                        <input
                            type="checkbox"
                            checked={filterFreeShip}
                            onChange={e => { setFilterFreeShip(e.target.checked); setPage(1); }}
                            style={{ accentColor: "#10b981" }}
                        />
                        🚚 Envío Gratis
                    </label>
                    {/* Export */}
                    <button
                        onClick={exportCsv}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            background: "rgba(16,185,129,0.15)",
                            border: "1px solid rgba(16,185,129,0.4)",
                            borderRadius: "8px",
                            padding: "7px 12px",
                            color: "#10b981",
                            fontSize: "12px",
                            cursor: "pointer",
                            fontWeight: 600,
                        }}
                    >
                        <Download size={13} /> CSV
                    </button>
                </div>
            </div>

            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                        <tr>
                            <th style={colStyle()}>#</th>
                            <th style={colStyle()}>Foto</th>
                            <th style={colStyle("title")}>Título</th>
                            <th style={{ ...colStyle("price_usd"), cursor: "pointer" }} onClick={() => toggleSort("price_usd")}>
                                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>Precio <SortIcon col="price_usd" sortConfig={sortConfig} /></span>
                            </th>
                            <th style={colStyle("sold_quantity")} onClick={() => toggleSort("sold_quantity")}>
                                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>Ventas <SortIcon col="sold_quantity" sortConfig={sortConfig} /></span>
                            </th>
                            <th style={colStyle("visits")} onClick={() => toggleSort("visits")}>
                                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>Visitas <SortIcon col="visits" sortConfig={sortConfig} /></span>
                            </th>
                            <th style={colStyle()}>Conv %</th>
                            <th style={colStyle("revenue_usd")} onClick={() => toggleSort("revenue_usd")}>
                                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>Ingresos <SortIcon col="revenue_usd" sortConfig={sortConfig} /></span>
                            </th>
                            <th style={colStyle("market_share_pct")} onClick={() => toggleSort("market_share_pct")}>
                                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>Market Share <SortIcon col="market_share_pct" sortConfig={sortConfig} /></span>
                            </th>
                            <th style={colStyle()}>Logística</th>
                            <th style={colStyle()}>Enlace</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map((item, idx) => {
                            const globalRank = (page - 1) * PAGE_SIZE + idx + 1;
                            const convPct = item.conversion_rate ? (item.conversion_rate * 100).toFixed(1) : "0.0";
                            return (
                                <tr key={item.ml_item_id} style={{
                                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                                    transition: "background 0.15s",
                                }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                    <td style={{ padding: "10px 12px", color: "#64748b", fontSize: "12px" }}>
                                        {globalRank === 1 ? "🥇" : globalRank === 2 ? "🥈" : globalRank === 3 ? "🥉" : globalRank}
                                    </td>
                                    <td style={{ padding: "10px 12px" }}>
                                        {item.thumbnail ? (
                                            <img src={item.thumbnail} alt="" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)" }} />
                                        ) : (
                                            <div style={{ width: "40px", height: "40px", background: "rgba(255,255,255,0.06)", borderRadius: "6px" }} />
                                        )}
                                    </td>
                                    <td style={{ padding: "10px 12px", maxWidth: "240px" }}>
                                        <div style={{ color: "#e2e8f0", fontWeight: 500, fontSize: "12px", lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                            {item.title}
                                        </div>
                                        {item.brand && <span style={{ fontSize: "11px", color: "#64748b" }}>{item.brand}</span>}
                                    </td>
                                    <td style={{ padding: "10px 12px", color: "#10b981", fontWeight: 700 }}>
                                        ${Number(item.price_usd || 0).toFixed(2)}
                                    </td>
                                    <td style={{ padding: "10px 12px", color: "#f59e0b", fontWeight: 600 }}>
                                        {(item.sold_quantity || 0).toLocaleString("es-VE")}
                                    </td>
                                    <td style={{ padding: "10px 12px", color: "#94a3b8" }}>
                                        {(item.visits || 0).toLocaleString("es-VE")}
                                    </td>
                                    <td style={{ padding: "10px 12px", color: Number(convPct) > 5 ? "#10b981" : Number(convPct) > 2 ? "#f59e0b" : "#ef4444", fontWeight: 600 }}>
                                        {convPct}%
                                    </td>
                                    <td style={{ padding: "10px 12px", color: "#06b6d4", fontWeight: 700 }}>
                                        ${Number(item.revenue_usd || 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td style={{ padding: "10px 12px", minWidth: "120px" }}>
                                        <MarketShareBar pct={item.market_share_pct || 0} />
                                    </td>
                                    <td style={{ padding: "10px 12px", fontSize: "16px" }}>
                                        {item.has_free_shipping ? "🚚" : "💵"}
                                        {item.has_local_pickup ? " 📦" : ""}
                                    </td>
                                    <td style={{ padding: "10px 12px" }}>
                                        {item.permalink && (
                                            <a href={item.permalink} target="_blank" rel="noopener noreferrer"
                                                style={{ color: "#06b6d4", display: "flex", alignItems: "center" }}>
                                                <ExternalLink size={14} />
                                            </a>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", marginTop: "16px", flexWrap: "wrap" }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        style={{ padding: "6px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: page === 1 ? "#475569" : "#e2e8f0", cursor: page === 1 ? "default" : "pointer" }}>
                        ← Ant
                    </button>
                    <span style={{ fontSize: "13px", color: "#64748b" }}>
                        Pág. <strong style={{ color: "#e2e8f0" }}>{page}</strong> de {totalPages}
                    </span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        style={{ padding: "6px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: page === totalPages ? "#475569" : "#e2e8f0", cursor: page === totalPages ? "default" : "pointer" }}>
                        Sig →
                    </button>
                </div>
            )}
        </div>
    );
}
