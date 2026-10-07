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
  Image as ImageIcon,
  ShieldCheck,
  X,
  Eye,
  ArrowLeft,
  Loader2,
  Tag,
  DollarSign
} from "lucide-react";
import "./MassPublisherModal.css";

export default function MassPublisherModal({ 
  isOpen, 
  onClose, 
  selectedItems = [], 
  accountId,
  defaultPhotosPath = "C:\\Users\\ORLANDO\\Pictures\\FOTOS" // Raíz FOTOS; fotos vehículo en CARROS/ 
}) {
  const [step, setStep] = useState(1);
  const [photosPath, setPhotosPath] = useState(defaultPhotosPath);
  const [listingType, setListingType] = useState("gold_special");
  const [usePlaceholder, setUsePlaceholder] = useState(true);
  const [useAI, setUseAI] = useState(true);
  const [useCompetitorIntel, setUseCompetitorIntel] = useState(true);
  const [preferLocalPhotos, setPreferLocalPhotos] = useState(true);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [batchSummary, setBatchSummary] = useState(null);
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
    if (!isOpen) {
      setStep(1);
      setPreview(null);
      setPreviewError(null);
      setBatchSummary(null);
      setIsFinished(false);
      setLogs([]);
      setProgress(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  const photoSourceLabel = (source) => {
    switch (source) {
      case "image_bank":
        return "🌐 Banco de Imágenes";
      case "local":
        return "📸 Fotos Locales";
      case "placeholder":
        return "🏷️ Placeholder";
      case "vehicle_application":
        return "🚗 Foto de Aplicación";
      default:
        return "📷 Sin foto real";
    }
  };

  const handleLoadPreview = async () => {
    if (!accountId || selectedItems.length === 0) return;

    setIsLoadingPreview(true);
    setPreviewError(null);
    setPreview(null);

    try {
      const response = await fetch("/api/account/publications/publish-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          items: selectedItems,
          photosPath,
          usePlaceholderIfNoPhoto: usePlaceholder,
          useCompetitorIntel,
          injectVehiclePhotos: true,
          preferLocalPhotos,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Error ${response.status}`);
      }

      setPreview(data.preview);
      setBatchSummary(data.batchSummary);
      setStep(2);
    } catch (err) {
      setPreviewError(err.message);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleStartPublishing = async () => {
    if (!accountId) {
      alert("Debes seleccionar una cuenta activa de Mercado Libre.");
      return;
    }
    if (selectedItems.length === 0) {
      alert("No hay productos seleccionados para publicar.");
      return;
    }

    setStep(3);
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
          useAI,
          useCompetitorIntel,
          preferLocalPhotos,
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
        buffer = events.pop();

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
      const dupNote =
        data.skipDuplicates && data.alreadyPublished > 0
          ? ` | ${data.alreadyPublished} SKU(s) ya en ML serán omitidos`
          : "";
      setLogs(prev => [...prev, {
        type: "info",
        text: `🚀 Iniciando lote de ${data.total} productos. Tienda Oficial: ${data.officialStoreId || "N/A"}${dupNote}`
      }]);
    } else if (eventType === "competitor_intel") {
      const kwNote =
        data.title_keywords?.length > 0
          ? ` | Keywords: ${data.title_keywords.slice(0, 3).join(", ")}`
          : "";
      const attrNote =
        data.attributes_added > 0 ? ` | +${data.attributes_added} atributos del líder` : "";
      setLogs(prev => [...prev, {
        type: "intel",
        text: `🎯 [${data.index}/${data.total}] ${data.sku} — Líder: ${data.leader_id} ($${data.leader_price}, ${data.leader_sold} vend.) → Precio sugerido: $${data.suggested_price}${kwNote}${attrNote}`
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
      const photoLabel = photoSourceLabel(data.photoSource);
      setLogs(prev => [...prev, {
        type: "success",
        sku: data.sku,
        meliId: data.meli_id,
        permalink: data.permalink,
        hasPhoto: data.hasLocalPhoto,
        photoSource: data.photoSource,
        text: `✅ [${data.index}/${data.total}] ${data.sku} ➔ ${data.title} (${photoLabel})`
      }]);
    } else if (eventType === "item_skipped") {
      setStats(prev => {
        const newSkipped = prev.skipped + 1;
        const processed = prev.success + newSkipped + prev.errors;
        setProgress(Math.round((processed / prev.total) * 100));
        return { ...prev, skipped: newSkipped };
      });
      const skipPrefix =
        data.skipReason === "duplicate"
          ? "🔁 DUPLICADO"
          : data.skipReason === "no_photo"
            ? "🖼️ SIN FOTO"
            : "⚠️ OMITIDO";
      setLogs(prev => [...prev, {
        type: "warning",
        text: `${skipPrefix} [${data.index}/${data.total}] ${data.sku}: ${data.reason}`
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

  const stepLabels = ["Configurar", "Vista previa", "Publicar"];

  return (
    <div className="publisher-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="publisher-modal-container bg-[#0f172a] border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-900/30 to-purple-900/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Rocket size={22} className={isProcessing ? "animate-pulse" : ""} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Publicador Masivo vía API
                <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <ShieldCheck size={12} /> Calidad v2
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {step === 1 && "Paso 1: Configura opciones de publicación"}
                {step === 2 && "Paso 2: Revisa la vista previa antes de confirmar"}
                {step === 3 && "Paso 3: Publicación en curso"}
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

        {/* Step indicator */}
        <div className="px-6 pt-4 flex items-center gap-2">
          {stepLabels.map((label, i) => {
            const stepNum = i + 1;
            const isActive = step === stepNum;
            const isDone = step > stepNum;
            return (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                  isActive ? "bg-blue-600 border-blue-500 text-white" :
                  isDone ? "bg-emerald-600/30 border-emerald-500 text-emerald-400" :
                  "bg-slate-800 border-slate-700 text-slate-500"
                }`}>
                  {isDone ? <CheckCircle size={14} /> : stepNum}
                </div>
                <span className={`text-xs font-medium ${isActive ? "text-white" : "text-slate-500"}`}>
                  {label}
                </span>
                {i < stepLabels.length - 1 && (
                  <div className={`flex-1 h-px ${isDone ? "bg-emerald-600/50" : "bg-slate-700"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">

          {/* STEP 1: Configure */}
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Folder size={14} className="text-yellow-400" />
                  Carpeta Local de Imágenes (en este equipo):
                </label>
                <input
                  type="text"
                  value={photosPath}
                  onChange={(e) => setPhotosPath(e.target.value)}
                  disabled={isProcessing}
                  placeholder="Ej: C:\Users\ORLANDO\Pictures\FOTOS"
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Busca <code className="text-blue-300 font-mono">SKU.jpg</code>, <code className="text-blue-300 font-mono">SKU-1.jpg</code> en esta carpeta y fotos de aplicación vehicular en <code className="text-blue-300 font-mono">CARROS/</code> (o apunta directamente a la carpeta CARROS).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tipo de Exposición:</label>
                <select
                  value={listingType}
                  onChange={(e) => setListingType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="gold_special">Clásica (gold_special)</option>
                  <option value="gold_pro">Premium (gold_pro)</option>
                </select>
              </div>

              <div className="flex flex-col justify-center space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                  <input type="checkbox" checked={preferLocalPhotos} onChange={(e) => setPreferLocalPhotos(e.target.checked)} className="rounded border-slate-700 bg-slate-950 text-emerald-500 w-4 h-4" />
                  <span>Priorizar fotos locales (evitar Banco de Imágenes)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                  <input type="checkbox" checked={usePlaceholder} onChange={(e) => setUsePlaceholder(e.target.checked)} className="rounded border-slate-700 bg-slate-950 text-blue-500 w-4 h-4" />
                  <span>Usar imagen provisional si no hay foto local</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                  <input type="checkbox" checked={useCompetitorIntel} onChange={(e) => setUseCompetitorIntel(e.target.checked)} className="rounded border-slate-700 bg-slate-950 text-orange-500 w-4 h-4" />
                  <span>Analizar competencia antes de publicar</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                  <input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} className="rounded border-slate-700 bg-slate-950 text-purple-500 w-4 h-4" />
                  <span className="flex items-center gap-1">
                    <Sparkles size={13} className="text-purple-400" />
                    Enriquecer con Gemini IA
                  </span>
                </label>
              </div>

              <div className="md:col-span-2 bg-slate-950/50 rounded-lg p-3 border border-slate-800">
                <div className="text-xs text-slate-400">
                  <strong className="text-slate-300">{selectedItems.length}</strong> productos seleccionados para el lote.
                  La vista previa mostrará el primer ítem como muestra representativa.
                </div>
              </div>

              {previewError && (
                <div className="md:col-span-2 text-xs text-rose-400 bg-rose-950/30 border border-rose-800/40 rounded-lg p-3">
                  Error al generar vista previa: {previewError}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Preview */}
          {step === 2 && preview && (
            <div className="space-y-4">
              {batchSummary && batchSummary.total > 1 && (
                <div className="text-xs text-slate-400 bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-2">
                  Vista previa del ítem 1 de <strong className="text-slate-200">{batchSummary.total}</strong> del lote
                  {batchSummary.alreadyPublished > 0 && (
                    <span className="text-amber-400 ml-2">· {batchSummary.alreadyPublished} SKU(s) ya publicados serán omitidos</span>
                  )}
                </div>
              )}

              <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">SKU: {preview.sku}</div>
                    <h3 className="text-lg font-bold text-white leading-snug">{preview.title}</h3>
                    {preview.rawTitle !== preview.title && (
                      <p className="text-xs text-slate-500 mt-1 line-through">{preview.rawTitle}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold text-emerald-400 flex items-center gap-1">
                      <DollarSign size={18} />
                      {preview.suggestedPrice?.toFixed(2)}
                    </div>
                    {preview.originalPrice !== preview.suggestedPrice && (
                      <div className="text-xs text-slate-500 line-through">${preview.originalPrice?.toFixed(2)}</div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800">
                    <div className="text-slate-500 mb-1 flex items-center gap-1"><Tag size={12} /> Categoría ML</div>
                    <div className="text-slate-200 font-mono">{preview.categoryId || "—"}</div>
                  </div>
                  <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800">
                    <div className="text-slate-500 mb-1 flex items-center gap-1"><ImageIcon size={12} /> Fotos ({preview.photoCount})</div>
                    <div className="space-y-0.5">
                      {(preview.photoSources || []).map((ps, i) => (
                        <div key={i} className="text-slate-200">{photoSourceLabel(ps.type)} {ps.count ? `×${ps.count}` : ""}</div>
                      ))}
                    </div>
                  </div>
                </div>

                {preview.vehiclePhoto && (
                  <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-3 text-xs text-blue-300">
                    🚗 Foto de aplicación: {preview.vehiclePhoto.make} {preview.vehiclePhoto.model} ({preview.vehiclePhoto.year_from}–{preview.vehiclePhoto.year_to})
                  </div>
                )}

                {preview.competitorIntel?.leader && (
                  <div className="bg-orange-950/20 border border-orange-800/30 rounded-lg p-3 text-xs">
                    <div className="text-orange-400 font-semibold mb-1">🎯 Inteligencia Competitiva</div>
                    <div className="text-slate-300">
                      Líder: <span className="font-mono">{preview.competitorIntel.leader.id}</span> — ${preview.competitorIntel.leader.price} ({preview.competitorIntel.leader.sold_quantity} vend.)
                    </div>
                    {preview.competitorIntel.titleKeywords?.length > 0 && (
                      <div className="text-slate-400 mt-1">Keywords añadidas: {preview.competitorIntel.titleKeywords.join(", ")}</div>
                    )}
                    {preview.competitorIntel.attributesAdded > 0 && (
                      <div className="text-slate-400">+{preview.competitorIntel.attributesAdded} atributos del líder</div>
                    )}
                  </div>
                )}

                {preview.attributes?.length > 0 && (
                  <div>
                    <div className="text-xs text-slate-500 mb-2">Atributos ({preview.attributes.length})</div>
                    <div className="flex flex-wrap gap-1.5">
                      {preview.attributes.slice(0, 8).map((a) => (
                        <span key={a.id} className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                          {a.id}: {a.value_name}
                        </span>
                      ))}
                      {preview.attributes.length > 8 && (
                        <span className="text-[10px] text-slate-500">+{preview.attributes.length - 8} más</span>
                      )}
                    </div>
                  </div>
                )}

                {(preview.warnings?.length > 0 || preview.errors?.length > 0) && (
                  <div className="space-y-1">
                    {preview.errors?.map((e, i) => (
                      <div key={`e${i}`} className="text-xs text-rose-400 flex items-center gap-1"><XCircle size={12} /> {e}</div>
                    ))}
                    {preview.warnings?.map((w, i) => (
                      <div key={`w${i}`} className="text-xs text-amber-400 flex items-center gap-1"><AlertTriangle size={12} /> {w}</div>
                    ))}
                  </div>
                )}

                {!preview.ok && (
                  <div className="text-xs text-rose-400 bg-rose-950/30 border border-rose-800/40 rounded-lg p-3">
                    Este ítem tiene errores de validación. Puedes volver a configurar o publicar de todos modos (será omitido si falla).
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Publish progress */}
          {step === 3 && (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Progreso del Lote:</span>
                  <span className="font-mono font-bold text-blue-400 text-sm">{progress}%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5">
                  <div 
                    className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="grid grid-cols-4 gap-2 pt-1">
                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-center">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Total</div>
                    <div className="text-base font-bold text-white font-mono">{selectedItems.length}</div>
                  </div>
                  <div className="bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-800/30 text-center">
                    <div className="text-[10px] text-emerald-400 uppercase font-semibold">Publicados</div>
                    <div className="text-base font-bold text-emerald-400 font-mono">{stats.success}</div>
                  </div>
                  <div className="bg-amber-950/20 p-2.5 rounded-xl border border-amber-800/30 text-center">
                    <div className="text-[10px] text-amber-400 uppercase font-semibold">Omitidos</div>
                    <div className="text-base font-bold text-amber-400 font-mono">{stats.skipped}</div>
                  </div>
                  <div className="bg-rose-950/20 p-2.5 rounded-xl border border-rose-800/30 text-center">
                    <div className="text-[10px] text-rose-400 uppercase font-semibold">Errores</div>
                    <div className="text-base font-bold text-rose-400 font-mono">{stats.errors}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-300">Bitácora de Ejecución en Vivo:</div>
                <div 
                  ref={logContainerRef}
                  className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 h-48 overflow-y-auto font-mono text-xs space-y-1.5 custom-scrollbar"
                >
                  {logs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 leading-relaxed">
                      {log.type === "success" && (
                        <div className="text-emerald-400 flex items-center gap-1.5 flex-1">
                          <span>{log.text}</span>
                          {log.permalink && (
                            <a href={log.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center text-blue-400 hover:underline gap-0.5 ml-1">
                              <ExternalLink size={11} /> Ver en ML
                            </a>
                          )}
                        </div>
                      )}
                      {log.type === "intel" && <span className="text-orange-400">{log.text}</span>}
                      {log.type === "warning" && <span className="text-amber-400">{log.text}</span>}
                      {log.type === "error" && <span className="text-rose-400 font-semibold">{log.text}</span>}
                      {log.type === "status" && <span className="text-slate-400">{log.text}</span>}
                      {log.type === "info" && <span className="text-blue-400 font-semibold">{log.text}</span>}
                      {log.type === "finish" && <span className="text-purple-400 font-bold">{log.text}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {step === 1 && `${selectedItems.length} items listos`}
            {step === 2 && preview && `Vista previa: ${preview.sku}`}
            {step === 3 && (isFinished ? "Lote finalizado" : "Publicando...")}
          </div>

          <div className="flex items-center gap-3">
            {step === 3 && isProcessing ? (
              <button onClick={handleStop} className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold flex items-center gap-2">
                <XCircle size={16} /> Detener Lote
              </button>
            ) : step === 1 ? (
              <>
                <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium">
                  Cancelar
                </button>
                <button
                  onClick={handleLoadPreview}
                  disabled={selectedItems.length === 0 || isLoadingPreview}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  {isLoadingPreview ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                  {isLoadingPreview ? "Generando vista previa..." : "Continuar a Vista Previa"}
                </button>
              </>
            ) : step === 2 ? (
              <>
                <button onClick={() => setStep(1)} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium flex items-center gap-2">
                  <ArrowLeft size={14} /> Volver
                </button>
                <button
                  onClick={handleStartPublishing}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-sm font-bold flex items-center gap-2"
                >
                  <Rocket size={16} /> Confirmar y Publicar {selectedItems.length} Items
                </button>
              </>
            ) : (
              <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium">
                Cerrar
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
