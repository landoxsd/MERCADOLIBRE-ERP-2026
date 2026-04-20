import Sidebar from '@/components/Sidebar';

export const metadata = {
  title: 'ML ERP - Dashboard',
  description: 'Sistema de gestión avanzada para Mercado Libre',
};

export default function DashboardLayout({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar accounts={[]} activeAccountId={null} />
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
