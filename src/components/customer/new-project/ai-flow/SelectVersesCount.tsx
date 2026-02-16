import { useState } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { Plus, Minus } from "lucide-react";

interface SelectVersesCountProps {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function SelectVersesCount({ projectData, updateProjectData, onNext, onBack }: SelectVersesCountProps) {
  const [versesCount, setVersesCount] = useState(1);
  const [chorusCount, setChorusCount] = useState(1);

  const handleContinue = () => {
    // Create verses array based on counts
    const verses: { id: number; type: 'verse' | 'chorus'; text: string }[] = [];
    let id = 1;
    
    // Interleave verses and choruses
    const maxCount = Math.max(versesCount, chorusCount);
    for (let i = 0; i < maxCount; i++) {
      if (i < versesCount) {
        verses.push({ id: id++, type: 'verse', text: '' });
      }
      if (i < chorusCount) {
        verses.push({ id: id++, type: 'chorus', text: '' });
      }
    }
    
    updateProjectData({ verses });
    onNext();
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Subtitle */}
      <p 
        className="text-[24px] text-[#D4A853] text-center mb-8"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        אנא הוסיפו את הכמות בתים ופזמונים שאתם רוצים להקליט
      </p>

      {/* Verses Counter */}
      <div className="w-full max-w-[700px] bg-white rounded-[20px] p-6 flex items-center justify-between mb-4">
        <span 
          className="text-[28px] font-bold text-[#742551]"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          בתים
        </span>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setVersesCount(prev => Math.max(1, prev - 1))}
            className="w-12 h-12 rounded-lg flex items-center justify-center text-[24px] font-bold"
            style={{ background: '#D4A853', color: '#742551' }}
          >
            <Minus className="w-6 h-6" />
          </button>
          <span 
            className="w-16 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-[24px] font-bold text-[#333]"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            {versesCount}
          </span>
          <button
            onClick={() => setVersesCount(prev => prev + 1)}
            className="w-12 h-12 rounded-lg flex items-center justify-center text-[24px] font-bold"
            style={{ background: '#D4A853', color: '#742551' }}
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Chorus Counter */}
      <div className="w-full max-w-[700px] bg-white rounded-[20px] p-6 flex items-center justify-between mb-8">
        <span 
          className="text-[28px] font-bold text-[#742551]"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          פזמונים
        </span>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setChorusCount(prev => Math.max(1, prev - 1))}
            className="w-12 h-12 rounded-lg flex items-center justify-center text-[24px] font-bold"
            style={{ background: '#D4A853', color: '#742551' }}
          >
            <Minus className="w-6 h-6" />
          </button>
          <span 
            className="w-16 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-[24px] font-bold text-[#333]"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            {chorusCount}
          </span>
          <button
            onClick={() => setChorusCount(prev => prev + 1)}
            className="w-12 h-12 rounded-lg flex items-center justify-center text-[24px] font-bold"
            style={{ background: '#D4A853', color: '#742551' }}
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Bottom Buttons */}
      <div className="w-full max-w-[700px] flex justify-between items-center">
        <button
          onClick={onBack}
          className="h-[50px] px-8 rounded-[25px] text-[18px] font-bold transition-all border-2 border-white/50 text-white hover:bg-white/10"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          לשלב הקודם
        </button>

        <button
          onClick={handleContinue}
          className="h-[50px] px-8 rounded-[25px] text-[18px] font-bold transition-all"
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
