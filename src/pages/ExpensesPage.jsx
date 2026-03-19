import React, { useState, useEffect, useCallback } from 'react';
import { useFarmId } from '../hooks/useFarmId';
import { supabase } from '../supabaseClient';
import Toast from '../components/UI/Toast';
import { FiDollarSign, FiSave, FiTrash2 } from 'react-icons/fi';
import { ReactTabulator } from 'react-tabulator';
import 'react-tabulator/lib/styles.css';
import 'react-tabulator/css/bootstrap/tabulator_bootstrap.min.css';

const ExpensesPage = () => {
  const { farmId, permissions, userRole } = useFarmId();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const canEdit = userRole === 'admin' || permissions?.expenses === 'edit';

  // Form State
  const [category, setCategory] = useState('Market');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [partnerId, setPartnerId] = useState('');
  const [partners, setPartners] = useState([]);

  const categories = ['Market', 'Fatura', 'Personel', 'Bakım/Onarım', 'Yem (Dış Alım)', 'Faiz', 'Diğer'];

  const PAYMENT_METHODS = [
    { value: 'cash', label: 'Nakit (Şirket Kasası)' },
    { value: 'bank_transfer', label: 'Banka Havale/EFT' },
    { value: 'credit_card', label: 'Kredi Kartı' },
    { value: 'personal_account', label: 'Kişisel Hesaptan (Ortak Ödedi)' },
  ];

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const fetchData = useCallback(async () => {
    if (!farmId) return;

    try {
      setLoading(true);
      const [expensesRes, partnersRes] = await Promise.all([
        supabase.from('general_expenses').select('*').eq('farm_id', farmId).order('expense_date', { ascending: false }),
        supabase.from('partners').select('*').eq('farm_id', farmId).eq('is_active', true).order('name')
      ]);

      if (expensesRes.error) throw expensesRes.error;
      if (partnersRes.error) throw partnersRes.error;

      setExpenses(expensesRes.data || []);
      setPartners(partnersRes.data || []);
    } catch (error) {
      console.error('Error:', error);
      showToast('Veriler yüklenirken hata oluştu', 'error');
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    if (farmId) {
      fetchData();
    }
  }, [farmId, fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (paymentMethod === 'personal_account' && !partnerId) {
      showToast('Kişisel hesap seçiminde ortak belirtmek zorunludur', 'error');
      return;
    }
    setLoading(true);

    try {
      if (!farmId) throw new Error('Çiftlik bulunamadı');

      const expenseData = {
        farm_id: farmId,
        category,
        amount: parseFloat(amount),
        expense_date: expenseDate,
        description
      };

      const { data: insertedExpense, error } = await supabase
        .from('general_expenses')
        .insert([expenseData])
        .select()
        .single();

      if (error) throw error;

      // Auto-sync to accounting_transactions
      const isPersonal = paymentMethod === 'personal_account';
      await supabase.from('accounting_transactions').insert([{
        farm_id: farmId,
        transaction_date: expenseDate,
        type: 'expense',
        category: category,
        amount: parseFloat(amount),
        description: description || null,
        payment_method: paymentMethod,
        payment_source: isPersonal ? 'personal' : 'company',
        partner_id: partnerId || null,
        is_settled: false,
      }]).then(res => {
        if (res.error) console.warn('Muhasebe senkronizasyon uyarısı:', res.error.message);
      });

      showToast('Gider başarıyla kaydedildi', 'success');
      setAmount('');
      setDescription('');
      fetchData();

    } catch (error) {
      console.error('Error saving expense:', error);
      showToast('Kaydetme başarısız: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!canEdit) {
      showToast('Silme yetkiniz yok', 'error');
      return;
    }
    if (!window.confirm('Bu gider kaydını silmek istediğinize emin misiniz?')) return;

    try {
      // Get the expense data before deleting so we can find its accounting match
      const { data: expenseToDelete } = await supabase
        .from('general_expenses')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('general_expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Also remove matching accounting_transaction
      if (expenseToDelete) {
        await supabase
          .from('accounting_transactions')
          .delete()
          .eq('farm_id', farmId)
          .eq('transaction_date', expenseToDelete.expense_date)
          .eq('category', expenseToDelete.category)
          .eq('amount', expenseToDelete.amount)
          .eq('type', 'expense')
          .limit(1);
      }

      showToast('Gider silindi', 'success');
      fetchData();
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
    ...(canEdit ? [{ 
      title: "İşlem", 
      field: "actions", 
      formatter: () => `<button class="px-3 py-1 text-sm text-white bg-red-600 hover:bg-red-700 rounded">Sil</button>`,
      cellClick: (e, cell) => handleDelete(cell.getRow().getData().id),
      headerSort: false,
      width: 100,
      hozAlign: "center"
    }] : [])
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
        {/* Form Section - Only show if user has edit permission */}
        {canEdit && (
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ödeme Yöntemi</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm">
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ortak {paymentMethod === 'personal_account' ? <span className="text-red-500">*</span> : '(opsiyonel)'}</label>
                <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm">
                  <option value="">Seçiniz...</option>
                  {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {paymentMethod === 'personal_account' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                  ℹ️ Kişisel hesaptan yapılan bu gider, otomatik olarak muhasebede <b>ortağın alacağı</b> olarak kaydedilecektir.
                </div>
              )}

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
        )}

        {/* List Section */}
        <div className={canEdit ? "lg:col-span-2" : "lg:col-span-3"}>
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
