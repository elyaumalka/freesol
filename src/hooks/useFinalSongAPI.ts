import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GenerateIntroOutroParams {
  title: string;
  tags: string;
  type: 'intro' | 'outro';
}

interface TaskStatus {
  status: string;
  audioUrl?: string;
  error?: string;
}

export function useFinalSongAPI() {
  const [isLoading, setIsLoading] = useState(false);
  const [introTaskId, setIntroTaskId] = useState<string | null>(null);
  const [outroTaskId, setOutroTaskId] = useState<string | null>(null);

  // Generate intro or outro
  const generateIntroOutro = async (params: GenerateIntroOutroParams): Promise<string | null> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("יש להתחבר למערכת");
      }

      console.log(`Generating ${params.type}:`, params);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-intro-outro`,
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
        console.error(`Generate ${params.type} error:`, data);
        throw new Error(data.error || `שגיאה ביצירת ${params.type === 'intro' ? 'הפתיח' : 'הסיום'}`);
      }

      console.log(`Generate ${params.type} response:`, data);
      
      if (params.type === 'intro') {
        setIntroTaskId(data.taskId);
      } else {
        setOutroTaskId(data.taskId);
      }
      
      return data.taskId;
    } catch (error: any) {
      console.error(`Error generating ${params.type}:`, error);
      throw error;
    }
  };

  // Check task status
  const checkTaskStatus = async (taskId: string): Promise<TaskStatus> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("יש להתחבר למערכת");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suno-check-status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({ taskId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "שגיאה בבדיקת הסטטוס");
      }

      return await response.json();
    } catch (error: any) {
      console.error("Error checking status:", error);
      throw error;
    }
  };

  // Generate both intro and outro
  const generateBoth = async (
    title: string, 
    tags: string
  ): Promise<{ introTaskId: string | null; outroTaskId: string | null }> => {
    setIsLoading(true);
    
    try {
      const [introId, outroId] = await Promise.all([
        generateIntroOutro({ title, tags, type: 'intro' }),
        generateIntroOutro({ title, tags, type: 'outro' }),
      ]);

      return { introTaskId: introId, outroTaskId: outroId };
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for both intro and outro completion
  const pollForBothComplete = async (
    introId: string,
    outroId: string,
    onComplete: (introUrl: string, outroUrl: string) => void,
    onError: (error: string) => void,
    intervalMs = 5000,
    maxAttempts = 120
  ) => {
    let attempts = 0;
    let introUrl: string | null = null;
    let outroUrl: string | null = null;

    const poll = async () => {
      attempts++;
      
      try {
        // Check intro if not done
        if (!introUrl) {
          const introStatus = await checkTaskStatus(introId);
          if (introStatus.status === "complete" && introStatus.audioUrl) {
            introUrl = introStatus.audioUrl;
            console.log("Intro complete:", introUrl);
          } else if (introStatus.status === "error") {
            onError(introStatus.error || "שגיאה ביצירת הפתיח");
            return;
          }
        }

        // Check outro if not done
        if (!outroUrl) {
          const outroStatus = await checkTaskStatus(outroId);
          if (outroStatus.status === "complete" && outroStatus.audioUrl) {
            outroUrl = outroStatus.audioUrl;
            console.log("Outro complete:", outroUrl);
          } else if (outroStatus.status === "error") {
            onError(outroStatus.error || "שגיאה ביצירת הסיום");
            return;
          }
        }

        // Check if both done
        if (introUrl && outroUrl) {
          onComplete(introUrl, outroUrl);
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, intervalMs);
        } else {
          onError("הזמן הקצוב לתהליך עבר");
        }
      } catch (error: any) {
        console.error("Poll error:", error);
        if (attempts < maxAttempts) {
          setTimeout(poll, intervalMs);
        } else {
          onError(error.message || "שגיאה בבדיקת הסטטוס");
        }
      }
    };

    poll();
  };

  // Merge all parts into final song
  const mergeFinalSong = async (
    introUrl: string | null,
    outroUrl: string | null,
    sectionUrls: string[],
    projectName: string
  ): Promise<string> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("יש להתחבר למערכת");
      }

      console.log("Merging final song:", { introUrl, outroUrl, sectionUrls, projectName });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merge-final-song`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({
            introUrl,
            outroUrl,
            sectionUrls,
            projectName,
          }),
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        console.error("Merge error:", data);
        throw new Error(data.error || "שגיאה במיזוג השיר");
      }

      console.log("Merge response:", data);
      toast.success("השיר המלא נוצר בהצלחה!");
      
      return data.finalSongUrl;
    } catch (error: any) {
      console.error("Error merging song:", error);
      toast.error(error.message || "שגיאה במיזוג השיר");
      throw error;
    }
  };

  return {
    generateIntroOutro,
    generateBoth,
    checkTaskStatus,
    pollForBothComplete,
    mergeFinalSong,
    isLoading,
    introTaskId,
    outroTaskId,
  };
}
