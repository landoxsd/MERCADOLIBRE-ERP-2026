'use client';

/**
 * AnalysisModeBadge — Indica si estamos en modo Fitment o Price
 */
export default function AnalysisModeBadge({ mode }) {
    if (!mode) return null;

    const config = mode === 'fitment'
        ? {
            label: '🔧 MODO COMPATIBILIDAD',
            badgeClass: 'mode-badge-fitment',
            labelClass: 'mode-badge-label-fitment',
            desc: 'Prioriza atributos BRAND/MODEL/PART_NUMBER'
        }
        : {
            label: '💰 MODO PRECIO',
            badgeClass: 'mode-badge-price',
            labelClass: 'mode-badge-label-price',
            desc: 'Prioriza precio y visibilidad de número de parte'
        };

    return (
        <div className={`mode-badge ${config.badgeClass}`}>
            <span className={`mode-badge-label ${config.labelClass}`}>{config.label}</span>
            <span className="mode-badge-desc">{config.desc}</span>
        </div>
    );
}

