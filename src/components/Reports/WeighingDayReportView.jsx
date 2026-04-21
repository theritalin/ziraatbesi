import React, { useState, useMemo, useEffect } from 'react';
import { ReactTabulator } from 'react-tabulator';
import 'react-tabulator/lib/styles.css';
import 'react-tabulator/lib/css/tabulator.min.css';
import { FiCalendar, FiPrinter } from 'react-icons/fi';

const WeighingDayReportView = ({ animals, weighings, rations, feeds }) => {
  // 1. Extract unique dates from weighings, sorted descending
  const availableDates = useMemo(() => {
    const dates = [...new Set(weighings.map(w => w.weigh_date))];
    return dates.sort((a, b) => new Date(b) - new Date(a));
  }, [weighings]);

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedRows, setSelectedRows] = useState([]); // Selected rows state
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [carcassPrice, setCarcassPrice] = useState(650);
  const [yieldPercentage, setYieldPercentage] = useState(58);
  const [customMonthlyExpense, setCustomMonthlyExpense] = useState(45000);

  const groups = useMemo(() => {
    return [...new Set(animals.map(a => a.group_id).filter(Boolean))].sort((a, b) => a - b);
  }, [animals]);

  // Calculate daily general expense per active animal
  const activeAnimalsCount = useMemo(() => {
    return animals.filter(a => a.status === 'active' || a.status === 'Aktif').length || 1;
  }, [animals]);

  const dailyOtherExpense = useMemo(() => {
     return customMonthlyExpense / activeAnimalsCount / 30;
  }, [activeAnimalsCount, customMonthlyExpense]);

  // Helper: Calculate Daily Ration Cost per Group
  const groupDailyCosts = useMemo(() => {
    const costs = {};
    const today = new Date();
    today.setHours(0,0,0,0);

    const activeRations = rations ? rations.filter(r => {
        if (!r.end_date) return true;
        const end = new Date(r.end_date);
        end.setHours(0,0,0,0);
        return end >= today;
    }) : [];

    activeRations.forEach(ration => {
        if (!ration.group_id) return;
        let daily = 0;
        const items = ration.content || [];
        items.forEach(item => {
            const feed = feeds && feeds.find(f => f.id == item.feed_id);
            if (feed) {
                daily += (parseFloat(item.amount) || 0) * (parseFloat(feed.price_per_kg) || 0);
            }
        });
        costs[ration.group_id] = (costs[ration.group_id] || 0) + daily;
    });

    return costs;
  }, [rations, feeds]);

  // Set default date to the latest one when available
  useEffect(() => {
    if (availableDates.length > 0 && !selectedDate) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableDates, selectedDate]);

  // Reset selection when date changes
  useEffect(() => {
    setSelectedRows([]);
  }, [selectedDate]);

  // 2. Calculate Data for Selected Date
  const reportData = useMemo(() => {
    if (!selectedDate) return [];

    // Filter weighings for this date
    let currentWeighings = weighings.filter(w => w.weigh_date === selectedDate);

    return currentWeighings.map(curr => {
      const animal = animals.find(a => a.id === curr.animal_id);
      if (!animal) return null;
      if (selectedGroups.length > 0 && !selectedGroups.includes(String(animal.group_id))) return null;

      // Get all weighings for this animal, sorted by date
      const animalWeighings = weighings
        .filter(w => w.animal_id === curr.animal_id)
        .sort((a, b) => new Date(a.weigh_date) - new Date(b.weigh_date));

      // Find current index
      const currentIndex = animalWeighings.findIndex(w => w.id === curr.id); // Assuming ID is unique, or match by date
      
      // Previous Weighing
      // Fallback to animal registration data if no previous weighing exists
      const prevWeighing = currentIndex > 0 
        ? animalWeighings[currentIndex - 1] 
        : (animal.current_weight && animal.birth_date ? { weigh_date: animal.birth_date, weight_kg: animal.current_weight } : null);
      
      // First Weighing (Registration)
      // Use animal registration data as the absolute first weighing
      const firstWeighing = (animal.current_weight && animal.birth_date) 
        ? { id: 'registration', weigh_date: animal.birth_date, weight_kg: animal.current_weight } 
        : animalWeighings[0];

      // Calculations
      let daysDiff = '-';
      let weightGain = '-';
      let periodGcaa = '-';
      let totalGcaa = '-';
      
      const currDateObj = new Date(curr.weigh_date);

      // Period Metrics (Current vs Previous)
      if (prevWeighing) {
        const prevDateObj = new Date(prevWeighing.weigh_date);
        const diffTime = Math.abs(currDateObj - prevDateObj);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        daysDiff = diffDays;
        weightGain = curr.weight_kg - prevWeighing.weight_kg;
        
        if (diffDays > 0) {
          periodGcaa = (weightGain / diffDays).toFixed(3);
        }
      }

      // Total Metrics (Current vs First)
      if (firstWeighing && firstWeighing.id !== curr.id) {
         const firstDateObj = new Date(firstWeighing.weigh_date);
         const totalDiffTime = Math.abs(currDateObj - firstDateObj);
         const totalDiffDays = Math.ceil(totalDiffTime / (1000 * 60 * 60 * 24));
         const totalGain = curr.weight_kg - firstWeighing.weight_kg;

         if (totalDiffDays > 0) {
             totalGcaa = (totalGain / totalDiffDays).toFixed(3);
         }
      }

      // Calculate specific daily cost for this animal
      const dailyRationCost = groupDailyCosts[animal.group_id] || 0;
      const dailyTotalCost = dailyRationCost + dailyOtherExpense;

      // Profit / Loss calculation for this period
      let dailyProfit = '-';
      if (periodGcaa !== '-') {
          dailyProfit = (parseFloat(periodGcaa) * (yieldPercentage / 100) * carcassPrice) - dailyTotalCost;
      }

      return {
        id: curr.id,
        tag_number: animal.tag_number,
        group_id: animal.group_id || 'Yok',
        current_weight: curr.weight_kg,
        
        prev_date: prevWeighing ? prevWeighing.weigh_date : '-',
        prev_weight: prevWeighing ? prevWeighing.weight_kg : '-',
        
        days_diff: daysDiff,
        weight_gain: weightGain !== '-' ? weightGain.toFixed(2) : '-',
        
        first_date: firstWeighing ? firstWeighing.weigh_date : '-',
        first_weight: firstWeighing ? firstWeighing.weight_kg : '-',
        
        total_gcaa: totalGcaa,
        period_gcaa: periodGcaa,
        daily_cost: dailyTotalCost,
        daily_profit: dailyProfit !== '-' ? dailyProfit : '-'
      };
    }).filter(item => item !== null);
  }, [selectedDate, weighings, animals, selectedGroups, carcassPrice, yieldPercentage, customMonthlyExpense, dailyOtherExpense, groupDailyCosts]);

  // 3. Summary Statistics
  const summary = useMemo(() => {
    // Use selected rows if any, otherwise use all rows
    const dataToUse = selectedRows.length > 0 ? selectedRows : reportData;

    if (dataToUse.length === 0) return { count: 0, avgWeight: 0, avgGain: 0, avgGcaa: 0 };

    const count = dataToUse.length;
    const totalWeight = dataToUse.reduce((sum, item) => sum + (parseFloat(item.current_weight) || 0), 0);
    
    // Only count items that have valid gain/gcaa for averages
    const gainItems = dataToUse.filter(item => item.weight_gain !== '-');
    const totalGain = gainItems.reduce((sum, item) => sum + (parseFloat(item.weight_gain) || 0), 0);
    
    const gcaaItems = dataToUse.filter(item => item.period_gcaa !== '-');
    const totalGcaa = gcaaItems.reduce((sum, item) => sum + (parseFloat(item.period_gcaa) || 0), 0);

    const profitItems = dataToUse.filter(item => item.daily_profit !== '-');
    const totalProfit = profitItems.reduce((sum, item) => sum + (parseFloat(item.daily_profit) || 0), 0);

    const totalMeatValue = gainItems.reduce((sum, item) => sum + ((parseFloat(item.weight_gain) || 0) * (yieldPercentage / 100) * carcassPrice), 0);

    const totalNetProfit = gainItems.reduce((sum, item) => {
        const days = parseFloat(item.days_diff) || 0;
        const dailyProfit = parseFloat(item.daily_profit) || 0;
        return sum + (days * dailyProfit);
    }, 0);

    return {
      count,
      avgWeight: (totalWeight / count).toFixed(2),
      avgGain: gainItems.length > 0 ? (totalGain / gainItems.length).toFixed(2) : '0.00',
      avgGcaa: gcaaItems.length > 0 ? (totalGcaa / gcaaItems.length).toFixed(3) : '0.000',
      avgProfit: profitItems.length > 0 ? (totalProfit / profitItems.length).toFixed(2) : '0.00',
      totalMeatValue,
      totalNetProfit,
      isFiltered: selectedRows.length > 0
    };
  }, [reportData, selectedRows, yieldPercentage, carcassPrice]);

  // 4. Columns
  const columns = useMemo(() => [
    { title: "Küpe No", field: "tag_number", sorter: "string", headerFilter: "input" },
    { title: "Grup", field: "group_id", sorter: "string" },
    { title: "Tartım Kilosu", field: "current_weight", sorter: "number" },
    { title: "Önceki Tarih", field: "prev_date", sorter: "string" },
    { title: "Önceki Kilo", field: "prev_weight", sorter: "number" },
    { title: "Gün Farkı", field: "days_diff", sorter: "number" },
    { title: "Kilo Artışı", field: "weight_gain", sorter: "number", formatter: (cell) => {
        const val = cell.getValue();
        if(val === '-') return '-';
        return `<span style="color:${val >= 0 ? 'green' : 'red'}">${val}</span>`;
    }},
    { title: "İlk Kayıt Tarihi", field: "first_date", sorter: "string" },
    { title: "İlk Kayıt Kilo", field: "first_weight", sorter: "number" },
    { title: "Genel GCAA", field: "total_gcaa", sorter: "number" },
    { title: "Dönem GCAA", field: "period_gcaa", sorter: "number", formatter: (cell) => {
        const val = cell.getValue();
        if(val === '-') return '-';
        const num = parseFloat(val);
        let color = 'black';
        if(num > 1.2) color = 'green';
        else if(num < 0.8) color = 'red';
        return `<span style="color:${color}; font-weight:bold;">${val}</span>`;
    }},
    { title: "Günlük Kar/Zarar", field: "daily_profit", sorter: "number", formatter: (cell) => {
        const val = cell.getValue();
        if(val === '-') return '-';
        const num = parseFloat(val);
        const formatted = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(num);
        return `<span style="color:${num >= 0 ? 'green' : 'red'}; font-weight:bold;">${formatted}</span>`;
    }},
    { title: "Hesaplanan Masraf", field: "daily_cost", sorter: "number", formatter: (cell) => {
        const val = cell.getValue();
        if(val === undefined || isNaN(val)) return '-';
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
    }},
  ], []);

  const handlePrint = () => {
    window.print();
  };

  // Tabulator Options for Selection
  const options = useMemo(() => ({
    pagination: "local",
    paginationSize: 50,
    movableColumns: true,
    placeholder: "Veri bulunamadı",
    height: "100%",
    headerWordWrap: true,
    tooltipsHeader: true,
    headerSort: true,
    layout: "fitData",
    selectable: true, // Enable selection
  }), []);

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="w-full sm:w-auto">
          <label className="block text-sm font-medium text-gray-700 mb-1">Tarih Seçin</label>
          <div className="relative">
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full sm:w-48 pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none"
            >
              {availableDates.map(date => (
                <option key={date} value={date}>
                  {new Date(date).toLocaleDateString('tr-TR')}
                </option>
              ))}
            </select>
            <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
        </div>
        
          {/* Grup Seçimi */}
          <div className="flex flex-col flex-1 pl-4">
             <span className="block text-sm font-medium text-gray-700 mb-1">Grup Seçin</span>
             <div className="flex flex-wrap gap-2 items-center">
                 {groups.map(g => (
                     <button
                         key={g}
                         onClick={() => {
                             setSelectedGroups(prev => 
                                 prev.includes(String(g)) ? prev.filter(x => x !== String(g)) : [...prev, String(g)]
                             );
                         }}
                         className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                             selectedGroups.includes(String(g)) 
                             ? 'bg-blue-600 text-white border-blue-600' 
                             : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                         }`}
                     >
                         Grup {g}
                     </button>
                 ))}
                 {groups.length === 0 && <span className="text-gray-500 text-sm">Grup bulunamadı.</span>}
                  <button
                         onClick={() => setSelectedGroups([])}
                         className="ml-2 text-xs text-red-600 hover:underline"
                         hidden={selectedGroups.length === 0}
                     >
                         Tümünü Temizle
                 </button>
             </div>
          </div>
        
        <div className="flex flex-col items-center">
            <h2 className="text-xl font-bold text-gray-800">GÜNLÜK TARTIM RAPORU</h2>
            <p className="text-gray-500">Tarih: {selectedDate ? new Date(selectedDate).toLocaleDateString('tr-TR') : '-'}</p>
        </div>

        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ml-auto"
        >
          <FiPrinter />
          Yazdır
        </button>
      </div>

      {/* Settings Row */}
      <div className="flex flex-wrap gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
         <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Karkas Fiyatı (TL)</label>
            <input 
                type="number" 
                value={carcassPrice} 
                onChange={e => setCarcassPrice(parseFloat(e.target.value) || 0)}
                className="w-24 px-3 py-1.5 border rounded-md text-sm"
            />
         </div>
         <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Randıman (%)</label>
            <input 
                type="number" 
                value={yieldPercentage} 
                onChange={e => setYieldPercentage(parseFloat(e.target.value) || 0)}
                className="w-24 px-3 py-1.5 border rounded-md text-sm"
            />
         </div>
         <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Aylık Genel Gider (TL)</label>
            <input 
                type="number" 
                value={customMonthlyExpense} 
                onChange={e => setCustomMonthlyExpense(parseFloat(e.target.value) || 0)}
                className="w-32 px-3 py-1.5 border rounded-md text-sm"
            />
         </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <p className="text-sm text-blue-600 font-medium">
            {summary.isFiltered ? 'Seçilen Hayvan' : 'Toplam Hayvan'}
          </p>
          <p className="text-2xl font-bold text-blue-800">{summary.count}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
          <p className="text-sm text-green-600 font-medium">
            {summary.isFiltered ? 'Ortalama Kilo (Seçilen)' : 'Ortalama Kilo'}
          </p>
          <p className="text-2xl font-bold text-green-800">{summary.avgWeight} kg</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
          <p className="text-sm text-purple-600 font-medium">
             {summary.isFiltered ? 'Ortalama Artış (Seçilen)' : 'Ortalama Artış'}
          </p>
          <p className="text-2xl font-bold text-purple-800">{summary.avgGain} kg</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
          <p className="text-sm text-orange-600 font-medium">
             {summary.isFiltered ? 'Ortalama GCAA (Seçilen)' : 'Ortalama GCAA'}
          </p>
          <p className="text-2xl font-bold text-orange-800">{summary.avgGcaa}</p>
        </div>
        <div className="bg-teal-50 p-4 rounded-lg border border-teal-100">
          <p className="text-sm text-teal-600 font-medium">
             {summary.isFiltered ? 'Ort. Günlük Kar (Seçilen)' : 'Ort. Günlük Kar'}
          </p>
          <p className="text-2xl font-bold text-teal-800">{summary.avgProfit} ₺</p>
        </div>
        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
          <p className="text-sm text-indigo-600 font-medium">
             Kazanılan Et Değeri
          </p>
          <p className="text-2xl font-bold text-indigo-800">
              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(summary.totalMeatValue)}
          </p>
        </div>
        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
          <p className="text-sm text-emerald-600 font-medium">
             Net Kazanç (Masraf Sonrası)
          </p>
          <p className="text-2xl font-bold text-emerald-800">
              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(summary.totalNetProfit)}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
        {reportData.length > 0 ? (
            <ReactTabulator
            data={reportData}
            columns={columns}
            options={options}
            events={{
              rowSelectionChanged: (data, rows) => {
                setSelectedRows(data);
              }
            }}
            />
        ) : (
            <div className="flex justify-center items-center h-full text-gray-500">
                Bu tarih için kayıt bulunamadı.
            </div>
        )}
      </div>
    </div>
  );
};

export default WeighingDayReportView;
