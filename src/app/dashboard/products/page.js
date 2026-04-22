/* src/app/dashboard/products/page.js */
'use client';
import { useState, useEffect } from 'react';
import ProductsTable from '@/components/ProductsTable';

export default function PublicationsPage() {
  // En una app real, esto vendría de un context o cookie de la cuenta activa
  // Por ahora lo dejamos dinámico para las pruebas
  const [activeAccount, setActiveAccount] = useState(null);

  useEffect(() => {
    const fetchActiveAccount = async () => {
      try {
        // 1. Intentar leer la cuenta activa desde la nueva cookie unificada
        const cookies = document.cookie.split('; ');
        const activeCookie = cookies.find(row => row.startsWith('meli_erp_account='));
        const cookieId = activeCookie ? activeCookie.split('=')[1] : null;

        if (cookieId) {
          setActiveAccount(cookieId);
          return;
        }

        // 2. Si no hay cookie, fallback a la primera cuenta disponible
        const res = await fetch('/api/auth/accounts');
        const data = await res.json();
        if (data.accounts && data.accounts.length > 0) {
          const firstId = data.accounts[0].id;
          setActiveAccount(firstId);
          // Guardar en la nueva cookie unificada
          document.cookie = `meli_erp_account=${firstId}; path=/; max-age=${60 * 60 * 24 * 7}`;
        }
      } catch (err) {
        console.error('Error al obtener cuenta activa:', err);
      }
    };
    fetchActiveAccount();
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '0.5rem' }}>
          Gestión de Publicaciones
        </h1>
        <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
          Administra tu inventario de autopartes, optimiza el posicionamiento SEO y gestiona compatibilidades.
        </p>
      </header>

      {activeAccount ? (
        <ProductsTable accountId={activeAccount} />
      ) : (
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.05)', 
          padding: '4rem', 
          borderRadius: '20px', 
          textAlign: 'center',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <h2 style={{ marginBottom: '1rem' }}>No hay cuenta vinculada</h2>
          <p style={{ marginBottom: '2rem', opacity: 0.7 }}>
            Debes vincular una cuenta de Mercado Libre para ver tus publicaciones.
          </p>
          <a href="/auth" style={{ 
            padding: '1rem 2rem', 
            background: 'white', 
            color: 'black', 
            borderRadius: '12px', 
            textDecoration: 'none',
            fontWeight: 'bold'
          }}>
            Vincular Cuenta
          </a>
        </div>
      )}
    </div>
  );
}
