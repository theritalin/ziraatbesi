import React, { useState, useEffect, useMemo } from 'react';
import { FiPlus, FiTrash2, FiEdit2, FiShield } from 'react-icons/fi';
import { supabase } from '../supabaseClient';
import 'react-tabulator/lib/styles.css';
import 'react-tabulator/lib/css/tabulator.min.css';
import { ReactTabulator } from 'react-tabulator';
import Toast from '../components/UI/Toast';

const MODULES = [
  { id: 'dashboard', name: 'Panel' },
  { id: 'animals', name: 'Hayvanlar' },
  { id: 'rations', name: 'Rasyon' },
  { id: 'reports', name: 'Raporlar' },
  { id: 'veterinary', name: 'Veteriner' },
  { id: 'feeds', name: 'Yem Deposu' },
  { id: 'weighing', name: 'Tartım' },
  { id: 'expenses', name: 'Giderler' },
];

const TeamPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [toast, setToast] = useState(null);
  
  // Form State
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [permissions, setPermissions] = useState({});

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const fetchUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: currentUser } = await supabase
        .from('users')
        .select('farm_id')
        .eq('id', session.user.id)
        .single();

      if (currentUser?.farm_id) {
        // First check if I am admin
        // Ideally we should check farm_users table, but for now let's assume if I can fetch, I am allowed.
        // The RLS policies will enforce security.
        
        const { data, error } = await supabase
          .from('farm_users')
          .select('*')
          .eq('farm_id', currentUser.farm_id);

        if (error) throw error;
        setUsers(data || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      // showToast('Kullanıcılar yüklenirken hata oluştu', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSaveUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: currentUser } = await supabase
        .from('users')
        .select('farm_id')
        .eq('id', session.user.id)
        .single();

      if (!currentUser?.farm_id) return;

      const userData = {
        farm_id: currentUser.farm_id,
        email,
        role,
        permissions
      };

      let error;
      if (selectedUser) {
        // Update
        const { error: updateError } = await supabase
          .from('farm_users')
          .update(userData)
          .eq('id', selectedUser.id);
        error = updateError;
      } else {
        // Insert
        // Check if user already exists in auth.users to link user_id? 
        // For now, we just insert email. The user will be linked when they login/register.
        const { error: insertError } = await supabase
          .from('farm_users')
          .insert([userData]);
        error = insertError;
      }

      if (error) throw error;

      showToast(selectedUser ? 'Kullanıcı güncellendi!' : 'Kullanıcı davet edildi!');
      setIsModalOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      showToast('İşlem başarısız: ' + error.message, 'error');
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('farm_users')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast('Kullanıcı silindi!');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      showToast('Silme işlemi başarısız', 'error');
    }
  };

  const openModal = (user = null) => {
    setSelectedUser(user);
    if (user) {
      setEmail(user.email);
      setRole(user.role);
      setPermissions(user.permissions || {});
    } else {
      setEmail('');
      setRole('user');
      setPermissions(MODULES.reduce((acc, m) => ({ ...acc, [m.id]: 'view' }), {}));
    }
    setIsModalOpen(true);
  };

  const columns = useMemo(() => [
    { title: "E-posta", field: "email", sorter: "string" },
    { title: "Rol", field: "role", sorter: "string", formatter: (cell) => cell.getValue() === 'admin' ? 'Yönetici' : 'Kullanıcı' },
    { 
      title: "Yetkiler", 
      field: "permissions", 
      formatter: (cell) => {
        const perms = cell.getValue();
        if (!perms) return '-';
        // Show count of edit permissions
        const editCount = Object.values(perms).filter(p => p === 'edit').length;
        return `${editCount} Düzenleme Yetkisi`;
      }
    },
    {
      title: "Aksiyonlar",
      width: 100,
      hozAlign: "center",
      headerSort: false,
      formatter: () => {
        return `<div class="flex gap-2 justify-center">
           <button class="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 edit-btn">Düzenle</button>
           <button class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 delete-btn">Sil</button>
        </div>`;
      },
      cellClick: (e, cell) => {
        const target = e.target;
        const user = cell.getRow().getData();
        if (target.classList.contains('edit-btn')) {
          openModal(user);
        } else if (target.classList.contains('delete-btn')) {
          handleDeleteUser(user.id);
        }
      }
    }
  ], []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Yetkilendirme</h1>
          <p className="mt-1 text-sm sm:text-base text-gray-600">Çiftlik kullanıcılarını ve yetkilerini yönetin.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex justify-center items-center bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors"
        >
          <FiPlus className="mr-2" />
          Yeni Kullanıcı
        </button>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden flex-1 flex flex-col p-4">
        <ReactTabulator
          data={users}
          columns={columns}
          layout="fitColumns"
          options={{
            pagination: "local",
            paginationSize: 15,
            placeholder: "Kullanıcı bulunamadı",
            height: "100%"
          }}
        />
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{selectedUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı Ekle'}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">E-posta</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 border p-2"
                  disabled={!!selectedUser} // Cannot change email on edit
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Rol</label>
                <select 
                  value={role} 
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 border p-2"
                >
                  <option value="user">Kullanıcı</option>
                  <option value="admin">Yönetici (Tam Yetki)</option>
                </select>
              </div>

              {role === 'user' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Modül Yetkileri</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {MODULES.map(module => (
                      <div key={module.id} className="border p-3 rounded-lg">
                        <div className="font-medium mb-2">{module.name}</div>
                        <div className="flex gap-4">
                          <label className="flex items-center">
                            <input 
                              type="radio" 
                              name={`perm-${module.id}`}
                              checked={permissions[module.id] === 'view'}
                              onChange={() => setPermissions(prev => ({ ...prev, [module.id]: 'view' }))}
                              className="mr-2"
                            />
                            <span className="text-sm">Görüntüle</span>
                          </label>
                          <label className="flex items-center">
                            <input 
                              type="radio" 
                              name={`perm-${module.id}`}
                              checked={permissions[module.id] === 'edit'}
                              onChange={() => setPermissions(prev => ({ ...prev, [module.id]: 'edit' }))}
                              className="mr-2"
                            />
                            <span className="text-sm">Düzenle</span>
                          </label>
                          <label className="flex items-center">
                            <input 
                              type="radio" 
                              name={`perm-${module.id}`}
                              checked={permissions[module.id] === 'none'}
                              onChange={() => setPermissions(prev => ({ ...prev, [module.id]: 'none' }))}
                              className="mr-2"
                            />
                            <span className="text-sm text-red-500">Yok</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <button 
                onClick={handleSaveUser}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
};

export default TeamPage;
