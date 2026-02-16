import { useState, useEffect } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { SelectTempoSettings } from "./SelectTempoSettings";
import { MetronomeRecording } from "./MetronomeRecording";
import { AISelectStyle } from "./AISelectStyle";
import { AIProcessingInstrumental } from "./AIProcessingInstrumental";
import { AIFinalRecording } from "./AIFinalRecording";
import { FinishProcessing } from "../search-flow/FinishProcessing";
import { SendEmailDialog } from "@/components/customer/SendEmailDialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AIFlowContainerProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onBack: () => void;
  onExit: () => void;
  onFlowStepChange?: (step: string) => void;
  initialFlowStep?: string;
}

// New AI Flow Steps:
// 1. select-tempo - User selects time signature and BPM
// 2. metronome-recording - User records with metronome
// 3. select-style - User selects music style
// 4. processing - Send to Suno add-instrumental
// 5. final-recording - User records over the instrumental
// 6. finish - Show final result

type AIFlowStep = 
  | 'select-tempo'
  | 'metronome-recording'
  | 'select-style'
  | 'processing'
  | 'final-recording'
  | 'finish';

export function AIFlowContainer({ 
  projectData, 
  updateProjectData, 
  onBack, 
  onExit,
  onFlowStepChange,
  initialFlowStep
}: AIFlowContainerProps) {
  const getInitialStep = (): AIFlowStep => {
    if (initialFlowStep) {
      const validSteps: AIFlowStep[] = ['select-tempo', 'metronome-recording', 'select-style', 'processing', 'final-recording', 'finish'];
      if (validSteps.includes(initialFlowStep as AIFlowStep)) {
        // Validate data exists for later steps
        if (['metronome-recording', 'select-style', 'processing', 'final-recording', 'finish'].includes(initialFlowStep)) {
          if (!projectData.aiBpm) return 'select-tempo';
        }
        if (['processing', 'final-recording', 'finish'].includes(initialFlowStep)) {
          if (!projectData.aiVocalsUrl) return 'metronome-recording';
        }
        if (['final-recording', 'finish'].includes(initialFlowStep)) {
          if (!projectData.instrumentalUrl) return 'processing';
        }
        return initialFlowStep as AIFlowStep;
      }
    }
    return 'select-tempo';
  };

  const [currentStep, setCurrentStep] = useState<AIFlowStep>(getInitialStep);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailDialogData, setEmailDialogData] = useState<{ audioUrl: string; songName: string }>({ audioUrl: '', songName: '' });
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');

  // Fetch user info on mount
  useEffect(() => {
    const fetchUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .maybeSingle();
        if (profile?.full_name) {
          setUserName(profile.full_name);
        }
      }
    };
    fetchUserInfo();
  }, []);

  const handleSendEmail = (audioUrl: string, songName: string) => {
    setEmailDialogData({ audioUrl, songName });
    setShowEmailDialog(true);
  };

  useEffect(() => {
    onFlowStepChange?.(currentStep);
  }, [currentStep, onFlowStepChange]);

  const goToStep = (step: AIFlowStep) => {
    setCurrentStep(step);
  };

  const handleDownload = async () => {
    const audioUrl = projectData.generatedSongUrl || projectData.recordedAudioUrl;
    if (audioUrl) {
      try {
        const response = await fetch(audioUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${projectData.projectName || 'song'}.webm`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success('ההורדה החלה');
      } catch (error) {
        toast.error('שגיאה בהורדה');
      }
    } else {
      toast.error('אין קובץ להורדה');
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'select-tempo':
        return (
          <SelectTempoSettings
            projectData={projectData}
            updateProjectData={updateProjectData}
            onNext={() => goToStep('metronome-recording')}
            onBack={onBack}
          />
        );
      case 'metronome-recording':
        return (
          <MetronomeRecording
            projectData={projectData}
            updateProjectData={updateProjectData}
            onFinish={() => goToStep('select-style')}
            onBack={() => goToStep('select-tempo')}
          />
        );
      case 'select-style':
        return (
          <AISelectStyle
            projectData={projectData}
            updateProjectData={updateProjectData}
            onNext={() => goToStep('processing')}
            onBack={() => goToStep('metronome-recording')}
          />
        );
      case 'processing':
        return (
          <AIProcessingInstrumental
            projectData={projectData}
            updateProjectData={updateProjectData}
            onComplete={() => goToStep('final-recording')}
            onError={() => goToStep('select-style')}
          />
        );
      case 'final-recording':
        return (
          <AIFinalRecording
            projectData={projectData}
            updateProjectData={updateProjectData}
            onFinish={() => goToStep('finish')}
            onBack={() => goToStep('select-style')}
          />
        );
      case 'finish':
        return (
          <FinishProcessing
            projectData={projectData}
            onReRecord={() => goToStep('final-recording')}
            onDownload={handleDownload}
            onSendEmail={handleSendEmail}
            onExit={onExit}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full">
      {renderStep()}

      {/* Send Email Dialog */}
      <SendEmailDialog
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        audioUrl={emailDialogData.audioUrl}
        songName={emailDialogData.songName}
        customerName={userName}
        defaultEmail={userEmail}
      />
    </div>
  );
}
