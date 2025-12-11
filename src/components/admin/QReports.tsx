import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle, UserX, Filter } from 'lucide-react';

interface Anomaly {
  id: string;
  user_id_hashed: string;
  user_id: string | null;
  type: string;
  score: number;
  details: Record<string, unknown>;
  reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const anomalyTypeLabels: Record<string, string> = {
  multiple_reservations_24h: 'حجوزات متعددة (24 ساعة)',
  multiple_low_confidence: 'صور منخفضة الثقة',
  multiple_paid_unallocated: 'مدفوعات غير مخصصة',
  same_ip_multiple_accounts: 'حسابات متعددة - نفس IP',
};

export function QReports() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const { toast } = useToast();

  const fetchAnomalies = async () => {
    try {
      let query = supabase
        .from('anomalies')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        if (filter === 'unreviewed') {
          query = query.eq('reviewed', false);
        } else {
          query = query.eq('type', filter);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setAnomalies((data as Anomaly[]) || []);
    } catch (error) {
      console.error('Error fetching anomalies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, [filter]);

  const handleMarkReviewed = async (anomalyId: string) => {
    try {
      const { error } = await supabase
        .from('anomalies')
        .update({ 
          reviewed: true, 
          reviewed_at: new Date().toISOString() 
        })
        .eq('id', anomalyId);

      if (error) throw error;

      toast({
        title: 'تم التحديث',
        description: 'تم تعليم البلاغ كمراجع',
      });
      fetchAnomalies();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل في تحديث البلاغ',
        variant: 'destructive',
      });
    }
  };

  const handleSuspendUser = async (userId: string | null) => {
    if (!userId) {
      toast({
        title: 'خطأ',
        description: 'لا يوجد معرف مستخدم',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('admin-set-role', {
        body: { target_user_id: userId, new_role: 'passenger' }
      });

      if (error) throw error;

      toast({
        title: 'تم الإيقاف',
        description: 'تم إيقاف المستخدم',
      });
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل في إيقاف المستخدم',
        variant: 'destructive',
      });
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 15) return <Badge variant="destructive">خطر عالي ({score})</Badge>;
    if (score >= 10) return <Badge className="bg-orange-500">متوسط ({score})</Badge>;
    return <Badge variant="secondary">منخفض ({score})</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">تقارير الطابور (Q Reports)</h2>
        <div className="flex items-center gap-4">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="فلترة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="unreviewed">غير مراجع</SelectItem>
              <SelectItem value="multiple_reservations_24h">حجوزات متعددة</SelectItem>
              <SelectItem value="multiple_low_confidence">صور منخفضة الثقة</SelectItem>
              <SelectItem value="multiple_paid_unallocated">مدفوعات غير مخصصة</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {anomalies.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center text-muted-foreground">
              <CheckCircle className="mx-auto h-12 w-12 mb-4 text-green-500" />
              <p>لا توجد بلاغات</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {anomalies.map((anomaly) => (
            <Card key={anomaly.id} className={anomaly.reviewed ? 'opacity-60' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    <CardTitle className="text-lg">
                      {anomalyTypeLabels[anomaly.type] || anomaly.type}
                    </CardTitle>
                  </div>
                  {getScoreBadge(anomaly.score)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">معرف المستخدم (مشفر):</span>
                      <p className="font-mono text-xs truncate">{anomaly.user_id_hashed.slice(0, 16)}...</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">التاريخ:</span>
                      <p>{new Date(anomaly.created_at).toLocaleString('ar-EG')}</p>
                    </div>
                  </div>
                  
                  {anomaly.details && (
                    <div className="bg-muted p-3 rounded-md">
                      <span className="text-muted-foreground text-sm">التفاصيل:</span>
                      <pre className="text-xs mt-1 overflow-x-auto">
                        {JSON.stringify(anomaly.details, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {!anomaly.reviewed && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleMarkReviewed(anomaly.id)}
                      >
                        <CheckCircle className="h-4 w-4 ml-2" />
                        تعليم كمراجع
                      </Button>
                    )}
                    {anomaly.user_id && !anomaly.reviewed && (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleSuspendUser(anomaly.user_id)}
                      >
                        <UserX className="h-4 w-4 ml-2" />
                        إيقاف المستخدم
                      </Button>
                    )}
                    {anomaly.reviewed && (
                      <Badge variant="outline" className="text-green-600">
                        تمت المراجعة
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
