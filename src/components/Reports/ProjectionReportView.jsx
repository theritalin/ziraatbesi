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

const ProjectionReportView = ({ animals, weighings, rations, feeds, costData, generalExpenses = [] }) => {
  // Inputs
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [targetWeight, setTargetWeight] = useState(725);
  const [carcassPrice, setCarcassPrice] = useState(560);
  const [yieldPercentage, setYieldPercentage] = useState(58);
  const [customGcaa, setCustomGcaa] = useState(1.5);
  const [gcaaMode, setGcaaMode] = useState('custom'); // 'last' or 'custom'
  const [projectionTarget, setProjectionTarget] = useState('weight'); // 'weight' or 'date'
  const [targetDateInput, setTargetDateInput] = useState(new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0]);

  // Other expenses settings
  const [expenseMode, setExpenseMode] = useState('last'); // 'last' or 'custom'
  const [customMonthlyExpense, setCustomMonthlyExpense] = useState(0);

  // Calculate last month's total expenses
  const lastMonthExpenses = useMemo(() => {
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const lastMonthTotal = generalExpenses
      .filter(exp => {
        const expDate = new Date(exp.expense_date);
        return expDate >= oneMonthAgo && expDate <= today;
      })
      .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    
    return lastMonthTotal;
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
    const uniqueGroups = [...new Set(animals.map(a => a.group_id).filter(Boolean))].sort((a, b) => a - b);
    return uniqueGroups;
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

  // Main Calculations
  const tableData = useMemo(() => {
    let filteredAnimals = animals;
    if (selectedGroups.length > 0) {
      filteredAnimals = animals.filter(a => selectedGroups.includes(a.group_id));
    }

    return filteredAnimals.map(animal => {
        const currentCost = costData.find(c => c.id === animal.id)?.total_cost || 0;
        const dailyRationCost = groupDailyCosts[animal.group_id] || 0;
        const dailyTotalCost = dailyRationCost + dailyOtherExpense;

        const animalWeighings = weighings
            .filter(w => w.animal_id === animal.id)
            .sort((a, b) => new Date(a.weigh_date) - new Date(b.weigh_date));
        
        // Get CURRENT weight from last weighing, not from animal.current_weight
        const lastWeighing = animalWeighings.length > 0 ? animalWeighings[animalWeighings.length - 1] : null;
        const currentWeight = lastWeighing ? lastWeighing.weight_kg : animal.current_weight || 0;
        
        // Last GCAA
        let lastGcaa = 0;
        if (animalWeighings.length >= 2) {
            const last = animalWeighings[animalWeighings.length - 1];
            const prev = animalWeighings[animalWeighings.length - 2];
            const d = (new Date(last.weigh_date) - new Date(prev.weigh_date)) / (1000 * 60 * 60 * 24);
            if (d > 0) lastGcaa = (last.weight_kg - prev.weight_kg) / d;
        }

        // Select GCAA based on mode
        const selectedGcaa = gcaaMode === 'last' ? (lastGcaa > 0 ? lastGcaa : 0.001) : (customGcaa > 0 ? customGcaa : 0.001);
        
        let daysToTarget = 0;
        let finalWeight = currentWeight;
        let targetDateObj = new Date();
        let weightToGain = 0;

        if (projectionTarget === 'weight') {
             weightToGain = Math.max(0, targetWeight - currentWeight);
             daysToTarget = weightToGain / selectedGcaa;
             targetDateObj.setDate(targetDateObj.getDate() + Math.round(daysToTarget));
             finalWeight = targetWeight;
        } else {
             // Date mode
             const target = new Date(targetDateInput);
             const today = new Date();
             // Reset hours to compare dates properly
             target.setHours(0,0,0,0);
             today.setHours(0,0,0,0);
             
             const diffTime = target - today;
             const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
             daysToTarget = Math.max(0, diffDays);
             
             weightToGain = daysToTarget * selectedGcaa;
             finalWeight = currentWeight + weightToGain;
             targetDateObj = target;
        }

        const costToTarget = daysToTarget * dailyTotalCost;
        const totalCostAtTarget = currentCost + costToTarget;
        
        const futureCarcassValue = finalWeight * (yieldPercentage / 100) * carcassPrice;
        const profit = futureCarcassValue - totalCostAtTarget;

        return {
            id: animal.id,
            tag_number: animal.tag_number,
            group_id: animal.group_id,
            current_weight: currentWeight,
            daily_cost: dailyTotalCost,
            current_cost: currentCost,
            gcaa: gcaaMode === 'last' ? lastGcaa : customGcaa,
            days_to_target: Math.round(daysToTarget),
            target_date: targetDateObj.toLocaleDateString('tr-TR'),
            final_weight: finalWeight,
            cost_to_target: costToTarget,
            future_carcass_value: futureCarcassValue,
            profit: profit,
        };
    });

  }, [animals, weighings, costData, groupDailyCosts, selectedGroups, targetWeight, carcassPrice, yieldPercentage, customGcaa, gcaaMode, dailyOtherExpense, projectionTarget, targetDateInput]);

  const stats = useMemo(() => {
    if (tableData.length === 0) return { count: 0, avgProfit: 0, totalProfit: 0 };
    const totalProfit = tableData.reduce((sum, item) => sum + item.profit, 0);
    return {
        count: tableData.length,
        avgProfit: totalProfit / tableData.length,
        totalProfit
    };
  }, [tableData]);

  const columns = useMemo(() => [
    { 
        title: "Küpe", 
        field: "tag_number", 
        width: 120, 
        headerFilter: "input", 
        frozen: true,
          resizable: true,
        
    },
    { 
        title: "Grup", 
        field: "group_id", 
        width: 80,
        resizable: true
    },
    { 
        title: "Mevcut (kg)", 
        field: "current_weight", 
        sorter: "number", 
        width: 110, 
        formatter: numberFormatter,
        resizable: true,
        bottomCalc: "avg",
        bottomCalcFormatter: numberCalcFormatter
    },
    { 
        title: "Günlük Maliyet", 
        field: "daily_cost", 
        sorter: "number", 
        formatter: moneyFormatter, 
        width: 130,
        resizable: true,
        bottomCalc: "avg",
        bottomCalcFormatter: moneyCalcFormatter,
        
    },
    { 
        title: "Şu Anki Maliyet", 
        field: "current_cost", 
        sorter: "number", 
        formatter: moneyFormatter, 
        width: 140,
        resizable: true,
        bottomCalc: "sum",
        bottomCalcFormatter: moneyCalcFormatter,
       
    },
    { 
        title: gcaaMode === 'last' ? "Son GCAA" : "GCAA", 
        field: "gcaa", 
        sorter: "number", 
        formatter: numberFormatter, 
        width: 100,
        resizable: true,
        bottomCalc: "avg",
        bottomCalcFormatter: numberCalcFormatter,
       
    },
    { 
        title: "Kalan Gün", 
        field: "days_to_target", 
        sorter: "number", 
        width: 100,
        resizable: true,
        bottomCalc: "avg",
        bottomCalcFormatter: (cell) => {
            const val = cell.getValue();
            if (val === null || val === undefined) return '-';
            const num = parseFloat(val);
            if (isNaN(num)) return '-';
            return Math.round(num);
        }
    },
    { 
        title: "Tahmini Son Kilo", 
        field: "final_weight", 
        sorter: "number", 
        width: 130, 
        formatter: numberFormatter,
        resizable: true,
        bottomCalc: "avg",
        bottomCalcFormatter: numberCalcFormatter,
       
    },
    { 
        title: "Bitiş Tarihi", 
        field: "target_date", 
        sorter: "string", 
        width: 110, 
        formatter: dateFormatter,
        resizable: true,
        
    },
    { 
        title: "Ek Masraf", 
        field: "cost_to_target", 
        sorter: "number", 
        formatter: moneyFormatter, 
        width: 120,
        resizable: true,
        bottomCalc: "sum",
        bottomCalcFormatter: moneyCalcFormatter
    },
    { 
        title: "Karkas Değeri", 
        field: "future_carcass_value", 
        sorter: "number", 
        formatter: moneyFormatter, 
        width: 130,
        resizable: true,
        bottomCalc: "sum",
        bottomCalcFormatter: moneyCalcFormatter,
        
    },
    { 
        title: "Kar", 
        field: "profit", 
        sorter: "number", 
        formatter: moneyFormatter, 
        width: 120,
        resizable: true,
        bottomCalc: "sum", 
        bottomCalcFormatter: moneyCalcFormatter,
       
    },
  ], [gcaaMode]);

  const toggleGroup = (groupId) => {
      setSelectedGroups(prev => 
        prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId]
      );
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Controls */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
        {/* Projection Target Selection */}
        <div className="flex items-center gap-6 pb-3 border-b border-gray-300">
            <span className="text-sm font-semibold text-gray-700">Hesaplama Hedefi:</span>
            <label className="flex items-center gap-2 cursor-pointer">
                <input 
                    type="radio" 
                    name="projectionTarget" 
                    value="weight" 
                    checked={projectionTarget === 'weight'}
                    onChange={() => setProjectionTarget('weight')}
                    className="w-4 h-4 text-purple-600"
                />
                <span className="text-sm">Hedef Ağırlık</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
                <input 
                    type="radio" 
                    name="projectionTarget" 
                    value="date" 
                    checked={projectionTarget === 'date'}
                    onChange={() => setProjectionTarget('date')}
                    className="w-4 h-4 text-purple-600"
                />
                <span className="text-sm">Hedef Tarih</span>
            </label>
        </div>

        {/* GCAA Mode Selection */}
        <div className="flex items-center gap-6 pb-3 border-b border-gray-300">
            <span className="text-sm font-semibold text-gray-700">Hesaplama Yöntemi:</span>
            <label className="flex items-center gap-2 cursor-pointer">
                <input 
                    type="radio" 
                    name="gcaaMode" 
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
                    name="gcaaMode" 
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
                    name="expenseMode" 
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
                    name="expenseMode" 
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

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                {projectionTarget === 'weight' ? (
                    <>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Hedef Ağırlık (kg)</label>
                        <input 
                            type="number" 
                            value={targetWeight} 
                            onChange={e => setTargetWeight(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border rounded-md text-sm"
                        />
                    </>
                ) : (
                    <>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Hedef Tarih</label>
                        <input 
                            type="date" 
                            value={targetDateInput} 
                            onChange={e => setTargetDateInput(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md text-sm"
                        />
                    </>
                )}
            </div>
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
         <div className="bg-green-50 p-4 rounded-xl border border-green-100">
            <h3 className="text-green-600 text-xs font-bold uppercase tracking-wide">Ort. Kar</h3>
            <p className="text-2xl font-bold text-gray-800 mt-1">
                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(stats.avgProfit)}
            </p>
         </div>
         <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
            <h3 className="text-purple-600 text-xs font-bold uppercase tracking-wide">Toplam Kar</h3>
            <p className="text-2xl font-bold text-gray-800 mt-1">
                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(stats.totalProfit)}
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

export default ProjectionReportView;
