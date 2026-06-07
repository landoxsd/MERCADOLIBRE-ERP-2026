'use client';

/**
 * src/components/intelligence/SerpPositionPanel.js
 * Panel de SERP Position Tracker — muestra la posición de tus
 * publicaciones en el ranking de búsqueda de MLV.
 *
 * Requiere que el microservicio scrapling-service esté corriendo
 * en localhost:8765 (ejecutar scrapling-service/start.bat)
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, Loader2, AlertCircle, Search, Trophy, Target, Zap, ChevronDown, ChevronUp, Sparkles, Brain, TrendingDown, DollarSign, Tag, ExternalLink, Crosshair, Wrench } from 'lucide-react';

const MEDAL = ['🥇', '🥈', '🥉'];

function PositionBadge({ position }) {
    if (!position) return null;
    const color = position <= 3 ? '#f59e0b' : position <= 10 ? '#10b981' : '#6b7280';
    const bg = position <= 3 ? 'rgba(245,158,11,0.1)' : position <= 10 ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)';
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '2px 10px', borderRadius: '999px', fontSize: '13px', fontWeight: '700',
            color, backgroundColor: bg, border: `1px solid ${color}40`,
        }}>
            {MEDAL[position - 1] || `#${position}`}
        </span>
    );
}

function SerpRow({ item, isOwn, onAnalyze }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 14px', borderRadius: '10px',
            backgroundColor: isOwn ? 'rgba(139,92,246,0.08)' : 'rgba(15,23,42,0.5)',
            border: `1px solid ${isOwn ? 'rgba(139,92,246,0.35)' : 'rgba(51,65,85,0.6)'}`,
            transition: 'all 0.2s',
        }}>
            {/* Posición */}
            <div style={{
                minWidth: '36px', textAlign: 'center',
                fontSize: '13px', fontWeight: '800',
                color: item.position <= 3 ? '#f59e0b' : item.position <= 10 ? '#10b981' : '#64748b',
            }}>
                {MEDAL[item.position - 1] || `#${item.position}`}
            </div>

            {/* Thumbnail */}
            <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', flexShrink: 0 }}>
                {item.thumbnail ? (
                    <img
                        src={item.thumbnail}
                        alt=""
                        style={{ width: '38px', height: '38px', objectFit: 'contain', borderRadius: '6px', background: '#fff' }}
                        onError={e => { e.target.style.display = 'none'; }}
                    />
                ) : (
                    <div style={{ width: '38px', height: '38px', borderRadius: '6px', background: 'rgba(30,41,59,0.8)' }} />
                )}
            </a>

            {/* Datos */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <a 
                    href={item.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                        display: 'block', fontSize: '13px', fontWeight: isOwn ? '700' : '500',
                        color: isOwn ? '#c4b5fd' : '#cbd5e1',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        textDecoration: 'none',
                    }}
                    onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                >
                    {isOwn && <span style={{ color: '#a78bfa', marginRight: '6px' }}>★ TU PUB</span>}
                    {item.title} <ExternalLink className="w-3 h-3" style={{ display: 'inline', opacity: 0.5, marginLeft: '4px' }} />
                </a>
                <div style={{ display: 'flex', gap: '12px', marginTop: '3px', fontSize: '11px', color: '#64748b', flexWrap: 'wrap' }}>
                    {item.price_usd && <span style={{ color: '#10b981', fontWeight: '600' }}>USD {item.price_usd.toFixed(2)}</span>}
                    {item.seller && <span>👤 {item.seller}</span>}
                    {item.sold_quantity > 0 && <span>📦 {item.sold_quantity} vendidos</span>}
                    {item.free_shipping && <span style={{ color: '#3b82f6' }}>🚚 Gratis</span>}
                    {item.rating && <span>⭐ {item.rating}</span>}
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                <div style={{ fontSize: '10px', color: '#475569', fontFamily: 'monospace' }}>
                    {item.id}
                </div>
                {onAnalyze && (
                    <button
                        onClick={() => onAnalyze(item.id, isOwn)}
                        title={isOwn ? "Optimizar Ficha Técnica (Quirófano)" : "Espiar Competidor (Rayos X)"}
                        style={{
                            background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(51,65,85,0.6)',
                            color: isOwn ? '#a855f7' : '#94a3b8', padding: '6px', borderRadius: '6px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { 
                            e.currentTarget.style.background = isOwn ? 'rgba(168,85,247,0.15)' : 'rgba(14,165,233,0.15)'; 
                            e.currentTarget.style.color = isOwn ? '#d8b4fe' : '#38bdf8'; 
                            e.currentTarget.style.borderColor = isOwn ? 'rgba(168,85,247,0.3)' : 'rgba(56,189,248,0.3)'; 
                        }}
                        onMouseLeave={e => { 
                            e.currentTarget.style.background = 'rgba(30,41,59,0.8)'; 
                            e.currentTarget.style.color = isOwn ? '#a855f7' : '#94a3b8'; 
                            e.currentTarget.style.borderColor = 'rgba(51,65,85,0.6)'; 
                        }}
                    >
                        {isOwn ? <Wrench className="w-4 h-4" /> : <Crosshair className="w-4 h-4" />}
                    </button>
                )}
            </div>
        </div>
    );
}


export default function SerpPositionPanel({ prefillQuery = '', prefillItemId = '' }) {
    const router = useRouter();
    const [query, setQuery] = useState(prefillQuery);
    const [myIds, setMyIds] = useState(prefillItemId);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [showAll, setShowAll] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiResult, setAiResult] = useState(null);
    const [aiError, setAiError] = useState(null);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setError(null);
        setResult(null);
        setShowAll(false);
        setAiResult(null);
        setAiError(null);

        try {
            const idsArray = myIds.split(',').map(s => s.trim()).filter(Boolean);
            const res = await fetch('/api/scraping/stats/position', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query.trim(),
                    myItemIds: idsArray,
                    maxResults: 48,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || data.hint || 'Error desconocido');
            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAiAnalyze = async () => {
        if (!result) return;
        setAiLoading(true);
        setAiError(null);
        setAiResult(null);
        try {
            const res = await fetch('/api/scraping/stats/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serpData: result, query }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error en análisis IA');
            setAiResult(data.analysis);
        } catch (err) {
            setAiError(err.message);
        } finally {
            setAiLoading(false);
        }
    };

    const ownIds = new Set(
        myIds.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    );

    const displayItems = result
        ? (showAll ? result.results : result.results.slice(0, 15))
        : [];

    const myPositions = result?.my_positions || {};
    const hasOwnItems = Object.keys(myPositions).length > 0;

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,20,60,0.9) 100%)',
            border: '1px solid rgba(139,92,246,0.25)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <TrendingUp className="w-5 h-5" style={{ color: '#fff' }} />
                </div>
                <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#e2e8f0', margin: 0 }}>
                        SERP Position Tracker
                    </h3>
                    <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
                        Posición real de tus publicaciones en MLV · Powered by Scrapling
                    </p>
                </div>
            </div>

            {/* Inputs */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: '2', minWidth: '200px' }}>
                    <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                        BÚSQUEDA EN MLV
                    </label>
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="amortiguador delantero aveo..."
                        className="input-glass"
                        style={{ borderColor: 'rgba(139,92,246,0.3)' }}
                    />
                </div>
                <div style={{ flex: '1', minWidth: '180px' }}>
                    <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                        MIS IDs (separados por coma)
                    </label>
                    <input
                        type="text"
                        value={myIds}
                        onChange={e => setMyIds(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="MLV824681578, MLV741525..."
                        className="input-glass"
                        style={{ borderColor: 'rgba(139,92,246,0.2)', fontFamily: 'monospace', fontSize: '12px' }}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button
                        onClick={handleSearch}
                        disabled={loading || !query.trim()}
                        style={{
                            padding: '10px 20px', borderRadius: '10px', fontWeight: '700',
                            fontSize: '13px', cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
                            background: loading || !query.trim()
                                ? 'rgba(139,92,246,0.3)'
                                : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                            color: '#fff', border: 'none',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            boxShadow: loading ? 'none' : '0 0 20px rgba(139,92,246,0.4)',
                            transition: 'all 0.2s',
                        }}
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        {loading ? 'Buscando...' : 'BUSCAR'}
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div style={{
                    padding: '12px 16px', borderRadius: '10px',
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                }}>
                    <AlertCircle className="w-4 h-4" style={{ color: '#ef4444', flexShrink: 0, marginTop: '1px' }} />
                    <div>
                        <p style={{ fontSize: '13px', color: '#fca5a5', fontWeight: '600', margin: 0 }}>{error}</p>
                        {error.includes('start.bat') && (
                            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 0' }}>
                                El microservicio Scrapling debe estar corriendo. Ejecuta <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: '4px' }}>scrapling-service/start.bat</code>
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px' }}>
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#a855f7' }} />
                    <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                        StealthyFetcher navegando MLV... (~10 segundos)
                    </p>
                </div>
            )}

            {/* Results */}
            {result && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Meta row + botón IA */}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{
                                padding: '6px 14px', borderRadius: '999px', fontSize: '12px',
                                background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)',
                                color: '#a78bfa', fontWeight: '600',
                                display: 'flex', alignItems: 'center', gap: '6px',
                            }}>
                                <Zap className="w-3 h-3" />
                                {result.total_found} resultados · {result.elapsed_seconds}s
                            </div>
                            <div style={{ fontSize: '12px', color: '#475569' }}>
                                {result.url}
                            </div>
                        </div>
                        {/* Botón Analizar con IA */}
                        <button
                            onClick={handleAiAnalyze}
                            disabled={aiLoading}
                            style={{
                                padding: '8px 16px', borderRadius: '10px', fontWeight: '700',
                                fontSize: '12px', cursor: aiLoading ? 'not-allowed' : 'pointer',
                                background: aiLoading
                                    ? 'rgba(251,191,36,0.2)'
                                    : 'linear-gradient(135deg, #d97706, #f59e0b)',
                                color: aiLoading ? '#94a3b8' : '#000',
                                border: 'none',
                                display: 'flex', alignItems: 'center', gap: '6px',
                                boxShadow: aiLoading ? 'none' : '0 0 16px rgba(245,158,11,0.35)',
                                transition: 'all 0.2s',
                            }}
                        >
                            {aiLoading
                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analizando...</>
                                : <><Sparkles className="w-3.5 h-3.5" /> ANALIZAR CON IA</>
                            }
                        </button>
                    </div>

                    {/* Panel dictamen IA */}
                    {aiError && (
                        <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '12px', color: '#fca5a5' }}>
                            Error IA: {aiError}
                        </div>
                    )}
                    {aiResult && (
                        <div style={{
                            borderRadius: '14px', overflow: 'hidden',
                            border: '1px solid rgba(245,158,11,0.3)',
                            background: 'linear-gradient(135deg, rgba(120,53,15,0.15), rgba(15,23,42,0.95))',
                        }}>
                            {/* Header IA */}
                            <div style={{
                                padding: '14px 18px',
                                background: 'linear-gradient(135deg, rgba(217,119,6,0.2), rgba(245,158,11,0.1))',
                                borderBottom: '1px solid rgba(245,158,11,0.2)',
                                display: 'flex', alignItems: 'center', gap: '10px',
                            }}>
                                <Brain className="w-5 h-5" style={{ color: '#f59e0b' }} />
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#fcd34d' }}>Dictamen IA — Llama 3.3 70B</div>
                                    <div style={{ fontSize: '10px', color: '#92400e' }}>Análisis automático del mercado · {query}</div>
                                </div>
                                {/* Nivel competencia badge */}
                                {aiResult.nivel_competencia && (
                                    <span style={{
                                        marginLeft: 'auto', padding: '3px 10px', borderRadius: '999px',
                                        fontSize: '10px', fontWeight: '700',
                                        background: aiResult.nivel_competencia === 'MUY_ALTO' ? 'rgba(239,68,68,0.2)'
                                            : aiResult.nivel_competencia === 'ALTO' ? 'rgba(245,158,11,0.2)'
                                            : 'rgba(16,185,129,0.2)',
                                        color: aiResult.nivel_competencia === 'MUY_ALTO' ? '#ef4444'
                                            : aiResult.nivel_competencia === 'ALTO' ? '#f59e0b'
                                            : '#10b981',
                                        border: '1px solid currentColor',
                                    }}>
                                        Competencia: {aiResult.nivel_competencia?.replace('_', ' ')}
                                    </span>
                                )}
                            </div>

                            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {/* Dictamen principal */}
                                <p style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: '1.6', margin: 0, fontStyle: 'italic', borderLeft: '3px solid #f59e0b', paddingLeft: '12px' }}>
                                    {aiResult.dictamen}
                                </p>

                                {/* Grid de datos clave */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                                    {aiResult.precio_sugerido && (
                                        <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                <DollarSign className="w-3.5 h-3.5" style={{ color: '#10b981' }} />
                                                <span style={{ fontSize: '10px', fontWeight: '700', color: '#10b981', textTransform: 'uppercase' }}>Precio Sugerido</span>
                                            </div>
                                            <div style={{ fontSize: '22px', fontWeight: '900', color: '#34d399' }}>USD {aiResult.precio_sugerido}</div>
                                        </div>
                                    )}
                                    {aiResult.posicion_propia && (
                                        <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                <TrendingUp className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
                                                <span style={{ fontSize: '10px', fontWeight: '700', color: '#a78bfa', textTransform: 'uppercase' }}>Tu Posición</span>
                                            </div>
                                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#c4b5fd' }}>{aiResult.posicion_propia}</div>
                                        </div>
                                    )}
                                </div>

                                {/* Ventaja líder */}
                                {aiResult.ventaja_lider && (
                                    <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#fbbf24', marginBottom: '4px', textTransform: 'uppercase' }}>Por qué gana el #1</div>
                                        <div style={{ fontSize: '13px', color: '#fde68a' }}>{aiResult.ventaja_lider}</div>
                                    </div>
                                )}

                                {/* Keywords faltantes */}
                                {aiResult.keywords_faltantes?.length > 0 && (
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                            <Tag className="w-3.5 h-3.5" style={{ color: '#38bdf8' }} />
                                            <span style={{ fontSize: '10px', fontWeight: '700', color: '#38bdf8', textTransform: 'uppercase' }}>Keywords que te faltan en el título</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {aiResult.keywords_faltantes.map((kw, i) => (
                                                <span key={i} style={{
                                                    padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                                                    background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)',
                                                    color: '#7dd3fc',
                                                }}>{kw}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Plan de acción */}
                                {aiResult.acciones?.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' }}>Plan de Acción</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {aiResult.acciones.map((accion, i) => (
                                                <div key={i} style={{
                                                    display: 'flex', gap: '10px', alignItems: 'flex-start',
                                                    padding: '8px 12px', borderRadius: '8px',
                                                    background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(51,65,85,0.5)',
                                                }}>
                                                    <span style={{ minWidth: '20px', height: '20px', borderRadius: '50%', background: 'rgba(245,158,11,0.2)', color: '#f59e0b', fontSize: '10px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                                                    <span style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5' }}>{accion}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Oportunidad / Títulos sugeridos */}
                                {aiResult.titulos_sugeridos?.length > 0 && (
                                    <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#10b981', marginBottom: '8px', textTransform: 'uppercase' }}>Títulos Listos para Implementar</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {aiResult.titulos_sugeridos.map((titulo, idx) => (
                                                <div key={idx} style={{
                                                    fontSize: '13px', color: '#6ee7b7', fontWeight: '600',
                                                    padding: '8px 12px', borderRadius: '6px',
                                                    background: 'rgba(16,185,129,0.1)', border: '1px dashed rgba(16,185,129,0.3)'
                                                }}>
                                                    {titulo}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Mis posiciones */}
                    {hasOwnItems && (
                        <div style={{
                            padding: '14px 16px', borderRadius: '12px',
                            background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(124,58,237,0.08))',
                            border: '1px solid rgba(139,92,246,0.3)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <Trophy className="w-4 h-4" style={{ color: '#f59e0b' }} />
                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#e2e8f0' }}>
                                    Tus Posiciones en el SERP
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {Object.entries(myPositions).map(([id, pos]) => (
                                    <div key={id} style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '8px 14px', borderRadius: '10px',
                                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(139,92,246,0.2)',
                                    }}>
                                        <code style={{ fontSize: '11px', color: '#94a3b8' }}>{id}</code>
                                        <PositionBadge position={pos} />
                                    </div>
                                ))}
                            </div>
                            {ownIds.size > 0 && Object.keys(myPositions).length < ownIds.size && (
                                <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
                                    <Target className="w-3 h-3" style={{ display: 'inline', marginRight: '4px' }} />
                                    {ownIds.size - Object.keys(myPositions).length} de tus IDs no aparecen en el top {result.total_found}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Lista SERP */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            RANKING SERP — {query}
                        </h4>
                        {displayItems.map(item => (
                            <SerpRow
                                key={item.id || item.position}
                                item={item}
                                isOwn={ownIds.has((item.id || '').toUpperCase())}
                                onAnalyze={(id, isOwn) => {
                                    if (isOwn) {
                                        router.push(`/dashboard/optimizer?itemId=${id}`);
                                    } else {
                                        router.push(`/dashboard/spy?query=${id}`);
                                    }
                                }}
                            />
                        ))}
                    </div>

                    {/* Show more */}
                    {result.results.length > 15 && (
                        <button
                            onClick={() => setShowAll(v => !v)}
                            style={{
                                width: '100%', padding: '10px', borderRadius: '10px',
                                background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(51,65,85,0.6)',
                                color: '#94a3b8', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                transition: 'all 0.2s',
                            }}
                        >
                            {showAll
                                ? <><ChevronUp className="w-4 h-4" /> Mostrar menos</>
                                : <><ChevronDown className="w-4 h-4" /> Ver todos ({result.results.length} resultados)</>
                            }
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
