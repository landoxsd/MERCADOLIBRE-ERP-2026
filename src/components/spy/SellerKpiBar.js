'use client';

/**
 * SellerKpiBar — Tarjetas de KPIs del vendedor espiado
 */
export default function SellerKpiBar({ session }) {
    if (!session) return null;

    const kpis = [
        {
            label: "Ítems Activos",
            value: session.total_items?.toLocaleString("es-VE") ?? "—",
            icon: "📦",
            color: "#06b6d4",
        },
        {
            label: "Ingresos Estimados",
            value: session.total_revenue_usd
                ? `$${Number(session.total_revenue_usd).toLocaleString("es-VE", { minimumFractionDigits: 0 })}`
                : "—",
            icon: "💰",
            color: "#10b981",
        },
        {
            label: "Unidades Vendidas",
            value: session.total_sold_qty?.toLocaleString("es-VE") ?? "—",
            icon: "🏆",
            color: "#f59e0b",
        },
        {
            label: "Precio Promedio",
            value: session.avg_price
                ? `$${Number(session.avg_price).toFixed(2)}`
                : "—",
            icon: "🏷️",
            color: "#8b5cf6",
        },
        {
            label: "Conversión Global",
            value: session.avg_conversion
                ? `${(Number(session.avg_conversion) * 100).toFixed(1)}%`
                : "—",
            icon: "📈",
            color: "#ec4899",
        },
        {
            label: "Salud Promedio",
            value: session.avg_health
                ? `${Number(session.avg_health).toFixed(0)}%`
                : "—",
            icon: "❤️",
            color: "#ef4444",
        },
    ];

    return (
        <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "12px",
            marginBottom: "24px",
        }}>
            {kpis.map((kpi, i) => (
                <div key={i} style={{
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${kpi.color}33`,
                    borderRadius: "12px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    backdropFilter: "blur(10px)",
                    transition: "border-color 0.2s",
                }}>
                    <span style={{ fontSize: "22px" }}>{kpi.icon}</span>
                    <span style={{
                        fontSize: "22px",
                        fontWeight: "700",
                        color: kpi.color,
                        letterSpacing: "-0.5px",
                    }}>{kpi.value}</span>
                    <span style={{
                        fontSize: "11px",
                        color: "#94a3b8",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                    }}>{kpi.label}</span>
                </div>
            ))}
        </div>
    );
}
