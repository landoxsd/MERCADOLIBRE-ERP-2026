"use client";

import { useMemo } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// Custom Tooltip
function BubbleTooltip({ active, payload }) {
    if (!active || !payload || payload.length === 0) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    
    return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl text-xs shadow-2xl min-w-[200px]">
            <p className="font-bold text-white text-sm mb-2 truncate">{d.keyword}</p>
            <div className="space-y-1">
                <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Competidores:</span>
                    <span className="text-white font-mono">{d.competitors}</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Conv. Prom.:</span>
                    <span className="text-emerald-400 font-mono">{d.conversion_score.toFixed(1)} ventas/ítem</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Precio Prom.:</span>
                    <span className="text-amber-400 font-mono">${d.avg_price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Rev. Estimado:</span>
                    <span className="text-indigo-400 font-mono">${d.estimated_revenue.toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
}

export default function KeywordBubbleChart({ keywords }) {
    // Prepare bubble data: X = competitors (market density), Y = conversion score, Z = estimated revenue
    const bubbleData = useMemo(() => {
        return keywords.map(k => ({
            ...k,
            x: k.competitors,           // Eje X: Número de competidores (densidad)
            y: k.conversion_score,      // Eje Y: Ventas promedio por ítem (conversion proxy)
            z: Math.max(k.estimated_revenue, 10), // Tamaño burbuja: ingresos estimados
        }));
    }, [keywords]);
    
    // Color según oportunidad: pocas competencia + alta conversión = 🟢
    const getBubbleColor = (d) => {
        if (d.conversion_heat >= 70) return "#10b981"; // Emerald - alta conversión
        if (d.conversion_heat >= 40) return "#f59e0b"; // Amber - media conversión
        return "#6366f1";                               // Indigo - baja conversión
    };
    
    // Encontrar mediana de competidores para línea de referencia
    const medianCompetitors = useMemo(() => {
        if (keywords.length === 0) return 10;
        const sorted = [...keywords].map(k => k.competitors).sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
    }, [keywords]);
    
    const medianConversion = useMemo(() => {
        if (keywords.length === 0) return 1;
        const sorted = [...keywords].map(k => k.conversion_score).sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
    }, [keywords]);
    
    if (keywords.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-500">
                Sin datos para visualizar.
            </div>
        );
    }
    
    return (
        <div className="space-y-4">
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400 px-1">
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                    Alta conversión (&gt;70%)
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                    Conversión media (40–70%)
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />
                    Conversión baja (&lt;40%)
                </div>
                <div className="ml-auto text-slate-500 italic">
                    Tamaño de burbuja = Ingresos estimados
                </div>
            </div>
            
            {/* Cuadrante Labels */}
            <div className="relative">
                <div className="absolute top-2 right-4 text-[10px] text-emerald-400/70 font-semibold z-10">
                    🏆 Alta conv. + Pocos competidores = OPORTUNIDAD
                </div>
                <div className="absolute bottom-8 right-4 text-[10px] text-rose-400/70 font-semibold z-10">
                    🚫 Alta competencia + Baja conversión = SATURADO
                </div>
                
                <ResponsiveContainer width="100%" height={380}>
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                        <XAxis
                            type="number"
                            dataKey="x"
                            name="Competidores"
                            label={{ value: "← Menos competencia | Más competencia →", position: "insideBottom", offset: -20, fill: "#64748b", fontSize: 11 }}
                            tick={{ fill: "#64748b", fontSize: 10 }}
                            tickLine={false}
                            axisLine={{ stroke: "#1e293b" }}
                        />
                        <YAxis
                            type="number"
                            dataKey="y"
                            name="Conversión"
                            label={{ value: "Ventas/ítem (conversión)", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }}
                            tick={{ fill: "#64748b", fontSize: 10 }}
                            tickLine={false}
                            axisLine={{ stroke: "#1e293b" }}
                        />
                        <ZAxis type="number" dataKey="z" range={[60, 1400]} name="Ingresos" />
                        <Tooltip content={<BubbleTooltip />} />
                        
                        {/* Líneas de referencia = medianas del mercado */}
                        <ReferenceLine x={medianCompetitors} stroke="#334155" strokeDasharray="4 4" label={{ value: "Mediana", fill: "#475569", fontSize: 9 }} />
                        <ReferenceLine y={medianConversion} stroke="#334155" strokeDasharray="4 4" label={{ value: "Mediana", fill: "#475569", fontSize: 9 }} />
                        
                        {/* Burbujas de alta conversión (verde) */}
                        <Scatter
                            name="Alta conversión"
                            data={bubbleData.filter(d => d.conversion_heat >= 70)}
                            fill="#10b981"
                            fillOpacity={0.75}
                            stroke="#059669"
                            strokeWidth={1}
                        />
                        {/* Burbujas de conversión media (amber) */}
                        <Scatter
                            name="Conversión media"
                            data={bubbleData.filter(d => d.conversion_heat >= 40 && d.conversion_heat < 70)}
                            fill="#f59e0b"
                            fillOpacity={0.75}
                            stroke="#d97706"
                            strokeWidth={1}
                        />
                        {/* Burbujas de baja conversión (indigo) */}
                        <Scatter
                            name="Baja conversión"
                            data={bubbleData.filter(d => d.conversion_heat < 40)}
                            fill="#6366f1"
                            fillOpacity={0.75}
                            stroke="#4f46e5"
                            strokeWidth={1}
                        />
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
            
            {/* Quadrant Guide */}
            <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3">
                    <div className="font-bold text-emerald-400 mb-1">🏆 Cuadrante Ideal</div>
                    <div className="text-slate-400">Arriba-Izquierda: Alta conversión + Pocos competidores. Son los nichos de oro donde vale la pena publicar.</div>
                </div>
                <div className="bg-rose-500/5 border border-rose-500/15 rounded-xl p-3">
                    <div className="font-bold text-rose-400 mb-1">🚫 Evitar</div>
                    <div className="text-slate-400">Abajo-Derecha: Baja conversión + Muchos competidores. Saturación sin rentabilidad real.</div>
                </div>
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
                    <div className="font-bold text-amber-400 mb-1">⚡ Potencial</div>
                    <div className="text-slate-400">Arriba-Derecha: Alta conversión + Muchos competidores. Mercado grande; necesitas diferenciación.</div>
                </div>
                <div className="bg-slate-700/20 border border-slate-700/30 rounded-xl p-3">
                    <div className="font-bold text-slate-400 mb-1">🔍 Explorar</div>
                    <div className="text-slate-400">Abajo-Izquierda: Pocos competidores + Baja conversión. Puede ser nicho emergente o de muy bajo volumen.</div>
                </div>
            </div>
        </div>
    );
}
