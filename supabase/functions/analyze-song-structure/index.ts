import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";

// sakemin/all-in-one-music-structure-analyzer model
const REPLICATE_MODEL_VERSION = "001b4137be6ac67bdc28cb5cffacf128b874f530258d033de23121e785cb7290";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
    if (!REPLICATE_API_TOKEN) {
      throw new Error("REPLICATE_API_TOKEN is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { audioUrl, duration, title } = await req.json();

    if (!audioUrl) {
      return new Response(JSON.stringify({ error: "Missing audioUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Analyzing song structure for: ${audioUrl}, duration: ${duration}s`);

    // Step 1: Create prediction with all-in-one model
    const createResponse = await fetch(REPLICATE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
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

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("Replicate API error:", createResponse.status, errorText);
      
      // Fallback to default structure
      const fallbackSections = createDefaultStructure(duration || 180);
      return new Response(JSON.stringify({ 
        success: true,
        sections: fallbackSections,
        source: "fallback",
        error: `Replicate API error: ${createResponse.status}`
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let prediction = await createResponse.json();
    console.log("Initial prediction:", JSON.stringify(prediction));

    // Step 2: Poll for result (model can take 30-60 seconds)
    let attempts = 0;
    const maxAttempts = 120; // Max 2 minutes polling
    
    while (prediction.status !== "succeeded" && prediction.status !== "failed" && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const pollResponse = await fetch(`${REPLICATE_API_URL}/${prediction.id}`, {
        headers: {
          "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
        },
      });
      
      if (!pollResponse.ok) {
        console.error("Polling error:", pollResponse.status);
        break;
      }
      
      prediction = await pollResponse.json();
      attempts++;
      
      if (attempts % 10 === 0) {
        console.log(`Poll attempt ${attempts}: status = ${prediction.status}`);
      }
    }

    if (prediction.status !== "succeeded" || !prediction.output) {
      console.error("Prediction failed or timed out:", JSON.stringify(prediction));
      const fallbackSections = createDefaultStructure(duration || 180);
      return new Response(JSON.stringify({ 
        success: true,
        sections: fallbackSections,
        source: "fallback",
        error: `Prediction status: ${prediction.status}`
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Replicate output:", JSON.stringify(prediction.output));

    // Step 3: Fetch the JSON output file
    const sections = await parseReplicateOutput(prediction.output, duration || 180);
    
    console.log(`Analyzed ${sections.length} sections from all-in-one model`);

    return new Response(JSON.stringify({ 
      success: true,
      sections: sections,
      source: sections.length > 0 ? "replicate" : "fallback"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in analyze-song-structure:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Parse all-in-one model output
async function parseReplicateOutput(output: any, totalDuration: number) {
  try {
    // Output is typically an array with a JSON file URL
    let analysisData: any = null;
    
    if (Array.isArray(output)) {
      // Find the JSON output (not visualization)
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
      
      // If no JSON found, try first item
      if (!analysisData && output.length > 0) {
        const firstUrl = typeof output[0] === 'string' ? output[0] : output[0]?.url?.() || String(output[0]);
        if (firstUrl) {
          try {
            const response = await fetch(firstUrl);
            if (response.ok) {
              const text = await response.text();
              try {
                analysisData = JSON.parse(text);
              } catch {
                console.log("First output is not JSON:", text.substring(0, 200));
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
      return createDefaultStructure(totalDuration);
    }

    console.log("Analysis data keys:", Object.keys(analysisData));

    // HARMONIX_LABELS from the model
    const HARMONIX_LABELS = ['start', 'end', 'intro', 'outro', 'break', 'bridge', 'inst', 'solo', 'verse', 'chorus'];
    
    // Map model labels to Hebrew
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

    const rawSections: any[] = [];

    // NEW: Parse all-in-one model format with segment activations and label activations
    // segment: array of boundary activations [time_steps]
    // label: 2D array [label_class=10, time_steps] with softmax probabilities
    if (analysisData.segment && analysisData.label) {
      console.log("Found segment and label activations");
      
      const segmentActivations = analysisData.segment; // [time_steps]
      const labelActivations = analysisData.label; // [10, time_steps]
      
      // Calculate time step size based on beats or estimate from duration
      // The model typically uses 22050 Hz sample rate with 4096 hop size
      // So each time step is about 0.186 seconds
      const numTimeSteps = segmentActivations.length;
      const timeStepDuration = totalDuration / numTimeSteps;
      
      console.log(`Time steps: ${numTimeSteps}, step duration: ${timeStepDuration.toFixed(3)}s`);
      
      // Find segment boundaries (peaks in segment activations above threshold)
      const threshold = 0.5;
      const boundaries: number[] = [0]; // Start with 0
      
      for (let i = 1; i < segmentActivations.length - 1; i++) {
        const activation = segmentActivations[i];
        // Local peak above threshold
        if (activation > threshold && 
            activation >= segmentActivations[i-1] && 
            activation >= segmentActivations[i+1]) {
          const timeInSeconds = i * timeStepDuration;
          // Avoid boundaries too close together (less than 5 seconds)
          if (boundaries.length === 0 || timeInSeconds - boundaries[boundaries.length - 1] > 5) {
            boundaries.push(timeInSeconds);
          }
        }
      }
      boundaries.push(totalDuration); // End with total duration
      
      console.log(`Found ${boundaries.length} boundaries: ${boundaries.map(b => b.toFixed(1)).join(', ')}`);
      
      // For each segment, find the dominant label
      for (let i = 0; i < boundaries.length - 1; i++) {
        const startTime = boundaries[i];
        const endTime = boundaries[i + 1];
        
        // Get time step range for this segment
        const startStep = Math.floor(startTime / timeStepDuration);
        const endStep = Math.min(Math.floor(endTime / timeStepDuration), numTimeSteps - 1);
        
        // Average label activations over this segment
        const labelSums = new Array(10).fill(0);
        let stepCount = 0;
        
        for (let step = startStep; step <= endStep; step++) {
          for (let labelIdx = 0; labelIdx < 10; labelIdx++) {
            if (labelActivations[labelIdx] && labelActivations[labelIdx][step] !== undefined) {
              labelSums[labelIdx] += labelActivations[labelIdx][step];
            }
          }
          stepCount++;
        }
        
        // Find dominant label (skip 'start' index 0 and 'end' index 1)
        let maxIdx = 2; // Default to 'intro'
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
          startTime: startTime,
          endTime: endTime,
          duration: endTime - startTime,
        });
      }
      
      console.log(`Parsed ${rawSections.length} sections from segment/label activations`);
    }
    // Fallback: Try other output formats
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
    } else if (analysisData.boundaries && analysisData.labels) {
      const boundaries = analysisData.boundaries;
      const labels = analysisData.labels;
      
      for (let i = 0; i < labels.length && i < boundaries.length - 1; i++) {
        const rawLabel = (labels[i] ?? "verse").toLowerCase();
        const mapped = labelMap[rawLabel] || { type: "verse", label: "בית" };
        
        rawSections.push({
          type: mapped.type,
          label: mapped.label,
          startTime: Number(boundaries[i]),
          endTime: Number(boundaries[i + 1]),
          duration: Number(boundaries[i + 1]) - Number(boundaries[i]),
        });
      }
    } else if (analysisData.beats && Array.isArray(analysisData.beats)) {
      console.log(`Model returned only beats (${analysisData.beats.length}), using smart structure`);
      return createSmartStructure(totalDuration, analysisData.bpm || 120);
    }

    if (rawSections.length > 0) {
      rawSections.sort((a, b) => a.startTime - b.startTime);
      const mergedSections = mergeConsecutiveSections(rawSections);
      const numberedSections = addSectionNumbering(mergedSections);
      
      console.log(`Final: ${rawSections.length} raw -> ${mergedSections.length} merged -> ${numberedSections.length} numbered`);
      
      return numberedSections;
    }

    // Fallback
    console.log("No parseable sections found, using smart structure");
    return createSmartStructure(totalDuration, analysisData.bpm || 120);

  } catch (parseError) {
    console.error("Error parsing Replicate output:", parseError);
    return createDefaultStructure(totalDuration);
  }
}

// Merge consecutive sections with the same type
function mergeConsecutiveSections(sections: any[]) {
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

// Add ordinal numbering to sections (בית ראשון, פזמון שני, etc.)
function addSectionNumbering(sections: any[]) {
  const ordinals = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי', 'שמיני'];
  const typeCounters: Record<string, number> = {};
  const typeTotals: Record<string, number> = {};
  
  // Count totals first
  for (const sec of sections) {
    typeTotals[sec.type] = (typeTotals[sec.type] || 0) + 1;
  }
  
  return sections.map(sec => {
    typeCounters[sec.type] = (typeCounters[sec.type] || 0) + 1;
    const count = typeCounters[sec.type];
    const total = typeTotals[sec.type];
    
    // Only add numbering if there are multiple of this type
    let label = sec.label;
    if (total > 1 && count <= ordinals.length) {
      label = `${sec.label} ${ordinals[count - 1]}`;
    }
    
    return { ...sec, label };
  });
}

function findLabelMapping(rawLabel: string, labelMap: Record<string, { type: string; label: string }>) {
  // Direct match
  if (labelMap[rawLabel]) {
    return labelMap[rawLabel];
  }
  
  // Partial match
  for (const [key, value] of Object.entries(labelMap)) {
    if (rawLabel.includes(key) || key.includes(rawLabel)) {
      return value;
    }
  }
  
  // Default to verse
  return { type: "verse", label: "בית" };
}

// Create smart structure based on song duration and BPM
// Typical pop song structure: Intro - Verse - Chorus - Verse - Chorus - Bridge - Chorus - Outro
function createSmartStructure(totalDuration: number, bpm: number = 120) {
  const sections: any[] = [];
  
  // Calculate typical section lengths based on BPM
  // 4 bars at given BPM = 4 * 4 beats / (bpm/60) seconds
  const barsToSeconds = (bars: number) => (bars * 4 * 60) / bpm;
  
  // Short songs (under 2 min) - simple structure
  if (totalDuration < 120) {
    const introEnd = Math.min(barsToSeconds(4), totalDuration * 0.1);
    const outroStart = totalDuration - Math.min(barsToSeconds(4), totalDuration * 0.1);
    const middleDuration = outroStart - introEnd;
    const verseEnd = introEnd + middleDuration * 0.5;
    
    return [
      { type: "intro", label: "פתיח", startTime: 0, endTime: introEnd, duration: introEnd },
      { type: "verse", label: "בית", startTime: introEnd, endTime: verseEnd, duration: verseEnd - introEnd },
      { type: "chorus", label: "פזמון", startTime: verseEnd, endTime: outroStart, duration: outroStart - verseEnd },
      { type: "outro", label: "סיום", startTime: outroStart, endTime: totalDuration, duration: totalDuration - outroStart }
    ];
  }
  
  // Medium songs (2-4 min) - verse-chorus-verse-chorus structure
  if (totalDuration < 240) {
    const introLen = Math.min(barsToSeconds(4), 15);
    const outroLen = Math.min(barsToSeconds(4), 15);
    const sectionLen = (totalDuration - introLen - outroLen) / 4;
    
    let t = 0;
    sections.push({ type: "intro", label: "פתיח", startTime: t, endTime: t + introLen, duration: introLen });
    t += introLen;
    sections.push({ type: "verse", label: "בית ראשון", startTime: t, endTime: t + sectionLen, duration: sectionLen });
    t += sectionLen;
    sections.push({ type: "chorus", label: "פזמון ראשון", startTime: t, endTime: t + sectionLen, duration: sectionLen });
    t += sectionLen;
    sections.push({ type: "verse", label: "בית שני", startTime: t, endTime: t + sectionLen, duration: sectionLen });
    t += sectionLen;
    sections.push({ type: "chorus", label: "פזמון שני", startTime: t, endTime: totalDuration - outroLen, duration: totalDuration - outroLen - t });
    sections.push({ type: "outro", label: "סיום", startTime: totalDuration - outroLen, endTime: totalDuration, duration: outroLen });
    
    return sections;
  }
  
  // Long songs (4+ min) - full structure with bridge
  const introLen = Math.min(barsToSeconds(4), 15);
  const outroLen = Math.min(barsToSeconds(4), 20);
  const bridgeLen = Math.min(barsToSeconds(8), 30);
  const remainingTime = totalDuration - introLen - outroLen - bridgeLen;
  const sectionLen = remainingTime / 5; // 2 verses + 3 choruses
  
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
  sections.push({ type: "chorus", label: "פזמון שלישי", startTime: t, endTime: totalDuration - outroLen, duration: totalDuration - outroLen - t });
  sections.push({ type: "outro", label: "סיום", startTime: totalDuration - outroLen, endTime: totalDuration, duration: outroLen });
  
  return sections;
}

// Simple fallback
function createDefaultStructure(totalDuration: number) {
  return createSmartStructure(totalDuration, 120);
}
