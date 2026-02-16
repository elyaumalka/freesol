import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ProfessionalMixOptions {
  vocalUrl: string;
  instrumentalUrl: string;
  projectName?: string;
}

interface ProfessionalMixResult {
  cleanVocalUrl: string;
  mixedUrl: string;
}

export function useProfessionalMix() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const abortRef = useRef(false);

  const pollJob = useCallback(async (
    endpoint: string,
    body: Record<string, any>,
    maxAttempts = 60,
    intervalMs = 5000
  ) => {
    for (let i = 0; i < maxAttempts; i++) {
      if (abortRef.current) throw new Error("Aborted");
      
      await new Promise(r => setTimeout(r, intervalMs));

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `Poll failed: ${response.status}`);
      }

      const result = await response.json();

      if (result.status === "succeeded") return result;
      if (result.status === "failed") throw new Error(result.error || "Processing failed");
      // Still processing, continue polling
    }

    throw new Error("Processing timed out");
  }, []);

  const startProfessionalMix = useCallback(async (
    options: ProfessionalMixOptions
  ): Promise<ProfessionalMixResult> => {
    abortRef.current = false;
    setIsProcessing(true);
    setProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error("Not authenticated");

      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      };

      // ===== STEP 1: Kits.ai Vocal Cleanup =====
      setStatusMessage("מנקה את הקול עם Kits.ai...");
      setProgress(10);

      const kitsStartResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kits-vocal-cleanup`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            audioUrl: options.vocalUrl,
            projectName: options.projectName,
          }),
        }
      );

      if (!kitsStartResponse.ok) {
        const err = await kitsStartResponse.json();
        console.error("Kits start failed:", err);
        throw new Error(err.error || "Kits vocal cleanup failed to start");
      }

      const kitsStart = await kitsStartResponse.json();
      console.log("Kits job started:", kitsStart.jobId);

      // Poll Kits.ai
      setStatusMessage("Kits.ai מעבד את הקול... זה לוקח כדקה");
      setProgress(20);

      const kitsResult = await pollJob("kits-vocal-cleanup", {
        jobId: kitsStart.jobId,
        projectName: options.projectName,
      }, 40, 5000);

      const cleanVocalUrl = kitsResult.cleanVocalUrl;
      console.log("Kits cleanup done:", cleanVocalUrl);

      // ===== STEP 2: RoEx Multitrack Mix =====
      setStatusMessage("RoEx Tonn מערבב קול עם פלייבק...");
      setProgress(50);

      const roexStartResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/roex-mix-master`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            vocalUrl: cleanVocalUrl,
            instrumentalUrl: options.instrumentalUrl,
            projectName: options.projectName,
          }),
        }
      );

      if (!roexStartResponse.ok) {
        const err = await roexStartResponse.json();
        console.error("RoEx start failed:", err);
        throw new Error(err.error || "RoEx mixing failed to start");
      }

      const roexStart = await roexStartResponse.json();
      console.log("RoEx task started:", roexStart.taskId);

      // Poll RoEx
      setStatusMessage("RoEx Tonn יוצר מיקס מקצועי... כ-2 דקות");
      setProgress(65);

      const roexResult = await pollJob("roex-mix-master", {
        taskId: roexStart.taskId,
        mode: roexStart.mode,
        projectName: options.projectName,
      }, 40, 5000);

      const mixedUrl = roexResult.outputUrl;
      console.log("RoEx mix done:", mixedUrl);

      setStatusMessage("השיר מוכן! 🎵");
      setProgress(100);

      return { cleanVocalUrl, mixedUrl };
    } finally {
      setIsProcessing(false);
    }
  }, [pollJob]);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  return {
    startProfessionalMix,
    isProcessing,
    statusMessage,
    progress,
    abort,
  };
}
