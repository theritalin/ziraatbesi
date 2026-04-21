import React, { useState, useMemo } from 'react';
import { ReactTabulator } from 'react-tabulator';
import 'react-tabulator/lib/styles.css';
import 'react-tabulator/lib/css/tabulator.min.css';

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

const numberCalcFormatter = (cell) => {
  const val = cell.getValue();
  if (val === null || val === undefined) return '-';
  const num = parseFloat(val);
  if (isNaN(num)) return '-';
  return num.toFixed(2);
};

const moneyCalcFormatter = (cell) => {
  const val = cell.getValue();
  if (val === null || val === undefined) return '-';
  const num = parseFloat(val);
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(num);
};

const dateFormatter = (cell) => {
  const val = cell.getValue();
  if (!val) return '-';
  return val;
};

const Projection2ReportView = ({ animals, weighings, rations, feeds, costData, generalExpenses = [] }) => {
  // Inputs
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [carcassPrice, setCarcassPrice] = useState(650);
  const [yieldPercentage, setYieldPercentage] = useState(58);
  
  const [gcaaMode, setGcaaMode] = useState('custom'); // 'last' or 'custom'
  const [customGcaa, setCustomGcaa] = useState(1.3);
  
  const [expenseMode, setExpenseMode] = useState('last'); // 'last' or 'custom'
  const [customMonthlyExpense, setCustomMonthlyExpense] = useState(45000);

  const [dateMode, setDateMode] = useState('bugun'); // 'kayit' or 'bugun'

  // Calculate last month's total expenses
  const lastMonthExpenses = useMemo(() => {
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    return generalExpenses
      .filter(exp => {
        const expDate = new Date(exp.expense_date);
        return expDate >= oneMonthAgo && expDate <= today;
      })
      .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
  }, [generalExpenses]);

  // Daily other expenses (per animal)
  const dailyOtherExpense = useMemo(() => {
    const totalAnimals = animals.length || 1;
    const monthlyPerAnimal = expenseMode === 'last' 
      ? lastMonthExpenses / totalAnimals 
      : customMonthlyExpense / totalAnimals;
    return monthlyPerAnimal / 30; // Convert monthly to daily
  }, [animals.length, expenseMode, lastMonthExpenses, customMonthlyExpense]);

  // Derive Groups for Filter
  const groups = useMemo(() => {
    return [...new Set(animals.map(a => a.group_id).filter(Boolean))].sort((a, b) => a - b);
  }, [animals]);

  // Helper: Calculate Daily Ration Cost per Group
  const groupDailyCosts = useMemo(() => {
    const costs = {};
    const today = new Date();
    today.setHours(0,0,0,0);

    const activeRations = rations.filter(r => {
        if (!r.end_date) return true;
        const end = new Date(r.end_date);
        end.setHours(0,0,0,0);
        return end >= today;
    });

    activeRations.forEach(ration => {
        if (!ration.group_id) return;
        let daily = 0;
        const items = ration.content || [];
        items.forEach(item => {
            const feed = feeds.find(f => f.id == item.feed_id);
            if (feed) {
                daily += (parseFloat(item.amount) || 0) * (parseFloat(feed.price_per_kg) || 0);
            }
        });
        costs[ration.group_id] = (costs[ration.group_id] || 0) + daily;
    });

    return costs;
  }, [rations, feeds]);

  const tableData = useMemo(() => {
      let filteredAnimals = animals;
      if (selectedGroups.length > 0) {
        filteredAnimals = filteredAnimals.filter(a => selectedGroups.includes(a.group_id));
      }

      return filteredAnimals.map(animal => {
          const animalWeighings = weighings
            .filter(w => w.animal_id === animal.id)
            .sort((a, b) => new Date(a.weigh_date) - new Date(b.weigh_date));
            
          const lastWeighing = animalWeighings.length > 0 ? animalWeighings[animalWeighings.length - 1] : null;
          
          let lastGcaa = 0;
          if (animalWeighings.length >= 2) {
              const last = animalWeighings[animalWeighings.length - 1];
              const prev = animalWeighings[animalWeighings.length - 2];
              const d = (new Date(last.weigh_date) - new Date(prev.weigh_date)) / (1000 * 60 * 60 * 24);
              if (d > 0) lastGcaa = (last.weight_kg - prev.weight_kg) / d;
          }
          const selectedGcaa = gcaaMode === 'last' ? (lastGcaa > 0 ? lastGcaa : 0.001) : (customGcaa > 0 ? customGcaa : 0.001);

          const dailyRationCost = groupDailyCosts[animal.group_id] || 0;
          const dailyTotalCost = dailyRationCost + dailyOtherExpense;
          const dailyValueGain = selectedGcaa * (yieldPercentage / 100) * carcassPrice;
          const netDailyProfit = dailyValueGain - dailyTotalCost;

          let gap = 0;
          let startDateStr = '';
          let startWeight = 0;
          let requiredPurchasePrice = 0;
          let actualInvestment = 0;
          
          const regDate = animal.birth_date ? new Date(animal.birth_date) : new Date();

          if (dateMode === 'kayit') {
              startWeight = animal.current_weight || 0; // Registration weight
              startDateStr = regDate.toLocaleDateString('tr-TR');
              
              requiredPurchasePrice = startWeight * (yieldPercentage / 100) * carcassPrice;
              actualInvestment = parseFloat(animal.purchase_price) || 0;
              
              // Gap is actual cost - what it should have cost
              gap = actualInvestment - requiredPurchasePrice;
          } else {
              // 'bugun'
              startWeight = lastWeighing ? lastWeighing.weight_kg : (animal.current_weight || 0);
              const today = new Date();
              startDateStr = today.toLocaleDateString('tr-TR');
              
              requiredPurchasePrice = startWeight * (yieldPercentage / 100) * carcassPrice;
              
              // Investment so far = Total Cost (Purchase + Feed + Vet + GenExp)
              actualInvestment = costData.find(c => c.id === animal.id)?.total_cost || (parseFloat(animal.purchase_price) || 0);
              
              gap = actualInvestment - requiredPurchasePrice;
          }

          let daysToRecover = 0;
          let recoveryDateObj = dateMode === 'kayit' ? new Date(regDate) : new Date();

          if (gap > 0) {
              if (netDailyProfit > 0) {
                  daysToRecover = gap / netDailyProfit;
                  recoveryDateObj.setDate(recoveryDateObj.getDate() + Math.round(daysToRecover));
              } else {
                  daysToRecover = 9999; // Will never recover, daily profit is negative
              }
          }

          return {
              id: animal.id,
              tag_number: animal.tag_number,
              group_id: animal.group_id,
              
              start_date: startDateStr,
              start_weight: startWeight,
              
              actual_investment: actualInvestment,
              required_price: requiredPurchasePrice,
              gap: gap,

              selected_gcaa: selectedGcaa,
              daily_value_gain: dailyValueGain,
              daily_cost: dailyTotalCost,
              net_daily_profit: netDailyProfit,

              days_to_recover: gap <= 0 ? 0 : daysToRecover,
              recovery_date: gap <= 0 ? 'Zaten Kârda' : (daysToRecover === 9999 ? 'Asla' : recoveryDateObj.toLocaleDateString('tr-TR')),
          };
      });
  }, [animals, weighings, costData, selectedGroups, gcaaMode, customGcaa, groupDailyCosts, dailyOtherExpense, yieldPercentage, carcassPrice, dateMode]);

  const stats = useMemo(() => {
      if (tableData.length === 0) return { count: 0, totalGap: 0, totalNetDaily: 0, avgDays: 0 };
      const totalGap = tableData.reduce((sum, item) => sum + (item.gap > 0 ? item.gap : 0), 0);
      const totalNetDaily = tableData.reduce((sum, item) => sum + item.net_daily_profit, 0);
      const avgDays = totalNetDaily > 0 ? totalGap / totalNetDaily : 9999;
      return {
          count: tableData.length,
          totalGap,
          totalNetDaily,
          avgDays: totalGap === 0 ? 0 : avgDays
      };
  }, [tableData]);

  const columns = useMemo(() => [
    { title: "Küpe No", field: "tag_number", width: 120, headerFilter: "input", frozen: true, resizable: true },
    { title: "Grup", field: "group_id", width: 80, resizable: true },
    { title: "Başlangıç Tarihi", field: "start_date", width: 130, resizable: true },
    { title: "Kilo (kg)", field: "start_weight", width: 110, formatter: numberFormatter, resizable: true, bottomCalc: "avg", bottomCalcFormatter: numberCalcFormatter },
    
    { title: dateMode === 'kayit' ? "Gerçek Alım Fiyatı" : "Bugüne Kadarki Toplam Maliyet", field: "actual_investment", width: 180, formatter: moneyFormatter, resizable: true, bottomCalc: "sum", bottomCalcFormatter: moneyCalcFormatter },
    { title: "Olması Gereken Değer", field: "required_price", width: 160, formatter: moneyFormatter, resizable: true, bottomCalc: "sum", bottomCalcFormatter: moneyCalcFormatter },
    { title: "Fark / Zarar", field: "gap", width: 130, formatter: (cell) => {
        const val = cell.getValue();
        if (val <= 0) return '<span style="color:green; font-weight:bold;">Kârda</span>';
        return `<span style="color:red; font-weight:bold;">${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val)}</span>`;
    }, resizable: true, bottomCalc: "sum", bottomCalcFormatter: moneyCalcFormatter },

    { title: "Kullanılan GCAA", field: "selected_gcaa", width: 140, formatter: numberFormatter, resizable: true, bottomCalc: "avg", bottomCalcFormatter: numberCalcFormatter },
    { title: "Günlük Değer Artışı", field: "daily_value_gain", width: 160, formatter: moneyFormatter, resizable: true, bottomCalc: "sum", bottomCalcFormatter: moneyCalcFormatter },
    { title: "Günlük Maliyet", field: "daily_cost", width: 130, formatter: moneyFormatter, resizable: true, bottomCalc: "sum", bottomCalcFormatter: moneyCalcFormatter },
    { title: "Net Günlük Kâr", field: "net_daily_profit", width: 140, formatter: moneyFormatter, resizable: true, bottomCalc: "sum", bottomCalcFormatter: moneyCalcFormatter },
    
    { title: "Amortisman Günü", field: "days_to_recover", width: 140, resizable: true, bottomCalc: "avg", bottomCalcFormatter: (cell) => {
        const val = cell.getValue();
        if (isNaN(val) || val === 9999) return '-';
        return Math.round(val);
    }, formatter: (cell) => {
        const val = cell.getValue();
        if (val === 0) return '-';
        if (val === 9999) return 'Asla';
        return Math.round(val);
    }},
    { title: "Kâra Geçiş Tarihi", field: "recovery_date", width: 140, resizable: true },
  ], [dateMode]);

  const toggleGroup = (groupId) => {
      setSelectedGroups(prev => 
        prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId]
      );
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
        
        {/* Date Mode Selection */}
        <div className="flex items-center gap-6 pb-3 border-b border-gray-300">
            <span className="text-sm font-semibold text-gray-700">Tarih Modu:</span>
            <label className="flex items-center gap-2 cursor-pointer">
                <input 
                    type="radio" 
                    value="kayit" 
                    checked={dateMode === 'kayit'}
                    onChange={() => setDateMode('kayit')}
                    className="w-4 h-4 text-purple-600"
                />
                <span className="text-sm">Kayıt Tarihi İtibariyle (Baştan İtibaren)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
                <input 
                    type="radio" 
                    value="bugun" 
                    checked={dateMode === 'bugun'}
                    onChange={() => setDateMode('bugun')}
                    className="w-4 h-4 text-purple-600"
                />
                <span className="text-sm">Bugün İtibariyle (Mevcut Durum)</span>
            </label>
        </div>

        {/* GCAA Mode Selection */}
        <div className="flex items-center gap-6 pb-3 border-b border-gray-300">
            <span className="text-sm font-semibold text-gray-700">GCAA Modu:</span>
            <label className="flex items-center gap-2 cursor-pointer">
                <input 
                    type="radio" 
                    value="last" 
                    checked={gcaaMode === 'last'}
                    onChange={() => setGcaaMode('last')}
                    className="w-4 h-4 text-green-600"
                />
                <span className="text-sm">Son GCAA</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
                <input 
                    type="radio" 
                    value="custom" 
                    checked={gcaaMode === 'custom'}
                    onChange={() => setGcaaMode('custom')}
                    className="w-4 h-4 text-green-600"
                />
                <span className="text-sm">Özel GCAA</span>
            </label>
            {gcaaMode === 'custom' && (
                <input 
                    type="number" 
                    step="0.1"
                    value={customGcaa} 
                    onChange={e => setCustomGcaa(parseFloat(e.target.value) || 0)}
                    className="w-24 px-2 py-1 border rounded text-sm"
                    placeholder="GCAA"
                />
            )}
        </div>

        {/* Expense Mode Selection */}
        <div className="flex items-center gap-6 pb-3 border-b border-gray-300">
            <span className="text-sm font-semibold text-gray-700">Diğer Masraflar:</span>
            <label className="flex items-center gap-2 cursor-pointer">
                <input 
                    type="radio" 
                    value="last" 
                    checked={expenseMode === 'last'}
                    onChange={() => setExpenseMode('last')}
                    className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">Son Ay ({new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(lastMonthExpenses)})</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
                <input 
                    type="radio" 
                    value="custom" 
                    checked={expenseMode === 'custom'}
                    onChange={() => setExpenseMode('custom')}
                    className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">Özel Aylık</span>
            </label>
            {expenseMode === 'custom' && (
                <input 
                    type="number" 
                    value={customMonthlyExpense} 
                    onChange={e => setCustomMonthlyExpense(parseFloat(e.target.value) || 0)}
                    className="w-32 px-2 py-1 border rounded text-sm"
                    placeholder="Aylık TL"
                />
            )}
        </div>

        {/* Group Selector */}
        <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-semibold text-gray-700 mr-2">Gruplar:</span>
            {groups.map(g => (
                <button
                    key={g}
                    onClick={() => toggleGroup(g)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        selectedGroups.includes(g) 
                        ? 'bg-green-600 text-white' 
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                    }`}
                >
                    Grup {g}
                </button>
            ))}
            {groups.length === 0 && <span className="text-gray-500 text-sm">Grup bulunamadı.</span>}
            <button
                onClick={() => setSelectedGroups([])}
                className="ml-auto text-xs text-red-600 hover:underline"
                hidden={selectedGroups.length === 0}
            >
                Temizle
            </button>
        </div>

        {/* General Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Karkas Fiyatı (TL/kg)</label>
                <input 
                    type="number" 
                    value={carcassPrice} 
                    onChange={e => setCarcassPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Randıman (%)</label>
                <input 
                    type="number" 
                    value={yieldPercentage} 
                    onChange={e => setYieldPercentage(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                />
            </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
         <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <h3 className="text-blue-600 text-xs font-bold uppercase tracking-wide">Analiz Edilen Hayvan</h3>
            <p className="text-2xl font-bold text-gray-800 mt-1">{stats.count}</p>
         </div>
         <div className="bg-red-50 p-4 rounded-xl border border-red-100">
            <h3 className="text-red-600 text-xs font-bold uppercase tracking-wide">Kapanması Gereken Toplam Fark</h3>
            <p className="text-2xl font-bold text-gray-800 mt-1">
                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(stats.totalGap)}
            </p>
         </div>
         <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
            <h3 className="text-purple-600 text-xs font-bold uppercase tracking-wide">Ortalama Amortisman</h3>
            <p className="text-2xl font-bold text-gray-800 mt-1">
                {stats.totalGap <= 0 
                  ? 'Kârda' 
                  : (stats.avgDays === 9999 ? 'Asla (Zarar)' : `${Math.round(stats.avgDays)} Gün`)}
            </p>
         </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
        <ReactTabulator
            data={tableData}
            columns={columns}
            layout="fitColumns"
            options={{
                pagination: "local",
                paginationSize: 50,
                placeholder: "Kriterlere uygun veri bulunamadı.",
                height: "100%",
                layout:"fitDataFill",
                resizableColumns: true,
            }}
        />
      </div>
    </div>
  );
};

export default Projection2ReportView;
