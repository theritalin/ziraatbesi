import React, { useState, useMemo } from 'react';
import { FiCalendar, FiPrinter } from 'react-icons/fi';

const DailyVeterinaryView = ({ veterinaryRecords, animals }) => {
  // Default to today
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Filter records for the selected date
  const dailyRecords = useMemo(() => {
    if (!selectedDate) return [];
    return veterinaryRecords.filter(record => record.process_date === selectedDate);
  }, [veterinaryRecords, selectedDate]);

  // Calculate total cost for the day
  const totalCost = useMemo(() => {
    return dailyRecords.reduce((sum, record) => sum + (parseFloat(record.cost) || 0), 0);
  }, [dailyRecords]);

  // Helper to get animal tag
  const getAnimalTag = (animalId) => {
    const animal = animals.find(a => a.id === animalId);
    return animal ? animal.tag_number : 'Bilinmiyor';
  };

  // Get unique dates with records
  const availableDates = useMemo(() => {
    const dates = [...new Set(veterinaryRecords.map(r => r.process_date))];
    return dates.sort((a, b) => new Date(b) - new Date(a)); // Descending order
  }, [veterinaryRecords]);

  // Set initial date to the most recent one if available, otherwise today
  React.useEffect(() => {
    if (availableDates.length > 0 && !availableDates.includes(selectedDate)) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableDates]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-5xl mx-auto print:shadow-none print:w-full">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 print:hidden">
        <div className="w-full md:w-1/3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Tarih Seçin</label>
          <div className="relative">
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md border"
            >
              {availableDates.length > 0 ? (
                availableDates.map(date => (
                  <option key={date} value={date}>
                    {new Date(date).toLocaleDateString('tr-TR')}
                  </option>
                ))
              ) : (
                <option value="">Kayıt bulunamadı</option>
              )}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <FiCalendar className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>
        
        {dailyRecords.length > 0 && (
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <FiPrinter /> Yazdır
          </button>
        )}
      </div>

      {/* Report Content */}
      <div className="space-y-6">
        {/* Title */}
        <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">GÜNLÜK VETERİNER RAPORU</h1>
          <p className="text-gray-600 mt-1">
            Tarih: {new Date(selectedDate).toLocaleDateString('tr-TR')}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-600 font-medium">Toplam İşlem Sayısı</div>
            <div className="text-2xl font-bold text-blue-900">{dailyRecords.length}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="text-sm text-green-600 font-medium">Toplam Maliyet</div>
            <div className="text-2xl font-bold text-green-900">
              {totalCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
            </div>
          </div>
        </div>

        {/* Records Table */}
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="px-4 py-3">Küpe No</th>
                <th className="px-4 py-3">İşlem</th>
                <th className="px-4 py-3">Notlar</th>
                <th className="px-4 py-3 text-right">Maliyet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {dailyRecords.map((record, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{getAnimalTag(record.animal_id)}</td>
                  <td className="px-4 py-3">{record.procedure_name}</td>
                  <td className="px-4 py-3 text-gray-500">{record.notes || '-'}</td>
                  <td className="px-4 py-3 text-right font-bold">
                    {parseFloat(record.cost).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                  </td>
                </tr>
              ))}
              {dailyRecords.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                    Bu tarihte kayıtlı veteriner işlemi bulunmamaktadır.
                  </td>
                </tr>
              )}
            </tbody>
            {dailyRecords.length > 0 && (
              <tfoot className="bg-gray-100 font-bold">
                <tr>
                  <td colSpan="3" className="px-4 py-3 text-right">GENEL TOPLAM:</td>
                  <td className="px-4 py-3 text-right text-green-700">
                    {totalCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default DailyVeterinaryView;
