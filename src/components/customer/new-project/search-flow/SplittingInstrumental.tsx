import { useEffect, useState, useRef } from "react";
import { ProjectData, SongSection } from "@/pages/customer/NewProject";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Scissors, Check, AlertCircle } from "lucide-react";

interface SplittingInstrumentalProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onNext: () => void;
  onError: () => void;
}

export function SplittingInstrumental({
  projectData,
  updateProjectData,
  onNext,
  onError,
}: SplittingInstrumentalProps) {
  const [status, setStatus] = useState<'loading' | 'splitting' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('טוען את האינסטרומנטל...');
  const [progress, setProgress] = useState(0);
  const processingRef = useRef(false);

  useEffect(() => {
    if (processingRef.current) return;
    processingRef.current = true;
    splitInstrumental();
  }, []);

  const splitInstrumental = async () => {
    try {
      const instrumentalUrl = projectData.instrumentalUrl || projectData.generatedPlaybackUrl;
      const sections = projectData.songSections || [];

      if (!instrumentalUrl || sections.length === 0) {
        console.warn('No instrumental or sections to split');
        onNext();
        return;
      }

      // Check if segments already exist
      const allHaveSegments = sections.every(s => s.segmentUrl);
      if (allHaveSegments) {
        console.log('All sections already have segment URLs, skipping split');
        onNext();
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Not authenticated');
      }
      const userId = sessionData.session.user.id;

      setStatus('splitting');
      setMessage('מוריד את האינסטרומנטל...');
      setProgress(10);

      // Fetch and decode the full instrumental
      const response = await fetch(instrumentalUrl);
      if (!response.ok) throw new Error('Failed to fetch instrumental');
      const arrayBuffer = await response.arrayBuffer();

      const audioContext = new AudioContext();
      const fullBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const sampleRate = fullBuffer.sampleRate;
      const numChannels = fullBuffer.numberOfChannels;

      setMessage('חותך את האינסטרומנטל לחלקים...');
      setProgress(30);

      const updatedSections = [...sections];
      const totalSections = sections.length;

      for (let i = 0; i < totalSections; i++) {
        const section = sections[i];
        
        // Skip if already has a segment URL
        if (section.segmentUrl) continue;

        const startSample = Math.floor(section.startTime * sampleRate);
        const endSample = Math.min(
          Math.floor(section.endTime * sampleRate),
          fullBuffer.length
        );
        const segmentLength = endSample - startSample;

        if (segmentLength <= 0) continue;

        // Create a new buffer for this segment
        const segmentBuffer = new AudioBuffer({
          length: segmentLength,
          numberOfChannels: numChannels,
          sampleRate: sampleRate,
        });

        for (let ch = 0; ch < numChannels; ch++) {
          const fullChannel = fullBuffer.getChannelData(ch);
          const segmentChannel = segmentBuffer.getChannelData(ch);
          for (let s = 0; s < segmentLength; s++) {
            segmentChannel[s] = fullChannel[startSample + s];
          }
        }

        // Convert to WAV
        const wavBlob = audioBufferToWav(segmentBuffer);

        // Upload to storage
        const sanitizedProject = (projectData.projectName || 'project')
          .replace(/[^a-zA-Z0-9_-]/g, '_') || 'project';
        const filePath = `segments/${userId}/${sanitizedProject}_section_${i}_${Date.now()}.wav`;

        const { error: uploadError } = await supabase.storage
          .from('recordings')
          .upload(filePath, wavBlob, {
            contentType: 'audio/wav',
            upsert: true,
          });

        if (uploadError) {
          console.error(`Failed to upload segment ${i}:`, uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('recordings')
          .getPublicUrl(filePath);

        updatedSections[i] = {
          ...updatedSections[i],
          segmentUrl: urlData.publicUrl,
        };

        const sectionProgress = 30 + ((i + 1) / totalSections) * 60;
        setProgress(Math.round(sectionProgress));
        setMessage(`חותך חלק ${i + 1} מתוך ${totalSections}...`);
      }

      // Update project data with segment URLs
      updateProjectData({ songSections: updatedSections });

      setProgress(100);
      setStatus('success');
      setMessage('החיתוך הושלם בהצלחה!');

      audioContext.close();

      setTimeout(() => onNext(), 1000);
    } catch (error) {
      console.error('Error splitting instrumental:', error);
      setStatus('error');
      setMessage('שגיאה בחיתוך - ממשיכים עם הקובץ המלא...');
      setTimeout(() => onError(), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
      <h1
        className="text-[32px] md:text-[36px] font-bold text-[#D4A853] mb-6 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        חיתוך אינסטרומנטל לחלקים
      </h1>

      <div className="relative mb-8">
        {(status === 'loading' || status === 'splitting') && (
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-[#D4A853]/20 flex items-center justify-center">
              <Scissors className="w-12 h-12 text-[#D4A853]" />
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

      <p
        className="text-[18px] md:text-[20px] text-white text-center mb-6"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        {message}
      </p>

      {(status === 'loading' || status === 'splitting') && (
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

      {(status === 'loading' || status === 'splitting') && (
        <p
          className="text-[14px] text-white/60 text-center mt-6 max-w-md"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          חותכים את מוזיקת הרקע לקבצים נפרדים לכל חלק בשיר
          <br />
          כדי לשפר את איכות ההקלטה והפלייבק
        </p>
      )}
    </div>
  );
}

// Helper: convert AudioBuffer to WAV Blob
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const dataLength = length * numChannels * 2;
  const wavBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(wavBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}
