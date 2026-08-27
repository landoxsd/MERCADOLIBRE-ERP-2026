"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, History, ChevronRight, UserX, Loader2, AlertTriangle, Info, Trash2, Star, TrendingUp } from "lucide-react";

export default function SellerSpyLandingPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [searchInput, setSearchInput] = useState("");
    const [history, setHistory] = useState([]);
    const [watchlist, setWatchlist] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [loadingWatchlist, setLoadingWatchlist] = useState(true);
    const [resolving, setResolving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [activeTab, setActiveTab] = useState("history"); // 'history' | 'watchlist'
    const [error, setError] = useState(null);
    const [accountId, setAccountId] = useState(null);
    const hasAutoSearched = useRef(false);

    // Cargar cuenta activa del cookie
    useEffect(() => {
        const match = document.cookie.match(/meli_erp_account=([^;]+)/);
        if (match) setAccountId(match[1]);
    }, []);

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await fetch("/api/tools/sniper/seller/history");
            const data = await res.json();
            if (res.ok) setHistory(data.sessions || []);
        } catch (err) {
            console.error("Error al cargar historial:", err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const fetchWatchlist = async () => {
        setLoadingWatchlist(true);
        try {
            const res = await fetch("/api/tools/sniper/watchlist");
            const data = await res.json();
            if (res.ok) setWatchlist(data.watchlist || []);
        } catch (err) {
            console.error("Error al cargar watchlist:", err);
        } finally {
            setLoadingWatchlist(false);
        }
    };

    useEffect(() => {
        if (activeTab === "history") fetchHistory();
        else fetchWatchlist();
    }, [activeTab]);

    // Auto-search si venimos de otra página con ?query=
    useEffect(() => {
        const queryParam = searchParams.get("query");
        if (queryParam && !hasAutoSearched.current) {
            hasAutoSearched.current = true;
            setSearchInput(queryParam);
            performSearch(queryParam);
        }
    }, [searchParams]);

    const handleDeleteHistory = async () => {
        if (!confirm("¿Estás seguro de que quieres borrar todo el historial de búsquedas de Seller Spy? Esta acción no se puede deshacer.")) return;
        
        setDeleting(true);
        try {
            const res = await fetch("/api/tools/sniper/seller/history", { method: "DELETE" });
            if (res.ok) {
                setHistory([]);
            } else {
                const data = await res.json();
                setError(data.error || "Error al borrar el historial");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setDeleting(false);
        }
    };

    const performSearch = async (queryParam) => {
        const query = queryParam || searchInput.trim();
        if (!query) return;

        setResolving(true);
        setError(null);

        try {
            const res = await fetch("/api/tools/sniper/resolve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, accountId })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "No pudimos resolver tu búsqueda.");

            // Si se resolvió el seller_id, navegar al dashboard de espionaje del vendedor
            router.push(`/dashboard/spy/${data.seller_id}`);
        } catch (err) {
            setError(err.message);
            setResolving(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        performSearch();
    };
    const formatDate = (ds) => {
        return new Intl.DateTimeFormat('es-VE', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        }).format(new Date(ds));
    };

    return (
        <div className="dashboard-wrapper">
            {/* Cabecera Premium */}
            <div className="dashboard-title-container">
                <h1 className="dashboard-title">
                    <span>🕵️</span> Seller Spy
                </h1>
                <p className="dashboard-subtitle">
                    Realiza un escaneo de rayos X completo al catálogo de cualquier competidor en Mercado Libre Venezuela.
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
                <form onSubmit={handleSearch} className="search-panel-row">
                    <div className="search-input-group">
                        <div className="search-input-label-row">
                            <div className="search-input-icon-bg icon-cyan">
                                <Search size={12} />
                            </div>
                            <span className="search-input-label">Buscador Inteligente de Vendedor</span>
                        </div>
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Pega un link de producto, código de publicación (MLV-...) o el nombre del competidor"
                            className="input-glass"
                            disabled={resolving}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={!searchInput.trim() || resolving}
                        className="btn-glow"
                    >
                        {resolving ? (
                            <>
                                <Loader2 className="animate-spin" size={16} />
                                Resolviendo...
                            </>
                        ) : (
                            "Espiar Competidor"
                        )}
                    </button>
                </form>

                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 flex items-start gap-2 leading-relaxed">
                    <Info size={14} className="mt-0.5 shrink-0" />
                    <span>
                        💡 <strong>Soporte Multi-Entrada:</strong> Puedes buscar pegando el link directo de cualquier publicación de tu competidor, escribiendo su código de publicación (ej: <code>MLV736485960</code>), su nombre/nickname de usuario, o su ID numérico si ya lo conoces.
                    </span>
                </div>
            </div>

            {/* Tabs Selector (Inline styles para robustez) */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <button 
                    onClick={() => setActiveTab("history")}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', fontWeight: 600, fontSize: '14px',
                        color: activeTab === "history" ? '#60a5fa' : '#94a3b8',
                        borderBottom: activeTab === "history" ? '2px solid #3b82f6' : '2px solid transparent',
                        transition: 'all 0.2s', cursor: 'pointer', background: 'transparent'
                    }}
                >
                    <History size={16} />
                    Historial Reciente
                </button>
                <button 
                    onClick={() => setActiveTab("watchlist")}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', fontWeight: 600, fontSize: '14px',
                        color: activeTab === "watchlist" ? '#facc15' : '#94a3b8',
                        borderBottom: activeTab === "watchlist" ? '2px solid #eab308' : '2px solid transparent',
                        transition: 'all 0.2s', cursor: 'pointer', background: 'transparent'
                    }}
                >
                    <Star size={16} fill={activeTab === "watchlist" ? "#facc15" : "transparent"} />
                    Directorio Watchlist
                </button>
            </div>

            {/* Content Area */}
            <div className="space-y-4 max-w-4xl">
                {activeTab === "history" && (
                    <>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-slate-300 font-bold flex items-center gap-2 text-sm uppercase tracking-wider">
                                Sesiones Anteriores
                            </h3>
                            {history.length > 0 && (
                                <button 
                                    onClick={handleDeleteHistory}
                                    disabled={deleting}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors text-xs font-semibold"
                                >
                                    {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                    {deleting ? "Borrando..." : "Borrar Búsquedas"}
                                </button>
                            )}
                        </div>

                {loadingHistory ? (
                    <div className="flex flex-col items-center justify-center p-12 text-slate-500 bg-slate-900/20 border border-slate-800 rounded-2xl">
                        <Loader2 size={32} className="animate-spin mb-4 text-blue-500" />
                        <span className="text-sm">Cargando historial de espionaje...</span>
                    </div>
                ) : history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-slate-500 bg-slate-900/20 border border-slate-800 rounded-2xl text-center">
                        <UserX size={40} className="mb-4 opacity-20 text-slate-400" />
                        <h4 className="text-slate-300 font-semibold mb-1">Sin escaneos activos</h4>
                        <p className="text-xs text-slate-500 max-w-sm">No has espiado a ningún competidor todavía. Introduce un término arriba para realizar el primer análisis.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                        {history.slice(0, 6).map((session) => (
                            <div
                                key={session.id}
                                onClick={() => router.push(`/dashboard/spy/${session.seller_id}`)}
                                className="glass-card group"
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                                    cursor: 'pointer', padding: '16px', borderRadius: '16px', transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '12px',
                                        background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(59,130,246,0.2))',
                                        border: '1px solid rgba(6,182,212,0.3)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#22d3ee', fontWeight: 'bold', fontSize: '14px'
                                    }}>
                                        {session.seller_nickname ? session.seller_nickname.substring(0, 2).toUpperCase() : "🕵️"}
                                    </div>
                                    <div>
                                        <h4 style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px', margin: 0 }}>
                                            {session.seller_nickname}
                                        </h4>
                                        <p style={{ fontSize: '10px', color: '#64748b', margin: '2px 0 0 0' }}>
                                            {formatDate(session.scanned_at)}
                                        </p>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600, color: '#cbd5e1' }}>
                                            {session.total_items} ítems
                                        </div>
                                        <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#34d399', marginTop: '2px' }}>
                                            ${(session.total_revenue_usd || 0) >= 1000 ? ((session.total_revenue_usd || 0) / 1000).toFixed(1) + "k" : session.total_revenue_usd} USD
                                        </div>
                                    </div>
                                    <ChevronRight size={16} color="#475569" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                    </>
                )}

                {activeTab === "watchlist" && (
                    <>
                        {loadingWatchlist ? (
                            <div className="flex flex-col items-center justify-center p-12 text-slate-500 bg-slate-900/20 border border-slate-800 rounded-2xl">
                                <Loader2 size={32} className="animate-spin mb-4 text-yellow-500" />
                                <span className="text-sm">Cargando directorio...</span>
                            </div>
                        ) : watchlist.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 text-slate-500 bg-slate-900/20 border border-slate-800 rounded-2xl text-center">
                                <Star size={40} className="mb-4 opacity-20 text-slate-400" />
                                <h4 className="text-slate-300 font-semibold mb-1">Directorio Vacío</h4>
                                <p className="text-xs text-slate-500 max-w-sm">No has guardado a ningún competidor. Al escanear a alguien, presiona la estrella ⭐ en la parte superior para agregarlo aquí y seguir su evolución.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                                {watchlist.map((seller) => {
                                    const snap = seller.last_snapshot || {};
                                    return (
                                        <div
                                            key={seller.id}
                                            onClick={() => router.push(`/dashboard/spy/${seller.seller_id}`)}
                                            className="glass-card group"
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                cursor: 'pointer', borderLeft: '4px solid #eab308', padding: '20px',
                                                borderRadius: '16px', transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '33%' }}>
                                                <div style={{
                                                    width: '48px', height: '48px', borderRadius: '12px',
                                                    background: 'linear-gradient(135deg, rgba(234,179,8,0.2), rgba(249,115,22,0.2))',
                                                    border: '1px solid rgba(234,179,8,0.3)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: '#facc15', fontWeight: 'bold', fontSize: '18px',
                                                    boxShadow: '0 0 15px rgba(234,179,8,0.1)'
                                                }}>
                                                    {seller.seller_nickname ? seller.seller_nickname.substring(0, 2).toUpperCase() : "🕵️"}
                                                </div>
                                                <div>
                                                    <h4 style={{ fontWeight: 'bold', color: '#fff', fontSize: '16px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {seller.seller_nickname}
                                                        {snap.power_seller_status && (
                                                            <span style={{ padding: '2px 8px', borderRadius: '999px', background: 'rgba(59,130,246,0.2)', color: '#60a5fa', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                                                                {snap.power_seller_status}
                                                            </span>
                                                        )}
                                                    </h4>
                                                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {seller.notes || "Sin notas adicionales."}
                                                    </p>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', width: '66%', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '24px' }}>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Total Ítems</div>
                                                    <div style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#e2e8f0', fontSize: '18px' }}>{snap.total_items || 0}</div>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Ventas Estimadas</div>
                                                    <div style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#34d399', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                                                        <TrendingUp size={14} opacity={0.7} />
                                                        ${(snap.total_revenue_usd || 0).toLocaleString('en-US')}
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Último Escaneo</div>
                                                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{formatDate(snap.scanned_at || seller.updated_at)}</div>
                                                </div>
                                                <ChevronRight size={20} color="#475569" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
