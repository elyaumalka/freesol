import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MasterAudioParams {
  voiceUrl: string;
  instrumentalUrl: string;
  projectName?: string;
  referenceUrl?: string;
}

interface MasterAudioResult {
  success: boolean;
  enhancedVoiceUrl: string;
  originalVoiceUrl: string;
  instrumentalUrl: string;
  message: string;
  processingSteps: {
    voiceEnhancement: string;
  };
}

export function useMasterAudio() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const masterAudio = async (params: MasterAudioParams): Promise<MasterAudioResult | null> => {
    setIsProcessing(true);
    setError(null);
    setProgress('מתחיל עיבוד מקצועי...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('יש להתחבר כדי לעבד אודיו');
      }

      setProgress('משפר איכות קול עם AI...');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/master-audio`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(params),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'שגיאה בעיבוד האודיו');
      }

      const result: MasterAudioResult = await response.json();
      
      setProgress('העיבוד הושלם!');
      toast.success('העיבוד המקצועי הושלם בהצלחה!');
      
      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'שגיאה לא ידועה';
      setError(errorMessage);
      toast.error(errorMessage);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  // Client-side audio mixing using Web Audio API
  const mixAudioTracks = async (
    voiceUrl: string, 
    instrumentalUrl: string,
    voiceVolume: number = 1.0,
    instrumentalVolume: number = 0.7
  ): Promise<Blob | null> => {
    try {
      setProgress('ממזג ערוצי אודיו...');
      
      const audioContext = new AudioContext();
      
      // Fetch both audio files
      const [voiceResponse, instrumentalResponse] = await Promise.all([
        fetch(voiceUrl),
        fetch(instrumentalUrl)
      ]);

      const [voiceBuffer, instrumentalBuffer] = await Promise.all([
        voiceResponse.arrayBuffer(),
        instrumentalResponse.arrayBuffer()
      ]);

      // Decode audio data
      const [voiceAudio, instrumentalAudio] = await Promise.all([
        audioContext.decodeAudioData(voiceBuffer),
        audioContext.decodeAudioData(instrumentalBuffer)
      ]);

      // Create offline context for rendering
      const longerDuration = Math.max(voiceAudio.duration, instrumentalAudio.duration);
      const sampleRate = 44100;
      const offlineContext = new OfflineAudioContext(
        2, // stereo
        Math.ceil(longerDuration * sampleRate),
        sampleRate
      );

      // Create buffer sources
      const voiceSource = offlineContext.createBufferSource();
      voiceSource.buffer = voiceAudio;

      const instrumentalSource = offlineContext.createBufferSource();
      instrumentalSource.buffer = instrumentalAudio;

      // Create gain nodes for volume control
      const voiceGain = offlineContext.createGain();
      voiceGain.gain.value = voiceVolume;

      const instrumentalGain = offlineContext.createGain();
      instrumentalGain.gain.value = instrumentalVolume;

      // Connect nodes
      voiceSource.connect(voiceGain);
      voiceGain.connect(offlineContext.destination);

      instrumentalSource.connect(instrumentalGain);
      instrumentalGain.connect(offlineContext.destination);

      // Start both sources
      voiceSource.start(0);
      instrumentalSource.start(0);

      // Render the mixed audio
      setProgress('מעבד ומייצר קובץ...');
      const renderedBuffer = await offlineContext.startRendering();

      // Convert to WAV blob
      const wavBlob = audioBufferToWav(renderedBuffer);
      
      await audioContext.close();
      
      setProgress('המיזוג הושלם!');
      return wavBlob;
    } catch (err: any) {
      console.error('Error mixing audio:', err);
      setError('שגיאה במיזוג האודיו');
      return null;
    }
  };

  return {
    masterAudio,
    mixAudioTracks,
    isProcessing,
    progress,
    error,
  };
}

// Helper function to convert AudioBuffer to WAV blob
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write audio data
  const offset = 44;
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let index = 0;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = channels[channel][i];
      sample = Math.max(-1, Math.min(1, sample));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset + index, sample, true);
      index += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
