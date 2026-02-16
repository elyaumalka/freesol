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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");

    if (!REPLICATE_API_TOKEN) {
      return new Response(JSON.stringify({ error: "REPLICATE_API_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    const { 
      audioUrl,      // URL of the recorded narration
      projectName,   // Project name for storage path
      mode,          // "narration" (default) or "singing" - singing uses denoised only (no upscaling)
    } = await req.json();

    if (!audioUrl) {
      return new Response(JSON.stringify({ error: "Missing audioUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Starting narration enhancement for: ${audioUrl}`);

    let enhancedAudioUrl = audioUrl;
    let enhancementStatus = "pending";

    // Use Resemble Enhance for voice denoising + enhancement
    console.log("Enhancing voice with Resemble Enhance (denoising + quality boost)...");
    
    try {
      const enhanceResponse = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: "93266a7e7f5805fb79bcf213b1a4e0ef2e45aff3c06eefd96c59e850c87fd6a2",
          input: {
            input_audio: audioUrl,
          }
        })
      });

      if (!enhanceResponse.ok) {
        const errorText = await enhanceResponse.text();
        console.error("Resemble Enhance error:", errorText);
        throw new Error(`Resemble Enhance API error: ${enhanceResponse.status}`);
      }

      const enhanceResult = await enhanceResponse.json();
      console.log("Resemble Enhance initial response:", JSON.stringify(enhanceResult));
      
      // Poll for completion (max 300 seconds)
      if (enhanceResult.status === "processing" || enhanceResult.status === "starting") {
        const predictionId = enhanceResult.id;
        let completed = false;
        let attempts = 0;
        const maxAttempts = 60;
        
        while (!completed && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          attempts++;
          
          console.log(`Resemble Enhance poll ${attempts}: checking status...`);
          
          const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
            headers: { "Authorization": `Bearer ${REPLICATE_API_TOKEN}` }
          });
          
          const statusData = await statusResponse.json();
          console.log(`Resemble Enhance poll ${attempts}: status=${statusData.status}`);
          
          if (statusData.status === "succeeded") {
            const rawOutput = statusData.output;
            console.log("Resemble Enhance completed! Output:", rawOutput);
            
            // Resemble Enhance returns an array: [denoised, enhanced]
            // For singing: use denoised (index 0) - cleans noise without distorting voice
            // For narration: use enhanced (last index) - full quality upgrade
            const isSinging = mode === "singing";
            const replicateUrl = Array.isArray(rawOutput) 
              ? (isSinging ? rawOutput[0] : rawOutput[rawOutput.length - 1]) 
              : rawOutput;
            
            try {
              const timestamp = Date.now();
              const randomId = Math.random().toString(36).substring(2, 8);
              const sanitizedProjectName = (projectName || 'narration')
                .replace(/[^\x00-\x7F]/g, '')
                .replace(/\s+/g, '_')
                .replace(/[^a-zA-Z0-9_-]/g, '')
                || 'narration';
              
              const storagePath = `enhanced/${userId}/${sanitizedProjectName}_enhanced_${timestamp}_${randomId}.wav`;
              
              enhancedAudioUrl = await downloadAndUploadToStorage(
                replicateUrl,
                "recordings",
                storagePath,
                supabaseAdmin
              );
              console.log("Enhanced audio uploaded to storage:", enhancedAudioUrl);
              enhancementStatus = "completed";
            } catch (uploadError) {
              console.error("Failed to upload enhanced audio:", uploadError);
              enhancedAudioUrl = replicateUrl;
              enhancementStatus = "completed_temp_url";
            }
            
            completed = true;
          } else if (statusData.status === "failed" || statusData.status === "canceled") {
            console.error("Resemble Enhance failed:", statusData.error);
            enhancementStatus = "failed";
            break;
          }
        }
        
        if (!completed && enhancementStatus === "pending") {
          console.log(`Resemble Enhance timed out after ${attempts * 5} seconds`);
          enhancementStatus = "timeout";
        }
      } else if (enhanceResult.status === "succeeded" && enhanceResult.output) {
        try {
          const rawOutput = enhanceResult.output;
          const isSinging = mode === "singing";
          const outputUrl = Array.isArray(rawOutput) 
            ? (isSinging ? rawOutput[0] : rawOutput[rawOutput.length - 1]) 
            : rawOutput;
          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substring(2, 8);
          const sanitizedProjectName = (projectName || 'narration')
            .replace(/[^\x00-\x7F]/g, '')
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9_-]/g, '')
            || 'narration';
          
          const storagePath = `enhanced/${userId}/${sanitizedProjectName}_enhanced_${timestamp}_${randomId}.wav`;
          
          enhancedAudioUrl = await downloadAndUploadToStorage(
            outputUrl,
            "recordings",
            storagePath,
            supabaseAdmin
          );
          enhancementStatus = "completed";
        } catch (uploadError) {
          console.error("Failed to upload enhanced audio:", uploadError);
          enhancedAudioUrl = enhanceResult.output;
          enhancementStatus = "completed_temp_url";
        }
      }
    } catch (enhanceError) {
      console.error("Resemble Enhance error:", enhanceError);
      enhancementStatus = "error";
      // Continue with original audio
    }

    const result = {
      success: enhancementStatus === "completed" || enhancementStatus === "completed_temp_url",
      enhancedAudioUrl,
      originalAudioUrl: audioUrl,
      enhancementStatus,
      message: enhancementStatus === "completed" 
        ? "הקול שודרג בהצלחה - איכות גבוהה יותר והסרת רעשי רקע"
        : enhancementStatus === "failed" || enhancementStatus === "error"
        ? "שגיאה בשיפור הקול - משתמשים בהקלטה המקורית"
        : enhancementStatus === "timeout"
        ? "הזמן הקצוב לעיבוד עבר - משתמשים בהקלטה המקורית"
        : "הקול שודרג",
    };

    console.log("Enhancement result:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in enhance-narration:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
