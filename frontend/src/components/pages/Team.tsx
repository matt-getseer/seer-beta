import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { userApi } from '../../utils/api';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { TrashSimple, Plus, MagnifyingGlass, CaretDown, Clock } from 'phosphor-react';
import { Link } from 'react-router-dom';
import type { 
  TeamMember, 
  TeamInvitation, 
  InviteErrorResponse,
  InviteStatus 
} from '../../interfaces';
import { useApiState } from '../../hooks/useApiState';
import { formatDate } from '../../utils/dateUtils';
import StatusBadge from '../StatusBadge';

const Team = () => {
  const { user, isSignedIn } = useUser();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [inviteStatus, setInviteStatus] = useState<InviteStatus | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<TeamInvitation[]>([]);
  const [{ loading, error }, { setLoading, setError }] = useApiState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  
  // For delete confirmation dialog
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // For delete confirmation text inputs
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // For invite dialog
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  
  // For invitation delete confirmation
  const [isDeleteInviteModalOpen, setIsDeleteInviteModalOpen] = useState(false);
  const [inviteToDelete, setInviteToDelete] = useState<TeamInvitation | null>(null);
  const [isDeletingInvite, setIsDeletingInvite] = useState(false);
  
  // For delete invitation text inputs
  const [deleteInviteConfirmText, setDeleteInviteConfirmText] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Make sure Clerk has initialized
        if (!isSignedIn || !user) {
          setError('Please sign in to access team features.');
          setLoading(false);
          return;
        }
        
        // First check if current user is signed in
        if (isSignedIn && user) {
          // Ensure the user is registered with our backend
          try {
            // Register/get current user
            const currentUser = await userApi.registerUser({
              email: user.primaryEmailAddress?.emailAddress || '',
              name: user.fullName
            });
            
            if (currentUser?.role === 'admin') {
              setIsAdmin(true);
              
              try {
                // Fetch team members, invite status, and pending invitations
                const [members, status, invitations] = await Promise.all([
                  userApi.getTeamMembers(),
                  userApi.getInviteStatus(),
                  userApi.getPendingInvitations()
                ]);
                
                // Transform the data to match our component's needs
                const formattedMembers = members.map(member => ({
                  ...member,
                  // In a real app, you might have a lastSignedIn field
                  // For now, we'll just use the updatedAt as a placeholder
                  lastSignedIn: member.updatedAt,
                }));
                
                setTeamMembers(formattedMembers);
                setInviteStatus(status);
                setPendingInvitations(invitations);
              } catch (adminError) {
                // Failed to fetch admin-specific data
                
                // Fetch all users as fallback
                const users = await userApi.getUsers();
                const formattedUsers = users.map(user => ({
                  ...user,
                  lastSignedIn: user.updatedAt,
                }));
                
                setTeamMembers(formattedUsers);
                
                // Set a less alarming error message
                setError('Some team management features may be unavailable.');
              }
            } else {
              // Regular users just see all users
              const users = await userApi.getUsers();
              
              const formattedUsers = users.map(user => ({
                ...user,
                lastSignedIn: user.updatedAt,
              }));
              
              setTeamMembers(formattedUsers);
            }
          } catch (registrationError) {
            // Failed to register user with backend
            
            // Fallback to fetch all users even if registration fails
            const users = await userApi.getUsers();
            
            const formattedUsers = users.map(user => ({
              ...user,
              lastSignedIn: user.updatedAt,
            }));
            
            setTeamMembers(formattedUsers);
            setError('User authentication issue. Some features may be limited.');
          }
        } else {
          // Fallback to fetch all users if not signed in
          const users = await userApi.getUsers();
          
          const formattedUsers = users.map(user => ({
            ...user,
            lastSignedIn: user.updatedAt,
          }));
          
          setTeamMembers(formattedUsers);
        }
        
      } catch (err) {
        // Failed to fetch team data
        setError('Failed to load team data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isSignedIn, user, isAdmin]);

  // formatDate function now imported from utils/dateUtils
  
  // Open delete confirmation modal
  const confirmDelete = (member: TeamMember) => {
    setMemberToDelete(member);
    setDeleteConfirmText(''); // Reset confirmation text
    setIsDeleteModalOpen(true);
  };
  
  // Handle team member deletion
  const handleDeleteMember = async () => {
    if (!memberToDelete) return;
    
    try {
      setIsDeleting(true);
      // Ensure id is a string for the API call
      await userApi.removeTeamMember(memberToDelete.id.toString());
      
      // Update the UI
      setTeamMembers(prev => prev.filter(member => member.id !== memberToDelete.id));
      
      // Update invite status
      if (inviteStatus) {
        setInviteStatus({
          ...inviteStatus,
          currentCount: inviteStatus.currentCount - 1,
          remainingInvites: inviteStatus.remainingInvites + 1,
          canInvite: true
        });
      }
      
      // Close the modal
      setIsDeleteModalOpen(false);
      setMemberToDelete(null);
    } catch (err) {
      // Failed to delete team member
      setError('Failed to remove team member. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Handle sending invitation
  const handleSendInvite = async () => {
    if (!inviteEmail) return;
    
    setInviteError('');
    setIsInviting(true);
    
    try {
      // Check if we can invite more members
      if (inviteStatus && !inviteStatus.canInvite) {
        setInviteError('You have reached the maximum number of team members.');
        return;
      }
      
      // Call the invitation API
      const response = await userApi.sendInvitation(inviteEmail);
      
      // Update the invite status with the new counts
      if (response.inviteStatus) {
        setInviteStatus(response.inviteStatus);
      }
      
      // Reset the form and close the modal
      setInviteEmail('');
      setIsInviteModalOpen(false);
      
      // Show success message (could use a toast notification here)
      // Invitation sent successfully
    } catch (err: unknown) {
      // Failed to send invitation
      // Extract error message from API response if available
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Failed to send invitation. Please try again.';
      setInviteError(errorMessage);
      
      // If the error response contains invite status information, update it
      if (err && typeof err === 'object') {
        const errorResp = err as InviteErrorResponse;
        if (errorResp.canInvite !== undefined) {
          setInviteStatus({
            canInvite: errorResp.canInvite,
            currentCount: errorResp.currentCount || 0,
            remainingInvites: errorResp.remainingInvites || 0
          });
        }
      }
    } finally {
      setIsInviting(false);
    }
  };
  
  // Filter team members based on search term
  const filteredTeamMembers = teamMembers.filter(member => {
    const searchTermLower = searchTerm.toLowerCase();
    return (
      member.name?.toLowerCase().includes(searchTermLower) ||
      member.email.toLowerCase().includes(searchTermLower) ||
      member.role.toLowerCase().includes(searchTermLower)
    );
  });

  // Filter pending invitations based on search term
  const filteredInvitations = pendingInvitations.filter(invitation => {
    const searchTermLower = searchTerm.toLowerCase();
    return invitation.email.toLowerCase().includes(searchTermLower);
  });

  // Open delete invitation confirmation modal
  const confirmDeleteInvitation = (invitation: TeamInvitation) => {
    setInviteToDelete(invitation);
    setDeleteInviteConfirmText(''); // Reset confirmation text
    setIsDeleteInviteModalOpen(true);
  };
  
  // Handle invitation deletion
  const handleDeleteInvitation = async () => {
    if (!inviteToDelete) return;
    
    try {
      setIsDeletingInvite(true);
      await userApi.cancelInvitation(inviteToDelete.id);
      
      // Update the UI
      setPendingInvitations(prev => prev.filter(inv => inv.id !== inviteToDelete.id));
      
      // Update invite status
      if (inviteStatus) {
        const pendingCount = (inviteStatus.pendingInvitations || 0) - 1;
        setInviteStatus({
          ...inviteStatus,
          pendingInvitations: pendingCount,
          remainingInvites: inviteStatus.remainingInvites + 1,
          canInvite: true
        });
      }
      
      // Close the modal
      setIsDeleteInviteModalOpen(false);
      setInviteToDelete(null);
    } catch (err) {
      // Failed to delete invitation
      setError('Failed to cancel invitation. Please try again.');
    } finally {
      setIsDeletingInvite(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#171717] mb-6">Team</h1>
      
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
              activeTab === 'invitations'
                ? 'text-[#171717] border-b-2 border-[#171717]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('invitations')}
          >
            Invitations
            {inviteStatus?.pendingInvitations ? (
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                {inviteStatus.pendingInvitations}
              </span>
            ) : null}
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
              <span>Sort by: Created</span>
              <CaretDown size={20} weight="fill" />
            </button>
          </div>
          
          {isAdmin && (
            <button
              className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setIsInviteModalOpen(true)}
              disabled={inviteStatus ? !inviteStatus.canInvite : false}
            >
              <Plus size={20} className="mr-2" />
              Invite team member
              {inviteStatus && ` (${inviteStatus.remainingInvites} left)`}
            </button>
          )}
        </div>
      </div>
      
      {/* Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-center">
            <p className="text-gray-500">Loading...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-500">
            <p>{error}</p>
          </div>
        ) : activeTab === 'all' ? (
          // Team Members Table
          filteredTeamMembers.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500">No team members found.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last signed in</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  {isAdmin && (
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTeamMembers.map((member) => (
                  <tr key={member.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                          {member.name?.charAt(0) || member.email.charAt(0)}
                        </div>
                        <div className="ml-4">
                          <div className="text-base font-medium text-[#171717]">
                            {member.role === 'admin' ? (
                              // Admin users don't have profile pages, so no link
                              member.name || 'Unnamed User'
                            ) : (
                              // Non-admin users have profile pages with links
                              <Link to={`/team/${member.id}`} className="hover:text-indigo-600 hover:underline">
                                {member.name || 'Unnamed User'}
                              </Link>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{member.email}</div>
                          <div className="text-xs text-gray-400 mt-1">{member.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-500">
                      {member.lastSignedIn ? formatDate(member.lastSignedIn) : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-500">
                      {formatDate(member.createdAt)}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {member.role === 'admin' ? (
                          <span className="text-gray-400 italic">Admin</span>
                        ) : (
                          <button
                            onClick={() => confirmDelete(member)}
                            className="text-red-600 hover:text-red-900"
                            title="Remove team member"
                          >
                            <TrashSimple size={20} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          // Pending Invitations Table
          filteredInvitations.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500">No pending invitations.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                  {isAdmin && (
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInvitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                          {invitation.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-base font-medium text-[#171717]">
                            {invitation.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge 
                        status={invitation.status}
                        className="px-2 text-xs leading-5 font-semibold"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-500">
                      {formatDate(invitation.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-500">
                      {formatDate(invitation.expires || invitation.expiresAt || invitation.createdAt)}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            // In a real app we'd create logic to resend here
                            // Resend invitation functionality would go here
                          }}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                          title="Resend invitation"
                        >
                          <Clock size={20} />
                        </button>
                        <button
                          onClick={() => confirmDeleteInvitation(invitation)}
                          className="text-red-600 hover:text-red-900"
                          title="Cancel invitation"
                        >
                          <TrashSimple size={20} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
      
      {/* Delete Confirmation Dialog */}
      <Transition appear show={isDeleteModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setIsDeleteModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    Remove Team Member
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to remove <strong>{memberToDelete?.name || memberToDelete?.email}</strong> from your team? This action cannot be undone.
                    </p>
                    
                    <div className="mt-4">
                      <label htmlFor="confirm-delete" className="block text-sm font-medium text-gray-700 mb-1">
                        Type DELETE to confirm
                      </label>
                      <input
                        type="text"
                        id="confirm-delete"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="DELETE"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                      onClick={() => setIsDeleteModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50"
                      onClick={handleDeleteMember}
                      disabled={isDeleting || deleteConfirmText !== 'DELETE'}
                    >
                      {isDeleting ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
      
      {/* Invite Team Member Dialog */}
      <Transition appear show={isInviteModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setIsInviteModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    Invite Team Member
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 mb-4">
                      Enter the email address of the person you want to invite to your team.
                    </p>
                    
                    <div className="mb-4">
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        id="email"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="colleague@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>
                    
                    {inviteError && (
                      <div className="mb-4 text-sm text-red-600">
                        {inviteError}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                      onClick={() => setIsInviteModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50"
                      onClick={handleSendInvite}
                      disabled={isInviting || !inviteEmail.trim()}
                    >
                      {isInviting ? 'Sending...' : 'Send Invitation'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
      
      {/* Delete Invitation Confirmation Dialog */}
      <Transition appear show={isDeleteInviteModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setIsDeleteInviteModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    Cancel Invitation
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to cancel the invitation to <strong>{inviteToDelete?.email}</strong>? This action cannot be undone.
                    </p>
                    
                    <div className="mt-4">
                      <label htmlFor="confirm-delete-invite" className="block text-sm font-medium text-gray-700 mb-1">
                        Type DELETE to confirm
                      </label>
                      <input
                        type="text"
                        id="confirm-delete-invite"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                        value={deleteInviteConfirmText}
                        onChange={(e) => setDeleteInviteConfirmText(e.target.value)}
                        placeholder="DELETE"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                      onClick={() => setIsDeleteInviteModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50"
                      onClick={handleDeleteInvitation}
                      disabled={isDeletingInvite || deleteInviteConfirmText !== 'DELETE'}
                    >
                      {isDeletingInvite ? 'Canceling...' : 'Cancel Invitation'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default Team; 