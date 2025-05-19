import { useState } from 'react';

interface Meeting {
  id: number;
  title: string;
  date: string;
  time: string;
  attendees: string[];
}

const Meetings = () => {
  const [meetings] = useState<Meeting[]>([
    {
      id: 1,
      title: 'Weekly Team Sync',
      date: '2025-05-20',
      time: '10:00 AM',
      attendees: ['John Doe', 'Jane Smith', 'Alex Johnson']
    },
    {
      id: 2,
      title: 'Product Review',
      date: '2025-05-22',
      time: '2:00 PM',
      attendees: ['Sarah Williams', 'Mike Brown', 'Jane Smith']
    },
    {
      id: 3,
      title: 'Client Presentation',
      date: '2025-05-25',
      time: '11:30 AM',
      attendees: ['John Doe', 'Mike Brown']
    }
  ]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          + New Meeting
        </button>
      </div>
      
      <div className="space-y-4">
        {meetings.map((meeting) => (
          <div key={meeting.id} className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between">
              <div>
                <h2 className="text-lg font-medium text-gray-900">{meeting.title}</h2>
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  <svg className="mr-1.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  {meeting.date} at {meeting.time}
                </div>
              </div>
              <div className="flex space-x-2">
                <button className="px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">Edit</button>
                <button className="px-3 py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100">Cancel</button>
              </div>
            </div>
            
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-500">Attendees</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {meeting.attendees.map((attendee, index) => (
                  <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {attendee}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Meetings; 