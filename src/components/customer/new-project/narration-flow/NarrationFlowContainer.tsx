import { useState, useEffect, useCallback } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { NarrationRecording } from "./NarrationRecording";
import { NarrationEnhancing } from "./NarrationEnhancing";
import { NarrationFinish } from "./NarrationFinish";
import { autoSaveProject } from "@/lib/projectUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NarrationFlowContainerProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onBack: () => void;
  onExit: () => void;
  onFlowStepChange?: (step: string) => void;
  initialFlowStep?: string;
}

type NarrationStep = 'recording' | 'enhancing' | 'finish';

export function NarrationFlowContainer({
  projectData,
  updateProjectData,
  onBack,
  onExit,
  onFlowStepChange,
  initialFlowStep
}: NarrationFlowContainerProps) {
  const getInitialStep = (): NarrationStep => {
    // Check if we have a recording already - go to finish
    if (projectData.recordedAudioUrl) {
      return 'finish';
    }
    
    if (initialFlowStep === 'finish' && projectData.recordedAudioUrl) {
      return 'finish';
    }
    
    return 'recording';
  };

  const [currentStep, setCurrentStep] = useState<NarrationStep>(getInitialStep);

  // Notify parent of flow step changes
  useEffect(() => {
    onFlowStepChange?.(currentStep);
  }, [currentStep, onFlowStepChange]);

  // Auto-save on step changes
  useEffect(() => {
    autoSaveProject(projectData, currentStep);
  }, [currentStep, projectData]);

  const goToStep = useCallback((step: NarrationStep) => {
    setCurrentStep(step);
  }, []);

  const handleRecordingComplete = async (audioUrl: string, duration: string) => {
    updateProjectData({
      recordedAudioUrl: audioUrl,
      songDuration: parseFloat(duration) || 0
    });

    // Go to enhancement step
    goToStep('enhancing');
  };

  const handleEnhancementComplete = async (enhancedUrl: string) => {
    // Save to recordings table with enhanced URL
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('recordings')
          .insert({
            user_id: user.id,
            song_name: projectData.projectName || 'קריינות',
            audio_url: enhancedUrl,
            duration: projectData.songDuration?.toString() || '00:00'
          });

        if (error) {
          console.error('Error saving recording to history:', error);
        }
      }
    } catch (error) {
      console.error('Error saving recording:', error);
    }

    goToStep('finish');
  };

  const handleEnhancementSkip = async () => {
    // Save to recordings table with original URL
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('recordings')
          .insert({
            user_id: user.id,
            song_name: projectData.projectName || 'קריינות',
            audio_url: projectData.recordedAudioUrl || '',
            duration: projectData.songDuration?.toString() || '00:00'
          });

        if (error) {
          console.error('Error saving recording to history:', error);
        }
      }
    } catch (error) {
      console.error('Error saving recording:', error);
    }

    goToStep('finish');
  };

  const handleReRecord = () => {
    goToStep('recording');
  };

  switch (currentStep) {
    case 'recording':
      return (
        <NarrationRecording
          projectData={projectData}
          onComplete={handleRecordingComplete}
          onBack={onBack}
          onExit={onExit}
        />
      );
    case 'enhancing':
      return (
        <NarrationEnhancing
          projectData={projectData}
          updateProjectData={updateProjectData}
          onComplete={handleEnhancementComplete}
          onSkip={handleEnhancementSkip}
        />
      );
    case 'finish':
      return (
        <NarrationFinish
          projectData={projectData}
          updateProjectData={updateProjectData}
          onReRecord={handleReRecord}
          onExit={onExit}
        />
      );
    default:
      return null;
  }
}