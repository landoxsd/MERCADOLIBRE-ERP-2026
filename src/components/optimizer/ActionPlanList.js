import React from 'react';
import { Camera, Tag, Type, DollarSign, ArrowRight } from 'lucide-react';

export default function ActionPlanList({ analysis, performance, onActionClick }) {
    if (!analysis || !performance) return <div style={styles.empty}>No hay datos suficientes para generar el plan.</div>;

    const plan = [];

    // 1. Fotos
    const pendingPictures = performance.buckets?.flatMap(b => b.variables).find(v => v.key === 'PICTURES' && v.status === 'PENDING');
    if (pendingPictures || analysis.analysis.photoGap.difference > 0) {
        plan.push({
            id: 'photos',
            priority: 'Alta',
            impact: '+33 pts',
            title: 'Mejorar galería de fotos',
            description: pendingPictures ? 'Te faltan fotos para llegar a 3 (mínimo exigido).' : `El líder tiene ${analysis.analysis.photoGap.difference} fotos más que tú.`,
            icon: <Camera size={20} color="#a855f7" />,
            iconBg: 'rgba(168, 85, 247, 0.2)',
            actionText: 'Ir a Fotos'
        });
    }

    // 2. Atributos
    if (analysis.analysis.attrGap && analysis.analysis.attrGap.length > 0) {
        plan.push({
            id: 'attributes',
            priority: 'Alta',
            impact: '+20 pts',
            title: 'Completar Ficha Técnica',
            description: `Te faltan ${analysis.analysis.attrGap.length} atributos que el líder sí tiene.`,
            icon: <Tag size={20} color="#3b82f6" />,
            iconBg: 'rgba(59, 130, 246, 0.2)',
            actionText: 'Ver Atributos'
        });
    }

    // 3. Título
    if (analysis.analysis.titleAnalysis.missingKeywords.length > 0) {
        plan.push({
            id: 'title',
            priority: 'Media',
            impact: '+15 pts',
            title: 'Optimizar Título (Keywords)',
            description: `Te faltan ${analysis.analysis.titleAnalysis.missingKeywords.length} palabras clave importantes.`,
            icon: <Type size={20} color="#f59e0b" />,
            iconBg: 'rgba(245, 158, 11, 0.2)',
            actionText: 'Optimizar Título'
        });
    }

    // 4. Precio
    if (analysis.analysis.priceGap.difference > 0) {
        plan.push({
            id: 'price',
            priority: analysis.analysis.priceGap.percentageDiff > 10 ? 'Alta' : 'Media',
            impact: 'Mejora Conversión',
            title: 'Ajustar Precio Competitivo',
            description: `Eres $${analysis.analysis.priceGap.difference.toFixed(2)} más caro que el líder.`,
            icon: <DollarSign size={20} color="#10b981" />,
            iconBg: 'rgba(16, 185, 129, 0.2)',
            actionText: 'Editar Precio'
        });
    }

    if (plan.length === 0) {
        return (
            <div style={styles.successBox}>
                <h3 style={styles.successTitle}>¡Excelente Trabajo!</h3>
                <p style={styles.successText}>Tu publicación está optimizada al máximo nivel en comparación con el líder.</p>
            </div>
        );
    }

    return (
        <div style={styles.list}>
            {plan.map((item, index) => (
                <div key={item.id} style={styles.card} onClick={() => onActionClick(item.id)}>
                    <div style={{...styles.iconWrapper, backgroundColor: item.iconBg}}>
                        {item.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={styles.cardHeader}>
                            <h4 style={styles.cardTitle}>{index + 1}. {item.title}</h4>
                            <div style={styles.badges}>
                                <span style={styles.badgeGray}>Impacto: {item.impact}</span>
                                <span style={item.priority === 'Alta' ? styles.badgeRed : styles.badgeYellow}>{item.priority}</span>
                            </div>
                        </div>
                        <p style={styles.cardDesc}>{item.description}</p>
                        <button style={styles.actionBtn}>
                            {item.actionText} <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

const styles = {
    empty: { textAlign: 'center', padding: '32px', color: '#64748b' },
    list: { display: 'flex', flexDirection: 'column', gap: '16px' },
    
    card: { 
        backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', 
        borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'flex-start', gap: '16px',
        cursor: 'pointer', transition: 'border-color 0.2s, background-color 0.2s'
    },
    
    iconWrapper: { width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' },
    cardTitle: { margin: 0, fontSize: '1rem', fontWeight: 'bold', color: '#f8fafc' },
    
    badges: { display: 'flex', gap: '8px', alignItems: 'center' },
    badgeGray: { backgroundColor: 'rgba(255,255,255,0.1)', color: '#cbd5e1', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 },
    badgeRed: { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 },
    badgeYellow: { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 },
    
    cardDesc: { margin: '0 0 12px 0', fontSize: '0.85rem', color: '#94a3b8' },
    
    actionBtn: { 
        background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.85rem', fontWeight: 600, 
        padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'color 0.2s'
    },
    
    successBox: { backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '32px', textAlign: 'center', borderRadius: '12px' },
    successTitle: { color: '#34d399', fontSize: '1.25rem', fontWeight: 'bold', margin: '0 0 8px 0' },
    successText: { color: '#10b981', margin: 0 }
};
