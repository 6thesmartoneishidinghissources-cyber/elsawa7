import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Car, VerificationResult } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2, CheckCircle, AlertTriangle, Image } from 'lucide-react';

interface BookingModalProps {
  car: Car;
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function BookingModal({ car, open, onClose, onComplete }: BookingModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setVerificationResult(null);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  const handleSubmit = async () => {
    if (!selectedFile || !user) return;

    setVerifying(true);

    try {
      // Convert file to base64 for AI verification
      const base64 = await fileToBase64(selectedFile);

      // Call AI verification
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-payment', {
        body: { imageBase64: base64 },
      });

      if (verifyError) {
        console.error('Verification error:', verifyError);
        throw new Error('فشل في التحقق من الصورة');
      }

      setVerificationResult(verifyData);
      const isHighConfidence = verifyData.confidence >= 0.75;

      setVerifying(false);
      setUploading(true);

      // Upload image to storage
      const fileName = `${user.id}/${Date.now()}_${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('payment-images')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Get image URL
      const { data: urlData } = supabase.storage
        .from('payment-images')
        .getPublicUrl(fileName);

      // Get next order number
      const { data: orderData } = await supabase.rpc('get_next_order_number', { car_uuid: car.id });
      const orderNumber = orderData || 1;

      // Create reservation
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 20); // 20 minute timeout

      const { data: reservation, error: reservationError } = await supabase
        .from('reservations')
        .insert({
          passenger_id: user.id,
          car_id: car.id,
          order_number: orderNumber,
          status: 'temporary',
          low_confidence: !isHighConfidence,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (reservationError) {
        if (reservationError.message.includes('row-level security')) {
          throw new Error('عندك حجز شغّال بالفعل');
        }
        throw reservationError;
      }

      // Create payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          reservation_id: reservation.id,
          image_url: urlData.publicUrl,
          ai_confidence: verifyData.confidence,
          ocr_text: verifyData.ocr_text,
          extracted_fields: verifyData.extracted_fields,
        });

      if (paymentError) throw paymentError;

      toast({
        title: 'تم عمل حجز مؤقت',
        description: isHighConfidence 
          ? 'مستني موافقة السوّاح'
          : 'صورة الحوالة تحتاج مراجعة — مستني موافقة السوّاح',
      });

      onComplete();
    } catch (error: any) {
      console.error('Booking error:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حصل خطأ، حاول تاني',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>حجز مقعد في {car.title}</DialogTitle>
          <DialogDescription>
            حط صورة حوالة فودافون كاش لإتمام الحجز
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!previewUrl ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-48 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-3 hover:border-primary/50 transition-colors"
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <span className="text-muted-foreground">اضغط لاختيار صورة</span>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Payment screenshot"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    setVerificationResult(null);
                  }}
                  className="absolute top-2 left-2 p-1 rounded-full bg-background/80 hover:bg-background"
                >
                  <Image className="h-4 w-4" />
                </button>
              </div>

              {verificationResult && (
                <div className={`p-3 rounded-lg flex items-center gap-2 ${
                  verificationResult.confidence >= 0.75
                    ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                }`}>
                  {verificationResult.confidence >= 0.75 ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm">تم التحقق من صورة فودافون كاش</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm">الصورة تحتاج مراجعة من الإدارة</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              إلغاء
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedFile || uploading || verifying}
              className="flex-1"
            >
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  جاري التحقق...
                </>
              ) : uploading ? (
                <>
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  جاري الحجز...
                </>
              ) : (
                'تأكيد الحجز'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
