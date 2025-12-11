import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Driver, Car } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DriverQueue } from './DriverQueue';
import { Loader2, Car as CarIcon, AlertTriangle, CheckCircle, Clock, Star } from 'lucide-react';

export function DriverDashboard() {
  const { user } = useAuth();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDriverData = async () => {
      if (!user) return;

      try {
        // Fetch driver info
        const { data: driverData, error: driverError } = await supabase
          .from('drivers')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (driverError) throw driverError;
        setDriver(driverData as Driver | null);

        // Fetch assigned cars
        const { data: carsData, error: carsError } = await supabase
          .from('cars')
          .select('*')
          .eq('driver_id', user.id);

        if (carsError) throw carsError;
        setCars(carsData as Car[]);
      } catch (error) {
        console.error('Error fetching driver data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDriverData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getStatusBadge = () => {
    switch (driver?.status) {
      case 'approved':
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle className="h-3 w-3 ml-1" />
            حسابك مفعّل
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
            <Clock className="h-3 w-3 ml-1" />
            في انتظار الموافقة
          </Badge>
        );
      case 'blocked':
        return (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 ml-1" />
            الحساب موقوف
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Driver Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CarIcon className="h-5 w-5 text-primary" />
              حسابك كسوّاق
            </div>
            {getStatusBadge()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {driver?.status === 'pending' && (
            <div className="p-4 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5" />
                <span className="font-semibold">شكراً! طلب تسجيلك اتبعت للسواّح</span>
              </div>
              <p className="text-sm">في انتظار تأكيد دخولك. هنبعتلك رسالة أول ما يتأكد.</p>
            </div>
          )}

          {driver?.status === 'approved' && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-muted/50 p-4 text-center">
                <Star className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">
                  {driver.avg_rating?.toFixed(1) || '0.0'}
                </p>
                <p className="text-sm text-muted-foreground">التقييم</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4 text-center">
                <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">
                  {driver.completed_trips || 0}
                </p>
                <p className="text-sm text-muted-foreground">رحلة مكتملة</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4 text-center">
                <CarIcon className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">
                  {cars.length}
                </p>
                <p className="text-sm text-muted-foreground">سيارة</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cars and Queues */}
      {driver?.status === 'approved' && cars.length > 0 && (
        <div className="space-y-6">
          {cars.map((car) => (
            <div key={car.id} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CarIcon className="h-5 w-5 text-primary" />
                    {car.title}
                  </CardTitle>
                  <CardDescription>
                    السعة: {car.capacity} راكب • المسار: {car.route || 'غير محدد'}
                  </CardDescription>
                </CardHeader>
              </Card>
              <DriverQueue carId={car.id} />
            </div>
          ))}
        </div>
      )}

      {driver?.status === 'approved' && cars.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <CarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p>لم يتم تعيين سيارة لك بعد</p>
            <p className="text-sm">تواصل مع الإدارة لتعيين سيارة</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}