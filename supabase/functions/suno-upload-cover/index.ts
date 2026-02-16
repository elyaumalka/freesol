import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Using upload-cover endpoint which generates a COMPLETE song with AI vocals
// This creates a full song structure (intro, verses, chorus, outro)
const SUNO_API_URL = "https://api.sunoapi.org/api/v1/generate/upload-cover";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUNO_API_KEY = Deno.env.get("SUNO_API_KEY");
    if (!SUNO_API_KEY) {
      throw new Error("SUNO_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    const { 
      audioUrls, // Array of audio URLs to merge (initial user recording)
      title, 
      style, // Music style
      negativeTags,
      vocalGender = "m",
      styleWeight = 0.6,
      audioWeight = 0.65,
      weirdnessConstraint = 0.5,
      model = "V4_5PLUS",
      projectName,
    } = await req.json();

    if (!audioUrls || !Array.isArray(audioUrls) || audioUrls.length === 0) {
      return new Response(JSON.stringify({ error: "Missing audioUrls array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${audioUrls.length} audio files for upload-cover`);

    // Download all audio files
    const audioBuffers: ArrayBuffer[] = [];
    for (const url of audioUrls) {
      try {
        console.log(`Downloading: ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
          console.error(`Failed to download: ${url}`);
          continue;
        }
        const buffer = await response.arrayBuffer();
        audioBuffers.push(buffer);
        console.log(`Downloaded ${buffer.byteLength} bytes`);
      } catch (error) {
        console.error(`Error downloading ${url}:`, error);
      }
    }

    if (audioBuffers.length === 0) {
      return new Response(JSON.stringify({ error: "Failed to download any audio files" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Simple concatenation for audio files
    const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);
    const mergedBuffer = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const buffer of audioBuffers) {
      mergedBuffer.set(new Uint8Array(buffer), offset);
      offset += buffer.byteLength;
    }

    console.log(`Merged buffer size: ${mergedBuffer.byteLength} bytes`);

    // Upload merged file to storage
    const timestamp = Date.now();
    const sanitizedProjectName = (projectName || 'project')
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      || 'project';
    const mergedFileName = `merged/${userId}/${sanitizedProjectName}_${timestamp}.webm`;
    
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('recordings')
      .upload(mergedFileName, mergedBuffer, {
        contentType: 'audio/webm',
        upsert: true
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Failed to upload merged file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get public URL for the merged file (original vocals)
    const { data: urlData } = supabaseAdmin.storage
      .from('recordings')
      .getPublicUrl(mergedFileName);

    const originalVocalsUrl = urlData.publicUrl;
    console.log(`Original vocals uploaded: ${originalVocalsUrl}`);

    // Build callback URL for Suno to notify us when done
    const callBackUrl = `${SUPABASE_URL}/functions/v1/suno-callback`;

    // Call Suno Upload-Cover API - this generates a COMPLETE song with AI vocals
    console.log("Calling Suno upload-cover API...");
    
    const sunoPayload: any = {
      uploadUrl: originalVocalsUrl,
      customMode: true, // Required parameter!
      instrumental: false, // We want vocals, not instrumental only
      title: title || "New Song",
      tags: style || "Jewish Music, Melodic, Traditional, Warm, Acoustic",
      callBackUrl,
      vocalGender,
      styleWeight,
      weirdnessConstraint,
      audioWeight,
      model,
    };

    if (negativeTags) {
      sunoPayload.negativeTags = negativeTags;
    }

    console.log("Suno payload:", JSON.stringify(sunoPayload));

    const sunoResponse = await fetch(SUNO_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUNO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sunoPayload),
    });

    if (!sunoResponse.ok) {
      const errorText = await sunoResponse.text();
      console.error("Suno API error:", sunoResponse.status, errorText);
      return new Response(JSON.stringify({ 
        error: "Failed to call Suno API", 
        details: errorText,
        originalVocalsUrl
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sunoData = await sunoResponse.json();
    console.log("Suno API response:", sunoData);

    const taskId = sunoData.data?.taskId;

    // Create a record in suno_tasks to track this task
    // Store the original vocals URL for later use
    if (taskId) {
      const { error: insertError } = await supabaseAdmin
        .from('suno_tasks')
        .insert({
          task_id: taskId,
          user_id: userId,
          status: 'pending',
          title: title || 'New Song',
          tags: style,
          callback_data: {
            original_vocals_url: originalVocalsUrl, // User's original recording
            flow_type: 'upload-cover', // Mark this as upload-cover flow
          },
        });

      if (insertError) {
        console.error("Error inserting suno_task:", insertError);
      } else {
        console.log(`Created suno_task record for task: ${taskId}`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      taskId,
      originalVocalsUrl,
      message: "Audio sent to Suno for complete song generation. Will analyze structure when complete."
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in suno-upload-cover:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
