import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AddInstrumentalParams {
  audioUrl: string;
  title: string;
  tags?: string;
  negativeTags?: string;
  vocalGender?: "m" | "f";
  sectionIndex: number;
}

interface InstrumentalResult {
  taskId: string;
  sectionIndex: number;
}

interface SectionStatus {
  sectionIndex: number;
  taskId: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  instrumentalUrl?: string;
  error?: string;
}

export function useAddInstrumentalAPI() {
  const [isLoading, setIsLoading] = useState(false);
  const [sectionsStatus, setSectionsStatus] = useState<SectionStatus[]>([]);

  // Send a single section to add-instrumental
  const addInstrumental = async (params: AddInstrumentalParams): Promise<InstrumentalResult | null> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("יש להתחבר למערכת");
      }

      console.log(`Calling add-instrumental for section ${params.sectionIndex}:`, params);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suno-add-instrumental`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({
            uploadUrl: params.audioUrl,
            title: `${params.title} - Section ${params.sectionIndex + 1}`,
            tags: params.tags || "Jewish Music, Melodic, Traditional, Warm, Acoustic",
            negativeTags: params.negativeTags || "Heavy Metal, Electronic, Aggressive",
            vocalGender: params.vocalGender || "m",
          }),
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        console.error("Add instrumental error:", data);
        throw new Error(data.error || "שגיאה ביצירת המנגינה");
      }

      console.log(`Add instrumental response for section ${params.sectionIndex}:`, data);
      
      return {
        taskId: data.taskId,
        sectionIndex: params.sectionIndex,
      };
    } catch (error: any) {
      console.error(`Error in add instrumental for section ${params.sectionIndex}:`, error);
      throw error;
    }
  };

  // Process all sections with add-instrumental
  const processAllSections = async (
    sections: { audioUrl: string; sectionIndex: number }[],
    title: string,
    tags: string,
    negativeTags: string,
    vocalGender: "m" | "f"
  ): Promise<InstrumentalResult[]> => {
    setIsLoading(true);
    const results: InstrumentalResult[] = [];
    
    // Initialize status for all sections
    setSectionsStatus(sections.map(s => ({
      sectionIndex: s.sectionIndex,
      taskId: '',
      status: 'pending',
    })));

    try {
      // Process sections sequentially to avoid rate limiting
      for (const section of sections) {
        try {
          const result = await addInstrumental({
            audioUrl: section.audioUrl,
            title,
            tags,
            negativeTags,
            vocalGender,
            sectionIndex: section.sectionIndex,
          });

          if (result) {
            results.push(result);
            setSectionsStatus(prev => prev.map(s => 
              s.sectionIndex === section.sectionIndex 
                ? { ...s, taskId: result.taskId, status: 'processing' }
                : s
            ));
          }

          // Small delay between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`Failed to process section ${section.sectionIndex}:`, error);
          setSectionsStatus(prev => prev.map(s => 
            s.sectionIndex === section.sectionIndex 
              ? { ...s, status: 'error', error: 'שגיאה ביצירת המנגינה' }
              : s
          ));
        }
      }

      return results;
    } finally {
      setIsLoading(false);
    }
  };

  // Check status of a single task
  const checkTaskStatus = async (taskId: string): Promise<{
    status: string;
    audioUrl?: string;
    error?: string;
  }> => {
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

  // Poll all tasks until complete
  const pollAllTasks = async (
    results: InstrumentalResult[],
    onComplete: (sectionResults: { sectionIndex: number; instrumentalUrl: string }[]) => void,
    onError: (error: string) => void,
    intervalMs = 5000,
    maxAttempts = 120
  ) => {
    let attempts = 0;
    const completedSections: { sectionIndex: number; instrumentalUrl: string }[] = [];
    const pendingResults = [...results];

    const poll = async () => {
      attempts++;
      
      for (let i = pendingResults.length - 1; i >= 0; i--) {
        const result = pendingResults[i];
        
        try {
          const statusData = await checkTaskStatus(result.taskId);
          console.log(`Status for section ${result.sectionIndex}:`, statusData);

          if (statusData.status === "complete" && statusData.audioUrl) {
            completedSections.push({
              sectionIndex: result.sectionIndex,
              instrumentalUrl: statusData.audioUrl,
            });
            
            setSectionsStatus(prev => prev.map(s => 
              s.sectionIndex === result.sectionIndex 
                ? { ...s, status: 'complete', instrumentalUrl: statusData.audioUrl }
                : s
            ));
            
            pendingResults.splice(i, 1);
          } else if (statusData.status === "error") {
            setSectionsStatus(prev => prev.map(s => 
              s.sectionIndex === result.sectionIndex 
                ? { ...s, status: 'error', error: statusData.error }
                : s
            ));
            pendingResults.splice(i, 1);
          }
        } catch (error) {
          console.error(`Error checking section ${result.sectionIndex}:`, error);
        }
      }

      // Check if all done
      if (pendingResults.length === 0) {
        if (completedSections.length === results.length) {
          onComplete(completedSections);
        } else {
          onError("חלק מהמנגינות לא נוצרו בהצלחה");
        }
        return;
      }

      if (attempts < maxAttempts) {
        setTimeout(poll, intervalMs);
      } else {
        onError("הזמן הקצוב לתהליך עבר");
      }
    };

    poll();
  };

  return {
    addInstrumental,
    processAllSections,
    checkTaskStatus,
    pollAllTasks,
    isLoading,
    sectionsStatus,
  };
}
