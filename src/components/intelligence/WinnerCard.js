'use client';

import { TrendingUp, TrendingDown, Minus, Camera, FileText, Hash } from "lucide-react";

/**
 * WinnerCard — Comparativa cara a cara: Nosotros vs Líder
 */
export default function WinnerCard({ ourItem, leader }) {
    if (!leader) return null;

    const ourPrice = ourItem?.price || 0;
    const leaderPrice = leader.price_usd || 0;
    const priceDiff = ourPrice - leaderPrice;

    const ourPhotos = ourItem?.pictures || 0;
    const leaderPhotos = leader.pictures_count || 0;

    const ourTitleLen = ourItem?.title?.length || 0;
    const leaderTitleLen = leader.title?.length || 0;

    const ourAttrs = ourItem?.attributes?.length || 0;
    const leaderAttrs = leader.attributes_count || 0;

    const Row = ({ label, ours, leaderVal, icon: Icon, format }) => {
        const isBetter = ours !== undefined && leaderVal !== undefined &&
            (label === "Precio" ? ours <= leaderVal : ours >= leaderVal);
        const isWorse = ours !== undefined && leaderVal !== undefined &&
            (label === "Precio" ? ours > leaderVal : ours < leaderVal);

        return (
            <div className="grid grid-cols-3 gap-2 py-2 border-b border-slate-700/50 items-center">
                <div className={`text-sm font-medium ${isBetter ? 'text-emerald-400' : isWorse ? 'text-rose-400' : 'text-slate-300'}`}>
                    {Icon && <Icon className="w-3.5 h-3.5 inline mr-1" />}
                    {format ? format(ours) : ours ?? "—"}
                    {isBetter && <TrendingUp className="w-3 h-3 inline ml-1 text-emerald-400" />}
                    {isWorse && <TrendingDown className="w-3 h-3 inline ml-1 text-rose-400" />}
                    {!isBetter && !isWorse && ours !== undefined && <Minus className="w-3 h-3 inline ml-1 text-slate-500" />}
                </div>
                <div className="text-xs text-slate-400 text-center">{label}</div>
                <div className="text-sm text-slate-300 text-right">
                    {format ? format(leaderVal) : leaderVal ?? "—"}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-900/40 to-orange-900/40 px-4 py-3 border-b border-slate-700">
                <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                    🏆 Comparativa vs Líder
                </h3>
            </div>

            <div className="grid grid-cols-3 gap-2 px-4 py-2 bg-slate-800/50 text-xs font-semibold text-slate-400">
                <div>NOSOTROS</div>
                <div className="text-center">MÉTRICA</div>
                <div className="text-right">LÍDER</div>
            </div>

            <div className="px-4 pb-3">
                <Row
                    label="Precio"
                    ours={ourPrice}
                    leaderVal={leaderPrice}
                    icon={null}
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
                <div className="px-4 py-2 bg-slate-800/30 text-xs text-slate-400 border-t border-slate-700/50">
                    <span className="font-semibold">Nuestro título:</span> {ourItem.title || "Sin título"}
                </div>
            )}
            <div className="px-4 py-2 bg-amber-900/10 text-xs text-amber-300/80 border-t border-slate-700/50">
                <span className="font-semibold">Título líder:</span> {leader.title}
            </div>
        </div>
    );
}
