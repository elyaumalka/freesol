import { useState } from "react";
import { ProjectData } from "@/pages/customer/NewProject";
import { Input } from "@/components/ui/input";
import { Play } from "lucide-react";

interface NewProjectStep3Props {
  projectData: ProjectData;
  updateProjectData: (data: Partial<ProjectData>) => void;
  onNext: () => void;
  onBack: () => void;
}

// Mock playbacks data
const mockPlaybacks = [
  { id: "1", name: "צעקה", artist: "מרדכי בן דוד", duration: "05:48", price: 0 },
  { id: "2", name: "צעקה", artist: "מרדכי בן דוד", duration: "05:48", price: 0 },
  { id: "3", name: "צעקה", artist: "מרדכי בן דוד", duration: "05:48", price: 58 },
  { id: "4", name: "צעקה", artist: "מרדכי בן דוד", duration: "05:48", price: 58 },
  { id: "5", name: "צעקה", artist: "מרדכי בן דוד", duration: "05:48", price: 58 },
  { id: "6", name: "צעקה", artist: "מרדכי בן דוד", duration: "05:48", price: 58 },
];

export function NewProjectStep3({ projectData, updateProjectData, onNext, onBack }: NewProjectStep3Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedPlayback, setSelectedPlayback] = useState<string | null>(null);

  const handleShowResults = () => {
    if (searchQuery.trim()) {
      setShowResults(true);
    }
  };

  const handleSelectPlayback = (playback: typeof mockPlaybacks[0]) => {
    setSelectedPlayback(playback.id);
    updateProjectData({ playbackId: playback.id, playbackName: playback.name });
  };

  const handleNext = () => {
    if (selectedPlayback) {
      onNext();
    }
  };

  return (
    <div className="flex flex-col w-full max-w-[1000px]">
      {/* Search Section */}
      <div className="flex flex-col items-start mb-6">
        <label 
          className="text-[24px] text-[#D4A853] mb-3"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          הזינו את שם השיר או האמן
        </label>
        <div className="w-full relative">
          {/* Input */}
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="לדוגמא: צעקה או מרדכי בן דוד"
            className="w-full h-[60px] text-[20px] text-right rounded-full bg-white border-none pr-8 pl-44 text-[#742551] placeholder:text-[#742551]/50"
            style={{ fontFamily: 'Discovery_Fs' }}
            dir="rtl"
          />
          
          {/* Search Button - Inside input on left */}
          <button
            onClick={handleShowResults}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-[48px] px-6 rounded-full text-[18px] font-bold text-[#742551] transition-all hover:opacity-90"
            style={{
              fontFamily: 'Discovery_Fs',
              background: '#D4A853',
            }}
          >
            הצג תוצאות
          </button>
        </div>
      </div>

      {/* Results Grid */}
      {showResults && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          {mockPlaybacks.map((playback) => (
            <button
              key={playback.id}
              onClick={() => handleSelectPlayback(playback)}
              className={`flex items-center justify-between p-3 rounded-[15px] transition-all ${
                selectedPlayback === playback.id 
                  ? 'bg-white ring-2 ring-[#D4A853]' 
                  : 'bg-white hover:bg-white/90'
              }`}
            >
              {/* Left side - Album Cover & Song Info */}
              <div className="flex items-center gap-3">
                {/* Album Cover Placeholder */}
                <div 
                  className="w-[60px] h-[60px] rounded-lg flex items-center justify-center"
                  style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #333 100%)' }}
                >
                  <span className="text-[#D4A853] text-[12px] font-bold" style={{ fontFamily: 'Discovery_Fs' }}>
                    צעקה
                  </span>
                </div>
                
                <div className="text-right">
                  <div 
                    className="text-[18px] font-bold text-[#742551]"
                    style={{ fontFamily: 'Discovery_Fs' }}
                  >
                    {playback.name}
                  </div>
                  <div 
                    className="text-[14px] text-[#742551]/70"
                    style={{ fontFamily: 'Discovery_Fs' }}
                  >
                    {playback.artist}
                  </div>
                </div>
              </div>

              {/* Duration */}
              <span 
                className="text-[16px] text-[#333]"
                style={{ fontFamily: 'Discovery_Fs' }}
              >
                {playback.duration}
              </span>

              {/* Play Button */}
              <div className="w-10 h-10 rounded-full bg-[#D4A853] flex items-center justify-center">
                <Play className="w-5 h-5 text-[#742551] fill-current ml-0.5" />
              </div>

              {/* Right - Price Button */}
              <div 
                className="px-4 py-2 rounded-lg text-[14px] font-bold"
                style={{ 
                  fontFamily: 'Discovery_Fs',
                  background: '#D4A853',
                  color: '#742551'
                }}
              >
                <div>עלות</div>
                <div>{playback.price}₪</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-auto">
        {/* Back Button - Left */}
        <button
          onClick={onBack}
          className="h-[50px] px-8 rounded-full text-[20px] text-white border-2 border-white hover:bg-white/10 transition-all"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          לשלב הקודם
        </button>

        {/* Next Button - Right */}
        <button
          onClick={handleNext}
          disabled={!selectedPlayback}
          className="h-[50px] px-8 rounded-full text-[20px] font-bold text-[#742551] transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            fontFamily: 'Discovery_Fs',
            background: '#D4A853',
          }}
        >
          לשלב הבא ←
        </button>
      </div>
    </div>
  );
}
