import { Reservation } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Ticket, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface MyReservationProps {
  reservation: Reservation;
  onCancel: () => void;
}

export function MyReservation({ reservation, onCancel }: MyReservationProps) {
  const getStatusBadge = () => {
    switch (reservation.status) {
      case 'confirmed':
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle className="h-3 w-3 ml-1" />
            الحجز اتأكد
          </Badge>
        );
      case 'temporary':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
            <Clock className="h-3 w-3 ml-1" />
            مستني موافقة السوّاح
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 ml-1" />
            الحجز مرفوض
          </Badge>
        );
      default:
        return null;
    }
  };

  const expiresIn = reservation.expires_at 
    ? formatDistanceToNow(new Date(reservation.expires_at), { locale: ar, addSuffix: true })
    : null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" />
            حجزك الحالي
          </div>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-card p-4 border">
            <p className="text-sm text-muted-foreground">السيارة</p>
            <p className="font-semibold text-foreground">
              {(reservation.cars as any)?.title || 'غير معروف'}
            </p>
          </div>
          <div className="rounded-lg bg-card p-4 border">
            <p className="text-sm text-muted-foreground">رقم الطلب</p>
            <p className="text-2xl font-bold text-primary">#{reservation.order_number}</p>
          </div>
        </div>

        {reservation.status === 'temporary' && reservation.low_confidence && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">صورة الحوالة تحتاج مراجعة من الإدارة</span>
          </div>
        )}

        {reservation.status === 'temporary' && expiresIn && (
          <p className="text-sm text-muted-foreground">
            ينتهي الحجز المؤقت {expiresIn}
          </p>
        )}

        {reservation.status === 'confirmed' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">الحجز اتأكد! رقم الطلب: {reservation.order_number}</span>
          </div>
        )}

        {reservation.status === 'temporary' && (
          <Button variant="outline" onClick={onCancel} className="w-full">
            إلغاء الحجز
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
