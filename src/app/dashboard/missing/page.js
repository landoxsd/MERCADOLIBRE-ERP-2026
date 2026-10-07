'use client';
import { useState, useEffect } from 'react';
import styles from './Missing.module.css';
import MassPublisherModal from '@/components/inventory/MassPublisherModal';

export default function MissingProductsPage() {
  const [activeAccount, setActiveAccount] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [searchSubline, setSearchSubline] = useState('');
  
  // Sublínea seleccionada
  const [selectedSubline, setSelectedSubline] = useState(null);
  
  // Estado de los items de la sublínea
  const [itemsData, setItemsData] = useState(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [batchPage, setBatchPage] = useState(1);
  const [batchLimit, setBatchLimit] = useState(50);
  const [itemSearch, setItemSearch] = useState('');
  const [photoFilter, setPhotoFilter] = useState('all'); // 'all' | 'with' | 'without'

  // Modal de Publicación Masiva
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchItemsToPublish, setBatchItemsToPublish] = useState([]);

  // Detectar cuenta activa
  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const cookies = document.cookie.split('; ');
        const activeCookie = cookies.find((row) => row.startsWith('meli_erp_account='));
        const cookieId = activeCookie ? activeCookie.split('=')[1] : null;

        if (cookieId) {
          setActiveAccount(cookieId);
        } else {
          const res = await fetch('/api/auth/accounts');
          const data = await res.json();
          if (data.accounts?.length > 0) {
            setActiveAccount(data.accounts[0].id);
          }
        }
      } catch (e) {
        console.error('Error fetching account:', e);
      }
    };
    fetchAccount();
  }, []);

  // Cargar resumen de sublíneas
  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await fetch('/api/profit/missing/sublines?min=1');
      const data = await res.json();
      if (data.success) {
        setSummary(data.data);
        if (data.data.sublines?.length > 0 && !selectedSubline) {
          setSelectedSubline(data.data.sublines[0]);
        }
      }
    } catch (e) {
      console.error('Error cargando sublíneas:', e);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  // Cargar artículos cuando cambia la sublínea, página o filtros
  useEffect(() => {
    if (!selectedSubline) return;

    const fetchItems = async () => {
      setLoadingItems(true);
      try {
        const params = new URLSearchParams({
          co_subl: selectedSubline.co_subl,
          page: String(batchPage),
          limit: String(batchLimit),
          search: itemSearch,
          photoFilter: photoFilter,
        });

        const res = await fetch(`/api/profit/missing/items?${params.toString()}`);
        const data = await res.json();
        if (data.success) {
          setItemsData(data.data);
        }
      } catch (e) {
        console.error('Error cargando artículos faltantes:', e);
      } finally {
        setLoadingItems(false);
      }
    };

    fetchItems();
  }, [selectedSubline, batchPage, batchLimit, itemSearch, photoFilter]);

  // Manejar cambio de sublínea
  const handleSelectSubline = (sub) => {
    setSelectedSubline(sub);
    setBatchPage(1);
    setItemSearch('');
    setPhotoFilter('all');
  };

  // Descargar Excel
  const handleDownloadExcel = (isAll = false) => {
    if (!selectedSubline) return;
    const params = new URLSearchParams({
      co_subl: selectedSubline.co_subl,
      page: String(isAll ? 1 : batchPage),
      limit: isAll ? 'all' : String(batchLimit),
      search: itemSearch,
      photoFilter: photoFilter,
    });
    window.open(`/api/profit/missing/export?${params.toString()}`, '_blank');
  };

  // Abrir Publicador Masivo con el lote actual
  const handleOpenPublisher = () => {
    if (!itemsData?.items?.length) return;
    const prepared = itemsData.items.map((it) => ({
      sku: it.sku,
      title: it.titulo_seo || it.descripcion,
      description: it.descripcion_ml,
      price: it.precio,
      stock: it.stock_total || 1,
      subline: it.sublinea,
      brand: it.brand_suggested || 'Genérico',
      isGenericE: it.is_generic_e || false,
      oem: it.campo7 || it.referencia || (it.equivalencias?.[0] || ''),
      equivalencias: it.equivalencias || [],
    }));
    setBatchItemsToPublish(prepared);
    setBatchModalOpen(true);
  };

  // Filtrado de sublíneas en el sidebar
  const filteredSublines = (summary?.sublines || []).filter((s) => {
    if (!searchSubline.trim()) return true;
    const q = searchSubline.toLowerCase();
    return s.sublinea.toLowerCase().includes(q) || s.co_subl.toLowerCase().includes(q);
  });

  // Cálculo de lotes
  const totalItemsCount = selectedSubline?.faltantes || 0;
  const totalBatches = Math.ceil(totalItemsCount / batchLimit) || 1;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>📋 Publicaciones Faltantes por Sub-línea</h1>
        <p className={styles.subtitle}>
          Cruce seguro en tiempo real: Profit Plus SQL Server (Inventario con Stock) vs Mercado Libre (Dell R630).
          Validación automática de códigos oficiales y cruce con 265,000+ equivalencias.
        </p>
      </div>

      {/* Métricas Globales */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Artículos Faltantes</div>
          <div className={styles.metricValue} style={{ color: '#ef4444' }}>
            {summary ? summary.total_articulos_faltantes.toLocaleString() : '...'}
          </div>
          <div className={styles.metricSubtext}>Con stock activo en Profit pero sin publicar</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Artículos con Stock</div>
          <div className={styles.metricValue} style={{ color: '#3b82f6' }}>
            {summary ? summary.total_articulos_stock.toLocaleString() : '...'}
          </div>
          <div className={styles.metricSubtext}>En almacenes de Profit Plus</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Artículos Ya Publicados</div>
          <div className={styles.metricValue} style={{ color: '#10b981' }}>
            {summary ? summary.total_articulos_publicados.toLocaleString() : '...'}
          </div>
          <div className={styles.metricSubtext}>Sincronizados en Mercado Libre</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Sub-líneas con Faltantes</div>
          <div className={styles.metricValue} style={{ color: '#fbbf24' }}>
            {summary ? summary.total_sublines.toLocaleString() : '...'}
          </div>
          <div className={styles.metricSubtext}>Familias de repuestos para abastecer</div>
        </div>
      </div>

      {/* Layout Principal: Sublíneas + Detalle por Lotes */}
      <div className={styles.layoutGrid}>
        {/* Columna Izquierda: Listado de Sublíneas */}
        <div className={styles.sidebarCard}>
          <div className={styles.sidebarHeader}>
            <input
              type="text"
              placeholder="🔍 Buscar sub-línea o código..."
              className={styles.searchBox}
              value={searchSubline}
              onChange={(e) => setSearchSubline(e.target.value)}
            />
          </div>

          <div className={styles.sublinesList}>
            {loadingSummary ? (
              <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                Cargando sublíneas desde Profit...
              </div>
            ) : filteredSublines.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                No se encontraron sublíneas
              </div>
            ) : (
              filteredSublines.map((sub) => {
                const isActive = selectedSubline?.co_subl === sub.co_subl;
                return (
                  <button
                    key={sub.co_subl}
                    className={`${styles.sublineItem} ${isActive ? styles.sublineItemActive : ''}`}
                    onClick={() => handleSelectSubline(sub)}
                  >
                    <div className={styles.sublineTitle}>
                      <span>{sub.sublinea}</span>
                      <span className={styles.sublineCode}>[{sub.co_subl}]</span>
                    </div>

                    <div className={styles.sublineBadges}>
                      <span className={styles.badgeMissing} title="Artículos faltantes por publicar">
                        {sub.faltantes} faltan
                      </span>
                      <span className={styles.badgePublished} title="Artículos ya publicados en MercadoLibre">
                        {sub.publicados} pub.
                      </span>
                      <span className={styles.badgeStock} title="Total con stock en almacén">
                        {sub.total_con_stock} stock
                      </span>
                    </div>

                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${sub.pct_publicado}%` }}
                        title={`${sub.pct_publicado}% publicado`}
                      />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Columna Derecha: Contenido y Tabla por Lotes */}
        <div className={styles.contentCard}>
          {selectedSubline ? (
            <>
              {/* Encabezado del Detalle */}
              <div className={styles.detailHeader}>
                <div>
                  <h2 className={styles.detailTitle}>
                    {selectedSubline.sublinea}
                    <span style={{ fontSize: '1rem', color: '#fbbf24', marginLeft: '0.8rem', fontFamily: 'monospace' }}>
                      ({selectedSubline.co_subl})
                    </span>
                  </h2>
                  <div className={styles.detailSub}>
                    Total con stock: <strong>{selectedSubline.total_con_stock}</strong> | 
                    Ya publicados: <strong>{selectedSubline.publicados}</strong> | 
                    Faltantes a publicar: <strong style={{ color: '#f87171' }}>{selectedSubline.faltantes}</strong> (
                    {selectedSubline.total_batches_50} lotes de 50)
                  </div>
                </div>

                <div className={styles.actionsBar}>
                  <button
                    className={styles.btnExcel}
                    onClick={() => handleDownloadExcel(false)}
                    title="Descargar los artículos de este lote en formato Excel"
                  >
                    📥 Excel Lote {batchPage}
                  </button>

                  <button
                    className={styles.btnExcel}
                    style={{ background: '#059669' }}
                    onClick={() => handleDownloadExcel(true)}
                    title="Descargar todos los faltantes de esta sublínea en Excel"
                  >
                    📥 Excel Sublínea Completa
                  </button>

                  <button
                    className={styles.btnPublish}
                    onClick={handleOpenPublisher}
                    disabled={!itemsData?.items?.length}
                    title="Abrir asistente de publicación masiva para este lote"
                  >
                    🚀 Publicar Lote {batchPage} en ML
                  </button>
                </div>
              </div>

              {/* Selector de Lotes y Filtros */}
              <div className={styles.batchSelectorContainer}>
                {/* Pestañas de Lotes */}
                <div className={styles.batchTabs}>
                  {Array.from({ length: totalBatches }).map((_, idx) => {
                    const pageNum = idx + 1;
                    const fromNum = (pageNum - 1) * batchLimit + 1;
                    const toNum = Math.min(pageNum * batchLimit, totalItemsCount);
                    const isActive = batchPage === pageNum;

                    return (
                      <button
                        key={pageNum}
                        className={`${styles.batchTab} ${isActive ? styles.batchTabActive : ''}`}
                        onClick={() => setBatchPage(pageNum)}
                      >
                        Lote {pageNum} ({fromNum} - {toNum})
                      </button>
                    );
                  })}
                </div>

                {/* Filtros Secundarios */}
                <div className={styles.filterControls}>
                  <div className={styles.filterItem}>
                    <span>Fotos:</span>
                    <select
                      className={styles.selectInput}
                      value={photoFilter}
                      onChange={(e) => {
                        setPhotoFilter(e.target.value);
                        setBatchPage(1);
                      }}
                    >
                      <option value="all">Todas ({itemsData?.total_faltantes || 0})</option>
                      <option value="with">Con Foto 📸 ({itemsData?.total_con_foto || 0})</option>
                      <option value="without">Sin Foto ❌ ({itemsData?.total_sin_foto || 0})</option>
                    </select>
                  </div>

                  <div className={styles.filterItem}>
                    <span>Por Lote:</span>
                    <select
                      className={styles.selectInput}
                      value={batchLimit}
                      onChange={(e) => {
                        setBatchLimit(Number(e.target.value));
                        setBatchPage(1);
                      }}
                    >
                      <option value={25}>25 por lote</option>
                      <option value={50}>50 por lote</option>
                      <option value={100}>100 por lote</option>
                    </select>
                  </div>

                  <div className={styles.filterItem} style={{ flex: 1, minWidth: '220px' }}>
                    <input
                      type="text"
                      placeholder="Buscar SKU, descripción, referencia u OEM..."
                      className={styles.searchBox}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                      value={itemSearch}
                      onChange={(e) => {
                        setItemSearch(e.target.value);
                        setBatchPage(1);
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Tabla de Artículos Faltantes */}
              {loadingItems ? (
                <div className={styles.loadingBox}>
                  Cargando artículos del lote {batchPage} desde Profit Plus...
                </div>
              ) : !itemsData?.items?.length ? (
                <div className={styles.loadingBox}>
                  No hay artículos faltantes con los filtros seleccionados.
                </div>
              ) : (
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ width: '60px' }}>Foto</th>
                        <th style={{ width: '150px' }}>SKU Oficial</th>
                        <th>Descripción Profit / Modelo</th>
                        <th>OEM / Equivalencias</th>
                        <th style={{ textAlign: 'right' }}>Stock</th>
                        <th style={{ textAlign: 'right' }}>Precio USD</th>
                        <th style={{ textAlign: 'center', width: '100px' }}>Fotos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsData.items.map((item) => (
                        <tr key={item.sku}>
                          <td>
                            {item.has_photo && item.photo_url ? (
                              <img
                                src={item.photo_url}
                                alt={item.sku}
                                className={styles.photoThumbnail}
                                title={`${item.photo_filename} (Pasa el cursor para agrandar)`}
                              />
                            ) : (
                              <div className={styles.noPhoto} title="Sin foto en F:\ o Pictures\FOTOS">
                                ❌
                              </div>
                            )}
                          </td>

                          <td className={styles.skuCell} title="Código oficial que DEBE tener en Mercado Libre">
                            {item.sku}
                            {item.is_generic_e && (
                              <span className={styles.tagGenericE} title="Genérico / Multimarca (Terminación E: marca variable según disponibilidad)">
                                MULTIMARCA
                              </span>
                            )}
                          </td>

                          <td className={styles.titleCell}>
                            <div style={{ fontWeight: 600, color: '#fff' }}>{item.titulo_seo || item.descripcion}</div>
                            <div className={styles.descExtra}>
                              <span>📦 Profit: {item.descripcion}</span>
                              {item.modelo && <span> | 🚗 Mod: {item.modelo}</span>}
                              {item.referencia && <span> | 📌 Ref: {item.referencia}</span>}
                            </div>
                          </td>

                          <td>
                            {item.campo7 && (
                              <span className={styles.tagEquiv} title="Código OEM (Campo 7)">
                                OEM: {item.campo7}
                              </span>
                            )}
                            {item.equivalencias && item.equivalencias.slice(0, 3).map((eq, i) => (
                              <span key={i} className={styles.tagEquiv}>
                                {eq}
                              </span>
                            ))}
                            {item.equivalencias && item.equivalencias.length > 3 && (
                              <span
                                className={styles.tagEquiv}
                                style={{ background: 'rgba(255,255,255,0.1)' }}
                                title={item.equivalencias.slice(3).join(', ')}
                              >
                                +{item.equivalencias.length - 3} más
                              </span>
                            )}
                          </td>

                          <td className={styles.stockCell} style={{ textAlign: 'right' }}>
                            {item.stock_total}
                          </td>

                          <td className={styles.priceCell} style={{ textAlign: 'right' }}>
                            ${item.precio.toFixed(2)}
                          </td>

                          <td style={{ textAlign: 'center' }}>
                            {item.has_photo ? (
                              <span
                                style={{
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  color: '#34d399',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                }}
                              >
                                📸 {item.photos_count}
                              </span>
                            ) : (
                              <span
                                style={{
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  color: '#fbbf24',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                }}
                              >
                                Sin foto
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className={styles.loadingBox}>
              Selecciona una sublínea de la izquierda para ver los artículos faltantes.
            </div>
          )}
        </div>
      </div>

      {/* Modal de Publicación Masiva de Mercado Libre */}
      {batchModalOpen && (
        <MassPublisherModal
          isOpen={batchModalOpen}
          onClose={() => setBatchModalOpen(false)}
          selectedItems={batchItemsToPublish}
          accountId={activeAccount}
          defaultPhotosPath="C:\Users\ORLANDO\Pictures\FOTOS"
        />
      )}
    </div>
  );
}
