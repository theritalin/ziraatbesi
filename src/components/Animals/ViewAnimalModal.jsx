import React, { useState, useEffect } from 'react';
import { FiX, FiInfo, FiClock, FiActivity, FiTag, FiEdit2, FiSave, FiCornerUpLeft } from 'react-icons/fi';

const ViewAnimalModal = ({ isOpen, onClose, animal, onUpdate, allAnimals = [], feeds = [], rations = [], generalExpenses = [], veterinaryRecords = [] }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (animal) {
      setFormData({
        tag_number: animal.tag_number || '',
        birth_date: animal.birth_date || '',
        group_id: animal.group_id || '',
        purchase_price: animal.purchase_price || '',
        current_weight: animal.current_weight || '',
        last_weight_kg: animal.last_weight_kg || '',
      });
      setIsEditing(false);
    }
  }, [animal, isOpen]);


  const calculateRationCost = (ration) => {
    if (!ration) return 0;
    let dailyCost = 0;
    const items = ration.content || [];
    if (Array.isArray(items)) {
      items.forEach(item => {
        const feed = feeds.find(f => f.id == item.feed_id);
        if (feed) {
          dailyCost += (parseFloat(item.amount) || 0) * (parseFloat(feed.price_per_kg) || 0);
        }
      });
    }
    return dailyCost;
  };

  const totalCost = React.useMemo(() => {
     if (!animal || !allAnimals.length) return 0;
     
     // 1. Initial purchase price
     let total = parseFloat(animal.purchase_price) || 0;

     // 2. Veterinary Costs
     const vetCosts = veterinaryRecords
        .filter(v => v.animal_id === animal.id)
        .reduce((sum, v) => sum + (parseFloat(v.cost) || 0), 0);
     total += vetCosts;

     // 3. Daily costs (Feed + General Expenses)
     const animalStartDate = new Date(animal.birth_date || animal.created_at || '2000-01-01');
     animalStartDate.setHours(0,0,0,0);
     const animalEndDate = animal.passive_date ? new Date(animal.passive_date) : new Date();
     animalEndDate.setHours(0,0,0,0);

     const groupHistory = animal.group_history || [];
     const timeDiff = animalEndDate - animalStartDate;
     const daysActive = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1; // +1 to include both ends

     if (daysActive > 0) {
         for (let d = 0; d < daysActive; d++) {
             const currentDate = new Date(animalStartDate);
             currentDate.setDate(currentDate.getDate() + d);
             currentDate.setHours(0,0,0,0);

             // Find group on this day
             let currentGroupId = animal.group_id;
             if (groupHistory.length > 0) {
                 const sortedHistory = [...groupHistory].sort((a,b) => new Date(a.date) - new Date(b.date));
                 const applicableHistory = sortedHistory.filter(h => {
                     const hDate = new Date(h.date);
                     hDate.setHours(0,0,0,0);
                     return hDate <= currentDate;
                 });
                 if (applicableHistory.length > 0) {
                     currentGroupId = applicableHistory[applicableHistory.length - 1].group_id;
                 } else {
                     currentGroupId = sortedHistory[0].group_id;
                 }
             }

             // Find active ration for this group on this day
             const activeRation = rations.find(r => {
                 if (r.group_id != currentGroupId) return false;
                 const rStart = new Date(r.start_date || r.created_at || '2000-01-01');
                 rStart.setHours(0,0,0,0);
                 if (rStart > currentDate) return false;
                 if (!r.end_date) return true;
                 const rEnd = new Date(r.end_date);
                 rEnd.setHours(0,0,0,0);
                 return rEnd >= currentDate;
             });

             total += calculateRationCost(activeRation);

             // General expenses on this day
             const expensesOnDay = generalExpenses.filter(e => {
                 const eDate = new Date(e.expense_date);
                 eDate.setHours(0,0,0,0);
                 return eDate.getTime() === currentDate.getTime();
             });
             
             if (expensesOnDay.length > 0) {
                 const sumExpenses = expensesOnDay.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
                 const activeAnimalsCount = allAnimals.filter(a => {
                     const aStart = new Date(a.birth_date || a.created_at || '2000-01-01');
                     aStart.setHours(0,0,0,0);
                     if (aStart > currentDate) return false;
                     if (!a.passive_date) return true;
                     const aEnd = new Date(a.passive_date);
                     aEnd.setHours(0,0,0,0);
                     return aEnd >= currentDate;
                 }).length;

                 if (activeAnimalsCount > 0) {
                     total += (sumExpenses / activeAnimalsCount);
                 }
             }
         }
     }

     return total;
  }, [animal, allAnimals, feeds, rations, generalExpenses, veterinaryRecords]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    onUpdate({
        ...animal,
        tag_number: formData.tag_number,
        birth_date: formData.birth_date,
        group_id: formData.group_id,
        purchase_price: formData.purchase_price,
        current_weight: formData.current_weight,
        last_weight_kg: formData.last_weight_kg
    });
    setIsEditing(false);
  };

  if (!isOpen || !animal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center">
            <div className="bg-blue-100 p-2 rounded-lg mr-3">
              <FiInfo className="text-blue-600 text-xl" />
            </div>
            <div>
               <h2 className="text-xl font-bold text-gray-800">Hayvan Detayı</h2>
               <p className="text-sm text-gray-500">Küpe No: {animal.tag_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-200 rounded-full">
            <FiX size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Info Cards */}
              <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 flex items-center justify-between">
                     <span className="flex items-center gap-2"><FiTag className="text-gray-500"/> Temel Bilgiler</span>
                     {!isEditing && animal.status !== 'passive' && (
                         <button onClick={() => setIsEditing(true)} className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 font-medium bg-blue-50 px-2 py-1 rounded">
                             <FiEdit2 /> Düzenle
                         </button>
                     )}
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                      <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-sm">Durum:</span>
                          <span className={`font-semibold text-sm ${animal.status === 'passive' ? 'text-gray-600' : 'text-green-600'}`}>
                             {animal.status === 'passive' ? 'Pasif' : 'Aktif'}
                          </span>
                      </div>
                      
                      {isEditing ? (
                          <>
                             <div className="flex flex-col gap-1">
                                <label className="text-gray-500 text-xs">Küpe No:</label>
                                <input type="text" name="tag_number" value={formData.tag_number} onChange={handleInputChange} className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500" />
                             </div>
                             <div className="flex flex-col gap-1">
                                <label className="text-gray-500 text-xs">Kayıt Tarihi:</label>
                                <input type="date" name="birth_date" value={formData.birth_date} onChange={handleInputChange} className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500" />
                             </div>
                             <div className="flex flex-col gap-1">
                                <label className="text-gray-500 text-xs">Güncel Grup:</label>
                                <input type="number" name="group_id" value={formData.group_id} onChange={handleInputChange} className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500" />
                             </div>
                          </>
                      ) : (
                          <>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 text-sm">Küpe No:</span>
                                <span className="font-semibold text-sm text-gray-800">{animal.tag_number || '-'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 text-sm">Kayıt Tarihi:</span>
                                <span className="font-semibold text-sm text-gray-800">{animal.birth_date || '-'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 text-sm">Pasif Tarihi:</span>
                                <span className="font-semibold text-sm text-gray-800">{animal.passive_date || '-'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 text-sm">Güncel Grup:</span>
                                <span className="font-semibold text-sm text-gray-800">Grup {animal.group_id || 'Yok'}</span>
                            </div>
                          </>
                      )}
                  </div>
              </div>

              <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 flex items-center gap-2">
                     <FiActivity className="text-gray-500"/> Tartım & Finans
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                      {isEditing ? (
                          <>
                             <div className="flex flex-col gap-1">
                                <label className="text-gray-500 text-xs">Alış Fiyatı (TL):</label>
                                <input type="number" name="purchase_price" value={formData.purchase_price} onChange={handleInputChange} className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500" />
                             </div>
                             <div className="flex flex-col gap-1">
                                <label className="text-gray-500 text-xs">Kayıt Ağırlığı (kg):</label>
                                <input type="number" name="current_weight" value={formData.current_weight} onChange={handleInputChange} className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500" />
                             </div>
                             <div className="flex flex-col gap-1">
                                <label className="text-gray-500 text-xs">Son Tartım (kg):</label>
                                <input type="number" name="last_weight_kg" value={formData.last_weight_kg} onChange={handleInputChange} className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500" />
                             </div>
                          </>
                      ) : (
                          <>
                             <div className="flex justify-between items-center">
                                  <span className="text-gray-500 text-sm">Alış Fiyatı:</span>
                                  <span className="font-semibold text-sm text-gray-800">
                                      {animal.purchase_price ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(animal.purchase_price) : '-'}
                                  </span>
                              </div>
                              <div className="flex justify-between items-center bg-green-50 p-2 rounded-lg border border-green-100 mb-1">
                                  <span className="text-green-800 text-sm font-semibold">Güncel Toplam Maliyet:</span>
                                  <span className="font-bold text-sm text-green-700">
                                      {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalCost)}
                                  </span>
                              </div>
                              <div className="flex justify-between items-center">
                                  <span className="text-gray-500 text-sm">Kayıt Ağırlığı:</span>
                                  <span className="font-semibold text-sm text-gray-800">{animal.current_weight ? `${animal.current_weight} kg` : '-'}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                  <span className="text-gray-500 text-sm">Son Tartım:</span>
                                  <span className="font-semibold text-sm text-gray-800">{animal.last_weight_kg ? `${animal.last_weight_kg} kg` : '-'}</span>
                              </div>
                          </>
                      )}
                  </div>
              </div>
           </div>

           {/* Group History */}
           {!isEditing && (
               <div>
                   <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
                       <FiClock className="text-gray-500"/> Grup Geçmişi
                   </h3>
                   {animal.group_history && animal.group_history.length > 0 ? (
                       <div className="relative border-l-2 border-blue-200 ml-3 space-y-6 pb-4">
                           {[...animal.group_history].sort((a,b) => new Date(b.date) - new Date(a.date)).map((historyItem, idx) => (
                               <div key={idx} className="relative pl-6">
                                   <div className="absolute w-4 h-4 bg-blue-500 rounded-full -left-[9px] top-1 border-2 border-white shadow"></div>
                                   <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                       <div>
                                           <span className="font-bold text-gray-800 block">Grup {historyItem.group_id}</span>
                                           <p className="text-xs text-gray-500 mt-1">
                                               {idx === 0 ? "Güncel Grup" : "Geçmiş Kayıt"}
                                           </p>
                                       </div>
                                       <span className="text-xs font-medium text-blue-800 bg-blue-50 border border-blue-100 px-2 py-1 rounded">
                                           Kayıt: {new Date(historyItem.date).toLocaleDateString('tr-TR')}
                                       </span>
                                   </div>
                               </div>
                           ))}
                       </div>
                   ) : (
                       <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500 text-sm border border-gray-100">
                           Bu hayvan için grup geçmişi kaydı bulunamadı.
                       </div>
                   )}
               </div>
           )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          {isEditing ? (
              <>
                 <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-colors flex items-center gap-2"
                 >
                    <FiCornerUpLeft /> İptal
                 </button>
                 <button
                    onClick={handleSave}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors flex items-center gap-2 shadow-sm"
                 >
                    <FiSave /> Kaydet
                 </button>
              </>
          ) : (
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-colors"
              >
                Kapat
              </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewAnimalModal;
