import Sidebar from '@/components/Sidebar';
import { accountsTable } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';

export const metadata = {
  title: 'ML ERP - Dashboard',
  description: 'Sistema de gestión avanzada para Mercado Libre',
};

export default async function DashboardLayout({ children }) {
  // 1. Obtener todas las cuentas vinculadas
  const { data, error } = await accountsTable().select('id, nickname, site_id').order('nickname');
  const accounts = data || [];

  if (error) {
    console.error("Error cargando cuentas en el layout:", error);
  }

  // 2. Obtener la cuenta activa de las cookies
  const cookieStore = await cookies();
  const activeAccountId = cookieStore.get('meli_erp_account')?.value || accounts[0]?.id || null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar accounts={accounts} activeAccountId={activeAccountId} />
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
