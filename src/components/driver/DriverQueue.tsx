import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Phone, UserCheck, UserX, RefreshCw } from 'lucide-react';

interface QueueItem {
  reservation_id: string;
  order_number: number;
  passenger_phone: string;
  status: string;
  arrived: boolean;
  arrival_time: string | null;
}

interface DriverQueueProps {
  carId: string;
}

export function DriverQueue({ carId }: DriverQueueProps) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('driver_queue_for_car', {
        p_car_id: carId
      });

      if (error) throw error;
      setQueue((data as QueueItem[]) || []);
    } catch (error) {
      console.error('Error fetching driver queue:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في تحميل قائمة الركاب',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();

    // Set up real-time subscription
    const channel = supabase
      .channel(`driver-queue-${carId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `car_id=eq.${carId}`,
        },
        () => {
          fetchQueue();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'arrivals',
        },
        () => {
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [carId]);

  const handleMarkArrival = async (reservationId: string, arrived: boolean) => {
    try {
      const { error } = await supabase.rpc('mark_passenger_arrival', {
        p_reservation_id: reservationId,
        p_arrived: arrived
      });

      if (error) throw error;

      toast({
        title: arrived ? 'تم تسجيل الوصول' : 'تم تسجيل الغياب',
        description: arrived ? 'علم راكب وصل بنجاح' : 'علم غياب بنجاح',
      });
      
      fetchQueue();
    } catch (error) {
      console.error('Error marking arrival:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في تحديث حالة الراكب',
        variant: 'destructive',
      });
    }
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card dir="rtl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>قائمة الركاب (رقم الطلب + رقم التليفون)</CardTitle>
          <Button variant="ghost" size="icon" onClick={fetchQueue}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {queue.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            لا يوجد ركاب في الطابور
          </p>
        ) : (
          <div className="space-y-3">
            {queue.map((item) => (
              <div
                key={item.reservation_id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  item.arrived ? 'bg-green-50 border-green-200' : 'bg-background'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold">
                    {item.order_number}
                  </div>
                  <div>
                    <p className="font-medium font-mono">{item.passenger_phone || 'غير متاح'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={item.status === 'confirmed' ? 'default' : 'secondary'}>
                        {item.status === 'confirmed' ? 'مؤكد' : 'مؤقت'}
                      </Badge>
                      {item.arrived && (
                        <Badge className="bg-green-500">وصل</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {item.passenger_phone && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCall(item.passenger_phone)}
                    >
                      <Phone className="h-4 w-4 ml-1" />
                      اتصل
                    </Button>
                  )}
                  {!item.arrived ? (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleMarkArrival(item.reservation_id, true)}
                    >
                      <UserCheck className="h-4 w-4 ml-1" />
                      علم راكب وصل
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleMarkArrival(item.reservation_id, false)}
                    >
                      <UserX className="h-4 w-4 ml-1" />
                      علم غياب
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
