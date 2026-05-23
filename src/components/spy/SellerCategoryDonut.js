'use client';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#ef4444", "#3b82f6", "#84cc16"];

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const d = payload[0];
        return (
            <div style={{
                background: "rgba(15,23,42,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "13px",
                color: "#e2e8f0",
            }}>
                <p style={{ fontWeight: 700, color: d.payload.fill }}>{d.name}</p>
                <p>Ingresos: <strong>${Number(d.value).toLocaleString("es-VE", { minimumFractionDigits: 2 })}</strong></p>
                <p>Participación: <strong>{d.payload.pct}%</strong></p>
            </div>
        );
    }
    return null;
};

/**
 * SellerCategoryDonut — Distribución de ingresos por categoría
 */
export default function SellerCategoryDonut({ session }) {
    if (!session?.categories_json || session.categories_json.length === 0) return null;

    const totalRevenue = session.total_revenue_usd || 1;
    const data = session.categories_json.slice(0, 8).map(cat => ({
        name: cat.name,
        value: cat.revenue,
        pct: ((cat.revenue / totalRevenue) * 100).toFixed(1),
    }));

    return (
        <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "16px",
            padding: "20px",
        }}>
            <h3 style={{ color: "#e2e8f0", fontSize: "14px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🍩</span> Ingresos por Categoría
            </h3>
            <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        formatter={(value) => (
                            <span style={{ color: "#94a3b8", fontSize: "12px" }}>{value}</span>
                        )}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
