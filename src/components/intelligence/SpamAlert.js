'use client';

import { AlertTriangle } from "lucide-react";

/**
 * SpamAlert — Alerta de palabras penalizadas detectadas
 */
export default function SpamAlert({ words }) {
    if (!words || words.length === 0) return null;

    return (
        <div className="spam-alert-box">
            <div className="spam-alert-header">
                <AlertTriangle size={16} />
                <span>Palabras penalizadas detectadas</span>
            </div>
            <p className="spam-alert-desc">
                Elimina del título: <span style={{ fontWeight: 800 }}>{words.join(", ")}</span>. MLV penaliza términos de urgencia.
            </p>
        </div>
    );
}

