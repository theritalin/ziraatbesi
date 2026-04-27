import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useFarmId } from '../hooks/useFarmId';
import { ReactTabulator } from 'react-tabulator';
import 'react-tabulator/lib/styles.css';
import 'react-tabulator/lib/css/tabulator.min.css';
import { FiDollarSign, FiUsers, FiTrendingUp, FiActivity, FiPieChart, FiRefreshCw } from 'react-icons/fi';

const CARCASS_RATIOS = [
  { weight: 35, ratio: 1.6 },
  { weight: 50, ratio: 1.5 },
  { weight: 70, ratio: 1.42 },
  { weight: 90, ratio: 1.34 },
  { weight: 110, ratio: 1.26 },
  { weight: 130, ratio: 1.19 },
  { weight: 150, ratio: 1.12 },
  { weight: 175, ratio: 1.05 },
  { weight: 200, ratio: 0.98 },
  { weight: 230, ratio: 0.91 },
  { weight: 265, ratio: 0.84 },
  { weight: 300, ratio: 0.77 },
  { weight: 345, ratio: 0.73 },
  { weight: 390, ratio: 0.7 },
  { weight: 440, ratio: 0.67 },
  { weight: 490, ratio: 0.64 },
  { weight: 540, ratio: 0.62 },
  { weight: 590, ratio: 0.61 },
  { weight: 640, ratio: 0.6 },
  { weight: 690, ratio: 0.59 },
  { weight: 740, ratio: 0.58 }
];

const getNearestRatio = (weight) => {
    if (!weight) return 0;
    let selectedRatio = CARCASS_RATIOS[0].ratio;
    
    for (let i = 0; i < CARCASS_RATIOS.length; i++) {
        if (weight >= CARCASS_RATIOS[i].weight) {
            selectedRatio = CARCASS_RATIOS[i].ratio;
        } else {
            break;
        }
    }
    return selectedRatio;
};

const moneyFormatter = (cell) => {
  const val = cell.getValue();
  if (val === null || val === undefined) return '-';
  const num = parseFloat(val);
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(num);
};

const numberFormatter = (cell) => {
  const val = cell.getValue();
  if (val === null || val === undefined) return '-';
  const num = parseFloat(val);
  if (isNaN(num)) return '-';
  return num.toFixed(2);
};

const calculateRationCost = (ration, feeds) => {
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

const SalesPage = () => {
  const { farmId } = useFarmId();
  const [allAnimals, setAllAnimals] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [weighings, setWeighings] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [rations, setRations] = useState([]);
  const [veterinaryRecords, setVeterinaryRecords] = useState([]);
  const [generalExpenses, setGeneralExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [carcassPrice, setCarcassPrice] = useState(() => {
    const saved = localStorage.getItem('sales_carcass_price');
    return saved !== null ? parseFloat(saved) : 350;
  });
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedAnimals, setSelectedAnimals] = useState([]);

  useEffect(() => {
      localStorage.setItem('sales_carcass_price', carcassPrice);
  }, [carcassPrice]);

  const tableRef = useRef(null);

  useEffect(() => {
    if (farmId) {
      fetchData();
    }
  }, [farmId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [animalsRes, weighingsRes, feedsRes, rationsRes, vetRes, expRes] = await Promise.all([
        supabase.from('animals').select('*').eq('farm_id', farmId).order('tag_number', { ascending: true }),
        supabase.from('weighings').select('*').eq('farm_id', farmId).order('weigh_date', { ascending: true }),
        supabase.from('feeds').select('*').eq('farm_id', farmId),
        supabase.from('rations').select('*').eq('farm_id', farmId),
        supabase.from('veterinary_records').select('*').eq('farm_id', farmId),
        supabase.from('general_expenses').select('*').eq('farm_id', farmId)
      ]);
      const fetchedAnimals = animalsRes.data || [];
      setAllAnimals(fetchedAnimals);
      setAnimals(fetchedAnimals.filter(a => a.status !== 'passive'));
      setWeighings(weighingsRes.data || []);
      setFeeds(feedsRes.data || []);
      setRations(rationsRes.data || []);
      setVeterinaryRecords(vetRes.data || []);
      setGeneralExpenses(expRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const groups = useMemo(() => {
    const uniqueGroups = [...new Set(animals.map(a => a.group_id).filter(Boolean))].sort((a, b) => a - b);
    return uniqueGroups;
  }, [animals]);

  // Calculate Costs (Duplicating ReportsPage exact logic to prevent discrepancies)
  const costDataMap = useMemo(() => {
    const animalShares = {}; 
    animals.forEach(a => animalShares[a.id] = 0);

    generalExpenses.forEach(exp => {
        const expDate = new Date(exp.expense_date);
        expDate.setHours(0,0,0,0);
        
        // Count active animals on this date (Must use ALL animals to get correct denominator count)
        const activeAnimalsCountOnDate = allAnimals.filter(a => {
            const regDate = new Date(a.birth_date); 
            regDate.setHours(0,0,0,0);
            if (regDate > expDate) return false; 
            
            if (a.status === 'passive') {
                const pDate = new Date(a.passive_date);
                pDate.setHours(0,0,0,0);
                if (pDate <= expDate) return false; 
            }
            return true;
        }).length;

        if (activeAnimalsCountOnDate > 0) {
            const share = (parseFloat(exp.amount) || 0) / activeAnimalsCountOnDate;
            animals.forEach(a => {
                 const regDate = new Date(a.birth_date); 
                 regDate.setHours(0,0,0,0);
                 let isActive = true;
                 if (regDate > expDate) isActive = false;
                 if (a.status === 'passive') {
                    const pDate = new Date(a.passive_date);
                    pDate.setHours(0,0,0,0);
                    if (pDate <= expDate) isActive = false;
                 }
                 
                 if (isActive) {
                     animalShares[a.id] = (animalShares[a.id] || 0) + share;
                 }
            });
        }
    });

    const map = {};
    animals.forEach(animal => {
      const purchasePrice = parseFloat(animal.purchase_price) || 0;

      let totalFeedCost = 0;
      if (animal.group_id) {
        const groupRations = rations.filter(r => r.group_id == animal.group_id);
        
        groupRations.forEach(ration => {
            const dailyCost = calculateRationCost(ration, feeds); 

            let startDate;
            if (ration.start_date) {
                startDate = new Date(ration.start_date);
                startDate.setHours(0, 0, 0, 0);
            } else {
                startDate = animal.birth_date ? new Date(animal.birth_date) : new Date();
                startDate.setHours(0, 0, 0, 0);
            }

            const endDate = ration.end_date ? new Date(ration.end_date) : new Date();
            endDate.setHours(0, 0, 0, 0);
            
            let effectiveEndDate = endDate;
            if (animal.status === 'passive' && animal.passive_date) {
                const pDate = new Date(animal.passive_date);
                pDate.setHours(0,0,0,0);
                if (pDate < endDate) {
                    effectiveEndDate = pDate;
                }
            }
            
            const duration = Math.max(0, Math.floor((effectiveEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
            totalFeedCost += duration * dailyCost;
        });
      }

      const vetCost = veterinaryRecords
        .filter(r => r.animal_id === animal.id)
        .reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);

      map[animal.id] = purchasePrice + totalFeedCost + vetCost + (animalShares[animal.id] || 0);
    });
    return map;
  }, [animals, allAnimals, rations, feeds, veterinaryRecords, generalExpenses]);

  const isUpdatingDataRef = useRef(false);
  const selectedIdsRef = useRef([]);

  const tableData = useMemo(() => {
    isUpdatingDataRef.current = true;
    let filteredAnimals = animals;
    
    // Filter by group if any are active
    if (selectedGroups.length > 0) {
      filteredAnimals = filteredAnimals.filter(a => selectedGroups.includes(a.group_id));
    }

    return filteredAnimals.map(animal => {
        const animalWeighings = weighings
            .filter(w => w.animal_id === animal.id)
            .sort((a, b) => new Date(a.weigh_date) - new Date(b.weigh_date));
        
        const lastWeighing = animalWeighings.length > 0 ? animalWeighings[animalWeighings.length - 1] : null;
        let currentWeight = lastWeighing ? lastWeighing.weight_kg : (animal.current_weight || 0);
        
        let daysPassed = 0;
        if (lastWeighing && lastWeighing.weigh_date) {
            const weighDate = new Date(lastWeighing.weigh_date);
            weighDate.setHours(0,0,0,0);
            const today = new Date();
            today.setHours(0,0,0,0);
            const diffTime = today - weighDate;
            if (diffTime > 0) {
                daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            }
        } else if (animal.birth_date || animal.created_at) {
            const regDate = new Date(animal.birth_date || animal.created_at);
            regDate.setHours(0,0,0,0);
            const today = new Date();
            today.setHours(0,0,0,0);
            const diffTime = today - regDate;
             if (diffTime > 0) {
                daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            }
        }
        
        currentWeight = currentWeight + (daysPassed * 1.5);
        
        const appliedRatio = getNearestRatio(currentWeight);
        const projectedSalesPrice = currentWeight * appliedRatio * carcassPrice;
        const totalCost = costDataMap[animal.id] || 0;
        const profit = projectedSalesPrice - totalCost;

        return {
            id: animal.id,
            tag_number: animal.tag_number,
            group_id: animal.group_id || 'Grup Yok',
            current_weight: currentWeight,
            applied_ratio: appliedRatio,
            carcass_price: carcassPrice,
            total_cost: totalCost,
            projected_sales_price: projectedSalesPrice,
            profit: profit,
        };
    });
  }, [animals, weighings, selectedGroups, carcassPrice, costDataMap]);

  useEffect(() => {
      const timer = setTimeout(() => {
          if (tableRef.current?.table && selectedIdsRef.current.length > 0) {
             tableRef.current.table.selectRow(selectedIdsRef.current);
          }
          isUpdatingDataRef.current = false;
      }, 150);
      return () => clearTimeout(timer);
  }, [tableData]);

  const columns = useMemo(() => [
    { formatter: "rowSelection", titleFormatter: "rowSelection", hozAlign: "center", headerSort: false, width: 40, frozen: true, headerHozAlign: "center" },
    { title: "Küpe", field: "tag_number", width: 100, headerFilter: "input", frozen: true },
    { title: "Grup", field: "group_id", width: 80, headerFilter: "input" },
    { title: "Güncel Kilo (Tahmini)", field: "current_weight", sorter: "number", width: 160, formatter: numberFormatter },
    { title: "Uygulanan Oran", field: "applied_ratio", sorter: "number", width: 130, formatter: numberFormatter },
    { title: "Maliyet", field: "total_cost", sorter: "number", formatter: moneyFormatter, width: 130 },
    { title: "Tahmini Satış Tutarı", field: "projected_sales_price", sorter: "number", formatter: moneyFormatter, width: 160 },
    { 
        title: "Fark (Kar)", 
        field: "profit", 
        sorter: "number", 
        width: 140,
        formatter: (cell) => {
            const val = cell.getValue();
            if (val === null || val === undefined) return '-';
            const num = parseFloat(val);
            if (isNaN(num)) return '-';
            const formatted = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(num);
            if (num > 0) return `<span class="text-green-600 font-medium">+${formatted}</span>`;
            if (num < 0) return `<span class="text-red-600 font-medium">${formatted}</span>`;
            return formatted;
        } 
    }
  ], []);

  const toggleGroupFilter = (groupId) => {
      setSelectedGroups(prev => 
        prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId]
      );
  };

  const statAverages = useMemo(() => {
      const targetData = selectedAnimals.length > 0 ? selectedAnimals : tableData;
      if (targetData.length === 0) return { count: 0, avgWeight: 0, avgPrice: 0, pairPrice: 0, avgProfit: 0, totalProfit: 0 };
      
      let sumWeight = 0;
      let sumPrice = 0;
      let sumProfit = 0;
      
      targetData.forEach(row => {
          sumWeight += row.current_weight;
          sumPrice += row.projected_sales_price;
          sumProfit += row.profit;
      });
      
      const count = targetData.length;
      const avgPrice = sumPrice / count;
      return {
          count,
          avgWeight: sumWeight / count,
          avgPrice: avgPrice,
          pairPrice: avgPrice * 2,
          avgProfit: sumProfit / count,
          totalProfit: sumProfit,
      };
  }, [tableData, selectedAnimals]);

  const handleRowSelectionChanged = (data, rows) => {
      if (isUpdatingDataRef.current) return;
      selectedIdsRef.current = data.map(d => d.id);
      setSelectedAnimals(data);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      <div className="flex justify-between items-end">
          <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center">
                  <FiDollarSign className="mr-2 text-green-600" />
                  Satış Ekranı
              </h1>
              <p className="text-gray-500 text-sm mt-1">Canlı kilo ve en yakın karkas oranı üzerinden satış simülasyonu ve karlılık analizi yapın.</p>
          </div>
          <button 
              onClick={fetchData}
              disabled={loading}
              className="flex items-center bg-gray-100 text-gray-600 px-3 sm:px-4 py-2 rounded-lg font-semibold hover:bg-gray-200 transition-colors text-xs sm:text-sm"
              title="Verileri Yenile"
          >
              <FiRefreshCw className={`mr-1 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Yenile</span>
          </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 flex flex-col space-y-6">
          <div className="flex flex-col xl:flex-row gap-6 items-start">
              <div className="flex-1 space-y-4 w-full">
                  <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Hesaplama Parametreleri</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="w-full">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Gösterge Karkas Fiyatı (TL/kg)</label>
                          <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <span className="text-gray-500 text-sm">₺</span>
                              </div>
                              <input 
                                  type="number" 
                                  value={carcassPrice} 
                                  onChange={e => setCarcassPrice(parseFloat(e.target.value) || 0)}
                                  className="pl-7 block w-full shadow-sm focus:ring-green-500 focus:border-green-500 text-sm border-gray-300 rounded-lg py-2.5"
                                  inputMode="decimal"
                              />
                          </div>
                      </div>

                      <div className="w-full">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Tablo Filtresi (Gruplara Göre)</label>
                          <div className="flex flex-wrap gap-2 items-center">
                              {groups.map(g => (
                                  <button
                                      key={g}
                                      onClick={() => toggleGroupFilter(g)}
                                      className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all ${
                                          selectedGroups.includes(g) 
                                          ? 'bg-blue-600 text-white shadow-md' 
                                          : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 hover:border-blue-300'
                                      }`}
                                  >
                                      Grup {g}
                                  </button>
                              ))}
                              {groups.length === 0 && <span className="text-gray-500 text-sm">Grup bulunamadı.</span>}
                              {selectedGroups.length > 0 && (
                                  <button
                                      onClick={() => setSelectedGroups([])}
                                      className="ml-auto sm:ml-2 text-xs md:text-sm text-red-600 hover:text-red-800 hover:underline px-2 py-1"
                                  >
                                      Filtreyi Temizle
                                  </button>
                              )}
                          </div>
                      </div>
                  </div>
              </div>

              {/* Stats Section */}
              <div className="w-full xl:w-8/12 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  <div className="bg-orange-50 p-3 rounded-xl border border-orange-200 flex flex-col justify-center items-center text-center">
                      <FiUsers className="text-orange-500 mb-1" size={18} />
                      <span className="text-[10px] sm:text-xs font-semibold text-orange-600 uppercase tracking-wider">Hayvan Sayısı</span>
                      <span className="text-sm sm:text-base font-bold text-orange-900 mt-1">{statAverages.count} Adet</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex flex-col justify-center items-center text-center">
                      <FiActivity className="text-gray-400 mb-1" size={18} />
                      <span className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Ort. Kilo</span>
                      <span className="text-sm sm:text-base font-bold text-gray-900 mt-1">{statAverages.avgWeight.toFixed(1)} kg</span>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 flex flex-col justify-center items-center text-center">
                      <FiTrendingUp className="text-blue-500 mb-1" size={18} />
                      <span className="text-[10px] sm:text-xs font-semibold text-blue-600 uppercase tracking-wider">Ort. Fiyat</span>
                      <span className="text-sm sm:text-base font-bold text-blue-900 mt-1">
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(statAverages.avgPrice)}
                      </span>
                  </div>
                  <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200 flex flex-col justify-center items-center text-center">
                      <FiUsers className="text-indigo-500 mb-1" size={18} />
                      <span className="text-[10px] sm:text-xs font-bold text-indigo-600 uppercase tracking-wider">Çift Fiyatı</span>
                      <span className="text-base sm:text-lg font-extrabold text-indigo-900 mt-1 border-b border-indigo-300 pb-0.5">
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(statAverages.pairPrice)}
                      </span>
                  </div>
                  <div className="bg-green-50 p-3 rounded-xl border border-green-200 flex flex-col justify-center items-center text-center">
                      <FiPieChart className="text-green-500 mb-1" size={18} />
                      <span className="text-[10px] sm:text-xs font-semibold text-green-600 uppercase tracking-wider">Ort. Kar</span>
                      <span className="text-sm sm:text-base font-bold text-green-900 mt-1">
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(statAverages.avgProfit)}
                      </span>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-xl border border-purple-200 flex flex-col justify-center items-center text-center">
                      <FiDollarSign className="text-purple-500 mb-1" size={18} />
                      <span className="text-[10px] sm:text-xs font-semibold text-purple-600 uppercase tracking-wider">Toplam Kar</span>
                      <span className="text-sm sm:text-base font-bold text-purple-900 mt-1">
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(statAverages.totalProfit)}
                      </span>
                  </div>
              </div>
          </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        <ReactTabulator
            ref={tableRef}
            data={tableData}
            columns={columns}
            layout="fitColumns"
            events={{
                rowSelectionChanged: handleRowSelectionChanged
            }}
            options={{
                selectable: true,
                pagination: "local",
                paginationSize: 50,
                placeholder: "Filtrelere uygun hayvan verisi bulunamadı.",
                height: "100%",
                layout: "fitDataFill",
                responsiveLayout: "collapse",
                resizableColumns: true,
            }}
        />
      </div>
    </div>
  );
};

export default SalesPage;
