import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Download file from URL and upload to Supabase Storage with retry logic
async function downloadAndUploadToStorage(
  sourceUrl: string,
  bucketName: string,
  filePath: string,
  supabase: any,
  maxRetries: number = 3
): Promise<string> {
  console.log(`Downloading file from: ${sourceUrl}`);

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "audio/mpeg";
  const arrayBuffer = await response.arrayBuffer();
  const fileData = new Uint8Array(arrayBuffer);
  const fileSizeMB = (fileData.length / (1024 * 1024)).toFixed(2);

  console.log(`Downloaded ${fileSizeMB}MB, uploading to ${bucketName}/${filePath}`);

  // Retry logic for upload
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Upload attempt ${attempt}/${maxRetries}...`);
      
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, fileData, {
          contentType,
          upsert: true,
        });

      if (error) {
        throw new Error(error.message);
      }

      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      console.log(`File uploaded successfully: ${publicUrlData.publicUrl}`);
      return publicUrlData.publicUrl;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`Upload attempt ${attempt} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  throw new Error(`Failed to upload file after ${maxRetries} attempts: ${lastError?.message}`);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Clone the request body immediately for potential error handling
  const bodyText = await req.text();
  let playbackId: string | null = null;

  try {
    const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!REPLICATE_API_TOKEN) {
      throw new Error("REPLICATE_API_TOKEN not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { playbackId: pbId, audioUrl } = JSON.parse(bodyText);
    playbackId = pbId;

    if (!playbackId || !audioUrl) {
      throw new Error("Missing playbackId or audioUrl");
    }

    console.log("Starting playback processing for:", playbackId);

    // Update status to processing
    await supabase
      .from("playbacks")
      .update({ processing_status: "processing", original_audio_url: audioUrl })
      .eq("id", playbackId);

    // Step 1: Get duration from database and analyze song structure ON THE ORIGINAL SONG (with vocals)
    console.log("Step 1: Analyzing song structure on ORIGINAL song...");
    
    // Read the playback to get the actual duration
    const { data: playbackData } = await supabase
      .from("playbacks")
      .select("duration")
      .eq("id", playbackId)
      .single();
    
    // Parse duration string (format: "MM:SS" or "HH:MM:SS") to seconds
    let durationSeconds = 180; // default
    if (playbackData?.duration) {
      const parts = playbackData.duration.split(':').map(Number);
      if (parts.length === 2) {
        durationSeconds = parts[0] * 60 + parts[1];
      } else if (parts.length === 3) {
        durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
    }
    
    console.log(`Song duration from database: ${durationSeconds} seconds`);
    
    // Analyze structure on the ORIGINAL song (with vocals) for accurate detection
    const analysisResult = await analyzeSongStructure(audioUrl, durationSeconds, REPLICATE_API_TOKEN);
    
    // Use smart structure if analysis fails
    const sections = analysisResult.sections && analysisResult.sections.length > 0 
      ? analysisResult.sections 
      : createSmartStructure(durationSeconds);

    console.log("Song analysis complete. Sections:", sections.length);

    // Step 2: Separate vocals from the entire song
    console.log("Step 2: Starting vocal separation...");
    const separationResult = await separateVocals(audioUrl, REPLICATE_API_TOKEN);
    
    if (!separationResult.instrumentalUrl) {
      throw new Error("Failed to separate vocals from song");
    }

    console.log("Vocal separation complete. Replicate URL:", separationResult.instrumentalUrl);

    // Step 2.5: Download instrumental from Replicate and upload to our storage
    console.log("Step 2.5: Uploading instrumental to permanent storage...");
    const storagePath = `processed/${playbackId}_instrumental_${Date.now()}.mp3`;
    const permanentInstrumentalUrl = await downloadAndUploadToStorage(
      separationResult.instrumentalUrl,
      "playbacks",
      storagePath,
      supabase
    );
    console.log("Instrumental uploaded to storage:", permanentInstrumentalUrl);

    // Step 3: For each section, create instrumental version
    // We'll store the timestamps - the instrumental is already the full song without vocals
    // Users will play specific sections from the full instrumental
    const sectionsWithData = sections.map((section: any) => ({
      ...section,
      instrumentalUrl: permanentInstrumentalUrl, // Use permanent URL
    }));

    // Update playback with processed data
    const { error: updateError } = await supabase
      .from("playbacks")
      .update({
        instrumental_url: permanentInstrumentalUrl,
        audio_url: permanentInstrumentalUrl, // Replace audio_url with permanent instrumental for search preview
        sections: sectionsWithData,
        processing_status: "completed",
      })
      .eq("id", playbackId);

    if (updateError) {
      throw new Error(`Failed to update playback: ${updateError.message}`);
    }

    console.log("Playback processing completed successfully!");

    return new Response(
      JSON.stringify({
        success: true,
        instrumentalUrl: permanentInstrumentalUrl,
        sections: sectionsWithData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error processing playback:", error);
    
    // Try to update status to failed
    if (playbackId) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabase
          .from("playbacks")
          .update({ processing_status: "failed" })
          .eq("id", playbackId);
      } catch (e) {
        console.error("Failed to update status:", e);
      }
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Separate vocals using Demucs
async function separateVocals(audioUrl: string, apiToken: string): Promise<{ instrumentalUrl: string | null }> {
  console.log("Starting Demucs vocal separation...");

  // Start the prediction - using same version as separate-vocals function
  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiToken}`,
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
    const error = await response.text();
    throw new Error(`Failed to start vocal separation: ${error}`);
  }

  const prediction = await response.json();
  console.log("Separation started, prediction ID:", prediction.id);

  // Poll for completion
  const result = await pollForCompletion(prediction.id, apiToken, 120);
  
  // Demucs output format can vary - handle different cases
  if (result.output) {
    if (typeof result.output === 'object' && !Array.isArray(result.output)) {
      // Object format: { vocals: url, no_vocals: url }
      const instrumentalUrl = result.output.no_vocals || 
                              result.output.accompaniment || 
                              result.output.instrumental ||
                              result.output.other;
      if (instrumentalUrl) {
        return { instrumentalUrl };
      }
    } else if (Array.isArray(result.output) && result.output.length >= 2) {
      // Array format: [vocals, no_vocals]
      return { instrumentalUrl: result.output[1] };
    } else if (typeof result.output === 'string') {
      return { instrumentalUrl: result.output };
    }
  }
  
  throw new Error("Unexpected output format from vocal separation");
}

// Analyze song structure using Replicate all-in-one model
async function analyzeSongStructure(audioUrl: string, totalDuration: number, apiToken: string): Promise<{ sections: any[] }> {
  console.log("Starting song structure analysis with Replicate...");

  const REPLICATE_MODEL_VERSION = "001b4137be6ac67bdc28cb5cffacf128b874f530258d033de23121e785cb7290";

  try {
    // Start the prediction
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: REPLICATE_MODEL_VERSION,
        input: {
          music_input: audioUrl,
          sonify: false,
          visualize: false,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Replicate API error:", response.status, errorText);
      return { sections: [] };
    }

    const prediction = await response.json();
    console.log("Structure analysis started, prediction ID:", prediction.id);

    // Poll for completion (max 2 minutes - same as user upload)
    const result = await pollForCompletion(prediction.id, apiToken, 120);

    if (!result.output) {
      console.log("No output from structure analysis");
      return { sections: [] };
    }

    console.log("Replicate output:", JSON.stringify(result.output));

    // Parse the output
    const sections = await parseReplicateOutput(result.output, totalDuration);
    return { sections };
  } catch (error) {
    console.error("Structure analysis error:", error);
    return { sections: [] };
  }
}

// Parse Replicate all-in-one model output
async function parseReplicateOutput(output: any, totalDuration: number): Promise<any[]> {
  const HARMONIX_LABELS = ['start', 'end', 'intro', 'outro', 'break', 'bridge', 'inst', 'solo', 'verse', 'chorus'];
  
  const labelMap: Record<string, { type: string; label: string }> = {
    "intro": { type: "intro", label: "פתיח" },
    "verse": { type: "verse", label: "בית" },
    "chorus": { type: "chorus", label: "פזמון" },
    "bridge": { type: "bridge", label: "ברידג׳" },
    "outro": { type: "outro", label: "סיום" },
    "end": { type: "outro", label: "סיום" },
    "inst": { type: "verse", label: "בית" },
    "solo": { type: "verse", label: "בית" },
    "break": { type: "verse", label: "בית" },
    "start": { type: "intro", label: "פתיח" },
  };

  try {
    let analysisData: any = null;

    // Output is typically an array with a JSON file URL
    if (Array.isArray(output)) {
      for (const item of output) {
        const url = typeof item === 'string' ? item : item?.url?.() || item;
        if (typeof url === 'string' && url.includes('.json')) {
          const response = await fetch(url);
          if (response.ok) {
            analysisData = await response.json();
            break;
          }
        }
      }
      
      // Try first item if no JSON found
      if (!analysisData && output.length > 0) {
        const firstUrl = typeof output[0] === 'string' ? output[0] : String(output[0]);
        if (firstUrl) {
          try {
            const response = await fetch(firstUrl);
            if (response.ok) {
              const text = await response.text();
              try {
                analysisData = JSON.parse(text);
              } catch {
                console.log("First output is not JSON");
              }
            }
          } catch (fetchError) {
            console.error("Error fetching output:", fetchError);
          }
        }
      }
    } else if (typeof output === 'object') {
      analysisData = output;
    }

    if (!analysisData) {
      console.log("No analysis data found in output");
      return [];
    }

    console.log("Analysis data keys:", Object.keys(analysisData));

    const rawSections: any[] = [];

    // Parse segment and label activations
    if (analysisData.segment && analysisData.label) {
      console.log("Found segment and label activations");
      
      const segmentActivations = analysisData.segment;
      const labelActivations = analysisData.label;
      const numTimeSteps = segmentActivations.length;
      const timeStepDuration = totalDuration / numTimeSteps;
      
      console.log(`Time steps: ${numTimeSteps}, step duration: ${timeStepDuration.toFixed(3)}s`);
      
      // Find segment boundaries
      const threshold = 0.5;
      const boundaries: number[] = [0];
      
      for (let i = 1; i < segmentActivations.length - 1; i++) {
        const activation = segmentActivations[i];
        if (activation > threshold && 
            activation >= segmentActivations[i-1] && 
            activation >= segmentActivations[i+1]) {
          const timeInSeconds = i * timeStepDuration;
          if (boundaries.length === 0 || timeInSeconds - boundaries[boundaries.length - 1] > 5) {
            boundaries.push(timeInSeconds);
          }
        }
      }
      boundaries.push(totalDuration);
      
      console.log(`Found ${boundaries.length} boundaries`);
      
      // For each segment, find the dominant label
      for (let i = 0; i < boundaries.length - 1; i++) {
        const startTime = boundaries[i];
        const endTime = boundaries[i + 1];
        const startStep = Math.floor(startTime / timeStepDuration);
        const endStep = Math.min(Math.floor(endTime / timeStepDuration), numTimeSteps - 1);
        
        const labelSums = new Array(10).fill(0);
        for (let step = startStep; step <= endStep; step++) {
          for (let labelIdx = 0; labelIdx < 10; labelIdx++) {
            if (labelActivations[labelIdx] && labelActivations[labelIdx][step] !== undefined) {
              labelSums[labelIdx] += labelActivations[labelIdx][step];
            }
          }
        }
        
        let maxIdx = 2;
        let maxVal = 0;
        for (let labelIdx = 2; labelIdx < 10; labelIdx++) {
          if (labelSums[labelIdx] > maxVal) {
            maxVal = labelSums[labelIdx];
            maxIdx = labelIdx;
          }
        }
        
        const rawLabel = HARMONIX_LABELS[maxIdx] || 'verse';
        const mapped = labelMap[rawLabel] || { type: "verse", label: "בית" };
        
        rawSections.push({
          type: mapped.type,
          label: mapped.label,
          startTime: Math.round(startTime * 10) / 10,
          endTime: Math.round(endTime * 10) / 10,
          duration: Math.round((endTime - startTime) * 10) / 10,
        });
      }
    }
    // Try other formats
    else if (analysisData.segments && Array.isArray(analysisData.segments)) {
      for (const seg of analysisData.segments) {
        const startTime = seg.start ?? seg.startTime ?? 0;
        const endTime = seg.end ?? seg.endTime ?? startTime + 30;
        const rawLabel = (seg.label ?? seg.type ?? "verse").toLowerCase();
        const mapped = labelMap[rawLabel] || { type: "verse", label: "בית" };
        
        rawSections.push({
          type: mapped.type,
          label: mapped.label,
          startTime: Number(startTime),
          endTime: Number(endTime),
          duration: Number(endTime) - Number(startTime),
        });
      }
    }

    if (rawSections.length > 0) {
      rawSections.sort((a, b) => a.startTime - b.startTime);
      // Merge consecutive sections with the same type (like user upload flow)
      const mergedSections = mergeConsecutiveSections(rawSections);
      return addSectionNumbering(mergedSections);
    }

    return [];
  } catch (parseError) {
    console.error("Error parsing Replicate output:", parseError);
    return [];
  }
}

// Merge consecutive sections with the same type (to reduce fragment count)
function mergeConsecutiveSections(sections: any[]): any[] {
  if (sections.length === 0) return sections;
  
  const merged: any[] = [];
  let current = { ...sections[0] };
  
  for (let i = 1; i < sections.length; i++) {
    const next = sections[i];
    
    // If same type and consecutive (within 1 second gap), merge
    if (next.type === current.type && (next.startTime - current.endTime) < 1) {
      current.endTime = next.endTime;
      current.duration = current.endTime - current.startTime;
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  
  merged.push(current);
  return merged;
}

// Add ordinal numbering to sections
function addSectionNumbering(sections: any[]): any[] {
  const ordinals = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי', 'שמיני'];
  const typeCounters: Record<string, number> = {};
  const typeTotals: Record<string, number> = {};
  
  for (const sec of sections) {
    typeTotals[sec.type] = (typeTotals[sec.type] || 0) + 1;
  }
  
  return sections.map(sec => {
    typeCounters[sec.type] = (typeCounters[sec.type] || 0) + 1;
    const count = typeCounters[sec.type];
    const total = typeTotals[sec.type];
    
    let label = sec.label;
    if (total > 1 && count <= ordinals.length) {
      label = `${sec.label} ${ordinals[count - 1]}`;
    }
    
    return { ...sec, label };
  });
}

// Create smart structure based on song duration
function createSmartStructure(totalDuration: number): any[] {
  const sections: any[] = [];
  
  // Short songs (under 2 min)
  if (totalDuration < 120) {
    const introLen = Math.min(8, totalDuration * 0.08);
    const outroLen = Math.min(8, totalDuration * 0.08);
    const bodyDuration = totalDuration - introLen - outroLen;
    const sectionLen = bodyDuration / 2;
    
    return [
      { type: "intro", label: "פתיח", startTime: 0, endTime: introLen, duration: introLen },
      { type: "verse", label: "בית ראשון", startTime: introLen, endTime: introLen + sectionLen, duration: sectionLen },
      { type: "chorus", label: "פזמון ראשון", startTime: introLen + sectionLen, endTime: totalDuration - outroLen, duration: sectionLen },
      { type: "outro", label: "סיום", startTime: totalDuration - outroLen, endTime: totalDuration, duration: outroLen }
    ];
  }
  
  // Medium songs (2-4 min)
  if (totalDuration < 240) {
    const introLen = 10;
    const outroLen = 10;
    const bodyDuration = totalDuration - introLen - outroLen;
    const sectionLen = bodyDuration / 4;
    
    let t = 0;
    sections.push({ type: "intro", label: "פתיח", startTime: t, endTime: t + introLen, duration: introLen });
    t += introLen;
    sections.push({ type: "verse", label: "בית ראשון", startTime: t, endTime: t + sectionLen, duration: sectionLen });
    t += sectionLen;
    sections.push({ type: "chorus", label: "פזמון ראשון", startTime: t, endTime: t + sectionLen, duration: sectionLen });
    t += sectionLen;
    sections.push({ type: "verse", label: "בית שני", startTime: t, endTime: t + sectionLen, duration: sectionLen });
    t += sectionLen;
    sections.push({ type: "chorus", label: "פזמון שני", startTime: t, endTime: t + sectionLen, duration: sectionLen });
    t += sectionLen;
    sections.push({ type: "outro", label: "סיום", startTime: t, endTime: totalDuration, duration: totalDuration - t });
    
    return sections;
  }
  
  // Long songs (4+ min)
  const introLen = 12;
  const outroLen = 12;
  const bridgeLen = 20;
  const bodyDuration = totalDuration - introLen - outroLen - bridgeLen;
  const sectionLen = bodyDuration / 5;
  
  let t = 0;
  sections.push({ type: "intro", label: "פתיח", startTime: t, endTime: t + introLen, duration: introLen });
  t += introLen;
  sections.push({ type: "verse", label: "בית ראשון", startTime: t, endTime: t + sectionLen, duration: sectionLen });
  t += sectionLen;
  sections.push({ type: "chorus", label: "פזמון ראשון", startTime: t, endTime: t + sectionLen, duration: sectionLen });
  t += sectionLen;
  sections.push({ type: "verse", label: "בית שני", startTime: t, endTime: t + sectionLen, duration: sectionLen });
  t += sectionLen;
  sections.push({ type: "chorus", label: "פזמון שני", startTime: t, endTime: t + sectionLen, duration: sectionLen });
  t += sectionLen;
  sections.push({ type: "bridge", label: "ברידג׳", startTime: t, endTime: t + bridgeLen, duration: bridgeLen });
  t += bridgeLen;
  sections.push({ type: "chorus", label: "פזמון שלישי", startTime: t, endTime: t + sectionLen, duration: sectionLen });
  t += sectionLen;
  sections.push({ type: "outro", label: "סיום", startTime: t, endTime: totalDuration, duration: totalDuration - t });
  
  return sections;
}

// Poll for Replicate prediction completion with retry logic for network errors
async function pollForCompletion(predictionId: string, apiToken: string, maxAttempts: number = 60): Promise<any> {
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

    try {
      const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { Authorization: `Token ${apiToken}` },
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const prediction = await response.json();
      console.log(`Poll ${i + 1}/${maxAttempts}: Status = ${prediction.status}`);
      
      // Reset error counter on successful request
      consecutiveErrors = 0;

      if (prediction.status === "succeeded") {
        return prediction;
      }

      if (prediction.status === "failed" || prediction.status === "canceled") {
        throw new Error(`Prediction ${prediction.status}: ${prediction.error || "Unknown error"}`);
      }
    } catch (error) {
      consecutiveErrors++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Poll ${i + 1}/${maxAttempts}: Network error (${consecutiveErrors}/${maxConsecutiveErrors}): ${errorMessage}`);
      
      // If too many consecutive errors, throw
      if (consecutiveErrors >= maxConsecutiveErrors) {
        throw new Error(`Too many consecutive network errors: ${errorMessage}`);
      }
      
      // Wait a bit longer before retry on network error
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  throw new Error("Polling timeout - prediction did not complete in time");
}
