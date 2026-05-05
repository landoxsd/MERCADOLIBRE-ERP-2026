"use client";

import React, { useState, useEffect } from 'react';

export default function ImageBankPage() {
  const [stats, setStats] = useState({ total: 0, synced: 0, pending: 0, error: 0 });
  const [recentImages, setRecentImages] = useState([]);
  const [searchSku, setSearchSku] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(false), 30000);
    return () => clearInterval(interval);
  }, [stockFilter]);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const url = `/api/image-bank/stats?stock=${stockFilter}${searchSku ? `&search=${searchSku}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.success) {
        setStats(data.stats);
        setRecentImages(data.recent);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchData(true);
  };

  const progress = stats.total > 0 ? Math.round((stats.synced / stats.total) * 100) : 0;

  const getImageUrl = (img) => {
    if (img.ml_url || img.ml_secure_url) return img.ml_url || img.ml_secure_url;
    if (img.ml_picture_id) {
      // Extraer solo la primera parte del ID si es necesario o usar el ID completo
      // Formato estándar de ML: https://http2.mlstatic.com/D_[ID]-O.jpg
      return `https://http2.mlstatic.com/D_${img.ml_picture_id}-O.jpg`;
    }
    return null;
  };

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: 'white', padding: '2rem' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
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

      {/* Buscador y Filtros */}
      <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 2, display: 'flex', gap: '1rem' }}>
          <input 
            type="text" 
            placeholder="Buscar por SKU..." 
            value={searchSku}
            onChange={(e) => setSearchSku(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1, padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
          />
          <button onClick={handleSearch} style={{ padding: '0 2rem', borderRadius: '12px', background: '#fbbf24', color: 'black', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>🔍 Buscar</button>
        </div>
        
        <div style={{ flex: 1, display: 'flex', gap: '0.5rem' }}>
          <select 
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            style={{ flex: 1, padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none', cursor: 'pointer' }}
          >
            <option value="all">📦 Todos los productos</option>
            <option value="inStock">✅ Con Stock Disponible</option>
            <option value="noStock">❌ Sin Stock (Agotados)</option>
          </select>
        </div>
      </div>

      {/* Galería */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
        {loading && recentImages.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem', opacity: 0.5 }}>Cargando galería...</div>
        ) : recentImages.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem', opacity: 0.5 }}>No se encontraron imágenes sincronizadas aún.</div>
        ) : recentImages.map((img, i) => (
          <div key={img.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', transition: 'transform 0.2s', cursor: 'pointer' }}>
            <div style={{ position: 'relative', paddingTop: '100%' }}>
              <img 
                src={getImageUrl(img)} 
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
                alt={img.sku}
                loading="lazy"
              />
              <div style={{ position: 'absolute', top: '10px', right: '10px', background: img.sync_status === 'synced' ? '#10b981' : '#fbbf24', color: 'black', padding: '2px 8px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold' }}>
                {img.sync_status.toUpperCase()}
              </div>
              
              {/* Badge de Stock */}
              <div style={{ 
                position: 'absolute', bottom: '10px', left: '10px', 
                background: img.stock > 0 ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)', 
                color: 'white', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold',
                backdropFilter: 'blur(4px)'
              }}>
                Stock: {img.stock}
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
