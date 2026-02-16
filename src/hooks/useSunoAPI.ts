import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AddInstrumentalParams {
  uploadUrl: string;
  title: string;
  tags?: string;
  negativeTags?: string;
  vocalGender?: "m" | "f";
  styleWeight?: number;
  audioWeight?: number;
  weirdnessConstraint?: number;
  projectId?: string;
}

interface MergeAndGenerateParams {
  audioUrls: string[];
  title: string;
  style?: string; // Music style like "Jewish Music, Acoustic, Warm"
  prompt?: string; // Lyrics if needed
  negativeTags?: string;
  vocalGender?: "m" | "f";
  projectName?: string;
}

interface SunoTaskStatus {
  status: string;
  audioUrl?: string;
  instrumentalUrl?: string;
  vocalsUrl?: string;
  error?: string;
}

export function useSunoAPI() {
  const [isLoading, setIsLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<SunoTaskStatus | null>(null);

  const addInstrumental = async (params: AddInstrumentalParams) => {
    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("יש להתחבר למערכת");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suno-add-instrumental`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify(params),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "שגיאה ביצירת המוזיקה");
      }

      const data = await response.json();
      setTaskId(data.taskId);
      toast.success("יצירת הפלייבק התחילה!");
      return data;
    } catch (error: any) {
      console.error("Error adding instrumental:", error);
      toast.error(error.message || "שגיאה ביצירת הפלייבק");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const mergeAndGenerate = async (params: MergeAndGenerateParams) => {
    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("יש להתחבר למערכת");
      }

      console.log("Calling merge-and-generate with:", params);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merge-and-generate`,
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
        console.error("Merge and generate error:", data);
        throw new Error(data.error || "שגיאה במיזוג ויצירת המוזיקה");
      }

      console.log("Merge and generate response:", data);
      setTaskId(data.taskId);
      toast.success("ההקלטות מוזגו ונשלחו ל-Suno!");
      return data;
    } catch (error: any) {
      console.error("Error in merge and generate:", error);
      toast.error(error.message || "שגיאה במיזוג ויצירת הפלייבק");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const checkStatus = async (taskIdToCheck?: string) => {
    const id = taskIdToCheck || taskId;
    if (!id) {
      throw new Error("No task ID to check");
    }

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
          body: JSON.stringify({ taskId: id }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "שגיאה בבדיקת הסטטוס");
      }

      const data = await response.json();
      setStatus(data);
      return data;
    } catch (error: any) {
      console.error("Error checking status:", error);
      throw error;
    }
  };

  const pollStatus = async (
    taskIdToPoll: string,
    onComplete: (vocalsUrl: string, instrumentalUrl: string) => void,
    onError: (error: string) => void,
    intervalMs = 5000,
    maxAttempts = 60
  ) => {
    let attempts = 0;

    const poll = async () => {
      attempts++;
      try {
        const statusData = await checkStatus(taskIdToPoll);
        
        console.log("Poll status response:", statusData);
        
        // Check for complete status with both URLs
        if (statusData.status === "complete" && statusData.instrumentalUrl) {
          console.log("Generation complete!");
          console.log("  Vocals URL:", statusData.vocalsUrl);
          console.log("  Instrumental URL:", statusData.instrumentalUrl);
          onComplete(statusData.vocalsUrl || '', statusData.instrumentalUrl);
          return;
        }
        
        if (statusData.status === "error") {
          onError(statusData.error || "שגיאה ביצירת המוזיקה");
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

  return {
    addInstrumental,
    mergeAndGenerate,
    checkStatus,
    pollStatus,
    isLoading,
    taskId,
    status,
  };
}
