'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

const TOPIC_INFO = {
    items: {
        label: 'Publicaciones',
        description: 'Cambios en precio, stock, título o estado de una publicación',
        icon: '🏷️',
        color: '#4f46e5',
    },
    orders_v2: {
        label: 'Ventas / Órdenes',
        description: 'Nueva compra, pago confirmado, orden cancelada',
        icon: '📦',
        color: '#059669',
    },
    questions: {
        label: 'Preguntas',
        description: 'Un comprador hizo una pregunta en una publicación',
        icon: '💬',
        color: '#d97706',
    },
    shipments: {
        label: 'Envíos',
        description: 'Cambio en el estado de un envío (preparando, en camino, entregado)',
        icon: '🚚',
        color: '#7c3aed',
    },
    payments: {
        label: 'Pagos',
        description: 'Pago aprobado, rechazado o reembolsado',
        icon: '💳',
        color: '#dc2626',
    },
};

const STATUS_STYLES = {
    pending: { bg: '#fef3c7', color: '#92400e', label: 'Pendiente' },
    processing: { bg: '#dbeafe', color: '#1e40af', label: 'Procesando' },
    completed: { bg: '#d1fae5', color: '#065f46', label: 'Completado' },
    error: { bg: '#fee2e2', color: '#991b1b', label: 'Error' },
};

// Instrucciones para configurar webhooks manualmente
function WebhookSetupInstructions() {
    const [showInstructions, setShowInstructions] = useState(false);

    return (
        <div style={{ marginBottom: '16px' }}>
            <button
                onClick={() => setShowInstructions(!showInstructions)}
                style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                    color: '#374151',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}
            >
                ⚙️ {showInstructions ? 'Ocultar instrucciones' : 'Configurar Webhooks'}
            </button>

            {showInstructions && (
                <div style={{
                    marginTop: '12px',
                    padding: '16px',
                    background: '#f0f9ff',
                    borderRadius: '12px',
                    border: '1px solid #bae6fd',
                    fontSize: '13px',
                    color: '#1e3a5f',
                }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>
                        🔧 Configuración manual requerida en MercadoLibre
                    </h4>
                    <p style={{ margin: '0 0 12px 0' }}>
                        MercadoLibre <strong>no permite suscribir webhooks por API</strong>. Debes configurarlos manualmente desde el panel de desarrolladores:
                    </p>
                    <ol style={{ margin: '0 0 12px 0', paddingLeft: '20px', lineHeight: '1.8' }}>
                        <li>Ve a <a href="https://applications.mercadolibre.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#0284c7', fontWeight: 600 }}>applications.mercadolibre.com</a></li>
                        <li>Inicia sesión con tu cuenta de desarrollador</li>
                        <li>Busca tu aplicación (Client ID: 2657663366318591)</li>
                        <li>Ve a la sección <strong>"Notificaciones"</strong></li>
                        <li>Pega esta <strong>Callback URL</strong>:</li>
                    </ol>
                    <div style={{
                        padding: '10px 14px',
                        background: '#1e293b',
                        color: '#e2e8f0',
                        borderRadius: '8px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        wordBreak: 'break-all',
                        marginBottom: '12px',
                    }}>
                        https://mercadolibre-erp.vercel.app/api/webhooks/ml
                    </div>
                    <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>Topics a activar:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {Object.entries(TOPIC_INFO).map(([key, info]) => (
                            <span key={key} style={{
                                padding: '4px 10px',
                                borderRadius: '20px',
                                background: info.color + '15',
                                color: info.color,
                                fontSize: '11px',
                                fontWeight: 600,
                            }}>
                                {info.icon} {info.label}
                            </span>
                        ))}
                    </div>
                    <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                        💡 Una vez configurado, las notificaciones llegarán automáticamente y el sistema actualizará productos, órdenes y preguntas sin intervención manual.
                    </p>
                </div>
            )}
        </div>
    );
}

export default function WebhooksMonitorPage() {
    const [notifications, setNotifications] = useState([]);
    const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0, error: 0 });
    const [topicCounts, setTopicCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [filterTopic, setFilterTopic] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [expandedRow, setExpandedRow] = useState(null);
    const [expandedPayloads, setExpandedPayloads] = useState({});

    const LIST_COLUMNS = 'id, topic, resource, status, created_at, attempts, user_id, processed_at, error_message';

    const fetchNotifications = useCallback(async () => {
        let query = supabase
            .from('ml_notifications')
            .select(LIST_COLUMNS)
            .order('created_at', { ascending: false })
            .limit(100);

        if (filterTopic !== 'all') {
            query = query.eq('topic', filterTopic);
        }
        if (filterStatus !== 'all') {
            query = query.eq('status', filterStatus);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error cargando notificaciones:', error);
            return;
        }

        setNotifications(data || []);
        setLastUpdate(new Date());

        // Calcular estadísticas
        const counts = { total: data?.length || 0, pending: 0, completed: 0, error: 0 };
        const tCounts = {};
        data?.forEach(n => {
            counts[n.status] = (counts[n.status] || 0) + 1;
            tCounts[n.topic] = (tCounts[n.topic] || 0) + 1;
        });
        setStats(counts);
        setTopicCounts(tCounts);
        setLoading(false);
    }, [filterTopic, filterStatus]);

    const fetchPayload = useCallback(async (id) => {
        if (expandedPayloads[id] !== undefined) return;
        const { data, error } = await supabase
            .from('ml_notifications')
            .select('payload')
            .eq('id', id)
            .single();
        if (!error && data) {
            setExpandedPayloads(prev => ({ ...prev, [id]: data.payload }));
        }
    }, [expandedPayloads]);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000); // Polling cada 60 seg
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleString('es-VE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const getTopicInfo = (topic) => {
        return TOPIC_INFO[topic] || { label: topic, description: 'Evento desconocido', icon: '❓', color: '#6b7280' };
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    🔔 Centro de Notificaciones
                </h1>
                <p style={{ color: '#6b7280', fontSize: '14px' }}>
                    Monitoreo en tiempo real de eventos de MercadoLibre. Última actualización: {lastUpdate ? formatDate(lastUpdate) : '-'}
                </p>
            </div>

            {/* Setup Instructions */}
            <WebhookSetupInstructions />

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#111827' }}>{stats.total}</div>
                </div>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pendientes</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#d97706' }}>{stats.pending || 0}</div>
                </div>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Completados</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#059669' }}>{stats.completed || 0}</div>
                </div>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Errores</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#dc2626' }}>{stats.error || 0}</div>
                </div>
            </div>

            {/* Topic Legend */}
            <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#374151' }}>📋 Significado de cada tipo de evento</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                    {Object.entries(TOPIC_INFO).map(([key, info]) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', borderRadius: '8px', background: '#f9fafb' }}>
                            <span style={{ fontSize: '20px' }}>{info.icon}</span>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '13px', color: '#111827' }}>{info.label}</div>
                                <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.4' }}>{info.description}</div>
                                <div style={{ fontSize: '11px', color: info.color, fontWeight: 600, marginTop: '4px' }}>
                                    {topicCounts[key] || 0} recibidos
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                    value={filterTopic}
                    onChange={(e) => setFilterTopic(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                >
                    <option value="all">Todos los topics</option>
                    {Object.entries(TOPIC_INFO).map(([key, info]) => (
                        <option key={key} value={key}>{info.icon} {info.label}</option>
                    ))}
                </select>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                >
                    <option value="all">Todos los estados</option>
                    <option value="pending">Pendiente</option>
                    <option value="processing">Procesando</option>
                    <option value="completed">Completado</option>
                    <option value="error">Error</option>
                </select>
                <button
                    onClick={fetchNotifications}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#4f46e5', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}
                >
                    🔄 Actualizar
                </button>
            </div>

            {/* Table */}
            <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                {loading && notifications.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Cargando notificaciones...</div>
                ) : notifications.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
                        <div>No hay notificaciones aún.</div>
                        <div style={{ fontSize: '12px', marginTop: '8px' }}>Configura los webhooks en applications.mercadolibre.com para empezar a recibir eventos.</div>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Topic</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Recurso</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Estado</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Recibido</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Intentos</th>
                            </tr>
                        </thead>
                        <tbody>
                            {notifications.map((n) => {
                                const topicInfo = getTopicInfo(n.topic);
                                const statusStyle = STATUS_STYLES[n.status] || STATUS_STYLES.pending;
                                const isExpanded = expandedRow === n.id;

                                return (
                                    <>
                                        <tr
                                            key={n.id}
                                            onClick={() => {
                                                const next = isExpanded ? null : n.id;
                                                setExpandedRow(next);
                                                if (next) fetchPayload(next);
                                            }}
                                            style={{
                                                borderBottom: '1px solid #f3f4f6',
                                                cursor: 'pointer',
                                                background: isExpanded ? '#f0f9ff' : 'transparent',
                                                transition: 'background 0.15s',
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = isExpanded ? '#f0f9ff' : 'transparent'}
                                        >
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '16px' }}>{topicInfo.icon}</span>
                                                    <div>
                                                        <div style={{ fontWeight: 500 }}>{topicInfo.label}</div>
                                                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>{n.topic}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px', color: '#6b7280' }}>
                                                {n.resource}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '4px 10px',
                                                    borderRadius: '20px',
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    background: statusStyle.bg,
                                                    color: statusStyle.color,
                                                }}>
                                                    {statusStyle.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                                                {formatDate(n.created_at)}
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    width: '24px',
                                                    height: '24px',
                                                    borderRadius: '50%',
                                                    background: '#f3f4f6',
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                }}>
                                                    {n.attempts}
                                                </span>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={5} style={{ padding: '16px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                                                    <div style={{ fontSize: '12px' }}>
                                                        <div style={{ marginBottom: '8px' }}>
                                                            <span style={{ fontWeight: 600 }}>ID:</span> {n.id}
                                                        </div>
                                                        <div style={{ marginBottom: '8px' }}>
                                                            <span style={{ fontWeight: 600 }}>User ID ML:</span> {n.user_id}
                                                        </div>
                                                        <div style={{ marginBottom: '8px' }}>
                                                            <span style={{ fontWeight: 600 }}>Significado:</span> {topicInfo.description}
                                                        </div>
                                                        {n.processed_at && (
                                                            <div style={{ marginBottom: '8px', color: '#059669' }}>
                                                                <span style={{ fontWeight: 600 }}>Procesado:</span> {formatDate(n.processed_at)}
                                                            </div>
                                                        )}
                                                        {n.error_message && (
                                                            <div style={{ marginBottom: '8px', color: '#dc2626' }}>
                                                                <span style={{ fontWeight: 600 }}>Error:</span> {n.error_message}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <span style={{ fontWeight: 600 }}>Payload completo:</span>
                                                            <pre style={{
                                                                marginTop: '8px',
                                                                padding: '12px',
                                                                background: '#1e293b',
                                                                color: '#e2e8f0',
                                                                borderRadius: '8px',
                                                                overflow: 'auto',
                                                                fontSize: '11px',
                                                                maxHeight: '300px',
                                                            }}>
                                                                {expandedPayloads[n.id] === undefined
                                                                    ? 'Cargando payload...'
                                                                    : JSON.stringify(expandedPayloads[n.id], null, 2)}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
