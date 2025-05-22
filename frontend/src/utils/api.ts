// Base API URL - adjust this based on your environment configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Generic type for API responses with pagination
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Common error type
export interface ApiError {
  error: string;
  details?: string;
  status?: number;
}

// Helper to handle JSON responses and errors consistently
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: ApiError = {
      error: errorData.error || 'An error occurred',
      details: errorData.details,
      status: response.status,
    };
    throw error;
  }
  return response.json();
}

// Declare Clerk on Window for TypeScript
declare global {
  interface Window {
    Clerk?: {
      session?: {
        getToken: () => Promise<string>;
      }
    }
  }
}

// Generic fetch wrapper with error handling
async function fetchApi<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    // Get the auth token from Clerk (if user is logged in)
    let authHeaders = {};
    try {
      const token = await window.Clerk?.session?.getToken();
      if (token) {
        authHeaders = {
          'Authorization': `Bearer ${token}`,
        };
      }
    } catch (e) {
      console.warn('Failed to get auth token', e);
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...authHeaders,
        ...options.headers,
      },
    });

    return handleResponse<T>(response);
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// User API interfaces
export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
  adminId?: string | null;
}

// Team invitation status
export interface InviteStatus {
  canInvite: boolean;
  currentCount: number;
  remainingInvites: number;
  pendingInvitations?: number;
}

// Invitation response
export interface InvitationResponse {
  success: boolean;
  message: string;
  inviteStatus: InviteStatus;
}

// Team invitation
export interface TeamInvitation {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  expires: string;
}

// Key area interface
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
    name: string;
    email: string;
  };
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
  actionItems?: string[];
  transcript?: string;
  recordingUrl?: string;
}

// Team member analysis from meetings
export interface TeamMemberAnalysis {
  wins: string[];
  areasForSupport: string[];
  actionItems: string[];
  cached?: boolean;
  lastAnalyzedAt?: string;
}

// Analysis history interface
export interface AnalysisHistory {
  id: string;
  userId: string;
  analyzedAt: string;
  wins: string[];
  areasForSupport: string[];
  actionItems: string[];
}

// User API functions
export const userApi = {
  // Get all users
  getUsers: async (): Promise<User[]> => {
    return fetchApi<User[]>('/api/users');
  },

  // Get a specific user
  getUser: async (id: string): Promise<User> => {
    return fetchApi<User>(`/api/users/${id}`);
  },

  // Get current user
  getCurrentUser: async (): Promise<User> => {
    return fetchApi<User>('/api/users/me');
  },

  // Register current user with backend (after Clerk auth)
  registerUser: async (userData: { email: string; name: string | null }): Promise<User> => {
    return fetchApi<User>('/api/users/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  // Create a new user
  createUser: async (userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> => {
    return fetchApi<User>('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  // Update a user
  updateUser: async (id: string, userData: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<User> => {
    return fetchApi<User>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  // Delete a user
  deleteUser: async (id: string): Promise<void> => {
    return fetchApi<void>(`/api/users/${id}`, {
      method: 'DELETE',
    });
  },

  // Team-specific endpoints
  
  // Get team members for the current admin
  getTeamMembers: async (): Promise<User[]> => {
    return fetchApi<User[]>('/api/users/team-members');
  },
  
  // Check if admin can invite more team members
  getInviteStatus: async (): Promise<InviteStatus> => {
    return fetchApi<InviteStatus>('/api/users/can-invite');
  },
  
  // Remove a team member (admin only)
  removeTeamMember: async (userId: string): Promise<void> => {
    return fetchApi<void>(`/api/users/team-members/${userId}`, {
      method: 'DELETE',
    });
  },
  
  // Get pending invitations
  getPendingInvitations: async (): Promise<TeamInvitation[]> => {
    return fetchApi<TeamInvitation[]>('/api/users/invitations');
  },
  
  // Cancel an invitation
  cancelInvitation: async (invitationId: string): Promise<{ success: boolean }> => {
    return fetchApi<{ success: boolean }>(`/api/users/invitations/${invitationId}`, {
      method: 'DELETE',
    });
  },
  
  // Send an invitation email to a new team member
  sendInvitation: async (email: string): Promise<InvitationResponse> => {
    return fetchApi<InvitationResponse>('/api/users/invite', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  
  // Accept an invitation using a token
  acceptInvitation: async (token: string, clerkId: string): Promise<{ success: boolean; message: string; user: User }> => {
    return fetchApi<{ success: boolean; message: string; user: User }>('/api/users/invite/accept', {
      method: 'POST',
      body: JSON.stringify({ token, clerkId }),
    });
  }
};

// Meeting API functions
export const meetingApi = {
  // Get all meetings
  getMeetings: async (): Promise<Meeting[]> => {
    return fetchApi<Meeting[]>('/api/meetings');
  },
  
  // Get a specific meeting
  getMeeting: async (id: string): Promise<Meeting> => {
    return fetchApi<Meeting>(`/api/meetings/${id}`);
  },
  
  // Get meetings by team member
  getMeetingsByTeamMember: async (teamMemberId: string): Promise<Meeting[]> => {
    return fetchApi<Meeting[]>(`/api/meetings/team-member/${teamMemberId}`);
  },
  
  // Analyze team member meetings to extract recurring themes
  analyzeTeamMemberMeetings: async (teamMemberId: string, forceRefresh: boolean = false): Promise<TeamMemberAnalysis> => {
    return fetchApi<TeamMemberAnalysis>(`/api/meetings/analyze/${teamMemberId}?forceRefresh=${forceRefresh}`);
  },
  
  // Get analysis history for a team member
  getAnalysisHistory: async (teamMemberId: string): Promise<AnalysisHistory[]> => {
    return fetchApi<AnalysisHistory[]>(`/api/meetings/analysis-history/${teamMemberId}`);
  },
  
  // Get a specific analysis by ID
  getAnalysisById: async (teamMemberId: string, analysisId: string): Promise<AnalysisHistory> => {
    return fetchApi<AnalysisHistory>(`/api/meetings/analysis/${teamMemberId}/${analysisId}`);
  },
  
  // Generate an agenda for a meeting based on previous meetings
  generateAgenda: async (meetingId: string): Promise<{
    phases: {
      name: string;
      items: string[];
    }[];
    note?: string;
    error?: string;
  }> => {
    return fetchApi(`/api/meetings/${meetingId}/agenda`);
  }
};

// Key Area API functions
export const keyAreaApi = {
  // Get key areas for a user
  getKeyAreas: async (userId: string): Promise<KeyArea[]> => {
    return fetchApi<KeyArea[]>(`/api/users/${userId}/key-areas`);
  },
  
  // Create a key area
  createKeyArea: async (userId: string, keyAreaData: { name: string; description: string }): Promise<KeyArea> => {
    return fetchApi<KeyArea>(`/api/users/${userId}/key-areas`, {
      method: 'POST',
      body: JSON.stringify(keyAreaData),
    });
  },
  
  // Update a key area
  updateKeyArea: async (userId: string, areaId: string, keyAreaData: { name: string; description: string }): Promise<KeyArea> => {
    return fetchApi<KeyArea>(`/api/users/${userId}/key-areas/${areaId}`, {
      method: 'PUT',
      body: JSON.stringify(keyAreaData),
    });
  },
  
  // Delete a key area
  deleteKeyArea: async (userId: string, areaId: string): Promise<{ success: boolean }> => {
    return fetchApi<{ success: boolean }>(`/api/users/${userId}/key-areas/${areaId}`, {
      method: 'DELETE',
    });
  }
};

export default {
  userApi,
  meetingApi,
  keyAreaApi
}; 