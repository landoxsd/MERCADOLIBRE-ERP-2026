import React from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';

export default function CompetitorPriceGauge({ ourPrice, minCompetitorPrice }) {
  if (!ourPrice || !minCompetitorPrice) return null;

  const isCheaper = ourPrice <= minCompetitorPrice;
  const ratio = (ourPrice / minCompetitorPrice) * 100;
  
  // Color determination
  // Verde si somos más baratos, amarillo si estamos hasta 5% más caros, rojo si somos más de 5% caros
  let color = '#10b981'; // success
  if (ratio > 105) color = '#ef4444'; // error
  else if (ratio > 100) color = '#f59e0b'; // warning

  // Limit ratio to 150 for visualization purposes
  const displayRatio = Math.min(ratio, 150);
  
  const data = [
    {
      name: 'Competencia',
      value: 100,
      fill: 'rgba(148, 163, 184, 0.2)', // background track
    },
    {
      name: 'Nuestro Precio',
      value: displayRatio,
      fill: color,
    }
  ];

  const gap = Math.abs(ourPrice - minCompetitorPrice).toFixed(2);
  const gapText = isCheaper ? `-$${gap}` : `+$${gap}`;

  return (
    <div style={{ position: 'relative', width: '100px', height: '100px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', width: '100%', height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart 
            cx="50%" 
            cy="50%" 
            innerRadius="60%" 
            outerRadius="80%" 
            barSize={10} 
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <RadialBar
              minAngle={15}
              background
              clockWise
              dataKey="value"
              cornerRadius={5}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      
      <div style={{ position: 'absolute', top: '55%', textAlign: 'center', transform: 'translateY(-50%)' }}>
        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: color }}>
          {gapText}
        </div>
      </div>
    </div>
  );
}
