
import React, { useState, Suspense } from 'react';
import { supabase } from '../supabaseClient';
import { useFarmId } from '../hooks/useFarmId';
import { FiHome, FiUsers, FiBox, FiPieChart, FiLogOut, FiMenu, FiX, FiTrendingUp, FiBarChart2, FiActivity, FiDollarSign, FiChevronDown, FiCheckSquare } from 'react-icons/fi';

// Lazy load components
const OverviewPage = React.lazy(() => import('./OverviewPage'));
const AnimalsPage = React.lazy(() => import('./AnimalsPage'));
const FeedsPage = React.lazy(() => import('./FeedsPage'));
const RationsPage = React.lazy(() => import('./RationsPage'));
const WeighingPage = React.lazy(() => import('./WeighingPage'));
const ReportsPage = React.lazy(() => import('./ReportsPage'));
const VeterinaryPage = React.lazy(() => import('./VeterinaryPage'));
const TeamPage = React.lazy(() => import('./TeamPage'));
const ExpensesPage = React.lazy(() => import('./ExpensesPage'));
const TodoPage = React.lazy(() => import('./TodoPage'));

const DashboardPage = ({ session }) => {
  const { farmId, availableFarms } = useFarmId();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [userRole, setUserRole] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  React.useEffect(() => {
    const fetchPermissions = async () => {
      if (!farmId) return;
      
      try {
        setLoadingPermissions(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Check if user is legacy admin (owner) of this farm
        const { data: user } = await supabase
          .from('users')
          .select('farm_id, role')
          .eq('id', session.user.id)
          .single();

        const isLegacyAdmin = user?.role === 'admin' && user?.farm_id === farmId;

        if (isLegacyAdmin) {
             setUserRole('admin');
             setPermissions({ all: 'edit' });
        } else {
             // Check farm_users for permissions
             const { data: farmUser } = await supabase
               .from('farm_users')
               .select('role, permissions')
               .eq('farm_id', farmId)
               .eq('user_id', session.user.id)
               .single();
 
             if (farmUser) {
               setUserRole(farmUser.role);
               setPermissions(farmUser.permissions || {});
             } else {
                 // Should not happen if farmId is valid and RLS is correct, but handle gracefully
                 setUserRole('user');
                 setPermissions({});
             }
        }
      } catch (error) {
        console.error('Error fetching permissions:', error);
      } finally {
        setLoadingPermissions(false);
      }
    };

    fetchPermissions();
  }, [farmId]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleFarmChange = (e) => {
      const newFarmId = e.target.value;
      localStorage.setItem('selected_farm_id', newFarmId);
      window.location.reload();
  };

  const menuItems = [
    { id: 'overview', name: 'Genel Bakış', icon: FiHome, requiredPerm: 'dashboard' },
    { id: 'todos', name: 'Yapılacaklar', icon: FiCheckSquare, requiredPerm: 'dashboard' },
    { id: 'animals', name: 'Hayvanlar', icon: FiUsers, requiredPerm: 'animals' },
    { id: 'feeds', name: 'Yem Deposu', icon: FiBox, requiredPerm: 'feeds' },
    { id: 'rations', name: 'Rasyonlar', icon: FiPieChart, requiredPerm: 'rations' },
    { id: 'weighing', name: 'Tartım', icon: FiTrendingUp, requiredPerm: 'weighing' },
    { id: 'veterinary', name: 'Veteriner', icon: FiActivity, requiredPerm: 'veterinary' },
    { id: 'expenses', name: 'Giderler', icon: FiDollarSign, requiredPerm: 'expenses' },
    { id: 'reports', name: 'Raporlar', icon: FiBarChart2, requiredPerm: 'reports' },
  ];

  // Filter menu items
  const filteredMenuItems = menuItems.filter(item => {
    if (userRole === 'admin') return true;
    if (permissions.all === 'edit' || permissions.all === 'view') return true;
    const perm = permissions[item.requiredPerm];
    return perm === 'view' || perm === 'edit';
  });

  if (userRole === 'admin') {
    filteredMenuItems.push({ id: 'team', name: 'Yetkilendirme', icon: FiUsers, requiredPerm: 'admin' });
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return <OverviewPage />;
      case 'todos': return <TodoPage />;
      case 'animals': return <AnimalsPage />;
      case 'feeds': return <FeedsPage />;
      case 'rations': return <RationsPage />;
      case 'weighing': return <WeighingPage />;
      case 'reports': return <ReportsPage />;
      case 'veterinary': return <VeterinaryPage />;
      case 'expenses': return <ExpensesPage />;
      case 'team': return <TeamPage />;
      default: return <div>Sayfa bulunamadı</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-2xl font-bold text-green-600 flex items-center">
              <FiBox className="mr-2" />
              Ziraat Besi 1.2
            </h2>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {loadingPermissions ? (
              <div className="flex justify-center items-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              </div>
            ) : (
              filteredMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors ${
                    activeTab === item.id 
                      ? 'bg-green-50 text-green-700 font-medium' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <item.icon className={`mr-3 text-xl ${activeTab === item.id ? 'text-green-600' : 'text-gray-400'}`} />
                  {item.name}
                </button>
              ))
            )}
          </nav>

          <div className="p-4 border-t border-gray-100">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <FiLogOut className="mr-3 text-xl" />
              Çıkış Yap
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm z-10">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              <FiMenu className="text-2xl" />
            </button>
            
            <div className="flex items-center space-x-4 ml-auto">
              {/* Farm Switcher */}
              {availableFarms.length > 1 && (
                  <div className="relative">
                      <select
                          value={farmId || ''}
                          onChange={handleFarmChange}
                          className="appearance-none bg-white border border-gray-300 text-gray-700 py-2 px-4 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-green-500 text-sm font-medium"
                      >
                          {availableFarms.map(farm => (
                              <option key={farm.id} value={farm.id}>
                                  {farm.name}
                              </option>
                          ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                          <FiChevronDown className="h-4 w-4" />
                      </div>
                  </div>
              )}
              {availableFarms.length === 1 && (
                  <div className="text-sm font-medium text-gray-700 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                      {availableFarms[0].name}
                  </div>
              )}

              <div className="text-sm text-right hidden sm:block">
                <p className="font-medium text-gray-900">Hoşgeldiniz</p>
                <p className="text-gray-500">
                  {userRole === 'admin' ? 'Çiftlik Yöneticisi' : 'Kullanıcı'}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold border-2 border-green-200">
                {userRole === 'admin' ? 'CY' : 'KU'}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-0 sm:p-6 lg:p-8">
          <Suspense fallback={
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
          }>
            {renderContent()}
          </Suspense>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;