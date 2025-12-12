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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting cleanup jobs...');

    // 1. Cleanup expired temp registrations
    const { data: tempCleanup } = await supabase.rpc('cleanup_temp_registrations');
    console.log(`Cleaned up ${tempCleanup || 0} temp registrations`);

    // 2. Cleanup expired votes
    const { data: votesCleanup } = await supabase.rpc('cleanup_expired_votes');
    console.log(`Cleaned up ${votesCleanup || 0} expired votes`);

    // 3. Expire temporary holds
    const { data: holdsCleanup } = await supabase.rpc('expire_temporary_holds');
    console.log(`Expired ${holdsCleanup || 0} temporary holds`);

    // 4. Detect anomalies
    const { data: anomaliesDetected } = await supabase.rpc('detect_anomalies');
    console.log(`Detected ${anomaliesDetected || 0} anomalies`);

    return new Response(
      JSON.stringify({
        success: true,
        results: {
          temp_registrations_cleaned: tempCleanup || 0,
          votes_cleaned: votesCleanup || 0,
          holds_expired: holdsCleanup || 0,
          anomalies_detected: anomaliesDetected || 0,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cleanup-cron:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
