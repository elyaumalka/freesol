import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StartGenerationParams {
  audioUrl: string;
  prompt?: string;
  returnInstrumental?: boolean;
}

interface GenerationResult {
  predictionId: string;
  status: string;
  message: string;
}

interface StatusResult {
  status: "processing" | "complete" | "error";
  audioUrl?: string;
  instrumentalUrl?: string;
  error?: string;
  progress?: string;
}

export function useMusicGenRemixer() {
  const [isLoading, setIsLoading] = useState(false);
  const [predictionId, setPredictionId] = useState<string | null>(null);

  const startGeneration = useCallback(async (params: StartGenerationParams): Promise<string | null> => {
    setIsLoading(true);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("יש להתחבר למערכת");
      }

      console.log("Starting MusicGen Remixer generation:", params);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/musicgen-remixer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify(params),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "שגיאה ביצירת מוזיקה");
      }

      console.log("Generation started:", data);
      setPredictionId(data.predictionId);
      
      return data.predictionId;
    } catch (error: any) {
      console.error("Error starting generation:", error);
      toast.error(error.message || "שגיאה ביצירת מוזיקה");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkStatus = useCallback(async (predId: string): Promise<StatusResult> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("יש להתחבר למערכת");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/musicgen-remixer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({ predictionId: predId }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "שגיאה בבדיקת סטטוס");
      }

      return data;
    } catch (error: any) {
      console.error("Error checking status:", error);
      return { status: "error", error: error.message };
    }
  }, []);

  const pollForCompletion = useCallback(async (
    predId: string,
    onComplete: (audioUrl: string, instrumentalUrl?: string) => void,
    onError: (error: string) => void,
    onProgress?: (progress: string) => void,
    intervalMs = 5000,
    maxAttempts = 120 // ~10 minutes max
  ) => {
    let attempts = 0;

    const poll = async () => {
      attempts++;
      
      try {
        const result = await checkStatus(predId);

        if (result.status === "complete" && result.audioUrl) {
          toast.success("המוזיקה נוצרה בהצלחה!");
          onComplete(result.audioUrl, result.instrumentalUrl);
          return;
        } else if (result.status === "error") {
          onError(result.error || "שגיאה ביצירת מוזיקה");
          return;
        } else {
          // Still processing
          if (onProgress && result.progress) {
            onProgress(result.progress);
          }
          
          if (attempts < maxAttempts) {
            setTimeout(poll, intervalMs);
          } else {
            onError("הזמן הקצוב לתהליך עבר");
          }
        }
      } catch (error: any) {
        console.error("Poll error:", error);
        if (attempts < maxAttempts) {
          setTimeout(poll, intervalMs);
        } else {
          onError(error.message || "שגיאה בבדיקת סטטוס");
        }
      }
    };

    poll();
  }, [checkStatus]);

  return {
    startGeneration,
    checkStatus,
    pollForCompletion,
    isLoading,
    predictionId,
  };
}
