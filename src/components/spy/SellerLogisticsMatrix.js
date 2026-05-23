'use client';

function ProgressBar({ value, color, label, icon }) {
    const pct = Math.min(Math.max(value || 0, 0), 100);
    return (
        <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "13px", color: "#cbd5e1", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{icon}</span>{label}
                </span>
                <span style={{ fontSize: "14px", fontWeight: "700", color }}>{pct.toFixed(1)}%</span>
            </div>
            <div style={{
                background: "rgba(255,255,255,0.08)",
                borderRadius: "999px",
                height: "8px",
                overflow: "hidden",
            }}>
                <div style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: color,
                    borderRadius: "999px",
                    transition: "width 0.8s ease",
                    boxShadow: `0 0 8px ${color}66`,
                }} />
            </div>
        </div>
    );
}

/**
 * SellerLogisticsMatrix — % de catálogo con envío gratis, retiro, Gold, etc.
 */
export default function SellerLogisticsMatrix({ session, myStats = null }) {
    if (!session) return null;

    const metrics = [
        { label: "Envío Gratis", icon: "🚚", value: session.pct_free_shipping, color: "#10b981", myValue: myStats?.pct_free_shipping },
        { label: "Retiro en Tienda", icon: "📦", value: session.pct_local_pickup, color: "#06b6d4", myValue: myStats?.pct_local_pickup },
        { label: "Publicación Gold/Premium", icon: "🥇", value: session.pct_gold_listing, color: "#f59e0b", myValue: myStats?.pct_gold_listing },
    ];

    return (
        <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "16px",
            padding: "20px",
        }}>
            <h3 style={{ color: "#e2e8f0", fontSize: "14px", fontWeight: 600, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🚚</span> Matriz Logística del Catálogo
            </h3>

            {metrics.map((m, i) => (
                <div key={i}>
                    <ProgressBar value={m.value} color={m.color} label={m.label} icon={m.icon} />
                    {myStats && m.myValue !== undefined && (
                        <div style={{ marginTop: "-10px", marginBottom: "12px", paddingLeft: "24px" }}>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>
                                Mi cuenta: {Number(m.myValue || 0).toFixed(1)}%
                                {m.value > m.myValue ? (
                                    <span style={{ color: "#ef4444", marginLeft: "6px" }}>
                                        ↑ {(m.value - m.myValue).toFixed(1)}% más que tú
                                    </span>
                                ) : (
                                    <span style={{ color: "#10b981", marginLeft: "6px" }}>
                                        ✓ Estás por encima
                                    </span>
                                )}
                            </span>
                        </div>
                    )}
                </div>
            ))}

            {/* Resumen rápido */}
            <div style={{
                marginTop: "16px",
                padding: "12px",
                background: "rgba(6,182,212,0.08)",
                borderRadius: "8px",
                border: "1px solid rgba(6,182,212,0.2)",
            }}>
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
                    🧠 <strong style={{ color: "#06b6d4" }}>Insight:</strong>{" "}
                    {session.pct_free_shipping > 70
                        ? "Este vendedor usa envío gratis como arma principal. Considera igualarlo para competir."
                        : session.pct_free_shipping > 40
                        ? "Aproximadamente la mitad de su catálogo tiene envío gratis."
                        : "Pocos productos con envío gratis. Hay oportunidad de diferenciarte ofreciéndolo."}
                </p>
            </div>
        </div>
    );
}
