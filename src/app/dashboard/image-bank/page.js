"use client";

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import styles from '../dashboard.module.css';

export default function ImageBankPage() {
  const supabase = createClientComponentClient();
  const [stats, setStats] = useState({ total: 0, synced: 0, pending: 0, error: 0 });
  const [recentImages, setRecentImages] = useState([]);
  const [searchSku, setSearchSku] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // Suscribirse a cambios para ver el progreso en tiempo real
    const channel = supabase
      .channel('image_bank_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'image_bank' }, () => {
        fetchData(false); // Refrescar stats sin loading spinner
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      // 1. Obtener Stats
      const { data: allData, error: errStats } = await supabase
        .from('image_bank')
        .select('sync_status');

      if (!errStats) {
        const counts = allData.reduce((acc, curr) => {
          acc[curr.sync_status] = (acc[curr.sync_status] || 0) + 1;
          return acc;
        }, {});
        setStats({
          total: allData.length,
          synced: counts.synced || 0,
          pending: (counts.pending || 0) + (counts.changed || 0),
          error: counts.error || 0
        });
      }

      // 2. Obtener imágenes recientes sincronizadas
      const { data: recent, error: errRecent } = await supabase
        .from('image_bank')
        .select('*')
        .eq('sync_status', 'synced')
        .order('last_synced_at', { ascending: false })
        .limit(24);

      if (!errRecent) setRecentImages(recent);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchSku) { fetchData(); return; }
    setLoading(true);
    const { data } = await supabase
      .from('image_bank')
      .select('*')
      .ilike('sku', `%${searchSku}%`)
      .order('image_index', { ascending: true });
    setRecentImages(data || []);
    setLoading(false);
  };

  const progress = stats.total > 0 ? Math.round((stats.synced / stats.total) * 100) : 0;

  return (
    <div className={styles.container} style={{ background: '#050505', minHeight: '100vh', color: 'white' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '800', margin: 0, background: 'linear-gradient(to right, #fbbf24, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🖼️ Banco de Imágenes
          </h1>
          <p style={{ opacity: 0.6, marginTop: '0.5rem' }}>Gestión centralizada de activos para MercadoLibre</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981' }}>{progress}% Completado</div>
          <div style={{ width: '200px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '0.5rem', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#10b981', transition: 'width 0.5s ease' }}></div>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '3rem' }}>
        {[
          { label: 'Total Inventario', value: stats.total, color: '#3b82f6', icon: '📦' },
          { label: 'Sincronizadas (ML)', value: stats.synced, color: '#10b981', icon: '✅' },
          { label: 'Pendientes', value: stats.pending, color: '#fbbf24', icon: '⏳' },
          { label: 'Errores', value: stats.error, color: '#ef4444', icon: '❌' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '16px', border: `1px solid rgba(255,255,255,0.05)`, borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '0.5rem', fontWeight: 'bold' }}>{s.icon} {s.label.toUpperCase()}</div>
            <div style={{ fontSize: '2rem', fontWeight: '800' }}>{s.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Buscador */}
      <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
        <input 
          type="text" 
          placeholder="Buscar por SKU..." 
          className={styles.input}
          value={searchSku}
          onChange={(e) => setSearchSku(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          style={{ flex: 1, padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
        />
        <button onClick={handleSearch} className={styles.primaryBtn} style={{ padding: '0 2rem', borderRadius: '12px' }}>🔍 Buscar</button>
      </div>

      {/* Galería */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
        {loading ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem', opacity: 0.5 }}>Cargando galería...</div>
        ) : recentImages.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem', opacity: 0.5 }}>No se encontraron imágenes sincronizadas aún.</div>
        ) : recentImages.map((img, i) => (
          <div key={img.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', transition: 'transform 0.2s', cursor: 'pointer' }}
               onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
               onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
            <div style={{ position: 'relative', paddingTop: '100%' }}>
              <img 
                src={img.ml_url || img.ml_secure_url} 
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
                alt={img.sku}
              />
              <div style={{ position: 'absolute', top: '10px', right: '10px', background: img.sync_status === 'synced' ? '#10b981' : '#fbbf24', color: 'black', padding: '2px 8px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold' }}>
                {img.sync_status.toUpperCase()}
              </div>
            </div>
            <div style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fbbf24', marginBottom: '0.2rem' }}>{img.sku}</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.5, wordBreak: 'break-all' }}>ID: {img.ml_picture_id || 'PENDIENTE'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
