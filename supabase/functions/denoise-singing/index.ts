import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function downloadAndUploadToStorage(
  sourceUrl: string,
  bucketName: string,
  filePath: string,
  supabase: any
): Promise<string> {
  console.log(`Downloading file from: ${sourceUrl}`);
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Failed to download file: ${response.status}`);
  const contentType = response.headers.get("content-type") || "audio/mpeg";
  const arrayBuffer = await response.arrayBuffer();
  const fileData = new Uint8Array(arrayBuffer);
  console.log(`Downloaded ${fileData.length} bytes`);

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, fileData, { contentType, upsert: true });
  if (error) throw new Error(`Failed to upload: ${error.message}`);

  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);
  return publicUrlData.publicUrl;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!REPLICATE_API_TOKEN) {
      return new Response(JSON.stringify({ error: "REPLICATE_API_TOKEN not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { audioUrl, projectName, predictionId } = await req.json();

    // Poll for existing prediction
    if (predictionId) {
      console.log("Checking Demucs prediction status:", predictionId);

      const statusResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        { headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` } }
      );

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      const result = await statusResponse.json();
      console.log("Prediction status:", result.status);

      if (result.status === "succeeded" && result.output) {
        console.log("Demucs output:", JSON.stringify(result.output));

        // Extract vocals URL - Demucs returns {vocals, no_vocals} or similar
        let vocalsUrl: string | null = null;
        if (typeof result.output === "object" && !Array.isArray(result.output)) {
          vocalsUrl = result.output.vocals || result.output.Vocals;
        } else if (Array.isArray(result.output)) {
          vocalsUrl = result.output[0];
        }

        if (!vocalsUrl) {
          console.error("No vocals URL in output");
          return new Response(JSON.stringify({
            success: false, status: "failed", error: "No vocals found in output",
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Upload clean vocal to permanent storage
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 8);
        const sanitizedProjectName = (projectName || "singing")
          .replace(/[^\x00-\x7F]/g, "")
          .replace(/\s+/g, "_")
          .replace(/[^a-zA-Z0-9_-]/g, "")
          || "singing";
        const storagePath = `denoised/${userId}/${sanitizedProjectName}_clean_${timestamp}_${randomId}.mp3`;

        try {
          const permanentUrl = await downloadAndUploadToStorage(
            vocalsUrl, "recordings", storagePath, supabaseAdmin
          );
          console.log("Clean vocal uploaded:", permanentUrl);
          return new Response(JSON.stringify({
            success: true, status: "succeeded", cleanVocalUrl: permanentUrl,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (uploadError) {
          console.error("Upload failed, using Replicate URL:", uploadError);
          return new Response(JSON.stringify({
            success: true, status: "succeeded", cleanVocalUrl: vocalsUrl,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      if (result.status === "failed" || result.status === "canceled") {
        return new Response(JSON.stringify({
          success: false, status: "failed", error: result.error || "Processing failed",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        success: true, status: "processing",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Start new Demucs vocal separation
    if (!audioUrl) {
      return new Response(JSON.stringify({ error: "Missing audioUrl" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Starting Demucs vocal separation for singing denoising:", audioUrl);

    // Use Demucs htdemucs model - designed for music source separation
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
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
      const errText = await response.text();
      console.error("Replicate API error:", response.status, errText);
      throw new Error(`Replicate API error: ${response.status}`);
    }

    const prediction = await response.json();
    console.log("Demucs prediction started:", prediction.id);

    return new Response(JSON.stringify({
      success: true, status: "processing", predictionId: prediction.id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Error in denoise-singing:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
