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
  id: number;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
  adminId?: number | null;
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

// User API functions
export const userApi = {
  // Get all users
  getUsers: async (): Promise<User[]> => {
    return fetchApi<User[]>('/api/users');
  },

  // Get a specific user
  getUser: async (id: number): Promise<User> => {
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
  updateUser: async (id: number, userData: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<User> => {
    return fetchApi<User>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  // Delete a user
  deleteUser: async (id: number): Promise<void> => {
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
  removeTeamMember: async (userId: number): Promise<void> => {
    return fetchApi<void>(`/api/users/team-members/${userId}`, {
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

export default {
  userApi,
}; 