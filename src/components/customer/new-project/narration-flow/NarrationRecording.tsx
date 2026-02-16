import { useState, useRef, useEffect } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { Mic, Square, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NarrationRecordingProps {
  projectData: ProjectData;
  onComplete: (audioUrl: string, duration: string) => void;
  onBack: () => void;
  onExit: () => void;
}

export function NarrationRecording({
  projectData,
  onComplete,
  onBack,
  onExit
}: NarrationRecordingProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const startCountdown = () => {
    setCountdown(5);
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev === 1) {
          clearInterval(countdownInterval);
          startActualRecording();
          return null;
        }
        return prev ? prev - 1 : null;
      });
    }, 1000);
  };

  const startActualRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      // Setup audio visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        const webmBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        // Convert WebM to WAV for AI enhancement compatibility
        try {
          const wavBlob = await convertToWav(webmBlob, audioContext.sampleRate);
          audioContext.close();
          await saveRecording(wavBlob, 'wav');
        } catch (convErr) {
          console.error('WAV conversion failed, using WebM:', convErr);
          audioContext.close();
          await saveRecording(webmBlob, 'webm');
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Start visualization
      drawWaveform();
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('לא ניתן לגשת למיקרופון');
    }
  };

  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;

        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        gradient.addColorStop(0, '#D4A853');
        gradient.addColorStop(1, '#FFBF66');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);

        x += barWidth + 1;
      }
    };

    draw();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
  };

  const convertToWav = async (webmBlob: Blob, sampleRate: number): Promise<Blob> => {
    const arrayBuffer = await webmBlob.arrayBuffer();
    const audioCtx = new AudioContext({ sampleRate });
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    audioCtx.close();

    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const wavBuffer = new ArrayBuffer(44 + length * numChannels * 2);
    const view = new DataView(wavBuffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, audioBuffer.sampleRate, true);
    view.setUint32(28, audioBuffer.sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numChannels * 2, true);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([wavBuffer], { type: 'audio/wav' });
  };

  const saveRecording = async (blob: Blob, format: string = 'webm') => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      const fileName = `narration_${Date.now()}.${format}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('recordings')
        .upload(filePath, blob, {
          contentType: format === 'wav' ? 'audio/wav' : 'audio/webm',
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('recordings')
        .getPublicUrl(filePath);

      const duration = formatTime(recordingTime);
      onComplete(publicUrl, duration);
      toast.success('ההקלטה נשמרה בהצלחה!');
    } catch (error) {
      console.error('Error saving recording:', error);
      toast.error('שגיאה בשמירת ההקלטה');
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-[800px] mx-auto h-full">
      {/* Countdown Overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <span className="text-white font-bold" style={{ fontSize: '200px', fontFamily: 'Discovery_Fs' }}>
            {countdown}
          </span>
        </div>
      )}

      {/* Recording Card */}
      <div className="bg-white rounded-[20px] p-6 w-full">
        <h2 
          className="text-[24px] font-bold text-[#742551] text-center mb-1"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          הקלטת קריינות
        </h2>
        <p 
          className="text-[16px] text-[#742551]/70 text-center mb-4"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          {projectData.projectName}
        </p>

        {/* Waveform Canvas */}
        <div className="bg-gray-100 rounded-xl h-[120px] mb-4 overflow-hidden">
          <canvas 
            ref={canvasRef} 
            className="w-full h-full"
            width={800}
            height={120}
          />
        </div>

        {/* Timer */}
        <div className="text-center mb-4">
          <span 
            className="text-[40px] font-bold text-[#742551]"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            {formatTime(recordingTime)}
          </span>
        </div>

        {/* Recording Controls */}
        <div className="flex justify-center">
          {isSaving ? (
            <div className="flex items-center gap-3 text-[#742551]">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span style={{ fontFamily: 'Discovery_Fs' }}>שומר הקלטה...</span>
            </div>
          ) : isRecording ? (
            <button
              onClick={stopRecording}
              className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-all animate-pulse"
            >
              <Square className="w-8 h-8 text-white" fill="white" />
            </button>
          ) : (
            <button
              onClick={startCountdown}
              className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-all"
            >
              <Mic className="w-8 h-8 text-white" />
            </button>
          )}
        </div>

        {!isRecording && !isSaving && (
          <p 
            className="text-center text-[14px] text-[#742551]/60 mt-3"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            לחץ על הכפתור להתחלת הקלטה
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-start w-full mt-6 px-[71px]">
        <button 
          onClick={onBack}
          disabled={isRecording}
          className="h-[50px] px-8 rounded-full text-[20px] text-white border-2 border-white hover:bg-white/10 transition-all disabled:opacity-50"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          לשלב הקודם
        </button>
      </div>
    </div>
  );
}