import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Car, Users, Shield, ArrowLeft } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10" />
        <div className="relative container py-24 text-center">
          <div className="flex items-center justify-center gap-4 mb-6">
            <Car className="h-16 w-16 text-primary" />
            <h1 className="text-5xl font-bold text-foreground">ElSawa7</h1>
          </div>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            نظام حجز النقل الطلابي — احجز مقعدك بسهولة وأمان
          </p>
          <Button size="lg" onClick={() => navigate('/auth')} className="text-lg px-8">
            ابدأ الآن
            <ArrowLeft className="h-5 w-5 mr-2" />
          </Button>
        </div>
      </div>

      {/* Features */}
      <div className="container py-16">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="text-center p-6 rounded-xl bg-card border">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">للركاب</h3>
            <p className="text-muted-foreground">
              احجز مقعدك بسهولة وتابع حالة حجزك في الوقت الفعلي
            </p>
          </div>
          <div className="text-center p-6 rounded-xl bg-card border">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Car className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">للسوّاقين</h3>
            <p className="text-muted-foreground">
              أدِر رحلاتك وتواصل مع الركاب بكل سهولة
            </p>
          </div>
          <div className="text-center p-6 rounded-xl bg-card border">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">للإدارة</h3>
            <p className="text-muted-foreground">
              راجع الحوالات وأكّد الحجوزات بضغطة واحدة
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
