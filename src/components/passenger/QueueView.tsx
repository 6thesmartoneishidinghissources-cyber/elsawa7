import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Phone, User } from 'lucide-react';

interface QueueItem {
  order_number: number;
  name?: string;
  phone?: string;
  status: string;
}

interface QueueViewProps {
  carId: string;
  role: 'passenger' | 'driver';
}

export function QueueView({ carId, role }: QueueViewProps) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          order_number,
          status,
          profiles:passenger_id (name, phone)
        `)
        .eq('car_id', carId)
        .in('status', ['temporary', 'confirmed'])
        .order('order_number', { ascending: true });

      if (error) throw error;

      const queueItems: QueueItem[] = (data || []).map((item: any) => ({
        order_number: item.order_number,
        name: role === 'passenger' ? item.profiles?.name : undefined,
        phone: role === 'driver' ? item.profiles?.phone : undefined,
        status: item.status,
      }));

      setQueue(queueItems);
    } catch (error) {
      console.error('Error fetching queue:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();

    // Subscribe to changes
    const channel = supabase
      .channel(`queue-${carId}`)
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [carId, role]);

  const title = role === 'passenger' ? 'قائمة الحجوزات (أسماء + رقم الطلب)' : 'قائمة الركاب (رقم الطلب + رقم التليفون)';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-4 text-center text-muted-foreground">جاري التحميل...</div>
        ) : queue.length === 0 ? (
          <div className="py-4 text-center text-muted-foreground">لا توجد حجوزات</div>
        ) : (
          <div className="space-y-2">
            {queue.map((item) => (
              <div
                key={item.order_number}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {item.order_number}
                  </span>
                  {role === 'passenger' && item.name && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{item.name}</span>
                    </div>
                  )}
                  {role === 'driver' && item.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium" dir="ltr">{item.phone}</span>
                    </div>
                  )}
                </div>
                <Badge variant={item.status === 'confirmed' ? 'default' : 'secondary'}>
                  {item.status === 'confirmed' ? 'مؤكد' : 'مؤقت'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
