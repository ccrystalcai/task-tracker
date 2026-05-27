import { Outlet } from 'react-router-dom';
import { useUIStore } from '@/stores/uiStore';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar />
      <div className={`transition-all duration-200 ${collapsed ? 'ml-[60px]' : 'ml-[220px]'}`}>
        <Header />
        <main className="p-6 max-w-[960px] mx-auto page-enter">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
