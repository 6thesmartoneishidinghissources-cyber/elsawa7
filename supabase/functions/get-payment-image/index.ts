import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Signed URL expiry in seconds (10 minutes max for payment images)
const SIGNED_URL_EXPIRY = 600;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Require JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Unauthorized: Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log('Unauthorized: Invalid JWT token');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Check if user is admin/owner
    const { data: isAdmin } = await supabase.rpc('is_admin', { user_id: user.id });
    
    if (!isAdmin) {
      console.log(`Access denied: User ${user.id} is not admin/owner`);
      
      // Log unauthorized access attempt
      await supabase.rpc('log_action', {
        p_actor_id: user.id,
        p_action: 'payment_image_access_denied',
        p_payload: { reason: 'not_admin' }
      });

      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    let paymentId: string | null = null;
    
    const url = new URL(req.url);
    paymentId = url.searchParams.get('payment_id');
    
    if (!paymentId && req.method === 'POST') {
      const body = await req.json();
      paymentId = body.payment_id;
    }

    if (!paymentId) {
      return new Response(
        JSON.stringify({ error: 'Missing payment_id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch payment record
    const { data: paymentData, error: paymentError } = await supabase
      .from('payments')
      .select('id, image_url, reservation_id, payment_status, ai_confidence')
      .eq('id', paymentId)
      .single();

    if (paymentError || !paymentData) {
      console.log(`Payment not found: ${paymentId}`);
      return new Response(
        JSON.stringify({ error: 'Payment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract file key from image_url (it may be a full URL or just a path)
    let fileKey = paymentData.image_url;
    if (fileKey.includes('/storage/v1/object/')) {
      // Extract path from full URL
      const match = fileKey.match(/\/storage\/v1\/object\/[^/]+\/payment-images\/(.+)/);
      if (match) {
        fileKey = match[1];
      }
    }

    // Generate signed URL
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from('payment-images')
      .createSignedUrl(fileKey, SIGNED_URL_EXPIRY);

    if (signedUrlError || !signedUrlData) {
      console.error('Failed to create signed URL:', signedUrlError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate image URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Log payment image access
    await supabase.rpc('log_action', {
      p_actor_id: user.id,
      p_action: 'payment_image_view',
      p_payload: { 
        payment_id: paymentId,
        reservation_id: paymentData.reservation_id
      }
    });

    console.log(`Payment image ${paymentId} accessed by admin ${user.id}`);

    return new Response(
      JSON.stringify({
        signed_url: signedUrlData.signedUrl,
        expires_in: SIGNED_URL_EXPIRY,
        payment_id: paymentId,
        payment_status: paymentData.payment_status,
        ai_confidence: paymentData.ai_confidence
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-payment-image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
