import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useFarmId } from '../hooks/useFarmId';
import { FiPlus, FiDatabase, FiEdit2, FiTrash2, FiX, FiSearch } from 'react-icons/fi';
import { supabase } from '../supabaseClient';
import 'react-tabulator/lib/styles.css';
import 'react-tabulator/lib/css/tabulator.min.css';
import { ReactTabulator } from 'react-tabulator';
import CreateRationModal from '../components/Rations/CreateRationModal';
import { restoreRationStock } from '../utils/consumptionManager';
import Toast from '../components/UI/Toast';

const RationsPage = () => {
  const { farmId } = useFarmId();
  const [rations, setRations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRation, setSelectedRation] = useState(null);
  const tableRef = useRef(null);
  const [animalCounts, setAnimalCounts] = useState({}); // group_id -> count
  const [feeds, setFeeds] = useState({}); // id -> price_per_kg
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRations = useMemo(() => {
     let result = rations;
     if (searchQuery) {
         const query = searchQuery.toLowerCase();
         result = rations.filter(r => 
             (r.name && r.name.toLowerCase().includes(query)) ||
             (r.group_id && r.group_id.toString().includes(query))
         );
     }
     
     // Sort: Ongoing (no end_date) first, then by end_date descending (most recent first)
     return [...result].sort((a, b) => {
         if (!a.end_date && !b.end_date) {
             return new Date(b.start_date || 0) - new Date(a.start_date || 0);
         }
         if (!a.end_date) return -1;
         if (!b.end_date) return 1;
         return new Date(b.end_date) - new Date(a.end_date);
     });
  }, [rations, searchQuery]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const fetchRations = useCallback(async () => {
    if (!farmId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rations')
        .select('*')
        .eq('farm_id', farmId)
        .order('name', { ascending: true });

      if (error) throw error;
      setRations(data || []);
      
      // Fetch animal counts for groups
      const groupIds = [...new Set(data.map(r => r.group_id).filter(Boolean))];
      if (groupIds.length > 0) {
          const counts = {};
          for (const gid of groupIds) {
              const { count } = await supabase
                  .from('animals')
                  .select('*', { count: 'exact', head: true })
                  .eq('group_id', gid);
              counts[gid] = count || 0;
          }
          setAnimalCounts(counts);
      }

      // Fetch feeds for price calculation
      const { data: feedsData } = await supabase
          .from('feeds')
          .select('id, price_per_kg')
          .eq('farm_id', farmId);
      
      if (feedsData) {
          const feedsMap = {};
          feedsData.forEach(f => feedsMap[f.id] = f.price_per_kg);
          setFeeds(feedsMap);
      }
    } catch (error) {
      console.error('Error fetching rations:', error);
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    if (farmId) {
      fetchRations();
    }
  }, [farmId, fetchRations]);

  useEffect(() => {
    let subscription;

    const setupRealtime = async () => {
      if (farmId) {
        subscription = supabase
          .channel('rations_changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'rations',
              filter: `farm_id=eq.${farmId}`,
            },
            (payload) => {
              if (payload.eventType === 'INSERT') {
                setRations((prev) => [payload.new, ...prev]);
              } else if (payload.eventType === 'DELETE') {
                setRations((prev) => prev.filter((r) => r.id !== payload.old.id));
              } else if (payload.eventType === 'UPDATE') {
                setRations((prev) => prev.map((r) => (r.id === payload.new.id ? payload.new : r)));
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
  }, [farmId]);

  const handleEditRation = (ration) => {
    setSelectedRation(ration);
    setIsCreateModalOpen(true);
  };

  const handleDeleteRation = async (ration) => {
    if (window.confirm(`"${ration.name}" rasyonunu silmek istediğinizden emin misiniz?`)) {
        try {
            const { error } = await supabase
                .from('rations')
                .delete()
                .eq('id', ration.id);
            
            if (error) throw error;
            showToast('Rasyon başarıyla silindi!');
            fetchRations(); // Refresh the list
        } catch (error) {
            console.error('Error deleting ration:', error);
            showToast('Silme işlemi başarısız: ' + error.message, 'error');
        }
    }
  };

  const columns = useMemo(() => [
    { 
      title: "Rasyon Adı", 
      field: "name", 
      sorter: "string", 
      headerFilter: "input", 
      widthGrow: 2,
    },
    { 
      title: "İçerik Özeti", 
      field: "content", 
      formatter: (cell) => {
        const content = cell.getValue();
        if (!content || !Array.isArray(content)) return "-";
        return content.map(item => `${item.name} (${item.amount}kg)`).join(", ");
      },
      headerFilter: "input", 
      widthGrow: 3,
    },
    { 
      title: "Hayvan Sayısı", 
      field: "group_id", 
      formatter: (cell) => {
        const gid = cell.getValue();
        return animalCounts[gid] || "-";
      },
      widthGrow: 1,
    },
    {
        title: "Başlangıç",
        field: "start_date",
        sorter: "string",
        widthGrow: 1,
    },
    {
        title: "Bitiş",
        field: "end_date",
        sorter: "string",
        widthGrow: 1,
    },
    {
        title: "Süre (Gün)",
        field: "duration",
        formatter: (cell) => {
            const data = cell.getRow().getData();
            if (!data.start_date) return "-";
            const start = new Date(data.start_date);
            start.setHours(0, 0, 0, 0);
            const end = data.end_date ? new Date(data.end_date) : new Date();
            end.setHours(0, 0, 0, 0);
            const diffTime = end.getTime() - start.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
            return `${diffDays} gün`;
        },
        widthGrow: 1,
    },
    { 
      title: "Maliyet (Hayvan Başı)", 
      field: "content", 
      formatter: (cell) => {
        const content = cell.getValue();
        if (!content) return "-";
        
        // Calculate cost per animal based on content (assuming price is in content or we need to fetch it?)
        // In CreateRationModal we store price_per_kg in content? No, we store feed_id, name, amount.
        // We need to fetch current prices or store them in ration content.
        // Let's check CreateRationModal... it stores: feed_id, name, amount.
        // So we need to join with feeds to get price, OR we should have stored it.
        if (!content || !Array.isArray(content)) return "-";
        
        let totalCost = 0;
        content.forEach(item => {
            const price = feeds[item.feed_id] || 0;
            totalCost += (item.amount * price);
        });

        return totalCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
      },
      widthGrow: 1,
    },
    {
        title: "Aksiyonlar",
        width: 100,
        hozAlign: "center",
        headerSort: false,
        formatter: (cell) => {
             return `<div class="flex gap-2 justify-center">
                <button class="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 edit-btn">Düzenle</button>
                <button class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 delete-btn">Sil</button>
             </div>`;
        },
        cellClick: (e, cell) => {
            const target = e.target;
            const ration = cell.getRow().getData();
            if (target.classList.contains('edit-btn')) {
                handleEditRation(ration);
            } else if (target.classList.contains('delete-btn')) {
                handleDeleteRation(ration);
            }
        }
    }
  ], [animalCounts, feeds]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Rasyon Yönetimi</h1>
          <p className="mt-1 text-sm sm:text-base text-gray-600">Hayvanlarınız için hazırladığınız rasyonlar.</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-auto order-first sm:order-none relative">
            <input 
               type="text" 
               placeholder="Rasyon Adı veya Grup Ara..." 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full sm:w-64 pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                    <FiX size={16} />
                </button>
            )}
          </div>
          <button 
            onClick={() => {
                setSelectedRation(null);
                setIsCreateModalOpen(true);
            }}
            className="flex-1 sm:flex-none justify-center items-center flex bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors text-sm sm:text-base"
          >
            <FiPlus className="mr-2" />
            Yeni Rasyon
          </button>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden flex-1 flex flex-col">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        ) : (
          <div className="flex-1 w-full overflow-hidden flex flex-col">
             
             {/* Mobile Card View */}
             <div className="block lg:hidden flex-1 overflow-y-auto p-2 bg-gray-50 space-y-4">
               {filteredRations.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">Rasyon bulunamadı.</div>
               ) : (
                  filteredRations.map(ration => {
                      const content = ration.content || [];
                      const rationContentStr = content.map(item => `${item.name} (${item.amount}kg)`).join(", ");
                      let totalCost = 0;
                      content.forEach(item => {
                          const price = feeds[item.feed_id] || 0;
                          totalCost += (item.amount * price);
                      });
                      
                      let durationDays = "-";
                      if (ration.start_date) {
                          const start = new Date(ration.start_date);
                          start.setHours(0, 0, 0, 0);
                          const end = ration.end_date ? new Date(ration.end_date) : new Date();
                          end.setHours(0, 0, 0, 0);
                          const diffTime = end.getTime() - start.getTime();
                          durationDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
                      }

                      return (
                         <div key={ration.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 relative">
                             <div className="flex justify-between items-start mb-3">
                                 <h3 className="font-bold text-lg text-gray-800 tracking-tight">{ration.name}</h3>
                                 <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap">
                                     Grup {ration.group_id || '-'} ({animalCounts[ration.group_id] || 0} Baş)
                                 </span>
                             </div>
                             
                             <div className="bg-orange-50 text-orange-800 p-2 rounded-lg text-xs mb-3 border border-orange-100 font-medium">
                                 {rationContentStr || "İçerik Yok"}
                             </div>

                             <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                 <div><span className="text-gray-400 text-[11px] uppercase font-bold tracking-wider block mb-1">Başlangıç</span><span className="font-semibold text-gray-800">{ration.start_date || '-'}</span></div>
                                 <div><span className="text-gray-400 text-[11px] uppercase font-bold tracking-wider block mb-1">Bitiş</span><span className="font-semibold text-gray-800">{ration.end_date || 'Devam Ediyor'}</span></div>
                                 <div><span className="text-gray-400 text-[11px] uppercase font-bold tracking-wider block mb-1">Süre</span><span className="font-semibold text-gray-800">{durationDays} {durationDays !== '-' ? 'gün' : ''}</span></div>
                                 <div><span className="text-gray-400 text-[11px] uppercase font-bold tracking-wider block mb-1">Günlük Maliyet</span><span className="font-semibold text-emerald-700">{totalCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span></div>
                             </div>

                             <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
                                 <button onClick={() => handleEditRation(ration)} className="bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors flex-1 flex justify-center items-center gap-1">
                                     <FiEdit2 size={14} /> Düzenle
                                 </button>
                                 <button onClick={() => handleDeleteRation(ration)} className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors flex justify-center items-center">
                                     <FiTrash2 size={14} />
                                 </button>
                             </div>
                         </div>
                      );
                  })
               )}
             </div>

             {/* Desktop Table View */}
             <div className="hidden lg:block flex-1 w-full h-full">
               <ReactTabulator
                onRef={(r) => (tableRef.current = r)}
                data={filteredRations}
                columns={columns}
                layout={"fitColumns"}
                options={{
                  pagination: "local",
                  paginationSize: 15,
                  movableColumns: true,
                  resizableRows: true,
                  responsiveLayout: "collapse",
                  height: "100%",
                }}
                className="h-full w-full"
              />
            </div>
          </div>
        )}
      </div>

      <CreateRationModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onRationCreated={() => {
            fetchRations(); 
        }}
        initialData={selectedRation}
        showToast={showToast}
      />

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


export default RationsPage;
