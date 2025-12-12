import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Upload token expiry in minutes
const UPLOAD_TOKEN_EXPIRY_MINUTES = 5;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Require JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Check if user is a driver or has driver role pending
    const { data: userRole } = await supabase.rpc('get_user_role_v2', { user_id: user.id });
    
    // Allow drivers and passengers who are in driver signup flow
    if (userRole && !['driver', 'passenger'].includes(userRole)) {
      return new Response(
        JSON.stringify({ error: 'Only drivers can upload license documents' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { file_name, mime_type } = body;

    if (!file_name || !mime_type) {
      return new Response(
        JSON.stringify({ error: 'Missing file_name or mime_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate mime type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(mime_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP, PDF' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique file key
    const fileExtension = file_name.split('.').pop() || 'jpg';
    const uniqueId = crypto.randomUUID();
    const fileKey = `${user.id}/${uniqueId}.${fileExtension}`;

    // Create upload token using security definer function
    const { data: uploadToken, error: tokenError } = await supabase.rpc('create_upload_token', {
      p_user_id: user.id,
      p_file_key: fileKey,
      p_bucket: 'driver-docs',
      p_expires_minutes: UPLOAD_TOKEN_EXPIRY_MINUTES
    });

    if (tokenError) {
      console.error('Failed to create upload token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to create upload token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create signed upload URL
    const { data: uploadUrl, error: uploadError } = await supabase
      .storage
      .from('driver-docs')
      .createSignedUploadUrl(fileKey);

    if (uploadError || !uploadUrl) {
      console.error('Failed to create upload URL:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to create upload URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log upload request
    await supabase.rpc('log_action', {
      p_actor_id: user.id,
      p_action: 'driver_doc_upload_requested',
      p_payload: { file_key: fileKey }
    });

    console.log(`Upload URL created for user ${user.id}, file: ${fileKey}`);

    return new Response(
      JSON.stringify({
        upload_url: uploadUrl.signedUrl,
        upload_token: uploadToken,
        file_key: fileKey,
        expires_in_minutes: UPLOAD_TOKEN_EXPIRY_MINUTES
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in upload-driver-doc:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
