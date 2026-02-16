import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KITS_API_BASE = "https://arpeggi.io/api/kits/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const KITS_API_KEY = Deno.env.get("KITS_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!KITS_API_KEY) {
      return new Response(JSON.stringify({ error: "KITS_API_KEY not configured" }), {
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

    const { audioUrl, jobId, projectName } = await req.json();

    // ========== POLL MODE ==========
    if (jobId) {
      console.log("Polling Kits.ai vocal separation job:", jobId);

      const statusResponse = await fetch(`${KITS_API_BASE}/vocal-separations/${jobId}`, {
        headers: { "Authorization": `Bearer ${KITS_API_KEY}` },
      });

      if (!statusResponse.ok) {
        const errText = await statusResponse.text();
        console.error("Kits status check failed:", statusResponse.status, errText);
        throw new Error(`Kits status check failed: ${statusResponse.status}`);
      }

      const result = await statusResponse.json();
      console.log("Kits job status:", result.status);

      if (result.status === "success") {
        // Get the clean vocal URL
        const cleanVocalUrl = result.vocalAudioFileUrl || result.lossyVocalAudioFileUrl;

        if (!cleanVocalUrl) {
          return new Response(JSON.stringify({
            success: false, status: "failed", error: "No vocal output in result",
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Download and upload to permanent storage
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 8);
        const sanitizedProjectName = (projectName || "vocal")
          .replace(/[^\x00-\x7F]/g, "")
          .replace(/\s+/g, "_")
          .replace(/[^a-zA-Z0-9_-]/g, "")
          || "vocal";
        const storagePath = `kits-cleaned/${userId}/${sanitizedProjectName}_clean_${timestamp}_${randomId}.wav`;

        try {
          console.log("Downloading clean vocal from Kits:", cleanVocalUrl);
          const dlResponse = await fetch(cleanVocalUrl);
          if (!dlResponse.ok) throw new Error(`Download failed: ${dlResponse.status}`);

          const contentType = dlResponse.headers.get("content-type") || "audio/wav";
          const arrayBuffer = await dlResponse.arrayBuffer();
          const fileData = new Uint8Array(arrayBuffer);
          console.log(`Downloaded ${fileData.length} bytes`);

          const { error: uploadError } = await supabaseAdmin.storage
            .from("recordings")
            .upload(storagePath, fileData, { contentType, upsert: true });

          if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

          const { data: publicUrlData } = supabaseAdmin.storage
            .from("recordings")
            .getPublicUrl(storagePath);

          console.log("Clean vocal uploaded:", publicUrlData.publicUrl);

          return new Response(JSON.stringify({
            success: true,
            status: "succeeded",
            cleanVocalUrl: publicUrlData.publicUrl,
            instrumentalUrl: result.instrumentalAudioFileUrl || result.lossyInstrumentalAudioFileUrl || null,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (uploadErr) {
          console.error("Upload failed, using Kits URL:", uploadErr);
          return new Response(JSON.stringify({
            success: true,
            status: "succeeded",
            cleanVocalUrl,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      if (result.status === "error" || result.status === "cancelled") {
        return new Response(JSON.stringify({
          success: false, status: "failed", error: result.error || "Kits processing failed",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Still processing
      return new Response(JSON.stringify({
        success: true, status: "processing",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========== START MODE ==========
    if (!audioUrl) {
      return new Response(JSON.stringify({ error: "Missing audioUrl" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Starting Kits.ai vocal separation for:", audioUrl);

    // Download the audio file first (Kits requires file upload, not URL)
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }
    const audioBlob = await audioResponse.blob();
    console.log(`Downloaded audio: ${audioBlob.size} bytes`);

    // Create multipart form data for Kits API
    const formData = new FormData();
    formData.append("inputFile", audioBlob, "vocals.wav");

    const kitsResponse = await fetch(`${KITS_API_BASE}/vocal-separations`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KITS_API_KEY}`,
      },
      body: formData,
    });

    if (!kitsResponse.ok) {
      const errText = await kitsResponse.text();
      console.error("Kits API error:", kitsResponse.status, errText);
      throw new Error(`Kits API error: ${kitsResponse.status} - ${errText}`);
    }

    const kitsResult = await kitsResponse.json();
    console.log("Kits job created:", JSON.stringify(kitsResult));

    return new Response(JSON.stringify({
      success: true,
      status: "processing",
      jobId: kitsResult.id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Error in kits-vocal-cleanup:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
