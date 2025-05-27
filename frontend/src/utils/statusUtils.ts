// Status badge utility functions to eliminate duplication across components

export type StatusType = 'scheduled' | 'completed' | 'cancelled' | 'pending' | 'processing' | 'failed';

export interface StatusConfig {
  text: string;
  className: string;
}

// Get status style based on meeting status and processing status
export function getStatusStyle(status: string, processingStatus?: string): string {
  // If processing is pending or in progress, show a special status
  if (processingStatus === 'pending' || processingStatus === 'processing') {
    return 'bg-yellow-100 text-yellow-800';
  }
  
  switch (status) {
    case 'scheduled':
      return 'bg-blue-100 text-blue-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'cancelled':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// Get display text for status
export function getStatusText(status: string, processingStatus?: string): string {
  if (status === 'completed') {
    if (processingStatus === 'pending') {
      return 'Processing Pending';
    } else if (processingStatus === 'processing') {
      return 'Processing';
    } else if (processingStatus === 'failed') {
      return 'Processing Failed';
    }
  }
  
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Get complete status configuration
export function getStatusConfig(status: string, processingStatus?: string): StatusConfig {
  return {
    text: getStatusText(status, processingStatus),
    className: getStatusStyle(status, processingStatus)
  };
}

// Status badge component props
export interface StatusBadgeProps {
  status: string;
  processingStatus?: string;
  className?: string;
}

// Reusable status badge classes
export const statusBadgeClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

// Assignment badge utilities
export function getAssignmentBadgeClass(assigned: boolean): string {
  return assigned 
    ? 'bg-blue-100 text-blue-800' 
    : 'bg-gray-100 text-gray-800';
}

// Change type badge utilities for meeting changes
export function getChangeTypeBadgeClass(changeType: string): string {
  switch (changeType) {
    case 'updated':
      return 'bg-blue-100 text-blue-800';
    case 'deleted':
      return 'bg-red-100 text-red-800';
    case 'synced':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
} 