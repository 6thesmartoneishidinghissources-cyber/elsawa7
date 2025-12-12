import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Signed URL expiry in seconds (5 minutes max for security)
const SIGNED_URL_EXPIRY = 300;

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
        p_action: 'driver_doc_access_denied',
        p_payload: { reason: 'not_admin' }
      });

      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request - support both URL param and body
    let docId: string | null = null;
    
    const url = new URL(req.url);
    docId = url.searchParams.get('doc_id');
    
    if (!docId && req.method === 'POST') {
      const body = await req.json();
      docId = body.doc_id;
    }

    if (!docId) {
      return new Response(
        JSON.stringify({ error: 'Missing doc_id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch document metadata
    const { data: docData, error: docError } = await supabase
      .from('driver_documents')
      .select('id, file_key, driver_id, status')
      .eq('id', docId)
      .single();

    if (docError || !docData) {
      console.log(`Document not found: ${docId}`);
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate signed URL for the document
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from('driver-docs')
      .createSignedUrl(docData.file_key, SIGNED_URL_EXPIRY);

    if (signedUrlError || !signedUrlData) {
      console.error('Failed to create signed URL:', signedUrlError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate document URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Log document access to audit_logs
    await supabase.rpc('log_document_access', {
      p_actor_id: user.id,
      p_doc_id: docId,
      p_action: 'document_view'
    });

    console.log(`Document ${docId} accessed by admin ${user.id}`);

    return new Response(
      JSON.stringify({
        signed_url: signedUrlData.signedUrl,
        expires_in: SIGNED_URL_EXPIRY,
        doc_id: docId,
        driver_id: docData.driver_id,
        status: docData.status
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-driver-doc:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
