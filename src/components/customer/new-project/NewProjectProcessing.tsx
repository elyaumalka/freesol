import { useState, useEffect } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";

interface NewProjectProcessingProps {
  projectData: ProjectData;
}

export function NewProjectProcessing({ projectData }: NewProjectProcessingProps) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsComplete(true);
          return 100;
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const handleFinish = () => {
    navigate('/customer/dashboard');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      {!isComplete ? (
        <>
          {/* Processing animation */}
          <div className="relative w-[200px] h-[200px] mb-8">
            {/* Outer ring */}
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#F7F7F7"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${progress * 2.83} 283`}
                className="transition-all duration-200"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#742551" />
                  <stop offset="100%" stopColor="#215F66" />
                </linearGradient>
              </defs>
            </svg>
            
            {/* Percentage */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span 
                className="text-[40px] font-bold text-[#742551]"
                style={{ fontFamily: 'Discovery_Fs' }}
              >
                {progress}%
              </span>
            </div>
          </div>

          {/* Title */}
          <h1 
            className="text-[40px] font-bold text-[#742551] mb-2"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            מעבד את ההקלטה...
          </h1>
          
          {/* Subtitle */}
          <p 
            className="text-[24px] font-light text-[#742551]/70"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            נא להמתין
          </p>
        </>
      ) : (
        <>
          {/* Success icon */}
          <div 
            className="w-[150px] h-[150px] rounded-full flex items-center justify-center mb-8"
            style={{
              background: 'linear-gradient(180deg, #742551 0%, #215F66 100%)',
            }}
          >
            <Check className="w-[80px] h-[80px] text-white" />
          </div>

          {/* Title */}
          <h1 
            className="text-[50px] font-bold text-[#742551] mb-2"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            הפלייבק נוצר בהצלחה!
          </h1>
          
          {/* Project name */}
          <p 
            className="text-[30px] font-light text-[#215F66] mb-8"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            {projectData.projectName}
          </p>

          {/* Finish Button */}
          <button
            onClick={handleFinish}
            className="h-[60px] px-12 rounded-[30px] text-[24px] font-bold text-white transition-all hover:scale-105"
            style={{
              fontFamily: 'Discovery_Fs',
              background: 'linear-gradient(180deg, #742551 0%, #215F66 100%)',
            }}
          >
            סיום ←
          </button>
        </>
      )}
    </div>
  );
}
