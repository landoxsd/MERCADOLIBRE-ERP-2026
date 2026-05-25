'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/dashboard/orders', label: 'Órdenes', icon: '📦' },
  { href: '/dashboard/products', label: 'Publicaciones', icon: '🏷️' },
  { href: '/dashboard/inventory', label: 'Auditoría Inventario', icon: '🔍' },
  { href: '/dashboard/image-bank', label: 'Banco de Imágenes', icon: '🖼️' },
  { href: '/dashboard/webhooks', label: 'Webhooks', icon: '🔔' },
  { href: '/dashboard/questions', label: 'Preguntas', icon: '💬' },
  { href: '/dashboard/customers', label: 'Clientes CRM', icon: '👥' },
  { href: '/dashboard/whatsapp', label: 'WhatsApp', icon: '📱' },
  { href: '/dashboard/analytics', label: 'Analíticas', icon: '📈' },
  { href: '/dashboard/intelligence', label: 'Listing Sniper', icon: '🎯' },
  { href: '/dashboard/spy', label: 'Seller Spy 🕵️', icon: '👁️' },
  { href: '/dashboard/radar', label: 'Radar Nichos', icon: '📡' },
  { href: '/dashboard/keywords', label: 'Keywords', icon: '🔑' },
  { href: '/dashboard/export', label: 'Big Data Export', icon: '📤' },
  { href: '/dashboard/images/hunter', label: 'Image Hunter', icon: '📸' },
  { href: '/dashboard/optimizer', label: 'Listing Optimizer', icon: '⚡' },
];

export default function Sidebar({ accounts = [], activeAccountId }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const handleAccountChange = (e) => {
    const newId = e.target.value;
    // Guardar la nueva cookie con el nombre unificado meli_erp_account
    document.cookie = `meli_erp_account=${newId}; path=/; max-age=${60 * 60 * 24 * 7}`;
    // Forzar recarga total para asegurar que el servidor lea la nueva cuenta activa
    window.location.reload();
  };

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      {/* Branding */}
      <div className={styles.brand}>
        <div className={styles.brandLogo}>ML</div>
        {!collapsed && <span className={styles.brandName}>ML ERP</span>}
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expandir' : 'Colapsar'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Selector de Cuentas */}
      {!collapsed && (
        <div className={styles.accountSection}>
          <p className={styles.sectionLabel}>CUENTA ACTIVA</p>
          <div className={styles.accountSelector}>
            {accounts.length === 0 ? (
              <Link href="/auth" className={styles.addAccount}>
                + Conectar cuenta
              </Link>
            ) : (
              <>
                <select
                  className={styles.accountSelect}
                  value={activeAccountId || ''}
                  onChange={handleAccountChange}
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.nickname} ({acc.site_id})
                    </option>
                  ))}
                </select>
                <Link href="/auth" className={styles.addAccountSmall}>
                  + Agregar
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* Navegación Principal */}
      <nav className={styles.nav}>
        {NAV_ITEMS.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer del Sidebar */}
      {!collapsed && (
        <div className={styles.sidebarFooter}>
          <Link href="/dashboard/settings" className={styles.navItem}>
            <span className={styles.navIcon}>⚙️</span>
            <span className={styles.navLabel}>Configuración</span>
          </Link>
          <div className={styles.statusDot}>
            <div className={styles.dot} />
            <span>Servidor activo</span>
          </div>
        </div>
      )}
    </aside>
  );
}
