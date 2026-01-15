import React, { useMemo } from 'react';
import { FiPrinter } from 'react-icons/fi';

const TotalVeterinaryReportView = ({ veterinaryRecords, animals }) => {
  // Use all records
  const allRecords = useMemo(() => {
    return [...veterinaryRecords].sort((a, b) => new Date(b.process_date) - new Date(a.process_date));
  }, [veterinaryRecords]);

  // Group records by date
  const groupedRecords = useMemo(() => {
    const groups = {};
    allRecords.forEach(record => {
      const date = record.process_date;
      if (!groups[date]) {
        groups[date] = {
             date: date,
             records: [],
             dailyTotal: 0
        };
      }
      groups[date].records.push(record);
      groups[date].dailyTotal += (parseFloat(record.cost) || 0);
    });
    // Return array sorted by date descending
    return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [allRecords]);

  // Calculate grand total cost
  const grandTotal = useMemo(() => {
    return allRecords.reduce((sum, record) => sum + (parseFloat(record.cost) || 0), 0);
  }, [allRecords]);

  // Helper to get animal tag
  const getAnimalTag = (animalId) => {
    const animal = animals.find(a => a.id === animalId);
    return animal ? animal.tag_number : 'Bilinmiyor';
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-5xl mx-auto print:shadow-none print:w-full">
      {/* Header & Controls */}
      <div className="flex justify-between items-center mb-8 print:hidden">
         <div>
            <h2 className="text-xl font-bold text-gray-800">Veteriner Geçmişi (Tümü)</h2>
            <p className="text-sm text-gray-500">{allRecords.length} işlem kaydı bulundu.</p>
         </div>
         <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <FiPrinter /> Yazdır
          </button>
      </div>

      {/* Report Content */}
      <div className="space-y-8">
        {/* Title for Print */}
        <div className="hidden print:block text-center border-b-2 border-gray-800 pb-4 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">GENEL VETERİNER RAPORU</h1>
          <p className="text-gray-600 mt-1">
            Rapor Tarihi: {new Date().toLocaleDateString('tr-TR')}
          </p>
        </div>

        {/* Grand Total Card */}
        <div className="bg-green-50 p-6 rounded-lg border border-green-200 text-center mb-8">
            <div className="text-sm text-green-600 font-medium uppercase tracking-wide">Genel Toplam Maliyet</div>
            <div className="text-4xl font-bold text-green-900 mt-2">
              {grandTotal.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
            </div>
        </div>

        {/* Daily Groups */}
        <div className="space-y-8">
            {groupedRecords.map((group) => (
                <div key={group.date} className="break-inside-avoid">
                    <div className="flex justify-between items-end border-b-2 border-gray-200 pb-2 mb-3">
                        <h3 className="text-lg font-bold text-gray-800">
                            {new Date(group.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </h3>
                        <span className="text-sm font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                            Günlük Toplam: {group.dailyTotal.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                        </span>
                    </div>

                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-700">
                            <tr>
                                <th className="px-4 py-2 w-24">Küpe No</th>
                                <th className="px-4 py-2">İşlem</th>
                                <th className="px-4 py-2">Notlar</th>
                                <th className="px-4 py-2 text-right w-32">Maliyet</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                            {group.records.map((record, idx) => (
                                <tr key={record.id || idx} className="hover:bg-gray-50">
                                <td className="px-4 py-2 font-medium text-gray-900">{getAnimalTag(record.animal_id)}</td>
                                <td className="px-4 py-2 text-gray-800">{record.procedure_name}</td>
                                <td className="px-4 py-2 text-gray-500 italic">{record.notes || '-'}</td>
                                <td className="px-4 py-2 text-right font-medium text-gray-900">
                                    {parseFloat(record.cost).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>

         {allRecords.length === 0 && (
             <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                 Kayıtlı veteriner işlemi bulunmamaktadır.
             </div>
         )}
      </div>
    </div>
  );
};

export default TotalVeterinaryReportView;
