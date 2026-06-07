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
    const hasAutoSearched = useRef(false);

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
                body: JSON.stringify({ query })
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

            {/* Tabs Selector */}
            <div className="flex items-center gap-2 mb-6 border-b border-slate-800">
                <button 
                    onClick={() => setActiveTab("history")}
                    className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === "history" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-300"}`}
                >
                    <History size={16} />
                    Historial Reciente
                </button>
                <button 
                    onClick={() => setActiveTab("watchlist")}
                    className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === "watchlist" ? "border-yellow-500 text-yellow-400" : "border-transparent text-slate-400 hover:text-slate-300"}`}
                >
                    <Star size={16} className={activeTab === "watchlist" ? "fill-yellow-500" : ""} />
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {history.slice(0, 6).map((session) => (
                            <div
                                key={session.id}
                                onClick={() => router.push(`/dashboard/spy/${session.seller_id}`)}
                                className="glass-card flex items-center justify-between cursor-pointer hover:border-cyan-500/40 hover:-translate-y-1 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-sm">
                                        {session.seller_nickname ? session.seller_nickname.substring(0, 2).toUpperCase() : "🕵️"}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-sm group-hover:text-cyan-400 transition-colors">
                                            {session.seller_nickname}
                                        </h4>
                                        <p className="text-[10px] text-slate-500 mt-0.5">
                                            {formatDate(session.scanned_at)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <div className="text-xs font-mono font-semibold text-slate-300">
                                            {session.total_items} ítems
                                        </div>
                                        <div className="text-[10px] font-mono text-emerald-400 mt-0.5">
                                            ${(session.total_revenue_usd || 0) >= 1000 ? ((session.total_revenue_usd || 0) / 1000).toFixed(1) + "k" : session.total_revenue_usd} USD
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-600 group-hover:text-cyan-400 transition-colors" />
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
                            <div className="grid grid-cols-1 gap-4">
                                {watchlist.map((seller) => {
                                    const snap = seller.last_snapshot || {};
                                    return (
                                        <div
                                            key={seller.id}
                                            onClick={() => router.push(`/dashboard/spy/${seller.seller_id}`)}
                                            className="glass-card flex items-center justify-between cursor-pointer border-l-4 border-l-yellow-500 hover:border-yellow-500/40 hover:-translate-y-1 transition-all group p-5"
                                        >
                                            <div className="flex items-center gap-4 w-1/3">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 flex items-center justify-center text-yellow-400 font-bold text-lg shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                                                    {seller.seller_nickname ? seller.seller_nickname.substring(0, 2).toUpperCase() : "🕵️"}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-white text-base group-hover:text-yellow-400 transition-colors flex items-center gap-2">
                                                        {seller.seller_nickname}
                                                        {snap.power_seller_status && (
                                                            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[9px] uppercase tracking-wider font-bold">
                                                                {snap.power_seller_status}
                                                            </span>
                                                        )}
                                                    </h4>
                                                    <p className="text-xs text-slate-400 mt-1 line-clamp-1 italic">
                                                        {seller.notes || "Sin notas adicionales."}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-around w-2/3 border-l border-slate-800/50 pl-6">
                                                <div className="text-center">
                                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Total Ítems</div>
                                                    <div className="font-mono font-bold text-slate-200 text-lg">{snap.total_items || 0}</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Ventas Estimadas</div>
                                                    <div className="font-mono font-bold text-emerald-400 text-lg flex items-center gap-1">
                                                        <TrendingUp size={14} className="opacity-70"/>
                                                        ${(snap.total_revenue_usd || 0).toLocaleString('en-US')}
                                                    </div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Último Escaneo</div>
                                                    <div className="text-xs text-slate-400 mt-1">{formatDate(snap.scanned_at || seller.updated_at)}</div>
                                                </div>
                                                <ChevronRight size={20} className="text-slate-600 group-hover:text-yellow-400 transition-colors" />
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
