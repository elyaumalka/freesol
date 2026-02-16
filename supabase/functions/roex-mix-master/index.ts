import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROEX_API_BASE = "https://tonn.roexaudio.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ROEX_API_KEY = Deno.env.get("ROEX_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!ROEX_API_KEY) {
      return new Response(JSON.stringify({ error: "ROEX_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    const testMode = req.headers.get("x-test-mode") === "true";
    
    let userId = "test-user";
    
    if (!testMode) {
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = userData.user.id;
    }

    const { vocalUrl, instrumentalUrl, taskId, projectName, mode } = await req.json();

    // ========== POLL MODE (from DB) ==========
    if (taskId) {
      console.log("Polling RoEx task from DB:", taskId);

      // Call /retrievepreviewmix to check status
      const pollPayload = {
        multitrackData: {
          multitrackTaskId: taskId,
          retrieveFXSettings: true,
        },
      };

      const statusResponse = await fetch(`${ROEX_API_BASE}/retrievepreviewmix`, {
        method: "POST",
        headers: {
          "X-API-Key": ROEX_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pollPayload),
      });

      if (!statusResponse.ok) {
        const errText = await statusResponse.text();
        console.error("RoEx poll failed:", statusResponse.status, errText);
        throw new Error(`RoEx poll failed: ${statusResponse.status}`);
      }

      const result = await statusResponse.json();
      console.log("RoEx poll result:", JSON.stringify(result).substring(0, 500));

      const previewResult = result.previewMixTaskResults || result;
      const outputUrl = previewResult.download_url_preview_mixed || previewResult.download_url_mixed || previewResult.preview_mix_url;
      const state = previewResult.state || result.state;

      if (outputUrl) {
        // Download and upload to permanent storage
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 8);
        const sanitizedProjectName = (projectName || "mixed")
          .replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "") || "mixed";
        const storagePath = `roex/${userId}/${sanitizedProjectName}_mixed_${timestamp}_${randomId}.wav`;

        try {
          console.log("Downloading from RoEx:", outputUrl);
          const dlResponse = await fetch(outputUrl);
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

          return new Response(JSON.stringify({
            success: true,
            status: "succeeded",
            outputUrl: publicUrlData.publicUrl,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (uploadErr) {
          console.error("Upload failed, using RoEx URL:", uploadErr);
          return new Response(JSON.stringify({
            success: true, status: "succeeded", outputUrl,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      if (state === "MIX_TASK_PREVIEW_COMPLETED" && !outputUrl) {
        return new Response(JSON.stringify({
          success: false, status: "failed", error: "Mix completed but no download URL available",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (previewResult.error || state === "MIX_TASK_FAILED") {
        return new Response(JSON.stringify({
          success: false, status: "failed", error: previewResult.message || "Processing failed",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Still processing
      return new Response(JSON.stringify({
        success: true, status: "processing", state: state || "unknown",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========== START MIXING MODE ==========
    if (!vocalUrl || !instrumentalUrl) {
      return new Response(JSON.stringify({ error: "Missing vocalUrl or instrumentalUrl" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Starting RoEx multitrack mixing...");
    console.log("Vocal:", vocalUrl);
    console.log("Instrumental:", instrumentalUrl);

    // Upload files to RoEx temporary storage
    console.log("Uploading vocal to RoEx...");
    const vocalUpload = await fetch(`${ROEX_API_BASE}/upload`, {
      method: "POST",
      headers: { "X-API-Key": ROEX_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ filename: "vocals.wav", contentType: "audio/wav" }),
    });
    
    if (!vocalUpload.ok) {
      const errText = await vocalUpload.text();
      throw new Error(`RoEx upload URL error: ${vocalUpload.status} - ${errText}`);
    }
    
    const vocalUploadData = await vocalUpload.json();
    console.log("Got vocal upload URL, downloading and uploading...");
    
    const vocalDl = await fetch(vocalUrl);
    if (!vocalDl.ok) throw new Error(`Failed to download vocal: ${vocalDl.status}`);
    const vocalBytes = await vocalDl.arrayBuffer();
    
    const vocalPut = await fetch(vocalUploadData.signed_url, {
      method: "PUT",
      headers: { "Content-Type": "audio/wav" },
      body: new Uint8Array(vocalBytes),
    });
    if (!vocalPut.ok) throw new Error(`Failed to upload vocal to RoEx: ${vocalPut.status}`);
    console.log("Vocal uploaded to RoEx");

    console.log("Uploading instrumental to RoEx...");
    const instrUpload = await fetch(`${ROEX_API_BASE}/upload`, {
      method: "POST",
      headers: { "X-API-Key": ROEX_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ filename: "instrumental.wav", contentType: "audio/wav" }),
    });
    
    if (!instrUpload.ok) {
      const errText = await instrUpload.text();
      throw new Error(`RoEx instrumental upload URL error: ${instrUpload.status} - ${errText}`);
    }
    
    const instrUploadData = await instrUpload.json();
    
    const instrDl = await fetch(instrumentalUrl);
    if (!instrDl.ok) throw new Error(`Failed to download instrumental: ${instrDl.status}`);
    const instrBytes = await instrDl.arrayBuffer();
    
    const instrPut = await fetch(instrUploadData.signed_url, {
      method: "PUT",
      headers: { "Content-Type": "audio/wav" },
      body: new Uint8Array(instrBytes),
    });
    if (!instrPut.ok) throw new Error(`Failed to upload instrumental to RoEx: ${instrPut.status}`);
    console.log("Instrumental uploaded to RoEx");

    // Submit mix preview job
    const webhookURL = `${SUPABASE_URL}/functions/v1/roex-webhook`;
    
    const mixPayload = {
      multitrackData: {
        trackData: [
          {
            trackURL: instrUploadData.readable_url,
            instrumentGroup: "DRUMS_GROUP",
            presenceSetting: "NORMAL",
            panPreference: "CENTRE",
            reverbPreference: "NONE",
          },
          {
            trackURL: vocalUploadData.readable_url,
            instrumentGroup: "VOCAL_GROUP",
            presenceSetting: "LEAD",
            panPreference: "CENTRE",
            reverbPreference: "LOW",
          },
        ],
        musicalStyle: "POP",
        sampleRate: "44100",
        webhookURL: webhookURL,
      },
    };

    console.log("RoEx mix payload:", JSON.stringify(mixPayload));

    const mixResponse = await fetch(`${ROEX_API_BASE}/mixpreview`, {
      method: "POST",
      headers: {
        "X-API-Key": ROEX_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mixPayload),
    });

    if (!mixResponse.ok) {
      const errText = await mixResponse.text();
      console.error("RoEx mixing error:", mixResponse.status, errText);
      throw new Error(`RoEx mixing error: ${mixResponse.status} - ${errText}`);
    }

    const mixResult = await mixResponse.json();
    console.log("RoEx mixing job created:", JSON.stringify(mixResult));

    const mixTaskId = mixResult.multitrack_task_id || mixResult.task_id || mixResult.id;

    if (!mixTaskId) {
      throw new Error("No task ID returned from RoEx mixing");
    }

    // Save task to DB for webhook-based polling
    const { error: insertError } = await supabaseAdmin
      .from("roex_tasks")
      .insert({
        task_id: mixTaskId,
        user_id: userId,
        project_name: projectName || "mixed",
        mode: "mixing",
        status: "processing",
      });

    if (insertError) {
      console.error("Failed to save task to DB:", insertError);
    }

    return new Response(JSON.stringify({
      success: true,
      status: "processing",
      taskId: mixTaskId,
      mode: "mixing",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Error in roex-mix-master:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
