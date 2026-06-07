import React, { useState, useEffect } from 'react';
import { Camera, Plus, Check, Loader2, AlertTriangle, ExternalLink, Upload } from 'lucide-react';

/**
 * PhotoManager — Panel accionable de gestión de fotos para el Optimizer.
 * Carga las fotos del Banco de Imágenes (Supabase) filtradas por SKU,
 * las muestra como seleccionables y permite aplicarlas a la publicación en ML.
 */
export default function PhotoManager({ accountId, itemId, sku, currentPhotos = [], minRequired = 3, onPhotosUpdated }) {
    const [bankPhotos, setBankPhotos] = useState([]);
    const [loadingBank, setLoadingBank] = useState(false);
    const [applying, setApplying] = useState(null); // pictureId que se está aplicando
    const [applied, setApplied] = useState(new Set()); // pictureIds ya añadidos en esta sesión
    const [error, setError] = useState(null);
    const [localPhotos, setLocalPhotos] = useState(currentPhotos);

    const currentCount = localPhotos.length;
    const stillNeeded = Math.max(0, minRequired - currentCount);

    // IDs de fotos ya en la publicación (para no mostrar duplicados como disponibles)
    const currentPictureIds = new Set(localPhotos.map(p => p.id || p.url));

    useEffect(() => {
        if (sku && accountId && itemId) loadBankPhotos();
    }, [sku, accountId, itemId]);

    const loadBankPhotos = async () => {
        setLoadingBank(true);
        setError(null);
        try {
            const res = await fetch('/api/tools/optimizer/photos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId, itemId, sku, action: 'list' })
            });
            const data = await res.json();
            if (data.success) setBankPhotos(data.photos || []);
            else setError(data.error);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoadingBank(false);
        }
    };

    const applyPhoto = async (photo) => {
        setApplying(photo.pictureId);
        setError(null);
        try {
            const res = await fetch('/api/tools/optimizer/photos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountId, itemId, sku,
                    action: 'apply',
                    pictureId: photo.pictureId,
                    pictureUrl: photo.url
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Error al aplicar foto');

            setApplied(prev => new Set([...prev, photo.pictureId]));
            const newCount = data.picturesCount || localPhotos.length + 1;
            // Actualizar conteo local
            setLocalPhotos(prev => [...prev, { id: photo.pictureId, url: photo.url }]);
            if (onPhotosUpdated) onPhotosUpdated(newCount);
        } catch (e) {
            setError(e.message);
        } finally {
            setApplying(null);
        }
    };

    const [hoveredPhoto, setHoveredPhoto] = useState(null);

    const availablePhotos = bankPhotos.filter(p => !applied.has(p.pictureId));

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerLeft}>
                    <Camera size={18} color="#a855f7" />
                    <span style={styles.headerTitle}>Gestión de Fotos</span>
                </div>
                <div style={styles.headerRight}>
                    <span style={currentCount >= minRequired ? styles.countGood : styles.countBad}>
                        {currentCount}/{minRequired} fotos mínimas
                    </span>
                    <a
                        href={`https://www.mercadolibre.com.ve/anuncios/edicion/${itemId}#pictures`}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.mlLink}
                        title="Abrir editor de fotos en ML"
                    >
                        Abrir en ML <ExternalLink size={12} />
                    </a>
                </div>
            </div>

            {/* Alerta si faltan fotos */}
            {stillNeeded > 0 && (
                <div style={styles.alert}>
                    <AlertTriangle size={14} />
                    <span>Te faltan <strong>{stillNeeded}</strong> foto{stillNeeded > 1 ? 's' : ''} para cumplir el mínimo requerido por Mercado Libre.</span>
                </div>
            )}

            {/* Fotos actuales del ítem */}
            <div style={styles.section}>
                <div style={styles.sectionTitle}>Fotos actuales en la publicación</div>
                <div style={styles.photoGrid}>
                    {localPhotos.map((p, i) => (
                        <div key={i} style={styles.photoThumb}>
                            <img src={p.url || p.secure_url} alt={`Foto ${i + 1}`} style={styles.img} />
                            <div style={styles.photoIndex}>{i + 1}</div>
                        </div>
                    ))}
                    {localPhotos.length === 0 && (
                        <div style={styles.noPhotos}>Sin fotos</div>
                    )}
                </div>
            </div>

            {/* Banco de Imágenes */}
            <div style={styles.section}>
                <div style={styles.sectionTitleRow}>
                    <div style={styles.sectionTitle}>
                        Banco de Imágenes (SKU: {sku || 'No disponible'})
                    </div>
                    {sku && (
                        <button onClick={loadBankPhotos} style={styles.reloadBtn} disabled={loadingBank}>
                            {loadingBank ? <Loader2 size={12} style={{animation:'spin 1s linear infinite'}} /> : '↺'} Recargar
                        </button>
                    )}
                </div>

                {!sku ? (
                    <div style={styles.noSkuMsg}>
                        <span>Este ítem no tiene SKU registrado en el banco de imágenes.</span>
                        <a href="/dashboard/images" style={styles.bankLink}>Ir al Banco de Imágenes →</a>
                    </div>
                ) : loadingBank ? (
                    <div style={styles.loading}>
                        <Loader2 size={20} style={{animation:'spin 1s linear infinite'}} />
                        <span>Buscando fotos en el banco...</span>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
                    </div>
                ) : availablePhotos.length === 0 ? (
                    <div style={styles.emptyBank}>
                        <span>No hay fotos disponibles en el banco para este SKU.</span>
                        <a href="/dashboard/images" style={styles.bankLink}>Gestionar Banco de Imágenes →</a>
                    </div>
                ) : (
                    <>
                        <div style={styles.bankNote}>
                            Haz clic en una foto para añadirla directamente a tu publicación en Mercado Libre.
                        </div>
                        <div style={styles.photoGrid}>
                            {availablePhotos.map((photo) => {
                                const isApplying = applying === photo.pictureId;
                                const isApplied = applied.has(photo.pictureId);
                                return (
                                    <div
                                        key={photo.pictureId}
                                        style={{
                                            ...styles.bankPhoto,
                                            ...(isApplied ? styles.bankPhotoApplied : {}),
                                            ...(isApplying ? styles.bankPhotoLoading : {})
                                        }}
                                        onClick={() => !isApplying && !isApplied && applyPhoto(photo)}
                                        onMouseEnter={() => !isApplied && setHoveredPhoto(photo.pictureId)}
                                        onMouseLeave={() => setHoveredPhoto(null)}
                                        title={isApplied ? 'Ya añadida' : 'Clic para añadir a la publicación'}
                                    >
                                        <img src={photo.url} alt="Banco" style={styles.img} />
                                        <div style={{
                                            ...styles.bankOverlay,
                                            opacity: (isApplying || isApplied || hoveredPhoto === photo.pictureId) ? 1 : 0
                                        }}>
                                            {isApplying ? (
                                                <Loader2 size={20} color="white" style={{animation:'spin 1s linear infinite'}} />
                                            ) : isApplied ? (
                                                <Check size={20} color="#10b981" />
                                            ) : (
                                                <Plus size={20} color="white" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {error && (
                <div style={styles.errorMsg}>
                    <AlertTriangle size={14} /> {error}
                </div>
            )}
        </div>
    );
}

const styles = {
    container: {
        backgroundColor: 'rgba(168, 85, 247, 0.05)',
        border: '1px solid rgba(168, 85, 247, 0.2)',
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
    },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '8px' },
    headerTitle: { fontWeight: 700, fontSize: '1rem', color: '#f8fafc' },
    headerRight: { display: 'flex', alignItems: 'center', gap: '12px' },
    countGood: { fontSize: '0.8rem', fontWeight: 600, color: '#34d399', backgroundColor: 'rgba(16,185,129,0.1)', padding: '3px 8px', borderRadius: '20px' },
    countBad: { fontSize: '0.8rem', fontWeight: 600, color: '#f87171', backgroundColor: 'rgba(239,68,68,0.1)', padding: '3px 8px', borderRadius: '20px' },
    mlLink: { display: 'flex', alignItems: 'center', gap: '4px', color: '#38bdf8', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 600 },

    alert: { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem' },

    section: { display: 'flex', flexDirection: 'column', gap: '10px' },
    sectionTitle: { fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' },
    sectionTitleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    reloadBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' },

    photoGrid: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
    photoThumb: { position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
    img: { width: '100%', height: '100%', objectFit: 'contain' },
    photoIndex: { position: 'absolute', top: '4px', left: '4px', backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px' },
    noPhotos: { color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic' },

    bankNote: { fontSize: '0.8rem', color: '#64748b' },
    bankPhoto: {
        position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden',
        backgroundColor: '#fff', border: '2px solid rgba(168,85,247,0.3)', cursor: 'pointer',
        transition: 'border-color 0.2s, transform 0.2s'
    },
    bankPhotoApplied: { border: '2px solid rgba(16,185,129,0.6)', cursor: 'default' },
    bankPhotoLoading: { opacity: 0.7, cursor: 'wait' },
    bankOverlay: {
        position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: 0, transition: 'opacity 0.2s'
    },

    loading: { display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8', fontSize: '0.9rem', padding: '16px 0' },
    emptyBank: { display: 'flex', flexDirection: 'column', gap: '8px', color: '#64748b', fontSize: '0.85rem', padding: '12px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px' },
    noSkuMsg: { display: 'flex', flexDirection: 'column', gap: '8px', color: '#64748b', fontSize: '0.85rem' },
    bankLink: { color: '#a855f7', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' },
    errorMsg: { display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171', fontSize: '0.8rem', backgroundColor: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '6px' }
};
