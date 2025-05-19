import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { ChartBar, Users, Calendar, Gear, CaretLeft, CaretRight } from 'phosphor-react';

const Sidebar = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  
  const navItems = [
    { path: '/', label: 'Overview', icon: <ChartBar size={20} weight="fill" /> },
    { path: '/team', label: 'Team', icon: <Users size={20} weight="fill" /> },
    { path: '/meetings', label: 'Meetings', icon: <Calendar size={20} weight="fill" /> },
    { path: '/settings', label: 'Settings', icon: <Gear size={20} weight="fill" /> },
  ];

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  return (
    <div 
      className={`h-screen border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out ${
        collapsed ? 'w-[5.5rem]' : 'w-[19rem]'
      }`}
      style={{ backgroundColor: '#f4f4f5' }}
    >
      <div className="p-4 flex justify-between items-center">
        {!collapsed && (
          <img 
            src="/seer_logo_black.svg" 
            alt="Seer Logo" 
            style={{ height: '28px' }} 
          />
        )}
        <button 
          onClick={toggleSidebar} 
          className="p-1 rounded-md text-[#171717] hover:bg-gray-100 hover:text-[#171717] focus:outline-none"
        >
          {collapsed ? <CaretRight size={20} weight="fill" /> : <CaretLeft size={20} weight="fill" />}
        </button>
      </div>
      
      <nav className="flex-1 pt-4">
        <ul>
          {navItems.map((item) => (
            <li key={item.path} className="mb-1">
              <Link
                to={item.path}
                className={`flex items-center px-4 py-2 ${collapsed ? 'justify-center' : ''} text-base font-medium ${
                  location.pathname === item.path
                    ? 'text-[#171717] bg-gray-100'
                    : 'text-[#171717] hover:text-[#171717] hover:bg-gray-50'
                }`}
                title={collapsed ? item.label : ''}
              >
                <span className={collapsed ? '' : 'mr-3'} >{item.icon}</span>
                {!collapsed && item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-4">
      <div className={`flex items-center ${collapsed ? 'justify-center' : ''}`}>
          <UserButton />
          {!collapsed && (
            <div className="ml-3">
              <div className="text-base font-medium text-[#171717]">Matt Stevenson</div>
              <div className="text-xs text-[#171717]">matt@getseer.io</div>
            </div>
          )}
      </div>
      </div>
    </div>
  );
};

export default Sidebar; 