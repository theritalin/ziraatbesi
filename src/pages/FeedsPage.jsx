import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useFarmId } from '../hooks/useFarmId';
import { FiPlus, FiDatabase } from 'react-icons/fi';
import { supabase } from '../supabaseClient';
import 'react-tabulator/lib/styles.css';
import 'react-tabulator/lib/css/tabulator.min.css';
import { ReactTabulator } from 'react-tabulator';
import AddFeedModal from '../components/Feeds/AddFeedModal';
import Toast from '../components/UI/Toast';

const FeedsPage = () => {
  const { farmId, permissions, userRole } = useFarmId();
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);
  const [toast, setToast] = useState(null);
  const tableRef = useRef(null);

  const canEdit = userRole === 'admin' || permissions?.feeds === 'edit';

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const fetchFeeds = useCallback(async () => {
    if (!farmId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('feeds')
        .select('*')
        .eq('farm_id', farmId)
        .order('name', { ascending: true });

      if (error) throw error;
      setFeeds(data || []);
    } catch (error) {
      console.error('Error fetching feeds:', error);
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    if (farmId) {
      fetchFeeds();
    }
  }, [farmId, fetchFeeds]);

  useEffect(() => {
    let subscription;

    const setupRealtime = async () => {
      if (farmId) {
        subscription = supabase
          .channel('feeds_changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'feeds',
              filter: `farm_id=eq.${farmId}`,
            },
            (payload) => {
              if (payload.eventType === 'INSERT') {
                setFeeds((prev) => [payload.new, ...prev]);
              } else if (payload.eventType === 'DELETE') {
                setFeeds((prev) => prev.filter((feed) => feed.id !== payload.old.id));
              } else if (payload.eventType === 'UPDATE') {
                setFeeds((prev) => prev.map((feed) => (feed.id === payload.new.id ? payload.new : feed)));
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

  const handleAddFeed = async (newFeed) => {
    if (!canEdit) return;
    try {
      if (farmId) {
        // Check if feed with same name AND price exists
        const { data: existingFeeds } = await supabase
          .from('feeds')
          .select('*')
          .eq('farm_id', farmId)
          .ilike('name', newFeed.name)
          .eq('price_per_kg', newFeed.price_per_kg);

        if (existingFeeds && existingFeeds.length > 0) {
          // Same name and price - ask to add to existing
          if (window.confirm(`"${newFeed.name}" isimli yem zaten mevcut (${newFeed.price_per_kg} TL/kg). Mevcut yeme eklemek istiyor musunuz?`)) {
            const existing = existingFeeds[0];
            const { error } = await supabase
              .from('feeds')
              .update({
                current_stock_kg: existing.current_stock_kg + newFeed.current_stock_kg,
                initial_stock_kg: existing.initial_stock_kg + newFeed.current_stock_kg
              })
              .eq('id', existing.id);

            if (error) throw error;
            showToast(`"${existing.name}" yemine ${newFeed.current_stock_kg} kg eklendi!`);
          } else {
            return; // User cancelled
          }
        } else {
          // Different price or new feed - check if name exists with different price
          const { data: sameNameFeeds } = await supabase
            .from('feeds')
            .select('*')
            .eq('farm_id', farmId)
            .ilike('name', newFeed.name);

          if (sameNameFeeds && sameNameFeeds.length > 0) {
            // Same name but different price - add price suffix
            newFeed.name = `${newFeed.name} - ${newFeed.price_per_kg} TL`;
          }

          // Insert new feed
          const { error } = await supabase
            .from('feeds')
            .insert([{
              farm_id: farmId,
              ...newFeed
            }]);

          if (error) throw error;
          showToast('Yeni yem başarıyla eklendi!');
        }
        setIsAddModalOpen(false);
      }
    } catch (error) {
      console.error('Error adding feed:', error);
      showToast('Yem eklenirken bir hata oluştu: ' + error.message, 'error');
    }
  };

  const handleUpdateFeed = async (updatedFeed) => {
    if (!canEdit) {
      showToast('Düzenleme yetkiniz yok', 'error');
      fetchFeeds(); // Revert changes in UI
      return;
    }
    try {
      const { error } = await supabase
        .from('feeds')
        .update({
          name: updatedFeed.name,
          current_stock_kg: updatedFeed.current_stock_kg,
          initial_stock_kg: updatedFeed.initial_stock_kg,
          price_per_kg: updatedFeed.price_per_kg,
          bag_weight: updatedFeed.bag_weight || 50
        })
        .eq('id', updatedFeed.id);

      if (error) throw error;
      showToast('Yem başarıyla güncellendi!');
    } catch (error) {
      console.error('Error updating feed:', error);
      showToast('Güncelleme sırasında bir hata oluştu: ' + error.message, 'error');
    }
  };

  const handleDeleteFeed = async (id) => {
    if (!canEdit) return;
    console.log('handleDeleteFeed called with id:', id);
    try {
      if (farmId) {
        console.log('Checking rations...');
        const { data: rations } = await supabase
          .from('rations')
          .select('*')
          .eq('farm_id', farmId);

        console.log('Rations found:', rations?.length || 0);

        const affectedRations = [];
        if (rations) {
          for (const ration of rations) {
            if (ration.content && Array.isArray(ration.content)) {
              const usesThisFeed = ration.content.some(item => item.feed_id === id);
              if (usesThisFeed) {
                affectedRations.push(ration.name);
              }
            }
          }
        }

        console.log('Affected rations:', affectedRations);

        if (affectedRations.length > 0) {
          const rationList = affectedRations.join(', ');
          console.log('Feed is in use, showing toast');
          showToast(`Bu yem şu rasyonlarda kullanılıyor: ${rationList}. Önce rasyonları silin!`, 'error');
          return;
        }

        console.log('Showing confirm dialog...');
        if (window.confirm('Bu yemi silmek istediğinizden emin misiniz?')) {
          console.log('User confirmed, deleting...');
          const { error } = await supabase
            .from('feeds')
            .delete()
            .eq('id', id);
          
          if (error) throw error;
          console.log('Delete successful, showing toast');
          showToast('Yem başarıyla silindi!');
          fetchFeeds(); // Refresh the list
        } else {
          console.log('User cancelled');
        }
      } else {
        console.error('No farm_id found');
        showToast('Çiftlik bilgisi bulunamadı', 'error');
      }
    } catch (error) {
      console.error('Error deleting feed:', error);
      showToast('Silme işlemi başarısız: ' + error.message, 'error');
    }
  };

  const handleUpdateStock = async () => {
    if (!canEdit) return;
    if (!window.confirm('Tüm stoklar baştan hesaplanacak. Devam etmek istiyor musunuz?')) return;

    setIsUpdatingStock(true);
    try {
      if (farmId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        console.log('🔄 Recalculating ALL stock from scratch...');

        // Fetch ALL rations
        const { data: rations, error: rationsError } = await supabase
            .from('rations')
            .select('*')
            .eq('farm_id', farmId);

        if (rationsError) throw rationsError;

        if (!rations || rations.length === 0) {
            alert('Rasyon bulunamadı.');
            return;
        }

        let totalConsumptionByFeed = {}; // feed_id -> total consumed from start

        console.log('📊 Processing', rations.length, 'rations...');

        for (const ration of rations) {
            if (!ration.start_date || !ration.group_id || !ration.content) {
                console.log('⏭️  Skipping ration (missing data):', ration.name);
                continue;
            }

            // ALWAYS calculate from start_date (ignore last_stock_update)
            const startDate = new Date(ration.start_date);
            startDate.setHours(0, 0, 0, 0);
            
            // End date is either ration.end_date or today
            const endDate = ration.end_date ? new Date(ration.end_date) : new Date(today);
            endDate.setHours(0, 0, 0, 0);
            
            // Calculate total days (inclusive)
            const diffTime = endDate.getTime() - startDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

            if (diffDays <= 0) {
                console.log('⏭️  Skipping ration (no days):', ration.name);
                continue;
            }

            // Get animal count for this group
            const { count } = await supabase
                .from('animals')
                .select('*', { count: 'exact', head: true })
                .eq('group_id', ration.group_id)
                .eq('farm_id', farmId);

            if (!count || count === 0) {
                console.log('⏭️  Skipping ration (no animals):', ration.name);
                continue;
            }

            console.log(`✅ Ration: ${ration.name}`);
            console.log(`   - Animals: ${count}, Days: ${diffDays}`);

            // Calculate total consumption for each feed
            for (const item of ration.content) {
                if (!item.feed_id || !item.amount) continue;
                const totalConsumption = item.amount * count * diffDays;
                totalConsumptionByFeed[item.feed_id] = (totalConsumptionByFeed[item.feed_id] || 0) + totalConsumption;
                console.log(`   - Feed ${item.feed_id}: ${item.amount} kg/day × ${count} animals × ${diffDays} days = ${totalConsumption.toFixed(2)} kg`);
            }
        }

        console.log('📊 Total consumption by feed:', totalConsumptionByFeed);

        // Now update each feed: current_stock = initial_stock - total_consumption
        for (const [feedId, totalConsumed] of Object.entries(totalConsumptionByFeed)) {
            const { data: feed } = await supabase
                .from('feeds')
                .select('initial_stock_kg')
                .eq('id', feedId)
                .single();

            if (feed) {
                const newStock = Math.max(0, feed.initial_stock_kg - totalConsumed);
                
                await supabase
                    .from('feeds')
                    .update({ current_stock_kg: newStock })
                    .eq('id', feedId);
                
                console.log(`   ✅ Feed ${feedId}: ${feed.initial_stock_kg} - ${totalConsumed.toFixed(2)} = ${newStock.toFixed(2)} kg`);
            }
        }

        showToast('Stoklar baştan hesaplandı ve güncellendi!');
        fetchFeeds(); // Refresh the list
      }
    } catch (error) {
      console.error('Error updating stock:', error);
      showToast('Stok güncellenirken hata: ' + error.message, 'error');
    } finally {
      setIsUpdatingStock(false);
    }
  };


  const columns = useMemo(() => {
    const cols = [
      { 
        title: "Yem Adı", 
        field: "name", 
        sorter: "string", 
        headerFilter: "input", 
        widthGrow: 2,
        editor: canEdit ? "input" : false,
        cellEdited: (cell) => handleUpdateFeed(cell.getRow().getData())
      },
      { 
        title: "Başlangıç Stok (kg)", 
        field: "initial_stock_kg", 
        sorter: "number", 
        widthGrow: 1,
        editor: canEdit ? "number" : false,
        cellEdited: (cell) => handleUpdateFeed(cell.getRow().getData()),
        formatter: (cell) => {
          const val = cell.getValue();
          return val ? val.toLocaleString('tr-TR') : '-';
        }
      },
      { 
        title: "Stok (kg)", 
        field: "current_stock_kg", 
        sorter: "number", 
        headerFilter: "number", 
        widthGrow: 1,
        editor: canEdit ? "number" : false,
        cellEdited: (cell) => handleUpdateFeed(cell.getRow().getData())
      },
      { 
        title: "Birim Fiyat (TL/kg)", 
        field: "price_per_kg", 
        sorter: "number", 
        headerFilter: "number", 
        widthGrow: 1,
        editor: canEdit ? "number" : false,
        cellEdited: (cell) => handleUpdateFeed(cell.getRow().getData())
      },
      { 
        title: "Çuval Ağırlığı (kg)", 
        field: "bag_weight", 
        sorter: "number", 
        widthGrow: 1,
        editor: canEdit ? "number" : false,
        cellEdited: (cell) => handleUpdateFeed(cell.getRow().getData())
      },
      { 
        title: "Kalan Çuval", 
        field: "bags_left", 
        formatter: (cell) => {
          const data = cell.getRow().getData();
          const weight = data.bag_weight || 50;
          return Math.floor(data.current_stock_kg / weight);
        },
        widthGrow: 1,
      },
      { 
        title: "Kalan %", 
        field: "remaining_pct", 
        formatter: (cell) => {
          const data = cell.getRow().getData();
          if (!data.initial_stock_kg || data.initial_stock_kg === 0) return "-";
          const pct = (data.current_stock_kg / data.initial_stock_kg) * 100;
          const color = pct > 50 ? 'green' : pct > 20 ? 'orange' : 'red';
          return `<span style="color: ${color}; font-weight: bold;">${pct.toFixed(0)}%</span>`;
        },
        widthGrow: 1,
      },
      { 
        title: "Toplam Değer (TL)", 
        formatter: (cell) => {
          const data = cell.getRow().getData();
          return (data.current_stock_kg * data.price_per_kg).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
        },
        widthGrow: 1,
      }
    ];

    if (canEdit) {
      cols.push({
        title: "Aksiyonlar",
        width: 80,
        hozAlign: "center",
        headerSort: false,
        formatter: () => {
          return `<button class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 delete-btn">Sil</button>`;
        },
        cellClick: (e, cell) => {
          const target = e.target;
          if (target.classList.contains('delete-btn')) {
            handleDeleteFeed(cell.getRow().getData().id);
          }
        }
      });
    }

    return cols;
  }, [canEdit]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Yem Deposu</h1>
          <p className="mt-1 text-sm sm:text-base text-gray-600">Mevcut yem stoklarınız, birim fiyatları ve çuval bilgileri.</p>
        </div>
        {canEdit && (
          <div className="flex w-full sm:w-auto gap-2">
            <button 
              onClick={handleUpdateStock}
              disabled={isUpdatingStock}
              className="flex-1 sm:flex-none justify-center items-center flex bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm sm:text-base"
            >
              <FiDatabase className="mr-2" />
              {isUpdatingStock ? 'Güncelleniyor...' : 'Stok Güncelle'}
            </button>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex-1 sm:flex-none justify-center items-center flex bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors text-sm sm:text-base"
            >
              <FiPlus className="mr-2" />
              Yeni Yem Ekle
            </button>
          </div>
        )}
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
              data={feeds}
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
        )}
      </div>

      <AddFeedModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddFeed}
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

export default FeedsPage;
