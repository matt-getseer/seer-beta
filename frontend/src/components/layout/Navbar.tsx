import { Link, useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { GearSix } from 'phosphor-react';

const Navbar = () => {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: 'Overview' },
    { path: '/team', label: 'Team' },
    { path: '/meetings', label: 'Meetings' },
  ];

  return (
    <nav className="sticky top-0 z-10 bg-[#171717]">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/">
              <img 
                src="/seer_logo_white.svg" 
                alt="Seer Logo" 
                className="h-6"
              />
            </Link>
            <div className="ml-10 flex items-center space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 text-base font-medium rounded-md ${
                    location.pathname === item.path
                      ? 'text-white bg-gray-800'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link
              to="/settings"
              className={`p-2 rounded-md ${
                location.pathname === '/settings'
                  ? 'text-white bg-gray-800'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
              title="Settings"
            >
              <GearSix size={20} weight="fill" />
            </Link>
            <UserButton />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 