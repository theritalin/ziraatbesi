import React, { useState, useMemo, useEffect } from 'react';
import { ReactTabulator } from 'react-tabulator';
import 'react-tabulator/lib/styles.css';
import 'react-tabulator/lib/css/tabulator.min.css';
import { FiCalendar, FiPrinter } from 'react-icons/fi';

const WeighingDayReportView = ({ animals, weighings }) => {
  // 1. Extract unique dates from weighings, sorted descending
  const availableDates = useMemo(() => {
    const dates = [...new Set(weighings.map(w => w.weigh_date))];
    return dates.sort((a, b) => new Date(b) - new Date(a));
  }, [weighings]);

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedRows, setSelectedRows] = useState([]); // Selected rows state

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
    const currentWeighings = weighings.filter(w => w.weigh_date === selectedDate);

    return currentWeighings.map(curr => {
      const animal = animals.find(a => a.id === curr.animal_id);
      if (!animal) return null;

      // Get all weighings for this animal, sorted by date
      const animalWeighings = weighings
        .filter(w => w.animal_id === curr.animal_id)
        .sort((a, b) => new Date(a.weigh_date) - new Date(b.weigh_date));

      // Find current index
      const currentIndex = animalWeighings.findIndex(w => w.id === curr.id); // Assuming ID is unique, or match by date
      
      // Previous Weighing
      const prevWeighing = currentIndex > 0 ? animalWeighings[currentIndex - 1] : null;
      
      // First Weighing (Registration)
      const firstWeighing = animalWeighings[0];

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

      return {
        id: curr.id,
        tag_number: animal.tag_number,
        current_weight: curr.weight_kg,
        
        prev_date: prevWeighing ? prevWeighing.weigh_date : '-',
        prev_weight: prevWeighing ? prevWeighing.weight_kg : '-',
        
        days_diff: daysDiff,
        weight_gain: weightGain !== '-' ? weightGain.toFixed(2) : '-',
        
        first_date: firstWeighing ? firstWeighing.weigh_date : '-',
        first_weight: firstWeighing ? firstWeighing.weight_kg : '-',
        
        total_gcaa: totalGcaa,
        period_gcaa: periodGcaa
      };
    }).filter(item => item !== null);
  }, [selectedDate, weighings, animals]);

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

    return {
      count,
      avgWeight: (totalWeight / count).toFixed(2),
      avgGain: gainItems.length > 0 ? (totalGain / gainItems.length).toFixed(2) : '0.00',
      avgGcaa: gcaaItems.length > 0 ? (totalGcaa / gcaaItems.length).toFixed(3) : '0.000',
      isFiltered: selectedRows.length > 0
    };
  }, [reportData, selectedRows]);

  // 4. Columns
  const columns = [
    { formatter: "rowSelection", titleFormatter: "rowSelection", align: "center", headerSort: false, width: 40 }, // Selection column
    { title: "Küpe No", field: "tag_number", sorter: "string", headerFilter: "input", widthGrow: 1.5 },
    { title: "Tartım Kilosu", field: "current_weight", sorter: "number", widthGrow: 1 },
    { title: "Önceki Tarih", field: "prev_date", sorter: "string", widthGrow: 1.2 },
    { title: "Önceki Kilo", field: "prev_weight", sorter: "number", widthGrow: 1 },
    { title: "Gün Farkı", field: "days_diff", sorter: "number", widthGrow: 0.8 },
    { title: "Kilo Artışı", field: "weight_gain", sorter: "number", widthGrow: 1, formatter: (cell) => {
        const val = cell.getValue();
        if(val === '-') return '-';
        return `<span style="color:${val >= 0 ? 'green' : 'red'}">${val}</span>`;
    }},
    { title: "İlk Kayıt Tarihi", field: "first_date", sorter: "string", widthGrow: 1.2 },
    { title: "İlk Kayıt Kilo", field: "first_weight", sorter: "number", widthGrow: 1 },
    { title: "Genel GCAA", field: "total_gcaa", sorter: "number", widthGrow: 1 },
    { title: "Dönem GCAA", field: "period_gcaa", sorter: "number", widthGrow: 1, formatter: (cell) => {
        const val = cell.getValue();
        if(val === '-') return '-';
        const num = parseFloat(val);
        let color = 'black';
        if(num > 1.2) color = 'green';
        else if(num < 0.8) color = 'red';
        return `<span style="color:${color}; font-weight:bold;">${val}</span>`;
    }},
  ];

  const handlePrint = () => {
    window.print();
  };

  // Tabulator Options for Selection
  const options = {
    pagination: "local",
    paginationSize: 20,
    movableColumns: true,
    placeholder: "Veri bulunamadı",
    height: "100%",
    headerWordWrap: true,
    tooltipsHeader: true,
    headerSort: true,
    selectable: true, // Enable selection
  };

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
              className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none"
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
        
        <div className="flex flex-col items-center">
            <h2 className="text-xl font-bold text-gray-800">GÜNLÜK TARTIM RAPORU</h2>
            <p className="text-gray-500">Tarih: {selectedDate ? new Date(selectedDate).toLocaleDateString('tr-TR') : '-'}</p>
        </div>

        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiPrinter />
          Yazdır
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
      </div>

      {/* Table */}
      <div className="flex-1 bg-white shadow-md rounded-lg overflow-hidden p-4">
        {reportData.length > 0 ? (
            <ReactTabulator
            data={reportData}
            columns={columns}
            layout="fitColumns"
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
