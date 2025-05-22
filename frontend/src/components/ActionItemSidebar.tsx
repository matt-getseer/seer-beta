import { Check, X } from 'phosphor-react';
import type { ActionItem } from '../interfaces';

interface ActionItemSidebarProps {
  isOpen: boolean;
  isVisible: boolean;
  actionItem: ActionItem | null;
  teamMemberId?: string;
  teamMemberName?: string;
  onClose: () => void;
  onStatusToggle: (actionItem: ActionItem) => void;
  onAssignmentUpdate: (actionItem: ActionItem, teamMemberId: string) => void;
}

const ActionItemSidebar = ({
  isOpen,
  isVisible,
  actionItem,
  teamMemberId,
  teamMemberName,
  onClose,
  onStatusToggle,
  onAssignmentUpdate
}: ActionItemSidebarProps) => {
  if (!isOpen || !actionItem) return null;

  return (
    <div className="fixed inset-0 overflow-hidden z-10">
      <div className="absolute inset-0 overflow-hidden">
        {/* Click area to close (no visible overlay) */}
        <div 
          className="absolute inset-0 transition-opacity" 
          onClick={onClose}
        ></div>
        
        {/* Sidebar panel */}
        <div className="fixed inset-y-0 right-0 max-w-full flex">
          <div className={`relative w-screen max-w-xl transform transition-transform duration-300 ease-in-out ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}>
            <div className="h-full flex flex-col py-6 bg-white shadow-xl overflow-y-auto">
              {/* Header */}
              <div className="px-4 sm:px-6 mb-4 flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900">Action Item Details</h2>
                <button
                  className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  onClick={onClose}
                >
                  <span className="sr-only">Close panel</span>
                  <X size={24} aria-hidden="true" />
                </button>
              </div>
              
              {/* Content */}
              <div className="px-4 sm:px-6 flex-1">
                {/* Status Toggle */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Status</h3>
                  <button
                    className={`inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium ${
                      actionItem.status === 'complete'
                        ? 'bg-green-100 text-green-800 border-green-200'
                        : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                    }`}
                    onClick={() => onStatusToggle(actionItem)}
                  >
                    {actionItem.status === 'complete' ? (
                      <>
                        <Check size={16} className="mr-1" />
                        Completed
                      </>
                    ) : (
                      'Incomplete'
                    )}
                  </button>
                </div>
                
                {/* Action Item Text */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
                  <div className="bg-gray-50 p-3 rounded-md text-gray-700">
                    {actionItem.text}
                  </div>
                </div>
                
                {/* Assignment */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Assigned To</h3>
                  <select
                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-no-repeat bg-right"
                    style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundSize: "1.5em 1.5em", paddingRight: "2.5rem" }}
                    value={actionItem.assignedTo || ''}
                    onChange={(e) => onAssignmentUpdate(actionItem, e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    <option value="admin">Me</option>
                    {teamMemberId && (
                      <option value={teamMemberId}>
                        {teamMemberName || 'Team Member'}
                      </option>
                    )}
                  </select>
                </div>
                
                {/* Dates */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Created</h3>
                  <div className="text-gray-700">
                    {new Date(actionItem.createdAt).toLocaleString()}
                  </div>
                </div>
                
                {actionItem.completedAt && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Completed</h3>
                    <div className="text-gray-700">
                      {new Date(actionItem.completedAt).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActionItemSidebar; 