import { useEffect, useState, useRef } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { useAddInstrumentalAPI } from "@/hooks/useAddInstrumentalAPI";
import { toast } from "sonner";

interface AIProcessingInstrumentalProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onComplete: (instrumentalUrl: string) => void;
  onError: () => void;
}

export function AIProcessingInstrumental({ 
  projectData, 
  updateProjectData, 
  onComplete, 
  onError 
}: AIProcessingInstrumentalProps) {
  const { addInstrumental, checkTaskStatus } = useAddInstrumentalAPI();
  const [statusMessage, setStatusMessage] = useState("שולח את ההקלטה ל-Suno AI...");
  const [hasStarted, setHasStarted] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (hasStarted) return;
    
    const startGeneration = async () => {
      setHasStarted(true);
      
      const vocalsUrl = projectData.aiVocalsUrl;
      
      if (!vocalsUrl) {
        toast.error("אין הקלטה לעיבוד");
        setStatusMessage("אין הקלטה לעיבוד...");
        setTimeout(onError, 2000);
        return;
      }

      try {
        setStatusMessage("שולח הקלטה ל-Suno AI להוספת ליווי מוזיקלי...");
        
        const result = await addInstrumental({
          audioUrl: vocalsUrl,
          title: projectData.projectName || 'שיר חדש',
          tags: projectData.musicStyleTags || "Acoustic, Melodic, Warm",
          negativeTags: projectData.musicStyleNegativeTags || "Heavy Metal, Electronic, Aggressive",
          vocalGender: "m",
          sectionIndex: 0,
        });

        if (!result?.taskId) {
          toast.error("לא התקבל Task ID מ-Suno");
          onError();
          return;
        }

        console.log("Suno add-instrumental task started:", result.taskId);
        setStatusMessage("Suno AI יוצר ליווי מוזיקלי... זה עשוי לקחת מספר דקות");
        
        // Start polling for completion
        let attempts = 0;
        const maxAttempts = 120; // 10 minutes max
        
        const poll = async () => {
          attempts++;
          
          try {
            const status = await checkTaskStatus(result.taskId);
            console.log(`Poll attempt ${attempts}:`, status);
            
            if (status.status === 'complete' && status.audioUrl) {
              toast.success('הליווי המוזיקלי נוצר בהצלחה!');
              updateProjectData({ 
                generatedPlaybackUrl: status.audioUrl,
                instrumentalUrl: status.audioUrl 
              });
              onComplete(status.audioUrl);
              return;
            } else if (status.status === 'error') {
              toast.error(status.error || 'שגיאה ביצירת הליווי המוזיקלי');
              onError();
              return;
            }
            
            // Continue polling
            if (attempts < maxAttempts) {
              pollingRef.current = setTimeout(poll, 5000);
            } else {
              toast.error('הזמן הקצוב לתהליך עבר');
              onError();
            }
          } catch (error) {
            console.error('Polling error:', error);
            if (attempts < maxAttempts) {
              pollingRef.current = setTimeout(poll, 5000);
            } else {
              onError();
            }
          }
        };
        
        pollingRef.current = setTimeout(poll, 5000);
        
      } catch (error) {
        console.error("Error starting generation:", error);
        toast.error("שגיאה בשליחה ל-Suno API");
        onError();
      }
    };

    startGeneration();
    
    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, [hasStarted, projectData, addInstrumental, checkTaskStatus, updateProjectData, onComplete, onError]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      {/* Title */}
      <h1 
        className="text-[32px] font-bold text-[#D4A853] mb-12 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        אנחנו יוצרים בשבילך את הפלייבק המושלם
      </h1>

      {/* Loading Animation - Circle of dots */}
      <div className="relative w-16 h-16">
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const x = Math.cos(angle) * 28;
          const y = Math.sin(angle) * 28;
          return (
            <div 
              key={i}
              className="absolute w-2 h-2 rounded-full bg-[#D4A853]"
              style={{ 
                left: `calc(50% + ${x}px - 4px)`,
                top: `calc(50% + ${y}px - 4px)`,
                opacity: 0.3 + (i * 0.05),
                animation: `pulse 1.2s ease-in-out ${i * 0.1}s infinite`
              }}
            />
          );
        })}
      </div>

      {/* Duration notice */}
      <p 
        className="text-white/60 text-[16px] mt-8 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        פעולה זו עשויה לקחת מספר דקות
      </p>
    </div>
  );
}
