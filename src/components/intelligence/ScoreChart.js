'use client';

import { useEffect, useState } from "react";

/**
 * ScoreChart — Gráfico circular SVG premium
 */
export default function ScoreChart({ score, label }) {
    const [offset, setOffset] = useState(0);
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const normalizedScore = Math.min(100, Math.max(0, score || 0));
    
    useEffect(() => {
        const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;
        // Pequeño timeout para asegurar que la animación dispare al montar
        const timer = setTimeout(() => setOffset(strokeDashoffset), 50);
        return () => clearTimeout(timer);
    }, [normalizedScore, circumference]);

    // Color semántico y su drop shadow correspondiente
    const getTheme = () => {
        if (normalizedScore >= 80) return { color: "#10b981", shadow: "drop-shadow(0 0 6px rgba(16,185,129,0.5))" };
        if (normalizedScore >= 60) return { color: "#06b6d4", shadow: "drop-shadow(0 0 6px rgba(6,182,212,0.5))" };
        if (normalizedScore >= 40) return { color: "#f59e0b", shadow: "drop-shadow(0 0 6px rgba(245,158,11,0.5))" };
        return { color: "#f43f5e", shadow: "drop-shadow(0 0 6px rgba(244,63,94,0.5))" };
    };

    const theme = getTheme();

    return (
        <div className="score-chart-container">
            <div className="score-chart-circle-wrap">
                <svg width="80" height="80" viewBox="0 0 80 80" className="score-chart-svg">
                    {/* Anillo de fondo */}
                    <circle cx="40" cy="40" r={radius} fill="none" stroke="#0f172a" strokeWidth="8" />
                    <circle cx="40" cy="40" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" strokeDasharray="4 6" />
                    
                    {/* Anillo de progreso */}
                    <circle
                        cx="40" cy="40" r={radius} fill="none" stroke={theme.color}
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset || circumference}
                        style={{ 
                            transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                            filter: theme.shadow
                        }}
                    />
                </svg>
                {/* Texto central */}
                <div className="score-chart-text-overlay">
                    <span className="score-chart-value">{normalizedScore}</span>
                </div>
            </div>
            <span className="score-chart-label">{label}</span>
        </div>
    );
}

