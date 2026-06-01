import React from 'react';
import { ExternalLink } from 'lucide-react';
import CampaignStatusBadge from './CampaignStatusBadge';

export default function ItemsPromotionTable({ items, selectedIds, onSelectionChange, onPriceEdit }) {
  const toggleAll = (e) => {
    if (e.target.checked) {
      onSelectionChange(new Set(items.map(i => i.id)));
    } else {
      onSelectionChange(new Set());
    }
  };

  const toggleOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  return (
    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
        <thead style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <tr>
            <th style={{ padding: '12px 16px', width: '40px' }}>
              <input 
                type="checkbox" 
                checked={items.length > 0 && selectedIds.size === items.length}
                onChange={toggleAll}
                style={{ accentColor: '#3b82f6', cursor: 'pointer' }}
              />
            </th>
            <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: '500' }}>Ítem</th>
            <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: '500' }}>Precio Base</th>
            <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: '500' }}>Promoción Activa</th>
            <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: '500', textAlign: 'right' }}>Precio Oferta</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const safePromos = Array.isArray(item.promotions) ? item.promotions : [];
            const activePromo = safePromos.find(p => p.status === 'started');
            const candidatePromo = safePromos.find(p => p.status === 'candidate');
            const promoToShow = activePromo || candidatePromo;
            
            return (
              <tr 
                key={item.id} 
                style={{ 
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  backgroundColor: selectedIds.has(item.id) ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                  transition: 'background-color 0.2s'
                }}
              >
                <td style={{ padding: '12px 16px' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleOne(item.id)}
                    style={{ accentColor: '#3b82f6', cursor: 'pointer' }}
                  />
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <a 
                      href={`https://articulo.mercadolibre.com.ve/${item.id.replace('MLV', 'MLV-')}`}
                      target="_blank" 
                      rel="noreferrer"
                      style={{ fontWeight: '600', color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      {item.id} <ExternalLink size={12} />
                    </a>
                    <span style={{ color: '#64748b', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                      {item.title}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                  ${item.price.toFixed(2)}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {promoToShow ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                      <CampaignStatusBadge 
                        status={promoToShow.status} 
                        finishDate={promoToShow.finish_date} 
                        name={promoToShow.name} 
                      />
                      {promoToShow.name && (
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{promoToShow.name}</span>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Sin promociones</span>
                  )}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                    {activePromo && activePromo.price > 0 && (
                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                        ${activePromo.price.toFixed(2)}
                      </span>
                    )}
                    {(!activePromo || activePromo.price === 0) && (
                      <input 
                        type="number"
                        className="input-glass"
                        style={{ width: '90px', padding: '6px', textAlign: 'right' }}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        value={item.dealPrice || ''}
                        onChange={(e) => onPriceEdit(item.id, e.target.value)}
                        disabled={selectedIds.size > 0 && selectedIds.has(item.id)}
                      />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr>
              <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                No hay ítems para mostrar
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
