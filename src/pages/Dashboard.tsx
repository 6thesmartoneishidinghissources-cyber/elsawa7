import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { PassengerDashboard } from '@/components/passenger/PassengerDashboard';
import { DriverDashboard } from '@/components/driver/DriverDashboard';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { OwnerDashboard } from '@/components/owner/OwnerDashboard';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function Dashboard() {
  const { profile, user, loading } = useAuth();
  const [effectiveRole, setEffectiveRole] = useState<string | null>(null);

  // Check user_roles table for owner/admin status
  useEffect(() => {
    const checkRoles = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      if (data && data.length > 0) {
        // Prioritize owner > admin > driver > passenger
        if (data.some(r => r.role === 'owner')) {
          setEffectiveRole('owner');
        } else if (data.some(r => r.role === 'admin')) {
          setEffectiveRole('admin');
        } else if (data.some(r => r.role === 'driver')) {
          setEffectiveRole('driver');
        } else {
          setEffectiveRole('passenger');
        }
      } else {
        setEffectiveRole(profile?.role || 'passenger');
      }
    };
    
    checkRoles();
  }, [user, profile]);

  if (loading || !effectiveRole) {
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
    switch (effectiveRole) {
      case 'owner':
        return <OwnerDashboard />;
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
