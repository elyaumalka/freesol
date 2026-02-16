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
      voiceUrl,        // URL of the recorded voice
      instrumentalUrl, // URL of the background music/instrumental
      projectName,
      referenceUrl,    // Optional: URL of a reference track for mastering style
    } = await req.json();

    if (!voiceUrl || !instrumentalUrl) {
      return new Response(JSON.stringify({ error: "Missing voiceUrl or instrumentalUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Starting audio mastering...`);
    console.log(`Voice: ${voiceUrl}`);
    console.log(`Instrumental: ${instrumentalUrl}`);

    // Step 1: Use AudioSR to enhance the voice recording quality (with timeout protection)
    console.log("Step 1: Enhancing voice with AudioSR...");
    
    let enhancedVoiceUrl = voiceUrl;
    
    try {
      const audiosrResponse = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: "c09c6f035c611e15285c2d6c87837de80b1bc9d01cd3bd310efdae19adf28919",
          input: {
            input_file: voiceUrl,
            ddim_steps: 30, // Reduced for faster processing
            guidance_scale: 3.0,
          }
        })
      });

      if (!audiosrResponse.ok) {
        const errorText = await audiosrResponse.text();
        console.error("AudioSR error:", errorText);
      } else {
        const audiosrResult = await audiosrResponse.json();
        console.log("AudioSR initial response:", JSON.stringify(audiosrResult));
        
        // Poll for completion with longer timeout (max 180 seconds)
        if (audiosrResult.status === "processing" || audiosrResult.status === "starting") {
          const predictionId = audiosrResult.id;
          let completed = false;
          let attempts = 0;
          const maxAttempts = 36; // 180 seconds max (36 * 5s)
          
          while (!completed && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;
            
            console.log(`AudioSR poll ${attempts}: starting`);
            
            const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
              headers: { "Authorization": `Bearer ${REPLICATE_API_TOKEN}` }
            });
            
            const statusData = await statusResponse.json();
            console.log(`AudioSR poll ${attempts}: status=${statusData.status}, logs_length=${statusData.logs?.length || 0}`);
            
            if (statusData.status === "succeeded") {
              // Download and upload to permanent storage
              const replicateUrl = statusData.output;
              console.log("AudioSR completed successfully! Output URL:", replicateUrl);
              
              try {
                const timestamp = Date.now();
                const randomId = Math.random().toString(36).substring(2, 8);
                const sanitizedProjectName = (projectName || 'project')
                  .replace(/[^\x00-\x7F]/g, '')
                  .replace(/\s+/g, '_')
                  .replace(/[^a-zA-Z0-9_-]/g, '')
                  || 'project';
                
                const storagePath = `mastered/${userId}/${sanitizedProjectName}_enhanced_${timestamp}_${randomId}.wav`;
                
                enhancedVoiceUrl = await downloadAndUploadToStorage(
                  replicateUrl,
                  "recordings",
                  storagePath,
                  supabaseAdmin
                );
                console.log("Enhanced voice uploaded to storage:", enhancedVoiceUrl);
              } catch (uploadError) {
                console.error("Failed to upload enhanced voice:", uploadError);
                enhancedVoiceUrl = replicateUrl; // Fallback to Replicate URL
              }
              
              completed = true;
            } else if (statusData.status === "failed" || statusData.status === "canceled") {
              console.error("AudioSR failed:", statusData.error);
              break;
            }
          }
          
          if (!completed) {
            console.log(`AudioSR timed out after ${attempts * 5} seconds, continuing with original voice...`);
          }
        } else if (audiosrResult.status === "succeeded" && audiosrResult.output) {
          // Immediate success - still need to upload to storage
          try {
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2, 8);
            const sanitizedProjectName = (projectName || 'project')
              .replace(/[^\x00-\x7F]/g, '')
              .replace(/\s+/g, '_')
              .replace(/[^a-zA-Z0-9_-]/g, '')
              || 'project';
            
            const storagePath = `mastered/${userId}/${sanitizedProjectName}_enhanced_${timestamp}_${randomId}.wav`;
            
            enhancedVoiceUrl = await downloadAndUploadToStorage(
              audiosrResult.output,
              "recordings",
              storagePath,
              supabaseAdmin
            );
          } catch (uploadError) {
            console.error("Failed to upload enhanced voice:", uploadError);
            enhancedVoiceUrl = audiosrResult.output;
          }
        }
      }
    } catch (enhanceError) {
      console.error("AudioSR enhancement error:", enhanceError);
      // Continue with original voice
    }

    console.log(`Enhanced voice URL: ${enhancedVoiceUrl}`);

    // Step 2: Create a simple mix metadata (actual mixing would need FFmpeg)
    // For now, we'll prepare files for client-side mixing and then master
    const timestamp = Date.now();
    const sanitizedProjectName = (projectName || 'project')
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      || 'project';

    // Step 3: Use Matchering for final mastering if we have a reference
    // For now, return the enhanced voice and instrumental for client-side mixing
    
    const result = {
      success: true,
      enhancedVoiceUrl,
      originalVoiceUrl: voiceUrl,
      instrumentalUrl,
      message: "Voice enhanced successfully. Use client-side mixing to combine tracks.",
      processingSteps: {
        voiceEnhancement: enhancedVoiceUrl !== voiceUrl ? "completed" : "skipped",
      }
    };

    console.log("Master audio completed:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in master-audio:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
