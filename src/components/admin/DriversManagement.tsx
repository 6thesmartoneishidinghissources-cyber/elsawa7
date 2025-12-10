import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Driver, Profile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Clock, User } from 'lucide-react';

interface DriverWithProfile extends Driver {
  profiles: Profile;
}

export function DriversManagement() {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<DriverWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select(`
          *,
          profiles:id (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDrivers((data as any[]) || []);
    } catch (error) {
      console.error('Error fetching drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const updateDriverStatus = async (driverId: string, status: 'approved' | 'blocked') => {
    setProcessing(driverId);

    try {
      const { error } = await supabase
        .from('drivers')
        .update({ status })
        .eq('id', driverId);

      if (error) throw error;

      toast({
        title: status === 'approved' ? 'تم التفعيل' : 'تم الإيقاف',
        description: status === 'approved' ? 'تم تفعيل حساب السائق' : 'تم إيقاف حساب السائق',
      });

      fetchDrivers();
    } catch (error) {
      console.error('Error updating driver:', error);
      toast({
        title: 'خطأ',
        description: 'حصل خطأ، حاول تاني',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle className="h-3 w-3 ml-1" />
            مفعّل
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
            <Clock className="h-3 w-3 ml-1" />
            معلق
          </Badge>
        );
      case 'blocked':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 ml-1" />
            موقوف
          </Badge>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>إدارة السوّاقين</CardTitle>
        <CardDescription>
          راجع وفعّل حسابات السوّاقين
        </CardDescription>
      </CardHeader>
      <CardContent>
        {drivers.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p>لا يوجد سوّاقين مسجلين</p>
          </div>
        ) : (
          <div className="space-y-4">
            {drivers.map((driver) => (
              <div
                key={driver.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{driver.profiles?.name || 'غير معروف'}</p>
                    <p className="text-sm text-muted-foreground" dir="ltr">
                      {driver.profiles?.phone}
                    </p>
                    {driver.vehicle_plate && (
                      <p className="text-xs text-muted-foreground">
                        لوحة السيارة: {driver.vehicle_plate}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getStatusBadge(driver.status)}
                  
                  {driver.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => updateDriverStatus(driver.id, 'approved')}
                      disabled={processing === driver.id}
                    >
                      {processing === driver.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'تفعيل'
                      )}
                    </Button>
                  )}

                  {driver.status === 'approved' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => updateDriverStatus(driver.id, 'blocked')}
                      disabled={processing === driver.id}
                    >
                      {processing === driver.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'إيقاف'
                      )}
                    </Button>
                  )}

                  {driver.status === 'blocked' && (
                    <Button
                      size="sm"
                      onClick={() => updateDriverStatus(driver.id, 'approved')}
                      disabled={processing === driver.id}
                    >
                      {processing === driver.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'إعادة تفعيل'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
