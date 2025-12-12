import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { UserRole } from '@/lib/types';
import { Car, Users, Loader2 } from 'lucide-react';
import { z } from 'zod';

const signUpSchema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يكون أكثر من حرفين').max(100),
  phone: z.string().min(10, 'رقم التليفون غير صحيح').max(20),
  email: z.string().email('البريد الإلكتروني غير صحيح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
});

const signInSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صحيح'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

type RegistrationStep = 'form' | 'verification';

export default function Auth() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('passenger');
  const [registrationStep, setRegistrationStep] = useState<RegistrationStep>('form');
  const [tempId, setTempId] = useState<string | null>(null);
  const [verificationCodes, setVerificationCodes] = useState({ email: '', sms: '' });
  
  // Sign up form
  const [signUpForm, setSignUpForm] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
  });

  // Sign in form
  const [signInForm, setSignInForm] = useState({
    email: '',
    password: '',
  });

  const handleStartRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = signUpSchema.safeParse(signUpForm);
      if (!validation.success) {
        toast({
          title: 'خطأ في البيانات',
          description: validation.error.errors[0].message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Call start-register Edge Function
      const { data, error } = await supabase.functions.invoke('start-register', {
        body: {
          email: signUpForm.email,
          phone: signUpForm.phone,
          name: signUpForm.name,
          requested_role: selectedRole,
          source: 'web',
        },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: 'خطأ',
          description: data.error,
          variant: 'destructive',
        });
        return;
      }

      setTempId(data.temp_id);
      setRegistrationStep('verification');
      
      // For development, auto-fill codes if provided
      if (data._dev_codes) {
        setVerificationCodes({
          email: data._dev_codes.email,
          sms: data._dev_codes.sms,
        });
      }

      toast({
        title: 'تم إرسال رمز التحقق',
        description: data.message,
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حصل خطأ، حاول تاني',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('complete-register', {
        body: {
          temp_id: tempId,
          email_code: verificationCodes.email,
          sms_code: verificationCodes.sms,
          password: signUpForm.password,
        },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: 'خطأ',
          description: data.error,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'تم التسجيل بنجاح!',
        description: selectedRole === 'driver' 
          ? 'طلب تسجيلك اتبعت للسواّح — في انتظار تأكيد دخولك. هنبعتلك رسالة أول ما يتأكد.'
          : 'مرحباً بك في السواّح!',
      });

      // Sign in the user
      await signIn(signUpForm.email, signUpForm.password);
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Verification error:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حصل خطأ، حاول تاني',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = signInSchema.safeParse(signInForm);
      if (!validation.success) {
        toast({
          title: 'خطأ في البيانات',
          description: validation.error.errors[0].message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const { error } = await signIn(signInForm.email, signInForm.password);

      if (error) {
        toast({
          title: 'خطأ',
          description: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
          variant: 'destructive',
        });
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'حصل خطأ، حاول تاني',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple' | 'azure') => {
    setSocialLoading(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Social login error:', error);
      toast({
        title: 'خطأ',
        description: 'حصل خطأ في تسجيل الدخول',
        variant: 'destructive',
      });
    } finally {
      setSocialLoading(null);
    }
  };

  // SECURITY: Only passenger and driver roles available for signup
  const roleOptions = [
    { value: 'passenger' as UserRole, label: 'أنا راكب', icon: Users, description: 'احجز مقعد في رحلة' },
    { value: 'driver' as UserRole, label: 'أنا سوّاق', icon: Car, description: 'سجّل كسائق' },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Car className="h-12 w-12 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">ElSawa7</h1>
          </div>
          <p className="text-muted-foreground">نظام حجز النقل الطلابي</p>
        </div>

        <Card>
          <Tabs defaultValue="signin" className="w-full">
            <CardHeader>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">تسجيل الدخول</TabsTrigger>
                <TabsTrigger value="signup">حساب جديد</TabsTrigger>
              </TabsList>
            </CardHeader>
            
            <CardContent>
              <TabsContent value="signin" className="mt-0 space-y-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">البريد الإلكتروني</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      value={signInForm.email}
                      onChange={(e) => setSignInForm({ ...signInForm, email: e.target.value })}
                      placeholder="example@email.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">كلمة المرور</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={signInForm.password}
                      onChange={(e) => setSignInForm({ ...signInForm, password: e.target.value })}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                    {loading ? 'جاري التحميل...' : 'دخول'}
                  </Button>
                </form>

                {/* Social Login */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">أو سجل بـ</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => handleSocialLogin('google')}
                    disabled={!!socialLoading}
                  >
                    {socialLoading === 'google' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Google'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleSocialLogin('apple')}
                    disabled={!!socialLoading}
                  >
                    {socialLoading === 'apple' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apple'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleSocialLogin('azure')}
                    disabled={!!socialLoading}
                  >
                    {socialLoading === 'azure' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Microsoft'}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                {registrationStep === 'form' ? (
                  <form onSubmit={handleStartRegistration} className="space-y-4">
                    <div className="space-y-3">
                      <Label>اختر نوع الحساب</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {roleOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setSelectedRole(option.value)}
                            className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                              selectedRole === option.value
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <option.icon className={`h-6 w-6 mb-1 ${
                              selectedRole === option.value ? 'text-primary' : 'text-muted-foreground'
                            }`} />
                            <span className={`text-xs font-medium ${
                              selectedRole === option.value ? 'text-primary' : 'text-foreground'
                            }`}>
                              {option.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-name">الاسم</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        value={signUpForm.name}
                        onChange={(e) => setSignUpForm({ ...signUpForm, name: e.target.value })}
                        placeholder="اسمك الكامل"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-phone">رقم التليفون</Label>
                      <Input
                        id="signup-phone"
                        type="tel"
                        value={signUpForm.phone}
                        onChange={(e) => setSignUpForm({ ...signUpForm, phone: e.target.value })}
                        placeholder="01XXXXXXXXX"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">البريد الإلكتروني</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        value={signUpForm.email}
                        onChange={(e) => setSignUpForm({ ...signUpForm, email: e.target.value })}
                        placeholder="example@email.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">كلمة المرور</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        value={signUpForm.password}
                        onChange={(e) => setSignUpForm({ ...signUpForm, password: e.target.value })}
                        placeholder="6 أحرف على الأقل"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                      {loading ? 'جاري التسجيل...' : 'متابعة'}
                    </Button>

                    {/* Social Login for Signup */}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">أو سجل بـ</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button 
                        type="button"
                        variant="outline" 
                        className="w-full"
                        onClick={() => handleSocialLogin('google')}
                        disabled={!!socialLoading}
                      >
                        {socialLoading === 'google' ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                        سجل بحساب جوجل
                      </Button>
                      <Button 
                        type="button"
                        variant="outline" 
                        className="w-full"
                        onClick={() => handleSocialLogin('apple')}
                        disabled={!!socialLoading}
                      >
                        {socialLoading === 'apple' ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                        سجل بحساب أبل
                      </Button>
                      <Button 
                        type="button"
                        variant="outline" 
                        className="w-full"
                        onClick={() => handleSocialLogin('azure')}
                        disabled={!!socialLoading}
                      >
                        {socialLoading === 'azure' ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                        سجل بحساب مايكروسوفت
                      </Button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleCompleteRegistration} className="space-y-4">
                    <div className="bg-muted/50 rounded-lg p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-2">
                        بعتنا رمز تحقق على الإيميل / الموبايل
                      </p>
                      <p className="text-sm font-medium">ادخله هنا</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email-code">رمز البريد الإلكتروني</Label>
                      <Input
                        id="email-code"
                        type="text"
                        value={verificationCodes.email}
                        onChange={(e) => setVerificationCodes({ ...verificationCodes, email: e.target.value })}
                        placeholder="123456"
                        maxLength={6}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sms-code">رمز الموبايل (SMS)</Label>
                      <Input
                        id="sms-code"
                        type="text"
                        value={verificationCodes.sms}
                        onChange={(e) => setVerificationCodes({ ...verificationCodes, sms: e.target.value })}
                        placeholder="123456"
                        maxLength={6}
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                      {loading ? 'جاري التحقق...' : 'تأكيد التسجيل'}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        setRegistrationStep('form');
                        setTempId(null);
                        setVerificationCodes({ email: '', sms: '' });
                      }}
                    >
                      ابدأ من الأول
                    </Button>
                  </form>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
