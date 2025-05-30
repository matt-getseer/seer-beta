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

// MeetingBaas transcript format interfaces
interface MeetingBaasWord {
  start: number;
  end: number;
  word: string;
}

interface MeetingBaasTranscriptSegment {
  speaker: string;
  offset?: number;
  words: MeetingBaasWord[];
}

// Export interfaces for use in other components
export type { SpeakerSegment, SpeakerData, MeetingBaasTranscriptSegment, MeetingBaasWord };

/**
 * Parse MeetingBaas transcript JSON format into readable text
 */
export const parseMeetingBaasTranscript = (transcriptJson: string): string => {
  if (!transcriptJson) return '';
  
  try {
    // Try to parse as JSON first
    const transcriptData: MeetingBaasTranscriptSegment[] = JSON.parse(transcriptJson);
    
    if (!Array.isArray(transcriptData)) {
      // If it's not an array, it might already be formatted text
      return transcriptJson;
    }
    
    // Convert MeetingBaas format to readable text
    let formattedText = '';
    
    transcriptData.forEach((segment) => {
      if (segment.speaker && segment.words && Array.isArray(segment.words)) {
        // Extract just the words and join them
        const text = segment.words.map(word => word.word).join('');
        formattedText += `${segment.speaker}: ${text}\n\n`;
      }
    });
    
    return formattedText.trim();
  } catch (error) {
    // If JSON parsing fails, assume it's already formatted text
    console.warn('Failed to parse transcript as JSON, treating as plain text:', error);
    return transcriptJson;
  }
};

/**
 * Parse MeetingBaas transcript JSON format into speaker data for timeline visualization
 */
export const parseMeetingBaasTranscriptToSpeakerData = (
  transcriptJson: string,
  totalDuration: number
): SpeakerData[] => {
  if (!transcriptJson) return [];
  
  try {
    const transcriptData: MeetingBaasTranscriptSegment[] = JSON.parse(transcriptJson);
    
    if (!Array.isArray(transcriptData)) {
      // Fallback to old parser if not MeetingBaas format
      return parseTranscriptToSpeakerData(transcriptJson, totalDuration);
    }
    
    const speakers = new Map<string, SpeakerData>();
    
    transcriptData.forEach((segment) => {
      if (segment.speaker && segment.words && Array.isArray(segment.words)) {
        const speakerName = segment.speaker;
        
        if (!speakers.has(speakerName)) {
          speakers.set(speakerName, {
            name: speakerName,
            segments: [],
            totalDuration: 0,
            percentage: 0
          });
        }
        
        const speakerData = speakers.get(speakerName)!;
        
        // Calculate segment duration from first to last word
        if (segment.words.length > 0) {
          const firstWord = segment.words[0];
          const lastWord = segment.words[segment.words.length - 1];
          const segmentStart = firstWord.start;
          const segmentEnd = lastWord.end;
          const segmentDuration = segmentEnd - segmentStart;
          
          speakerData.segments.push({
            start: segmentStart,
            end: segmentEnd
          });
          speakerData.totalDuration += segmentDuration;
        }
      }
    });
    
    // Calculate speaking percentages
    let speakersArray = Array.from(speakers.values());
    const totalSpokenDuration = speakersArray.reduce((sum, speaker) => sum + speaker.totalDuration, 0);
    
    speakersArray = speakersArray.map(speaker => ({
      ...speaker,
      percentage: Math.round((speaker.totalDuration / totalSpokenDuration) * 100)
    }));
    
    // Sort by speaking duration (most to least)
    return speakersArray.sort((a, b) => b.totalDuration - a.totalDuration);
  } catch (error) {
    console.warn('Failed to parse MeetingBaas transcript, falling back to text parser:', error);
    return parseTranscriptToSpeakerData(transcriptJson, totalDuration);
  }
};

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