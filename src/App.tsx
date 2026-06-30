import { Routes, Route } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { AuthProvider } from '@/lib/auth';
import RequireAuth from '@/lib/requireAuth';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Goals from '@/pages/Goals';
import Analytics from '@/pages/Analytics';
import Journal from '@/pages/Journal';
import Search from '@/pages/Search';
import Settings from '@/pages/Settings';
import Clips from '@/pages/Clips';
import Tasks from '@/pages/Tasks';
import Login from '@/pages/Login';

export default function App() {
  useTheme();

  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes */}
        <Route element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }>
          <Route path="/" element={<Dashboard />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/search" element={<Search />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/clips" element={<Clips />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
