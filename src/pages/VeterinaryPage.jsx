import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFarmId } from '../hooks/useFarmId';
import { supabase } from '../supabaseClient';
import Toast from '../components/UI/Toast';
import { FiActivity, FiSave, FiTrash2 } from 'react-icons/fi';
import { ReactTabulator } from 'react-tabulator';
import 'react-tabulator/lib/styles.css';
import 'react-tabulator/css/bootstrap/tabulator_bootstrap.min.css';

const VeterinaryPage = () => {
  const { farmId, permissions, userRole } = useFarmId();
  const [animals, setAnimals] = useState([]);
  const [groups, setGroups] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const canEdit = userRole === 'admin' || permissions?.veterinary === 'edit';

  // Form State
  const [targetType, setTargetType] = useState('animal'); // 'animal' or 'group'
  const [selectedAnimals, setSelectedAnimals] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [procedureName, setProcedureName] = useState('');
  const [processDate, setProcessDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalCost, setTotalCost] = useState('');
  const [notes, setNotes] = useState('');
  const [animalSearch, setAnimalSearch] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const fetchData = useCallback(async () => {
    if (!farmId) return;

    try {
      setLoading(true);
      const [animalsRes, recordsRes] = await Promise.all([
        // Filter out passive animals for selection
        supabase.from('animals')
          .select('*')
          .eq('farm_id', farmId)
          .neq('status', 'passive') 
          .order('tag_number', { ascending: true }),
        supabase.from('veterinary_records')
          .select(`
            *,
            animals (tag_number)
          `)
          .eq('farm_id', farmId)
          .order('process_date', { ascending: false })
      ]);

      const animalsData = animalsRes.data || [];
      setAnimals(animalsData);
      setRecords(recordsRes.data || []);

      // Derive unique groups from animals
      const uniqueGroupIds = [...new Set(animalsData.map(a => a.group_id).filter(id => id !== null && id !== undefined))];
      const derivedGroups = uniqueGroupIds.map(id => ({
        id: id,
        name: `Grup ${id}`
      })).sort((a, b) => a.id - b.id);
      
      setGroups(derivedGroups);
    } catch (error) {
      console.error('Error:', error);
      showToast('Veriler yüklenirken hata oluştu', 'error');
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    if (farmId) {
      fetchData();
    }
  }, [farmId, fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) {
      showToast('Bu işlem için yetkiniz yok', 'error');
      return;
    }
    setLoading(true);

    try {
      if (!farmId) throw new Error('Çiftlik bulunamadı');

      const cost = parseFloat(totalCost) || 0;
      const recordsToInsert = [];
      let targetAnimalIds = [];

      if (targetType === 'animal') {
        if (selectedAnimals.length === 0) {
          showToast('Lütfen en az bir hayvan seçin', 'error');
          setLoading(false);
          return;
        }
        targetAnimalIds = selectedAnimals;
      } else {
        if (selectedGroups.length === 0) {
          showToast('Lütfen en az bir grup seçin', 'error');
          setLoading(false);
          return;
        }
        
        // Find animals in the selected groups
        const groupIds = selectedGroups.map(id => parseInt(id));
        const groupAnimals = animals.filter(a => groupIds.includes(a.group_id));
        targetAnimalIds = groupAnimals.map(a => a.id);
        
        if (targetAnimalIds.length === 0) {
          showToast('Seçilen gruplarda hayvan bulunamadı', 'error');
          setLoading(false);
          return;
        }
      }

      // Remove duplicates just in case
      targetAnimalIds = [...new Set(targetAnimalIds)];

      const costPerAnimal = cost / targetAnimalIds.length;

      targetAnimalIds.forEach(animalId => {
        recordsToInsert.push({
          farm_id: farmId,
          animal_id: animalId,
          procedure_name: procedureName,
          cost: costPerAnimal,
          process_date: processDate,
          notes: notes
        });
      });

      const { error } = await supabase
        .from('veterinary_records')
        .insert(recordsToInsert);

      if (error) throw error;

      showToast(`${targetAnimalIds.length} hayvana işlem kaydedildi`, 'success');
      
      // Reset form
      setProcedureName('');
      setTotalCost('');
      setNotes('');
      setSelectedAnimals([]);
      setSelectedGroups([]);
      
      // Refresh list
      fetchData();

    } catch (error) {
      console.error('Error saving record:', error);
      showToast('Kaydetme başarısız: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!canEdit) return;
    if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('veterinary_records')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast('Kayıt silindi', 'success');
      fetchData();
    } catch (error) {
      console.error('Error deleting:', error);
      showToast('Silme işlemi başarısız', 'error');
    }
  };

  const columns = useMemo(() => {
    const cols = [
      { title: "Tarih", field: "process_date", sorter: "string", width: 120 },
      { title: "İşlem", field: "procedure_name", sorter: "string", headerFilter: "input" },
      { title: "Küpe No", field: "animals.tag_number", sorter: "string", headerFilter: "input" },
      { title: "Maliyet (TL)", field: "cost", sorter: "number", formatter: "money", formatterParams: { symbol: "₺", precision: 2 } },
      { title: "Notlar", field: "notes", sorter: "string" },
      ...(canEdit ? [{ 
        title: "İşlem", 
        field: "actions", 
        formatter: () => `<button class="px-3 py-1 text-sm text-white bg-red-600 hover:bg-red-700 rounded">Sil</button>`,
        cellClick: (e, cell) => handleDelete(cell.getRow().getData().id),
        headerSort: false,
        width: 100,
        hozAlign: "center"
      }] : [])
    ];

    return cols;
  }, [canEdit]);

  if (loading && animals.length === 0) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div></div>;
  }

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
          <FiActivity /> Veteriner İşlemleri
        </h1>
        <p className="mt-1 text-sm sm:text-base text-gray-600">Veteriner müdahalelerini ve masraflarını kaydedin.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">Yeni İşlem Kaydı</h2>
            {canEdit ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Target Selection */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">İşlem Yapılacak Hedef</label>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded border border-gray-200 flex-1">
                      <input
                        type="radio"
                        name="targetType"
                        value="animal"
                        checked={targetType === 'animal'}
                        onChange={() => setTargetType('animal')}
                        className="text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm">Hayvan(lar)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded border border-gray-200 flex-1">
                      <input
                        type="radio"
                        name="targetType"
                        value="group"
                        checked={targetType === 'group'}
                        onChange={() => setTargetType('group')}
                        className="text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm">Grup(lar)</span>
                    </label>
                  </div>

                  {/* Search for Animals */}
                  {targetType === 'animal' && (
                    <div className="mb-2">
                      <input
                        type="text"
                        placeholder="Küpe No Ara..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500"
                        onChange={(e) => setAnimalSearch(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="border border-gray-300 rounded-lg h-48 overflow-y-auto p-2 bg-gray-50">
                    {targetType === 'animal' ? (
                      animals
                        .filter(a => !animalSearch || a.tag_number.toLowerCase().includes(animalSearch.toLowerCase()))
                        .map(animal => (
                          <div 
                            key={animal.id} 
                            onClick={() => {
                              const newSelection = selectedAnimals.includes(animal.id)
                                ? selectedAnimals.filter(id => id !== animal.id)
                                : [...selectedAnimals, animal.id];
                              setSelectedAnimals(newSelection);
                            }}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-green-50 ${selectedAnimals.includes(animal.id) ? 'bg-green-100 border border-green-200' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedAnimals.includes(animal.id)}
                              readOnly
                              className="rounded text-green-600 focus:ring-green-500"
                            />
                            <span className="text-sm text-gray-700">
                              {animal.tag_number} {animal.group_id ? `(Grup ${animal.group_id})` : ''}
                            </span>
                          </div>
                        ))
                    ) : (
                      groups.map(group => (
                        <div 
                          key={group.id} 
                          onClick={() => {
                            const newSelection = selectedGroups.includes(group.id.toString())
                              ? selectedGroups.filter(id => id !== group.id.toString())
                              : [...selectedGroups, group.id.toString()];
                            setSelectedGroups(newSelection);
                          }}
                          className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-green-50 ${selectedGroups.includes(group.id.toString()) ? 'bg-green-100 border border-green-200' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedGroups.includes(group.id.toString())}
                            readOnly
                            className="rounded text-green-600 focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-700">{group.name}</span>
                        </div>
                      ))
                    )}
                    
                    {targetType === 'animal' && animals.length === 0 && (
                      <div className="text-center text-gray-500 text-sm py-4">Kayıtlı hayvan yok.</div>
                    )}
                    {targetType === 'group' && groups.length === 0 && (
                      <div className="text-center text-gray-500 text-sm py-4">Kayıtlı grup yok.</div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {targetType === 'animal' 
                      ? `${selectedAnimals.length} hayvan seçildi.` 
                      : `${selectedGroups.length} grup seçildi.`}
                  </p>
                </div>

                {/* Procedure Details */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">İşlem Adı</label>
                  <input
                    type="text"
                    value={procedureName}
                    onChange={(e) => setProcedureName(e.target.value)}
                    placeholder="Örn: Şap Aşısı"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tarih</label>
                  <input
                    type="date"
                    value={processDate}
                    onChange={(e) => setProcessDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Toplam Maliyet (TL)</label>
                  <input
                    type="number"
                    value={totalCost}
                    onChange={(e) => setTotalCost(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {targetType === 'group' && selectedGroups.length > 0
                      ? `Seçilen gruplardaki toplam ${
                          animals.filter(a => selectedGroups.includes(a.group_id?.toString())).length
                        } hayvana bölünecek.` 
                      : targetType === 'animal' && selectedAnimals.length > 0
                      ? `Maliyet ${selectedAnimals.length} hayvana bölünecek.`
                      : 'Seçilen hayvana kaydedilecek.'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notlar</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                >
                  <FiSave />
                  Kaydet
                </button>
              </form>
            ) : (
              <div className="text-center text-gray-500 py-8">
                Bu alanda işlem yapma yetkiniz bulunmamaktadır.
              </div>
            )}
          </div>
        </div>

        {/* List Section */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow-md rounded-lg p-6 h-full flex flex-col">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">Son İşlemler</h2>
            <div className="flex-1 overflow-auto flex flex-col">
              {records.length > 0 ? (
                <>
                  {/* Mobile View */}
                  <div className="block lg:hidden flex-1 space-y-4 pb-4">
                     {records.map(rec => (
                         <div key={rec.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <div className="flex justify-between items-start mb-2">
                               <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                  <h3 className="font-bold text-gray-800">{rec.procedure_name}</h3>
                               </div>
                               <span className="text-sm text-gray-500">{rec.process_date}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-3 mt-2 text-sm bg-gray-50 p-2 rounded border border-gray-100">
                                <div><span className="text-gray-400 text-[11px] uppercase font-bold tracking-wider block">Küpe No</span><span className="font-semibold">{rec.animals?.tag_number || '-'}</span></div>
                                <div><span className="text-gray-400 text-[11px] uppercase font-bold tracking-wider block">Maliyet</span><span className="font-semibold text-red-600">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(rec.cost)}</span></div>
                            </div>
                            {rec.notes && (
                               <p className="text-sm text-gray-600 mb-3 bg-gray-50 p-2 rounded">{rec.notes}</p>
                            )}
                            {canEdit && (
                                <div className="flex justify-end pt-2 border-t border-gray-100">
                                   <button onClick={() => handleDelete(rec.id)} className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 flex items-center gap-1">
                                      <FiTrash2 size={14} /> Sil
                                   </button>
                                </div>
                            )}
                         </div>
                     ))}
                  </div>

                  {/* Desktop View */}
                  <div className="hidden lg:block flex-1 bg-white overflow-hidden w-full h-full">
                    <ReactTabulator
                      key={canEdit ? 'edit' : 'view'}
                      data={records}
                      columns={columns}
                      layout="fitColumns"
                      options={{
                        pagination: "local",
                        paginationSize: 10,
                        movableColumns: true,
                        placeholder: "Kayıt bulunamadı",
                        height: "100%"
                      }}
                      className="w-full h-full"
                    />
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-500 py-8">Henüz kayıt bulunmamaktadır.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VeterinaryPage;
