import { Check, X, CaretDown, SpinnerGap, CheckCircle, Lightbulb } from 'phosphor-react';
import { Listbox, Transition } from '@headlessui/react';
import { Fragment, useState, useRef, useEffect } from 'react';
import type { Task } from '../interfaces';

interface TaskSidebarProps {
  isOpen: boolean;
  isVisible: boolean;
  task: Task | null;
  currentUserId?: string | null;
  teamMemberId?: string;
  teamMemberName?: string;
  onClose: () => void;
  onStatusToggle: (task: Task) => void;
  onAssignmentUpdate: (task: Task, teamMemberId: string) => void;
  onTaskUpdate?: (task: Task, updates: Partial<Task>) => void;
  onApproveSuggestedTask?: (task: Task) => void;
  onRejectSuggestedTask?: (task: Task) => void;
  onEditSuggestedTask?: (task: Task, newText: string) => void;
}

const TaskSidebar = ({
  isOpen,
  isVisible,
  task,
  currentUserId,
  teamMemberId,
  teamMemberName,
  onClose,
  onStatusToggle,
  onAssignmentUpdate,
  onTaskUpdate,
  onApproveSuggestedTask,
  onRejectSuggestedTask,
  onEditSuggestedTask
}: TaskSidebarProps) => {
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [assignmentDropdownOpen, setAssignmentDropdownOpen] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [editingSuggestedTaskId, setEditingSuggestedTaskId] = useState<string | null>(null);
  const [editedSuggestedTaskText, setEditedSuggestedTaskText] = useState('');
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const assignmentDropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle outside clicks for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setStatusDropdownOpen(false);
      }
      if (assignmentDropdownRef.current && !assignmentDropdownRef.current.contains(event.target as Node)) {
        setAssignmentDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && isEditingDescription) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }, [isEditingDescription, editedDescription]);

  // Initialize edited description when starting to edit
  const startEditing = () => {
    if (task) {
      setEditedDescription(task.text);
      setIsEditingDescription(true);
    }
  };

  // Save description changes
  const saveDescription = () => {
    if (task && onTaskUpdate && editedDescription.trim() !== '') {
      onTaskUpdate(task, { text: editedDescription.trim() });
    }
    setIsEditingDescription(false);
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditingDescription(false);
    setEditedDescription('');
  };

  // Handle key presses in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveDescription();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  };

  // Status options for dropdown
  const statusOptions = [
    { 
      id: 'incomplete', 
      name: 'In Progress',
      icon: <SpinnerGap size={20} className="text-yellow-600" />
    },
    { 
      id: 'complete', 
      name: 'Complete',
      icon: <CheckCircle size={20} weight="fill" className="text-green-600" />
    }
  ];

  const handleStatusChange = (newStatus: 'incomplete' | 'complete') => {
    if (task && newStatus !== task.status) {
      onStatusToggle(task);
    }
    setStatusDropdownOpen(false);
  };

  // Suggested task editing functions
  const startEditingSuggestedTask = (suggestedTask: Task) => {
    setEditingSuggestedTaskId(suggestedTask.id);
    setEditedSuggestedTaskText(suggestedTask.text);
  };

  const saveEditedSuggestedTask = (suggestedTask: Task) => {
    if (editedSuggestedTaskText.trim() !== '' && onEditSuggestedTask) {
      onEditSuggestedTask(suggestedTask, editedSuggestedTaskText.trim());
    }
    setEditingSuggestedTaskId(null);
    setEditedSuggestedTaskText('');
  };

  const cancelEditingSuggestedTask = () => {
    setEditingSuggestedTaskId(null);
    setEditedSuggestedTaskText('');
  };

  // Helper functions for suggested task styling
  const getAssigneeColor = (assignee?: string) => {
    // Use the same color scheme as regular tasks
    if (assignee === 'manager') {
      return 'bg-gray-100 text-gray-800'; // Same as "Me" in regular tasks
    } else {
      return 'bg-indigo-100 text-indigo-800'; // Same as assigned team member in regular tasks
    }
  };

  const getAssigneeDisplayText = (assignee?: string, teamMemberName?: string) => {
    if (assignee === 'manager') {
      return 'Me'; // Consistent with regular task display
    } else if (assignee === 'team_member') {
      return teamMemberName || 'Team Member'; // Use actual name when available
    }
    return 'Unassigned';
  };

  // Don't render anything if neither task nor suggested tasks are provided
  if (!task) return null;

  return (
    <Transition
      as={Fragment}
      show={isVisible}
      enter="transition-opacity ease-out duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity ease-in duration-200"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div className="fixed inset-0 overflow-hidden z-50">
        <div className="absolute inset-0 overflow-hidden">
          {/* Click area to close (no visible overlay) */}
          <div 
            className="absolute inset-0 transition-opacity" 
            onClick={(e) => {
              // Only close if clicking directly on the overlay, not on dropdown elements
              if (e.target === e.currentTarget) {
                onClose();
              }
            }}
          ></div>
          
          {/* Sidebar panel */}
          <div className="fixed inset-y-0 right-0 max-w-full flex">
            <Transition
              as={Fragment}
              show={isOpen}
              enter="transform transition ease-in-out duration-300"
              enterFrom="translate-x-full"
              enterTo="translate-x-0"
              leave="transform transition ease-in-out duration-200"
              leaveFrom="translate-x-0"
              leaveTo="translate-x-full"
            >
              <div className="relative w-screen max-w-xl">
                <div 
                  className="h-full flex flex-col py-6 bg-white shadow-xl overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
              {/* Header */}
              <div className="px-4 sm:px-6 mb-4 flex justify-between items-center">
                {task?.status === 'suggested' && (
                  <div className="flex items-center bg-yellow-50 px-2 py-1 rounded-md">
                    <Lightbulb size={16} className="text-yellow-500 mr-1" />
                    <span className="text-sm text-gray-700 font-medium">AI Suggested</span>
                  </div>
                )}
                {task?.status !== 'suggested' && <div></div>}
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
                {task ? (
                  task.status === 'suggested' ? (
                    /* Suggested Task View */
                    <>
                      {/* Task Text - Using same style as regular tasks */}
                      <div className="mb-8 pt-4">
                        {editingSuggestedTaskId === task.id ? (
                          <textarea
                            ref={textareaRef}
                            value={editedSuggestedTaskText}
                            onChange={(e) => setEditedSuggestedTaskText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                saveEditedSuggestedTask(task);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelEditingSuggestedTask();
                              }
                            }}
                            onBlur={() => saveEditedSuggestedTask(task)}
                            className="w-full text-xl text-gray-900 bg-transparent border-none outline-none resize-none overflow-hidden leading-relaxed px-1 py-1 rounded -mx-1 -my-1"
                            style={{ 
                              minHeight: '1.5em',
                              fontFamily: 'inherit',
                              lineHeight: '1.625',
                              resize: 'none',
                              margin: '0'
                            }}
                            placeholder="Enter task description..."
                          />
                        ) : (
                          <h2 
                            className="text-xl text-gray-900 cursor-pointer hover:bg-gray-50 rounded px-1 py-1 -mx-1 transition-colors leading-relaxed"
                            onClick={() => startEditingSuggestedTask(task)}
                            title="Click to edit"
                          >
                            {task.text}
                          </h2>
                        )}
                      </div>
                      
                      {/* Assignment Display - Similar to regular task but read-only for suggested */}
                      <div className="mb-6">
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-700">Suggested Assignment</span>
                        </div>
                        <div className="mt-2">
                          {task.suggestedAssignee && (
                            <span className={`inline-flex items-center px-3 py-1 rounded-md text-base font-medium ${getAssigneeColor(task.suggestedAssignee)}`}>
                              {getAssigneeDisplayText(task.suggestedAssignee, teamMemberName)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Related Area */}
                      {task.relatedAreaForSupport && (
                        <div className="mb-6">
                          <h3 className="text-sm font-medium text-gray-700 mb-2">Related Area</h3>
                          <p className="text-base text-gray-600 bg-gray-50 rounded-md p-3">
                            {task.relatedAreaForSupport}
                          </p>
                        </div>
                      )}

                      {/* Reasoning */}
                      {task.reasoning && (
                        <div className="mb-8">
                          <h3 className="text-sm font-medium text-gray-700 mb-2">Why This Helps</h3>
                          <p className="text-base text-gray-600 bg-blue-50 rounded-md p-3 border-l-4 border-blue-200">
                            {task.reasoning}
                          </p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => onApproveSuggestedTask?.(task)}
                          className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => onRejectSuggestedTask?.(task)}
                          className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                        >
                          Dismiss
                        </button>
                      </div>
                    </>
                  ) : (
                    /* Regular Task View */
                    <>
                      {/* Task Text */}
                      <div className="mb-8 pt-4">
                        {isEditingDescription ? (
                          <textarea
                            ref={textareaRef}
                            value={editedDescription}
                            onChange={(e) => setEditedDescription(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={saveDescription}
                            className="w-full text-xl text-gray-900 bg-transparent border-none outline-none resize-none overflow-hidden leading-relaxed px-1 py-1 rounded -mx-1 -my-1"
                            style={{ 
                              minHeight: '1.5em',
                              fontFamily: 'inherit',
                              lineHeight: '1.625',
                              resize: 'none',
                              margin: '0'
                            }}
                            placeholder="Enter task description..."
                          />
                        ) : (
                          <h2 
                            className="text-xl text-gray-900 cursor-pointer hover:bg-gray-50 rounded px-1 py-1 -mx-1 transition-colors leading-relaxed"
                            onClick={startEditing}
                            title="Click to edit"
                          >
                            {task.text}
                          </h2>
                        )}
                      </div>
                      
                      {/* Assignment and Status Side by Side */}
                      <div className="mb-6 flex gap-4">
                        {/* Assignment */}
                        <div className="flex-1">
                          <Listbox value={task.assignedTo || ''} onChange={(value) => { onAssignmentUpdate(task, value); setAssignmentDropdownOpen(false); }}>
                            <div className="relative" ref={assignmentDropdownRef}>
                              <Listbox.Button 
                                className="relative w-full cursor-pointer rounded-md bg-white py-2 pl-3 pr-10 text-left border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-base h-10"
                                onClick={() => setAssignmentDropdownOpen(!assignmentDropdownOpen)}
                              >
                                <span className="flex items-center h-full">
                                  <span className="block truncate text-gray-700">
                                    {task.assignedTo === currentUserId ? 'Me' : 
                                     task.assignedTo === teamMemberId ? (teamMemberName || 'Team Member') : 
                                     'Unassigned'}
                                  </span>
                                </span>
                                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                  <CaretDown
                                    size={16}
                                    className="text-gray-400"
                                    aria-hidden="true"
                                  />
                                </span>
                              </Listbox.Button>
                              <Transition
                                as={Fragment}
                                show={assignmentDropdownOpen}
                                enter="transition ease-out duration-100"
                                enterFrom="transform opacity-0 scale-95"
                                enterTo="transform opacity-100 scale-100"
                                leave="transition ease-in duration-75"
                                leaveFrom="transform opacity-100 scale-100"
                                leaveTo="transform opacity-0 scale-95"
                              >
                                <Listbox.Options className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                  <Listbox.Option
                                    className={({ active }) =>
                                      `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                                        active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                                      }`
                                    }
                                    value=""
                                  >
                                    {({ selected }) => (
                                      <>
                                        <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                          Unassigned
                                        </span>
                                        {selected ? (
                                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                                            <Check size={16} aria-hidden="true" />
                                          </span>
                                        ) : null}
                                      </>
                                    )}
                                  </Listbox.Option>
                                  {currentUserId && (
                                    <Listbox.Option
                                      className={({ active }) =>
                                        `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                                          active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                                        }`
                                      }
                                      value={currentUserId}
                                    >
                                      {({ selected }) => (
                                        <>
                                          <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                            Me
                                          </span>
                                          {selected ? (
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                                              <Check size={16} aria-hidden="true" />
                                            </span>
                                          ) : null}
                                        </>
                                      )}
                                    </Listbox.Option>
                                  )}
                                  {teamMemberId && (
                                    <Listbox.Option
                                      className={({ active }) =>
                                        `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                                          active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                                        }`
                                      }
                                      value={teamMemberId}
                                    >
                                      {({ selected }) => (
                                        <>
                                          <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                            {teamMemberName || 'Team Member'}
                                          </span>
                                          {selected ? (
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                                              <Check size={16} aria-hidden="true" />
                                            </span>
                                          ) : null}
                                        </>
                                      )}
                                    </Listbox.Option>
                                  )}
                                </Listbox.Options>
                              </Transition>
                            </div>
                          </Listbox>
                        </div>
                        
                        {/* Status Dropdown */}
                        <div className="flex-1">
                          <Listbox value={task.status} onChange={handleStatusChange}>
                            <div className="relative" ref={statusDropdownRef}>
                              <Listbox.Button 
                                className="relative w-full cursor-pointer rounded-md bg-white py-2 pl-3 pr-10 text-left border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-base h-10"
                                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                              >
                                <span className="flex items-center">
                                  <span className="mr-3">
                                    {statusOptions.find(option => option.id === task.status)?.icon}
                                  </span>
                                  <span className="block truncate">
                                    {statusOptions.find(option => option.id === task.status)?.name}
                                  </span>
                                </span>
                                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                  <CaretDown
                                    size={16}
                                    className="text-gray-400"
                                    aria-hidden="true"
                                  />
                                </span>
                              </Listbox.Button>
                              <Transition
                                as={Fragment}
                                show={statusDropdownOpen}
                                enter="transition ease-out duration-100"
                                enterFrom="transform opacity-0 scale-95"
                                enterTo="transform opacity-100 scale-100"
                                leave="transition ease-in duration-75"
                                leaveFrom="transform opacity-100 scale-100"
                                leaveTo="transform opacity-0 scale-95"
                              >
                                <Listbox.Options className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                  {statusOptions.map((option) => (
                                    <Listbox.Option
                                      key={option.id}
                                      className={({ active }) =>
                                        `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                                          active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                                        }`
                                      }
                                      value={option.id}
                                    >
                                      {({ selected }) => (
                                        <>
                                          <span className="flex items-center">
                                            <span className="mr-3">
                                              {option.icon}
                                            </span>
                                            <span
                                              className={`block truncate ${
                                                selected ? 'font-medium' : 'font-normal'
                                              }`}
                                            >
                                              {option.name}
                                            </span>
                                          </span>
                                          {selected ? (
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                                              <Check size={16} aria-hidden="true" />
                                            </span>
                                          ) : null}
                                        </>
                                      )}
                                    </Listbox.Option>
                                  ))}
                                </Listbox.Options>
                              </Transition>
                            </div>
                          </Listbox>
                        </div>
                      </div>

                      {/* Reasoning for regular tasks */}
                      {task.reasoning && (
                        <div className="mb-6">
                          <h3 className="text-sm font-medium text-gray-700 mb-2">Why This Helps</h3>
                          <p className="text-base text-gray-600 bg-blue-50 rounded-md p-3 border-l-4 border-blue-200">
                            {task.reasoning}
                          </p>
                        </div>
                      )}
                    </>
                  )
                ) : null}
              </div>
            </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </Transition>
  );
};

export default TaskSidebar; 