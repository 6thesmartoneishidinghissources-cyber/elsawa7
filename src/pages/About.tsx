import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export function About() {
  return (
    <div className="min-h-screen bg-background py-12 px-4" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-primary">
              ElSawa7
            </CardTitle>
            <p className="text-muted-foreground mt-2">السوّاح - نظام حجز المقاعد</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">عن البرنامج</h2>
              <p className="text-muted-foreground leading-relaxed">
                السوّاح هو نظام حجز مقاعد ذكي مصمم لتسهيل عملية حجز الرحلات 
                للطلاب والركاب. يتيح النظام للركاب حجز مقاعدهم بسهولة عن طريق 
                رفع صورة إيصال الدفع من فودافون كاش، ويتم التحقق من الصور 
                تلقائياً باستخدام الذكاء الاصطناعي.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">مميزات النظام</h2>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  حجز سريع وآمن للمقاعد
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  التحقق التلقائي من إيصالات الدفع بالذكاء الاصطناعي
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  متابعة حالة الحجز في الوقت الفعلي
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  نظام طابور عادل ومنظم
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  لوحة تحكم للسائقين والإدارة
                </li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">كيفية الاستخدام</h2>
              <div className="space-y-4 text-muted-foreground">
                <div>
                  <h3 className="font-medium text-foreground">للركاب:</h3>
                  <ol className="list-decimal list-inside space-y-1 mr-4 mt-2">
                    <li>سجل حساب جديد كراكب</li>
                    <li>اختر السيارة المتاحة</li>
                    <li>ادفع عبر فودافون كاش</li>
                    <li>ارفع صورة الإيصال</li>
                    <li>انتظر تأكيد الحجز</li>
                  </ol>
                </div>
                <div>
                  <h3 className="font-medium text-foreground">للسائقين:</h3>
                  <ol className="list-decimal list-inside space-y-1 mr-4 mt-2">
                    <li>سجل حساب جديد كسائق</li>
                    <li>انتظر موافقة الإدارة</li>
                    <li>تابع قائمة الركاب</li>
                    <li>علّم وصول الركاب</li>
                  </ol>
                </div>
              </div>
            </section>

            <Separator />

            <section className="text-center pt-4">
              <p className="text-lg font-semibold text-primary">
                صُنع بواسطة: م/ أحمد طارق
              </p>
              <p className="text-muted-foreground mt-1">
                I do publishing
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default About;
