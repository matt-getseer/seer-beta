import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'phosphor-react';
import SpeakerTimeline from './SpeakerTimeline';
import { parseTranscriptToSpeakerData } from '../utils/transcriptParser';
import type { SpeakerData } from '../utils/transcriptParser';

interface VideoPlayerProps {
  videoUrl: string;
  transcript: string | undefined;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl, transcript }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speakers, setSpeakers] = useState<SpeakerData[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Parse transcript when duration changes or transcript updates
  useEffect(() => {
    if (duration > 0 && transcript) {
      const speakerData = parseTranscriptToSpeakerData(transcript, duration);
      setSpeakers(speakerData);
    }
  }, [transcript, duration]);
  
  // Toggle play/pause
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  // Seek to a specific time
  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      
      // Auto-play when seeking
      if (!isPlaying) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };
  
  // Update current time as video plays
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };
  
  // Set duration when metadata is loaded
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };
  
  // Format time to MM:SS
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-lg overflow-hidden shadow-sm">
      <div className="relative">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-auto"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          controls={false} // Hide native controls
        />
        
        {/* Play/Pause Button Overlay */}
        <button
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 hover:bg-opacity-30 transition-opacity"
          onClick={togglePlay}
        >
          {isPlaying ? (
            <Pause size={48} color="#ffffff" weight="fill" />
          ) : (
            <Play size={48} color="#ffffff" weight="fill" />
          )}
        </button>
      </div>
      
      {/* Progress Bar */}
      <div className="py-2 px-4">
        <div className="relative h-2 bg-gray-200 rounded-full cursor-pointer" 
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const offsetX = e.clientX - rect.left;
            const percentage = offsetX / rect.width;
            const newTime = percentage * duration;
            handleSeek(newTime);
          }}
        >
          <div 
            className="absolute h-full bg-indigo-600 rounded-full" 
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
        </div>
        
        <div className="flex justify-between text-sm text-gray-500 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      
      {/* Speaker Timeline */}
      {speakers.length > 0 && (
        <div className="px-4 pb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Speaker Timeline</h3>
          <SpeakerTimeline 
            speakers={speakers}
            currentTime={currentTime}
            totalDuration={duration}
            onSeek={handleSeek}
          />
        </div>
      )}
    </div>
  );
};

export default VideoPlayer; 