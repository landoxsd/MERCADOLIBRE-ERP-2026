import React from 'react';

export default function QualityScoreBadge({ score, level, onClick }) {
    if (score === null || score === undefined) {
        return (
            <div 
                style={styles.badgeNa}
                title="Score no disponible"
            >
                <span style={styles.dotNa}></span>
                N/A
            </div>
        );
    }

    let badgeStyle = {};
    let dotStyle = {};
    let textLevel = level || "";

    if (score >= 66) { // Profesional
        badgeStyle = styles.badgeGreen;
        dotStyle = styles.dotGreen;
        if (!textLevel) textLevel = "Profesional";
    } else if (score >= 50) { // Estándar
        badgeStyle = styles.badgeYellow;
        dotStyle = styles.dotYellow;
        if (!textLevel) textLevel = "Estándar";
    } else { // Básica
        badgeStyle = styles.badgeRed;
        dotStyle = styles.dotRed;
        if (!textLevel) textLevel = "Básica";
    }

    return (
        <div 
            onClick={onClick}
            style={{...styles.badgeBase, ...badgeStyle, cursor: onClick ? 'pointer' : 'default'}}
            title={`Calidad: ${textLevel} (${Math.round(score)}/100)`}
        >
            <span style={{...styles.dotBase, ...dotStyle}}></span>
            {Math.round(score)}/100
        </div>
    );
}

const styles = {
    badgeBase: {
        display: 'inline-flex', alignItems: 'center', gap: '6px', 
        padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
        border: '1px solid transparent', transition: 'all 0.2s'
    },
    dotBase: { width: '6px', height: '6px', borderRadius: '50%' },
    
    badgeNa: {
        display: 'inline-flex', alignItems: 'center', gap: '6px', 
        padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
        backgroundColor: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)'
    },
    dotNa: { width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#64748b' },

    badgeGreen: { backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' },
    dotGreen: { backgroundColor: '#10b981' },

    badgeYellow: { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' },
    dotYellow: { backgroundColor: '#f59e0b' },

    badgeRed: { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' },
    dotRed: { backgroundColor: '#ef4444' }
};
