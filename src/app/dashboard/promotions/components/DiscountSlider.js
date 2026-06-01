import React from 'react';
import { Percent } from 'lucide-react';

export default function DiscountSlider({ basePrice, value, onChange, min = 5, max = 80 }) {
  const calculatedPrice = basePrice ? (basePrice * (1 - value / 100)).toFixed(2) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Percent size={14} /> Descuento a aplicar
        </label>
        <span style={{ fontWeight: '600', color: '#3b82f6', fontSize: '1.1rem' }}>
          {value}%
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          accentColor: '#3b82f6',
          cursor: 'pointer'
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
        <span>Min: {min}%</span>
        <span>Max: {max}%</span>
      </div>

      {basePrice > 0 && (
        <div style={{ 
          marginTop: '8px', 
          padding: '12px', 
          backgroundColor: 'rgba(16, 185, 129, 0.1)', 
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Precio resultante:</span>
          <div style={{ textAlign: 'right' }}>
            <div style={{ textDecoration: 'line-through', color: '#64748b', fontSize: '0.8rem' }}>
              ${basePrice.toFixed(2)}
            </div>
            <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.2rem' }}>
              ${calculatedPrice}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
