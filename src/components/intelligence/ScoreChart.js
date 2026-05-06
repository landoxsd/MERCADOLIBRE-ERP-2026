'use client';

/**
 * ScoreChart — Gráfico circular SVG sin librerías externas
 */
export default function ScoreChart({ score, label, color = "#06b6d4" }) {
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const normalizedScore = Math.min(100, Math.max(0, score || 0));
    const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

    // Color por rango
    const getColor = () => {
        if (normalizedScore >= 80) return "#10b981"; // emerald-500
        if (normalizedScore >= 60) return "#06b6d4"; // cyan-500
        if (normalizedScore >= 40) return "#f59e0b"; // amber-500
        return "#f43f5e"; // rose-500
    };

    const finalColor = color || getColor();

    return (
        <div className="flex flex-col items-center">
            <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
                <circle
                    cx="40" cy="40" r={radius} fill="none" stroke={finalColor}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    transform="rotate(-90 40 40)"
                    style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
                />
                <text x="40" y="44" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">
                    {normalizedScore}
                </text>
            </svg>
            <span className="text-xs text-slate-400 mt-1">{label}</span>
        </div>
    );
}
