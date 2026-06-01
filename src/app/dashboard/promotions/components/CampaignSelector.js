import React from 'react';
import { Tag } from 'lucide-react';

export default function CampaignSelector({ campaigns, selectedId, onChange, label = "Seleccionar Campaña" }) {
  // Solo campañas activas, candidatas o programadas
  const activeCampaigns = campaigns.filter(c => c.status !== 'finished');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Tag size={14} /> {label}
      </label>
      <div className="search-input-group" style={{ position: 'relative' }}>
        <select
          className="input-glass"
          value={selectedId || ''}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: '100%', appearance: 'none', paddingRight: '2rem' }}
        >
          <option value="" disabled>-- Elige una campaña --</option>
          {activeCampaigns.map(c => (
            <option key={c.id} value={c.id}>
              {c.name || c.id} ({c.type}) - {c.status === 'started' ? 'Activa' : 'Candidata'}
            </option>
          ))}
        </select>
        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }}>
          ▼
        </div>
      </div>
    </div>
  );
}
