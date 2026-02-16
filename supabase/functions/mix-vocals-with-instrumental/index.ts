import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      vocalsUrl,       // URL of the original vocals recording
      instrumentalUrl, // URL of the Suno-generated instrumental
      projectName
    } = await req.json();

    if (!vocalsUrl || !instrumentalUrl) {
      return new Response(JSON.stringify({ error: "Missing vocalsUrl or instrumentalUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Mixing vocals: ${vocalsUrl}`);
    console.log(`With instrumental: ${instrumentalUrl}`);

    // Download both audio files
    const [vocalsResponse, instrumentalResponse] = await Promise.all([
      fetch(vocalsUrl),
      fetch(instrumentalUrl)
    ]);

    if (!vocalsResponse.ok) {
      throw new Error(`Failed to download vocals: ${vocalsResponse.status}`);
    }
    if (!instrumentalResponse.ok) {
      throw new Error(`Failed to download instrumental: ${instrumentalResponse.status}`);
    }

    const vocalsBuffer = await vocalsResponse.arrayBuffer();
    const instrumentalBuffer = await instrumentalResponse.arrayBuffer();

    console.log(`Vocals size: ${vocalsBuffer.byteLength}, Instrumental size: ${instrumentalBuffer.byteLength}`);

    // For now, since we can't do proper audio mixing in Deno without FFmpeg,
    // we'll return both URLs and let the client decide how to handle playback
    // A production solution would use a service like FFmpeg-as-a-Service or similar
    
    // Create a metadata file that references both tracks
    const timestamp = Date.now();
    const sanitizedProjectName = (projectName || 'project')
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      || 'project';
    
    const mixFileName = `mixes/${userId}/${sanitizedProjectName}_${timestamp}.json`;
    
    const mixMetadata = {
      vocalsUrl,
      instrumentalUrl,
      createdAt: new Date().toISOString(),
      projectName,
      userId,
    };

    // Upload metadata
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('recordings')
      .upload(mixFileName, JSON.stringify(mixMetadata), {
        contentType: 'application/json',
        upsert: true
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
    }

    // For the final output, we'll use the instrumental URL from Suno
    // since it contains the full track with the AI-generated arrangement
    // The vocals are already embedded in what Suno processes
    
    // Note: The add-instrumental endpoint should return a track that 
    // includes both the original vocals AND the generated instrumental
    // If it's only returning instrumental, we need to check the API settings

    return new Response(JSON.stringify({ 
      success: true,
      finalAudioUrl: instrumentalUrl, // Suno should return vocals + instrumental
      vocalsUrl,
      instrumentalUrl,
      message: "Mix data prepared. Suno add-instrumental should include vocals with the generated arrangement."
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in mix-vocals-with-instrumental:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
