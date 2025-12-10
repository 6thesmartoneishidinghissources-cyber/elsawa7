import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Payment } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Image, Eye } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PaymentWithDetails {
  id: string;
  reservation_id: string;
  image_url: string;
  ai_confidence: number | null;
  ocr_text: string | null;
  admin_confirmed: boolean | null;
  created_at: string;
  reservations: {
    id: string;
    order_number: number;
    car_id: string;
    passenger_id: string;
    profiles: {
      name: string;
      phone: string;
    };
    cars: {
      title: string;
    };
  };
}

export function PendingPayments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          reservations!inner (
            id,
            order_number,
            car_id,
            passenger_id,
            profiles:passenger_id (name, phone),
            cars:car_id (title)
          )
        `)
        .is('admin_confirmed', null)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPayments((data as any[]) || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();

    // Subscribe to changes
    const channel = supabase
      .channel('admin-payments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
        },
        () => {
          fetchPayments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleConfirm = async (payment: PaymentWithDetails) => {
    if (!user) return;
    setProcessing(payment.id);

    try {
      // Update payment
      const { error: paymentError } = await supabase
        .from('payments')
        .update({
          admin_confirmed: true,
          admin_id: user.id,
        })
        .eq('id', payment.id);

      if (paymentError) throw paymentError;

      // Update reservation status
      const { error: reservationError } = await supabase
        .from('reservations')
        .update({ status: 'confirmed' })
        .eq('id', payment.reservation_id);

      if (reservationError) throw reservationError;

      // Log action
      await supabase.from('audit_logs').insert({
        actor_id: user.id,
        action: 'confirm_payment',
        payload: { payment_id: payment.id, reservation_id: payment.reservation_id },
      });

      toast({
        title: 'تم التأكيد',
        description: 'تم تأكيد الحجز بنجاح',
      });

      fetchPayments();
    } catch (error) {
      console.error('Error confirming payment:', error);
      toast({
        title: 'خطأ',
        description: 'حصل خطأ، حاول تاني',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (payment: PaymentWithDetails) => {
    if (!user) return;
    setProcessing(payment.id);

    try {
      // Update payment
      const { error: paymentError } = await supabase
        .from('payments')
        .update({
          admin_confirmed: false,
          admin_id: user.id,
          admin_note: 'صورة حوالة أو بيانات غلط',
        })
        .eq('id', payment.id);

      if (paymentError) throw paymentError;

      // Update reservation status
      const { error: reservationError } = await supabase
        .from('reservations')
        .update({ status: 'rejected' })
        .eq('id', payment.reservation_id);

      if (reservationError) throw reservationError;

      // Log action
      await supabase.from('audit_logs').insert({
        actor_id: user.id,
        action: 'reject_payment',
        payload: { payment_id: payment.id, reservation_id: payment.reservation_id },
      });

      toast({
        title: 'تم الرفض',
        description: 'تم رفض الحجز',
      });

      fetchPayments();
    } catch (error) {
      console.error('Error rejecting payment:', error);
      toast({
        title: 'خطأ',
        description: 'حصل خطأ، حاول تاني',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
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
    <>
      <Card>
        <CardHeader>
          <CardTitle>الحوالات المعلقة</CardTitle>
          <CardDescription>
            راجع صور الحوالات وأكّد أو ارفض الحجوزات
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500/50" />
              <p>لا توجد حوالات معلقة</p>
            </div>
          ) : (
            <div className="space-y-4">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-col sm:flex-row gap-4 p-4 rounded-lg border bg-card"
                >
                  {/* Image Thumbnail */}
                  <button
                    onClick={() => setSelectedImage(payment.image_url)}
                    className="relative h-32 w-32 flex-shrink-0 rounded-lg overflow-hidden bg-muted group"
                  >
                    <img
                      src={payment.image_url}
                      alt="Payment screenshot"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Eye className="h-6 w-6" />
                    </div>
                  </button>

                  {/* Details */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">
                        رقم الطلب: {payment.reservations.order_number}
                      </Badge>
                      <Badge variant="outline">
                        {payment.reservations.cars.title}
                      </Badge>
                      {payment.ai_confidence !== null && (
                        <Badge
                          variant={payment.ai_confidence >= 0.75 ? 'default' : 'secondary'}
                          className={payment.ai_confidence >= 0.75 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                          }
                        >
                          {payment.ai_confidence >= 0.75 ? (
                            <CheckCircle className="h-3 w-3 ml-1" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 ml-1" />
                          )}
                          ثقة: {Math.round((payment.ai_confidence || 0) * 100)}%
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm">
                      <span className="text-muted-foreground">الراكب: </span>
                      <span className="font-medium">{payment.reservations.profiles.name}</span>
                      <span className="text-muted-foreground mr-2">({payment.reservations.profiles.phone})</span>
                    </p>

                    {payment.ocr_text && (
                      <p className="text-xs text-muted-foreground bg-muted p-2 rounded max-h-20 overflow-y-auto">
                        OCR: {payment.ocr_text.slice(0, 200)}...
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex sm:flex-col gap-2 justify-end">
                    <Button
                      size="lg"
                      onClick={() => handleConfirm(payment)}
                      disabled={processing === payment.id}
                      className="flex-1 sm:flex-none"
                    >
                      {processing === payment.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 ml-2" />
                          أدِّي تأكيد
                        </>
                      )}
                    </Button>
                    <Button
                      size="lg"
                      variant="destructive"
                      onClick={() => handleReject(payment)}
                      disabled={processing === payment.id}
                      className="flex-1 sm:flex-none"
                    >
                      <XCircle className="h-4 w-4 ml-2" />
                      ارفض الحجز
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>صورة الحوالة</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Payment screenshot"
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
