import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Ticket, CheckCircle, Clock, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ReservationWithDetails {
  id: string;
  order_number: number;
  status: string;
  low_confidence: boolean;
  created_at: string;
  profiles: {
    name: string;
    phone: string;
  };
  cars: {
    title: string;
  };
}

export function AllReservations() {
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReservations = async () => {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          order_number,
          status,
          low_confidence,
          created_at,
          profiles:passenger_id (name, phone),
          cars:car_id (title)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setReservations((data as any[]) || []);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();

    const channel = supabase
      .channel('admin-reservations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
        },
        () => {
          fetchReservations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle className="h-3 w-3 ml-1" />
            مؤكد
          </Badge>
        );
      case 'temporary':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
            <Clock className="h-3 w-3 ml-1" />
            مؤقت
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 ml-1" />
            مرفوض
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="outline">
            ملغي
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
            مكتمل
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
        <CardTitle>جميع الحجوزات</CardTitle>
        <CardDescription>آخر 100 حجز</CardDescription>
      </CardHeader>
      <CardContent>
        {reservations.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p>لا توجد حجوزات</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reservations.map((reservation) => (
              <div
                key={reservation.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {reservation.order_number}
                  </span>
                  <div>
                    <p className="font-medium">{reservation.profiles?.name || 'غير معروف'}</p>
                    <p className="text-sm text-muted-foreground">
                      {reservation.cars?.title} • {formatDistanceToNow(new Date(reservation.created_at), { locale: ar, addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {reservation.low_confidence && reservation.status === 'temporary' && (
                    <Badge variant="outline" className="text-yellow-600">
                      ثقة منخفضة
                    </Badge>
                  )}
                  {getStatusBadge(reservation.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
