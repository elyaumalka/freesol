import { useEffect, useState, useRef } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Music, Check, AlertCircle } from "lucide-react";

interface SeparatingVocalsProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onNext: () => void;
  onError: () => void;
}

type SeparationStatus = 'starting' | 'processing' | 'success' | 'error';

export function SeparatingVocals({ 
  projectData, 
  updateProjectData, 
  onNext, 
  onError 
}: SeparatingVocalsProps) {
  const [status, setStatus] = useState<SeparationStatus>('starting');
  const [message, setMessage] = useState('שולחים את השיר לעיבוד...');
  const [progress, setProgress] = useState(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const predictionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const startSeparation = async () => {
      try {
        if (!projectData.generatedPlaybackUrl) {
          console.warn('No audio URL provided for vocal separation');
          throw new Error('No audio URL');
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated');
        }

        setProgress(5);

        // Start the separation process
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/separate-vocals`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              audioUrl: projectData.generatedPlaybackUrl,
              title: projectData.playbackName || 'Unknown',
              uploadToStorage: true,
              userId: session.user.id,
              projectName: projectData.projectName || 'project',
            }),
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to start separation');
        }

        predictionIdRef.current = result.predictionId;
        setStatus('processing');
        setMessage('מפרידים קול ומוזיקה באמצעות AI...');
        setProgress(15);

        // Start polling
        startPolling(session.access_token);
      } catch (error) {
        console.error('Error starting vocal separation:', error);
        handleError();
      }
    };

    const startPolling = (accessToken: string) => {
      let attempts = 0;
      const maxAttempts = 120; // Up to 10 minutes (5s intervals)

      pollingRef.current = setInterval(async () => {
        attempts++;
        
        if (!predictionIdRef.current) {
          clearPolling();
          handleError();
          return;
        }

        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const userId = sessionData.session?.user.id;
          
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/separate-vocals`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                predictionId: predictionIdRef.current,
                uploadToStorage: true,
                userId: userId,
                projectName: projectData.projectName || 'project',
              }),
            }
          );

          const result = await response.json();

          // Update progress based on status
          if (result.status === 'starting') {
            setProgress(Math.min(30, 15 + attempts));
            setMessage('מאתחלים את העיבוד...');
          } else if (result.status === 'processing') {
            setProgress(Math.min(85, 30 + attempts * 2));
            setMessage('מפרידים קול ומוזיקה באמצעות AI...');
          }

          if (result.status === 'succeeded' && result.instrumentalUrl) {
            clearPolling();
            setProgress(100);
            setStatus('success');
            setMessage('הפרדת הקולות הושלמה בהצלחה!');

            // Update project data
            updateProjectData({
              originalVocalsUrl: projectData.generatedPlaybackUrl,
              generatedPlaybackUrl: result.instrumentalUrl,
              instrumentalUrl: result.instrumentalUrl,
            });

            setTimeout(() => {
              onNext();
            }, 1500);
            return;
          }

          if (result.status === 'failed' || result.status === 'canceled') {
            clearPolling();
            handleError();
            return;
          }

          if (attempts >= maxAttempts) {
            clearPolling();
            handleError();
          }
        } catch (error) {
          console.error('Polling error:', error);
          if (attempts >= maxAttempts) {
            clearPolling();
            handleError();
          }
        }
      }, 5000);
    };

    const clearPolling = () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };

    const handleError = () => {
      setStatus('error');
      setMessage('שגיאה בהפרדת הקולות. ממשיכים עם השיר המקורי...');
      setTimeout(() => {
        onError();
      }, 2000);
    };

    startSeparation();

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
      {/* Title */}
      <h1 
        className="text-[32px] md:text-[36px] font-bold text-[#D4A853] mb-6 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        הפרדת קול ומוזיקה
      </h1>

      {/* Animated Icon */}
      <div className="relative mb-8">
        {(status === 'starting' || status === 'processing') && (
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-[#D4A853]/20 flex items-center justify-center">
              <Music className="w-12 h-12 text-[#D4A853]" />
            </div>
            <Loader2 className="w-24 h-24 text-[#D4A853] animate-spin absolute top-0 left-0" />
          </div>
        )}
        {status === 'success' && (
          <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center animate-scale-in">
            <Check className="w-12 h-12 text-white" />
          </div>
        )}
        {status === 'error' && (
          <div className="w-24 h-24 rounded-full bg-orange-500 flex items-center justify-center">
            <AlertCircle className="w-12 h-12 text-white" />
          </div>
        )}
      </div>

      {/* Message */}
      <p 
        className="text-[18px] md:text-[20px] text-white text-center mb-6"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        {message}
      </p>

      {/* Progress Bar */}
      {(status === 'starting' || status === 'processing') && (
        <div className="w-full max-w-md">
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#D4A853] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-white/60 text-sm text-center mt-2">
            {Math.round(progress)}%
          </p>
        </div>
      )}

      {/* Info text */}
      {(status === 'starting' || status === 'processing') && (
        <p 
          className="text-[14px] text-white/60 text-center mt-6 max-w-md"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          התהליך עשוי לקחת עד 3 דקות...
          <br />
          אנחנו מסירים את הקול מהשיר כדי שתוכלו להקליט על הפלייבק הנקי
        </p>
      )}
    </div>
  );
}
