import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ProjectData } from "@/pages/customer/NewProject";
import { UploadPlayback } from "./UploadPlayback";
import { UploadProcessing } from "./UploadProcessing";
import { SplittingInstrumental } from "../search-flow/SplittingInstrumental";
import { ReadyToRecord } from "../search-flow/ReadyToRecord";
import { RecordingScreen } from "../search-flow/RecordingScreen";
import { CreatingPlayback } from "../search-flow/CreatingPlayback";
import { FinishProcessing } from "../search-flow/FinishProcessing";
import { FreeRecordingMode } from "../search-flow/FreeRecordingMode";
import { FreeRecordingConfirmDialog } from "../search-flow/FreeRecordingConfirmDialog";
import { SendEmailDialog } from "@/components/customer/SendEmailDialog";
import { saveProject, updateDraftProject } from "@/lib/projectUtils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface UploadFlowContainerProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onBack: () => void;
  onExit: () => void;
  onFlowStepChange?: (step: string) => void; // Notify parent of step changes
  initialFlowStep?: string; // Initial step from URL
}

type UploadFlowStep = 
  | 'upload'
  | 'processing'
  | 'splitting'
  | 'ready-record'
  | 'recording'
  | 'free-recording'
  | 'creating-playback'
  | 'finish';

export function UploadFlowContainer({ 
  projectData, 
  updateProjectData, 
  onBack, 
  onExit,
  onFlowStepChange,
  initialFlowStep
}: UploadFlowContainerProps) {
  const navigate = useNavigate();
  
  // Determine initial step based on resume state or URL
  const getInitialStep = (): UploadFlowStep => {
    // If resuming with valid data, check for ready-record
    if (projectData.resumeProjectId && projectData.songSections && projectData.songSections.length > 0) {
      return 'ready-record';
    }
    
    // Check URL - but only for steps that make sense without full data
    if (initialFlowStep) {
      // Steps that require projectData to be populated
      const dataRequiredSteps: UploadFlowStep[] = ['ready-record', 'recording', 'creating-playback', 'finish'];
      
      if (dataRequiredSteps.includes(initialFlowStep as UploadFlowStep)) {
        // Check if we have the required data
        if (!projectData.instrumentalUrl && !(projectData.songSections && projectData.songSections.length > 0)) {
          // No data, go back to upload
          return 'upload';
        }
      }
      
      const validSteps: UploadFlowStep[] = ['upload', 'processing', 'splitting', 'ready-record', 'recording', 'creating-playback', 'finish'];
      if (validSteps.includes(initialFlowStep as UploadFlowStep)) {
        return initialFlowStep as UploadFlowStep;
      }
    }
    
    return 'upload';
  };

  const [currentStep, setCurrentStep] = useState<UploadFlowStep>(getInitialStep);
  const [recordingVerseIndex, setRecordingVerseIndex] = useState(0);
  const [isRecordingAdditionalTrack, setIsRecordingAdditionalTrack] = useState(false);
  const [draftProjectId, setDraftProjectId] = useState<string | null>(
    projectData.resumeProjectId || null
  );
  const [showFreeRecordingConfirm, setShowFreeRecordingConfirm] = useState(false);
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

  // Notify parent of step changes
  useEffect(() => {
    onFlowStepChange?.(currentStep);
  }, [currentStep, onFlowStepChange]);

  // Check if resuming and has data - skip to ready-record
  useEffect(() => {
    if (projectData.resumeProjectId && projectData.songSections && projectData.songSections.length > 0) {
      if (currentStep === 'upload') {
        setCurrentStep('ready-record');
      }
    }
  }, [projectData.resumeProjectId, projectData.songSections]);

  const goToStep = (step: UploadFlowStep) => {
    setCurrentStep(step);
  };

  const handleStartRecording = (verseIndex: number, isAdditionalTrack: boolean = false) => {
    setRecordingVerseIndex(verseIndex);
    setIsRecordingAdditionalTrack(isAdditionalTrack);
    goToStep('recording');
  };

  const handleSwitchToFreeRecording = () => {
    setShowFreeRecordingConfirm(true);
  };

  const confirmFreeRecording = () => {
    setShowFreeRecordingConfirm(false);
    goToStep('free-recording');
  };

  const handleSaveWithoutProcessing = async () => {
    try {
      // Save or update the draft project
      if (draftProjectId) {
        const success = await updateDraftProject(draftProjectId, projectData, 'ready-record');
        if (success) {
          toast.success('הפרויקט נשמר בהצלחה');
        }
      } else {
        const projectId = await saveProject({
          projectData: { ...projectData, backgroundMusic: 'upload' },
          status: 'open',
          currentFlowStep: 'ready-record'
        });
        if (projectId) {
          setDraftProjectId(projectId);
          toast.success('הפרויקט נשמר בהצלחה');
        }
      }
      // Navigate back to dashboard
      navigate('/customer/open-projects');
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('שגיאה בשמירת הפרויקט');
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'upload':
        return (
          <UploadPlayback
            projectData={projectData}
            updateProjectData={updateProjectData}
            onNext={() => goToStep('processing')}
            onBack={onBack}
          />
        );
      case 'processing':
        return (
          <UploadProcessing
            projectData={projectData}
            updateProjectData={updateProjectData}
            onNext={() => goToStep('splitting')}
            onError={() => onBack()}
          />
        );
      case 'splitting':
        return (
          <SplittingInstrumental
            projectData={projectData}
            updateProjectData={updateProjectData}
            onNext={() => goToStep('ready-record')}
            onError={() => goToStep('ready-record')}
          />
        );
      case 'ready-record':
        return (
          <ReadyToRecord
            projectData={projectData}
            updateProjectData={updateProjectData}
            onStartRecording={handleStartRecording}
            onBack={() => goToStep('upload')}
            onSaveWithProcessing={() => goToStep('creating-playback')}
            onSaveWithoutProcessing={handleSaveWithoutProcessing}
            onSwitchToFreeRecording={handleSwitchToFreeRecording}
          />
        );
      case 'recording':
        return (
          <RecordingScreen
            projectData={projectData}
            updateProjectData={updateProjectData}
            verseIndex={recordingVerseIndex}
            isAdditionalTrack={isRecordingAdditionalTrack}
            onFinish={() => goToStep('ready-record')}
            onBack={() => goToStep('ready-record')}
          />
        );
      case 'free-recording':
        return (
          <FreeRecordingMode
            projectData={projectData}
            updateProjectData={updateProjectData}
            onBack={() => goToStep('ready-record')}
            onSaveWithProcessing={() => goToStep('creating-playback')}
            onSaveWithoutProcessing={handleSaveWithoutProcessing}
          />
        );
      case 'creating-playback':
        return (
          <CreatingPlayback
            projectData={projectData}
            updateProjectData={updateProjectData}
            onNext={() => goToStep('finish')}
            onError={(error) => {
              console.error('Processing error:', error);
              goToStep('finish'); // Continue anyway
            }}
          />
        );
      case 'finish':
        return (
          <FinishProcessing
            projectData={projectData}
            onReRecord={() => goToStep('ready-record')}
            onDownload={() => console.log('Download')}
            onSendEmail={handleSendEmail}
            onExit={onExit}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      {renderStep()}
      
      {/* Free Recording Confirmation Dialog */}
      <FreeRecordingConfirmDialog
        open={showFreeRecordingConfirm}
        onOpenChange={setShowFreeRecordingConfirm}
        onConfirm={confirmFreeRecording}
      />

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
