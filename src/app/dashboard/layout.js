import Sidebar from '@/components/Sidebar';
import { accountsTable } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'ML ERP - Dashboard',
  description: 'Sistema de gestión avanzada para Mercado Libre',
};

export default async function DashboardLayout({ children }) {
  let accounts = [];
  
  // 1. Obtener todas las cuentas vinculadas de forma defensiva
  try {
    const { data, error } = await accountsTable().select('id, nickname, site_id').order('nickname');
    if (error) {
      console.error("Error cargando cuentas en el layout:", error.message || error);
    } else if (data) {
      accounts = data;
    }
  } catch (err) {
    console.error("Excepción cargando cuentas en el layout:", err.message || err);
  }

  // 2. Obtener la cuenta activa de las cookies
  let activeAccountId = null;
  try {
    const cookieStore = await cookies();
    activeAccountId = cookieStore.get('meli_erp_account')?.value || accounts[0]?.id || null;
  } catch (err) {
    activeAccountId = accounts[0]?.id || null;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar accounts={accounts} activeAccountId={activeAccountId} />
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
