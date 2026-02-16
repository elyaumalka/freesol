import { useEffect, useState } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { useFinalSongAPI } from "@/hooks/useFinalSongAPI";
import { toast } from "sonner";
import { Music, CheckCircle, Loader2 } from "lucide-react";

interface GeneratingIntroOutroProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onComplete: () => void;
  onError: () => void;
}

type GenerationStep = 'generating-intro-outro' | 'merging' | 'complete';

export function GeneratingIntroOutro({
  projectData,
  updateProjectData,
  onComplete,
  onError,
}: GeneratingIntroOutroProps) {
  const [step, setStep] = useState<GenerationStep>('generating-intro-outro');
  const [introStatus, setIntroStatus] = useState<'pending' | 'complete' | 'error'>('pending');
  const [outroStatus, setOutroStatus] = useState<'pending' | 'complete' | 'error'>('pending');
  const [mergeStatus, setMergeStatus] = useState<'pending' | 'complete' | 'error'>('pending');
  const [hasStarted, setHasStarted] = useState(false);
  
  const { generateBoth, pollForBothComplete, mergeFinalSong } = useFinalSongAPI();

  useEffect(() => {
    if (hasStarted) return;
    setHasStarted(true);

    const startGeneration = async () => {
      try {
        // Step 1: Generate intro and outro
        const tags = projectData.musicStyleTags || "Melodic, Warm, Acoustic";
        const title = projectData.projectName || "New Song";

        console.log("Starting intro/outro generation");
        const { introTaskId, outroTaskId } = await generateBoth(title, tags);

        if (!introTaskId || !outroTaskId) {
          toast.error("שגיאה ביצירת הפתיח והסיום");
          onError();
          return;
        }

        // Poll for completion
        pollForBothComplete(
          introTaskId,
          outroTaskId,
          async (introUrl, outroUrl) => {
            console.log("Intro and outro complete:", { introUrl, outroUrl });
            setIntroStatus('complete');
            setOutroStatus('complete');
            
            // Step 2: Merge all parts
            setStep('merging');
            
            try {
              // Get all section recording URLs in order
              const sectionUrls = projectData.verses
                .map(v => v.finalRecordingUrl)
                .filter((url): url is string => !!url);

              if (sectionUrls.length === 0) {
                toast.error("אין הקלטות למיזוג");
                onError();
                return;
              }

              const finalSongUrl = await mergeFinalSong(
                introUrl,
                outroUrl,
                sectionUrls,
                projectData.projectName || "New Song"
              );

              setMergeStatus('complete');
              setStep('complete');

              updateProjectData({
                generatedSongUrl: finalSongUrl,
                introUrl: introUrl,
                outroUrl: outroUrl,
              });

              onComplete();
            } catch (error: any) {
              console.error("Merge error:", error);
              setMergeStatus('error');
              toast.error(error.message || "שגיאה במיזוג השיר");
              onError();
            }
          },
          (error) => {
            console.error("Intro/outro error:", error);
            setIntroStatus('error');
            setOutroStatus('error');
            toast.error(error);
            onError();
          }
        );
      } catch (error: any) {
        console.error("Generation error:", error);
        toast.error(error.message || "שגיאה ביצירת הפתיח והסיום");
        onError();
      }
    };

    startGeneration();
  }, [hasStarted]);

  const getStatusIcon = (status: 'pending' | 'complete' | 'error') => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'error':
        return <div className="w-6 h-6 rounded-full bg-red-500" />;
      default:
        return <Loader2 className="w-6 h-6 text-[#D4A853] animate-spin" />;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full">
      {/* Main Title */}
      <h2 
        className="text-[36px] font-bold text-[#D4A853] mb-4 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        יוצר שיר שלם
      </h2>
      
      {/* Subtitle */}
      <p 
        className="text-[20px] text-[#D4A853] mb-8 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        {step === 'generating-intro-outro' && "יוצר פתיח וסיום..."}
        {step === 'merging' && "ממזג את כל החלקים לשיר אחד..."}
        {step === 'complete' && "השיר מוכן!"}
      </p>

      {/* Progress Steps */}
      <div className="w-full max-w-[400px] space-y-4 mb-8">
        {/* Intro */}
        <div className="flex items-center gap-4 p-4 rounded-[15px] bg-white/10">
          {getStatusIcon(introStatus)}
          <span 
            className="text-[18px] text-white flex-1"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            פתיח
          </span>
          <span 
            className="text-[14px] text-white/60"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            {introStatus === 'complete' ? 'הושלם' : 
             introStatus === 'error' ? 'שגיאה' : 'בתהליך'}
          </span>
        </div>

        {/* Sections */}
        <div className="flex items-center gap-4 p-4 rounded-[15px] bg-white/10">
          <CheckCircle className="w-6 h-6 text-green-500" />
          <span 
            className="text-[18px] text-white flex-1"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            {projectData.verses.length} חלקים
          </span>
          <span 
            className="text-[14px] text-white/60"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            הושלם
          </span>
        </div>

        {/* Outro */}
        <div className="flex items-center gap-4 p-4 rounded-[15px] bg-white/10">
          {getStatusIcon(outroStatus)}
          <span 
            className="text-[18px] text-white flex-1"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            סיום
          </span>
          <span 
            className="text-[14px] text-white/60"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            {outroStatus === 'complete' ? 'הושלם' : 
             outroStatus === 'error' ? 'שגיאה' : 'בתהליך'}
          </span>
        </div>

        {/* Merge */}
        {step !== 'generating-intro-outro' && (
          <div className="flex items-center gap-4 p-4 rounded-[15px] bg-white/10">
            {getStatusIcon(mergeStatus)}
            <span 
              className="text-[18px] text-white flex-1"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              מיזוג לשיר אחד
            </span>
            <span 
              className="text-[14px] text-white/60"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              {mergeStatus === 'complete' ? 'הושלם' : 
               mergeStatus === 'error' ? 'שגיאה' : 'בתהליך'}
            </span>
          </div>
        )}
      </div>

      {/* Loading Animation */}
      {step !== 'complete' && (
        <div className="flex gap-3 mb-6">
          <Music className="w-8 h-8 text-[#D4A853] animate-bounce" style={{ animationDelay: '0ms' }} />
          <Music className="w-8 h-8 text-[#D4A853] animate-bounce" style={{ animationDelay: '150ms' }} />
          <Music className="w-8 h-8 text-[#D4A853] animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      )}

      {/* Tip */}
      <p 
        className="text-[14px] text-white/50 text-center max-w-[400px]"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        תהליך זה עשוי להימשך מספר דקות
      </p>
    </div>
  );
}
