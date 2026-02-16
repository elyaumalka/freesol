import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProjectData, SongSection } from "@/pages/customer/NewProject";

// Helper function to get audio duration from URL
function getAudioDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration);
    });
    audio.addEventListener('error', (e) => {
      reject(e);
    });
    // Set a timeout to prevent hanging
    setTimeout(() => reject(new Error('Timeout loading audio')), 10000);
    audio.src = url;
  });
}

// Serializable project state for database storage
interface SerializableProjectState {
  projectName: string;
  backgroundMusic: string | null;
  playbackId: string | null;
  playbackName: string | null;
  verses: any[];
  recordedAudioUrl?: string;
  generatedPlaybackUrl?: string;
  generatedSongUrl?: string;
  originalVocalsUrl?: string;
  vocalsUrl?: string;
  instrumentalUrl?: string;
  songSections?: SongSection[];
  songDuration?: number;
  musicStyle?: string;
  musicStyleTags?: string;
  musicStyleNegativeTags?: string;
  introUrl?: string;
  outroUrl?: string;
  // Flow state
  currentFlowStep?: string;
}

interface SaveProjectParams {
  projectData: ProjectData;
  status?: 'open' | 'recording' | 'processing' | 'completed';
  currentFlowStep?: string;
}

export async function saveProject({ projectData, status = 'open', currentFlowStep }: SaveProjectParams): Promise<string | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      toast.error('יש להתחבר למערכת');
      return null;
    }

    const userId = sessionData.session.user.id;

    // Map backgroundMusic to project_type
    const projectType = projectData.backgroundMusic === 'ai' ? 'ai' : 
                        projectData.backgroundMusic === 'upload' ? 'upload' : 'search';

    // Create serializable state (exclude non-serializable items like File and Blob)
    const serializableState: SerializableProjectState = {
      projectName: projectData.projectName,
      backgroundMusic: projectData.backgroundMusic,
      playbackId: projectData.playbackId,
      playbackName: projectData.playbackName,
      verses: projectData.verses,
      recordedAudioUrl: projectData.recordedAudioUrl,
      generatedPlaybackUrl: projectData.generatedPlaybackUrl,
      generatedSongUrl: projectData.generatedSongUrl,
      originalVocalsUrl: projectData.originalVocalsUrl,
      vocalsUrl: projectData.vocalsUrl,
      instrumentalUrl: projectData.instrumentalUrl,
      songSections: projectData.songSections,
      songDuration: projectData.songDuration,
      musicStyle: projectData.musicStyle,
      musicStyleTags: projectData.musicStyleTags,
      musicStyleNegativeTags: projectData.musicStyleNegativeTags,
      introUrl: projectData.introUrl,
      outroUrl: projectData.outroUrl,
      currentFlowStep: currentFlowStep,
    };

    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        song_name: projectData.projectName || 'פרויקט חדש',
        project_type: projectType,
        playback_id: projectData.playbackId,
        status: status,
        verses: serializableState as any,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error saving project:', error);
      toast.error('שגיאה בשמירת הפרויקט');
      return null;
    }

    toast.success('הפרויקט נשמר בהצלחה!');
    return data.id;
  } catch (error) {
    console.error('Error saving project:', error);
    toast.error('שגיאה בשמירת הפרויקט');
    return null;
  }
}

export async function updateProject(
  projectId: string, 
  updates: Partial<{
    song_name: string;
    status: string;
    verses: any;
    playback_id: string;
  }>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('projects')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (error) {
      console.error('Error updating project:', error);
      toast.error('שגיאה בעדכון הפרויקט');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating project:', error);
    return false;
  }
}

// Update existing draft project state
export async function updateDraftProject(
  projectId: string,
  projectData: ProjectData,
  currentFlowStep?: string
): Promise<boolean> {
  try {
    const projectType = projectData.backgroundMusic === 'ai' ? 'ai' : 
                        projectData.backgroundMusic === 'upload' ? 'upload' : 'search';

    const serializableState: SerializableProjectState = {
      projectName: projectData.projectName,
      backgroundMusic: projectData.backgroundMusic,
      playbackId: projectData.playbackId,
      playbackName: projectData.playbackName,
      verses: projectData.verses,
      recordedAudioUrl: projectData.recordedAudioUrl,
      generatedPlaybackUrl: projectData.generatedPlaybackUrl,
      generatedSongUrl: projectData.generatedSongUrl,
      originalVocalsUrl: projectData.originalVocalsUrl,
      vocalsUrl: projectData.vocalsUrl,
      instrumentalUrl: projectData.instrumentalUrl,
      songSections: projectData.songSections,
      songDuration: projectData.songDuration,
      musicStyle: projectData.musicStyle,
      musicStyleTags: projectData.musicStyleTags,
      musicStyleNegativeTags: projectData.musicStyleNegativeTags,
      introUrl: projectData.introUrl,
      outroUrl: projectData.outroUrl,
      currentFlowStep: currentFlowStep,
    };

    const { error } = await supabase
      .from('projects')
      .update({
        song_name: projectData.projectName || 'פרויקט חדש',
        project_type: projectType,
        playback_id: projectData.playbackId,
        verses: serializableState as any,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (error) {
      console.error('Error updating draft project:', error);
      toast.error('שגיאה בעדכון הפרויקט');
      return false;
    }

    toast.success('הפרויקט נשמר בהצלחה!');
    return true;
  } catch (error) {
    console.error('Error updating draft project:', error);
    return false;
  }
}

// Restore project data from stored state
export function restoreProjectData(storedState: SerializableProjectState): Partial<ProjectData> {
  return {
    projectName: storedState.projectName,
    backgroundMusic: storedState.backgroundMusic,
    playbackId: storedState.playbackId,
    playbackName: storedState.playbackName,
    verses: storedState.verses || [],
    recordedAudioUrl: storedState.recordedAudioUrl,
    generatedPlaybackUrl: storedState.generatedPlaybackUrl,
    generatedSongUrl: storedState.generatedSongUrl,
    originalVocalsUrl: storedState.originalVocalsUrl,
    vocalsUrl: storedState.vocalsUrl,
    instrumentalUrl: storedState.instrumentalUrl,
    songSections: storedState.songSections,
    songDuration: storedState.songDuration,
    musicStyle: storedState.musicStyle,
    musicStyleTags: storedState.musicStyleTags,
    musicStyleNegativeTags: storedState.musicStyleNegativeTags,
    introUrl: storedState.introUrl,
    outroUrl: storedState.outroUrl,
    uploadedFile: null,
    recordedAudio: null,
  };
}

// Get draft projects for current user
export async function getDraftProjects() {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return [];
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', sessionData.session.user.id)
      .eq('status', 'open')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching draft projects:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching draft projects:', error);
    return [];
  }
}

// Save completed project and recording
interface SaveCompletedProjectParams {
  projectData: ProjectData;
}

export async function saveCompletedProject({ projectData }: SaveCompletedProjectParams): Promise<{ projectId: string | null; recordingId: string | null }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      toast.error('יש להתחבר למערכת');
      return { projectId: null, recordingId: null };
    }

    const userId = sessionData.session.user.id;

    // Map backgroundMusic to project_type
    const projectType = projectData.backgroundMusic === 'ai' ? 'ai' : 
                        projectData.backgroundMusic === 'upload' ? 'upload' : 'search';

    // Save project as completed
    const { data: projectResult, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        song_name: projectData.projectName || 'פרויקט חדש',
        project_type: projectType,
        playback_id: projectData.playbackId,
        status: 'completed',
        verses: projectData.verses as any,
      })
      .select('id')
      .single();

    if (projectError) {
      console.error('Error saving project:', projectError);
      toast.error('שגיאה בשמירת הפרויקט');
      return { projectId: null, recordingId: null };
    }

    const projectId = projectResult.id;

    // Get final audio URL - prioritize the fully mastered/merged song
    const audioUrl = projectData.generatedSongUrl ||  // Final merged song
                     projectData.generatedPlaybackUrl ||  // Generated playback
                     projectData.vocalsUrl ||  // Mastered vocals
                     projectData.songSections?.find(s => s.userRecordingUrl)?.userRecordingUrl ||  // Section recording
                     projectData.verses.find(v => v.audioUrl)?.audioUrl;  // Verse recording
    
    console.log('Saving recording with audio URL:', audioUrl);

    // Calculate total duration from verses or use provided duration
    let totalDuration = '0:00';
    let totalSeconds = 0;
    
    // First try to calculate from verses
    projectData.verses.forEach(verse => {
      if (verse.duration) {
        const parts = verse.duration.split(':');
        if (parts.length === 2) {
          totalSeconds += parseInt(parts[0]) * 60 + parseInt(parts[1]);
        } else if (parts.length === 3) {
          // Handle mm:ss:ms format
          totalSeconds += parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
      }
    });
    
    // If we have an audio URL, try to get the actual duration
    if (audioUrl && totalSeconds === 0) {
      try {
        const audioDuration = await getAudioDuration(audioUrl);
        if (audioDuration > 0) {
          totalSeconds = Math.round(audioDuration);
        }
      } catch (e) {
        console.log('Could not get audio duration:', e);
      }
    }
    
    if (totalSeconds > 0) {
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      totalDuration = `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Save recording to recordings table
    let recordingId: string | null = null;
    if (audioUrl) {
      const { data: recordingResult, error: recordingError } = await supabase
        .from('recordings')
        .insert({
          user_id: userId,
          project_id: projectId,
          song_name: projectData.projectName || 'הקלטה חדשה',
          audio_url: audioUrl,
          duration: totalDuration,
        })
        .select('id')
        .single();

      if (recordingError) {
        console.error('Error saving recording:', recordingError);
        // Don't fail the whole operation if recording save fails
      } else {
        recordingId = recordingResult.id;
      }
    }

    toast.success('הפרויקט וההקלטה נשמרו בהצלחה!');
    return { projectId, recordingId };
  } catch (error) {
    console.error('Error saving completed project:', error);
    toast.error('שגיאה בשמירת הפרויקט');
    return { projectId: null, recordingId: null };
  }
}

// ============ localStorage Auto-Save Functions ============

const LOCAL_STORAGE_KEY = 'freesol_project_autosave';

// Auto-save project data to localStorage (for recovery on refresh)
export function autoSaveProject(projectData: ProjectData, flowStep?: string): void {
  try {
    const saveData = {
      projectName: projectData.projectName,
      backgroundMusic: projectData.backgroundMusic,
      playbackId: projectData.playbackId,
      playbackName: projectData.playbackName,
      verses: projectData.verses,
      recordedAudioUrl: projectData.recordedAudioUrl,
      generatedPlaybackUrl: projectData.generatedPlaybackUrl,
      generatedSongUrl: projectData.generatedSongUrl,
      originalVocalsUrl: projectData.originalVocalsUrl,
      vocalsUrl: projectData.vocalsUrl,
      instrumentalUrl: projectData.instrumentalUrl,
      songSections: projectData.songSections,
      songDuration: projectData.songDuration,
      musicStyle: projectData.musicStyle,
      musicStyleTags: projectData.musicStyleTags,
      musicStyleNegativeTags: projectData.musicStyleNegativeTags,
      introUrl: projectData.introUrl,
      outroUrl: projectData.outroUrl,
      flowStep: flowStep,
      savedAt: Date.now(),
    };
    
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saveData));
    console.log('Project auto-saved to localStorage');
  } catch (error) {
    console.error('Error auto-saving project:', error);
  }
}

// Load auto-saved project data from localStorage
export function loadAutoSavedProject(): { projectData: Partial<ProjectData>; flowStep?: string } | null {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!saved) return null;
    
    const data = JSON.parse(saved);
    
    // Check if data is less than 24 hours old
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (Date.now() - data.savedAt > twentyFourHours) {
      clearAutoSavedProject();
      return null;
    }
    
    // Only return if there's meaningful data
    if (!data.projectName && !data.playbackId && (!data.songSections || data.songSections.length === 0)) {
      return null;
    }
    
    return {
      projectData: {
        projectName: data.projectName,
        backgroundMusic: data.backgroundMusic,
        playbackId: data.playbackId,
        playbackName: data.playbackName,
        verses: data.verses || [],
        recordedAudioUrl: data.recordedAudioUrl,
        generatedPlaybackUrl: data.generatedPlaybackUrl,
        generatedSongUrl: data.generatedSongUrl,
        originalVocalsUrl: data.originalVocalsUrl,
        vocalsUrl: data.vocalsUrl,
        instrumentalUrl: data.instrumentalUrl,
        songSections: data.songSections,
        songDuration: data.songDuration,
        musicStyle: data.musicStyle,
        musicStyleTags: data.musicStyleTags,
        musicStyleNegativeTags: data.musicStyleNegativeTags,
        introUrl: data.introUrl,
        outroUrl: data.outroUrl,
        uploadedFile: null,
        recordedAudio: null,
      },
      flowStep: data.flowStep,
    };
  } catch (error) {
    console.error('Error loading auto-saved project:', error);
    return null;
  }
}

// Clear auto-saved project data
export function clearAutoSavedProject(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    console.log('Auto-save cleared');
  } catch (error) {
    console.error('Error clearing auto-save:', error);
  }
}