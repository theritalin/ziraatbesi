import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFarmId } from '../hooks/useFarmId';
import { supabase } from '../supabaseClient';
import Toast from '../components/UI/Toast';
import { ReactTabulator } from 'react-tabulator';
import 'react-tabulator/lib/styles.css';
import 'react-tabulator/css/bootstrap/tabulator_bootstrap.min.css';
import {
  FiDollarSign, FiSave, FiTrash2, FiUsers, FiList, FiPieChart,
  FiPlus, FiArrowUpCircle, FiArrowDownCircle, FiEdit2, FiX, FiCalendar,
  FiChevronLeft, FiChevronRight
} from 'react-icons/fi';

const TRANSACTION_TYPES = [
  { value: 'income', label: 'Gelir', color: 'text-green-600', bg: 'bg-green-50', icon: '💰' },
  { value: 'expense', label: 'Gider', color: 'text-red-600', bg: 'bg-red-50', icon: '💸' },
  { value: 'partner_withdrawal', label: 'Ortak Para Çekme', color: 'text-orange-600', bg: 'bg-orange-50', icon: '🏧' },
  { value: 'partner_deposit', label: 'Ortak Para Yatırma', color: 'text-blue-600', bg: 'bg-blue-50', icon: '🏦' },
  { value: 'reimbursement', label: 'Ortak Geri Ödeme', color: 'text-teal-600', bg: 'bg-teal-50', icon: '🔄' },
];

const INCOME_CATEGORIES = ['Hayvan Satışı', 'Gübre Satışı', 'Süt Satışı', 'Devlet Desteği', 'Diğer Gelir'];
const EXPENSE_CATEGORIES = ['Yem Alımı', 'Market', 'Fatura', 'Personel', 'Bakım/Onarım', 'Veteriner', 'Akaryakıt', 'Hayvan Alımı', 'Faiz', 'Diğer Gider'];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Nakit (Şirket Kasası)' },
  { value: 'bank_transfer', label: 'Banka Havale/EFT' },
  { value: 'credit_card', label: 'Kredi Kartı' },
  { value: 'installment', label: 'Taksitli' },
  { value: 'personal_account', label: 'Kişisel Hesaptan (Ortak Ödedi)' },
];

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const formatCurrency = (value) => {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value || 0);
};

const AccountingPage = () => {
  const { farmId, permissions, userRole } = useFarmId();
  const [activeTab, setActiveTab] = useState('transactions');
  const [transactions, setTransactions] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const canEdit = userRole === 'admin' || permissions?.accounting === 'edit';

  // --- Transaction Form State ---
  const [txType, setTxType] = useState('expense');
  const [txCategory, setTxCategory] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txDescription, setTxDescription] = useState('');
  const [txPaymentMethod, setTxPaymentMethod] = useState('cash');
  const [txPartnerId, setTxPartnerId] = useState('');
  const [txInstallmentCount, setTxInstallmentCount] = useState('');

  // --- Partner Form State ---
  const [partnerName, setPartnerName] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');
  const [showPartnerForm, setShowPartnerForm] = useState(false);

  // --- Summary State ---
  const [summaryYear, setSummaryYear] = useState('all');
  const [summaryMonth, setSummaryMonth] = useState(null); // null = all year

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // --- Fetch Data ---
  const fetchData = useCallback(async () => {
    if (!farmId) return;
    try {
      setLoading(true);
      const [txRes, partnerRes] = await Promise.all([
        supabase.from('accounting_transactions').select('*').eq('farm_id', farmId).order('transaction_date', { ascending: false }),
        supabase.from('partners').select('*').eq('farm_id', farmId).order('name'),
      ]);
      if (txRes.error) throw txRes.error;
      if (partnerRes.error) throw partnerRes.error;
      setTransactions(txRes.data || []);
      setPartners(partnerRes.data || []);
    } catch (error) {
      console.error('Error:', error);
      showToast('Veriler yüklenirken hata oluştu', 'error');
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    if (farmId) fetchData();
  }, [farmId, fetchData]);

  // --- Transaction CRUD ---
  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!canEdit) return;

    // Validate: reimbursement and partner operations require a partner
    if (['reimbursement', 'partner_withdrawal', 'partner_deposit'].includes(txType) && !txPartnerId) {
      showToast('Bu işlem türü için ortak seçimi zorunludur', 'error');
      return;
    }
    if (txPaymentMethod === 'personal_account' && !txPartnerId) {
      showToast('Kişisel hesaptan ödeme için ortak seçimi zorunludur', 'error');
      return;
    }

    const isPersonal = txPaymentMethod === 'personal_account';

    try {
      const { error } = await supabase.from('accounting_transactions').insert([{
        farm_id: farmId,
        transaction_date: txDate,
        type: txType,
        category: txType === 'reimbursement' ? 'Ortak Geri Ödeme' : (txCategory || null),
        amount: parseFloat(txAmount),
        description: txDescription || null,
        payment_method: txType === 'reimbursement' ? 'bank_transfer' : txPaymentMethod,
        payment_source: isPersonal ? 'personal' : 'company',
        partner_id: txPartnerId || null,
        installment_count: txPaymentMethod === 'installment' ? parseInt(txInstallmentCount) || null : null,
        installment_start_date: txPaymentMethod === 'installment' ? txDate : null,
        is_settled: false,
      }]);
      if (error) throw error;
      showToast('İşlem başarıyla kaydedildi');
      setTxAmount(''); setTxDescription(''); setTxCategory('');
      setTxInstallmentCount('');
      fetchData();
    } catch (error) {
      console.error('Error:', error);
      showToast('Kaydetme başarısız: ' + error.message, 'error');
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!canEdit) return showToast('Silme yetkiniz yok', 'error');
    if (!window.confirm('Bu işlemi silmek istediğinize emin misiniz?')) return;
    try {
      const { error } = await supabase.from('accounting_transactions').delete().eq('id', id);
      if (error) throw error;
      showToast('İşlem silindi');
      fetchData();
    } catch (error) {
      showToast('Silme hatası: ' + error.message, 'error');
    }
  };

  const handleToggleSettled = async (id, currentValue) => {
    if (!canEdit) return;
    try {
      const { error } = await supabase.from('accounting_transactions').update({ is_settled: !currentValue }).eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      showToast('Güncelleme hatası', 'error');
    }
  };

  // --- Partner CRUD ---
  const handleAddPartner = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    try {
      const { error } = await supabase.from('partners').insert([{
        farm_id: farmId,
        name: partnerName,
        phone: partnerPhone || null,
      }]);
      if (error) throw error;
      showToast('Ortak eklendi');
      setPartnerName(''); setPartnerPhone(''); setShowPartnerForm(false);
      fetchData();
    } catch (error) {
      showToast('Hata: ' + error.message, 'error');
    }
  };

  const handleDeletePartner = async (id) => {
    if (!canEdit) return;
    if (!window.confirm('Bu ortağı silmek istediğinize emin misiniz?')) return;
    try {
      const { error } = await supabase.from('partners').delete().eq('id', id);
      if (error) throw error;
      showToast('Ortak silindi');
      fetchData();
    } catch (error) {
      showToast('Hata: ' + error.message, 'error');
    }
  };

  // --- Computed: Categories for current txType ---
  const currentCategories = useMemo(() => {
    if (txType === 'income') return INCOME_CATEGORIES;
    if (txType === 'expense') return EXPENSE_CATEGORIES;
    return [];
  }, [txType]);

  // --- Computed: Partner balances ---
  // Ortağın alacağı = kişisel hesaptan yaptığı harcamalar - geri ödemeler
  // Ortağın net bakiyesi = yatırdığı - çektiği
  const partnerBalances = useMemo(() => {
    const balances = {};
    partners.forEach(p => {
      balances[p.id] = { name: p.name, deposits: 0, withdrawals: 0, personalExpenses: 0, reimbursements: 0 };
    });
    transactions.forEach(tx => {
      if (!tx.partner_id || !balances[tx.partner_id]) return;
      const amount = parseFloat(tx.amount) || 0;
      if (tx.type === 'partner_deposit') balances[tx.partner_id].deposits += amount;
      if (tx.type === 'partner_withdrawal') balances[tx.partner_id].withdrawals += amount;
      if (tx.type === 'reimbursement') balances[tx.partner_id].reimbursements += amount;
      if (tx.payment_source === 'personal' && tx.type === 'expense') {
        balances[tx.partner_id].personalExpenses += amount;
      }
    });
    return balances;
  }, [partners, transactions]);

  // Quick reimbursement helper
  const handleQuickReimburse = (partnerId, amount) => {
    setTxType('reimbursement');
    setTxPartnerId(partnerId);
    setTxAmount(amount.toString());
    setTxDescription('Kişisel harcama geri ödemesi');
    setActiveTab('transactions');
  };

  // --- Computed: Summary data ---
  const summaryData = useMemo(() => {
    const filtered = transactions.filter(tx => {
      const d = new Date(tx.transaction_date);
      if (summaryYear !== 'all' && d.getFullYear() !== summaryYear) return false;
      if (summaryYear !== 'all' && summaryMonth !== null && d.getMonth() !== summaryMonth) return false;
      return true;
    });

    let totalIncome = 0, totalExpense = 0, totalWithdrawals = 0, totalDeposits = 0;
    const categoryBreakdown = {};

    filtered.forEach(tx => {
      const amount = parseFloat(tx.amount) || 0;
      if (tx.type === 'income') totalIncome += amount;
      if (tx.type === 'expense') totalExpense += amount;
      if (tx.type === 'partner_withdrawal') totalWithdrawals += amount;
      if (tx.type === 'partner_deposit') totalDeposits += amount;

      if (tx.category && (tx.type === 'income' || tx.type === 'expense')) {
        if (!categoryBreakdown[tx.category]) categoryBreakdown[tx.category] = { income: 0, expense: 0 };
        if (tx.type === 'income') categoryBreakdown[tx.category].income += amount;
        if (tx.type === 'expense') categoryBreakdown[tx.category].expense += amount;
      }
    });

    return { totalIncome, totalExpense, totalWithdrawals, totalDeposits, net: totalIncome - totalExpense, categoryBreakdown, count: filtered.length };
  }, [transactions, summaryYear, summaryMonth]);

  // --- Available years ---
  const availableYears = useMemo(() => {
    const years = new Set();
    transactions.forEach(tx => {
      if (tx.transaction_date) years.add(new Date(tx.transaction_date).getFullYear());
    });
    const sorted = Array.from(years).sort((a, b) => b - a);
    return sorted.length > 0 ? sorted : [new Date().getFullYear()];
  }, [transactions]);

  // --- Tabulator Columns ---
  const getPartnerName = (id) => partners.find(p => p.id === id)?.name || '-';

  const txColumns = useMemo(() => [
    { title: "Tarih", field: "transaction_date", sorter: "string", minWidth: 110,
      formatter: (cell) => new Date(cell.getValue()).toLocaleDateString('tr-TR') },
    { title: "Tür", field: "type", sorter: "string", minWidth: 150,
      formatter: (cell) => {
        const t = TRANSACTION_TYPES.find(tt => tt.value === cell.getValue());
        return t ? `${t.icon} ${t.label}` : cell.getValue();
      },
      headerFilter: "select", headerFilterParams: { values: Object.fromEntries(TRANSACTION_TYPES.map(t => [t.value, t.label])) }
    },
    { title: "Kategori", field: "category", sorter: "string", headerFilter: "input", minWidth: 140 },
    { title: "Tutar", field: "amount", sorter: "number", minWidth: 140,
      formatter: (cell) => formatCurrency(cell.getValue()),
      bottomCalc: "sum", bottomCalcFormatter: (cell) => formatCurrency(cell.getValue())
    },
    { title: "Ortak", field: "partner_id", sorter: "string", minWidth: 120,
      formatter: (cell) => getPartnerName(cell.getValue()),
      headerFilter: "select", headerFilterParams: { values: Object.fromEntries(partners.map(p => [p.id, p.name])) }
    },
    { title: "Ödeme", field: "payment_method", sorter: "string", minWidth: 140,
      formatter: (cell) => PAYMENT_METHODS.find(m => m.value === cell.getValue())?.label || cell.getValue() },
    { title: "Kaynak", field: "payment_source", sorter: "string", minWidth: 110,
      formatter: (cell) => cell.getValue() === 'company' ? '🏢 Şirket' : '👤 Kişisel' },
    { title: "Mahsup", field: "is_settled", sorter: "boolean", minWidth: 80, hozAlign: "center",
      formatter: (cell) => {
        const row = cell.getRow().getData();
        if (row.payment_source !== 'personal') return '-';
        return cell.getValue() ? '✅' : '⏳';
      },
      cellClick: (e, cell) => {
        const row = cell.getRow().getData();
        if (row.payment_source === 'personal' && canEdit) {
          handleToggleSettled(row.id, row.is_settled);
        }
      }
    },
    { title: "Açıklama", field: "description", sorter: "string", headerFilter: "input", minWidth: 150 },
    ...(canEdit ? [{
      title: "Sil", field: "id", formatter: () => '<button class="text-red-600 hover:text-red-800 font-bold">✕</button>',
      cellClick: (e, cell) => handleDeleteTransaction(cell.getValue()),
      headerSort: false, width: 60, hozAlign: "center"
    }] : [])
  ], [partners, canEdit]);

  // ------ RENDER ------

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div></div>;
  }

  const tabs = [
    { id: 'transactions', label: 'İşlemler', icon: FiList },
    { id: 'partners', label: 'Ortaklar', icon: FiUsers },
    { id: 'summary', label: 'Özet', icon: FiPieChart },
  ];

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
          <FiDollarSign className="text-green-600" /> Muhasebe
        </h1>
        <p className="mt-1 text-sm text-gray-600">Gelir, gider, ortak hesapları ve bilanço takibi</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-green-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== TAB: İŞLEMLER ==================== */}
      {activeTab === 'transactions' && (
        <div className="flex-1 flex flex-col gap-4">
          {/* Quick Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-xs font-medium text-green-600 uppercase">Toplam Gelir</div>
              <div className="text-xl font-bold text-green-800 mt-1">{formatCurrency(summaryData.totalIncome)}</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <div className="text-xs font-medium text-red-600 uppercase">Toplam Gider</div>
              <div className="text-xl font-bold text-red-800 mt-1">{formatCurrency(summaryData.totalExpense)}</div>
            </div>
            <div className={`${summaryData.net >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'} border rounded-lg p-4 text-center`}>
              <div className={`text-xs font-medium uppercase ${summaryData.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>Net Durum</div>
              <div className={`text-xl font-bold mt-1 ${summaryData.net >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>{formatCurrency(summaryData.net)}</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-xs font-medium text-blue-600 uppercase">İşlem Sayısı</div>
              <div className="text-xl font-bold text-blue-800 mt-1">{transactions.length}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
            {/* Form */}
            {canEdit && (
              <div className="lg:col-span-1">
                <div className="bg-white shadow-md rounded-lg p-5">
                  <h2 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2"><FiPlus /> Yeni İşlem</h2>
                  <form onSubmit={handleAddTransaction} className="space-y-3">

                    {/* Transaction Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">İşlem Türü</label>
                      <div className="grid grid-cols-2 gap-2">
                        {TRANSACTION_TYPES.map(t => (
                          <button key={t.value} type="button" onClick={() => { setTxType(t.value); setTxCategory(''); }}
                            className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                              txType === t.value ? `${t.bg} ${t.color} border-current ring-1 ring-current` : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {t.icon} {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Category */}
                    {currentCategories.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                        <select value={txCategory} onChange={(e) => setTxCategory(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm">
                          <option value="">Seçiniz...</option>
                          {currentCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    )}

                    {/* Amount */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tutar (₺)</label>
                      <input type="number" step="0.01" value={txAmount} onChange={(e) => setTxAmount(e.target.value)}
                        placeholder="0.00" required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm" />
                    </div>

                    {/* Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tarih</label>
                      <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm" />
                    </div>

                    {/* Partner - required for reimbursement & personal payments */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ortak {['reimbursement', 'partner_withdrawal', 'partner_deposit'].includes(txType) || txPaymentMethod === 'personal_account' ? <span className="text-red-500">*</span> : '(opsiyonel)'}
                      </label>
                      <select value={txPartnerId} onChange={(e) => setTxPartnerId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm">
                        <option value="">Seçiniz...</option>
                        {partners.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>

                    {/* Payment Method - hidden for reimbursement */}
                    {txType !== 'reimbursement' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ödeme Yöntemi</label>
                        <select value={txPaymentMethod} onChange={(e) => setTxPaymentMethod(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm">
                          {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                      </div>
                    )}

                    {/* Installment Count */}
                    {txPaymentMethod === 'installment' && txType !== 'reimbursement' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Taksit Sayısı</label>
                        <input type="number" min="2" max="48" value={txInstallmentCount} onChange={(e) => setTxInstallmentCount(e.target.value)}
                          placeholder="örn. 6" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm" />
                      </div>
                    )}

                    {/* Info box: Personal payment */}
                    {txPaymentMethod === 'personal_account' && txType === 'expense' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                        ℹ️ Seçilen ortak kişisel hesabından ödeme yaptı. Bu tutar ortağın <b>alacağı</b> olarak kaydedilecek. Şirket geri ödeme yaptığında "{TRANSACTION_TYPES[4].label}" işlemi ile kapatın.
                      </div>
                    )}

                    {/* Info box: Reimbursement */}
                    {txType === 'reimbursement' && (
                      <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-xs text-teal-800">
                        🔄 Şirket, ortağın kişisel hesabından yaptığı harcamayı geri ödüyor. Bu işlem <b>yeni gider oluşturmaz</b>, sadece ortağın alacağını kapatır.
                      </div>
                    )}

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                      <textarea value={txDescription} onChange={(e) => setTxDescription(e.target.value)} rows="2"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm" />
                    </div>

                    <button type="submit" className="w-full flex justify-center items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm transition-colors">
                      <FiSave /> Kaydet
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Transaction Table */}
            <div className={canEdit ? "lg:col-span-2" : "lg:col-span-3"}>
              <div className="bg-white shadow-md rounded-lg p-4 h-full flex flex-col">
                <h2 className="text-lg font-semibold mb-3 text-gray-700">İşlem Listesi</h2>
                <div className="flex-1 overflow-x-auto min-h-0">
                  {transactions.length > 0 ? (
                    <ReactTabulator
                      data={transactions}
                      columns={txColumns}
                      layout="fitData"
                      options={{
                        pagination: "local",
                        paginationSize: 10,
                        placeholder: "İşlem bulunamadı",
                        headerSort: true,
                        resizableColumnFit: true,
                        responsiveLayout: false, // Prevents collapsing rows into two lines
                      }}
                    />
                  ) : (
                    <div className="text-center text-gray-500 py-8">Henüz işlem kaydı bulunmamaktadır.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB: ORTAKLAR ==================== */}
      {activeTab === 'partners' && (
        <div className="space-y-4">
          {/* Add Partner */}
          {canEdit && (
            <div className="flex items-center gap-3">
              {!showPartnerForm ? (
                <button onClick={() => setShowPartnerForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors">
                  <FiPlus /> Yeni Ortak Ekle
                </button>
              ) : (
                <form onSubmit={handleAddPartner} className="flex items-end gap-3 bg-white shadow-md rounded-lg p-4 flex-wrap">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Ad Soyad</label>
                    <input type="text" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} required placeholder="Ortak adı"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Telefon</label>
                    <input type="text" value={partnerPhone} onChange={(e) => setPartnerPhone(e.target.value)} placeholder="0555..."
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm" />
                  </div>
                  <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"><FiSave /></button>
                  <button type="button" onClick={() => setShowPartnerForm(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"><FiX /></button>
                </form>
              )}
            </div>
          )}

           {/* Partner Cards */}
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {partners.map(partner => {
              const balance = partnerBalances[partner.id] || {};
              const netBalance = (balance.deposits || 0) - (balance.withdrawals || 0);
              const receivable = (balance.personalExpenses || 0) - (balance.reimbursements || 0);

              return (
                <div key={partner.id} className="bg-white shadow-md rounded-lg p-5 border-l-4 border-green-500">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <FiUsers className="text-green-600" /> {partner.name}
                      </h3>
                      {partner.phone && <p className="text-sm text-gray-500 mt-0.5">{partner.phone}</p>}
                    </div>
                    {canEdit && (
                      <button onClick={() => handleDeletePartner(partner.id)} className="text-red-400 hover:text-red-600 transition-colors">
                        <FiTrash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                      <span className="text-gray-600 flex items-center gap-1"><FiArrowDownCircle className="text-blue-500" /> Yatırdığı</span>
                      <span className="font-semibold text-blue-700">{formatCurrency(balance.deposits)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                      <span className="text-gray-600 flex items-center gap-1"><FiArrowUpCircle className="text-orange-500" /> Çektiği</span>
                      <span className="font-semibold text-orange-700">{formatCurrency(balance.withdrawals)}</span>
                    </div>
                    <div className={`flex justify-between items-center py-1.5 border-b border-gray-100`}>
                      <span className="text-gray-600">Net Bakiye</span>
                      <span className={`font-bold ${netBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(netBalance)}</span>
                    </div>

                    {(balance.personalExpenses || 0) > 0 && (
                      <>
                        <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                          <span className="text-gray-600">Kişisel Harcama</span>
                          <span className="font-semibold text-purple-700">{formatCurrency(balance.personalExpenses)}</span>
                        </div>
                        {(balance.reimbursements || 0) > 0 && (
                          <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                            <span className="text-gray-600">Geri Ödenen</span>
                            <span className="font-semibold text-teal-700">{formatCurrency(balance.reimbursements)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center py-1.5">
                          <span className="text-gray-600 font-medium">Alacağı</span>
                          <span className={`font-bold ${receivable > 0 ? 'text-yellow-700' : 'text-green-700'}`}>{formatCurrency(receivable)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Quick Reimburse Button */}
                  {canEdit && receivable > 0 && (
                    <button
                      onClick={() => handleQuickReimburse(partner.id, receivable)}
                      className="w-full mt-3 flex justify-center items-center gap-2 px-3 py-2 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-100 text-sm font-medium transition-colors"
                    >
                      🔄 Geri Öde ({formatCurrency(receivable)})
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {partners.length === 0 && (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              Henüz ortak eklenmemiş. Yukarıdan yeni ortak ekleyebilirsiniz.
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB: ÖZET ==================== */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {/* Period Selector */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button onClick={() => setSummaryYear(y => y === 'all' ? new Date().getFullYear() : y - 1)} className="p-1.5 rounded-md hover:bg-white transition-colors"><FiChevronLeft size={18} /></button>
              <span className="px-3 py-1 font-bold text-gray-800 min-w-[80px] text-center">{summaryYear === 'all' ? 'Tümü' : summaryYear}</span>
              <button onClick={() => setSummaryYear(y => y === 'all' ? new Date().getFullYear() : y + 1)} className="p-1.5 rounded-md hover:bg-white transition-colors"><FiChevronRight size={18} /></button>
            </div>

            <div className="flex gap-1 flex-wrap">
              <button onClick={() => { setSummaryYear('all'); setSummaryMonth(null); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${summaryYear === 'all' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
                Tüm Zamanlar
              </button>
              {summaryYear !== 'all' && (
                <>
                  <button onClick={() => setSummaryMonth(null)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${summaryMonth === null ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
                    Tüm Yıl
                  </button>
                  {MONTH_NAMES.map((name, idx) => (
                    <button key={idx} onClick={() => setSummaryMonth(idx)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${summaryMonth === idx ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
                      {name.substring(0, 3)}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-xs font-medium text-green-600 uppercase">Gelir</div>
              <div className="text-lg font-bold text-green-800 mt-1">{formatCurrency(summaryData.totalIncome)}</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <div className="text-xs font-medium text-red-600 uppercase">Gider</div>
              <div className="text-lg font-bold text-red-800 mt-1">{formatCurrency(summaryData.totalExpense)}</div>
            </div>
            <div className={`${summaryData.net >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'} border rounded-lg p-4 text-center`}>
              <div className={`text-xs font-medium uppercase ${summaryData.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>Kâr / Zarar</div>
              <div className={`text-lg font-bold mt-1 ${summaryData.net >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>{formatCurrency(summaryData.net)}</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-xs font-medium text-blue-600 uppercase">Ortak Yatırım</div>
              <div className="text-lg font-bold text-blue-800 mt-1">{formatCurrency(summaryData.totalDeposits)}</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
              <div className="text-xs font-medium text-orange-600 uppercase">Ortak Çekim</div>
              <div className="text-lg font-bold text-orange-800 mt-1">{formatCurrency(summaryData.totalWithdrawals)}</div>
            </div>
          </div>

          {/* Category Breakdown */}
          {Object.keys(summaryData.categoryBreakdown).length > 0 && (
            <div className="bg-white shadow-md rounded-lg p-5">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Kategori Bazlı Kırılım</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-gray-700">Kategori</th>
                      <th className="px-4 py-2.5 text-right text-green-700">Gelir</th>
                      <th className="px-4 py-2.5 text-right text-red-700">Gider</th>
                      <th className="px-4 py-2.5 text-right text-gray-700">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.entries(summaryData.categoryBreakdown)
                      .sort((a, b) => (b[1].expense + b[1].income) - (a[1].expense + a[1].income))
                      .map(([cat, data]) => (
                        <tr key={cat} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-800">{cat}</td>
                          <td className="px-4 py-2.5 text-right text-green-700">{data.income > 0 ? formatCurrency(data.income) : '-'}</td>
                          <td className="px-4 py-2.5 text-right text-red-700">{data.expense > 0 ? formatCurrency(data.expense) : '-'}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${(data.income - data.expense) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {formatCurrency(data.income - data.expense)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-semibold">
                    <tr>
                      <td className="px-4 py-2.5 text-gray-700">TOPLAM</td>
                      <td className="px-4 py-2.5 text-right text-green-700">{formatCurrency(summaryData.totalIncome)}</td>
                      <td className="px-4 py-2.5 text-right text-red-700">{formatCurrency(summaryData.totalExpense)}</td>
                      <td className={`px-4 py-2.5 text-right ${summaryData.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(summaryData.net)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Partner Summary */}
          {partners.length > 0 && (
            <div className="bg-white shadow-md rounded-lg p-5">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Ortak Bakiye Durumu</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Ortak</th>
                      <th className="px-4 py-2.5 text-right">Yatırım</th>
                      <th className="px-4 py-2.5 text-right">Çekim</th>
                      <th className="px-4 py-2.5 text-right">Net Bakiye</th>
                      <th className="px-4 py-2.5 text-right">Kişisel Harcama</th>
                      <th className="px-4 py-2.5 text-right">Mahsup Bekleyen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {partners.map(p => {
                      const b = partnerBalances[p.id] || {};
                      const net = (b.deposits || 0) - (b.withdrawals || 0);
                      const unsettled = (b.personalExpenses || 0) - (b.settledExpenses || 0);
                      return (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-800">{p.name}</td>
                          <td className="px-4 py-2.5 text-right text-blue-700">{formatCurrency(b.deposits)}</td>
                          <td className="px-4 py-2.5 text-right text-orange-700">{formatCurrency(b.withdrawals)}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${net >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(net)}</td>
                          <td className="px-4 py-2.5 text-right text-purple-700">{formatCurrency(b.personalExpenses)}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${unsettled > 0 ? 'text-yellow-700' : 'text-green-700'}`}>{formatCurrency(unsettled)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {summaryData.count === 0 && (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              Bu dönem için işlem kaydı bulunmamaktadır.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AccountingPage;
