import React from 'react';
import { Clock, Zap, CheckCircle, XCircle } from 'lucide-react';

export default function CampaignStatusBadge({ status, finishDate, name }) {
  const getStatusInfo = () => {
    if (status === 'finished') {
      return {
        label: 'Terminada',
        color: '#64748b',
        bgColor: 'rgba(100, 116, 139, 0.1)',
        icon: <XCircle size={14} />,
        border: 'rgba(100, 116, 139, 0.2)'
      };
    }
    
    if (status === 'candidate') {
      return {
        label: 'Disponible (Candidato)',
        color: '#3b82f6',
        bgColor: 'rgba(59, 130, 246, 0.1)',
        icon: <Zap size={14} />,
        border: 'rgba(59, 130, 246, 0.2)'
      };
    }
    
    if (status === 'pending') {
       return {
        label: 'Programada',
        color: '#8b5cf6',
        bgColor: 'rgba(139, 92, 246, 0.1)',
        icon: <Clock size={14} />,
        border: 'rgba(139, 92, 246, 0.2)'
      };
    }

    if (status === 'started') {
      if (finishDate) {
        const now = new Date();
        const end = new Date(finishDate);
        const diffHours = (end - now) / (1000 * 60 * 60);

        if (diffHours < 24) {
          return {
            label: `Expira pronto (< 24h)`,
            color: '#ef4444',
            bgColor: 'rgba(239, 68, 68, 0.1)',
            icon: <Clock size={14} />,
            border: 'rgba(239, 68, 68, 0.2)'
          };
        }
        if (diffHours < 24 * 7) {
          return {
            label: `Activa (< 7 días)`,
            color: '#f59e0b',
            bgColor: 'rgba(245, 158, 11, 0.1)',
            icon: <Clock size={14} />,
            border: 'rgba(245, 158, 11, 0.2)'
          };
        }
      }
      return {
        label: 'Activa',
        color: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.1)',
        icon: <CheckCircle size={14} />,
        border: 'rgba(16, 185, 129, 0.2)'
      };
    }

    return {
      label: status,
      color: '#cbd5e1',
      bgColor: 'rgba(203, 213, 225, 0.1)',
      icon: <CheckCircle size={14} />,
      border: 'rgba(203, 213, 225, 0.2)'
    };
  };

  const info = getStatusInfo();

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', backgroundColor: info.bgColor, border: `1px solid ${info.border}`, color: info.color, fontSize: '0.75rem', fontWeight: '500' }}>
      {info.icon}
      <span>{info.label}</span>
    </div>
  );
}
