import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit configuration
const RATE_LIMIT_PER_USER = 10; // requests per minute
const RATE_LIMIT_PER_IP = 30; // requests per minute

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Require JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Unauthorized: Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Initialize Supabase client with service role for rate limiting
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log('Unauthorized: Invalid JWT token', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    console.log(`verify-payment request from user: ${userId}, IP: ${clientIp}`);

    // SECURITY: Check per-user rate limit
    const { data: userRateOk } = await supabase.rpc('check_rate_limit', {
      p_subject: userId,
      p_endpoint: 'verify-payment',
      p_limit: RATE_LIMIT_PER_USER,
      p_window_seconds: 60
    });

    if (!userRateOk) {
      console.log(`Rate limit exceeded for user: ${userId}`);
      
      // Log rate limit violation
      await supabase.rpc('log_action', {
        p_actor_id: userId,
        p_action: 'verify_payment_rate_limited',
        p_payload: { ip: clientIp, type: 'user' }
      });

      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Check per-IP rate limit
    const { data: ipRateOk } = await supabase.rpc('check_rate_limit', {
      p_subject: `ip:${clientIp}`,
      p_endpoint: 'verify-payment',
      p_limit: RATE_LIMIT_PER_IP,
      p_window_seconds: 60
    });

    if (!ipRateOk) {
      console.log(`IP rate limit exceeded: ${clientIp}`);
      
      await supabase.rpc('log_action', {
        p_actor_id: userId,
        p_action: 'verify_payment_rate_limited',
        p_payload: { ip: clientIp, type: 'ip' }
      });

      return new Response(
        JSON.stringify({ error: 'Too many requests from this IP. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { imageBase64 } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Missing image data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting Vodafone Cash image verification...');

    // Log verification attempt
    await supabase.rpc('log_action', {
      p_actor_id: userId,
      p_action: 'verify_payment_attempt',
      p_payload: { ip: clientIp }
    });

    // Use Lovable AI (Gemini) to analyze the payment screenshot
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant that analyzes payment screenshots to verify Vodafone Cash transfers.
Your task is to:
1. Determine if the image is a Vodafone Cash payment screenshot
2. Extract any visible text (OCR) including transaction IDs, amounts, phone numbers
3. Provide a confidence score (0.0 to 1.0) for whether this is a valid Vodafone Cash transfer

Respond ONLY with valid JSON in this exact format:
{
  "is_vodafone_cash": true/false,
  "confidence": 0.0-1.0,
  "ocr_text": "extracted text from image",
  "extracted_fields": {
    "transaction_id": "string or null",
    "amount": "string or null",
    "from_phone": "string or null",
    "to_phone": "string or null"
  },
  "warnings": ["array of any issues detected"]
}`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this payment screenshot and determine if it's a valid Vodafone Cash transfer. Extract all visible text and provide your analysis."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required, please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    console.log('AI Response received:', JSON.stringify(aiResponse));

    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ 
          is_vodafone_cash: false, 
          confidence: 0, 
          ocr_text: '', 
          extracted_fields: {},
          warnings: ['Failed to analyze image']
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the JSON response from AI
    let result;
    try {
      // Extract JSON from the response (handle markdown code blocks)
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, content);
      result = {
        is_vodafone_cash: false,
        confidence: 0.3,
        ocr_text: content,
        extracted_fields: {},
        warnings: ['Could not parse structured response']
      };
    }

    // Log verification result
    await supabase.rpc('log_action', {
      p_actor_id: userId,
      p_action: 'verify_payment_result',
      p_payload: { 
        confidence: result.confidence,
        is_vodafone_cash: result.is_vodafone_cash,
        ip: clientIp
      }
    });

    console.log('Verification result:', JSON.stringify(result));

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
