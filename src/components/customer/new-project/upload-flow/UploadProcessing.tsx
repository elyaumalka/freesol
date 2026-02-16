import { useState, useEffect, useRef } from "react";
import { ProjectData, SongSection } from "@/pages/customer/NewProject";
import { supabase } from "@/integrations/supabase/client";
import { Lightbulb, Loader2 } from "lucide-react";
import { autoSaveProject } from "@/lib/projectUtils";

interface UploadProcessingProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onNext: () => void;
  onError: () => void;
}

export function UploadProcessing({ projectData, updateProjectData, onNext, onError }: UploadProcessingProps) {
  const [isProcessing, setIsProcessing] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const processedRef = useRef(false);

  useEffect(() => {
    if (!processedRef.current && projectData.uploadedFile) {
      processedRef.current = true;
      startProcessing();
    }
  }, []);

  const startProcessing = async () => {
    try {
      // Step 1: Upload file to Supabase Storage
      const file = projectData.uploadedFile!;
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('recordings')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('recordings')
        .getPublicUrl(filePath);

      const audioUrl = urlData.publicUrl;
      console.log('Uploaded file URL:', audioUrl);

      // Update project with original audio URL
      updateProjectData({ 
        generatedPlaybackUrl: audioUrl,
        originalVocalsUrl: audioUrl
      });

      // Step 2: Separate vocals
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      // Get user ID for storage path
      const userId = sessionData.session?.user.id;

      // Start vocal separation
      const { data: separateData, error: separateError } = await supabase.functions.invoke('separate-vocals', {
        body: { 
          audioUrl, 
          title: projectData.playbackName || file.name,
          uploadToStorage: true,
          userId: userId,
          projectName: projectData.projectName || 'project',
        }
      });

      if (separateError || !separateData?.success) {
        throw new Error(separateData?.error || 'Failed to start vocal separation');
      }

      const predictionId = separateData.predictionId;
      console.log('Separation started, prediction ID:', predictionId);

      // Poll for separation completion
      let separationComplete = false;
      let instrumentalUrl: string | null = null;
      let pollCount = 0;
      const maxPolls = 120; // 10 minutes max

      while (!separationComplete && pollCount < maxPolls) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        pollCount++;

        const { data: statusData, error: statusError } = await supabase.functions.invoke('separate-vocals', {
          body: { 
            predictionId,
            uploadToStorage: true,
            userId: userId,
            projectName: projectData.projectName || 'project',
          }
        });

        if (statusError) {
          console.error('Status check error:', statusError);
          continue;
        }

        console.log('Separation status:', statusData);

        if (statusData.status === 'succeeded') {
          separationComplete = true;
          instrumentalUrl = statusData.instrumentalUrl;
        } else if (statusData.status === 'failed' || statusData.status === 'canceled') {
          throw new Error('Vocal separation failed');
        }
      }

      if (!separationComplete) {
        throw new Error('Vocal separation timed out');
      }

      // Update with instrumental URL
      if (instrumentalUrl) {
        updateProjectData({ instrumentalUrl });
        console.log('Instrumental URL:', instrumentalUrl);
      }

      // Step 3: Analyze song structure
      const { data: analyzeData, error: analyzeError } = await supabase.functions.invoke('analyze-song-structure', {
        body: { audioUrl }
      });

      if (analyzeError) {
        console.error('Analysis error:', analyzeError);
        // Use default sections if analysis fails
        const defaultSections: SongSection[] = [
          { type: 'intro', label: 'פתיח', startTime: 0, endTime: 15, duration: 15 },
          { type: 'verse', label: 'בית ראשון', startTime: 15, endTime: 75, duration: 60 },
          { type: 'chorus', label: 'פזמון ראשון', startTime: 75, endTime: 120, duration: 45 },
          { type: 'verse', label: 'בית שני', startTime: 120, endTime: 180, duration: 60 },
          { type: 'chorus', label: 'פזמון שני', startTime: 180, endTime: 225, duration: 45 },
          { type: 'outro', label: 'סיום', startTime: 225, endTime: 255, duration: 30 },
        ];
        updateProjectData({ songSections: defaultSections });
      } else if (analyzeData?.sections) {
        // Map sections to SongSection format with instrumental URLs
        const sections: SongSection[] = analyzeData.sections.map((s: any) => ({
          type: s.type || 'verse',
          label: s.label || 'חלק',
          startTime: s.startTime || s.start || 0,
          endTime: s.endTime || s.end || 60,
          duration: s.duration || (s.endTime - s.startTime) || 60,
          instrumentalUrl: instrumentalUrl || undefined,
        }));

        const updatedData = { 
          songSections: sections,
          songDuration: analyzeData.duration
        };
        updateProjectData(updatedData);
        console.log('Analyzed sections:', sections);
        
        // Auto-save after processing is complete
        autoSaveProject({ ...projectData, ...updatedData, backgroundMusic: 'upload' }, 'ready-record');
      }

      setIsProcessing(false);

      // Wait a moment then proceed
      setTimeout(() => {
        onNext();
      }, 1000);

    } catch (error: any) {
      console.error('Processing error:', error);
      setIsProcessing(false);
      setErrorMessage(error.message || 'An error occurred');
      
      setTimeout(() => {
        onError();
      }, 3000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      {/* Main Message with Gradient */}
      <h1 
        className="text-[32px] font-bold text-center mb-4 bg-gradient-to-l from-[#FFD700] via-[#FFA500] to-[#FF8C00] bg-clip-text text-transparent animate-fade-in"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        מעולה! בחירת שיר מצויינת, מכינים לך את הפלייבק להקלטה!
      </h1>

      {/* Subtitle */}
      <p 
        className="text-[18px] text-white/70 text-center mb-8"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        פעולה זו עשויה לקחת מספר דקות
      </p>

      {/* Loading Spinner */}
      {isProcessing && !errorMessage && (
        <Loader2 className="w-10 h-10 text-[#D4A853] animate-spin" />
      )}

      {/* Error Message */}
      {errorMessage && (
        <p className="text-red-400 text-[18px]" style={{ fontFamily: 'Discovery_Fs' }}>
          {errorMessage}
        </p>
      )}
    </div>
  );
}
