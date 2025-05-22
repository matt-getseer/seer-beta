// User and Team Member interfaces
export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
  adminId?: string | null;
}

// Action Item interface
export interface ActionItem {
  id: string;
  text: string;
  assignedTo?: string; // Team member ID
  assigneeName?: string; // Team member name for display
  status: 'incomplete' | 'complete';
  createdAt: string;
  completedAt?: string;
}

// Key Area interface
export interface KeyArea {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  createdById: string;
  createdBy?: {
    id: string;
    name: string | null;
    email: string;
  };
}

// Activity interface for team member activities
export interface Activity {
  id?: string;
  date: string;
  action: string;
  details: string;
  type?: string;
}

// Analysis History interface
export interface AnalysisHistory {
  id: string;
  userId: string;
  analyzedAt: string;
  wins: string[];
  areasForSupport: string[];
  actionItems: string[];
}

export interface TeamMember extends User {
  department?: string;
  joinDate?: string;
  bio?: string;
  lastSignedIn: string;
  wins?: string[];
  areasForSupport?: string[];
  actionItems?: string[];
  keyAreas?: KeyArea[];
  recentActivity?: Activity[];
}

// Meeting interfaces
export interface Meeting {
  id: string;
  title: string;
  teamMemberId: string;
  teamMember?: string;
  date: string;
  duration: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  googleMeetLink?: string;
  executiveSummary?: string;
  wins?: string[];
  areasForSupport?: string[];
  actionItems?: ActionItem[];
  transcript?: string;
  recordingUrl?: string;
  createdBy?: string;
}

// Invitation interfaces
export interface TeamInvitation {
  id: string;
  email: string;
  status: string;
  role?: string;
  createdAt: string;
  expiresAt?: string;
  expires?: string;
  updatedAt?: string;
}

export interface InvitationResponse {
  id: string;
  email: string;
  status: string;
}

export interface InviteErrorResponse {
  error: string;
  details?: string;
  status?: number;
  canInvite?: boolean;
  currentCount?: number;
  remainingInvites?: number;
  pendingInvitations?: number;
}

export interface InviteStatus {
  canInvite: boolean;
  currentCount: number;
  remainingInvites: number;
  pendingInvitations?: number;
} 