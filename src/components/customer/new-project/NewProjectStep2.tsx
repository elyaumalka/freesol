import { useState } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { Search, Upload, Mic } from "lucide-react";
import aiVoiceGold from "@/assets/icons/ai-voice-gold.svg";

interface NewProjectStep2Props {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onSelectOption: (option: 'search' | 'upload' | 'ai' | 'narration') => void;
  onBack: () => void;
}

type PlaybackOption = 'search' | 'upload' | 'ai' | 'narration';

export function NewProjectStep2({
  projectData,
  updateProjectData,
  onSelectOption,
  onBack
}: NewProjectStep2Props) {
  const [selectedOption, setSelectedOption] = useState<PlaybackOption | null>(
    projectData.backgroundMusic as PlaybackOption | null
  );

  const handleSelect = (option: PlaybackOption) => {
    setSelectedOption(option);
    updateProjectData({
      backgroundMusic: option
    });
  };

  const handleNext = () => {
    if (selectedOption) {
      onSelectOption(selectedOption);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-[1200px] mx-auto flex-1 px-4">

      {/* Options Cards - Responsive grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5 mb-6 lg:mb-12 w-full">
        {/* Card 1 - Search */}
        <button 
          onClick={() => handleSelect('search')} 
          className={`bg-white rounded-[14px] lg:rounded-[20px] p-4 lg:p-6 text-center hover:scale-[1.02] transition-all min-h-[140px] lg:min-h-[200px] flex flex-col items-center justify-start pt-5 lg:pt-8 ${
            selectedOption === 'search' ? 'ring-3 lg:ring-4 ring-[#D4A853] shadow-lg' : ''
          }`}
        >
          <Search className="w-8 h-8 lg:w-12 lg:h-12 text-[#D4A853] mb-2 lg:mb-4" strokeWidth={1.5} />
          <h3 
            className="text-[14px] lg:text-[18px] xl:text-[22px] font-bold text-[#742551] mb-1 lg:mb-2"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            חיפוש פלייבק מהמאגר
          </h3>
          <p 
            className="text-[11px] lg:text-[13px] xl:text-[14px] text-[#742551]/70"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            מנגינות משירים מוכרים
          </p>
        </button>

        {/* Card 2 - Upload */}
        <button 
          onClick={() => handleSelect('upload')} 
          className={`bg-white rounded-[14px] lg:rounded-[20px] p-4 lg:p-6 text-center hover:scale-[1.02] transition-all min-h-[140px] lg:min-h-[200px] flex flex-col items-center justify-start pt-5 lg:pt-8 ${
            selectedOption === 'upload' ? 'ring-3 lg:ring-4 ring-[#D4A853] shadow-lg' : ''
          }`}
        >
          <Upload className="w-8 h-8 lg:w-12 lg:h-12 text-[#D4A853] mb-2 lg:mb-4" strokeWidth={1.5} />
          <h3 
            className="text-[14px] lg:text-[18px] xl:text-[22px] font-bold text-[#742551] mb-1 lg:mb-2"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            העלאת פלייבק
          </h3>
          <p 
            className="text-[11px] lg:text-[13px] xl:text-[14px] text-[#742551]/70"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            במידה והבאתם<br />
            איתכם מוזיקת רקע מהבית
          </p>
        </button>

        {/* Card 3 - AI */}
        <button 
          onClick={() => handleSelect('ai')} 
          className={`bg-white rounded-[14px] lg:rounded-[20px] p-4 lg:p-6 text-center hover:scale-[1.02] transition-all min-h-[140px] lg:min-h-[200px] flex flex-col items-center justify-start pt-5 lg:pt-8 ${
            selectedOption === 'ai' ? 'ring-3 lg:ring-4 ring-[#D4A853] shadow-lg' : ''
          }`}
        >
          <img src={aiVoiceGold} alt="" className="w-8 h-8 lg:w-12 lg:h-12 mb-2 lg:mb-4" />
          <h3 
            className="text-[14px] lg:text-[18px] xl:text-[22px] font-bold text-[#742551] mb-1 lg:mb-2"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            יצירת פלייבק AI
          </h3>
          <p 
            className="text-[11px] lg:text-[13px] xl:text-[14px] text-[#742551]/70 leading-snug"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            במידה ואתם רוצים<br />
            שהמערכת תיצור לכם<br />
            מוזיקת רקע
          </p>
        </button>

        {/* Card 4 - Narration (Voice Only) */}
        <button 
          onClick={() => handleSelect('narration')} 
          className={`bg-white rounded-[14px] lg:rounded-[20px] p-4 lg:p-6 text-center hover:scale-[1.02] transition-all min-h-[140px] lg:min-h-[200px] flex flex-col items-center justify-start pt-5 lg:pt-8 ${
            selectedOption === 'narration' ? 'ring-3 lg:ring-4 ring-[#D4A853] shadow-lg' : ''
          }`}
        >
          <Mic className="w-8 h-8 lg:w-12 lg:h-12 text-[#D4A853] mb-2 lg:mb-4" strokeWidth={1.5} />
          <h3 
            className="text-[14px] lg:text-[18px] xl:text-[22px] font-bold text-[#742551] mb-1 lg:mb-2"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            קריינות
          </h3>
          <p 
            className="text-[11px] lg:text-[13px] xl:text-[14px] text-[#742551]/70 leading-snug"
            style={{ fontFamily: 'Discovery_Fs' }}
          >
            הקלטת קול בלבד<br />
            ללא מוזיקת רקע
          </p>
        </button>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between w-full px-4 lg:px-[71px]">
        {/* Back Button - Left */}
        <button 
          onClick={onBack} 
          className="h-[38px] lg:h-[44px] xl:h-[50px] px-5 lg:px-8 rounded-full text-[14px] lg:text-[18px] xl:text-[20px] text-white border-2 border-white hover:bg-white/10 transition-all" 
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          לשלב הקודם
        </button>

        {/* Next Button - Right */}
        <button 
          onClick={handleNext}
          disabled={!selectedOption}
          className={`h-[38px] lg:h-[44px] xl:h-[50px] px-5 lg:px-8 rounded-full text-[14px] lg:text-[18px] xl:text-[20px] font-bold text-[#742551] transition-all ${
            selectedOption 
              ? 'hover:opacity-90 cursor-pointer' 
              : 'opacity-50 cursor-not-allowed'
          }`} 
          style={{ fontFamily: 'Discovery_Fs', background: '#D4A853' }}
        >
          לשלב הבא ←
        </button>
      </div>
    </div>
  );
}
