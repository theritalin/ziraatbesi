import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { GiCow } from 'react-icons/gi';
import { FiGrid, FiUsers, FiBox, FiClipboard, FiLogOut, FiChevronDown } from 'react-icons/fi';

const SidebarLink = ({ to, icon, children }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center px-4 py-3 text-gray-600 transition-transform duration-200 transform hover:bg-green-100 hover:text-green-800 ${
        isActive ? 'bg-green-200 text-green-800' : ''
      }`
    }
  >
    {icon}
    <span className="ml-3">{children}</span>
  </NavLink>
);

const MainLayout = () => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-lg flex flex-col">
        <div className="flex items-center justify-center p-6 border-b">
          <GiCow className="text-4xl text-green-600" />
          <h1 className="ml-3 text-2xl font-bold text-gray-800 tracking-wider">
            Ziraat Besi
          </h1>
        </div>
        <nav className="flex-1 mt-6 space-y-2">
          <SidebarLink to="/dashboard" icon={<FiGrid size={20} />}>Dashboard</SidebarLink>
          <SidebarLink to="/animals" icon={<FiUsers size={20} />}>Hayvanlar</SidebarLink>
          <SidebarLink to="/feeds" icon={<FiBox size={20} />}>Yemler</SidebarLink>
          <SidebarLink to="/rations" icon={<FiClipboard size={20} />}>Rasyonlar</SidebarLink>
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-end p-4 bg-white border-b">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 focus:outline-none"
            >
              <span className="text-gray-700">Hesabım</span>
              <FiChevronDown size={20} className={`transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-xl z-10">
                <button
                  onClick={handleLogout}
                  className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-green-100 hover:text-green-800"
                >
                  <FiLogOut size={16} className="mr-2" />
                  Çıkış Yap
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 p-6 md:p-10 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
