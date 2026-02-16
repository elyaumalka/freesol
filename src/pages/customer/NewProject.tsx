import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { NewProjectLayout } from "@/components/customer/new-project/NewProjectLayout";
import { NewProjectStep1 } from "@/components/customer/new-project/NewProjectStep1";
import { NewProjectStep2 } from "@/components/customer/new-project/NewProjectStep2";
import { SearchFlowContainer } from "@/components/customer/new-project/search-flow/SearchFlowContainer";
import { UploadFlowContainer } from "@/components/customer/new-project/upload-flow/UploadFlowContainer";
import { AIFlowContainer } from "@/components/customer/new-project/ai-flow/AIFlowContainer";
import { NarrationFlowContainer } from "@/components/customer/new-project/narration-flow/NarrationFlowContainer";
import { supabase } from "@/integrations/supabase/client";
import { restoreProjectData, loadAutoSavedProject, autoSaveProject, clearAutoSavedProject } from "@/lib/projectUtils";

export interface SectionRecording {
  id: string;
  audioUrl: string;
  label: string; // e.g., "קול ראשי", "קול שני", "הרמוניה"
  createdAt: number;
}

export interface SongSection {
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro';
  label: string;
  startTime: number;
  endTime: number;
  duration: number;
  userRecordingUrl?: string; // Main recording (kept for backward compatibility)
  recordings?: SectionRecording[]; // Multiple recording layers
  segmentUrl?: string; // Pre-cut instrumental segment file URL
}

export interface VerseData {
  id: number;
  type: 'verse' | 'chorus';
  text: string;
  audioUrl?: string;           // Initial vocal recording URL
  duration?: string;
  instrumentalUrl?: string;    // Generated instrumental URL for this section
  finalRecordingUrl?: string;  // Final recording with user vocals over instrumental
}

export interface ProjectData {
  projectName: string;
  backgroundMusic: string | null; // 'search' | 'upload' | 'ai'
  playbackId: string | null;
  playbackName: string | null;
  uploadedFile: File | null;
  verses: VerseData[];
  recordedAudio: Blob | null;
  recordedAudioUrl?: string;
  generatedPlaybackUrl?: string; // The complete song from Suno (with AI vocals)
  generatedSongUrl?: string; // Full AI-generated song URL (final merged)
  originalVocalsUrl?: string; // User's original vocals recording
  vocalsUrl?: string; // The merged vocals recording
  instrumentalUrl?: string; // The instrumental from Suno
  songSections?: SongSection[]; // Analyzed song structure from AI
  songDuration?: number; // Total song duration in seconds
  // Music style for AI flow
  musicStyle?: string; // 'acoustic' | 'rock' | 'upbeat' | 'electronic' | 'orchestral' | 'drums'
  musicStyleTags?: string; // Tags for Suno API
  musicStyleNegativeTags?: string; // Negative tags for Suno API
  // Intro/Outro
  introUrl?: string; // Generated intro URL
  outroUrl?: string; // Generated outro URL
  // Resume editing
  resumeProjectId?: string;
  // AI Flow - tempo settings
  aiTimeSignature?: string; // '4/4', '3/4', '6/8', '2/4'
  aiBpm?: number; // BPM for metronome
  aiVocalsUrl?: string; // Initial vocals recording with metronome
  aiRecordingDuration?: number; // Duration of AI recording in seconds
  bgMusicVolume?: number; // Background music volume 0-1 (default 0.6)
  voiceVolume?: number; // Voice/vocals volume 0-2 (default 1.5, allows boost up to 200%)
  voiceOffsetMs?: number; // Latency compensation offset in ms (-300 to +300, default 0)
}

// Main flow:
// 1: Project name
// 2: Choose playback type (search/upload/ai)
// Then branch to separate flows based on selection

type MainStep = 'name' | 'choose-type' | 'search-flow' | 'upload-flow' | 'ai-flow' | 'narration-flow';

export default function NewProject() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const resumeId = searchParams.get('resume');
  
  // Check if this is a fresh navigation (no session) - if so, clear URL params
  const sessionKey = 'freesol_project_session';
  const hasExistingSession = !!sessionStorage.getItem(sessionKey);
  
  // Get initial step from URL or default to 'name'
  // Only use URL params if there's an existing session OR resumeId
  const getInitialStep = (): MainStep => {
    // If no session and no resume ID, always start fresh
    if (!hasExistingSession && !resumeId) {
      return 'name';
    }
    
    const urlStep = searchParams.get('step') as MainStep;
    const validSteps: MainStep[] = ['name', 'choose-type', 'search-flow', 'upload-flow', 'ai-flow', 'narration-flow'];
    if (urlStep && validSteps.includes(urlStep)) {
      return urlStep;
    }
    return 'name';
  };

  const [currentStep, setCurrentStep] = useState<MainStep>(getInitialStep);
  const [savedFlowStep, setSavedFlowStep] = useState<string | undefined>(
    (hasExistingSession || resumeId) ? (searchParams.get('flowStep') || undefined) : undefined
  );
  const [projectData, setProjectData] = useState<ProjectData>({
    projectName: "",
    backgroundMusic: null,
    playbackId: null,
    playbackName: null,
    uploadedFile: null,
    verses: [],
    recordedAudio: null,
  });
  const [isLoading, setIsLoading] = useState(!!resumeId);

  // Check for payment return
  const paymentStatus = searchParams.get('playback_payment');
  const paybackIdFromPayment = searchParams.get('playback_id');

  // Update URL when step changes
  const updateStepInUrl = useCallback((step: MainStep, flowStep?: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('step', step);
    if (flowStep) {
      newParams.set('flowStep', flowStep);
    } else {
      newParams.delete('flowStep');
    }
    // Preserve important params
    if (resumeId) newParams.set('resume', resumeId);
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams, resumeId]);

  // Wrapped setCurrentStep to also update URL
  const goToStep = useCallback((step: MainStep) => {
    setCurrentStep(step);
    updateStepInUrl(step);
  }, [updateStepInUrl]);

  // Update flow step in URL (for sub-flows)
  const updateFlowStep = useCallback((flowStep: string) => {
    updateStepInUrl(currentStep, flowStep);
  }, [currentStep, updateStepInUrl]);

  // Load project data if resuming or check for auto-saved data
  useEffect(() => {
    if (resumeId) {
      loadResumeProject(resumeId);
    } else if (paymentStatus === 'success' && paybackIdFromPayment) {
      // Returning from successful playback payment
      // Mark session as active and go to search flow (which will handle loading the playback)
      sessionStorage.setItem('freesol_project_session', 'active');
      
      // Restore auto-saved data if available (project name, etc.)
      const autoSaved = loadAutoSavedProject();
      if (autoSaved && autoSaved.projectData) {
        setProjectData(prev => ({
          ...prev,
          ...autoSaved.projectData,
        }));
      }
      
      // Navigate to search flow - SearchPlayback will handle fetching playback data
      goToStep('search-flow');
    } else {
      // Check if this is a fresh navigation or a page refresh
      const sessionKey = 'freesol_project_session';
      const existingSession = sessionStorage.getItem(sessionKey);
      
      if (existingSession) {
        // Page was refreshed - restore auto-saved data
        const autoSaved = loadAutoSavedProject();
        if (autoSaved && autoSaved.projectData) {
          console.log('Restoring auto-saved project from localStorage (page refresh)');
          setProjectData(prev => ({
            ...prev,
            ...autoSaved.projectData,
          }));
          
          // Navigate to appropriate flow based on saved data
          const bgMusic = autoSaved.projectData.backgroundMusic;
          if (autoSaved.flowStep) {
            setSavedFlowStep(autoSaved.flowStep);
          }
          
          if (bgMusic === 'search') {
            goToStep('search-flow');
          } else if (bgMusic === 'upload') {
            goToStep('upload-flow');
          } else if (bgMusic === 'ai') {
            goToStep('ai-flow');
          } else if (bgMusic === 'narration') {
            goToStep('narration-flow');
          }
        }
      } else {
        // Fresh navigation - clear any old auto-save and start fresh
        clearAutoSavedProject();
      }
      
      // Mark this session as active
      sessionStorage.setItem(sessionKey, 'active');
    }
  }, [resumeId, paymentStatus, paybackIdFromPayment]);

  const loadResumeProject = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error || !data) {
        console.error('Error loading project:', error);
        setIsLoading(false);
        return;
      }

      // Restore project data from stored state
      const storedState = data.verses as any;
      if (storedState && typeof storedState === 'object' && !Array.isArray(storedState)) {
        const restoredData = restoreProjectData(storedState);
        setProjectData(prev => ({
          ...prev,
          ...restoredData,
          resumeProjectId: projectId,
        }));

        // Restore saved flow step from project state if not in URL
        if (storedState.currentFlowStep && !searchParams.get('flowStep')) {
          setSavedFlowStep(storedState.currentFlowStep);
        }

        // Navigate to appropriate flow based on background music type
        const bgMusic = storedState.backgroundMusic;

        if (bgMusic === 'search') {
          goToStep('search-flow');
        } else if (bgMusic === 'upload') {
          goToStep('upload-flow');
        } else if (bgMusic === 'ai') {
          goToStep('ai-flow');
        } else if (bgMusic === 'narration') {
          goToStep('narration-flow');
        } else {
          goToStep('name');
        }
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading project:', error);
      setIsLoading(false);
    }
  };

  const updateProjectData = (data: Partial<ProjectData>) => {
    setProjectData(prev => ({ ...prev, ...data }));
  };

  const handleSelectOption = (option: 'search' | 'upload' | 'ai' | 'narration') => {
    // Navigate directly based on the passed option
    switch (option) {
      case 'search':
        goToStep('search-flow');
        break;
      case 'upload':
        goToStep('upload-flow');
        break;
      case 'ai':
        goToStep('ai-flow');
        break;
      case 'narration':
        goToStep('narration-flow');
        break;
    }
  };

  const handleExit = () => {
    // Clear the session flag so next "new project" starts fresh
    sessionStorage.removeItem('freesol_project_session');
    // Clear auto-saved project data
    clearAutoSavedProject();
    navigate('/customer/dashboard');
  };

  const getStepTitle = () => {
    const flowStep = searchParams.get('flowStep');
    
    // Search flow titles
    if (currentStep === 'search-flow') {
      switch (flowStep) {
        case 'search':
          return "בחירת פלייבק מהמאגר";
        case 'separating':
          return "הפרדת קול ומוזיקה";
        case 'analyzing':
          return "ניתוח מבנה השיר";
        case 'ready-record':
          return "קדימה מוכנים להקליט....";
        case 'recording':
        case 'free-recording':
          return "הקלטה";
        case 'processing':
          return "תכנון בית ופזמון";
        case 'finish':
          return "סיום עיבוד";
        default:
          return "בחירת פלייבק מהמאגר";
      }
    }
    
    // Upload flow titles
    if (currentStep === 'upload-flow') {
      switch (flowStep) {
        case 'upload':
          return "העלאת קובץ";
        case 'processing':
          return "תכנון בית ופזמון";
        case 'ready-record':
          return "קדימה מוכנים להקליט....";
        case 'recording':
          return "הקלטות";
        case 'finish':
          return "סיום עיבוד";
        default:
          return "העלאת קובץ";
      }
    }
    
    // AI flow titles
    if (currentStep === 'ai-flow') {
      switch (flowStep) {
        case 'select-tempo':
          return "הגדרות קצב";
        case 'metronome-recording':
          return "הקלטה ליצירת פלייבק";
        case 'select-style':
          return "בחירת סגנון מוזיקה";
        case 'processing':
          return "יצירת ליווי מוזיקלי";
        case 'final-recording':
          return "הקלטה על הפלייבק";
        case 'finish':
          return "סיום עיבוד";
        default:
          return "יצירת פלייבק AI";
      }
    }
    
    // Narration flow titles
    if (currentStep === 'narration-flow') {
      switch (flowStep) {
        case 'recording':
          return "הקלטת קריינות";
        case 'finish':
          return "סיום הקלטה";
        default:
          return "הקלטת קריינות";
      }
    }
    
    switch (currentStep) {
      case 'choose-type':
        return "בחירת מוזיקת רקע";
      default:
        return undefined;
    }
  };

  const renderStep = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-[#D4A853] text-[24px]" style={{ fontFamily: 'Discovery_Fs' }}>
            טוען פרויקט...
          </p>
        </div>
      );
    }

    switch (currentStep) {
      case 'name':
        return (
          <NewProjectStep1
            projectData={projectData}
            updateProjectData={updateProjectData}
            onNext={() => goToStep('choose-type')}
          />
        );
      case 'choose-type':
        return (
          <NewProjectStep2
            projectData={projectData}
            updateProjectData={updateProjectData}
            onSelectOption={handleSelectOption}
            onBack={() => goToStep('name')}
          />
        );
      case 'search-flow':
        return (
          <SearchFlowContainer
            projectData={projectData}
            updateProjectData={updateProjectData}
            onBack={() => goToStep('choose-type')}
            onExit={handleExit}
            onFlowStepChange={updateFlowStep}
            initialFlowStep={searchParams.get('flowStep') || savedFlowStep}
          />
        );
      case 'upload-flow':
        return (
          <UploadFlowContainer
            projectData={projectData}
            updateProjectData={updateProjectData}
            onBack={() => goToStep('choose-type')}
            onExit={handleExit}
            onFlowStepChange={updateFlowStep}
            initialFlowStep={searchParams.get('flowStep') || savedFlowStep}
          />
        );
      case 'ai-flow':
        return (
          <AIFlowContainer
            projectData={projectData}
            updateProjectData={updateProjectData}
            onBack={() => goToStep('choose-type')}
            onExit={handleExit}
            onFlowStepChange={updateFlowStep}
            initialFlowStep={searchParams.get('flowStep') || savedFlowStep}
          />
        );
      case 'narration-flow':
        return (
          <NarrationFlowContainer
            projectData={projectData}
            updateProjectData={updateProjectData}
            onBack={() => goToStep('choose-type')}
            onExit={handleExit}
            onFlowStepChange={updateFlowStep}
            initialFlowStep={searchParams.get('flowStep') || savedFlowStep}
          />
        );
      default:
        return null;
    }
  };

  return (
    <NewProjectLayout title={getStepTitle()}>
      {renderStep()}
    </NewProjectLayout>
  );
}
