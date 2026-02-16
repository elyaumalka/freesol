import { useEffect, useState } from "react";
import { ProjectData, SongSection } from "@/pages/customer/NewProject";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface AnalyzingPlaybackProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onNext: () => void;
  onError: () => void;
}

export function AnalyzingPlayback({ projectData, updateProjectData, onNext, onError }: AnalyzingPlaybackProps) {
  const [status, setStatus] = useState<'analyzing' | 'success' | 'error'>('analyzing');
  const [message, setMessage] = useState('מנתחים את מבנה השיר...');

  useEffect(() => {
    const analyzePlayback = async () => {
      try {
        // Check if we have an audio URL
        if (!projectData.generatedPlaybackUrl) {
          console.warn('No audio URL provided, using default sections');
          throw new Error('No audio URL');
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated');
        }

        setMessage('מזהים פתיח, בית, פזמון וסיום...');

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-song-structure`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              audioUrl: projectData.generatedPlaybackUrl,
              duration: projectData.songDuration || 180,
              title: projectData.playbackName || 'Unknown',
            }),
          }
        );

        if (!response.ok) {
          throw new Error('Analysis failed');
        }

        const result = await response.json();
        console.log('Analysis result:', result);

        if (result.success && result.sections) {
          // Convert sections to SongSection format
          const songSections: SongSection[] = result.sections.map((section: any) => ({
            type: section.type,
            label: section.label,
            startTime: section.startTime,
            endTime: section.endTime,
            duration: section.duration,
          }));

          updateProjectData({
            songSections,
            songDuration: result.sections[result.sections.length - 1]?.endTime || projectData.songDuration,
          });

          setStatus('success');
          setMessage(`נמצאו ${songSections.length} חלקים בשיר!`);
          
          // Wait a moment to show success message
          setTimeout(() => {
            onNext();
          }, 1500);
        } else {
          throw new Error('No sections found');
        }
      } catch (error) {
        console.error('Error analyzing playback:', error);
        setStatus('error');
        setMessage('שגיאה בניתוח השיר. משתמשים במבנה ברירת מחדל...');
        
        // Create default sections
        const duration = projectData.songDuration || 180;
        const defaultSections: SongSection[] = [
          { type: 'intro', label: 'פתיח', startTime: 0, endTime: 15, duration: 15 },
          { type: 'verse', label: 'בית', startTime: 15, endTime: duration * 0.4, duration: duration * 0.4 - 15 },
          { type: 'chorus', label: 'פזמון', startTime: duration * 0.4, endTime: duration * 0.75, duration: duration * 0.35 },
          { type: 'outro', label: 'סיום', startTime: duration * 0.75, endTime: duration, duration: duration * 0.25 },
        ];
        
        updateProjectData({ songSections: defaultSections });
        
        setTimeout(() => {
          onNext();
        }, 2000);
      }
    };

    analyzePlayback();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      {/* Title */}
      <h1 
        className="text-[36px] font-bold text-[#D4A853] mb-8 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        מנתחים את מבנה השיר
      </h1>

      {/* Status Icon */}
      <div className="flex items-center justify-center mb-6">
        {status === 'analyzing' && (
          <Loader2 className="w-16 h-16 text-[#D4A853] animate-spin" />
        )}
        {status === 'success' && (
          <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
            <span className="text-white text-3xl">✓</span>
          </div>
        )}
        {status === 'error' && (
          <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center">
            <span className="text-white text-3xl">!</span>
          </div>
        )}
      </div>

      {/* Message */}
      <p 
        className="text-[20px] text-white text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        {message}
      </p>

      {/* Progress dots */}
      {status === 'analyzing' && (
        <div className="flex gap-2 mt-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full bg-[#D4A853] animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
