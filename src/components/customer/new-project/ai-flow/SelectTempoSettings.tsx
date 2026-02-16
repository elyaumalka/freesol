import { useState, useRef, useCallback, useEffect } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { Play, Square, Volume2 } from "lucide-react";

interface SelectTempoSettingsProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const TIME_SIGNATURES = [
  { value: "4/4", label: "4/4", description: "הכי נפוץ - פופ, רוק", beats: 4 },
  { value: "3/4", label: "3/4", description: "ואלס, בלדות", beats: 3 },
  { value: "6/8", label: "6/8", description: "מקצב משולש", beats: 6 },
  { value: "2/4", label: "2/4", description: "מרש, פולקה", beats: 2 },
];

const BPM_PRESETS = [
  { value: 60, label: "איטי", description: "60 BPM" },
  { value: 80, label: "איטי-בינוני", description: "80 BPM" },
  { value: 100, label: "בינוני", description: "100 BPM" },
  { value: 120, label: "מהיר", description: "120 BPM" },
  { value: 140, label: "מהיר מאוד", description: "140 BPM" },
];

export function SelectTempoSettings({ projectData, updateProjectData, onNext, onBack }: SelectTempoSettingsProps) {
  const [timeSignature, setTimeSignature] = useState(projectData.aiTimeSignature || "4/4");
  const [bpm, setBpm] = useState(projectData.aiBpm || 100);
  const [customBpm, setCustomBpm] = useState<string>("");
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextBeatTimeRef = useRef<number>(0);
  const timerIdRef = useRef<number | null>(null);
  const beatCountRef = useRef<number>(0);

  // Get beats count for current time signature
  const getBeatsCount = () => {
    const sig = TIME_SIGNATURES.find(s => s.value === timeSignature);
    return sig?.beats || 4;
  };

  // Play a single metronome click
  const playClick = useCallback((isAccent: boolean, audioContext: AudioContext) => {
    const now = audioContext.currentTime;
    
    // Create oscillator for click sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Accent on first beat (higher pitch)
    oscillator.frequency.value = isAccent ? 1200 : 800;
    oscillator.type = 'square';
    
    // Short percussive envelope
    gainNode.gain.setValueAtTime(0.5, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    
    oscillator.start(now);
    oscillator.stop(now + 0.05);
  }, []);

  // Metronome scheduler
  const scheduleBeats = useCallback(() => {
    if (!audioContextRef.current || !isPreviewPlaying) return;
    
    const audioContext = audioContextRef.current;
    const beatsPerMeasure = getBeatsCount();
    const secondsPerBeat = 60.0 / bpm;
    
    // Schedule ahead by 100ms
    while (nextBeatTimeRef.current < audioContext.currentTime + 0.1) {
      const beatInMeasure = beatCountRef.current % beatsPerMeasure;
      const isAccent = beatInMeasure === 0;
      
      playClick(isAccent, audioContext);
      setCurrentBeat(beatInMeasure + 1);
      
      nextBeatTimeRef.current += secondsPerBeat;
      beatCountRef.current++;
    }
    
    timerIdRef.current = window.setTimeout(scheduleBeats, 25);
  }, [bpm, isPreviewPlaying, playClick, timeSignature]);

  // Start preview
  const startPreview = async () => {
    try {
      // Create or resume audio context
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      nextBeatTimeRef.current = audioContextRef.current.currentTime;
      beatCountRef.current = 0;
      setCurrentBeat(0);
      setIsPreviewPlaying(true);
    } catch (error) {
      console.error("Error starting metronome preview:", error);
    }
  };

  // Stop preview
  const stopPreview = useCallback(() => {
    if (timerIdRef.current) {
      clearTimeout(timerIdRef.current);
      timerIdRef.current = null;
    }
    setIsPreviewPlaying(false);
    setCurrentBeat(0);
  }, []);

  // Run scheduler when playing
  useEffect(() => {
    if (isPreviewPlaying) {
      scheduleBeats();
    }
    return () => {
      if (timerIdRef.current) {
        clearTimeout(timerIdRef.current);
      }
    };
  }, [isPreviewPlaying, scheduleBeats]);

  // Stop preview when tempo changes
  useEffect(() => {
    if (isPreviewPlaying) {
      stopPreview();
    }
  }, [bpm, timeSignature]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPreview();
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
      }
    };
  }, [stopPreview]);

  const handleTimeSignatureSelect = (value: string) => {
    setTimeSignature(value);
    updateProjectData({ aiTimeSignature: value });
  };

  const handleBpmSelect = (value: number) => {
    setBpm(value);
    setCustomBpm("");
    updateProjectData({ aiBpm: value });
  };

  const handleCustomBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomBpm(value);
    const numValue = parseInt(value);
    if (numValue >= 40 && numValue <= 200) {
      setBpm(numValue);
      updateProjectData({ aiBpm: numValue });
    }
  };

  const handleNext = () => {
    stopPreview();
    updateProjectData({ 
      aiTimeSignature: timeSignature,
      aiBpm: bpm 
    });
    onNext();
  };

  // Generate beat indicators
  const renderBeatIndicators = () => {
    const beatsCount = getBeatsCount();
    return (
      <div className="flex gap-2 justify-center">
        {Array.from({ length: beatsCount }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 md:w-5 md:h-5 rounded-full transition-all duration-100 ${
              currentBeat === i + 1
                ? i === 0
                  ? 'bg-[#D4A853] scale-125 shadow-lg shadow-[#D4A853]/50'
                  : 'bg-white scale-110'
                : 'bg-white/30'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center w-full max-w-[800px] mx-auto px-4 pb-8 overflow-y-auto max-h-full">
      {/* Title */}
      <h2 
        className="text-[24px] md:text-[32px] font-bold text-[#D4A853] mb-1 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        הגדרות קצב
      </h2>
      
      <p 
        className="text-[14px] md:text-[16px] text-white/70 mb-4 text-center"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        בחר את המשקל והמהירות להקלטה
      </p>

      {/* Time Signature Selection */}
      <div className="w-full mb-4">
        <h3 
          className="text-[16px] md:text-[18px] text-[#D4A853] mb-2 text-right"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          משקל (Time Signature)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          {TIME_SIGNATURES.map((sig) => (
            <button
              key={sig.value}
              onClick={() => handleTimeSignatureSelect(sig.value)}
              className={`p-2 md:p-3 rounded-[12px] text-center transition-all ${
                timeSignature === sig.value
                  ? 'bg-[#D4A853] text-[#742551]'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <span 
                className="text-[22px] md:text-[26px] font-bold block"
                style={{ fontFamily: 'Discovery_Fs' }}
              >
                {sig.label}
              </span>
              <span 
                className="text-[11px] md:text-[12px] opacity-80"
                style={{ fontFamily: 'Discovery_Fs' }}
              >
                {sig.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* BPM Selection */}
      <div className="w-full mb-4">
        <h3 
          className="text-[16px] md:text-[18px] text-[#D4A853] mb-2 text-right"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          מהירות (BPM)
        </h3>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-3">
          {BPM_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => handleBpmSelect(preset.value)}
              className={`p-2 rounded-[8px] text-center transition-all ${
                bpm === preset.value && customBpm === ""
                  ? 'bg-[#D4A853] text-[#742551]'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <span 
                className="text-[13px] md:text-[14px] font-bold block"
                style={{ fontFamily: 'Discovery_Fs' }}
              >
                {preset.label}
              </span>
              <span 
                className="text-[10px] md:text-[11px] opacity-80"
                style={{ fontFamily: 'Discovery_Fs' }}
              >
                {preset.description}
              </span>
            </button>
          ))}
        </div>
        
        {/* Custom BPM Input */}
        <div className="flex items-center justify-center gap-3">
          <span 
            className="text-white/70 text-[13px] md:text-[14px]"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            או הזן BPM מותאם:
          </span>
          <input
            type="number"
            min="40"
            max="200"
            value={customBpm}
            onChange={handleCustomBpmChange}
            placeholder={bpm.toString()}
            className="w-20 px-3 py-1.5 rounded-[8px] bg-white/10 text-white text-center text-[14px] border border-white/20 focus:border-[#D4A853] focus:outline-none"
            style={{ fontFamily: 'Discovery_Fs' }}
          />
        </div>
      </div>

      {/* Current Selection Summary */}
      <div className="w-full p-3 rounded-[12px] bg-white/5 mb-4 text-center">
        <span 
          className="text-white/60 text-[13px] md:text-[14px]"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          הבחירה שלך:
        </span>
        <span 
          className="text-[#D4A853] text-[18px] md:text-[20px] font-bold mr-3"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          {timeSignature} @ {bpm} BPM
        </span>
      </div>

      {/* Metronome Preview Section - Single Row */}
      <div className="w-full px-3 py-2 rounded-[12px] bg-white/5 border border-[#D4A853]/30 mb-4">
        <div className="flex items-center justify-between gap-2">
          {/* Right: Title */}
          <div className="flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-[#D4A853]" />
            <span 
              className="text-[13px] md:text-[14px] text-[#D4A853] font-bold whitespace-nowrap"
              style={{ fontFamily: 'Discovery_Fs' }}
            >
              שמיעה מקדימה
            </span>
          </div>
          
          {/* Center: Beat Indicators */}
          <div className="flex gap-1.5 justify-center">
            {Array.from({ length: getBeatsCount() }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-100 ${
                  currentBeat === i + 1
                    ? i === 0
                      ? 'bg-[#D4A853] scale-125 shadow-lg shadow-[#D4A853]/50'
                      : 'bg-white scale-110'
                    : 'bg-white/30'
                }`}
              />
            ))}
          </div>
          
          {/* Left: Play/Stop Button */}
          <button
            onClick={isPreviewPlaying ? stopPreview : startPreview}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[16px] text-[12px] md:text-[13px] font-bold transition-all ${
              isPreviewPlaying
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-[#D4A853]/20 text-[#D4A853] border border-[#D4A853] hover:bg-[#D4A853]/30'
            }`}
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            {isPreviewPlaying ? (
              <>
                <Square className="w-3.5 h-3.5" />
                עצור
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                נגן
              </>
            )}
          </button>
        </div>
      </div>

      {/* Navigation Buttons - Always visible */}
      <div className="w-full flex justify-between items-center mt-4 pt-4 border-t border-white/10">
        <button
          onClick={onBack}
          className="text-[16px] md:text-[18px] text-[#D4A853] hover:opacity-80 transition-all"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          ← לשלב הקודם
        </button>

        <button
          onClick={handleNext}
          className="h-[45px] md:h-[50px] px-6 md:px-8 rounded-[25px] text-[16px] md:text-[18px] font-bold text-[#742551] transition-all hover:scale-105 bg-[#D4A853]"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          להקלטה ←
        </button>
      </div>
    </div>
  );
}
