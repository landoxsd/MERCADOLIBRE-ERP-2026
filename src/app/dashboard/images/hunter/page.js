'use client';
import { useState, useEffect, useRef } from 'react';

export default function ImageHunterPage() {
    // --- ESTADO ---
    const [skuInput, setSkuInput] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, currentSku: '' });
    const [results, setResults] = useState([]); // [{ sku, images: [] }]
    const [activeSkuIndex, setActiveSkuIndex] = useState(0);
    const [sandbox, setSandbox] = useState([]); // imagenes en bandeja
    const [processing, setProcessing] = useState(null); // { imageUrl, sku }
    const [downloading, setDownloading] = useState(false);
    const [pendingStockFilter, setPendingStockFilter] = useState('inStock');
    const [isLoadingPending, setIsLoadingPending] = useState(false);
    const abortRef = useRef(false);

    // Cargar bandeja al montar
    useEffect(() => {
        loadSandbox();
    }, []);

    async function loadSandbox() {
        try {
            const res = await fetch('/api/images/sandbox');
            const data = await res.json();
            if (data.success) setSandbox(data.images || []);
        } catch(e) { console.error(e); }
    }

    // CARGAR SKUS PENDIENTES DESDE EL BANCO DE IMÁGENES
    async function loadPendingSkus() {
        setIsLoadingPending(true);
        try {
            const res = await fetch(`/api/image-bank/pending?stock=${pendingStockFilter}`);
            if (res.ok) {
                const text = await res.text();
                if (!text.trim()) {
                    alert('No hay SKUs pendientes con ese filtro de stock.');
                } else {
                    setSkuInput(text);
                }
            } else {
                alert('Error al cargar SKUs pendientes');
            }
        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            setIsLoadingPending(false);
        }
    }

    // Calcular el siguiente indice disponible para un SKU en la bandeja
    function getNextIndex(sku) {
        const existing = sandbox.filter(img => img.sku === sku).map(img => img.index);
        for (let i = 0; i <= 9; i++) {
            if (!existing.includes(i)) return i;
        }
        return existing.length;
    }

    // BUSQUEDA BATCH
    async function handleSearch() {
        const skus = skuInput.split('\n').map(s => s.trim()).filter(Boolean);
        if (skus.length === 0) return;

        setIsSearching(true);
        setResults([]);
        setActiveSkuIndex(0);
        abortRef.current = false;

        const allResults = [];
        for (let i = 0; i < skus.length; i++) {
            if (abortRef.current) break;
            const sku = skus[i];
            setProgress({ current: i + 1, total: skus.length, currentSku: sku });

            try {
                // Pasamos tanto q como sku
                const res = await fetch(`/api/images/hunt?q=${encodeURIComponent(sku)}&sku=${encodeURIComponent(sku)}&limit=12`);
                const data = await res.json();
                allResults.push({ 
                    sku, 
                    images: data.success ? data.images : [], 
                    error: data.error,
                    strategy_used: data.strategy_used,
                    product_title: data.product_title
                });
            } catch(e) {
                allResults.push({ sku, images: [], error: e.message });
            }

            setResults([...allResults]);
        }

        setIsSearching(false);
        setProgress(prev => ({ ...prev, currentSku: '' }));
    }

    // AGREGAR A BANDEJA
    async function handleAddToBandeja(imageUrl, sku) {
        const index = getNextIndex(sku);
        setProcessing({ imageUrl, sku, index });
        try {
            const res = await fetch('/api/images/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl, sku, index })
            });
            const data = await res.json();
            if (data.success) {
                await loadSandbox(); // Recargar bandeja
            } else {
                alert('Error procesando imagen: ' + data.error);
            }
        } catch(e) {
            alert('Error: ' + e.message);
        } finally {
            setProcessing(null);
        }
    }

    // ELIMINAR DE BANDEJA
    async function handleDelete(filename) {
        try {
            await fetch(`/api/images/sandbox?file=${encodeURIComponent(filename)}`, { method: 'DELETE' });
            await loadSandbox();
        } catch(e) { console.error(e); }
    }

    // DESCARGAR ZIP
    async function handleDownload() {
        setDownloading(true);
        try {
            const res = await fetch('/api/images/export-zip?clear=true');
            if (!res.ok) {
                const err = await res.json();
                alert(err.error || 'Error al descargar');
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `PROFIT_IMAGES_${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            await loadSandbox(); // Reflejar que la bandeja quedo vacia
        } catch(e) {
            alert('Error: ' + e.message);
        } finally {
            setDownloading(false);
        }
    }

    const activeResult = results[activeSkuIndex];
    const progressPct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <h1 style={styles.title}>🖼️ Image Hunter</h1>
                <p style={styles.subtitle}>Cazador automático de imágenes de catálogo · Módulo Inteligente Multipaso</p>
            </div>

            {/* ZONA 1 — BUSQUEDA BATCH */}
            <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={styles.cardTitle}>📋 Búsqueda por Lote</h2>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select 
                            value={pendingStockFilter} 
                            onChange={(e) => setPendingStockFilter(e.target.value)}
                            style={{...styles.textarea, width: 'auto', padding: '6px 10px', minHeight: 'auto'}}
                            disabled={isLoadingPending}
                        >
                            <option value="inStock">Solo Con Stock</option>
                            <option value="noStock">Solo Agotados</option>
                            <option value="all">Todos los Pendientes</option>
                        </select>
                        <button 
                            style={styles.btnSecondary} 
                            onClick={loadPendingSkus}
                            disabled={isLoadingPending}
                        >
                            {isLoadingPending ? '⏳ Cargando...' : '📥 Cargar Faltantes del Banco'}
                        </button>
                    </div>
                </div>
                <div style={styles.searchRow}>
                    <textarea
                        style={styles.textarea}
                        placeholder={"Pega tus SKUs aqui o cárgalos desde el banco..."}
                        value={skuInput}
                        onChange={e => setSkuInput(e.target.value)}
                        rows={6}
                        disabled={isSearching}
                    />
                    <div style={styles.searchActions}>
                        <button
                            style={isSearching ? {...styles.btnPrimary, ...styles.btnDisabled} : styles.btnPrimary}
                            onClick={handleSearch}
                            disabled={isSearching || !skuInput.trim()}
                        >
                            {isSearching ? '⏳ Buscando...' : '🔍 Buscar Todos'}
                        </button>
                        {isSearching && (
                            <button style={styles.btnDanger} onClick={() => { abortRef.current = true; }}>
                                ✕ Detener
                            </button>
                        )}
                        {progress.total > 0 && (
                            <div style={styles.progressBox}>
                                <div style={styles.progressBar}>
                                    <div style={{...styles.progressFill, width: `${progressPct}%`}} />
                                </div>
                                <span style={styles.progressText}>
                                    {progress.current}/{progress.total} SKUs
                                    {progress.currentSku ? ` · ${progress.currentSku}` : ''}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ZONA 2 — RESULTADOS */}
            {results.length > 0 && (
                <div style={styles.card}>
                    <div style={styles.skuTabs}>
                        {results.map((r, i) => (
                            <button
                                key={r.sku}
                                style={i === activeSkuIndex ? {...styles.tab, ...styles.tabActive} : styles.tab}
                                onClick={() => setActiveSkuIndex(i)}
                            >
                                {r.sku}
                                {r.error ? ' ⚠️' : ` (${r.images.length})`}
                            </button>
                        ))}
                    </div>

                    {activeResult && (
                        <>
                            <h2 style={styles.cardTitle}>
                                Resultados para: <span style={{color: '#67e8f9'}}>{activeResult.sku}</span>
                            </h2>
                            {activeResult.error ? (
                                <p style={{color: '#f87171'}}>Error: {activeResult.error}</p>
                            ) : activeResult.images.length === 0 ? (
                                <p style={{color: '#94a3b8'}}>No se encontraron imagenes.</p>
                            ) : (
                                <div style={styles.imgGrid}>
                                    {activeResult.images.map((img, idx) => (
                                        <div key={idx} style={styles.imgCard}>
                                            <div style={styles.imgWrap}>
                                                <a href={img.hd_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%', height: '100%' }} title="Ver imagen en alta resolución">
                                                    <img
                                                        src={img.thumbnail || img.hd_url}
                                                        alt={img.title || activeResult.sku}
                                                        style={styles.imgPreview}
                                                        loading="lazy"
                                                        onError={e => { e.target.style.display='none'; }}
                                                    />
                                                </a>
                                            </div>
                                            <div style={styles.imgMeta}>
                                                <span style={img.is_hd ? styles.badgeGreen : styles.badgeYellow}>
                                                    {img.is_hd ? '✅ HD' : '⚠️ Baja'}
                                                </span>
                                                {img.width > 0 && (
                                                    <span style={styles.metaText}>{img.width}x{img.height}</span>
                                                )}
                                                {img.domain && (
                                                    <span style={styles.metaText}>{img.domain}</span>
                                                )}
                                            </div>
                                            <button
                                                style={processing ? {...styles.btnAdd, ...styles.btnDisabled} : styles.btnAdd}
                                                disabled={!!processing}
                                                onClick={() => handleAddToBandeja(img.hd_url || img.thumbnail, activeResult.sku)}
                                            >
                                                {processing?.imageUrl === (img.hd_url || img.thumbnail) ? '⏳' : '+ Agregar a Bandeja'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ZONA 3 — BANDEJA DE APROBACION */}
            <div style={styles.card}>
                <div style={styles.bandejaHeader}>
                    <h2 style={styles.cardTitle}>
                        📦 Bandeja de Aprobacion <span style={styles.badge}>{sandbox.length}</span>
                    </h2>
                    {sandbox.length > 0 && (
                        <button
                            style={downloading ? {...styles.btnSuccess, ...styles.btnDisabled} : styles.btnSuccess}
                            onClick={handleDownload}
                            disabled={downloading}
                        >
                            {downloading ? '⏳ Descargando...' : '⬇️ Descargar ZIP → PROFIT'}
                        </button>
                    )}
                </div>

                {sandbox.length === 0 ? (
                    <p style={styles.emptyMsg}>
                        La bandeja esta vacia. Agrega imagenes desde los resultados de busqueda.
                    </p>
                ) : (
                    <div style={styles.imgGrid}>
                        {sandbox.map((img) => (
                            <div key={img.filename} style={styles.imgCard}>
                                <div style={styles.imgWrap}>
                                    <img
                                        src={img.url}
                                        alt={img.filename}
                                        style={styles.imgPreview}
                                        loading="lazy"
                                    />
                                </div>
                                <div style={styles.imgMeta}>
                                    <span style={styles.badgeGreen}>✅ 1500x1500</span>
                                    <span style={styles.metaText}>{img.sku}</span>
                                    <span style={styles.metaText}>#{img.index}</span>
                                </div>
                                <p style={styles.imgFilename}>{img.filename}</p>
                                <button style={styles.btnDelete} onClick={() => handleDelete(img.filename)}>
                                    ❌ Eliminar
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ESTILOS — Glassmorphism oscuro consistente con el ERP
const styles = {
    page: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        padding: '32px',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        color: '#e2e8f0',
    },
    header: { marginBottom: '32px' },
    title: { fontSize: '2rem', fontWeight: 700, margin: 0, color: '#f1f5f9' },
    subtitle: { fontSize: '0.95rem', color: '#64748b', marginTop: '8px' },
    card: {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        backdropFilter: 'blur(12px)',
    },
    cardTitle: { fontSize: '1.1rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '16px', marginTop: 0 },
    searchRow: { display: 'flex', gap: '16px', alignItems: 'flex-start' },
    textarea: {
        flex: 1,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px',
        color: '#e2e8f0',
        padding: '12px',
        fontSize: '0.9rem',
        resize: 'vertical',
        fontFamily: 'monospace',
        outline: 'none',
    },
    searchActions: { display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '160px' },
    progressBox: { display: 'flex', flexDirection: 'column', gap: '6px' },
    progressBar: { height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' },
    progressFill: { height: '100%', background: 'linear-gradient(90deg, #06b6d4, #22d3ee)', borderRadius: '3px', transition: 'width 0.3s ease' },
    progressText: { fontSize: '0.8rem', color: '#67e8f9' },
    skuTabs: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' },
    tab: {
        padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)',
        background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s',
    },
    tabActive: { background: 'rgba(6,182,212,0.2)', border: '1px solid #06b6d4', color: '#67e8f9' },
    imgGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' },
    imgCard: {
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px',
    },
    imgWrap: { width: '100%', paddingTop: '100%', position: 'relative', background: '#1e293b', borderRadius: '8px', overflow: 'hidden' },
    imgPreview: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' },
    imgMeta: { display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' },
    imgFilename: { fontSize: '0.7rem', color: '#475569', margin: 0, wordBreak: 'break-all' },
    metaText: { fontSize: '0.7rem', color: '#64748b' },
    badgeGreen: { fontSize: '0.7rem', background: 'rgba(34,197,94,0.2)', color: '#4ade80', padding: '2px 6px', borderRadius: '4px' },
    badgeYellow: { fontSize: '0.7rem', background: 'rgba(234,179,8,0.2)', color: '#facc15', padding: '2px 6px', borderRadius: '4px' },
    badge: { background: 'rgba(6,182,212,0.2)', color: '#67e8f9', borderRadius: '12px', padding: '2px 8px', fontSize: '0.8rem', marginLeft: '8px' },
    bandejaHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
    emptyMsg: { color: '#475569', textAlign: 'center', padding: '32px 0', fontSize: '0.9rem' },
    // Botones
    btnPrimary: {
        padding: '10px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 600,
        background: 'linear-gradient(135deg, #0891b2, #06b6d4)', color: '#fff', fontSize: '0.9rem', transition: 'all 0.2s',
    },
    btnSuccess: {
        padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 600,
        background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', fontSize: '0.9rem',
    },
    btnDanger: {
        padding: '8px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer',
        background: 'rgba(239,68,68,0.2)', color: '#f87171', fontSize: '0.85rem',
    },
    btnAdd: {
        padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(6,182,212,0.3)',
        background: 'rgba(6,182,212,0.1)', color: '#67e8f9', cursor: 'pointer', fontSize: '0.78rem', width: '100%',
    },
    btnDelete: {
        padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)',
        background: 'rgba(239,68,68,0.1)', color: '#f87171', cursor: 'pointer', fontSize: '0.78rem',
    },
    btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
};
