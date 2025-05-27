import { useState, useEffect, useCallback } from 'react';
import { MagnifyingGlass, CaretDown, Plus, ArrowUp, ArrowDown } from 'phosphor-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';
import NewMeetingModal from '../NewMeetingModal';
import type { TeamMember } from '../../interfaces';
import { useApiState } from '../../hooks/useApiState';
import { formatMeetingDate, formatDuration } from '../../utils/dateUtils';
import StatusBadge from '../StatusBadge';

// Use a direct URL reference instead of process.env
const API_URL = 'http://localhost:3001';

interface Meeting {
  id: string;
  title: string;
  teamMemberId: string;
  teamMember?: string; // Will be populated from user data
  date: string;
  rawDate?: Date; // Store raw date for sorting
  duration: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  googleMeetLink?: string;
}

// User interface - not used in this file
// interface User {
//   id: string;
//   email: string;
//   name: string | null;
//   role: string;
// }

const Meetings = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [{ loading, error }, { setLoading, setError }] = useApiState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sortField, setSortField] = useState<keyof Meeting>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const { getToken } = useAuth();
  
  // Fetch current user data
  const fetchCurrentUser = useCallback(async () => {
    try {
      const token = await getToken();
      
      const response = await axios.get(`${API_URL}/api/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setIsAdmin(response.data.role === 'admin');
    } catch (error) {
              // Error fetching current user
    }
  }, [getToken]);
  
  // Fetch meetings from API
  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      
      // Use the optimized endpoint that includes team member information
      const response = await axios.get(`${API_URL}/api/meetings/with-team-members`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Process meetings - team member info is already included
      const meetingsWithNames = response.data.map((meeting: any) => {
        const rawDate = new Date(meeting.date);
        
        return {
          ...meeting,
          teamMember: meeting.teamMember?.name || 'Unknown',
          rawDate, // Store raw date for sorting
          // Format date for display
          date: formatMeetingDate(meeting.date),
          // Format duration for display
          duration: formatDuration(meeting.duration)
        }
      });
      
      setMeetings(meetingsWithNames);
      setError(null);
    } catch (error) {
      // Error fetching meetings
      setError('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, [getToken]);
  
  useEffect(() => {
    fetchCurrentUser();
    fetchMeetings();
  }, [fetchCurrentUser, fetchMeetings]);
  
  // Handle sorting
  const handleSort = (field: keyof Meeting) => {
    if (field === sortField) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
    
    // Reset to first page when sorting changes
    setCurrentPage(1);
  };
  
  // Filter meetings based on search term and active tab
  const filteredMeetings = meetings.filter(meeting => {
    // First filter by tab
    if (activeTab !== 'all' && meeting.status !== activeTab) {
      return false;
    }
    
    // Then filter by search term
    const searchTermLower = searchTerm.toLowerCase();
    return (
      meeting.title.toLowerCase().includes(searchTermLower) ||
      meeting.teamMember?.toLowerCase().includes(searchTermLower) ||
      meeting.date.toLowerCase().includes(searchTermLower) ||
      meeting.status.toLowerCase().includes(searchTermLower)
    );
  });

  // Sort the filtered meetings
  const sortedMeetings = [...filteredMeetings].sort((a, b) => {
    let aValue: string | number | Date | undefined = a[sortField];
    let bValue: string | number | Date | undefined = b[sortField];
    
    // Special cases for sorting
    if (sortField === 'date' && a.rawDate && b.rawDate) {
      aValue = a.rawDate;
      bValue = b.rawDate;
    }
    
    // Handle undefined values
    if (aValue === undefined) return sortDirection === 'asc' ? -1 : 1;
    if (bValue === undefined) return sortDirection === 'asc' ? 1 : -1;
    
    if (aValue < bValue) {
      return sortDirection === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortDirection === 'asc' ? 1 : -1;
    }
    return 0;
  });
  
  // Paginate the sorted and filtered meetings
  const totalPages = Math.ceil(sortedMeetings.length / itemsPerPage);
  const paginatedMeetings = sortedMeetings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

    // Status functions now handled by StatusBadge component

  // Handle new meeting created
  const handleMeetingCreated = () => {
    fetchMeetings();
  };
  
  // Render sort indicator
  const renderSortIndicator = (field: keyof Meeting) => {
    if (sortField !== field) return null;
    
    return sortDirection === 'asc' 
      ? <ArrowUp size={16} className="inline ml-1" /> 
      : <ArrowDown size={16} className="inline ml-1" />;
  };
  
  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#171717] mb-6">Meetings</h1>
      
      {/* Tabs */}
      <div className="mb-4 border-b border-gray-200">
        <div className="flex -mb-px">
          <button
            className={`mr-4 py-2 px-1 font-medium text-base ${
              activeTab === 'all'
                ? 'text-[#171717] border-b-2 border-[#171717]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('all')}
          >
            All
          </button>
          <button
            className={`mr-4 py-2 px-1 font-medium text-base ${
              activeTab === 'scheduled'
                ? 'text-[#171717] border-b-2 border-[#171717]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('scheduled')}
          >
            Scheduled
          </button>
          <button
            className={`mr-4 py-2 px-1 font-medium text-base ${
              activeTab === 'completed'
                ? 'text-[#171717] border-b-2 border-[#171717]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('completed')}
          >
            Completed
          </button>
        </div>
      </div>
      
      {/* Search and Actions */}
      <div className="flex justify-between items-center mb-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlass size={20} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div className="flex items-center">
          <div className="relative inline-block text-left mr-3">
            <button className="inline-flex justify-between items-center w-48 rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none">
              <span>Sort by: {sortField.charAt(0).toUpperCase() + sortField.slice(1)}</span>
              <CaretDown size={20} weight="fill" />
            </button>
          </div>
          
          {isAdmin && (
            <button
              className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={() => setShowNewMeetingModal(true)}
            >
              <Plus size={20} className="mr-2" />
              New Meeting
            </button>
          )}
        </div>
      </div>
      
      {/* Error State */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded">
          <p>{error}</p>
          <button 
            onClick={fetchMeetings}
            className="underline text-red-700 font-medium mt-2"
          >
            Try Again
          </button>
        </div>
      )}
      
      {/* Loading State */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading meetings...</p>
        </div>
      ) : (
        /* Table */
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {paginatedMeetings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No meetings found</p>
            </div>
          ) : (
            <>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('date')}
                    >
                      Date {renderSortIndicator('date')}
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('title')}
                    >
                      Meeting name {renderSortIndicator('title')}
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('teamMember')}
                    >
                      Team member {renderSortIndicator('teamMember')}
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('duration')}
                    >
                      Duration {renderSortIndicator('duration')}
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('status')}
                    >
                      Status {renderSortIndicator('status')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedMeetings.map((meeting) => (
                    <tr key={meeting.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-base text-gray-500">
                        {meeting.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-base font-medium text-[#171717]">
                          <Link to={`/meetings/${meeting.id}`} className="hover:text-indigo-600 hover:underline">
                            {meeting.title}
                          </Link>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-base text-gray-500">
                        {meeting.teamMember}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-base text-gray-500">
                        {meeting.duration}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge 
                          status={meeting.status} 
                          processingStatus={meeting.processingStatus} 
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                        <span className="font-medium">
                          {Math.min(currentPage * itemsPerPage, filteredMeetings.length)}
                        </span>{' '}
                        of <span className="font-medium">{filteredMeetings.length}</span> results
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                            currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          <span className="sr-only">Previous</span>
                          &laquo; Prev
                        </button>
                        
                        {/* Page numbers */}
                        {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                          // Show pages around current page
                          let pageNum = currentPage;
                          if (totalPages <= 5) {
                            // Show all pages if 5 or fewer
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            // At start, show first 5 pages
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            // At end, show last 5 pages
                            pageNum = totalPages - 4 + i;
                          } else {
                            // In middle, show current page and 2 pages before/after
                            pageNum = currentPage - 2 + i;
                          }
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium ${
                                currentPage === pageNum
                                  ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                                  : 'bg-white text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        
                        <button
                          onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                            currentPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          <span className="sr-only">Next</span>
                          Next &raquo;
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      
      {/* New Meeting Modal */}
      <NewMeetingModal 
        isOpen={showNewMeetingModal}
        onClose={() => setShowNewMeetingModal(false)}
        onMeetingCreated={handleMeetingCreated}
      />
    </div>
  );
};

export default Meetings; 