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

// Export interfaces for use in other components
export type { SpeakerSegment, SpeakerData };

/**
 * Parse a transcript text with the format "Speaker: text" into speaker segments
 * This is a simplified implementation and would need to be adapted to work with
 * your actual transcript format which includes timestamps
 */
export const parseTranscriptToSpeakerData = (
  transcript: string,
  totalDuration: number // total video duration in seconds
): SpeakerData[] => {
  if (!transcript) return [];
  
  // This regex matches patterns like "Speaker: text"
  const speakerRegex = /([^:]+):(.*?)(?=\n[^:]+:|$)/gs;
  const speakers = new Map<string, SpeakerData>();
  
  let match;
  let currentTime = 0;
  const timePerChar = totalDuration / transcript.length; // Approximate time per character
  
  while ((match = speakerRegex.exec(transcript)) !== null) {
    const speakerName = match[1].trim();
    const text = match[2].trim();
    
    // Approximate segment duration based on text length
    const segmentDuration = text.length * timePerChar;
    const segmentStart = currentTime;
    const segmentEnd = currentTime + segmentDuration;
    
    // Create or update speaker data
    if (!speakers.has(speakerName)) {
      speakers.set(speakerName, {
        name: speakerName,
        segments: [],
        totalDuration: 0,
        percentage: 0
      });
    }
    
    const speakerData = speakers.get(speakerName)!;
    speakerData.segments.push({
      start: segmentStart,
      end: segmentEnd
    });
    speakerData.totalDuration += segmentDuration;
    
    // Move current time forward
    currentTime = segmentEnd;
  }
  
  // Calculate speaking percentages
  let speakersArray = Array.from(speakers.values());
  const totalSpokenDuration = speakersArray.reduce((sum, speaker) => sum + speaker.totalDuration, 0);
  
  speakersArray = speakersArray.map(speaker => ({
    ...speaker,
    percentage: Math.round((speaker.totalDuration / totalSpokenDuration) * 100)
  }));
  
  // Sort by speaking duration (most to least)
  return speakersArray.sort((a, b) => b.totalDuration - a.totalDuration);
};

/**
 * For a more accurate implementation, you would need:
 * 1. Actual timestamp data from the transcript
 * 2. A more sophisticated regex that captures timestamps
 * 3. Logic to merge adjacent segments from the same speaker
 */ 