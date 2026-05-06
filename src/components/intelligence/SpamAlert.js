'use client';

import { AlertTriangle } from "lucide-react";

/**
 * SpamAlert — Alerta de palabras penalizadas detectadas
 */
export default function SpamAlert({ words }) {
    if (!words || words.length === 0) return null;

    return (
        <div className="bg-red-900/30 border border-red-700 p-3 rounded-lg mb-4">
            <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Palabras penalizadas detectadas</span>
            </div>
            <p className="text-xs text-red-300 mt-1">
                Elimina del título: <span className="font-bold">{words.join(", ")}</span>. MLV penaliza términos de urgencia.
            </p>
        </div>
    );
}
