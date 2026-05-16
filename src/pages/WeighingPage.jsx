import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useFarmId } from '../hooks/useFarmId';
import { supabase } from '../supabaseClient';
import { FiSave, FiRefreshCw } from 'react-icons/fi';
import Input from '../components/Auth/Input';
import Toast from '../components/UI/Toast';

const WeighingPage = () => {
  const { farmId, permissions, userRole } = useFarmId();
  const [animals, setAnimals] = useState([]);
  const [weighDate, setWeighDate] = useState(new Date().toISOString().split('T')[0]);
  const [weights, setWeights] = useState({});
  const [existingWeighings, setExistingWeighings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState('all'); // 'all' or group_id
  const [groups, setGroups] = useState([]);
  const [showPassives, setShowPassives] = useState(false);

  const canEdit = userRole === 'admin' || permissions?.weighing === 'edit';

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const fetchAnimals = useCallback(async () => {
    if (!farmId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('animals')
        .select('*')
        .eq('farm_id', farmId)
        .order('tag_number', { ascending: true });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Loaded animals:', data?.length || 0);
      setAnimals(data || []);
      
      // Extract unique groups
      const uniqueGroups = [...new Set(data.filter(a => a.group_id).map(a => a.group_id))].sort((a, b) => a - b);
      setGroups(uniqueGroups);
      
      setWeights({}); // Start with empty weights so only new entries are saved
    } catch (error) {
      console.error('Error fetching animals:', error);
      showToast('Hayvanlar yüklenirken hata oluştu: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  const fetchExistingWeighings = useCallback(async () => {
    if (!farmId) return;

    try {
      const { data, error } = await supabase
        .from('weighings')
        .select('*')
        .eq('farm_id', farmId)
        .eq('weigh_date', weighDate);

      if (error) throw error;

      const map = {};
      data.forEach(w => {
        map[w.animal_id] = w;
      });
      setExistingWeighings(map);
    } catch (error) {
      console.error('Error fetching existing weighings:', error);
    }
  }, [farmId, weighDate]);

  useEffect(() => {
    if (farmId) {
      fetchAnimals();
    }
  }, [farmId, fetchAnimals]);

  useEffect(() => {
    if (animals.length > 0 && farmId) {
      fetchExistingWeighings();
    }
  }, [weighDate, animals, farmId, fetchExistingWeighings]);

  const handleWeightChange = (animalId, value) => {
    if (!canEdit) return;
    setWeights(prev => ({
      ...prev,
      [animalId]: value ? parseFloat(value) : ''
    }));
  };

  const handleSave = async () => {
    if (!canEdit) {
      showToast('Bu işlem için yetkiniz yok', 'error');
      return;
    }

    const weighingsToSave = Object.entries(weights).filter(([_, weight]) => weight && weight > 0);
    
    if (weighingsToSave.length === 0) {
      showToast('Lütfen en az bir hayvan için kilo giriniz', 'error');
      return;
    }

    setSaving(true);
    try {
      if (farmId) {
        // Save weighings using upsert to handle updates
        const weighingRecords = weighingsToSave.map(([animalId, weight]) => {
          const record = {
            farm_id: farmId,
            animal_id: parseInt(animalId),
            weight_kg: weight,
            weigh_date: weighDate
          };
          // Only include ID if we're updating an existing record
          if (existingWeighings[animalId]?.id) {
            record.id = existingWeighings[animalId].id;
          }
          return record;
        });

        const { error: weighingError } = await supabase
          .from('weighings')
          .upsert(weighingRecords);

        if (weighingError) throw weighingError;

        // Update animals table with last weight
        for (const [animalId, weight] of weighingsToSave) {
          await supabase
            .from('animals')
            .update({
              last_weight_kg: weight,
              last_weigh_date: weighDate
            })
            .eq('id', parseInt(animalId));
        }

        showToast(`${weighingsToSave.length} hayvan için tartım kaydedildi!`);
        fetchAnimals(); // Refresh data
        fetchExistingWeighings(); // Refresh existing weighings
        setWeights({}); // Clear inputs
      }
    } catch (error) {
      console.error('Error saving weighings:', error);
      showToast('Tartım kaydedilirken hata: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Filter animals by selected group
  const filteredAnimals = useMemo(() => {
    let list = animals;
    
    // 1. Filter Passives
    if (!showPassives) {
      list = list.filter(a => a.status !== 'passive');
    }
    
    // 2. Filter Group
    if (selectedGroup === 'all') return list;
    if (selectedGroup === 'null') return list.filter(a => !a.group_id);
    return list.filter(a => a.group_id === parseInt(selectedGroup));
  }, [animals, selectedGroup, showPassives]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Kilo Tartımı</h1>
        <p className="mt-1 text-sm sm:text-base text-gray-600">Hızlı tartım girişi yapın</p>
      </div>

      <div className="bg-white shadow-md rounded-lg p-4 sm:p-6 mb-6 border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-4 items-end flex-wrap">
          <div className="w-full sm:flex-1 min-w-[200px]">
            <Input
              label="Tartım Tarihi"
              type="date"
              value={weighDate}
              onChange={(e) => setWeighDate(e.target.value)}
              disabled={!canEdit}
            />
          </div>
         <div className="w-full sm:flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Grup Filtresi</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            >
              <option value="all">Tüm Gruplar ({animals.length})</option>
              {groups.map(g => {
                const count = animals.filter(a => a.group_id === g).length;
                return <option key={g} value={g}>Grup {g} ({count})</option>;
              })}
              {animals.filter(a => !a.group_id).length > 0 && (
                <option value="null">Grupsuz ({animals.filter(a => !a.group_id).length})</option>
              )}
            </select>
          </div>
          
          <div className="w-full sm:w-auto flex items-center justify-center bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 sm:mb-0.5" style={{height: '42px'}}>
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

          {canEdit && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto justify-center bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <FiSave />
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          )}
          <button
            onClick={fetchAnimals}
            className="w-full sm:w-auto justify-center bg-gray-500 text-white px-4 py-3 rounded-lg hover:bg-gray-600 flex items-center gap-2"
          >
            <FiRefreshCw /> Yenile
          </button>
        </div>
        {!canEdit && (
          <div className="mt-2 text-amber-600 text-sm">
            * Bu ekranda sadece görüntüleme yetkiniz bulunmaktadır.
          </div>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="block md:hidden space-y-4 mb-6">
        {filteredAnimals.map((animal) => {
          const existing = existingWeighings[animal.id];
          return (
            <div key={animal.id} className={`bg-white rounded-xl shadow-sm border p-4 ${existing ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
               <div className="flex justify-between items-center mb-3 border-b border-gray-100 pb-2">
                   <h3 className="font-bold text-lg text-gray-800">{animal.tag_number}</h3>
                   <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-md text-xs font-bold">
                       Grup {animal.group_id || '-'}
                   </span>
               </div>
               
               <div className="flex justify-between text-sm text-gray-600 mb-4">
                   <div className="flex flex-col">
                      <span className="text-gray-400 text-[11px] uppercase font-bold tracking-wider mb-1">Son Tartım Tarihi</span>
                      <span className="font-semibold text-gray-800">{existing ? new Date(existing.weigh_date).toLocaleDateString('tr-TR') : (animal.last_weigh_date ? new Date(animal.last_weigh_date).toLocaleDateString('tr-TR') : '-')}</span>
                   </div>
                   <div className="flex flex-col text-right">
                      <span className="text-gray-400 text-[11px] uppercase font-bold tracking-wider mb-1">Son Kilo</span>
                      <span className="font-semibold text-gray-800">{animal.last_weight_kg ? `${animal.last_weight_kg} kg` : '-'}</span>
                   </div>
               </div>

               <div className="mt-2">
                   <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider">Yeni Kilo Girişi (kg)</label>
                   <input
                     type="number"
                     step="0.1"
                     placeholder={existing ? existing.weight_kg : "Kilo giriniz"}
                     value={weights[animal.id] !== undefined ? weights[animal.id] : (existing ? existing.weight_kg : '')}
                     onChange={(e) => handleWeightChange(animal.id, e.target.value)}
                     disabled={!canEdit}
                     className={`w-full px-4 py-3 border border-gray-300 rounded-lg text-lg font-bold focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${!canEdit ? 'bg-gray-100 text-gray-500' : 'text-green-800 bg-white shadow-inner'}`}
                   />
               </div>
            </div>
          );
        })}
        {filteredAnimals.length === 0 && (
           <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200">Kayıt bulunamadı.</div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white shadow-md rounded-lg overflow-hidden flex-1 border border-gray-200">
        <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 shadow-sm z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Küpe No</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Grup</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Son Tartım Tarihi</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Son Kilo (kg)</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-48">Yeni Kilo (kg)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAnimals.length === 0 && (
                <tr>
                   <td colSpan="5" className="px-6 py-8 text-center text-gray-500">Kayıt bulunamadı.</td>
                </tr>
              )}
              {filteredAnimals.map((animal) => {
                const existing = existingWeighings[animal.id];
                return (
                  <tr key={animal.id} className={`hover:bg-gray-50 transition-colors ${existing ? 'bg-green-50/50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-800">{animal.tag_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-medium">{animal.group_id || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {existing ? new Date(existing.weigh_date).toLocaleDateString('tr-TR') : (animal.last_weigh_date ? new Date(animal.last_weigh_date).toLocaleDateString('tr-TR') : '-')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-semibold">
                      {animal.last_weight_kg || '-'}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <input
                        type="number"
                        step="0.1"
                        placeholder={existing ? existing.weight_kg : "Kilo giriniz"}
                        value={weights[animal.id] !== undefined ? weights[animal.id] : (existing ? existing.weight_kg : '')}
                        onChange={(e) => handleWeightChange(animal.id, e.target.value)}
                        disabled={!canEdit}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent font-semibold ${!canEdit ? 'bg-gray-100' : 'text-green-800 shadow-inner'}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

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

export default WeighingPage;
