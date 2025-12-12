import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple hash function for verification codes (in production use bcrypt)
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code + Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function validatePhone(phone: string): boolean {
  // Egyptian phone format: starts with 01, 10-11 digits
  const phoneRegex = /^01[0-9]{9}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

function validateName(name: string): boolean {
  return name.length >= 2 && name.length <= 100;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, phone, name, requested_role, source, device_fingerprint } = await req.json();

    // Input validation
    const errors: string[] = [];
    
    if (!email || !validateEmail(email)) {
      errors.push('البريد الإلكتروني غير صحيح');
    }
    if (!phone || !validatePhone(phone)) {
      errors.push('رقم التليفون غير صحيح - يجب أن يبدأ بـ 01');
    }
    if (!name || !validateName(name)) {
      errors.push('الاسم يجب أن يكون بين 2 و 100 حرف');
    }
    
    // Only allow passenger or driver roles
    const safeRole = requested_role === 'driver' ? 'driver' : 'passenger';
    
    if (errors.length > 0) {
      console.log('Validation errors:', errors);
      return new Response(
        JSON.stringify({ 
          error: 'البيانات غير صحيحة — رجاء صحح الحقول. مش هنحفظ الحاجة إلا بعد التحقق.',
          details: errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if email already exists in main users table
    const { data: existingAuth } = await supabase.auth.admin.listUsers();
    const emailExists = existingAuth?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (emailExists) {
      return new Response(
        JSON.stringify({ error: 'البريد الإلكتروني مسجل بالفعل — جرب تسجيل الدخول' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if phone already exists in profiles
    const { data: existingPhone } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();
    
    if (existingPhone) {
      return new Response(
        JSON.stringify({ error: 'رقم التليفون مسجل بالفعل — جرب تسجيل الدخول' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate verification codes
    const emailCode = generateVerificationCode();
    const smsCode = generateVerificationCode();

    // Hash codes before storing
    const hashedEmailCode = await hashCode(emailCode);
    const hashedSmsCode = await hashCode(smsCode);

    // Get IP address
    const ipAddress = req.headers.get('x-forwarded-for') || 
                      req.headers.get('cf-connecting-ip') || 
                      'unknown';

    // Delete any existing temp registrations for this email (allow retry)
    await supabase
      .from('temp_registrations')
      .delete()
      .eq('email', email)
      .eq('consumed', false);

    // Create temp registration
    const { data: tempReg, error: insertError } = await supabase
      .from('temp_registrations')
      .insert({
        email,
        phone,
        name,
        requested_role: safeRole,
        verification_code_email: hashedEmailCode,
        verification_code_sms: hashedSmsCode,
        source: source || 'web',
        ip_address: ipAddress,
        device_fingerprint,
      })
      .select('id, expires_at')
      .single();

    if (insertError) {
      console.error('Error creating temp registration:', insertError);
      return new Response(
        JSON.stringify({ error: 'حصل خطأ، حاول تاني' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // TODO: Integrate with actual email/SMS providers
    // For now, log codes for development (remove in production!)
    console.log('=== VERIFICATION CODES (DEV ONLY) ===');
    console.log(`Email: ${email} -> Code: ${emailCode}`);
    console.log(`Phone: ${phone} -> Code: ${smsCode}`);
    console.log('=====================================');

    return new Response(
      JSON.stringify({
        temp_id: tempReg.id,
        expires_at: tempReg.expires_at,
        message: 'بعتنا رمز تحقق على الإيميل / الموبايل — ادخله هنا',
        // For development only - remove in production
        _dev_codes: { email: emailCode, sms: smsCode }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in start-register:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
