import { useEffect, useState, useRef } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

interface NarrationEnhancingProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onComplete: (enhancedUrl: string) => void;
  onSkip: () => void;
}

export function NarrationEnhancing({
  projectData,
  updateProjectData,
  onComplete,
  onSkip
}: NarrationEnhancingProps) {
  const [statusMessage, setStatusMessage] = useState("מתחיל לשפר את הקול...");
  const [progress, setProgress] = useState(0);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const enhance = async () => {
      const audioUrl = projectData.recordedAudioUrl;
      
      if (!audioUrl) {
        toast.error("אין הקלטה לשיפור");
        onSkip();
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error("יש להתחבר כדי לשפר אודיו");
          onSkip();
          return;
        }

        // Progress simulation while waiting
        const progressInterval = setInterval(() => {
          setProgress(prev => Math.min(prev + 2, 90));
        }, 3000);

        setStatusMessage("מנתח את ההקלטה...");
        
        setTimeout(() => {
          setStatusMessage("מסיר רעשי רקע...");
        }, 5000);

        setTimeout(() => {
          setStatusMessage("משפר איכות קול עם AI...");
        }, 15000);

        setTimeout(() => {
          setStatusMessage("משדרג לאיכות 48kHz...");
        }, 30000);

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enhance-narration`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              audioUrl,
              projectName: projectData.projectName || 'narration',
            }),
          }
        );

        clearInterval(progressInterval);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'שגיאה בשיפור הקול');
        }

        const result = await response.json();
        console.log("Enhancement result:", result);

        setProgress(100);
        
        if (result.success && result.enhancedAudioUrl) {
          setStatusMessage("השיפור הושלם בהצלחה! ✨");
          
          // Update project data with enhanced URL
          updateProjectData({
            recordedAudioUrl: result.enhancedAudioUrl,
          });
          
          toast.success("הקול שודרג בהצלחה!");
          
          setTimeout(() => {
            onComplete(result.enhancedAudioUrl);
          }, 1500);
        } else {
          setStatusMessage("ממשיכים עם ההקלטה המקורית 👍");
          setProgress(100);
          toast.info("ההקלטה נשמרה בהצלחה");
          
          setTimeout(() => {
            onSkip();
          }, 1500);
        }
      } catch (error: any) {
        console.error("Enhancement error:", error);
        setStatusMessage("ממשיכים עם ההקלטה המקורית 👍");
        setProgress(100);
        toast.info("ההקלטה נשמרה בהצלחה");
        
        setTimeout(() => {
          onSkip();
        }, 2000);
      }
    };

    enhance();
  }, [projectData, updateProjectData, onComplete, onSkip]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      {/* Title with sparkles */}
      <div className="flex items-center gap-3 mb-4">
        <Sparkles className="w-8 h-8 text-[#D4A853]" />
        <h1 
          className="text-[32px] font-bold text-[#D4A853] text-center"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          משפרים את איכות הקול
        </h1>
        <Sparkles className="w-8 h-8 text-[#D4A853]" />
      </div>

      {/* Subtitle */}
      <p 
        className="text-[18px] text-white/80 mb-8 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        {statusMessage}
      </p>

      {/* Progress bar */}
      <div className="w-full max-w-[400px] h-3 bg-white/20 rounded-full overflow-hidden mb-6">
        <div 
          className="h-full bg-gradient-to-r from-[#D4A853] to-[#FFBF66] transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Animated sound waves */}
      <div className="flex items-center justify-center gap-1 mb-8">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="w-1 bg-[#D4A853] rounded-full animate-pulse"
            style={{
              height: `${20 + Math.sin(i * 0.5) * 15 + Math.random() * 10}px`,
              animationDelay: `${i * 50}ms`,
              animationDuration: '0.8s',
            }}
          />
        ))}
      </div>

      {/* Info cards */}
      <div className="flex flex-wrap justify-center gap-4 max-w-[600px]">
        <div className="bg-white/10 rounded-xl px-4 py-3 text-center">
          <div className="text-[#D4A853] text-[14px] mb-1" style={{ fontFamily: 'Discovery_Fs' }}>
            🎙️ הסרת רעשים
          </div>
          <div className="text-white/60 text-[12px]" style={{ fontFamily: 'Discovery_Fs' }}>
            רעשי רקע מוסרים אוטומטית
          </div>
        </div>
        
        <div className="bg-white/10 rounded-xl px-4 py-3 text-center">
          <div className="text-[#D4A853] text-[14px] mb-1" style={{ fontFamily: 'Discovery_Fs' }}>
            ✨ שיפור בהירות
          </div>
          <div className="text-white/60 text-[12px]" style={{ fontFamily: 'Discovery_Fs' }}>
            הקול נשמע חד וברור יותר
          </div>
        </div>
        
        <div className="bg-white/10 rounded-xl px-4 py-3 text-center">
          <div className="text-[#D4A853] text-[14px] mb-1" style={{ fontFamily: 'Discovery_Fs' }}>
            🎵 איכות 48kHz
          </div>
          <div className="text-white/60 text-[12px]" style={{ fontFamily: 'Discovery_Fs' }}>
            שדרוג לאיכות סטודיו
          </div>
        </div>
      </div>

      {/* Skip button */}
      <button
        onClick={onSkip}
        className="mt-8 text-white/50 text-[14px] hover:text-white/80 transition-colors underline"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        דלג על השיפור
      </button>
    </div>
  );
}
