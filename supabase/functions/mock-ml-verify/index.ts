import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * MOCK ML VERIFICATION SERVICE
 * 
 * This is a mock implementation for testing. In production, replace with
 * a real ML service that:
 * 1. Accepts image data (base64 or URL)
 * 2. Runs image classification (Vodafone Cash screenshot detection)
 * 3. Performs OCR to extract transaction details
 * 
 * API Contract for External ML Service:
 * POST /ml/verify
 * Content-Type: application/json
 * Body: { "image_url": string } or { "image_base64": string }
 * 
 * Response:
 * {
 *   "is_vodafone_cash": boolean,
 *   "confidence": number (0.0 - 1.0),
 *   "ocr_text": string,
 *   "extracted_fields": {
 *     "transaction_id": string | null,
 *     "amount": number | null,
 *     "from_phone": string | null,
 *     "timestamp": string | null
 *   }
 * }
 * 
 * INTEGRATION INSTRUCTIONS:
 * 1. Deploy your ML service (see /docs/ml-service-setup.md)
 * 2. Set ML_SERVICE_URL secret in Supabase
 * 3. Update verify-payment edge function to call real ML endpoint
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image_url, image_base64 } = await req.json();

    if (!image_url && !image_base64) {
      return new Response(JSON.stringify({ 
        error: 'Missing image_url or image_base64' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // MOCK RESPONSE - Simulates ML classification
    // In production, this would call a real ML model
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate mock response based on random confidence
    const mockConfidence = Math.random() * 0.4 + 0.6; // 0.6 - 1.0
    const isVodafoneCash = mockConfidence >= 0.75;

    const mockResponse = {
      is_vodafone_cash: isVodafoneCash,
      confidence: Number(mockConfidence.toFixed(2)),
      ocr_text: isVodafoneCash 
        ? "Vodafone Cash\nتم التحويل بنجاح\nرقم العملية: VC" + Math.random().toString().slice(2, 12) + "\nالمبلغ: 50 ج.م"
        : "Unable to detect Vodafone Cash receipt",
      extracted_fields: isVodafoneCash ? {
        transaction_id: "VC" + Math.random().toString().slice(2, 12),
        amount: 50,
        from_phone: "01" + Math.floor(Math.random() * 1000000000).toString().padStart(9, '0'),
        timestamp: new Date().toISOString()
      } : {
        transaction_id: null,
        amount: null,
        from_phone: null,
        timestamp: null
      }
    };

    console.log('Mock ML verification result:', mockResponse);

    return new Response(JSON.stringify(mockResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Mock ML error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
