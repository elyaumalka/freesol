import { ProjectData } from "@/pages/customer/NewProject";
import { Input } from "@/components/ui/input";

interface NewProjectStep1Props {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onNext: () => void;
}

export function NewProjectStep1({
  projectData,
  updateProjectData,
  onNext
}: NewProjectStep1Props) {
  const handleContinue = () => {
    if (projectData.projectName.trim()) {
      onNext();
    }
  };

  return (
    <div className="flex-col w-full flex items-center justify-center flex-1 px-4" dir="rtl">
      {/* Main Title - Centered */}
      <h1 
        className="text-[22px] lg:text-[32px] xl:text-[40px] font-bold text-[#D4A853] text-center leading-tight mb-4 lg:mb-8"
        style={{ fontFamily: 'Discovery_Fs' }}
      >
        הבמה מוכנה, הכלים ממתינים — זה הזמן להתחיל ליצור.
      </h1>

      {/* Form Section - Centered, same width as title */}
      <div className="flex-col w-full max-w-[600px] lg:max-w-[900px] flex items-start justify-start">
        {/* Label - Right aligned */}
        <label 
          className="text-white mb-1.5 lg:mb-2 text-right pr-4 lg:pr-[26px] text-[14px] lg:text-[16px] xl:text-lg font-normal"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          שם הפרוייקט
        </label>
        
        {/* Input */}
        <Input 
          value={projectData.projectName} 
          onChange={e => updateProjectData({ projectName: e.target.value })} 
          placeholder="לדוגמא: שיר הבר מצווה של מוישי ..." 
          className="w-full h-[46px] lg:h-[54px] xl:h-[60px] text-[16px] lg:text-[20px] xl:text-[24px] text-right rounded-full bg-white border-none px-4 lg:px-8 text-[#742551] placeholder:text-[14px] lg:placeholder:text-[18px] xl:placeholder:text-[24px] placeholder:font-bold placeholder:text-[#742551]/50 mb-3 lg:mb-4" 
          style={{ fontFamily: 'Discovery_Fs' }} 
          dir="rtl" 
        />

        {/* Continue Button - Left aligned */}
        <div className="w-full flex items-start justify-end">
          <button 
            onClick={handleContinue} 
            disabled={!projectData.projectName.trim()} 
            className="h-[40px] lg:h-[46px] xl:h-[50px] px-5 lg:px-8 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 font-medium text-primary bg-accent text-[14px] lg:text-[16px] xl:text-lg" 
            style={{ fontFamily: 'Discovery_Fs', background: '#D4A853' }}
          >
            לשלב הבא ←
          </button>
        </div>
      </div>
    </div>
  );
}
