import { useEffect, useState } from "react";
import { ProjectData, SongSection } from "@/pages/customer/NewProject";
import { useUploadCoverAPI } from "@/hooks/useUploadCoverAPI";
import { toast } from "sonner";

interface AIAnalyzingStructureProps {
  projectData: ProjectData;
  onStructureAnalyzed: (sections: SongSection[], duration: number) => void;
  onError: () => void;
}

export function AIAnalyzingStructure({ 
  projectData, 
  onStructureAnalyzed, 
  onError 
}: AIAnalyzingStructureProps) {
  const { analyzeSongStructure } = useUploadCoverAPI();
  const [statusMessage, setStatusMessage] = useState("מנתח את מבנה השיר...");
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (hasStarted) return;
    
    const analyze = async () => {
      setHasStarted(true);
      
      const songUrl = projectData.generatedSongUrl;
      const duration = projectData.songDuration || 180;

      if (!songUrl) {
        toast.error("לא נמצא שיר לניתוח");
        onError();
        return;
      }

      try {
        setStatusMessage("מזהה בתים, פזמונות ומבנה השיר...");
        
        const sections = await analyzeSongStructure({
          audioUrl: songUrl,
          duration: duration,
          title: projectData.projectName,
        });

        console.log("Structure analysis result:", sections);

        if (sections.length === 0) {
          toast.error("לא הצלחנו לזהות את מבנה השיר");
          onError();
          return;
        }

        // Filter to only show recordable sections (verses and choruses)
        const recordableSections = sections.filter(
          s => s.type === 'verse' || s.type === 'chorus'
        );

        setStatusMessage(`זיהינו ${recordableSections.length} חלקים להקלטה!`);
        
        setTimeout(() => {
          onStructureAnalyzed(sections, duration);
        }, 1500);

      } catch (error) {
        console.error("Error analyzing structure:", error);
        toast.error("שגיאה בניתוח מבנה השיר");
        onError();
      }
    };

    analyze();
  }, [hasStarted, projectData, analyzeSongStructure, onStructureAnalyzed, onError]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      {/* Title */}
      <h1 
        className="text-[36px] font-bold text-[#D4A853] mb-4 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        מנתח את מבנה השיר
      </h1>

      {/* Status Message */}
      <p 
        className="text-[18px] text-white/80 mb-8 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        {statusMessage}
      </p>

      {/* Loading animation */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <div className="w-3 h-8 bg-[#D4A853] animate-pulse" style={{ animationDelay: '0ms' }} />
        <div className="w-3 h-12 bg-[#D4A853] animate-pulse" style={{ animationDelay: '100ms' }} />
        <div className="w-3 h-6 bg-[#D4A853] animate-pulse" style={{ animationDelay: '200ms' }} />
        <div className="w-3 h-10 bg-[#D4A853] animate-pulse" style={{ animationDelay: '300ms' }} />
        <div className="w-3 h-14 bg-[#D4A853] animate-pulse" style={{ animationDelay: '400ms' }} />
        <div className="w-3 h-8 bg-[#D4A853] animate-pulse" style={{ animationDelay: '500ms' }} />
        <div className="w-3 h-12 bg-[#D4A853] animate-pulse" style={{ animationDelay: '600ms' }} />
      </div>

      {/* Info */}
      <p 
        className="text-[14px] text-white/40 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        הבינה המלאכותית מזהה את הבתים והפזמונות בשיר
      </p>
    </div>
  );
}
