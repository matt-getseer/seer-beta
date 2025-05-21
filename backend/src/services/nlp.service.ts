import { MeetingProcessorService, MeetingType, NLPResult } from './meeting-processor.service';

/**
 * Service to handle NLP processing of meeting transcripts
 * This is now a facade that delegates to the more specialized services
 */
export class NLPService {
  /**
   * Process a meeting transcript with custom NLP
   */
  static async processMeetingTranscript(
    meetingId: string,
    transcript: string,
    meetingType: MeetingType = MeetingType.DEFAULT
  ): Promise<NLPResult> {
    // Delegate to the MeetingProcessorService
    return MeetingProcessorService.processMeetingTranscript(meetingId, transcript, meetingType);
  }
  
  // Re-export types for backward compatibility
  static get MeetingType() {
    return MeetingType;
  }
} 