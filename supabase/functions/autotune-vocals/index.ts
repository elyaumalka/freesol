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
  const contentType = response.headers.get("content-type") || "audio/wav";
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
      console.log("Checking autotune prediction status:", predictionId);

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
        console.log("Autotune output:", JSON.stringify(result.output));

        // Output is an array of FileOutput objects
        let autotunedUrl: string | null = null;
        if (Array.isArray(result.output) && result.output.length > 0) {
          // Each item is a FileOutput with a url property or is a string URL
          autotunedUrl = typeof result.output[0] === 'string' 
            ? result.output[0] 
            : result.output[0]?.url || result.output[0];
        } else if (typeof result.output === 'string') {
          autotunedUrl = result.output;
        }

        if (!autotunedUrl) {
          console.error("No autotuned URL in output");
          return new Response(JSON.stringify({
            success: false, status: "failed", error: "No autotuned audio in output",
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Upload to permanent storage
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 8);
        const sanitizedProjectName = (projectName || "vocals")
          .replace(/[^\x00-\x7F]/g, "")
          .replace(/\s+/g, "_")
          .replace(/[^a-zA-Z0-9_-]/g, "")
          || "vocals";
        const storagePath = `autotuned/${userId}/${sanitizedProjectName}_tuned_${timestamp}_${randomId}.wav`;

        try {
          const permanentUrl = await downloadAndUploadToStorage(
            autotunedUrl, "recordings", storagePath, supabaseAdmin
          );
          console.log("Autotuned vocal uploaded:", permanentUrl);
          return new Response(JSON.stringify({
            success: true, status: "succeeded", autotunedUrl: permanentUrl,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (uploadError) {
          console.error("Upload failed, using Replicate URL:", uploadError);
          return new Response(JSON.stringify({
            success: true, status: "succeeded", autotunedUrl: autotunedUrl,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      if (result.status === "failed" || result.status === "canceled") {
        return new Response(JSON.stringify({
          success: false, status: "failed", error: result.error || "Autotune processing failed",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        success: true, status: "processing",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Start new autotune prediction
    if (!audioUrl) {
      return new Response(JSON.stringify({ error: "Missing audioUrl" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Starting autotune for vocal:", audioUrl);

    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "b8198afc90cb2702cad5330980220ad6fff1b465157e71ab2325d4275f58c8a2",
        input: {
          audio_file: audioUrl,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Replicate API error:", response.status, errText);
      throw new Error(`Replicate API error: ${response.status}`);
    }

    const prediction = await response.json();
    console.log("Autotune prediction started:", prediction.id);

    return new Response(JSON.stringify({
      success: true, status: "processing", predictionId: prediction.id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Error in autotune-vocals:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
