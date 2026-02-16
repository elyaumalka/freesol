import { useEffect, useState } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { useUploadCoverAPI } from "@/hooks/useUploadCoverAPI";
import { toast } from "sonner";

interface AICreatingPlaybackProps {
  projectData: ProjectData;
  onSongCreated: (songUrl: string, originalVocalsUrl: string) => void;
  onError: () => void;
}

export function AICreatingPlayback({ projectData, onSongCreated, onError }: AICreatingPlaybackProps) {
  const { uploadCover, pollForSong } = useUploadCoverAPI();
  const [statusMessage, setStatusMessage] = useState("מתחילים ליצור את השיר המלא...");
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (hasStarted) return;
    
    const startGeneration = async () => {
      setHasStarted(true);
      
      // Get all recorded audio URLs from verses
      const audioUrls = projectData.verses
        .filter(v => v.audioUrl)
        .map(v => v.audioUrl as string);
      
      console.log("Audio URLs for upload-cover:", audioUrls);
      
      if (audioUrls.length === 0) {
        toast.error("אין הקלטות לעיבוד. יש להקליט לפחות בית אחד.");
        setStatusMessage("אין הקלטות לעיבוד...");
        setTimeout(onError, 2000);
        return;
      }

      try {
        setStatusMessage(`שולח ${audioUrls.length} הקלטות ליצירת שיר מלא...`);
        
        // Use music style from projectData if available
        const styleTags = projectData.musicStyleTags || "Jewish Music, Melodic, Traditional, Warm, Acoustic";
        const negTags = projectData.musicStyleNegativeTags || "Heavy Metal, Electronic, Aggressive, Loud";
        
        const result = await uploadCover({
          audioUrls,
          title: projectData.projectName || "שיר חדש",
          style: styleTags,
          negativeTags: negTags,
          vocalGender: "m",
          projectName: projectData.projectName,
        });

        console.log("Upload cover response:", result);

        if (result.taskId) {
          setStatusMessage("Suno AI יוצר שיר מלא... זה עשוי לקחת מספר דקות");
          
          pollForSong(
            result.taskId,
            (audioUrl, duration) => {
              console.log("Song created:", audioUrl, "Duration:", duration);
              toast.success("השיר נוצר בהצלחה!");
              onSongCreated(audioUrl, result.originalVocalsUrl || '');
            },
            (error) => {
              console.error("Generation error:", error);
              toast.error(error);
              onError();
            }
          );
        } else {
          toast.error("לא התקבל Task ID מ-Suno");
          onError();
        }
      } catch (error) {
        console.error("Error starting generation:", error);
        toast.error("שגיאה בשליחה ל-Suno API");
        onError();
      }
    };

    startGeneration();
  }, [hasStarted, projectData, uploadCover, pollForSong, onSongCreated, onError]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      {/* Title */}
      <h1 
        className="text-[36px] font-bold text-[#D4A853] mb-4 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        Suno AI יוצר לך שיר מלא
      </h1>

      {/* Subtitle */}
      <p 
        className="text-[18px] text-white/80 mb-2 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        עם פתיחה, בתים, פזמונות וסיום
      </p>

      {/* Status Message */}
      <p 
        className="text-[16px] text-white/60 mb-8 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        {statusMessage}
      </p>

      {/* Loading Spinner - musical note style */}
      <div className="flex items-center justify-center gap-3">
        <div className="w-4 h-4 rounded-full bg-[#D4A853] animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-4 h-4 rounded-full bg-[#D4A853] animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-4 h-4 rounded-full bg-[#D4A853] animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>

      {/* Tip */}
      <p 
        className="text-[14px] text-white/40 mt-8 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        התהליך יכול לקחת עד 5 דקות
      </p>
    </div>
  );
}
