import React from 'react';

export default function AttributeGapTable({ ourAttributes = [], compAttributes = [], onCompleteAttribute }) {
    if (!compAttributes || compAttributes.length === 0) {
        return <div style={styles.empty}>No hay brecha de atributos detectada. Todo en orden.</div>;
    }

    return (
        <div style={styles.container}>
            <table style={styles.table}>
                <thead style={styles.thead}>
                    <tr>
                        <th style={styles.th}>Atributo</th>
                        <th style={styles.thRed}>Nuestra Pub.</th>
                        <th style={styles.thGreen}>Líder / Competidor</th>
                        <th style={styles.th}>Acción</th>
                    </tr>
                </thead>
                <tbody>
                    {compAttributes.map((attr) => (
                        <tr key={attr.id} style={styles.tr}>
                            <td style={styles.td}>
                                <div style={styles.attrName}>{attr.name}</div>
                                <div style={styles.attrGroup}>{attr.group}</div>
                            </td>
                            <td style={styles.tdMissing}>Falta</td>
                            <td style={styles.tdValue}>{attr.competitorValue}</td>
                            <td style={styles.td}>
                                <button 
                                    onClick={() => onCompleteAttribute(attr)}
                                    style={styles.btnAction}
                                >
                                    Completar
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

const styles = {
    empty: { padding: '16px', color: '#94a3b8', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' },
    container: { border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.2)' },
    table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' },
    thead: { backgroundColor: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' },
    th: { padding: '12px 16px', color: '#cbd5e1', fontWeight: 600 },
    thRed: { padding: '12px 16px', color: '#f87171', fontWeight: 600 },
    thGreen: { padding: '12px 16px', color: '#34d399', fontWeight: 600 },
    tr: { borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background-color 0.2s' },
    td: { padding: '12px 16px', color: '#e2e8f0' },
    tdMissing: { padding: '12px 16px', color: '#f87171', fontStyle: 'italic', fontWeight: 500 },
    tdValue: { padding: '12px 16px', color: '#e2e8f0', fontWeight: 500 },
    attrName: { fontWeight: 600, color: '#f8fafc', marginBottom: '2px' },
    attrGroup: { fontSize: '0.75rem', color: '#64748b' },
    btnAction: {
        padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)',
        borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s'
    }
};
