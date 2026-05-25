'use client';
import { useState, useEffect } from 'react';

export default function ListingOptimizerPage() {
    // ESTADOS
    const [searchQuery, setSearchQuery] = useState('');
    const [myItems, setMyItems] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [acceptedChanges, setAcceptedChanges] = useState([]);
    
    // Panel Central Editables
    const [editedPrice, setEditedPrice] = useState('');
    const [editedTitle, setEditedTitle] = useState('');
    const [editedDesc, setEditedDesc] = useState('');

    async function handleSearch() {
        try {
            // Reemplaza esto con tu llamada real a Supabase o API
            // Dummy provisional para probar la UI
            setMyItems([
                { id: 'MLV123456789', title: 'Amortiguador Toyota Corolla ' + searchQuery, price: 50, thumbnail: '' }
            ]);
        } catch(e) {
            console.error(e);
        }
    }

    async function handleAnalyze(item) {
        setSelectedItem(item);
        setIsAnalyzing(true);
        setAnalysis(null);
        
        try {
            const res = await fetch('/api/tools/optimizer/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_id: item.id })
            });
            const data = await res.json();
            if (data.success) {
                setAnalysis(data);
                if (data.dictamen && !data.demo_mode) {
                    setEditedPrice(data.dictamen.precio?.sugerido || data.myItem.price);
                    setEditedTitle(data.dictamen.titulo?.titulo_sugerido || data.myItem.title);
                    setEditedDesc(data.dictamen.descripcion?.descripcion_sugerida || data.myItem.description);
                }
            } else {
                alert('Error: ' + data.error);
            }
        } catch(e) {
            alert('Error: ' + e.message);
        } finally {
            setIsAnalyzing(false);
        }
    }

    function acceptChange(type) {
        // Añadir a acceptedChanges
        const change = {
            sku: analysis.myItem.sku || 'N/A',
            item_id: analysis.myItem.id,
            score_antes: analysis.dictamen.score,
        };
        
        // merge with existing
        const existingIdx = acceptedChanges.findIndex(c => c.item_id === analysis.myItem.id);
        const newChanges = [...acceptedChanges];
        const currentChange = existingIdx >= 0 ? newChanges[existingIdx] : change;
        
        if (type === 'price') currentChange.nuevo_precio = editedPrice;
        if (type === 'title') currentChange.nuevo_titulo = editedTitle;
        if (type === 'desc') currentChange.nueva_descripcion = editedDesc;
        
        if (existingIdx >= 0) {
            newChanges[existingIdx] = currentChange;
        } else {
            newChanges.push(currentChange);
        }
        setAcceptedChanges(newChanges);
    }

    async function handleExport() {
        if (acceptedChanges.length === 0) return;
        try {
            const res = await fetch('/api/tools/optimizer/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: acceptedChanges })
            });
            if (!res.ok) throw new Error('Error al exportar');
            
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `INTEGRALY_OPTIMIZER_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch(e) {
            alert(e.message);
        }
    }

    // --- RENDER ---
    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <h1 style={styles.title}>⚡ Listing Optimizer IA</h1>
                <p style={styles.subtitle}>Analisis competitivo top 5 + Dictamen IA</p>
            </div>

            <div style={styles.container}>
                {/* PANEL IZQUIERDO */}
                <div style={styles.leftPanel}>
                    <h3 style={styles.panelTitle}>Mis Publicaciones</h3>
                    <div style={styles.searchBox}>
                        <input 
                            style={styles.input} 
                            placeholder="Buscar titulo o SKU..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        />
                        <button style={styles.btnPrimary} onClick={handleSearch}>🔍</button>
                    </div>
                    
                    <div style={styles.myItemsList}>
                        {myItems.map(item => (
                            <div 
                                key={item.id} 
                                style={selectedItem?.id === item.id ? {...styles.itemCard, ...styles.itemCardActive} : styles.itemCard}
                                onClick={() => setSelectedItem(item)}
                            >
                                <div style={styles.itemTitle}>{item.title}</div>
                                <div style={styles.itemPrice}>${item.price} · {item.id}</div>
                                {selectedItem?.id === item.id && (
                                    <button 
                                        style={{...styles.btnPrimary, width: '100%', marginTop: '8px'}}
                                        onClick={(e) => { e.stopPropagation(); handleAnalyze(item); }}
                                        disabled={isAnalyzing}
                                    >
                                        {isAnalyzing ? '⏳ Analizando...' : 'Analizar Competencia'}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div style={styles.acceptedSection}>
                        <h4 style={styles.acceptedTitle}>Aceptados ({acceptedChanges.length})</h4>
                        {acceptedChanges.map(c => (
                            <div key={c.item_id} style={styles.acceptedItem}>✅ {c.item_id}</div>
                        ))}
                        <button 
                            style={acceptedChanges.length > 0 ? styles.btnSuccess : {...styles.btnSuccess, opacity: 0.5}}
                            onClick={handleExport}
                            disabled={acceptedChanges.length === 0}
                        >
                            Exportar Integraly
                        </button>
                    </div>
                </div>

                {/* PANEL CENTRAL */}
                <div style={styles.centerPanel}>
                    {!selectedItem && !isAnalyzing && (
                        <div style={styles.welcome}>
                            <h2>Selecciona una publicacion para analizar</h2>
                            <p>El sistema buscara los 5 competidores mas fuertes y usara IA para sugerir mejoras.</p>
                        </div>
                    )}
                    {isAnalyzing && (
                        <div style={styles.welcome}>
                            <h2>⏳ Analizando mercado...</h2>
                            <p>Consultando competidores y llamando a la IA.</p>
                        </div>
                    )}
                    {analysis && analysis.dictamen && (
                        <div style={styles.dictamenCard}>
                            <div style={styles.dictamenHeader}>
                                <h2>{analysis.myItem.title}</h2>
                                <div style={styles.scoreCircle}>
                                    <span style={{fontSize: '1.5rem', fontWeight: 'bold'}}>{analysis.dictamen.score}</span>
                                    <span style={{fontSize: '0.8rem'}}>/100</span>
                                </div>
                            </div>
                            <p style={styles.resumen}>{analysis.dictamen.resumen_ejecutivo}</p>

                            <div style={styles.section}>
                                <h4>💰 Precio ({analysis.dictamen.precio.posicion})</h4>
                                <p>{analysis.dictamen.precio.recomendacion}</p>
                                <div style={styles.editRow}>
                                    <input type="number" style={styles.input} value={editedPrice} onChange={e => setEditedPrice(e.target.value)} />
                                    <button style={styles.btnSmallOk} onClick={() => acceptChange('price')}>✓ Aceptar</button>
                                </div>
                            </div>

                            <div style={styles.section}>
                                <h4>📝 Titulo</h4>
                                <div style={styles.badges}>
                                    {(analysis.dictamen.titulo.palabras_clave_faltantes || []).map(p => (
                                        <span key={p} style={styles.badgeYellow}>{p}</span>
                                    ))}
                                </div>
                                <div style={styles.editRow}>
                                    <input style={{...styles.input, flex: 1}} value={editedTitle} onChange={e => setEditedTitle(e.target.value)} />
                                    <button style={styles.btnSmallOk} onClick={() => acceptChange('title')}>✓ Aceptar</button>
                                </div>
                            </div>

                            <div style={styles.section}>
                                <h4>📄 Descripcion</h4>
                                <ul>
                                    {(analysis.dictamen.descripcion.gaps_detectados || []).map((g, i) => <li key={i}>{g}</li>)}
                                </ul>
                                <div style={styles.editRow}>
                                    <textarea style={{...styles.input, flex: 1, minHeight: '100px'}} value={editedDesc} onChange={e => setEditedDesc(e.target.value)} />
                                    <button style={styles.btnSmallOk} onClick={() => acceptChange('desc')}>✓ Aceptar</button>
                                </div>
                            </div>

                            <div style={styles.section}>
                                <h4>🎯 Prioridades</h4>
                                <ol>
                                    {(analysis.dictamen.prioridades || []).map((p, i) => <li key={i}>{p}</li>)}
                                </ol>
                            </div>
                        </div>
                    )}
                </div>

                {/* PANEL DERECHO */}
                <div style={styles.rightPanel}>
                    <h3 style={styles.panelTitle}>Top 5 Competencia</h3>
                    {analysis?.competitors?.map((comp, i) => (
                        <div key={comp.id} style={styles.compCard}>
                            <div style={styles.compRank}>#{i+1}</div>
                            <div style={styles.compTitle} title={comp.title}>{comp.title.substring(0, 50)}...</div>
                            <div style={styles.compPrice}>${comp.price} {comp.currency_id}</div>
                            <div style={styles.compMeta}>
                                {comp.shipping_free && <span style={styles.badgeGreen}>Envio Gratis</span>}
                                <span style={styles.badgeGray}>{comp.pictures_count} fotos</span>
                            </div>
                            <div style={styles.compSeller}>Vendedor: {comp.seller_nickname}</div>
                        </div>
                    ))}
                    {!analysis && !isAnalyzing && (
                        <p style={{color: '#64748b', fontSize: '0.9rem'}}>Esperando analisis...</p>
                    )}
                </div>
            </div>
        </div>
    );
}

const styles = {
    page: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        padding: '24px',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        color: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh'
    },
    header: { marginBottom: '24px', flexShrink: 0 },
    title: { fontSize: '1.8rem', fontWeight: 700, margin: 0, color: '#f1f5f9' },
    subtitle: { fontSize: '0.9rem', color: '#64748b', marginTop: '4px' },
    container: { display: 'flex', gap: '20px', flex: 1, overflow: 'hidden' },
    
    leftPanel: {
        width: '300px',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        backdropFilter: 'blur(12px)'
    },
    centerPanel: {
        flex: 1,
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.08)',
        overflowY: 'auto',
        padding: '24px',
        backdropFilter: 'blur(12px)'
    },
    rightPanel: {
        width: '280px',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.08)',
        padding: '16px',
        overflowY: 'auto',
        backdropFilter: 'blur(12px)'
    },
    
    panelTitle: { fontSize: '1.1rem', marginTop: 0, marginBottom: '16px', color: '#cbd5e1' },
    searchBox: { display: 'flex', gap: '8px', marginBottom: '16px' },
    input: {
        flex: 1,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: '#e2e8f0',
        padding: '8px 12px',
        outline: 'none'
    },
    myItemsList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' },
    itemCard: {
        padding: '12px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '8px',
        cursor: 'pointer',
        border: '1px solid transparent'
    },
    itemCardActive: { border: '1px solid #06b6d4', background: 'rgba(6,182,212,0.1)' },
    itemTitle: { fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' },
    itemPrice: { fontSize: '0.75rem', color: '#94a3b8' },
    
    acceptedSection: { marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' },
    acceptedTitle: { fontSize: '0.9rem', marginBottom: '8px' },
    acceptedItem: { fontSize: '0.8rem', color: '#4ade80', marginBottom: '4px' },
    
    welcome: { textAlign: 'center', marginTop: '100px', color: '#94a3b8' },
    
    dictamenCard: { display: 'flex', flexDirection: 'column', gap: '20px' },
    dictamenHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    scoreCircle: {
        width: '64px', height: '64px', borderRadius: '50%',
        background: 'linear-gradient(135deg, #0891b2, #06b6d4)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: 'white'
    },
    resumen: { fontStyle: 'italic', color: '#cbd5e1', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' },
    section: { background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' },
    editRow: { display: 'flex', gap: '12px', marginTop: '12px', alignItems: 'flex-start' },
    badges: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' },
    badgeYellow: { fontSize: '0.7rem', background: 'rgba(234,179,8,0.2)', color: '#facc15', padding: '4px 8px', borderRadius: '12px' },
    badgeGreen: { fontSize: '0.7rem', background: 'rgba(34,197,94,0.2)', color: '#4ade80', padding: '2px 6px', borderRadius: '4px' },
    badgeGray: { fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', color: '#cbd5e1', padding: '2px 6px', borderRadius: '4px' },
    
    compCard: {
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '12px',
        position: 'relative'
    },
    compRank: { position: 'absolute', top: '-8px', right: '-8px', background: '#eab308', color: '#000', fontWeight: 'bold', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' },
    compTitle: { fontSize: '0.8rem', marginBottom: '8px', lineHeight: '1.4' },
    compPrice: { fontSize: '1rem', fontWeight: 'bold', color: '#fff', marginBottom: '4px' },
    compMeta: { display: 'flex', gap: '6px', marginBottom: '8px' },
    compSeller: { fontSize: '0.7rem', color: '#94a3b8' },
    
    btnPrimary: {
        padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600,
        background: 'linear-gradient(135deg, #0891b2, #06b6d4)', color: '#fff'
    },
    btnSuccess: {
        padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600,
        background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', width: '100%', marginTop: '12px'
    },
    btnSmallOk: {
        padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
        background: 'rgba(34,197,94,0.2)', color: '#4ade80', whiteSpace: 'nowrap'
    }
};
