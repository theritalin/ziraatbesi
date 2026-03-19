import React, { useMemo, useState } from 'react';
import { FiPrinter, FiCalendar, FiDollarSign, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const CATEGORY_COLORS = {
  'Market': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', bar: 'bg-orange-500', icon: '🛒' },
  'Fatura': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', bar: 'bg-blue-500', icon: '📄' },
  'Personel': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', bar: 'bg-purple-500', icon: '👷' },
  'Bakım/Onarım': { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', bar: 'bg-yellow-500', icon: '🔧' },
  'Yem (Dış Alım)': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', bar: 'bg-green-500', icon: '🌾' },
  'Diğer': { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', bar: 'bg-gray-500', icon: '📦' },
};

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const formatCurrency = (value) => {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
};

const MonthlyExpenseReportView = ({ generalExpenses }) => {
  // Extract available years from data
  const availableYears = useMemo(() => {
    const years = new Set();
    generalExpenses.forEach(exp => {
      if (exp.expense_date) {
        years.add(new Date(exp.expense_date).getFullYear());
      }
    });
    const sorted = Array.from(years).sort((a, b) => b - a);
    return sorted.length > 0 ? sorted : [new Date().getFullYear()];
  }, [generalExpenses]);

  const [selectedYear, setSelectedYear] = useState(availableYears[0]);
  const [selectedMonth, setSelectedMonth] = useState(null); // null = overview, 0-11 = specific month

  // Group expenses by month and category for selected year
  const monthlyData = useMemo(() => {
    const months = {};

    generalExpenses.forEach(exp => {
      if (!exp.expense_date) return;
      const date = new Date(exp.expense_date);
      if (date.getFullYear() !== selectedYear) return;

      const monthKey = date.getMonth(); // 0-11
      if (!months[monthKey]) {
        months[monthKey] = {
          month: monthKey,
          total: 0,
          categories: {},
          records: []
        };
      }

      const category = exp.category || 'Diğer';
      months[monthKey].total += parseFloat(exp.amount) || 0;
      months[monthKey].categories[category] = (months[monthKey].categories[category] || 0) + (parseFloat(exp.amount) || 0);
      months[monthKey].records.push(exp);
    });

    return months;
  }, [generalExpenses, selectedYear]);

  // Year total
  const yearTotal = useMemo(() => {
    return Object.values(monthlyData).reduce((sum, m) => sum + m.total, 0);
  }, [monthlyData]);

  // Category totals for year
  const yearCategoryTotals = useMemo(() => {
    const totals = {};
    Object.values(monthlyData).forEach(m => {
      Object.entries(m.categories).forEach(([cat, amount]) => {
        totals[cat] = (totals[cat] || 0) + amount;
      });
    });
    return totals;
  }, [monthlyData]);

  // Selected month detail
  const selectedMonthData = selectedMonth !== null ? monthlyData[selectedMonth] : null;

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-6xl mx-auto print:shadow-none print:w-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FiDollarSign className="text-green-600" />
            Aylık Genel Gider Raporu
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Genel giderlerin aylık ve kategori bazlı dağılımı
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Year Selector */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => {
                const idx = availableYears.indexOf(selectedYear);
                if (idx < availableYears.length - 1) {
                  setSelectedYear(availableYears[idx + 1]);
                  setSelectedMonth(null);
                }
              }}
              disabled={availableYears.indexOf(selectedYear) >= availableYears.length - 1}
              className="p-1.5 rounded-md hover:bg-white disabled:opacity-30 transition-colors"
            >
              <FiChevronLeft size={18} />
            </button>
            <span className="px-3 py-1 font-bold text-gray-800 min-w-[60px] text-center">
              {selectedYear}
            </span>
            <button
              onClick={() => {
                const idx = availableYears.indexOf(selectedYear);
                if (idx > 0) {
                  setSelectedYear(availableYears[idx - 1]);
                  setSelectedMonth(null);
                }
              }}
              disabled={availableYears.indexOf(selectedYear) <= 0}
              className="p-1.5 rounded-md hover:bg-white disabled:opacity-30 transition-colors"
            >
              <FiChevronRight size={18} />
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <FiPrinter /> Yazdır
          </button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center border-b-2 border-gray-800 pb-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">AYLIK GENEL GİDER RAPORU</h1>
        <p className="text-gray-600 mt-1">{selectedYear} Yılı • Rapor Tarihi: {new Date().toLocaleDateString('tr-TR')}</p>
      </div>

      {/* Year Total Card */}
      <div className="bg-green-50 p-5 rounded-lg border border-green-200 text-center mb-6">
        <div className="text-sm text-green-600 font-medium uppercase tracking-wide">{selectedYear} Yılı Toplam Gider</div>
        <div className="text-3xl font-bold text-green-900 mt-1">{formatCurrency(yearTotal)}</div>
      </div>

      {/* Year Category Distribution */}
      {Object.keys(yearCategoryTotals).length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Yıllık Kategori Dağılımı</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(yearCategoryTotals)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, amount]) => {
                const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS['Diğer'];
                const percentage = yearTotal > 0 ? ((amount / yearTotal) * 100).toFixed(1) : 0;
                return (
                  <div key={cat} className={`${colors.bg} ${colors.border} border rounded-lg p-3 text-center`}>
                    <div className="text-xl mb-1">{colors.icon}</div>
                    <div className={`text-xs font-semibold ${colors.text} truncate`}>{cat}</div>
                    <div className={`text-base font-bold ${colors.text} mt-1`}>{formatCurrency(amount)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">%{percentage}</div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Month back button if viewing detail */}
      {selectedMonth !== null && (
        <button
          onClick={() => setSelectedMonth(null)}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-4 print:hidden transition-colors"
        >
          <FiChevronLeft size={16} />
          Tüm Aylara Dön
        </button>
      )}

      {/* Monthly Overview Grid (when no month selected) */}
      {selectedMonth === null && (
        <div>
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Aylık Özet</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {MONTH_NAMES.map((name, idx) => {
              const data = monthlyData[idx];
              const total = data?.total || 0;
              const hasData = !!data;
              const maxMonthTotal = Math.max(...Object.values(monthlyData).map(m => m.total), 1);
              const barWidth = total > 0 ? Math.max(5, (total / maxMonthTotal) * 100) : 0;

              return (
                <div
                  key={idx}
                  onClick={() => hasData && setSelectedMonth(idx)}
                  className={`rounded-lg border p-4 transition-all ${
                    hasData
                      ? 'border-gray-200 hover:border-green-400 hover:shadow-md cursor-pointer'
                      : 'border-dashed border-gray-200 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FiCalendar className="text-gray-400" size={14} />
                    <span className="text-sm font-semibold text-gray-700">{name}</span>
                  </div>
                  <div className={`text-lg font-bold ${hasData ? 'text-gray-900' : 'text-gray-400'}`}>
                    {formatCurrency(total)}
                  </div>
                  {hasData && (
                    <>
                      <div className="mt-2 w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        {Object.keys(data.categories).length} kategori • {data.records.length} kayıt
                      </div>
                    </>
                  )}
                  {!hasData && (
                    <div className="mt-2 text-xs text-gray-400">Kayıt yok</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly Detail View (when a month is selected) */}
      {selectedMonth !== null && selectedMonthData && (
        <div className="space-y-6">
          {/* Month Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800">
              {MONTH_NAMES[selectedMonth]} {selectedYear}
            </h3>
            <span className="text-lg font-bold text-green-700 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
              {formatCurrency(selectedMonthData.total)}
            </span>
          </div>

          {/* Category Breakdown with Bars */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Kategori Kırılımı</h4>
            {Object.entries(selectedMonthData.categories)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, amount]) => {
                const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS['Diğer'];
                const percentage = selectedMonthData.total > 0 ? ((amount / selectedMonthData.total) * 100) : 0;
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <div className="w-32 sm:w-40 flex items-center gap-2 shrink-0">
                      <span className="text-lg">{colors.icon}</span>
                      <span className="text-sm font-medium text-gray-700 truncate">{cat}</span>
                    </div>
                    <div className="flex-1">
                      <div className="w-full bg-gray-100 rounded-full h-6 relative overflow-hidden">
                        <div
                          className={`${colors.bar} h-6 rounded-full transition-all flex items-center justify-end pr-2`}
                          style={{ width: `${Math.max(percentage, 3)}%` }}
                        >
                          {percentage > 15 && (
                            <span className="text-xs text-white font-medium">%{percentage.toFixed(1)}</span>
                          )}
                        </div>
                        {percentage <= 15 && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-600 font-medium">%{percentage.toFixed(1)}</span>
                        )}
                      </div>
                    </div>
                    <div className="w-28 text-right font-semibold text-sm text-gray-800 shrink-0">
                      {formatCurrency(amount)}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Detail Table */}
          <div>
            <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">İşlem Detayları</h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-4 py-2.5">Tarih</th>
                    <th className="px-4 py-2.5">Kategori</th>
                    <th className="px-4 py-2.5">Açıklama</th>
                    <th className="px-4 py-2.5 text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...selectedMonthData.records]
                    .sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date))
                    .map((record, idx) => {
                      const cat = record.category || 'Diğer';
                      const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS['Diğer'];
                      return (
                        <tr key={record.id || idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-gray-600">
                            {new Date(record.expense_date).toLocaleDateString('tr-TR')}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text} ${colors.border} border`}>
                              {colors.icon} {cat}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 italic">{record.description || '-'}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                            {formatCurrency(parseFloat(record.amount) || 0)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot className="bg-gray-50 font-semibold">
                  <tr>
                    <td colSpan={3} className="px-4 py-2.5 text-right text-gray-700">Toplam:</td>
                    <td className="px-4 py-2.5 text-right text-green-700">{formatCurrency(selectedMonthData.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {selectedMonth !== null && !selectedMonthData && (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          Bu ay için gider kaydı bulunmamaktadır.
        </div>
      )}

      {generalExpenses.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          Kayıtlı genel gider bulunmamaktadır.
        </div>
      )}
    </div>
  );
};

export default MonthlyExpenseReportView;
