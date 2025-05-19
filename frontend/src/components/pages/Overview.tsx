const Overview = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Overview</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-600">Welcome to your dashboard overview. Here you can see key metrics and recent activity.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <h2 className="text-lg font-medium text-gray-900">Active Projects</h2>
            <p className="text-3xl font-bold text-blue-600 mt-2">12</p>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <h2 className="text-lg font-medium text-gray-900">Team Members</h2>
            <p className="text-3xl font-bold text-green-600 mt-2">8</p>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
            <h2 className="text-lg font-medium text-gray-900">Upcoming Meetings</h2>
            <p className="text-3xl font-bold text-purple-600 mt-2">3</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview; 