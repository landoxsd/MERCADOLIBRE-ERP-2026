'use client';

/**
 * LogisticsCard — Muestra Pickup Zones y métodos de envío MLV
 */
export default function LogisticsCard({ data }) {
    if (!data) return null;

    return (
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">🚚 Logística Venezuela</h4>

            {data.pickup_zones?.length > 0 ? (
                <div className="mb-2">
                    <span className="text-xs text-slate-400">Zonas Pickup:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {data.pickup_zones.map((zone) => (
                            <span key={zone} className="bg-blue-900/50 text-blue-300 text-xs px-2 py-1 rounded">
                                {zone.replace(/_/g, " ")}
                            </span>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="text-yellow-500 text-xs mb-2">
                    ⚠️ No ofrece pickup (desventaja en MLV)
                </div>
            )}

            {data.delivery_methods?.length > 0 && (
                <div>
                    <span className="text-xs text-slate-400">Envíos mencionados:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {data.delivery_methods.map((method) => (
                            <span key={method} className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded">
                                {method.replace(/_/g, " ").toUpperCase()}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {(data.seller_city || data.seller_state) && (
                <div className="mt-2 text-xs text-slate-400">
                    Ubicación vendedor: {data.seller_city || ""}{data.seller_state ? `, ${data.seller_state}` : ""}
                </div>
            )}
        </div>
    );
}
