import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useFarmId } from '../hooks/useFarmId';
import { FiPlus, FiTrash2, FiEdit2, FiDatabase, FiRefreshCw, FiPower, FiCheckCircle } from 'react-icons/fi';
import { supabase } from '../supabaseClient';
import 'react-tabulator/lib/styles.css';
import 'react-tabulator/lib/css/tabulator.min.css';
import { ReactTabulator } from 'react-tabulator';
import AddAnimalModal from '../components/Animals/AddAnimalModal';
import EditAnimalModal from '../components/Animals/EditAnimalModal';
import { seedAnimals } from '../utils/seedAnimals';
import Toast from '../components/UI/Toast';
import ExcelImportModal from '../components/Animals/ExcelImportModal';
import PassiveModal from '../components/Animals/PassiveModal';

const AnimalsPage = () => {
  const { farmId, loading: loadingFarmId, fetchFarmId: refetchFarmId } = useFarmId();
  const [animals, setAnimals] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isPassiveModalOpen, setIsPassiveModalOpen] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [toast, setToast] = useState(null);
  const [showPassives, setShowPassives] = useState(false);
  const tableRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const fetchAnimals = useCallback(async () => {
    if (!farmId) return;
    
    try {
      setLoading(true);
      console.log('Fetching animals for farm:', farmId);
      const { data, error } = await supabase
        .from('animals')
        .select('*')
        .eq('farm_id', farmId)
        .order('id', { ascending: false });

      if (error) {
        console.error('Error fetching animals:', error);
        showToast('Veriler yüklenirken hata oluştu', 'error');
      } else {
        console.log('Fetched animals:', data);
        setAnimals(data || []);
      }
    } catch (error) {
      console.error('Error fetching animals:', error);
      showToast('Beklenmeyen bir hata oluştu', 'error');
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  const fetchGroups = useCallback(async () => {
    if (!farmId) return;
    
    try {
      // Get unique group_ids from animals table
      const { data, error } = await supabase
        .from('animals')
        .select('group_id')
        .eq('farm_id', farmId)
        .not('group_id', 'is', null);

      if (error) {
        console.error('Error fetching groups:', error);
      } else {
        // Extract unique group_ids and create group objects
        const uniqueGroupIds = [...new Set(data.map(a => a.group_id))].sort((a, b) => a - b);
        const groupsData = uniqueGroupIds.map(id => ({ id, name: `Grup ${id}` }));
        setGroups(groupsData);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  }, [farmId]);

  useEffect(() => {
    if (farmId) {
      fetchAnimals();
      fetchGroups();
    }
  }, [farmId, fetchAnimals, fetchGroups]);

  useEffect(() => {
    let subscription;

    const setupRealtime = async () => {
      const farmId = await fetchAnimals();
      
      if (farmId) {
        subscription = supabase
          .channel('animals_changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'animals',
              filter: `farm_id=eq.${farmId}`,
            },
            (payload) => {
              console.log('Realtime change received:', payload);
              if (payload.eventType === 'INSERT') {
                setAnimals((prev) => [payload.new, ...prev]);
              } else if (payload.eventType === 'DELETE') {
                setAnimals((prev) => prev.filter((animal) => animal.id !== payload.old.id));
              } else if (payload.eventType === 'UPDATE') {
                setAnimals((prev) => prev.map((animal) => (animal.id === payload.new.id ? payload.new : animal)));
              }
            }
          )
          .subscribe();
      }
    };

    setupRealtime();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [fetchAnimals]);

  const handleSeedData = async () => {
    if (!window.confirm('Bu işlem veritabanına örnek veriler ekleyecektir. Devam etmek istiyor musunuz?')) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: user } = await supabase
        .from('users')
        .select('farm_id')
        .eq('id', session.user.id)
        .single();

      if (user?.farm_id) {
        await seedAnimals(user.farm_id);
        showToast('Örnek veriler başarıyla eklendi!');
      }
    } catch (error) {
      console.error('Error seeding data:', error);
      showToast('Veri eklenirken bir hata oluştu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDebugConnection = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showToast('Oturum açılmamış!', 'error');
        return;
      }
      console.log('User ID:', session.user.id);

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('farm_id')
        .eq('id', session.user.id)
        .single();
      
      if (userError) {
        showToast('Kullanıcı bilgisi alınamadı', 'error');
        return;
      }
      console.log('Farm ID:', user.farm_id);

      const { count, error: countError } = await supabase
        .from('animals')
        .select('*', { count: 'exact', head: true })
        .eq('farm_id', user.farm_id);

      if (countError) {
        showToast('Hayvan sayısı alınamadı', 'error');
      } else {
        alert(`Bağlantı Başarılı!\nFarm ID: ${user.farm_id}\nKayıtlı Hayvan Sayısı: ${count}`);
      }

    } catch (err) {
      showToast('Beklenmeyen hata: ' + err.message, 'error');
    }
  };

  const handleAddAnimal = async (newAnimal) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: user } = await supabase
        .from('users')
        .select('farm_id')
        .eq('id', session.user.id)
        .single();

      if (user?.farm_id) {
        const { error } = await supabase
          .from('animals')
          .insert([{
            farm_id: user.farm_id,
            status: 'active', // Default status
            ...newAnimal
          }]);

        if (error) throw error;
        
        setIsAddModalOpen(false);
        showToast('Hayvan başarıyla eklendi!');
      }
    } catch (error) {
      console.error('Error adding animal:', error);
      showToast('Hayvan eklenirken bir hata oluştu: ' + error.message, 'error');
    }
  };

  const handleUpdateAnimal = useCallback(async (updatedAnimal) => {
    try {
      // Ensure group_id is a number or null, not an empty string
      const newGroupId = updatedAnimal.group_id === '' || updatedAnimal.group_id === null 
        ? null 
        : parseInt(updatedAnimal.group_id, 10);

      if (updatedAnimal.group_id && isNaN(newGroupId)) {
         showToast('Geçersiz Besi Grubu. Lütfen sayı giriniz.', 'error');
         return;
      }

      // Update the animal
      const { error } = await supabase
        .from('animals')
        .update({
          tag_number: updatedAnimal.tag_number,
          current_weight: updatedAnimal.current_weight,
          last_weight_kg: updatedAnimal.last_weight_kg,
          birth_date: updatedAnimal.birth_date,
          purchase_price: updatedAnimal.purchase_price,
          group_id: newGroupId,
        })
        .eq('id', updatedAnimal.id);

      if (error) throw error;
      
      setIsEditModalOpen(false);
      showToast('Değişiklikler kaydedildi!');
    } catch (error) {
      console.error('Error updating animal:', error);
      showToast('Güncelleme başarısız: ' + error.message, 'error');
    }
  }, []);

  const handleDeleteAnimal = useCallback(async (id) => {
    if (window.confirm('Bu hayvanı silmek istediğinizden emin misiniz? Bu işlem hayvanla ilgili tüm kayıtları (tartımlar, veteriner kayıtları) da silecektir.')) {
      try {
        // First delete all related records
        
        // 1. Delete weighings
        await supabase
          .from('weighings')
          .delete()
          .eq('animal_id', id);

        // 2. Delete veterinary records
        await supabase
          .from('veterinary_records')
          .delete()
          .eq('animal_id', id);

        // 3. Finally delete the animal
        const { error } = await supabase
          .from('animals')
          .delete()
          .eq('id', id);

        if (error) throw error;
        showToast('Hayvan ve ilgili tüm kayıtlar silindi!');
        fetchAnimals(); // Refresh the list
      } catch (error) {
        console.error('Error deleting animal:', error);
        showToast('Silme işlemi başarısız oldu: ' + error.message, 'error');
      }
    }
  }, [fetchAnimals]);

  const handlePassiveClick = (animal) => {
    setSelectedAnimal(animal);
    setIsPassiveModalOpen(true);
  };

  const handleConfirmPassive = async (animal, date) => {
    try {
      const { error } = await supabase
        .from('animals')
        .update({
          status: 'passive',
          passive_date: date
        })
        .eq('id', animal.id);

      if (error) throw error;

      showToast('Hayvan pasife alındı!');
      setIsPassiveModalOpen(false);
      fetchAnimals();
    } catch (error) {
      console.error('Error setting animal passive:', error);
      showToast('İşlem başarısız: ' + error.message, 'error');
    }
  };

  const handleActivate = async (animal) => {
    if (!window.confirm('Bu hayvanı tekrar aktif yapmak istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('animals')
        .update({
          status: 'active',
          passive_date: null
        })
        .eq('id', animal.id);

      if (error) throw error;

      showToast('Hayvan tekrar aktif edildi!');
      fetchAnimals();
    } catch (error) {
      console.error('Error activating animal:', error);
      showToast('İşlem başarısız: ' + error.message, 'error');
    }
  };

  const columns = useMemo(() => [
    { 
      title: "Durum", 
      field: "status", 
      formatter: (cell) => {
        const value = cell.getValue();
        if (value === 'passive') {
          return `<span class="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs font-semibold">Pasif</span>`;
        }
        return `<span class="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold">Aktif</span>`;
      },
      hozAlign: "center",
      width: 90
    },
    { 
      title: "Küpe No", 
      field: "tag_number", 
      sorter: "string", 
      headerFilter: "input", 
      widthGrow: 2,
      editor: "input",
      cellEdited: (cell) => handleUpdateAnimal(cell.getRow().getData())
    },
    { 
      title: "Kayıt Tarihi", 
      field: "birth_date", 
      sorter: "string", 
      headerFilter: "input", 
      widthGrow: 1,
      editor: "input",
      cellEdited: (cell) => handleUpdateAnimal(cell.getRow().getData())
    },
    {
      title: "Pasif Tarihi",
      field: "passive_date",
      sorter: "string",
      widthGrow: 1,
      editable: false
    },
    { 
      title: "Alış Fiyatı (TL)", 
      field: "purchase_price", 
      sorter: "number", 
      headerFilter: "number",
      widthGrow: 1,
      editor: "number",
      cellEdited: (cell) => handleUpdateAnimal(cell.getRow().getData())
    },
    { 
      title: "Kayıt Ağırlığı (kg)", 
      field: "current_weight",  
      sorter: "number", 
      headerFilter: "number", 
      widthGrow: 1,
      editor: "number",
      cellEdited: (cell) => handleUpdateAnimal(cell.getRow().getData())
    },
    { 
      title: "Son Tartım (kg)", 
      field: "last_weight_kg", 
      sorter: "number", 
      headerFilter: "number", 
      widthGrow: 1,
      editor: "number",
      cellEdited: (cell) => handleUpdateAnimal(cell.getRow().getData())
    },
    { 
      title: "Besi Grubu", 
      field: "group_id", 
      sorter: "string", 
      headerFilter: "input", 
      widthGrow: 1,
      editor: "input",
      cellEdited: (cell) => handleUpdateAnimal(cell.getRow().getData())
    },
    { 
      title: "Aksiyonlar", 
      formatter: (cell) => {
        const data = cell.getRow().getData();
        const deleteButton = `<button class='bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 ml-1'>Sil</button>`;
        
        if (data.status === 'passive') {
          return `<button class='bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600'>Aktif Et</button>` + deleteButton;
        }
        return `<button class='bg-orange-500 text-white px-2 py-1 rounded text-xs hover:bg-orange-600'>Pasif</button>` + deleteButton;
      }, 
      width: 140, 
      hozAlign: "center", 
      headerSort: false,
      cellClick: (e, cell) => {
        e.stopPropagation();
        const target = e.target;
        const data = cell.getRow().getData();

        if (target.innerHTML === 'Sil') {
           handleDeleteAnimal(data.id);
        } else if (target.innerHTML === 'Pasif') {
           handlePassiveClick(data);
        } else if (target.innerHTML === 'Aktif Et') {
           handleActivate(data);
        }
      }
    }
  ], [handleDeleteAnimal, handleUpdateAnimal]);

  return (
    <div className="h-full flex flex-col">
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Hayvanlar</h1>
          <p className="mt-1 text-sm sm:text-base text-gray-600">Çiftliğinizdeki hayvanların listesi.</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                 <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex-1 sm:flex-none justify-center items-center flex bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors text-sm sm:text-base"
          >
            <FiPlus className="mr-2" />
            Yeni Hayvan
          </button>
          <button 
            onClick={() => setIsExcelModalOpen(true)}
            className="flex-1 sm:flex-none justify-center items-center flex bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-lg font-semibold hover:bg-green-100 transition-colors text-sm sm:text-base"
          >
            <FiDatabase className="mr-2" />
            Excel'den Yükle
          </button>
          <button 
            onClick={fetchAnimals}
            className="flex-1 sm:flex-none justify-center items-center flex bg-gray-100 text-gray-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-200 transition-colors text-sm sm:text-base"
            title="Listeyi Yenile"
          >
            <FiRefreshCw className="mr-2" />
            Yenile
          </button>
          <div className="flex items-center bg-white border border-gray-300 rounded-lg px-3 py-2">
            <input
              type="checkbox"
              id="showPassives"
              checked={showPassives}
              onChange={(e) => setShowPassives(e.target.checked)}
              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
            />
            <label htmlFor="showPassives" className="ml-2 block text-sm text-gray-900 select-none cursor-pointer">
              Pasifleri Göster
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden flex-1 flex flex-col">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        ) : (
            <div className="flex-1 w-full overflow-hidden">
             <ReactTabulator
              onRef={(r) => (tableRef.current = r)}
              data={showPassives ? animals : animals.filter(a => a.status !== 'passive')}
              columns={columns}
              layout={"fitColumns"}
              options={{
                pagination: "local",
                paginationSize: 15,
                movableColumns: true,
                resizableRows: true,
                responsiveLayout: "collapse",
                height: "100%",
                placeholder: "Veri yok"
              }}
              className="h-full w-full"
            />
          </div>
        )}
      </div>

      <AddAnimalModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddAnimal}
        groups={groups}
      />

      <EditAnimalModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onUpdate={handleUpdateAnimal}
        animal={selectedAnimal}
      />

      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onSuccess={(count) => {
          showToast(`${count} hayvan başarıyla eklendi!`);
          fetchAnimals();
        }}
        groups={groups}
      />
      
      <PassiveModal
        isOpen={isPassiveModalOpen}
        onClose={() => setIsPassiveModalOpen(false)}
        onConfirm={handleConfirmPassive}
        animal={selectedAnimal}
      />
    </div>
  );
};

export default AnimalsPage;
