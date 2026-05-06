'use client';

import { AlertCircle, ArrowRight, ChevronRight } from "lucide-react";

/**
 * ActionPlan — Lista priorizada de acciones sugeridas
 */
export default function ActionPlan({ actions }) {
    if (!actions || actions.length === 0) {
        return (
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 text-center">
                <p className="text-sm text-slate-400">🎉 ¡Tu publicación está optimizada! No hay acciones urgentes.</p>
            </div>
        );
    }

    const priorityConfig = {
        high: {
            badge: "🔴 ALTA",
            badgeClass: "bg-rose-900/50 text-rose-300 border-rose-700",
            border: "border-l-4 border-l-rose-500",
        },
        medium: {
            badge: "🟡 MEDIA",
            badgeClass: "bg-amber-900/50 text-amber-300 border-amber-700",
            border: "border-l-4 border-l-amber-500",
        },
        low: {
            badge: "🟢 BAJA",
            badgeClass: "bg-emerald-900/50 text-emerald-300 border-emerald-700",
            border: "border-l-4 border-l-emerald-500",
        },
    };

    const typeIcons = {
        price: "💰",
        seo: "📝",
        attributes: "🏷️",
        content: "📸",
        logistics: "🚚",
    };

    return (
        <div className="space-y-2">
            {actions.map((action, idx) => {
                const cfg = priorityConfig[action.priority] || priorityConfig.low;
                return (
                    <div
                        key={idx}
                        className={`bg-slate-800 rounded-lg p-3 border border-slate-700 ${cfg.border} hover:bg-slate-750 transition-colors`}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cfg.badgeClass}`}>
                                        {cfg.badge}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        {typeIcons[action.type] || "⚡"} {action.type}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-200 font-medium">
                                    {action.detail}
                                </p>
                                {action.current_value !== undefined && action.target_value !== undefined && (
                                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                                        <span className="line-through">{String(action.current_value)}</span>
                                        <ArrowRight className="w-3 h-3" />
                                        <span className="text-emerald-400 font-semibold">{String(action.target_value)}</span>
                                    </div>
                                )}
                                {action.impact_estimate && (
                                    <p className="text-xs text-cyan-400 mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        Impacto estimado: {action.impact_estimate}
                                    </p>
                                )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-600 mt-1 shrink-0" />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
