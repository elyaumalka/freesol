import { Mic, ChevronDown } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface MicSettingsPanelProps {
  micGain: number;
  onMicGainChange: (gain: number) => void;
  vuLevel: number;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  onDeviceChange: (deviceId: string) => void;
  compact?: boolean;
}

export function MicSettingsPanel({
  micGain,
  onMicGainChange,
  vuLevel,
  devices,
  selectedDeviceId,
  onDeviceChange,
  compact = false,
}: MicSettingsPanelProps) {
  // VU meter color: green < 60, yellow 60-85, red > 85
  const getVuColor = (level: number) => {
    if (level > 85) return '#EF4444'; // red
    if (level > 60) return '#EAB308'; // yellow
    return '#22C55E'; // green
  };

  return (
    <div className={`w-full ${compact ? 'max-w-[400px]' : 'max-w-[600px]'} bg-white/10 rounded-[15px] p-4 space-y-3`}>
      {/* Device Selection */}
      {devices.length > 1 && (
        <div className="flex items-center gap-3">
          <Mic className="w-4 h-4 text-[#D4A853] flex-shrink-0" />
          <div className="relative flex-1">
            <select
              value={selectedDeviceId}
              onChange={(e) => onDeviceChange(e.target.value)}
              className="w-full bg-white/10 text-white text-[14px] rounded-[8px] px-3 py-2 pr-8 appearance-none border border-white/20 focus:outline-none focus:border-[#D4A853]"
              style={{ fontFamily: 'Discovery_Fs', direction: 'rtl' }}
            >
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId} className="bg-[#742551] text-white">
                  {device.label || `מיקרופון ${devices.indexOf(device) + 1}`}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-white/50 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Mic Gain Slider */}
      <div className="flex items-center gap-3">
        <span 
          className="text-[14px] text-[#D4A853] min-w-[60px] text-right flex-shrink-0"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          הגברה
        </span>
        <Slider
          value={[micGain * 100]}
          onValueChange={(vals) => onMicGainChange(vals[0] / 100)}
          min={100}
          max={400}
          step={10}
          className="flex-1"
        />
        <span 
          className="text-[14px] text-white/70 min-w-[40px] text-left"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          x{micGain.toFixed(1)}
        </span>
      </div>

      {/* VU Meter */}
      <div className="flex items-center gap-3">
        <span 
          className="text-[14px] text-[#D4A853] min-w-[60px] text-right flex-shrink-0"
          style={{ fontFamily: 'Discovery_Fs' }}
        >
          עוצמה
        </span>
        <div className="flex-1 h-[12px] bg-black/30 rounded-full overflow-hidden relative">
          <div
            className="h-full rounded-full transition-all duration-75"
            style={{
              width: `${vuLevel}%`,
              backgroundColor: getVuColor(vuLevel),
            }}
          />
          {/* Threshold markers */}
          <div className="absolute top-0 left-[40%] w-[1px] h-full bg-white/20" />
          <div className="absolute top-0 left-[15%] w-[1px] h-full bg-white/20" />
        </div>
        <span 
          className="text-[12px] min-w-[30px] text-left font-mono"
          style={{ color: getVuColor(vuLevel) }}
        >
          {Math.round(vuLevel)}
        </span>
      </div>
    </div>
  );
}
