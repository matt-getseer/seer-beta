import { useState, useEffect } from 'react';
import { X, CaretDown, Check, Calendar } from 'phosphor-react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';
import { useApiState } from '../hooks/useApiState';
import { Listbox, Transition, Popover } from '@headlessui/react';
import { format } from 'date-fns';

// Use a direct URL reference instead of process.env
const API_URL = 'http://localhost:3001';

interface Team {
  id: string;
  name: string;
}

// interface User {
//   id: string;
//   email: string;
//   name: string | null;
//   role: string;
// }

interface NewMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMeetingCreated: () => void;
}

const NewMeetingModal = ({ isOpen, onClose, onMeetingCreated }: NewMeetingModalProps) => {
  const [title, setTitle] = useState('');
  const [teamMember, setTeamMember] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [hour, setHour] = useState('09');
  const [minute, setMinute] = useState('00');
  const [duration, setDuration] = useState('60');
  const [{ loading, error }, { setLoading, setError }] = useApiState(false);
  const [teamMembers, setTeamMembers] = useState<Team[]>([]);
  const { getToken } = useAuth();

  // Generate hour options (00-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return { value: hour, label: hour };
  });

  // Generate minute options in 15-minute increments
  const minuteOptions = [
    { value: '00', label: '00' },
    { value: '15', label: '15' },
    { value: '30', label: '30' },
    { value: '45', label: '45' }
  ];

  // Format date for display like Google's style
  const formatDateForDisplay = (date: Date | null): string => {
    if (!date) return 'Select date';
    return format(date, 'EEEE, d MMMM'); // e.g., "Friday, 30 May"
  };

  // Generate calendar days for current month
  const generateCalendarDays = () => {
    const today = new Date();
    const currentMonth = selectedDate || today;
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday
    
    const days = [];
    const current = new Date(startDate);
    
    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return { days, currentMonth: new Date(year, month, 1) };
  };

  // Fetch current user and team members
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = await getToken();
        
        // Fetch current user
        const userResponse = await axios.get(`${API_URL}/api/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        // Fetch team members
        const teamResponse = await axios.get(`${API_URL}/api/users/team`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        // Filter out the current user from team members list
        const filteredTeamMembers = teamResponse.data.filter(
          (member: Team) => member.id !== userResponse.data.id
        );
        
        setTeamMembers(filteredTeamMembers);
      } catch (error) {
        // Error fetching data
        setError('Failed to load team members');
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [isOpen, getToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Format the date and time using the separate hour and minute values
      if (!selectedDate) {
        setError('Please select a date');
        setLoading(false);
        return;
      }
      
      const time = `${hour}:${minute}`;
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      const dateTime = new Date(`${dateString}T${time}`);
      
      const token = await getToken();
      await axios.post(
        `${API_URL}/api/meetings`,
        {
          title,
          teamMemberId: teamMember,
          date: dateTime.toISOString(),
          duration: parseInt(duration),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      setLoading(false);
      onMeetingCreated();
      onClose();
      
      // Reset form
      setTitle('');
      setTeamMember('');
      setSelectedDate(null);
      setHour('09');
      setMinute('00');
      setDuration('60');
    } catch (error) {
      // Error creating meeting
      setLoading(false);
      
      // Handle detailed error messages from API
      if (axios.isAxiosError(error) && error.response) {
        const apiError = error.response.data;
        if (apiError.details) {
          setError(`${apiError.error}: ${apiError.details}`);
        } else if (apiError.note) {
          setError(`${apiError.error} - ${apiError.note}`);
        } else {
          setError(apiError.error || 'Failed to create meeting. Please try again.');
        }
      } else {
        setError('Failed to create meeting. Please try again.');
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">New Meeting</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          {error && (
            <div className="mb-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded">
              <p>{error}</p>
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Meeting Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Weekly Team Sync"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="teamMember" className="block text-sm font-medium text-gray-700 mb-1">
              Team Member
            </label>
            <Listbox value={teamMember} onChange={setTeamMember}>
              <div className="relative">
                <Listbox.Button className="relative w-full cursor-pointer rounded-md bg-white py-2 pl-3 pr-10 text-left border border-gray-300 shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  <span className="block truncate">
                    {teamMember ? teamMembers.find(member => member.id === teamMember)?.name : 'Select a team member'}
                  </span>
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                    <CaretDown
                      size={20}
                      className="text-gray-400"
                      aria-hidden="true"
                    />
                  </span>
                </Listbox.Button>
                <Transition
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    {teamMembers.map((member) => (
                      <Listbox.Option
                        key={member.id}
                        className={({ active }) =>
                          `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                            active ? 'bg-indigo-100 text-indigo-900' : 'text-gray-900'
                          }`
                        }
                        value={member.id}
                      >
                        {({ selected }) => (
                          <>
                            <span
                              className={`block truncate ${
                                selected ? 'font-medium' : 'font-normal'
                              }`}
                            >
                              {member.name}
                            </span>
                            {selected ? (
                              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600">
                                <Check size={20} aria-hidden="true" />
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

          <div className="mb-4">
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <Popover className="relative">
              <Popover.Button className="relative w-full cursor-pointer rounded-md bg-white py-2 pl-3 pr-10 text-left border border-gray-300 shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                <span className="block truncate text-gray-900">
                  {formatDateForDisplay(selectedDate)}
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <Calendar
                    size={20}
                    className="text-gray-400"
                    aria-hidden="true"
                  />
                </span>
              </Popover.Button>
              <Transition
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Popover.Panel className="absolute z-50 mt-1 w-80 rounded-md bg-white p-4 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  {({ close }) => {
                    const { days, currentMonth } = generateCalendarDays();
                    const today = new Date();
                    
                    return (
                      <div>
                        {/* Month navigation */}
                        <div className="flex items-center justify-between mb-4">
                          <button
                            type="button"
                            onClick={() => {
                              const newDate = new Date(currentMonth);
                              newDate.setMonth(newDate.getMonth() - 1);
                              setSelectedDate(newDate);
                            }}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <CaretDown size={16} className="rotate-90 text-gray-600" />
                          </button>
                          <h3 className="text-sm font-medium text-gray-900">
                            {format(currentMonth, 'MMMM yyyy')}
                          </h3>
                          <button
                            type="button"
                            onClick={() => {
                              const newDate = new Date(currentMonth);
                              newDate.setMonth(newDate.getMonth() + 1);
                              setSelectedDate(newDate);
                            }}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <CaretDown size={16} className="-rotate-90 text-gray-600" />
                          </button>
                        </div>
                        
                        {/* Day headers */}
                        <div className="grid grid-cols-7 gap-1 mb-2">
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                            <div key={day} className="text-xs font-medium text-gray-500 text-center py-1">
                              {day}
                            </div>
                          ))}
                        </div>
                        
                        {/* Calendar days */}
                        <div className="grid grid-cols-7 gap-1">
                          {days.map((day, index) => {
                            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                            const isToday = day.toDateString() === today.toDateString();
                            const isSelected = selectedDate && day.toDateString() === selectedDate.toDateString();
                            const isPast = day < today && !isToday;
                            
                            return (
                              <button
                                key={index}
                                type="button"
                                disabled={isPast}
                                onClick={() => {
                                  setSelectedDate(day);
                                  close();
                                }}
                                className={`
                                  w-8 h-8 text-sm rounded-full flex items-center justify-center
                                  ${!isCurrentMonth ? 'text-gray-300' : ''}
                                  ${isPast ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100'}
                                  ${isToday ? 'bg-gray-100 font-medium' : ''}
                                  ${isSelected ? 'bg-indigo-600 text-white hover:bg-indigo-700' : ''}
                                  ${isCurrentMonth && !isPast && !isSelected ? 'text-gray-900' : ''}
                                `}
                              >
                                {day.getDate()}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }}
                </Popover.Panel>
              </Transition>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
                Time
              </label>
              <div className="grid grid-cols-2 gap-2">
                {/* Hour Selector */}
                <Listbox value={hour} onChange={setHour}>
                  <div className="relative">
                    <Listbox.Button className="relative w-full cursor-pointer rounded-md bg-white py-2 pl-3 pr-10 text-left border border-gray-300 shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                      <span className="block truncate text-gray-900">
                        {hour}
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
                      leave="transition ease-in duration-100"
                      leaveFrom="opacity-100"
                      leaveTo="opacity-0"
                    >
                      <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                        {hourOptions.map((option) => (
                          <Listbox.Option
                            key={option.value}
                            className={({ active }) =>
                              `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                                active ? 'bg-indigo-100 text-indigo-900' : 'text-gray-900'
                              }`
                            }
                            value={option.value}
                          >
                            {({ selected }) => (
                              <>
                                <span
                                  className={`block truncate ${
                                    selected ? 'font-medium' : 'font-normal'
                                  }`}
                                >
                                  {option.label}
                                </span>
                                {selected ? (
                                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600">
                                    <Check size={20} aria-hidden="true" />
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
                
                {/* Minute Selector */}
                <Listbox value={minute} onChange={setMinute}>
                  <div className="relative">
                    <Listbox.Button className="relative w-full cursor-pointer rounded-md bg-white py-2 pl-3 pr-10 text-left border border-gray-300 shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                      <span className="block truncate text-gray-900">
                        {minute}
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
                      leave="transition ease-in duration-100"
                      leaveFrom="opacity-100"
                      leaveTo="opacity-0"
                    >
                      <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                        {minuteOptions.map((option) => (
                          <Listbox.Option
                            key={option.value}
                            className={({ active }) =>
                              `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                                active ? 'bg-indigo-100 text-indigo-900' : 'text-gray-900'
                              }`
                            }
                            value={option.value}
                          >
                            {({ selected }) => (
                              <>
                                <span
                                  className={`block truncate ${
                                    selected ? 'font-medium' : 'font-normal'
                                  }`}
                                >
                                  {option.label}
                                </span>
                                {selected ? (
                                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600">
                                    <Check size={20} aria-hidden="true" />
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
          </div>

          <div className="mb-4">
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
              Duration
            </label>
            <Listbox value={duration} onChange={setDuration}>
              <div className="relative">
                <Listbox.Button className="relative w-full cursor-pointer rounded-md bg-white py-2 pl-3 pr-10 text-left border border-gray-300 shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  <span className="block truncate">
                    {duration === '15' ? '15 minutes' :
                     duration === '30' ? '30 minutes' :
                     duration === '45' ? '45 minutes' :
                     duration === '60' ? '1 hour' : '1 hour'}
                  </span>
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                    <CaretDown
                      size={20}
                      className="text-gray-400"
                      aria-hidden="true"
                    />
                  </span>
                </Listbox.Button>
                <Transition
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    <Listbox.Option
                      className={({ active }) =>
                        `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                          active ? 'bg-indigo-100 text-indigo-900' : 'text-gray-900'
                        }`
                      }
                      value="15"
                    >
                      {({ selected }) => (
                        <>
                          <span
                            className={`block truncate ${
                              selected ? 'font-medium' : 'font-normal'
                            }`}
                          >
                            15 minutes
                          </span>
                          {selected ? (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600">
                              <Check size={20} aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Listbox.Option>
                    <Listbox.Option
                      className={({ active }) =>
                        `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                          active ? 'bg-indigo-100 text-indigo-900' : 'text-gray-900'
                        }`
                      }
                      value="30"
                    >
                      {({ selected }) => (
                        <>
                          <span
                            className={`block truncate ${
                              selected ? 'font-medium' : 'font-normal'
                            }`}
                          >
                            30 minutes
                          </span>
                          {selected ? (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600">
                              <Check size={20} aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Listbox.Option>
                    <Listbox.Option
                      className={({ active }) =>
                        `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                          active ? 'bg-indigo-100 text-indigo-900' : 'text-gray-900'
                        }`
                      }
                      value="45"
                    >
                      {({ selected }) => (
                        <>
                          <span
                            className={`block truncate ${
                              selected ? 'font-medium' : 'font-normal'
                            }`}
                          >
                            45 minutes
                          </span>
                          {selected ? (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600">
                              <Check size={20} aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Listbox.Option>
                    <Listbox.Option
                      className={({ active }) =>
                        `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                          active ? 'bg-indigo-100 text-indigo-900' : 'text-gray-900'
                        }`
                      }
                      value="60"
                    >
                      {({ selected }) => (
                        <>
                          <span
                            className={`block truncate ${
                              selected ? 'font-medium' : 'font-normal'
                            }`}
                          >
                            1 hour
                          </span>
                          {selected ? (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600">
                              <Check size={20} aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Listbox.Option>
                  </Listbox.Options>
                </Transition>
              </div>
            </Listbox>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="mr-3 px-4 py-2 border border-gray-300 shadow-sm text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {loading ? 'Creating...' : 'Create Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewMeetingModal; 