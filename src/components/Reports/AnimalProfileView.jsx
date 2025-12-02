import React, { useState, useMemo } from 'react';
import { FiSearch, FiPrinter } from 'react-icons/fi';

const AnimalProfileView = ({ animals, weighings, veterinaryRecords, costData }) => {
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Price State with LocalStorage persistence
  const [livePrice, setLivePrice] = useState(() => localStorage.getItem('animal_profile_live_price') || '300');
  const [carcassPrice, setCarcassPrice] = useState(() => localStorage.getItem('animal_profile_carcass_price') || '450');

  // Update localStorage when prices change
  const handleLivePriceChange = (e) => {
    const val = e.target.value;
    setLivePrice(val);
    localStorage.setItem('animal_profile_live_price', val);
  };

  const handleCarcassPriceChange = (e) => {
    const val = e.target.value;
    setCarcassPrice(val);
    localStorage.setItem('animal_profile_carcass_price', val);
  };

  // Filter animals for dropdown
  const filteredAnimals = useMemo(() => {
    return animals.filter(a => 
      a.tag_number.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [animals, searchTerm]);

  // Get selected animal data
  const animalData = useMemo(() => {
    if (!selectedAnimalId) return null;
    
    const animal = animals.find(a => a.id === parseInt(selectedAnimalId));
    if (!animal) return null;

    // Weighings
    const animalWeighings = weighings
      .filter(w => w.animal_id === animal.id)
      .sort((a, b) => new Date(a.weigh_date) - new Date(b.weigh_date));

    // Calculate GCAA for weighings
    const weighingHistory = [];
    for (let i = 0; i < animalWeighings.length; i++) {
      const current = animalWeighings[i];
      let gcaa = 0;
      let daysDiff = 0;
      let gain = 0;

      if (i > 0) {
        const prev = animalWeighings[i - 1];
        const prevDate = new Date(prev.weigh_date);
        const currDate = new Date(current.weigh_date);
        daysDiff = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
        gain = current.weight_kg - prev.weight_kg;
        gcaa = daysDiff > 0 ? (gain / daysDiff) * 1000 : 0; // Convert to grams
      }

      weighingHistory.push({
        date: current.weigh_date,
        weight: current.weight_kg,
        gain: gain,
        days: daysDiff,
        gcaa: gcaa
      });
    }

    // Vet Records
    const vetHistory = veterinaryRecords
      .filter(v => v.animal_id === animal.id)
      .sort((a, b) => new Date(b.process_date) - new Date(a.process_date));

    // Performance Metrics
    const lastWeight = animalWeighings.length > 0 ? animalWeighings[animalWeighings.length - 1].weight_kg : animal.current_weight;
    const firstWeight = animalWeighings.length > 0 ? animalWeighings[0].weight_kg : animal.current_weight;
    
    // Total GCAA (Lifetime in farm)
    const regDate = new Date(animal.birth_date);
    const today = new Date();
    const daysInFarm = Math.max(1, Math.floor((today - regDate) / (1000 * 60 * 60 * 24)));
    const totalGain = lastWeight - firstWeight;
    const avgGcaa = (totalGain / daysInFarm) * 1000; // grams

    // Last GCAA (from last weighing interval)
    const lastGcaa = weighingHistory.length > 1 ? weighingHistory[weighingHistory.length - 1].gcaa : 0;

    // Potential Value Calculations
    const liveVal = lastWeight * (parseFloat(livePrice) || 0);
    const carcassYield = 0.58; // 58% yield
    const carcassVal = (lastWeight * carcassYield) * (parseFloat(carcassPrice) || 0);

    // Get Total Cost
    const animalCost = costData ? costData.find(c => c.id === animal.id) : null;
    const totalCost = animalCost ? animalCost.total_cost : 0;

    return {
      ...animal,
      lastWeight,
      avgGcaa,
      lastGcaa,
      liveVal,
      carcassVal,
      totalCost,
      weighingHistory: weighingHistory.reverse(), // Show newest first
      vetHistory
    };
  }, [selectedAnimalId, animals, weighings, veterinaryRecords, livePrice, carcassPrice, costData]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-5xl mx-auto print:shadow-none print:w-full">
      {/* Header & Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 print:hidden">
        <div className="w-full md:w-1/2 flex gap-4 items-end">
          <div className="flex-1 relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Küpe No Seçin</label>
            <div className="relative">
              <select
                value={selectedAnimalId}
                onChange={(e) => setSelectedAnimalId(e.target.value)}
                className="w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md border"
              >
                <option value="">Hayvan Seçiniz</option>
                {filteredAnimals.map(animal => (
                  <option key={animal.id} value={animal.id}>
                    {animal.tag_number} - Grup {animal.group_id || '-'}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <FiSearch className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>
          
          <div className="w-24">
            <label className="block text-xs font-medium text-gray-500 mb-1">Canlı (TL)</label>
            <input
              type="number"
              value={livePrice}
              onChange={handleLivePriceChange}
              className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div className="w-24">
            <label className="block text-xs font-medium text-gray-500 mb-1">Karkas (TL)</label>
            <input
              type="number"
              value={carcassPrice}
              onChange={handleCarcassPriceChange}
              className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>
        
        {animalData && (
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <FiPrinter /> Yazdır
          </button>
        )}
      </div>

      {animalData ? (
        <div className="space-y-6">
          {/* Title */}
          <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
            <h1 className="text-3xl font-bold text-gray-900">HAYVAN KARNESİ</h1>
            <p className="text-gray-600 mt-1">Küpe No: {animalData.tag_number}</p>
          </div>

          {/* Top Grid: Identity & Performance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-2 border-gray-800">
            {/* Left Column: Identity */}
            <div className="border-b md:border-b-0 md:border-r border-gray-800">
              <div className="bg-gray-100 p-2 font-bold border-b border-gray-800">Kimlik Bilgileri</div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between border-b border-gray-200 pb-1">
                  <span className="font-semibold">Kayıt Tarihi:</span>
                  <span>{new Date(animalData.birth_date).toLocaleDateString('tr-TR')}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="font-semibold">Grup:</span>
                  <span>{animalData.group_id || '-'}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Performance */}
            <div>
              <div className="bg-gray-100 p-2 font-bold border-b border-gray-800 flex justify-between items-center">
                <span>PERFORMANS</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between border-b border-gray-200 pb-1">
                  <span className="font-semibold">Son Ağırlık (kg):</span>
                  <span className="text-xl font-bold">{animalData.lastWeight}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-1">
                  <span className="font-semibold">Ort. GCAA (gram/gün):</span>
                  <span className={animalData.avgGcaa > 1200 ? "text-green-600 font-bold" : "text-gray-900"}>
                    {animalData.avgGcaa.toFixed(0)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-1">
                  <span className="font-semibold">Son GCAA (gram/gün):</span>
                  <span className={animalData.lastGcaa > 1200 ? "text-green-600 font-bold" : "text-gray-900"}>
                    {animalData.lastGcaa.toFixed(0)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-1">
                  <span className="font-semibold">Potansiyel (Canlı):</span>
                  <span className="font-bold text-blue-600">
                    {animalData.liveVal.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                  </span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-1">
                  <span className="font-semibold">Potansiyel (Karkas %58):</span>
                  <span className="font-bold text-green-600">
                    {animalData.carcassVal.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                  </span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-1">
                  <span className="font-semibold">Maliyet:</span>
                  <span className="font-bold text-red-600">
                    {animalData.totalCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                  </span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="font-semibold">Güncel Durum:</span>
                  <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-medium">Aktif</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Grid: History Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* Weighing History */}
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <div className="bg-gray-800 text-white p-2 font-bold text-center">TARTIM GEÇMİŞİ</div>
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 text-gray-700 border-b">
                  <tr>
                    <th className="px-3 py-2">Tarih</th>
                    <th className="px-3 py-2 text-right">Kilo (kg)</th>
                    <th className="px-3 py-2 text-right">Fark</th>
                    <th className="px-3 py-2 text-right">Gün</th>
                    <th className="px-3 py-2 text-right">GCAA (gr)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {animalData.weighingHistory.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2">{new Date(row.date).toLocaleDateString('tr-TR')}</td>
                      <td className="px-3 py-2 text-right font-medium">{row.weight}</td>
                      <td className="px-3 py-2 text-right text-gray-500">
                        {row.gain > 0 ? `+${row.gain}` : row.gain}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">{row.days}</td>
                      <td className={`px-3 py-2 text-right font-bold ${row.gcaa > 1200 ? 'text-green-600' : 'text-gray-600'}`}>
                        {row.gcaa.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                  {animalData.weighingHistory.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-3 py-4 text-center text-gray-500">Kayıt bulunamadı</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Health History */}
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <div className="bg-gray-800 text-white p-2 font-bold text-center">SAĞLIK GEÇMİŞİ</div>
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 text-gray-700 border-b">
                  <tr>
                    <th className="px-3 py-2">Tarih</th>
                    <th className="px-3 py-2">İşlem</th>
                    <th className="px-3 py-2 text-right">Maliyet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {animalData.vetHistory.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2">{new Date(row.process_date).toLocaleDateString('tr-TR')}</td>
                      <td className="px-3 py-2">{row.procedure_name}</td>
                      <td className="px-3 py-2 text-right">{row.cost?.toFixed(2)} ₺</td>
                    </tr>
                  ))}
                  {animalData.vetHistory.length === 0 && (
                    <tr>
                      <td colSpan="3" className="px-3 py-4 text-center text-gray-500">Kayıt bulunamadı</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-lg">Görüntülemek için yukarıdan bir hayvan seçiniz.</p>
        </div>
      )}
    </div>
  );
};

export default AnimalProfileView;
