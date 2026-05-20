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
            <div className="grid grid-cols-3 gap-2 py-3 border-b border-slate-700/50 items-center group hover:bg-slate-800/30 transition-colors px-2 rounded-lg">
                {/* NOSOTROS */}
                <div className={`flex items-center gap-2 text-sm font-bold ${isBetter ? 'text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.3)]' : isWorse ? 'text-rose-400 drop-shadow-[0_0_4px_rgba(251,113,133,0.3)]' : 'text-slate-300'}`}>
                    <div className="w-6 h-6 rounded bg-slate-800/80 flex items-center justify-center shadow-inner border border-slate-700/50">
                        {isBetter && <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
                        {isWorse && <TrendingDown className="w-3.5 h-3.5 text-rose-400" />}
                        {!isBetter && !isWorse && <Minus className="w-3.5 h-3.5 text-slate-500" />}
                    </div>
                    {format ? format(ours) : ours ?? "—"}
                </div>
                {/* MÉTRICA */}
                <div className="flex flex-col items-center justify-center">
                    {Icon && <Icon className="w-4 h-4 text-slate-500 mb-1" />}
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
                </div>
                {/* LÍDER */}
                <div className="text-sm font-bold text-amber-300 drop-shadow-[0_0_4px_rgba(252,211,77,0.3)] text-right flex items-center justify-end gap-2">
                    {format ? format(leaderVal) : leaderVal ?? "—"}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-amber-500/20 shadow-xl overflow-hidden shadow-amber-500/5 flex flex-col h-full">
            <div className="bg-gradient-to-r from-amber-900/60 to-orange-900/40 px-5 py-4 border-b border-amber-500/30 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                    <Trophy className="w-4 h-4 text-amber-400" />
                </div>
                <h3 className="text-sm font-black tracking-wide text-amber-400 uppercase">
                    Head-to-Head vs Líder
                </h3>
            </div>

            <div className="grid grid-cols-3 gap-2 px-5 py-3 bg-slate-950/50 text-xs font-black text-slate-500 tracking-wider">
                <div>NUESTRO ITEM</div>
                <div className="text-center">VS</div>
                <div className="text-right text-amber-500/70">#1 RANKING</div>
            </div>

            <div className="px-3 pb-3 flex-1 flex flex-col justify-center">
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
                <div className="px-5 py-3 bg-slate-950/80 text-xs text-slate-400 border-t border-slate-800">
                    <span className="font-bold text-slate-300">NOSOTROS:</span> <span className="text-slate-500">{ourItem.title || "Sin título"}</span>
                </div>
            )}
            <div className="px-5 py-3 bg-amber-950/30 text-xs text-amber-300/80 border-t border-amber-900/50">
                <span className="font-bold text-amber-500">LÍDER:</span> <span className="text-amber-500/60">{leader.title}</span>
            </div>
        </div>
    );
}
