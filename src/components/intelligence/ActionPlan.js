'use client';

import { AlertCircle, ArrowRight, ChevronRight } from "lucide-react";

/**
 * ActionPlan — Lista priorizada de acciones sugeridas
 */
export default function ActionPlan({ actions }) {
    if (!actions || actions.length === 0) {
        return (
            <div className="action-plan-empty">
                <p>🎉 ¡Tu publicación está optimizada! No hay acciones urgentes.</p>
            </div>
        );
    }

    const priorityConfig = {
        high: {
            badge: "🔴 ALTA",
            badgeClass: "priority-badge priority-high",
            borderStyle: { borderLeft: '4px solid #f43f5e' },
        },
        medium: {
            badge: "🟡 MEDIA",
            badgeClass: "priority-badge priority-medium",
            borderStyle: { borderLeft: '4px solid #f59e0b' },
        },
        low: {
            badge: "🟢 BAJA",
            badgeClass: "priority-badge priority-low",
            borderStyle: { borderLeft: '4px solid #10b981' },
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
        <div className="action-plan-wrapper">
            {actions.map((action, idx) => {
                const cfg = priorityConfig[action.priority] || priorityConfig.low;
                return (
                    <div
                        key={idx}
                        className="action-item"
                        style={cfg.borderStyle}
                    >
                        <div className="action-item-left">
                            <div className="action-meta-row">
                                <span className={cfg.badgeClass}>
                                    {cfg.badge}
                                </span>
                                <span className="action-type-text">
                                    {typeIcons[action.type] || "⚡"} {action.type}
                                </span>
                            </div>
                            <p className="action-detail">
                                {action.detail}
                            </p>
                            {action.current_value !== undefined && action.target_value !== undefined && (
                                <div className="action-diff-row">
                                    <span className="action-diff-current">{String(action.current_value)}</span>
                                    <ArrowRight size={12} />
                                    <span className="action-diff-target">{String(action.target_value)}</span>
                                </div>
                            )}
                            {action.impact_estimate && (
                                <div className="action-impact">
                                    <AlertCircle size={12} />
                                    <span>Impacto estimado: {action.impact_estimate}</span>
                                </div>
                            )}
                        </div>
                        <ChevronRight size={16} color="#475569" style={{ marginTop: '4px', flexShrink: 0 }} />
                    </div>
                );
            })}
        </div>
    );
}

