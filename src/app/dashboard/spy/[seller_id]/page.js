'use client';
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { RefreshCw, Download, ArrowLeft, Clock, AlertCircle } from "lucide-react";

import SellerKpiBar from "@/components/spy/SellerKpiBar";
import SellerCategoryDonut from "@/components/spy/SellerCategoryDonut";
import SellerTopItemsBar from "@/components/spy/SellerTopItemsBar";
import SellerLogisticsMatrix from "@/components/spy/SellerLogisticsMatrix";
import SellerCatalogTable from "@/components/spy/SellerCatalogTable";
import SellerVsMyAccountPanel from "@/components/spy/SellerVsMyAccountPanel";

export default function SellerSpyPage() {
    const params = useParams();
    const router = useRouter();
    const sellerId = params?.seller_id;

    const [session, setSession] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState("");
    const [error, setError] = useState(null);
    const [history, setHistory] = useState([]);
    const [accountId, setAccountId] = useState("");
    const [cached, setCached] = useState(false);
    const [hydratingItems, setHydratingItems] = useState({});

    // ─── EFECTO DE HIDRATACIÓN PROGRESIVA ───
    useEffect(() => {
        if (!items || items.length === 0 || loading) return;

        // Buscar ítems que aún no han sido hidratados
        // Verificamos si no está en hydratingItems. Si ya se procesó (done o error), no se vuelve a intentar.
        // Asumimos que los que necesitan hidratarse son los que no tienen status en hydratingItems 
        // Y cuyo sold_quantity vino en 0 o undefined desde la lista inicial (asumiendo que la lista inicial no trae ventas)
        const pendingItems = items.filter(i => 
            (i.sold_quantity === 0 || i.sold_quantity == null) && 
            !hydratingItems[i.id]
        );
        if (pendingItems.length === 0) return;

        // Limitar la concurrencia a 2 (para no saturar Vercel/Playwright)
        const inFlight = Object.values(hydratingItems).filter(status => status === 'pending').length;
        if (inFlight >= 2) return;

        const toHydrate = pendingItems.slice(0, 2 - inFlight);

        if (toHydrate.length > 0) {
            setHydratingItems(prev => {
                const next = { ...prev };
                toHydrate.forEach(item => next[item.id] = 'pending');
                return next;
            });

            toHydrate.forEach(async (item) => {
                try {
                    const priceParam = item.price_usd || item.price || 0;
                    const res = await fetch(`/api/tools/sniper/item-detail?url=${encodeURIComponent(item.permalink)}&session_id=${session?.id || ''}&item_id=${item.ml_item_id || item.id}&price=${priceParam}`);
                    const data = await res.json();
                    
                    setItems(prevItems => {
                        return prevItems.map(prev => {
                            if (prev.id === item.id) {
                                const sold_quantity = data.sold_quantity || prev.sold_quantity || 0;
                                const category_name = data.category_name || prev.category_name;
                                const revenue_usd = sold_quantity * (prev.price_usd || prev.price || 0);
                                return { ...prev, sold_quantity, category_name, revenue_usd };
                            }
                            return prev;
                        });
                    });
                    
                    setHydratingItems(prev => ({ ...prev, [item.id]: 'done' }));
                } catch (err) {
                    console.error("Hydration error", err);
                    setHydratingItems(prev => ({ ...prev, [item.id]: 'error' }));
                }
            });
        }
    }, [items, hydratingItems, loading]);

    // ─── EFECTO PARA RECALCULAR TOTALES DINÁMICOS ───
    useEffect(() => {
        if (!items || items.length === 0) return;
        
        let totalRevenue = 0;
        let totalSold = 0;
        
        items.forEach(it => {
            totalSold += (it.sold_quantity || 0);
            totalRevenue += (it.revenue_usd || 0);
        });

        setSession(prev => {
            if (!prev) return prev;
            if (prev.total_revenue_usd === totalRevenue && prev.sold_quantity_total === totalSold) return prev;
            return {
                ...prev,
                total_revenue_usd: totalRevenue,
                sold_quantity_total: totalSold
            };
        });
    }, [items]);

    useEffect(() => {
        const match = document.cookie.match(/meli_erp_account=([^;]+)/);
        if (match) setAccountId(match[1]);
    }, []);

    const loadSpy = useCallback(async (forceRefresh = false) => {
        if (!sellerId) return;
        setLoading(true);
        setError(null);
        setLoadingMsg(forceRefresh ? "Iniciando escaneo completo del catálogo..." : "Verificando datos recientes...");

        try {
            // Polling con mensajes de progreso
            const progressMsgs = [
                "Paginando catálogo del vendedor...",
                "Enriqueciendo datos de publicaciones...",
                "Obteniendo visitas por producto...",
                "Calculando Market Share...",
                "Guardando en base de datos...",
            ];
            let msgIdx = 0;
            const msgInterval = setInterval(() => {
                msgIdx = (msgIdx + 1) % progressMsgs.length;
                setLoadingMsg(progressMsgs[msgIdx]);
            }, 3000);

            const res = await fetch("/api/tools/sniper/seller", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    seller_id: sellerId,
                    account_id: accountId,
                    force_refresh: forceRefresh,
                }),
            });

            clearInterval(msgInterval);
            const data = await res.json();

            if (!res.ok || data.error) throw new Error(data.error || "Error al escanear el vendedor");

            setSession(data.session);
            setItems(data.items || []);
            setCached(data.cached || false);
            setHydratingItems({}); // Reset hidratación
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setLoadingMsg("");
        }
    }, [sellerId, accountId]);

    const loadHistory = useCallback(async () => {
        if (!sellerId) return;
        try {
            const res = await fetch(`/api/tools/sniper/seller/history?seller_id=${sellerId}`);
            const data = await res.json();
            setHistory(data.sessions || []);
        } catch { /* silencioso */ }
    }, [sellerId]);

    useEffect(() => {
        loadSpy();
        loadHistory();
    }, [loadSpy, loadHistory]);

    const exportJson = () => {
        const blob = new Blob([JSON.stringify({ session, items }, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Spy_${session?.seller_nickname || sellerId}_${new Date().toISOString().split("T")[0]}.json`;
        a.click();
    };

    const getReputationBadge = (level) => {
        if (!level) return null;
        const badges = {
            platinum: { label: "Platinum", color: "#06b6d4", bg: "rgba(6,182,212,0.15)" },
            gold: { label: "Gold", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
            silver: { label: "Silver", color: "#94a3b8", bg: "rgba(148,163,184,0.15)" },
        };
        const b = badges[level] || { label: level, color: "#94a3b8", bg: "rgba(148,163,184,0.1)" };
        return (
            <span style={{ padding: "3px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: b.bg, color: b.color, border: `1px solid ${b.color}44` }}>
                ⭐ {b.label}
            </span>
        );
    };

    // Calcular progreso de hidratación
    const totalToHydrate = items?.length || 0;
    const hydratedCount = Object.keys(hydratingItems).filter(k => hydratingItems[k] === 'done' || hydratingItems[k] === 'error').length;
    const isHydrating = hydratedCount < totalToHydrate && items?.some(i => i.sold_quantity === 0 || i.sold_quantity == null);

    return (
        <div style={{
            minHeight: "100vh",
            background: "linear-gradient(135deg, #0a0f1e 0%, #0f172a 50%, #0a1628 100%)",
            padding: "24px",
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
        }}>
            {/* Back Button */}
            <button
                onClick={() => router.back()}
                style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px", padding: "8px 14px", color: "#94a3b8", cursor: "pointer",
                    fontSize: "13px", marginBottom: "24px", transition: "all 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "#e2e8f0"; e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
            >
                <ArrowLeft size={14} /> Volver
            </button>

            {/* Loading State */}
            {loading && (
                <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    padding: "80px 20px", gap: "20px",
                }}>
                    <div style={{
                        width: "60px", height: "60px",
                        border: "3px solid rgba(6,182,212,0.2)",
                        borderTop: "3px solid #06b6d4",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                    }} />
                    <p style={{ color: "#06b6d4", fontSize: "14px", fontWeight: 500 }}>{loadingMsg || "Cargando..."}</p>
                    <p style={{ color: "#475569", fontSize: "12px" }}>
                        Esto puede tomar 30–60 segundos dependiendo del tamaño del catálogo
                    </p>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            )}

            {/* Error State */}
            {!loading && error && (
                <div style={{
                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: "12px", padding: "20px", display: "flex", alignItems: "center", gap: "12px",
                }}>
                    <AlertCircle size={20} style={{ color: "#ef4444", flexShrink: 0 }} />
                    <div>
                        <p style={{ color: "#ef4444", fontWeight: 600, margin: 0 }}>Error al escanear el vendedor</p>
                        <p style={{ color: "#94a3b8", fontSize: "13px", margin: "4px 0 0" }}>{error}</p>
                    </div>
                </div>
            )}

            {/* Main Content */}
            {!loading && session && (
                <>
                    {/* ─── SECCIÓN 1: Header del Vendedor ─── */}
                    <div style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "16px",
                        padding: "24px",
                        marginBottom: "20px",
                        backdropFilter: "blur(10px)",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                                {/* Avatar */}
                                <div style={{
                                    width: "56px", height: "56px",
                                    background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                                    borderRadius: "50%",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "22px", fontWeight: 800, color: "white",
                                    flexShrink: 0,
                                }}>
                                    {(session.seller_nickname || "?")[0].toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                                        <h1 style={{ color: "#e2e8f0", fontSize: "22px", fontWeight: 800, margin: 0 }}>
                                            🕵️ {session.seller_nickname || sellerId}
                                        </h1>
                                        {getReputationBadge(session.seller_level)}
                                        {cached && (
                                            <span style={{ padding: "3px 10px", borderRadius: "999px", fontSize: "11px", background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
                                                ⚡ Cache
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                                        <Clock size={12} style={{ color: "#64748b" }} />
                                        <span style={{ fontSize: "12px", color: "#64748b" }}>
                                            Escaneado: {new Date(session.scanned_at).toLocaleString("es-VE")}
                                        </span>
                                    </div>
                                    {/* Historial */}
                                    {history.length > 1 && (
                                        <div style={{ marginTop: "8px", fontSize: "12px", color: "#64748b" }}>
                                            📅 {history.length} escaneos anteriores disponibles
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Botones de Acción */}
                            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                                {isHydrating && (
                                    <div style={{
                                        display: "flex", alignItems: "center", gap: "8px",
                                        background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
                                        borderRadius: "8px", padding: "8px 14px", color: "#f59e0b",
                                        fontSize: "12px", fontWeight: 600
                                    }}>
                                        <div style={{ width: "12px", height: "12px", border: "2px solid rgba(245,158,11,0.3)", borderTop: "2px solid #f59e0b", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                                        Buscando ventas ({hydratedCount}/{totalToHydrate})...
                                    </div>
                                )}
                                <button
                                    onClick={() => loadSpy(true)}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "6px",
                                        background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.4)",
                                        borderRadius: "8px", padding: "9px 16px", color: "#06b6d4",
                                        cursor: "pointer", fontSize: "13px", fontWeight: 600,
                                    }}
                                >
                                    <RefreshCw size={14} /> Actualizar
                                </button>
                                <button
                                    onClick={exportJson}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "6px",
                                        background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.4)",
                                        borderRadius: "8px", padding: "9px 16px", color: "#8b5cf6",
                                        cursor: "pointer", fontSize: "13px", fontWeight: 600,
                                    }}
                                >
                                    <Download size={14} /> JSON
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ─── SECCIÓN 2: KPI Bar ─── */}
                    <SellerKpiBar session={session} />

                    {/* ─── SECCIÓN 3: Gráficos ─── */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                        <SellerCategoryDonut session={session} />
                        <SellerTopItemsBar items={items} />
                    </div>

                    {/* ─── SECCIÓN 4: Logística + Comparativa ─── */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "16px", marginBottom: "20px" }}>
                        <SellerLogisticsMatrix session={session} />
                        <SellerVsMyAccountPanel session={session} mySession={null} />
                    </div>

                    {/* ─── SECCIÓN 5: Catálogo Completo ─── */}
                    <SellerCatalogTable items={items} sellerNickname={session.seller_nickname} />
                </>
            )}
        </div>
    );
}
