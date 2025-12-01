import React, { useState, useEffect, useCallback } from 'react';
import { useFarmId } from '../hooks/useFarmId';
import { supabase } from '../supabaseClient';
import Toast from '../components/UI/Toast';
import { FiDollarSign, FiSave, FiTrash2 } from 'react-icons/fi';
import { ReactTabulator } from 'react-tabulator';
import 'react-tabulator/lib/styles.css';
import 'react-tabulator/css/bootstrap/tabulator_bootstrap.min.css';

const ExpensesPage = () => {
  const { farmId } = useFarmId();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Form State
  const [category, setCategory] = useState('Market');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  const categories = ['Market', 'Fatura', 'Personel', 'Bakım/Onarım', 'Yem (Dış Alım)', 'Diğer'];

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const fetchExpenses = useCallback(async () => {
    if (!farmId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('general_expenses')
        .select('*')
        .eq('farm_id', farmId)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Error:', error);
      showToast('Giderler yüklenirken hata oluştu', 'error');
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    if (farmId) {
      fetchExpenses();
    }
  }, [farmId, fetchExpenses]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!farmId) throw new Error('Çiftlik bulunamadı');

      const { error } = await supabase
        .from('general_expenses')
        .insert([{
          farm_id: farmId,
          category,
          amount: parseFloat(amount),
          expense_date: expenseDate,
          description
        }]);

      if (error) throw error;

      showToast('Gider başarıyla kaydedildi', 'success');
      setAmount('');
      setDescription('');
      fetchExpenses();

    } catch (error) {
      console.error('Error saving expense:', error);
      showToast('Kaydetme başarısız: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu gider kaydını silmek istediğinize emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('general_expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast('Gider silindi', 'success');
      fetchExpenses();
    } catch (error) {
      console.error('Error deleting:', error);
      showToast('Silme işlemi başarısız', 'error');
    }
  };

  const columns = [
    { title: "Tarih", field: "expense_date", sorter: "string", width: 120 },
    { title: "Kategori", field: "category", sorter: "string", headerFilter: "select", headerFilterParams: { values: categories } },
    { title: "Tutar (TL)", field: "amount", sorter: "number", formatter: "money", formatterParams: { symbol: "₺", precision: 2 } },
    { title: "Açıklama", field: "description", sorter: "string", headerFilter: "input" },
    { 
      title: "İşlem", 
      field: "actions", 
      formatter: (cell) => `<button class="text-red-600 hover:text-red-800"><i class="fi fi-trash"></i> Sil</button>`,
      cellClick: (e, cell) => handleDelete(cell.getRow().getData().id),
      headerSort: false,
      width: 100,
      hozAlign: "center"
    }
  ];

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
          <FiDollarSign /> Genel Giderler
        </h1>
        <p className="mt-1 text-sm sm:text-base text-gray-600">Çiftlik genel giderlerini (fatura, personel, vb.) buradan takip edin.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">Yeni Gider Ekle</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tutar (TL)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tarih</label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                <FiSave />
                Kaydet
              </button>
            </form>
          </div>
        </div>

        {/* List Section */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow-md rounded-lg p-6 h-full flex flex-col">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">Gider Listesi</h2>
            <div className="flex-1 overflow-auto">
              {expenses.length > 0 ? (
                <ReactTabulator
                  data={expenses}
                  columns={columns}
                  layout="fitColumns"
                  options={{
                    pagination: "local",
                    paginationSize: 10,
                    placeholder: "Gider kaydı bulunamadı",
                  }}
                />
              ) : (
                <div className="text-center text-gray-500 py-8">Henüz gider kaydı bulunmamaktadır.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpensesPage;
