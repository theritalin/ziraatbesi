import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import Input from '../Auth/Input';

const CreateRationModal = ({ isOpen, onClose, onRationCreated, initialData = null, showToast }) => {
  const [rationName, setRationName] = useState('');
  const [availableFeeds, setAvailableFeeds] = useState([]);
  const [selectedFeeds, setSelectedFeeds] = useState([]); // [{ feed_id, name, amount, price_per_kg }]
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState([]); // Changed to array for multi-select
  const [groups, setGroups] = useState([]);
  const [newGroupId, setNewGroupId] = useState(''); // For adding new groups

  useEffect(() => {
    if (isOpen) {
      fetchFeeds();
    }
  }, [isOpen]);

  // Separate effect to enrich initialData content with prices after feeds are loaded
  useEffect(() => {
    if (isOpen && initialData && availableFeeds.length > 0) {
        setRationName(initialData.name);
        // Enrich content with current prices from feeds
        const enrichedContent = (initialData.content || []).map(item => {
            const feed = availableFeeds.find(f => f.id === item.feed_id);
            return {
                ...item,
                price_per_kg: feed ? feed.price_per_kg : 0
            };
        });
        setSelectedFeeds(enrichedContent);
        setStartDate(initialData.start_date || '');
        setEndDate(initialData.end_date || '');
        // Set selected group as array with single value for editing
        setSelectedGroupIds(initialData.group_id ? [initialData.group_id] : []);
    } else if (isOpen && !initialData) {
        resetForm();
    }
  }, [isOpen, initialData, availableFeeds]);

  const resetForm = () => {
    setRationName('');
    setSelectedFeeds([]);
    setStartDate('');
    setEndDate('');
    setSelectedGroupIds([]);
    setNewGroupId('');
  };

  const fetchFeeds = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: user } = await supabase
        .from('users')
        .select('farm_id')
        .eq('id', session.user.id)
        .single();

      if (user?.farm_id) {
        const { data, error } = await supabase
          .from('feeds')
          .select('*')
          .eq('farm_id', user.farm_id);
        
        if (error) throw error;
        setAvailableFeeds(data || []);

        // Fetch groups
        const { data: groupsData, error: groupsError } = await supabase
            .from('animals')
            .select('group_id')
            .eq('farm_id', user.farm_id)
            .not('group_id', 'is', null);
        
        if (!groupsError && groupsData) {
            // Get unique group IDs
            const uniqueGroups = [...new Set(groupsData.map(g => g.group_id))].sort((a, b) => a - b);
            setGroups(uniqueGroups);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleAddFeedToRation = (feedId) => {
    const feed = availableFeeds.find(f => f.id === parseInt(feedId));
    if (!feed) return;

    if (selectedFeeds.some(f => f.feed_id === feed.id)) {
        alert("Bu yem zaten rasyonda mevcut.");
        return;
    }

    setSelectedFeeds([...selectedFeeds, {
      feed_id: feed.id,
      name: feed.name,
      amount: 0,
      price_per_kg: feed.price_per_kg
    }]);
  };

  const handleAmountChange = (feedId, amount) => {
    setSelectedFeeds(selectedFeeds.map(f => 
      f.feed_id === feedId ? { ...f, amount: parseFloat(amount) || 0 } : f
    ));
  };

  const handleRemoveFeed = (feedId) => {
    setSelectedFeeds(selectedFeeds.filter(f => f.feed_id !== feedId));
  };

  const calculateTotalCost = () => {
    return selectedFeeds.reduce((total, feed) => {
      return total + (feed.amount * feed.price_per_kg);
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rationName.trim()) {
        alert("Lütfen rasyon adı giriniz.");
        return;
    }
    if (selectedFeeds.length === 0) {
        alert("Lütfen en az bir yem ekleyiniz.");
        return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: user } = await supabase
        .from('users')
        .select('farm_id')
        .eq('id', session.user.id)
        .single();

      if (user?.farm_id) {
        const rationContent = selectedFeeds.map(f => ({
            feed_id: f.feed_id,
            name: f.name,
            amount: f.amount
        }));

        // If no groups selected, create one ration with null group_id
        const groupsToProcess = selectedGroupIds.length > 0 ? selectedGroupIds : [null];

        console.log('🔍 Groups to process:', groupsToProcess);
        console.log('🔍 Selected group IDs:', selectedGroupIds);

        let error;
        if (initialData?.id) {
            // Update existing ration
            const rationData = {
                farm_id: user.farm_id,
                name: rationName,
                content: rationContent,
                start_date: startDate || null,
                end_date: endDate || null,
                group_id: groupsToProcess[0] // For update, use first group
            };
            
            console.log('📝 Updating ration:', rationData);
            
            const { error: updateError } = await supabase
                .from('rations')
                .update(rationData)
                .eq('id', initialData.id);
            error = updateError;
        } else {
            // Insert new rations - one for each selected group
            const rationsToInsert = groupsToProcess.map(groupId => ({
                farm_id: user.farm_id,
                name: rationName,
                content: rationContent,
                start_date: startDate || null,
                end_date: endDate || null,
                group_id: groupId
            }));

            console.log('📝 Inserting rations:', rationsToInsert);

            const { error: insertError } = await supabase
                .from('rations')
                .insert(rationsToInsert);
            error = insertError;
        }

        if (error) throw error;
        
        if (showToast) {
          showToast(initialData?.id ? 'Rasyon başarıyla güncellendi!' : `${groupsToProcess.length} rasyon başarıyla eklendi!`);
        } else {
          alert(initialData?.id ? 'Rasyon başarıyla güncellendi!' : `${groupsToProcess.length} rasyon başarıyla eklendi!`);
        }
        onRationCreated();
        onClose();
      }
    } catch (error) {
      console.error('Error saving ration:', error);
      if (showToast) {
        showToast('Rasyon kaydedilirken hata: ' + error.message, 'error');
      } else {
        alert('Rasyon kaydedilirken hata: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl m-4">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
                {initialData ? 'Rasyonu Düzenle' : 'Yeni Rasyon Oluştur'}
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                <FiX size={24} />
            </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Input 
              label="Rasyon Adı" 
              placeholder="Örn: Süt Yemi Rasyonu" 
              value={rationName}
              onChange={(e) => setRationName(e.target.value)}
            />
            <div className="flex flex-col">
                <label className="block text-sm font-medium text-gray-700 mb-1">Besi Grubu (Opsiyonel)</label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={newGroupId}
                      onChange={(e) => setNewGroupId(e.target.value)}
                      placeholder="Yeni Grup ID..."
                      className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      min="1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const id = parseInt(newGroupId);
                        if (id && !groups.includes(id)) {
                          setGroups([...groups, id].sort((a, b) => a - b));
                          setNewGroupId('');
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <FiPlus />
                    </button>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-2 max-h-32 overflow-y-auto">
                    {groups.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-2">Henüz grup yok</p>
                    ) : (
                      groups.map(g => (
                        <label key={g} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedGroupIds.includes(g)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedGroupIds([...selectedGroupIds, g]);
                              } else {
                                setSelectedGroupIds(selectedGroupIds.filter(id => id !== g));
                              }
                            }}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-sm">Grup {g}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {selectedGroupIds.length > 0 && (
                    <p className="text-xs text-gray-600">
                      Seçili: {selectedGroupIds.map(id => `Grup ${id}`).join(', ')}
                    </p>
                  )}
                </div>
            </div>
             <Input 
                label="Başlangıç Tarihi (Opsiyonel)"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
            />
             <Input 
                label="Bitiş Tarihi (Opsiyonel)"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Yem Ekle</label>
            <select 
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                onChange={(e) => {
                    if(e.target.value) {
                        handleAddFeedToRation(e.target.value);
                        e.target.value = ""; 
                    }
                }}
            >
                <option value="">Yem seçiniz...</option>
                {availableFeeds.map(feed => (
                    <option key={feed.id} value={feed.id}>
                        {feed.name} (Stok: {feed.current_stock_kg} kg)
                    </option>
                ))}
            </select>
          </div>

          <div className="space-y-4 mb-6 max-h-60 overflow-y-auto">
            {selectedFeeds.map((item) => (
                <div key={item.feed_id} className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex-1">
                        <p className="font-medium text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.price_per_kg} TL/kg</p>
                    </div>
                    <div className="w-32">
                        <Input 
                            type="number" 
                            placeholder="Miktar (kg)"
                            value={item.amount}
                            onChange={(e) => handleAmountChange(item.feed_id, e.target.value)}
                            className="mb-0" 
                        />
                    </div>
                    <div className="w-24 text-right font-medium text-gray-700">
                        {(item.amount * item.price_per_kg).toFixed(2)} TL
                    </div>
                    <button 
                        type="button"
                        onClick={() => handleRemoveFeed(item.feed_id)}
                        className="text-red-500 hover:text-red-700 p-2"
                    >
                        <FiTrash2 />
                    </button>
                </div>
            ))}
            {selectedFeeds.length === 0 && (
                <p className="text-gray-500 text-center italic py-4">Henüz yem eklenmedi.</p>
            )}
          </div>

          <div className="flex justify-between items-center border-t pt-4 mt-4">
            <div>
                <p className="text-sm text-gray-500">Toplam Maliyet (Hayvan Başı)</p>
                <p className="text-2xl font-bold text-green-600">{calculateTotalCost().toFixed(2)} TL</p>
            </div>
            <div className="flex gap-3">
                <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                İptal
                </button>
                <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                {loading ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRationModal;
