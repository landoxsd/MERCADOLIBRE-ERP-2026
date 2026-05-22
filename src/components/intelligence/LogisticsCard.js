'use client';

import { MapPin, Truck, AlertTriangle, Package, Navigation } from "lucide-react";

/**
 * LogisticsCard — Muestra Pickup Zones y métodos de envío MLV
 */
export default function LogisticsCard({ data }) {
    if (!data) return null;

    return (
        <div className="logistics-card">
            <div className="logistics-card-header">
                <div className="logistics-card-icon-bg">
                    <Truck size={18} color="#22d3ee" />
                </div>
                <h3 className="logistics-card-title">
                    Logística & Entregas (MLV)
                </h3>
            </div>

            <div className="logistics-card-body">
                {/* Zonas Pickup */}
                <div className="logistics-section">
                    <div className="logistics-section-header">
                        <MapPin size={16} color="#64748b" />
                        <h4 className="logistics-section-title">Zonas de Retiro (Pickup)</h4>
                    </div>
                    {data.pickup_zones?.length > 0 ? (
                        <div className="badge-pill-container">
                            {data.pickup_zones.map((zone) => (
                                <span key={zone} className="badge-pill-cyan">
                                    <div className="badge-pill-pulse" />
                                    {zone.replace(/_/g, " ")}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <div className="no-pickup-banner">
                            <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div>
                                <div className="no-pickup-title">Sin retiro en persona</div>
                                <div className="no-pickup-desc">Esto es una desventaja competitiva grave en Venezuela (el 80% prefiere pickup).</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Métodos de envío */}
                {data.delivery_methods?.length > 0 && (
                    <div className="logistics-section" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '16px' }}>
                        <div className="logistics-section-header">
                            <Package size={16} color="#64748b" />
                            <h4 className="logistics-section-title">Envíos Nacionales</h4>
                        </div>
                        <div className="badge-pill-container">
                            {data.delivery_methods.map((method) => (
                                <span key={method} className="badge-pill-slate">
                                    {method.replace(/_/g, " ").toUpperCase()}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Ubicación Vendedor */}
            {(data.seller_city || data.seller_state) && (
                <div className="logistics-card-footer">
                    <Navigation size={14} color="#64748b" />
                    <span>Despacha desde: <strong style={{ color: '#cbd5e1' }}>{data.seller_city || ""}{data.seller_state ? `, ${data.seller_state}` : ""}</strong></span>
                </div>
            )}
        </div>
    );
}

