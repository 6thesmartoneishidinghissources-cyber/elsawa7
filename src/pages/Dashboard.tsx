import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { PassengerDashboard } from '@/components/passenger/PassengerDashboard';
import { DriverDashboard } from '@/components/driver/DriverDashboard';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/auth" replace />;
  }

  const renderDashboard = () => {
    switch (profile.role) {
      case 'admin':
        return <AdminDashboard />;
      case 'driver':
        return <DriverDashboard />;
      case 'passenger':
      default:
        return <PassengerDashboard />;
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <Header />
      <main className="container py-6">
        {renderDashboard()}
      </main>
    </div>
  );
}
