'use client';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Legend, Tooltip } from "recharts";

function AlertBox({ type, children }) {
    const colors = {
        danger: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", icon: "🚨", textColor: "#ef4444" },
        warning: { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", icon: "⚠️", textColor: "#f59e0b" },
        success: { bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)", icon: "✅", textColor: "#10b981" },
    };
    const c = colors[type] || colors.warning;
    return (
        <div style={{
            background: c.bg, border: `1px solid ${c.border}`, borderRadius: "8px",
            padding: "10px 14px", marginBottom: "8px", fontSize: "12px", color: "#cbd5e1",
            display: "flex", gap: "8px", alignItems: "flex-start",
        }}>
            <span>{c.icon}</span>
            <span>{children}</span>
        </div>
    );
}

/**
 * SellerVsMyAccountPanel — Comparativa con la propia cuenta (si está conectada)
 */
export default function SellerVsMyAccountPanel({ session, mySession }) {
    if (!session) return null;

    // Generar insights automáticos comparativos
    const insights = [];
    if (mySession) {
        const convDiff = ((session.avg_conversion || 0) - (mySession.avg_conversion || 0)) * 100;
        const priceDiff = ((session.avg_price || 0) - (mySession.avg_price || 0));
        const healthDiff = (session.avg_health || 0) - (mySession.avg_health || 0);
        const fsDiff = (session.pct_free_shipping || 0) - (mySession.pct_free_shipping || 0);

        if (convDiff > 2) insights.push({ type: "danger", msg: `Su conversión es ${convDiff.toFixed(1)}% mayor que la tuya. Revisa tus fotos, precio y descripción.` });
        else if (convDiff < -1) insights.push({ type: "success", msg: `Tu conversión supera a la del competidor en ${Math.abs(convDiff).toFixed(1)}%. ¡Buen trabajo!` });

        if (fsDiff > 20) insights.push({ type: "warning", msg: `Tiene un ${fsDiff.toFixed(0)}% más de su catálogo con envío gratis. Considera ofrecerlo en más productos.` });
        if (healthDiff > 10) insights.push({ type: "warning", msg: `La salud promedio de sus publicaciones es ${healthDiff.toFixed(0)} puntos mejor que la tuya.` });
        if (priceDiff > 0) insights.push({ type: "success", msg: `Su precio promedio ($${session.avg_price?.toFixed(2)}) es mayor al tuyo ($${mySession.avg_price?.toFixed(2)}). Hay margen para subir precios.` });
    }

    // Datos del Radar Chart (normalizado sobre 100)
    const radarData = [
        { subject: "Precio", them: Math.min((session.avg_price || 0) / 5, 100), me: mySession ? Math.min((mySession.avg_price || 0) / 5, 100) : 0 },
        { subject: "Salud", them: session.avg_health || 0, me: mySession?.avg_health || 0 },
        { subject: "Conversión", them: Math.min((session.avg_conversion || 0) * 1000, 100), me: mySession ? Math.min((mySession.avg_conversion || 0) * 1000, 100) : 0 },
        { subject: "Envío Gratis", them: session.pct_free_shipping || 0, me: mySession?.pct_free_shipping || 0 },
        { subject: "Variedad", them: Math.min((session.total_items || 0) / 5, 100), me: mySession ? Math.min((mySession.total_items || 0) / 5, 100) : 0 },
        { subject: "Gold %", them: session.pct_gold_listing || 0, me: mySession?.pct_gold_listing || 0 },
    ];

    const cols = [
        { label: "Conversión Global", them: `${((session.avg_conversion || 0) * 100).toFixed(2)}%`, me: mySession ? `${((mySession.avg_conversion || 0) * 100).toFixed(2)}%` : "—" },
        { label: "Precio Promedio", them: `$${Number(session.avg_price || 0).toFixed(2)}`, me: mySession ? `$${Number(mySession.avg_price || 0).toFixed(2)}` : "—" },
        { label: "Salud Promedio", them: `${Number(session.avg_health || 0).toFixed(0)}%`, me: mySession ? `${Number(mySession.avg_health || 0).toFixed(0)}%` : "—" },
        { label: "Envío Gratis", them: `${Number(session.pct_free_shipping || 0).toFixed(1)}%`, me: mySession ? `${Number(mySession.pct_free_shipping || 0).toFixed(1)}%` : "—" },
        { label: "Ítems Activos", them: session.total_items?.toLocaleString("es-VE") || "—", me: mySession?.total_items?.toLocaleString("es-VE") || "—" },
    ];

    return (
        <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "16px",
            padding: "20px",
        }}>
            <h3 style={{ color: "#e2e8f0", fontSize: "14px", fontWeight: 600, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>⚔️</span> Comparativa: Competidor vs Mi Cuenta
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                {/* Tabla comparativa */}
                <div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                        <thead>
                            <tr>
                                <th style={{ padding: "8px 10px", textAlign: "left", fontSize: "11px", color: "#64748b", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Métrica</th>
                                <th style={{ padding: "8px 10px", textAlign: "center", fontSize: "11px", color: "#06b6d4", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>🕵️ Rival</th>
                                <th style={{ padding: "8px 10px", textAlign: "center", fontSize: "11px", color: "#10b981", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>✅ Yo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cols.map((col, i) => (
                                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                    <td style={{ padding: "10px", color: "#94a3b8" }}>{col.label}</td>
                                    <td style={{ padding: "10px", textAlign: "center", color: "#06b6d4", fontWeight: 700 }}>{col.them}</td>
                                    <td style={{ padding: "10px", textAlign: "center", color: "#10b981", fontWeight: 700 }}>{col.me}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Insights automáticos */}
                    {insights.length > 0 && (
                        <div style={{ marginTop: "16px" }}>
                            {insights.map((ins, i) => (
                                <AlertBox key={i} type={ins.type}>{ins.msg}</AlertBox>
                            ))}
                        </div>
                    )}
                    {!mySession && (
                        <div style={{ marginTop: "16px", padding: "12px", background: "rgba(255,255,255,0.04)", borderRadius: "8px", fontSize: "12px", color: "#64748b" }}>
                            💡 Conecta tu propia cuenta para ver la comparativa lado a lado con insights automáticos.
                        </div>
                    )}
                </div>

                {/* Radar Chart */}
                <div>
                    <ResponsiveContainer width="100%" height={250}>
                        <RadarChart data={radarData}>
                            <PolarGrid stroke="rgba(255,255,255,0.1)" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                            <Radar name="Competidor" dataKey="them" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} strokeWidth={2} />
                            {mySession && (
                                <Radar name="Mi Cuenta" dataKey="me" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
                            )}
                            <Tooltip formatter={(v, name) => [v.toFixed(1), name]} contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }} />
                            <Legend formatter={(v) => <span style={{ color: "#94a3b8", fontSize: "12px" }}>{v}</span>} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
