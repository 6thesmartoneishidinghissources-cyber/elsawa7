import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code + Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { temp_id, email_code, sms_code, password } = await req.json();

    if (!temp_id || !password) {
      return new Response(
        JSON.stringify({ error: 'بيانات ناقصة' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get temp registration
    const { data: tempReg, error: fetchError } = await supabase
      .from('temp_registrations')
      .select('*')
      .eq('id', temp_id)
      .eq('consumed', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (fetchError || !tempReg) {
      console.error('Temp registration not found or expired:', fetchError);
      return new Response(
        JSON.stringify({ error: 'التسجيل منتهي أو غير موجود — ابدأ من الأول' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check attempt limit
    if (tempReg.attempts >= 5) {
      return new Response(
        JSON.stringify({ error: 'تم تجاوز عدد المحاولات — ابدأ تسجيل جديد' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify codes (at least one must match)
    let verified = false;
    
    if (email_code) {
      const hashedEmailCode = await hashCode(email_code);
      if (hashedEmailCode === tempReg.verification_code_email) {
        verified = true;
      }
    }
    
    if (sms_code && !verified) {
      const hashedSmsCode = await hashCode(sms_code);
      if (hashedSmsCode === tempReg.verification_code_sms) {
        verified = true;
      }
    }

    if (!verified) {
      // Increment attempts
      await supabase
        .from('temp_registrations')
        .update({ attempts: tempReg.attempts + 1 })
        .eq('id', temp_id);

      return new Response(
        JSON.stringify({ 
          error: 'رمز التحقق غير صحيح',
          remaining_attempts: 5 - (tempReg.attempts + 1)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atomic check: verify email/phone still free
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(
      u => u.email?.toLowerCase() === tempReg.email.toLowerCase()
    );

    if (emailExists) {
      await supabase
        .from('temp_registrations')
        .update({ consumed: true, error_reason: 'Email taken during verification' })
        .eq('id', temp_id);

      return new Response(
        JSON.stringify({ error: 'البريد الإلكتروني مستخدم بالفعل — جرب تسجيل الدخول' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check phone
    const { data: existingPhone } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', tempReg.phone)
      .maybeSingle();

    if (existingPhone) {
      await supabase
        .from('temp_registrations')
        .update({ consumed: true, error_reason: 'Phone taken during verification' })
        .eq('id', temp_id);

      return new Response(
        JSON.stringify({ error: 'رقم التليفون مستخدم بالفعل' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: tempReg.email,
      password: password,
      email_confirm: true, // Auto-confirm since we verified via code
      user_metadata: {
        name: tempReg.name,
        phone: tempReg.phone,
      }
    });

    if (authError || !authUser.user) {
      console.error('Error creating auth user:', authError);
      return new Response(
        JSON.stringify({ error: 'حصل خطأ في إنشاء الحساب' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authUser.user.id,
        name: tempReg.name,
        phone: tempReg.phone,
        role: tempReg.requested_role,
        phone_verified: true,
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Rollback: delete auth user
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return new Response(
        JSON.stringify({ error: 'حصل خطأ في إنشاء الملف الشخصي' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user_role entry
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authUser.user.id,
        role: tempReg.requested_role,
      });

    if (roleError) {
      console.error('Error creating user role:', roleError);
      // Continue anyway - profile is created
    }

    // If driver, create driver record
    if (tempReg.requested_role === 'driver') {
      await supabase
        .from('drivers')
        .insert({ id: authUser.user.id });
    }

    // Mark temp registration as consumed
    await supabase
      .from('temp_registrations')
      .update({ consumed: true })
      .eq('id', temp_id);

    console.log('User registration completed:', authUser.user.id);

    return new Response(
      JSON.stringify({
        user_id: authUser.user.id,
        message: 'تم التسجيل بنجاح!',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in complete-register:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
