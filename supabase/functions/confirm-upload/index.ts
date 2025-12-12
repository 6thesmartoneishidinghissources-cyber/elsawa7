import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const body = await req.json();
    const { upload_token, mime_type, checksum } = body;

    if (!upload_token) {
      return new Response(
        JSON.stringify({ error: 'Missing upload_token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash the token for lookup
    const encoder = new TextEncoder();
    const data = encoder.encode(upload_token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Validate and consume the upload token
    const { data: tokenData, error: tokenError } = await supabase.rpc('consume_upload_token', {
      p_token_hash: tokenHash,
      p_user_id: user.id
    });

    if (tokenError) {
      console.error('Token validation error:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to validate upload token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenResult = tokenData?.[0];
    if (!tokenResult?.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired upload token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { file_key, bucket } = tokenResult;

    // Verify the file exists in storage
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from(bucket)
      .list(user.id, {
        search: file_key.split('/').pop()
      });

    if (fileError) {
      console.error('File verification error:', fileError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify uploaded file' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert driver document metadata
    const { data: docData, error: docError } = await supabase
      .from('driver_documents')
      .insert({
        driver_id: user.id,
        file_key: file_key,
        mime_type: mime_type || 'application/octet-stream',
        checksum: checksum || null,
        uploaded_by: user.id,
        status: 'pending'
      })
      .select()
      .single();

    if (docError) {
      console.error('Failed to insert document metadata:', docError);
      return new Response(
        JSON.stringify({ error: 'Failed to save document metadata' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update driver record with license doc URL reference
    await supabase
      .from('drivers')
      .upsert({
        id: user.id,
        license_doc_url: file_key,
        status: 'pending'
      }, {
        onConflict: 'id'
      });

    // Log successful upload
    await supabase.rpc('log_action', {
      p_actor_id: user.id,
      p_action: 'driver_doc_upload_confirmed',
      p_payload: { doc_id: docData.id, file_key: file_key }
    });

    console.log(`Document upload confirmed for user ${user.id}, doc: ${docData.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        doc_id: docData.id,
        status: 'pending',
        message: 'Document uploaded successfully. Pending admin review.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in confirm-upload:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
