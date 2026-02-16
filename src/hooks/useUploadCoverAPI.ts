import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SongSection } from "@/pages/customer/NewProject";

interface UploadCoverParams {
  audioUrls: string[];
  title: string;
  style?: string;
  negativeTags?: string;
  vocalGender?: "m" | "f";
  projectName?: string;
}

interface UploadCoverResult {
  taskId?: string;
  originalVocalsUrl?: string;
}

interface AnalyzeStructureParams {
  audioUrl: string;
  duration: number;
  title?: string;
}

interface SunoTaskStatus {
  status: string;
  audioUrl?: string;
  error?: string;
  duration?: number;
}

export function useUploadCoverAPI() {
  const [isLoading, setIsLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<SunoTaskStatus | null>(null);

  // Send vocals to Suno for complete song generation
  const uploadCover = async (params: UploadCoverParams): Promise<UploadCoverResult> => {
    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("יש להתחבר למערכת");
      }

      console.log("Calling suno-upload-cover with:", params);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suno-upload-cover`,
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
        console.error("Upload cover error:", data);
        throw new Error(data.error || "שגיאה ביצירת השיר");
      }

      console.log("Upload cover response:", data);
      setTaskId(data.taskId);
      toast.success("ההקלטה נשלחה ל-Suno ליצירת שיר מלא!");
      
      return {
        taskId: data.taskId,
        originalVocalsUrl: data.originalVocalsUrl,
      };
    } catch (error: any) {
      console.error("Error in upload cover:", error);
      toast.error(error.message || "שגיאה ביצירת השיר");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Check task status
  const checkStatus = async (taskIdToCheck?: string): Promise<SunoTaskStatus> => {
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

  // Poll for song completion
  const pollForSong = async (
    taskIdToPoll: string,
    onComplete: (audioUrl: string, duration: number) => void,
    onError: (error: string) => void,
    intervalMs = 5000,
    maxAttempts = 120 // Up to 10 minutes
  ) => {
    let attempts = 0;

    const poll = async () => {
      attempts++;
      try {
        const statusData = await checkStatus(taskIdToPoll);
        
        console.log("Poll status response:", statusData);
        
        if (statusData.status === "complete" && statusData.audioUrl) {
          console.log("Song generation complete:", statusData.audioUrl);
          
          // Get duration from the audio file
          const audio = new Audio(statusData.audioUrl);
          audio.addEventListener('loadedmetadata', () => {
            onComplete(statusData.audioUrl!, audio.duration);
          });
          audio.addEventListener('error', () => {
            // Fallback duration if can't load
            onComplete(statusData.audioUrl!, 180);
          });
          audio.load();
          return;
        }
        
        if (statusData.status === "error") {
          onError(statusData.error || "שגיאה ביצירת השיר");
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

  // Analyze song structure using AI
  const analyzeSongStructure = async (params: AnalyzeStructureParams): Promise<SongSection[]> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("יש להתחבר למערכת");
      }

      console.log("Analyzing song structure:", params);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-song-structure`,
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
        throw new Error(errorData.error || "שגיאה בניתוח מבנה השיר");
      }

      const data = await response.json();
      console.log("Song structure analysis:", data);
      
      return data.sections || [];
    } catch (error: any) {
      console.error("Error analyzing song structure:", error);
      toast.error(error.message || "שגיאה בניתוח מבנה השיר");
      throw error;
    }
  };

  return {
    uploadCover,
    checkStatus,
    pollForSong,
    analyzeSongStructure,
    isLoading,
    taskId,
    status,
  };
}
