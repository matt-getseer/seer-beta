import { formatDistanceToNow, format } from 'date-fns';

// Centralized date formatting utilities to eliminate duplication

// Function to safely format dates and ensure they're not in the future
export function getValidDate(dateString: string): Date {
  const parsedDate = new Date(dateString);
  const now = new Date();
  
  // Check if date is valid and not in the future
  if (isNaN(parsedDate.getTime()) || parsedDate > now) {
    return now;
  }
  
  return parsedDate;
}

// Format date for display with relative time
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return dateString;
  }
}

// Format date for meeting display
export function formatMeetingDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).replace(/(\d+)(?=(,))/, function(match) {
    // Add ordinal suffix (st, nd, rd, th)
    const day = parseInt(match);
    if (day > 3 && day < 21) return day + 'th'; // 4th through 20th
    switch (day % 10) {
      case 1: return day + 'st';
      case 2: return day + 'nd';
      case 3: return day + 'rd';
      default: return day + 'th';
    }
  });
}

// Format date and time for meeting overview
export function formatMeetingDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  });
}

// Format duration for display
export function formatDuration(minutes: number | string): string {
  const mins = typeof minutes === 'string' ? parseInt(minutes) : minutes;
  return `${mins} min${mins !== 1 ? 's' : ''}`;
}

// Format date for team member join date
export function formatJoinDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });
}

// Format date for changes modal
export function formatChangeDate(date: string | Date | null): string {
  if (!date) return 'N/A';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'MMM d, yyyy h:mm a');
}

// Format duration for changes modal
export function formatChangeDuration(minutes: number | null): string {
  if (minutes === null) return 'N/A';
  return `${minutes} min${minutes !== 1 ? 's' : ''}`;
} 