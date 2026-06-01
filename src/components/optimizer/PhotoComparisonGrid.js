import React from 'react';
import { Camera, AlertTriangle } from 'lucide-react';

export default function PhotoComparisonGrid({ ourPhotos = [], compPhotos = [] }) {
    const ourCount = ourPhotos.length;
    const compCount = compPhotos.length;

    const renderPhotoList = (photos) => {
        return (
            <div style={styles.photoContainer}>
                {photos.map((p, i) => (
                    <div key={i} style={styles.photoWrapper}>
                        <img src={p.url} alt={`Foto ${i+1}`} style={styles.img} />
                        <div style={styles.overlay}>
                            <span style={styles.sizeText}>{p.size}</span>
                        </div>
                    </div>
                ))}
                {photos.length === 0 && (
                    <div style={styles.emptyText}>Sin fotos</div>
                )}
            </div>
        );
    };

    return (
        <div style={styles.grid}>
            {/* Nuestras fotos */}
            <div style={styles.column}>
                <div style={styles.header}>
                    <h4 style={styles.title}>Nuestras Fotos</h4>
                    <span style={ourCount >= 3 ? styles.badgeGreen : styles.badgeRed}>
                        {ourCount} {ourCount === 1 ? 'foto' : 'fotos'}
                    </span>
                </div>
                
                {ourCount < 3 && (
                    <div style={styles.alertRed}>
                        <AlertTriangle size={14} />
                        <span>Mínimo 3 fotos requeridas.</span>
                    </div>
                )}

                {renderPhotoList(ourPhotos)}
            </div>

            {/* Fotos Competidor */}
            <div style={styles.column}>
                <div style={styles.header}>
                    <h4 style={styles.title}>Líder (Competidor)</h4>
                    <span style={styles.badgeGray}>
                        {compCount} {compCount === 1 ? 'foto' : 'fotos'}
                    </span>
                </div>

                {compCount > ourCount && (
                    <div style={styles.alertBlue}>
                        <Camera size={14} />
                        <span>El líder tiene {compCount - ourCount} fotos más.</span>
                    </div>
                )}

                {renderPhotoList(compPhotos)}
            </div>
        </div>
    );
}

const styles = {
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', backgroundColor: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' },
    column: { display: 'flex', flexDirection: 'column', gap: '12px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    title: { margin: 0, fontSize: '0.9rem', color: '#f8fafc', fontWeight: 600 },
    
    badgeGreen: { backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 },
    badgeRed: { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 },
    badgeGray: { backgroundColor: 'rgba(255,255,255,0.1)', color: '#cbd5e1', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 },
    
    alertRed: { display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: '8px 12px', borderRadius: '6px', fontSize: '0.75rem' },
    alertBlue: { display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '8px 12px', borderRadius: '6px', fontSize: '0.75rem' },
    
    photoContainer: { display: 'flex', flexWrap: 'wrap', gap: '12px' },
    photoWrapper: { 
        position: 'relative', width: '90px', height: '90px', borderRadius: '8px', 
        backgroundColor: '#ffffff', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    img: { width: '100%', height: '100%', objectFit: 'contain' },
    overlay: { 
        position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', 
        color: 'white', fontSize: '0.65rem', textAlign: 'center', padding: '2px 0' 
    },
    sizeText: { opacity: 0.9 },
    emptyText: { color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic', padding: '10px 0' }
};
