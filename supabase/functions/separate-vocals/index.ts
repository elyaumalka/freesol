import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Download file from URL and upload to Supabase Storage
async function downloadAndUploadToStorage(
  sourceUrl: string,
  bucketName: string,
  filePath: string,
  supabase: any
): Promise<string> {
  console.log(`Downloading file from: ${sourceUrl}`);

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "audio/mpeg";
  const arrayBuffer = await response.arrayBuffer();
  const fileData = new Uint8Array(arrayBuffer);

  console.log(`Downloaded ${fileData.length} bytes, uploading to ${bucketName}/${filePath}`);

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, fileData, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  console.log(`File uploaded successfully: ${publicUrlData.publicUrl}`);

  return publicUrlData.publicUrl;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!REPLICATE_API_TOKEN) {
      throw new Error('REPLICATE_API_TOKEN not configured');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { audioUrl, title, predictionId, uploadToStorage, userId, projectName } = await req.json();

    // If predictionId is provided, check status
    if (predictionId) {
      console.log('Checking status for prediction:', predictionId);
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      const result = await statusResponse.json();
      console.log('Prediction status:', result.status);

      if (result.status === 'succeeded') {
        // Parse output
        let vocalsUrl = null;
        let instrumentalUrl = null;

        if (result.output) {
          console.log('Output:', JSON.stringify(result.output));
          
          if (typeof result.output === 'object' && !Array.isArray(result.output)) {
            vocalsUrl = result.output.vocals || result.output.Vocals;
            instrumentalUrl = result.output.no_vocals || 
                             result.output.accompaniment || 
                             result.output.Accompaniment || 
                             result.output.instrumental ||
                             result.output.other;
          } else if (Array.isArray(result.output)) {
            vocalsUrl = result.output[0];
            instrumentalUrl = result.output[1];
          } else if (typeof result.output === 'string') {
            instrumentalUrl = result.output;
          }
        }

        // Upload to permanent storage if requested
        if (uploadToStorage && instrumentalUrl) {
          console.log('Uploading instrumental to permanent storage...');
          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substring(2, 8);
          const sanitizedProjectName = (projectName || 'project')
            .replace(/[^\x00-\x7F]/g, '')
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9_-]/g, '')
            || 'project';
          
          const storagePath = `separated/${userId || 'anonymous'}/${sanitizedProjectName}_instrumental_${timestamp}_${randomId}.mp3`;
          
          try {
            const permanentUrl = await downloadAndUploadToStorage(
              instrumentalUrl,
              "recordings",
              storagePath,
              supabase
            );
            instrumentalUrl = permanentUrl;
            console.log('Instrumental uploaded to storage:', permanentUrl);
          } catch (uploadError) {
            console.error('Failed to upload to storage:', uploadError);
            // Continue with Replicate URL as fallback
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            status: 'succeeded',
            vocalsUrl,
            instrumentalUrl,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (result.status === 'failed' || result.status === 'canceled') {
        return new Response(
          JSON.stringify({
            success: false,
            status: result.status,
            error: result.error || 'Processing failed',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Still processing
      return new Response(
        JSON.stringify({
          success: true,
          status: result.status,
          predictionId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Start new prediction
    if (!audioUrl) {
      throw new Error('audioUrl is required');
    }

    console.log('Starting vocal separation for:', title || 'Unknown', 'URL:', audioUrl);

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: "25a173108cff36ef9f80f854c162d01df9e6528be175794b81158fa03836d953",
        input: {
          audio: audioUrl,
          stem: "vocals",
          model_name: "htdemucs",
          output_format: "mp3",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Replicate API error:', response.status, errorText);
      throw new Error(`Replicate API error: ${response.status} - ${errorText}`);
    }

    const prediction = await response.json();
    console.log('Prediction started:', prediction.id);

    return new Response(
      JSON.stringify({
        success: true,
        status: 'starting',
        predictionId: prediction.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in separate-vocals:', errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
