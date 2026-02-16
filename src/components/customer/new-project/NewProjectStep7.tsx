import { useState } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { Mic } from "lucide-react";

interface NewProjectStep7Props {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function NewProjectStep7({ projectData, updateProjectData, onNext, onBack }: NewProjectStep7Props) {
  const [isReady, setIsReady] = useState(false);

  const handleStartRecording = () => {
    setIsReady(true);
    // Small delay before moving to actual recording
    setTimeout(() => {
      onNext();
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      {/* Back Button */}
      <div className="w-full flex justify-end mb-4 absolute top-6 right-6">
        <button
          onClick={onBack}
          className="text-[20px] text-[#742551] hover:opacity-80 transition-all"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          → חזרה
        </button>
      </div>

      {/* Microphone Icon */}
      <div 
        className={`w-[200px] h-[200px] rounded-full flex items-center justify-center mb-8 transition-all duration-500 ${
          isReady ? 'scale-110' : ''
        }`}
        style={{
          background: 'linear-gradient(180deg, #742551 0%, #215F66 100%)',
        }}
      >
        <Mic className={`w-[80px] h-[80px] text-white ${isReady ? 'animate-pulse' : ''}`} />
      </div>

      {/* Title */}
      <h1 
        className="text-[50px] font-bold text-[#742551] mb-4"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        {isReady ? 'מתכונן להקלטה...' : 'מוכן להקלטה?'}
      </h1>
      
      {/* Subtitle */}
      <p 
        className="text-[24px] font-light text-[#742551]/70 mb-8 text-center max-w-[500px]"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        לחץ על הכפתור כדי להתחיל את ההקלטה
      </p>

      {/* Start Button */}
      {!isReady && (
        <button
          onClick={handleStartRecording}
          className="h-[70px] px-16 rounded-[35px] text-[28px] font-bold text-white transition-all hover:scale-105"
          style={{
            fontFamily: 'Discovery_Fs',
            background: 'linear-gradient(180deg, #742551 0%, #215F66 100%)',
            boxShadow: '0 10px 30px rgba(116, 37, 81, 0.3)',
          }}
        >
          התחל הקלטה
        </button>
      )}

      {/* Loading indicator when ready */}
      {isReady && (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#742551] animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-3 h-3 rounded-full bg-[#742551] animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-3 h-3 rounded-full bg-[#742551] animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      )}
    </div>
  );
}
