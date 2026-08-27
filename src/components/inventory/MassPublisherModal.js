"use client";
import { useState, useEffect, useRef } from "react";
import { 
  Rocket, 
  Folder, 
  Sparkles, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  ExternalLink, 
  RefreshCw, 
  Image as ImageIcon,
  ShieldCheck,
  X
} from "lucide-react";

export default function MassPublisherModal({ 
  isOpen, 
  onClose, 
  selectedItems = [], 
  accountId,
  defaultPhotosPath = "C:\\Users\\ORLANDO\\Pictures\\FOTOS" 
}) {
  const [photosPath, setPhotosPath] = useState(defaultPhotosPath);
  const [listingType, setListingType] = useState("gold_special");
  const [usePlaceholder, setUsePlaceholder] = useState(true);
  const [useAI, setUseAI] = useState(true);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0, success: 0, skipped: 0, errors: 0 });
  const [isFinished, setIsFinished] = useState(false);
  
  const logContainerRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (defaultPhotosPath) {
      setPhotosPath(defaultPhotosPath);
    }
  }, [defaultPhotosPath]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  const handleStartPublishing = async () => {
    if (!accountId) {
      alert("Debes seleccionar una cuenta activa de Mercado Libre.");
      return;
    }
    if (selectedItems.length === 0) {
      alert("No hay productos seleccionados para publicar.");
      return;
    }

    setIsProcessing(true);
    setIsFinished(false);
    setProgress(0);
    setLogs([]);
    setStats({ total: selectedItems.length, success: 0, skipped: 0, errors: 0 });

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/account/publications/publish-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          accountId,
          items: selectedItems,
          photosPath,
          listingTypeId: listingType,
          usePlaceholderIfNoPhoto: usePlaceholder,
          useAI
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status} en el servidor`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop(); // Mantener el último fragmento incompleto

        for (const eventStr of events) {
          if (!eventStr.trim()) continue;

          const lines = eventStr.split("\n");
          let eventType = "message";
          let dataStr = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.replace("event: ", "").trim();
            } else if (line.startsWith("data: ")) {
              dataStr = line.replace("data: ", "").trim();
            }
          }

          if (dataStr) {
            try {
              const data = JSON.parse(dataStr);
              handleStreamEvent(eventType, data);
            } catch (err) {
              console.error("Error parseando SSE data:", err);
            }
          }
        }
      }

    } catch (err) {
      if (err.name !== "AbortError") {
        setLogs(prev => [...prev, {
          type: "error",
          text: `❌ Error de red: ${err.message}`
        }]);
      }
    } finally {
      setIsProcessing(false);
      setIsFinished(true);
    }
  };

  const handleStreamEvent = (eventType, data) => {
    if (eventType === "start") {
      setStats(prev => ({ ...prev, total: data.total }));
      setLogs(prev => [...prev, {
        type: "info",
        text: `🚀 Iniciando lote de ${data.total} productos. Tienda Oficial: ${data.officialStoreId || 'N/A'}`
      }]);
    } else if (eventType === "item_status") {
      setLogs(prev => [...prev, {
        type: "status",
        text: `[${data.index}/${data.total}] SKU: ${data.sku} ➔ ${data.status}`
      }]);
    } else if (eventType === "item_success") {
      setStats(prev => {
        const newSuccess = prev.success + 1;
        const processed = newSuccess + prev.skipped + prev.errors;
        setProgress(Math.round((processed / prev.total) * 100));
        return { ...prev, success: newSuccess };
      });
      setLogs(prev => [...prev, {
        type: "success",
        sku: data.sku,
        meliId: data.meli_id,
        permalink: data.permalink,
        hasPhoto: data.hasLocalPhoto,
        text: `✅ [${data.index}/${data.total}] ${data.sku} ➔ ${data.title} (${data.hasLocalPhoto ? '📸 Foto Real' : '🏷️ Placeholder'})`
      }]);
    } else if (eventType === "item_skipped") {
      setStats(prev => {
        const newSkipped = prev.skipped + 1;
        const processed = prev.success + newSkipped + prev.errors;
        setProgress(Math.round((processed / prev.total) * 100));
        return { ...prev, skipped: newSkipped };
      });
      setLogs(prev => [...prev, {
        type: "warning",
        text: `⚠️ [${data.index}/${data.total}] ${data.sku} OMITIDO: ${data.reason}`
      }]);
    } else if (eventType === "item_error") {
      setStats(prev => {
        const newErrors = prev.errors + 1;
        const processed = prev.success + prev.skipped + newErrors;
        setProgress(Math.round((processed / prev.total) * 100));
        return { ...prev, errors: newErrors };
      });
      setLogs(prev => [...prev, {
        type: "error",
        text: `❌ [${data.index}/${data.total}] ${data.sku} ERROR: ${data.error}`
      }]);
    } else if (eventType === "complete") {
      setProgress(100);
      setIsFinished(true);
      setLogs(prev => [...prev, {
        type: "finish",
        text: `🎉 LOTE FINALIZADO en ${data.elapsedSeconds}s. Exitosos: ${data.totalSuccess} | Omitidos: ${data.totalSkipped} | Errores: ${data.totalErrors}`
      }]);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
      setLogs(prev => [...prev, { type: "warning", text: "⏹️ Proceso detenido por el usuario." }]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-900/30 to-purple-900/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Rocket size={22} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Publicador Masivo vía API
                <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <ShieldCheck size={12} /> Tienda Oficial
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Publicación directa 100% automatizada con fotos locales y Gemini IA
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors disabled:opacity-30"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* Configuración de Carpeta y Opciones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
            
            {/* Input de Carpeta Local */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Folder size={14} className="text-yellow-400" />
                Carpeta Local de Imágenes (en este equipo):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={photosPath}
                  onChange={(e) => setPhotosPath(e.target.value)}
                  disabled={isProcessing}
                  placeholder="Ej: C:\Users\ORLANDO\Pictures\FOTOS"
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                El publicador buscará archivos que coincidan con el SKU (ej. <code className="text-blue-300 font-mono">SKU.jpg</code>, <code className="text-blue-300 font-mono">SKU-1.jpg</code>).
              </p>
            </div>

            {/* Tipo de Publicación */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Tipo de Exposición:
              </label>
              <select
                value={listingType}
                onChange={(e) => setListingType(e.target.value)}
                disabled={isProcessing}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50"
              >
                <option value="gold_special">Clásica (gold_special) - Comisión regular</option>
                <option value="gold_pro">Premium (gold_pro) - Máxima exposición</option>
              </select>
            </div>

            {/* Flags de Fotos e IA */}
            <div className="flex flex-col justify-center space-y-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={usePlaceholder}
                  onChange={(e) => setUsePlaceholder(e.target.checked)}
                  disabled={isProcessing}
                  className="rounded border-slate-700 bg-slate-950 text-blue-500 focus:ring-blue-500 w-4 h-4"
                />
                <span>Usar imagen provisional si no hay foto local</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={useAI}
                  onChange={(e) => setUseAI(e.target.checked)}
                  disabled={isProcessing}
                  className="rounded border-slate-700 bg-slate-950 text-purple-500 focus:ring-purple-500 w-4 h-4"
                />
                <span className="flex items-center gap-1">
                  <Sparkles size={13} className="text-purple-400" />
                  Enriquecer con Gemini 3.6 Flash IA (4 keys activas)
                </span>
              </label>
            </div>

          </div>

          {/* Resumen del Lote & Progreso */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Progreso del Lote:</span>
              <span className="font-mono font-bold text-blue-400 text-sm">{progress}%</span>
            </div>

            {/* Barra de progreso */}
            <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5">
              <div 
                className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Tarjetas de Estadísticas */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Total</div>
                <div className="text-base font-bold text-white font-mono">{selectedItems.length}</div>
              </div>
              <div className="bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-800/30 text-center">
                <div className="text-[10px] text-emerald-400 uppercase font-semibold flex items-center justify-center gap-1">
                  <CheckCircle size={10} /> Publicados
                </div>
                <div className="text-base font-bold text-emerald-400 font-mono">{stats.success}</div>
              </div>
              <div className="bg-amber-950/20 p-2.5 rounded-xl border border-amber-800/30 text-center">
                <div className="text-[10px] text-amber-400 uppercase font-semibold flex items-center justify-center gap-1">
                  <AlertTriangle size={10} /> Omitidos
                </div>
                <div className="text-base font-bold text-amber-400 font-mono">{stats.skipped}</div>
              </div>
              <div className="bg-rose-950/20 p-2.5 rounded-xl border border-rose-800/30 text-center">
                <div className="text-[10px] text-rose-400 uppercase font-semibold flex items-center justify-center gap-1">
                  <XCircle size={10} /> Errores
                </div>
                <div className="text-base font-bold text-rose-400 font-mono">{stats.errors}</div>
              </div>
            </div>
          </div>

          {/* Consola de Logs en Vivo */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Bitácora de Ejecución en Vivo:</span>
              <span className="text-[10px] text-slate-500 font-mono">{logs.length} eventos</span>
            </div>
            
            <div 
              ref={logContainerRef}
              className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 h-48 overflow-y-auto font-mono text-xs space-y-1.5 custom-scrollbar"
            >
              {logs.length === 0 ? (
                <div className="text-slate-600 italic text-center py-16">
                  Presiona "Iniciar Publicación Masiva" para procesar los productos seleccionados.
                </div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 leading-relaxed">
                    {log.type === "success" && (
                      <div className="text-emerald-400 flex items-center gap-1.5 flex-1">
                        <span>{log.text}</span>
                        {log.permalink && (
                          <a 
                            href={log.permalink} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center text-blue-400 hover:text-blue-300 hover:underline gap-0.5 ml-1"
                          >
                            <ExternalLink size={11} /> Ver en ML
                          </a>
                        )}
                      </div>
                    )}
                    {log.type === "warning" && <span className="text-amber-400">{log.text}</span>}
                    {log.type === "error" && <span className="text-rose-400 font-semibold">{log.text}</span>}
                    {log.type === "status" && <span className="text-slate-400">{log.text}</span>}
                    {log.type === "info" && <span className="text-blue-400 font-semibold">{log.text}</span>}
                    {log.type === "finish" && <span className="text-purple-400 font-bold">{log.text}</span>}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {selectedItems.length} items listos para procesar
          </div>

          <div className="flex items-center gap-3">
            {isProcessing ? (
              <button
                onClick={handleStop}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-rose-600/20"
              >
                <XCircle size={16} /> Detener Lote
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
                >
                  {isFinished ? "Cerrar" : "Cancelar"}
                </button>

                <button
                  onClick={handleStartPublishing}
                  disabled={selectedItems.length === 0}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2 disabled:opacity-50"
                >
                  <Rocket size={16} /> Iniciar Publicación Masiva
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
