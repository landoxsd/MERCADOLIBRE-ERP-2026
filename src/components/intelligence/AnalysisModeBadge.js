'use client';

/**
 * AnalysisModeBadge — Indica si estamos en modo Fitment o Price
 */
export default function AnalysisModeBadge({ mode }) {
    if (!mode) return null;

    const config = mode === 'fitment'
        ? {
            label: '🔧 MODO COMPATIBILIDAD',
            bg: 'bg-blue-900/60',
            text: 'text-blue-200',
            border: 'border-blue-700',
            desc: 'Prioriza atributos BRAND/MODEL/PART_NUMBER'
        }
        : {
            label: '💰 MODO PRECIO',
            bg: 'bg-emerald-900/60',
            text: 'text-emerald-200',
            border: 'border-emerald-700',
            desc: 'Prioriza precio y visibilidad de número de parte'
        };

    return (
        <div className={`inline-flex flex-col px-3 py-1.5 rounded-lg border ${config.bg} ${config.border}`}>
            <span className={`text-xs font-bold ${config.text}`}>{config.label}</span>
            <span className="text-[10px] text-slate-400 mt-0.5">{config.desc}</span>
        </div>
    );
}
