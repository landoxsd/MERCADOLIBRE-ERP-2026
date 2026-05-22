'use client';

import { TrendingUp, TrendingDown, Minus, Camera, FileText, Hash, Trophy, DollarSign } from "lucide-react";

/**
 * WinnerCard — Comparativa cara a cara: Nosotros vs Líder
 */
export default function WinnerCard({ ourItem, leader }) {
    if (!leader) return null;

    const ourPrice = ourItem?.price || 0;
    const leaderPrice = leader.price_usd || 0;

    const ourPhotos = ourItem?.pictures || 0;
    const leaderPhotos = leader.pictures_count || 0;

    const ourTitleLen = ourItem?.title?.length || 0;
    const leaderTitleLen = leader.title?.length || 0;

    const ourAttrs = ourItem?.attributes?.length || 0;
    const leaderAttrs = leader.attributes_count || 0;

    const Row = ({ label, ours, leaderVal, icon: Icon, format }) => {
        const isBetter = ours !== undefined && leaderVal !== undefined &&
            (label === "Precio" ? ours <= leaderVal : ours > leaderVal);
        const isWorse = ours !== undefined && leaderVal !== undefined &&
            (label === "Precio" ? ours > leaderVal : ours < leaderVal);

        return (
            <div className="winner-row">
                {/* NOSOTROS */}
                <div className={`winner-cell-ours ${isBetter ? 'better-style' : isWorse ? 'worse-style' : 'neutral-style'}`}>
                    <div className="winner-trend-badge">
                        {isBetter && <TrendingUp size={14} className="better-style" />}
                        {isWorse && <TrendingDown size={14} className="worse-style" />}
                        {!isBetter && !isWorse && <Minus size={14} className="neutral-style" />}
                    </div>
                    {format ? format(ours) : ours ?? "—"}
                </div>
                {/* MÉTRICA */}
                <div className="winner-cell-metric">
                    {Icon && <Icon size={16} color="#64748b" style={{ marginBottom: '2px' }} />}
                    <span className="winner-metric-label">{label}</span>
                </div>
                {/* LÍDER */}
                <div className="winner-cell-leader">
                    {format ? format(leaderVal) : leaderVal ?? "—"}
                </div>
            </div>
        );
    };

    return (
        <div className="winner-card">
            <div className="winner-card-header">
                <div className="winner-card-icon-bg">
                    <Trophy size={18} color="#f59e0b" />
                </div>
                <h3 className="winner-card-title">
                    Head-to-Head vs Líder
                </h3>
            </div>

            <div className="winner-card-columns-header">
                <div>NUESTRO ITEM</div>
                <div style={{ textAlign: 'center' }}>VS</div>
                <div style={{ textAlign: 'right', color: 'rgba(245, 158, 11, 0.7)' }}>#1 RANKING</div>
            </div>

            <div className="winner-card-rows-container">
                <Row
                    label="Precio"
                    ours={ourPrice}
                    leaderVal={leaderPrice}
                    icon={DollarSign}
                    format={(v) => v ? `$${v.toFixed(2)}` : "—"}
                />
                <Row
                    label="Fotos"
                    ours={ourPhotos}
                    leaderVal={leaderPhotos}
                    icon={Camera}
                />
                <Row
                    label="Título (chars)"
                    ours={ourTitleLen}
                    leaderVal={leaderTitleLen}
                    icon={FileText}
                />
                <Row
                    label="Atributos"
                    ours={ourAttrs}
                    leaderVal={leaderAttrs}
                    icon={Hash}
                />
            </div>

            {ourItem && (
                <div className="winner-card-footer">
                    <span style={{ fontWeight: '800', color: '#cbd5e1' }}>NOSOTROS:</span>{' '}
                    <span style={{ color: '#64748b' }}>{ourItem.title || "Sin título"}</span>
                </div>
            )}
            <div 
                className="winner-card-footer" 
                style={{ 
                    background: 'rgba(120, 53, 4, 0.1)', 
                    borderTop: '1px solid rgba(245, 158, 11, 0.2)', 
                    color: '#f59e0b' 
                }}
            >
                <span style={{ fontWeight: '800' }}>LÍDER:</span>{' '}
                <span style={{ color: 'rgba(245, 158, 11, 0.7)' }}>{leader.title}</span>
            </div>
        </div>
    );
}

