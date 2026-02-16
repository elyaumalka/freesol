import { useState, useRef } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { FileUp } from "lucide-react";

interface UploadPlaybackProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function UploadPlayback({ projectData, updateProjectData, onNext, onBack }: UploadPlaybackProps) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (file: File) => {
    updateProjectData({ uploadedFile: file, playbackName: file.name });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleContinue = () => {
    if (projectData.uploadedFile) {
      onNext();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[60vh]">
      {/* Upload Area */}
      <div
        className={`w-full max-w-[800px] rounded-[20px] transition-all flex items-center justify-between cursor-pointer p-6 ${
          dragActive 
            ? "bg-white/90" 
            : "bg-white hover:bg-white/90"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileInput}
          className="hidden"
        />
        
        {/* Icon */}
        <div className="flex items-center justify-center">
          <FileUp className="w-10 h-10 text-[#742551]" />
        </div>

        {/* Text */}
        <div className="flex-1 text-right pr-4">
          {projectData.uploadedFile ? (
            <p className="text-[22px] font-bold text-[#742551]" style={{ fontFamily: 'Discovery_Fs' }}>
              {projectData.uploadedFile.name}
            </p>
          ) : (
            <>
              <p className="text-[22px] font-bold text-[#742551]" style={{ fontFamily: 'Discovery_Fs' }}>
                לחצו להעלאת קובץ אודיו מהמחשב
              </p>
              <p className="text-[14px] text-[#742551]/70 mt-1" style={{ fontFamily: 'Discovery_Fs' }}>
                שיר מקורי עם קול? אנחנו נפריד אותו אוטומטית | פלייבק מוכן? גם בסדר!
              </p>
            </>
          )}
        </div>
      </div>

      {/* Info Note */}
      <div className="w-full max-w-[800px] mt-4 text-center">
        <p className="text-[14px] text-white/80" style={{ fontFamily: 'Discovery_Fs' }}>
          💡 <span className="text-[#D4A853]">טיפ:</span> אם אתם מעלים פלייבק מוכן (ללא קול מקורי), כדאי לעבור ישירות ל"הקלטה חופשית" בשלב הבא
        </p>
      </div>

      {/* Bottom Buttons */}
      <div className="w-full max-w-[800px] flex justify-between items-center mt-12">
        <button
          onClick={onBack}
          className="h-[50px] px-8 rounded-[25px] text-[18px] font-bold transition-all border-2 border-white/50 text-white hover:bg-white/10"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          לשלב הקודם
        </button>

        <button
          onClick={handleContinue}
          disabled={!projectData.uploadedFile}
          className="h-[50px] px-8 rounded-[25px] text-[18px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            fontFamily: 'Discovery_Fs',
            background: '#D4A853',
            color: '#742551'
          }}
        >
          לשלב הבא ←
        </button>
      </div>
    </div>
  );
}
