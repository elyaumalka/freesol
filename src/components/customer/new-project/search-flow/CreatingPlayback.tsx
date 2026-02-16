import { useEffect, useState, useRef } from "react";
import { ProjectData, SongSection } from "@/pages/customer/NewProject";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreatingPlaybackProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onNext: () => void;
  onError: (error: string) => void;
}

// Helper: poll an edge function until succeeded/failed
async function pollEdgeFunction(
  endpoint: string,
  body: Record<string, any>,
  maxAttempts = 60,
  intervalMs = 5000
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Poll failed: ${response.status}`);
    }

    const result = await response.json();
    if (result.status === "succeeded") return result;
    if (result.status === "failed") throw new Error(result.error || "Processing failed");
    // still processing…
  }
  throw new Error("Processing timed out");
}

// Helper: start an edge function and return its initial response
async function callEdgeFunction(endpoint: string, body: Record<string, any>): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Call failed: ${response.status}`);
  }

  return response.json();
}

// Convert AudioBuffer to WAV Blob (for uploading assembled dry vocals)
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels: Float32Array[] = [];
  let offset = 0;
  let pos = 0;

  setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
  setUint32(0x20746d66); setUint32(16); setUint16(1);
  setUint16(numOfChan); setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2); setUint16(16);
  setUint32(0x61746164); setUint32(length - pos - 4);

  for (let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(pos, sample, true); pos += 2;
    }
    offset++;
  }

  return new Blob([bufferArray], { type: 'audio/wav' });

  function setUint16(data: number) { view.setUint16(pos, data, true); pos += 2; }
  function setUint32(data: number) { view.setUint32(pos, data, true); pos += 4; }
}

export function CreatingPlayback({ projectData, updateProjectData, onNext, onError }: CreatingPlaybackProps) {
  const [status, setStatus] = useState<
    'preparing' | 'assembling-vocals' | 'kits-cleanup' | 'roex-mixing' | 'done' | 'error'
  >('preparing');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const processingRef = useRef(false);

  useEffect(() => {
    if (processingRef.current) return;
    processingRef.current = true;
    assembleFinalSong();
  }, []);

  // Upload blob to storage
  const uploadToStorage = async (blob: Blob, fileName: string): Promise<string | null> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return null;
      const userId = sessionData.session.user.id;
      const filePath = `final/${userId}/${fileName}_${Date.now()}.wav`;

      const { error } = await supabase.storage
        .from('recordings')
        .upload(filePath, blob, { contentType: 'audio/wav', upsert: true });

      if (error) { console.error('Upload error:', error); return null; }

      const { data: urlData } = supabase.storage.from('recordings').getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (error) { console.error('Error uploading:', error); return null; }
  };

  // Fetch and decode audio
  const fetchAndDecodeAudio = async (url: string, audioContext: AudioContext): Promise<AudioBuffer | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return await audioContext.decodeAudioData(await response.arrayBuffer());
    } catch (error) { console.error('Error decoding:', url, error); return null; }
  };

  // Assemble all dry vocal recordings into one continuous WAV at correct timings
  const assembleDryVocals = async (
    sections: SongSection[],
    totalDuration: number
  ): Promise<Blob | null> => {
    try {
      const audioContext = new AudioContext();
      const sampleRate = 44100;

      const recordedSections = sections.filter(s =>
        (s.type === 'verse' || s.type === 'chorus' || s.type === 'bridge') && s.userRecordingUrl
      );

      if (recordedSections.length === 0) return null;

      const offlineContext = new OfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate);

      for (let i = 0; i < recordedSections.length; i++) {
        const section = recordedSections[i];
        setProcessedCount(i + 1);

        const voiceBuffer = await fetchAndDecodeAudio(section.userRecordingUrl!, audioContext);
        if (voiceBuffer) {
          const source = offlineContext.createBufferSource();
          source.buffer = voiceBuffer;
          source.connect(offlineContext.destination);
          const offsetSec = (projectData.voiceOffsetMs ?? 0) / 1000;
          source.start(Math.max(0, section.startTime + offsetSec));
        }
      }

      const renderedBuffer = await offlineContext.startRendering();
      audioContext.close();
      return audioBufferToWav(renderedBuffer);
    } catch (error) {
      console.error('Error assembling dry vocals:', error);
      return null;
    }
  };

  const assembleFinalSong = async () => {
    try {
      setStatus('preparing');
      setProgress(5);
      setCurrentStep('מכין את ההקלטות...');

      const sections = projectData.songSections || [];
      const instrumentalUrl = projectData.instrumentalUrl || projectData.generatedPlaybackUrl;

      const recordableSections = sections.filter(s =>
        (s.type === 'verse' || s.type === 'chorus' || s.type === 'bridge') && s.userRecordingUrl
      );

      setTotalCount(recordableSections.length);
      console.log(`Found ${recordableSections.length} sections with recordings`);

      if (recordableSections.length === 0) {
        if (instrumentalUrl) updateProjectData({ generatedSongUrl: instrumentalUrl });
        setStatus('done'); setProgress(100); onNext();
        return;
      }

      if (!instrumentalUrl) {
        updateProjectData({ generatedSongUrl: recordableSections[0].userRecordingUrl });
        setStatus('done'); setProgress(100); onNext();
        return;
      }

      // ===== STEP 1: Assemble all dry vocals into a single WAV =====
      setStatus('assembling-vocals');
      setCurrentStep('ממזג את כל הקטעים המוקלטים...');
      setProgress(10);

      // Calculate total duration from sections or instrumental
      const totalDuration = sections.length > 0
        ? Math.max(...sections.map(s => s.endTime))
        : 300; // fallback 5 min

      const dryVocalsBlob = await assembleDryVocals(sections, totalDuration);

      if (!dryVocalsBlob) {
        console.error('Failed to assemble dry vocals');
        updateProjectData({ generatedSongUrl: recordableSections[0].userRecordingUrl });
        setStatus('done'); setProgress(100); onNext();
        return;
      }

      // Upload assembled dry vocals
      setCurrentStep('מעלה קובץ קול מורכב...');
      setProgress(20);

      const dryVocalUrl = await uploadToStorage(dryVocalsBlob, `${projectData.projectName || 'song'}_dry_vocals`);
      if (!dryVocalUrl) {
        throw new Error('Failed to upload dry vocals');
      }
      console.log('Dry vocals uploaded:', dryVocalUrl);

      // ===== STEP 2: Kits.ai Vocal Cleanup =====
      setStatus('kits-cleanup');
      setCurrentStep('🎤 Kits.ai מנקה ומשפר את הקול...');
      setProgress(30);

      let cleanVocalUrl = dryVocalUrl; // fallback to original

      try {
        const kitsStart = await callEdgeFunction('kits-vocal-cleanup', {
          audioUrl: dryVocalUrl,
          projectName: projectData.projectName,
        });

        if (kitsStart.jobId) {
          console.log('Kits job started:', kitsStart.jobId);
          setCurrentStep('🎤 Kits.ai מעבד... (כדקה)');
          setProgress(40);

          const kitsResult = await pollEdgeFunction('kits-vocal-cleanup', {
            jobId: kitsStart.jobId,
            projectName: projectData.projectName,
          }, 40, 5000);

          cleanVocalUrl = kitsResult.cleanVocalUrl || dryVocalUrl;
          console.log('Kits cleanup done:', cleanVocalUrl);
          toast.success('הקול נוקה בהצלחה! 🎤');
        }
      } catch (kitsError) {
        console.error('Kits.ai failed, using original vocals:', kitsError);
        toast.error('ניקוי Kits.ai נכשל - ממשיך עם הקול המקורי');
      }

      setProgress(55);

      // ===== STEP 3: RoEx Tonn Multitrack Mix =====
      setStatus('roex-mixing');
      setCurrentStep('🎼 RoEx Tonn מערבב קול עם פלייבק...');
      setProgress(60);

      let finalSongUrl: string | null = null;

      try {
        const roexStart = await callEdgeFunction('roex-mix-master', {
          vocalUrl: cleanVocalUrl,
          instrumentalUrl,
          projectName: projectData.projectName,
        });

        if (roexStart.taskId) {
          console.log('RoEx task started:', roexStart.taskId);
          setCurrentStep('🎼 RoEx Tonn יוצר מיקס מקצועי... (כ-2 דקות)');
          setProgress(70);

          const roexResult = await pollEdgeFunction('roex-mix-master', {
            taskId: roexStart.taskId,
            mode: roexStart.mode,
            projectName: projectData.projectName,
          }, 50, 5000);

          finalSongUrl = roexResult.outputUrl;
          console.log('RoEx mix done:', finalSongUrl);
          toast.success('המיקס המקצועי מוכן! 🎵');
        }
      } catch (roexError) {
        console.error('RoEx failed:', roexError);
        toast.error('מיקס RoEx נכשל - משתמש בקול הנקי');
      }

      // ===== STEP 4: Save result =====
      setProgress(95);
      setCurrentStep('שומר את השיר המוכן...');

      // Use the best available result
      const songUrl = finalSongUrl || cleanVocalUrl || dryVocalUrl;
      updateProjectData({ generatedSongUrl: songUrl });

      setStatus('done');
      setProgress(100);
      toast.success('השיר המלא מוכן! 🎉');
      onNext();

    } catch (error) {
      console.error('Error assembling final song:', error);
      setStatus('error');
      toast.error('שגיאה בהרכבת השיר');
      setTimeout(() => onNext(), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <h1
        className="text-[32px] font-bold text-[#D4A853] mb-4 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        {status === 'preparing' && 'מכין את ההקלטות...'}
        {status === 'assembling-vocals' && '🎙️ ממזג הקלטות קול'}
        {status === 'kits-cleanup' && '🎤 Kits.ai - ניקוי קול מקצועי'}
        {status === 'roex-mixing' && '🎼 RoEx Tonn - מיקס מקצועי'}
        {status === 'done' && '🎉 השיר מוכן!'}
        {status === 'error' && 'שגיאה בהרכבת השיר'}
      </h1>

      <p
        className="text-[18px] text-white/70 mb-8 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        {currentStep}
      </p>

      {status === 'assembling-vocals' && totalCount > 0 && (
        <p
          className="text-[16px] text-white/50 mb-4 text-center"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          {processedCount > 0 ? `הקלטה ${processedCount} מתוך ${totalCount}` : `סה"כ ${totalCount} הקלטות`}
        </p>
      )}

      <div className="w-full max-w-[400px] mb-8">
        <div className="h-3 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#D4A853] rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[14px] text-white/50 text-center mt-2" style={{ fontFamily: 'Discovery_Fs' }}>
          {progress}%
        </p>
      </div>

      {status !== 'done' && status !== 'error' && (
        <div className="flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-[#D4A853]/30 border-t-[#D4A853] rounded-full animate-spin" />
        </div>
      )}

      {status === 'kits-cleanup' && (
        <p className="text-[14px] text-white/40 mt-6 text-center max-w-md" style={{ fontFamily: 'Discovery_Fs' }}>
          Kits.ai מנקה רעשי רקע, מתקן את הקול ומכין אותו למיקס מקצועי
        </p>
      )}

      {status === 'roex-mixing' && (
        <p className="text-[14px] text-white/40 mt-6 text-center max-w-md" style={{ fontFamily: 'Discovery_Fs' }}>
          RoEx Tonn מערבב את הקול עם הפלייבק ברמה מקצועית - EQ, דחיסה ואיזון אוטומטי
        </p>
      )}
    </div>
  );
}
