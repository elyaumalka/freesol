import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ProjectData } from "@/pages/customer/NewProject";
import { SearchPlayback } from "./SearchPlayback";
import { SeparatingVocals } from "./SeparatingVocals";
import { AnalyzingPlayback } from "./AnalyzingPlayback";
import { SplittingInstrumental } from "./SplittingInstrumental";
import { CreatingPlayback } from "./CreatingPlayback";
import { ReadyToRecord } from "./ReadyToRecord";
import { RecordingScreen } from "./RecordingScreen";
import { FinishProcessing } from "./FinishProcessing";
import { FreeRecordingMode } from "./FreeRecordingMode";
import { FreeRecordingConfirmDialog } from "./FreeRecordingConfirmDialog";
import { SendEmailDialog } from "@/components/customer/SendEmailDialog";
import { saveProject, updateDraftProject, clearAutoSavedProject } from "@/lib/projectUtils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SearchFlowContainerProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onBack: () => void; // Go back to choose type screen
  onExit: () => void; // Exit project completely
  onFlowStepChange?: (step: string) => void; // Notify parent of step changes
  initialFlowStep?: string; // Initial step from URL
}

type SearchFlowStep = 
  | 'search'
  | 'separating'
  | 'analyzing'
  | 'splitting'
  | 'ready-record'
  | 'recording'
  | 'free-recording'
  | 'processing'
  | 'finish';

export function SearchFlowContainer({ 
  projectData, 
  updateProjectData, 
  onBack, 
  onExit,
  onFlowStepChange,
  initialFlowStep
}: SearchFlowContainerProps) {
  const navigate = useNavigate();
  
  // Determine initial step based on resume state or URL
  const getInitialStep = (): SearchFlowStep => {
    // If resuming with valid data, check for ready-record
    if (projectData.resumeProjectId && projectData.songSections && projectData.songSections.length > 0) {
      return 'ready-record';
    }
    
    // Check URL - but only for steps that make sense without full data
    if (initialFlowStep) {
      // Steps that require projectData to be populated
      const dataRequiredSteps: SearchFlowStep[] = ['ready-record', 'recording', 'processing', 'finish'];
      
      if (dataRequiredSteps.includes(initialFlowStep as SearchFlowStep)) {
        // Check if we have the required data
        if (!projectData.playbackId && !projectData.instrumentalUrl && !(projectData.songSections && projectData.songSections.length > 0)) {
          // No data, go back to search
          return 'search';
        }
      }
      
      const validSteps: SearchFlowStep[] = ['search', 'separating', 'analyzing', 'splitting', 'ready-record', 'recording', 'processing', 'finish'];
      if (validSteps.includes(initialFlowStep as SearchFlowStep)) {
        return initialFlowStep as SearchFlowStep;
      }
    }
    
    return 'search';
  };

  const [currentStep, setCurrentStep] = useState<SearchFlowStep>(getInitialStep);
  const [recordingSectionIndex, setRecordingSectionIndex] = useState(0);
  const [isRecordingAdditionalTrack, setIsRecordingAdditionalTrack] = useState(false);
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

  // Update step when projectData changes (for resume)
  useEffect(() => {
    if (projectData.resumeProjectId && projectData.songSections && projectData.songSections.length > 0) {
      if (currentStep === 'search') {
        setCurrentStep('ready-record');
      }
    }
  }, [projectData.resumeProjectId, projectData.songSections]);

  const goToStep = (step: SearchFlowStep) => {
    setCurrentStep(step);
  };

  const getTitle = () => {
    switch (currentStep) {
      case 'search':
        return 'בחירת פלייבק מהמאגר';
      case 'separating':
        return 'הפרדת קול ומוזיקה';
      case 'analyzing':
        return 'ניתוח מבנה השיר';
      case 'splitting':
        return 'חיתוך אינסטרומנטל';
      case 'ready-record':
        return 'קדימה מוכנים להקליט....';
      case 'recording':
        return 'הקלטות';
      case 'free-recording':
        return 'הקלטה';
      case 'processing':
        return 'תכנון בית ופזמון';
      case 'finish':
        return 'סיום עיבוד';
      default:
        return '';
    }
  };

  const handleSwitchToFreeRecording = () => {
    setShowFreeRecordingConfirm(true);
  };

  const confirmFreeRecording = () => {
    setShowFreeRecordingConfirm(false);
    goToStep('free-recording');
  };

  const handleStartRecording = (sectionIndex: number, isAdditionalTrack: boolean = false) => {
    setRecordingSectionIndex(sectionIndex);
    setIsRecordingAdditionalTrack(isAdditionalTrack);
    goToStep('recording');
  };

  const handleSaveWithoutProcessing = async () => {
    try {
      let success = false;
      if (projectData.resumeProjectId) {
        // Update existing project
        success = await updateDraftProject(projectData.resumeProjectId, projectData, 'ready-record');
      } else {
        // Create new draft project
        const projectId = await saveProject({
          projectData: projectData,
          status: 'open',
          currentFlowStep: 'ready-record',
        });
        success = !!projectId;
      }
      
      if (success) {
        // Clear auto-save since we saved to database
        clearAutoSavedProject();
        navigate('/customer/open-projects');
      }
    } catch (error) {
      console.error('Error saving project:', error);
      toast.error('שגיאה בשמירת הפרויקט');
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'search':
        return (
          <SearchPlayback
            projectData={projectData}
            updateProjectData={updateProjectData}
            onNext={() => {
              // If playback already has pre-processed sections, go to splitting
              if (projectData.songSections && projectData.songSections.length > 0) {
                console.log('Using pre-processed sections, going to split instrumental');
                goToStep('splitting');
              } else {
                // Fallback: run analysis (shouldn't happen with new flow)
                goToStep('analyzing');
              }
            }}
            onBack={onBack}
          />
        );
      case 'analyzing':
        return (
          <AnalyzingPlayback
            projectData={projectData}
            updateProjectData={updateProjectData}
            onNext={() => goToStep('separating')}
            onError={() => goToStep('separating')}
          />
        );
      case 'separating':
        return (
          <SeparatingVocals
            projectData={projectData}
            updateProjectData={updateProjectData}
            onNext={() => goToStep('splitting')}
            onError={() => goToStep('splitting')}
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
            onBack={() => goToStep('search')}
            onSaveWithProcessing={() => goToStep('processing')}
            onSaveWithoutProcessing={handleSaveWithoutProcessing}
            onSwitchToFreeRecording={handleSwitchToFreeRecording}
          />
        );
      case 'recording':
        return (
          <RecordingScreen
            projectData={projectData}
            updateProjectData={updateProjectData}
            verseIndex={recordingSectionIndex}
            isAdditionalTrack={isRecordingAdditionalTrack}
            dryRecordingMode={true}
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
            onSaveWithProcessing={() => goToStep('processing')}
            onSaveWithoutProcessing={handleSaveWithoutProcessing}
          />
        );
      case 'processing':
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
