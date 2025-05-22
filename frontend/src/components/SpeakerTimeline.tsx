import React from 'react';
import { Play } from 'phosphor-react';

interface SpeakerSegment {
  start: number;
  end: number;
}

interface SpeakerData {
  name: string;
  segments: SpeakerSegment[];
  totalDuration: number; // in seconds
  percentage: number;
}

interface SpeakerTimelineProps {
  speakers: SpeakerData[];
  totalDuration: number; // in seconds
  onSeek: (time: number) => void;
}

const SpeakerTimeline: React.FC<SpeakerTimelineProps> = ({ 
  speakers, 
  totalDuration,
  onSeek
}) => {
  // Generate a unique color for each speaker
  const getSpeakerColor = (name: string) => {
    const colors = [
      'bg-green-500', // green
      'bg-blue-500',  // blue
      'bg-purple-500', // purple
      'bg-orange-500', // orange
      'bg-pink-500'    // pink
    ];
    
    const index = Math.abs(name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length;
    return colors[index];
  };

  // Format time duration to minutes and seconds
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  return (
    <div className="space-y-4 mt-4">
      {speakers.map((speaker, index) => (
        <div key={index} className="relative">
          <div className="flex items-center mb-1">
            <button 
              className="mr-2 flex items-center justify-center text-gray-700 hover:text-gray-900"
              onClick={() => speaker.segments[0] && onSeek(speaker.segments[0].start)}
              title="Jump to first appearance"
            >
              <Play size={16} />
            </button>
            <span className="font-medium">{speaker.name}</span>
            <span className="ml-auto text-gray-600 text-sm">
              {speaker.percentage}% · {formatDuration(speaker.totalDuration)}
            </span>
          </div>
          
          <div className="h-4 bg-gray-200 rounded-full overflow-hidden relative">
            {speaker.segments.map((segment, i) => {
              const startPercent = (segment.start / totalDuration) * 100;
              const widthPercent = ((segment.end - segment.start) / totalDuration) * 100;
              
              return (
                <div
                  key={i}
                  className={`absolute h-full ${getSpeakerColor(speaker.name)}`}
                  style={{ 
                    left: `${startPercent}%`, 
                    width: `${widthPercent}%` 
                  }}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SpeakerTimeline; 