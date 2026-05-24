"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Radar, ArrowLeft, Loader2, AlertTriangle, ShieldAlert } from "lucide-react";
import Link from "next/link";
import TopProductsTable from "@/components/radar/TopProductsTable";

export default function CategoryTopProductsPage() {
    const params = useParams();
    const router = useRouter();
    const categoryId = params.category_id;

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!categoryId) return;

        const fetchTopProducts = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/tools/radar/top-products?category_id=${categoryId.toUpperCase()}`);
                const resData = await res.json();
                
                if (!res.ok) {
                    throw new Error(resData.error || "Error al obtener los top productos de la categoría");
                }
                
                setData(resData);
            } catch (err) {
                console.error("Error fetching top products:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTopProducts();
    }, [categoryId]);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Navigation Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-xl">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold uppercase tracking-wider">
                        <Radar size={14} />
                        Radar de Mercado
                    </div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        {loading ? (
                            "Cargando Categoría..."
                        ) : error ? (
                            "Error de Carga"
                        ) : (
                            <>
                                Top 20 Ganadores: <span className="text-indigo-400">{data.category_name}</span>
                            </>
                        )}
                    </h1>
                    <p className="text-slate-400 text-sm">
                        {loading 
                            ? "Escaneando y clasificando productos..." 
                            : error 
                                ? "No pudimos procesar tu solicitud." 
                                : `Análisis en tiempo real sobre la muestra de ${data.sample_size} publicaciones líderes.`
                        }
                    </p>
                </div>

                <Link
                    href="/dashboard/radar"
                    className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-sm font-medium transition-colors border border-slate-700/60"
                >
                    <ArrowLeft size={16} />
                    Volver al Radar
                </Link>
            </div>

            {/* Content states */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4 bg-slate-900/10 border border-slate-850 rounded-2xl">
                    <Loader2 size={40} className="text-indigo-500 animate-spin" />
                    <div className="text-center space-y-1">
                        <h3 className="text-sm font-bold text-white">Escaneo Profundo en Progreso</h3>
                        <p className="text-xs text-slate-500 max-w-xs">
                            Paginando resultados de Mercado Libre y calculando participaciones de mercado...
                        </p>
                    </div>
                </div>
            ) : error ? (
                <div className="p-6 bg-red-950/20 border border-red-900/50 rounded-2xl flex flex-col items-center justify-center text-center space-y-4 py-20">
                    <div className="p-4 bg-red-500/10 text-red-400 rounded-full">
                        <AlertTriangle size={32} />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-lg font-bold text-red-200">No se pudo escanear la categoría</h3>
                        <p className="text-sm text-slate-400 max-w-md mx-auto">
                            {error}
                        </p>
                    </div>
                    <button 
                        onClick={() => router.refresh()} 
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-xs font-semibold border border-slate-700"
                    >
                        Reintentar Escaneo
                    </button>
                </div>
            ) : (
                <TopProductsTable data={data} />
            )}
        </div>
    );
}
