'use client';

import { MapPin, Truck, AlertTriangle, Package, Navigation } from "lucide-react";

/**
 * LogisticsCard — Muestra Pickup Zones y métodos de envío MLV
 */
export default function LogisticsCard({ data }) {
    if (!data) return null;

    return (
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-blue-500/20 shadow-xl overflow-hidden shadow-blue-500/5 h-full flex flex-col">
            <div className="bg-gradient-to-r from-blue-900/60 to-cyan-900/40 px-5 py-4 border-b border-blue-500/30 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                    <Truck className="w-4 h-4 text-cyan-400" />
                </div>
                <h3 className="text-sm font-black tracking-wide text-cyan-400 uppercase">
                    Logística & Entregas (MLV)
                </h3>
            </div>

            <div className="p-5 flex-1 flex flex-col gap-5">
                {/* Zonas Pickup */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Zonas de Retiro (Pickup)</h4>
                    </div>
                    {data.pickup_zones?.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {data.pickup_zones.map((zone) => (
                                <span key={zone} className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-cyan-500/20 transition-colors cursor-default">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                    {zone.replace(/_/g, " ")}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <div className="text-sm font-bold text-amber-500">Sin retiro en persona</div>
                                <div className="text-xs text-amber-500/70 mt-0.5">Esto es una desventaja competitiva grave en Venezuela (el 80% prefiere pickup).</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Métodos de envío */}
                {data.delivery_methods?.length > 0 && (
                    <div className="pt-4 border-t border-slate-800">
                        <div className="flex items-center gap-2 mb-3">
                            <Package className="w-4 h-4 text-slate-400" />
                            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Envíos Nacionales</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {data.delivery_methods.map((method) => (
                                <span key={method} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg tracking-wide hover:bg-slate-700 transition-colors cursor-default">
                                    {method.replace(/_/g, " ").toUpperCase()}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Ubicación Vendedor */}
            {(data.seller_city || data.seller_state) && (
                <div className="px-5 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center gap-2 text-xs text-slate-400">
                    <Navigation className="w-3.5 h-3.5 text-slate-500" />
                    <span>Despacha desde: <strong className="text-slate-300">{data.seller_city || ""}{data.seller_state ? `, ${data.seller_state}` : ""}</strong></span>
                </div>
            )}
        </div>
    );
}
