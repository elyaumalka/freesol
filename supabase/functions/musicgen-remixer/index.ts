import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  const contentType = response.headers.get("content-type") || "audio/wav";
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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!REPLICATE_API_TOKEN) {
      throw new Error("REPLICATE_API_TOKEN is not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Initialize Supabase clients
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const body = await req.json();
    
    // Check if this is a status check request
    if (body.predictionId) {
      console.log("Checking prediction status:", body.predictionId);
      
      const statusResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${body.predictionId}`,
        {
          headers: {
            Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
          },
        }
      );

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.error("Status check error:", errorText);
        throw new Error(`Failed to check status: ${statusResponse.status}`);
      }

      const prediction = await statusResponse.json();
      console.log("Prediction status:", prediction.status);

      if (prediction.status === "succeeded") {
        // MusicGen Remixer returns array: [remixed_audio, instrumental (if requested)]
        let outputUrl = Array.isArray(prediction.output) 
          ? prediction.output[0] 
          : prediction.output;
        let instrumentalUrl = Array.isArray(prediction.output) && prediction.output.length > 1 
          ? prediction.output[1] 
          : null;
        
        // Upload to permanent storage
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 8);
        const projectName = body.projectName || 'ai_song';
        const sanitizedProjectName = projectName
          .replace(/[^\x00-\x7F]/g, '')
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9_-]/g, '')
          || 'ai_song';
        
        try {
          // Upload main output
          const mainPath = `ai_generated/${user.id}/${sanitizedProjectName}_${timestamp}_${randomId}.wav`;
          const permanentUrl = await downloadAndUploadToStorage(
            outputUrl,
            "recordings",
            mainPath,
            supabaseAdmin
          );
          outputUrl = permanentUrl;
          console.log("Main audio uploaded to storage:", permanentUrl);
          
          // Upload instrumental if available
          if (instrumentalUrl) {
            const instrPath = `ai_generated/${user.id}/${sanitizedProjectName}_instrumental_${timestamp}_${randomId}.wav`;
            const permanentInstrUrl = await downloadAndUploadToStorage(
              instrumentalUrl,
              "recordings",
              instrPath,
              supabaseAdmin
            );
            instrumentalUrl = permanentInstrUrl;
            console.log("Instrumental uploaded to storage:", permanentInstrUrl);
          }
        } catch (uploadError) {
          console.error("Failed to upload to storage:", uploadError);
          // Continue with Replicate URLs as fallback
        }
        
        return new Response(
          JSON.stringify({
            status: "complete",
            audioUrl: outputUrl,
            instrumentalUrl: instrumentalUrl,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (prediction.status === "failed") {
        return new Response(
          JSON.stringify({
            status: "error",
            error: prediction.error || "Generation failed",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Still processing
        return new Response(
          JSON.stringify({
            status: "processing",
            progress: prediction.logs || "Processing...",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Start new generation
    const { audioUrl, prompt, returnInstrumental = true } = body;

    if (!audioUrl) {
      throw new Error("audioUrl is required");
    }

    console.log("Starting MusicGen Remixer generation:", { audioUrl, prompt });
    
    // The audio should be in WAV format from the client
    // Just validate it's accessible
    console.log("Audio URL for processing:", audioUrl);

    // Call Replicate API to start generation with MusicGen Remixer (preserves vocals)
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // sakemin/musicgen-remixer - generates music around vocals
        version: "0b769f28e399c7c30e4f2360691b9b11c294183e9ab2fd9f3398127b556c86d7",
        input: {
          model_version: "stereo-chord",
          prompt: prompt || "jewish music, melodic, warm, acoustic, traditional instruments",
          music_input: audioUrl, // This is the correct parameter name for remixer
          output_format: "wav",
          large_chord_voca: false,
          chroma_coefficient: 1,
          return_instrumental: returnInstrumental,
          multi_band_diffusion: false,
          normalization_strategy: "loudness",
          classifier_free_guidance: 3,
          top_k: 250,
          top_p: 0,
          temperature: 1,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Replicate API error:", response.status, errorText);
      throw new Error(`Replicate API error: ${response.status} - ${errorText}`);
    }

    const prediction = await response.json();
    console.log("Prediction started:", prediction.id);

    return new Response(
      JSON.stringify({
        predictionId: prediction.id,
        status: "starting",
        message: "יצירת מוזיקה החלה, התהליך יכול לקחת כ-7 דקות",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
