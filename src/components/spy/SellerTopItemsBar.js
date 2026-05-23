'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const d = payload[0].payload;
        return (
            <div style={{
                background: "rgba(15,23,42,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "12px",
                color: "#e2e8f0",
                maxWidth: "220px",
            }}>
                <p style={{ fontWeight: 700, color: "#06b6d4", marginBottom: "4px", lineHeight: "1.3" }}>{d.fullTitle}</p>
                <p>💰 Ingresos: <strong>${Number(d.revenue).toLocaleString("es-VE", { minimumFractionDigits: 2 })}</strong></p>
                <p>📦 Vendidas: <strong>{d.sold?.toLocaleString("es-VE")}</strong></p>
                <p>📊 Market Share: <strong>{d.share}%</strong></p>
            </div>
        );
    }
    return null;
};

/**
 * SellerTopItemsBar — Top 10 productos por ingresos (barras horizontales)
 */
export default function SellerTopItemsBar({ items }) {
    if (!items || items.length === 0) return null;

    const top10 = items.slice(0, 10).map((item, i) => ({
        name: item.title?.length > 30 ? item.title.substring(0, 30) + "…" : item.title,
        fullTitle: item.title,
        revenue: item.revenue_usd,
        sold: item.sold_quantity,
        share: item.market_share_pct,
        rank: i + 1,
    }));

    return (
        <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "16px",
            padding: "20px",
        }}>
            <h3 style={{ color: "#e2e8f0", fontSize: "14px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🏆</span> Top 10 Productos por Ingresos
            </h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={top10} layout="vertical" margin={{ left: 0, right: 60 }}>
                    <XAxis type="number" hide />
                    <YAxis
                        type="category"
                        dataKey="name"
                        width={180}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                        {top10.map((_, i) => (
                            <Cell key={i} fill={i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7f32" : "#06b6d4"} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
