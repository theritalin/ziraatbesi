import React, { useState, useEffect, useMemo } from 'react';
import { useFarmId } from '../../hooks/useFarmId';
import { supabase } from '../../supabaseClient';
import { FiPrinter, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const formatCurrency = (value) => {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value || 0);
};

const PAYMENT_METHOD_LABELS = {
  cash: 'Nakit',
  bank_transfer: 'Havale/EFT',
  credit_card: 'Kredi Kartı',
  installment: 'Taksitli',
  personal_account: 'Kişisel Hesap',
};

// Professional category grouping
const INCOME_GROUPS = {
  'Hayvancılık Gelirleri': ['Hayvan Satışı', 'Süt Satışı', 'Gübre Satışı'],
  'Diğer Gelirler': ['Devlet Desteği', 'Diğer Gelir'],
};

const EXPENSE_GROUPS = {
  'Satılan Malın Maliyeti': ['Hayvan Alımı', 'Yem Alımı', 'Yem (Dış Alım)'],
  'Faaliyet Giderleri': ['Personel', 'Akaryakıt', 'Bakım/Onarım'],
  'Genel Yönetim Giderleri': ['Market', 'Fatura', 'Veteriner'],
  'Finansman Giderleri': ['Faiz'],
  'Diğer Giderler': ['Diğer Gider', 'Diğer'],
};

const AccountingReportView = () => {
  const { farmId } = useFarmId();
  const [transactions, setTransactions] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!farmId) return;
      try {
        setLoading(true);
        const [txRes, pRes] = await Promise.all([
          supabase.from('accounting_transactions').select('*').eq('farm_id', farmId).order('transaction_date', { ascending: false }),
          supabase.from('partners').select('*').eq('farm_id', farmId),
        ]);
        setTransactions(txRes.data || []);
        setPartners(pRes.data || []);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [farmId]);

  // Filtered transactions
  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      const d = new Date(tx.transaction_date);
      if (d.getFullYear() !== selectedYear) return false;
      if (selectedMonth !== null && d.getMonth() !== selectedMonth) return false;
      return true;
    });
  }, [transactions, selectedYear, selectedMonth]);

  // === PROFESSIONAL INCOME STATEMENT DATA ===
  const incomeStatement = useMemo(() => {
    // Collect raw category totals
    const incomeByCategory = {};
    const expenseByCategory = {};
    let totalWithdrawals = 0, totalDeposits = 0;
    const byPaymentMethod = {};
    const byPaymentSource = { company: 0, personal: 0 };
    const byPartner = {};
    let unsettledPersonal = 0;

    filtered.forEach(tx => {
      const amount = parseFloat(tx.amount) || 0;
      const cat = tx.category || 'Diğer';

      if (tx.type === 'income') {
        incomeByCategory[cat] = (incomeByCategory[cat] || 0) + amount;
      }
      if (tx.type === 'expense') {
        expenseByCategory[cat] = (expenseByCategory[cat] || 0) + amount;
      }
      if (tx.type === 'partner_withdrawal') totalWithdrawals += amount;
      if (tx.type === 'partner_deposit') totalDeposits += amount;

      // Payment method breakdown
      if (tx.payment_method && (tx.type === 'income' || tx.type === 'expense')) {
        byPaymentMethod[tx.payment_method] = (byPaymentMethod[tx.payment_method] || 0) + amount;
      }

      // Payment source
      if (tx.payment_source && (tx.type === 'expense')) {
        byPaymentSource[tx.payment_source] = (byPaymentSource[tx.payment_source] || 0) + amount;
      }

      // Partner tracking
      if (tx.partner_id) {
        if (!byPartner[tx.partner_id]) byPartner[tx.partner_id] = { deposits: 0, withdrawals: 0, expenses: 0, unsettled: 0 };
        if (tx.type === 'partner_deposit') byPartner[tx.partner_id].deposits += amount;
        if (tx.type === 'partner_withdrawal') byPartner[tx.partner_id].withdrawals += amount;
        if (tx.payment_source === 'personal') {
          byPartner[tx.partner_id].expenses += amount;
          if (!tx.is_settled) byPartner[tx.partner_id].unsettled += amount;
        }
      }

      if (tx.payment_source === 'personal' && !tx.is_settled) unsettledPersonal += amount;
    });

    // Group income categories
    const incomeGroups = {};
    let totalIncome = 0;
    Object.entries(INCOME_GROUPS).forEach(([groupName, cats]) => {
      const items = [];
      cats.forEach(cat => {
        if (incomeByCategory[cat]) {
          items.push({ name: cat, amount: incomeByCategory[cat] });
          totalIncome += incomeByCategory[cat];
          delete incomeByCategory[cat]; // mark as consumed
        }
      });
      if (items.length > 0) incomeGroups[groupName] = items;
    });
    // Any ungrouped income categories
    Object.entries(incomeByCategory).forEach(([cat, amount]) => {
      if (!incomeGroups['Diğer Gelirler']) incomeGroups['Diğer Gelirler'] = [];
      incomeGroups['Diğer Gelirler'].push({ name: cat, amount });
      totalIncome += amount;
    });

    // Group expense categories
    const expenseGroups = {};
    let totalExpense = 0;
    let costOfGoods = 0;
    let operatingExpenses = 0;
    let adminExpenses = 0;
    let financeExpenses = 0;
    let otherExpenses = 0;

    Object.entries(EXPENSE_GROUPS).forEach(([groupName, cats]) => {
      const items = [];
      let groupTotal = 0;
      cats.forEach(cat => {
        if (expenseByCategory[cat]) {
          items.push({ name: cat, amount: expenseByCategory[cat] });
          groupTotal += expenseByCategory[cat];
          totalExpense += expenseByCategory[cat];
          delete expenseByCategory[cat];
        }
      });
      if (items.length > 0) {
        expenseGroups[groupName] = { items, total: groupTotal };
        if (groupName === 'Satılan Malın Maliyeti') costOfGoods = groupTotal;
        else if (groupName === 'Faaliyet Giderleri') operatingExpenses = groupTotal;
        else if (groupName === 'Genel Yönetim Giderleri') adminExpenses = groupTotal;
        else if (groupName === 'Finansman Giderleri') financeExpenses = groupTotal;
        else otherExpenses += groupTotal;
      }
    });
    // Ungrouped
    Object.entries(expenseByCategory).forEach(([cat, amount]) => {
      if (!expenseGroups['Diğer Giderler']) expenseGroups['Diğer Giderler'] = { items: [], total: 0 };
      expenseGroups['Diğer Giderler'].items.push({ name: cat, amount });
      expenseGroups['Diğer Giderler'].total += amount;
      otherExpenses += amount;
      totalExpense += amount;
    });

    const grossProfit = totalIncome - costOfGoods;
    const operatingProfit = grossProfit - operatingExpenses - adminExpenses;
    const netProfit = totalIncome - totalExpense;

    return {
      incomeGroups, expenseGroups,
      totalIncome, totalExpense, costOfGoods,
      grossProfit, operatingExpenses, adminExpenses, financeExpenses, otherExpenses,
      operatingProfit, netProfit,
      totalWithdrawals, totalDeposits,
      byPaymentMethod, byPaymentSource,
      byPartner, unsettledPersonal,
    };
  }, [filtered]);

  // Monthly breakdown
  const monthlyBreakdown = useMemo(() => {
    if (selectedMonth !== null) return [];
    return MONTH_NAMES.map((name, idx) => {
      let income = 0, expense = 0;
      transactions.forEach(tx => {
        const d = new Date(tx.transaction_date);
        if (d.getFullYear() !== selectedYear || d.getMonth() !== idx) return;
        const amount = parseFloat(tx.amount) || 0;
        if (tx.type === 'income') income += amount;
        if (tx.type === 'expense') expense += amount;
      });
      return { month: name, income, expense, net: income - expense };
    });
  }, [transactions, selectedYear, selectedMonth]);

  const getPartnerName = (id) => partners.find(p => p.id === id)?.name || 'Bilinmiyor';

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div></div>;
  }

  const periodLabel = selectedMonth !== null ? `${MONTH_NAMES[selectedMonth]} ${selectedYear}` : `${selectedYear} Yılı`;
  const is = incomeStatement;

  // Helper component for statement line items
  const LineItem = ({ label, amount, bold, indent, color, border }) => (
    <div className={`flex justify-between items-center py-2 px-4 ${indent ? 'pl-10' : ''} ${bold ? 'font-bold' : ''} ${border ? 'border-t-2 border-gray-800' : 'border-b border-gray-100'} ${color || ''}`}>
      <span className={`${bold ? 'text-gray-900' : 'text-gray-700'} text-sm`}>{label}</span>
      <span className={`text-sm tabular-nums ${color || (bold ? 'text-gray-900' : 'text-gray-800')}`}>{formatCurrency(amount)}</span>
    </div>
  );

  const SectionHeader = ({ title }) => (
    <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
      <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{title}</span>
    </div>
  );

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-5xl mx-auto print:shadow-none print:w-full print:p-0">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Gelir Tablosu & Bilanço</h2>
          <p className="text-sm text-gray-500 mt-1">Profesyonel dönem bazlı mali rapor</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => { setSelectedYear(y => y - 1); setSelectedMonth(null); }}
              className="p-1.5 rounded-md hover:bg-white transition-colors"><FiChevronLeft size={18} /></button>
            <span className="px-3 py-1 font-bold text-gray-800 min-w-[60px] text-center">{selectedYear}</span>
            <button onClick={() => { setSelectedYear(y => y + 1); setSelectedMonth(null); }}
              className="p-1.5 rounded-md hover:bg-white transition-colors"><FiChevronRight size={18} /></button>
          </div>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            <FiPrinter /> Yazdır
          </button>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex gap-1 flex-wrap mb-6 print:hidden">
        <button onClick={() => setSelectedMonth(null)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${selectedMonth === null ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          Tüm Yıl
        </button>
        {MONTH_NAMES.map((name, idx) => (
          <button key={idx} onClick={() => setSelectedMonth(idx)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${selectedMonth === idx ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {name.substring(0, 3)}
          </button>
        ))}
      </div>

      {/* ========= PRINT HEADER ========= */}
      <div className="hidden print:block text-center border-b-2 border-gray-900 pb-4 mb-6">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">GELİR TABLOSU</h1>
        <p className="text-sm text-gray-600 mt-1 font-medium">{periodLabel}</p>
        <p className="text-xs text-gray-400 mt-0.5">Rapor Tarihi: {new Date().toLocaleDateString('tr-TR')}</p>
      </div>

      {/* ========= INCOME STATEMENT ========= */}
      <div className="border border-gray-300 rounded-lg overflow-hidden mb-6">
        {/* Company Header */}
        <div className="bg-gray-900 text-white px-4 py-3 text-center">
          <div className="text-sm font-bold tracking-wider uppercase">GELİR TABLOSU</div>
          <div className="text-xs text-gray-300 mt-0.5">{periodLabel}</div>
        </div>

        {/* === A. GELİRLER === */}
        <SectionHeader title="A. GELİRLER (Hasılat)" />
        {Object.entries(is.incomeGroups).map(([groupName, items]) => (
          <div key={groupName}>
            <div className="px-4 py-1.5 bg-green-50">
              <span className="text-xs font-semibold text-green-800">{groupName}</span>
            </div>
            {items.map(item => (
              <LineItem key={item.name} label={item.name} amount={item.amount} indent />
            ))}
          </div>
        ))}
        <LineItem label="TOPLAM GELİR (A)" amount={is.totalIncome} bold color="text-green-700" border />

        {/* === B. SATILAN MALIN MALİYETİ === */}
        {is.expenseGroups['Satılan Malın Maliyeti'] && (
          <>
            <SectionHeader title="B. SATILAN MALIN MALİYETİ" />
            {is.expenseGroups['Satılan Malın Maliyeti'].items.map(item => (
              <LineItem key={item.name} label={item.name} amount={item.amount} indent />
            ))}
            <LineItem label="TOPLAM SMM (B)" amount={is.costOfGoods} bold color="text-red-700" />
          </>
        )}

        {/* === BRÜT KÂR === */}
        <div className={`flex justify-between items-center py-3 px-4 font-bold border-t-2 border-b-2 border-gray-800 ${is.grossProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <span className="text-sm text-gray-900">BRÜT KÂR / (ZARAR) (A - B)</span>
          <span className={`text-base tabular-nums ${is.grossProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(is.grossProfit)}</span>
        </div>

        {/* === C. FAALİYET GİDERLERİ === */}
        {is.expenseGroups['Faaliyet Giderleri'] && (
          <>
            <SectionHeader title="C. FAALİYET GİDERLERİ" />
            {is.expenseGroups['Faaliyet Giderleri'].items.map(item => (
              <LineItem key={item.name} label={item.name} amount={item.amount} indent />
            ))}
            <LineItem label="Toplam Faaliyet Giderleri (C)" amount={is.operatingExpenses} bold />
          </>
        )}

        {/* === D. GENEL YÖNETİM GİDERLERİ === */}
        {is.expenseGroups['Genel Yönetim Giderleri'] && (
          <>
            <SectionHeader title="D. GENEL YÖNETİM GİDERLERİ" />
            {is.expenseGroups['Genel Yönetim Giderleri'].items.map(item => (
              <LineItem key={item.name} label={item.name} amount={item.amount} indent />
            ))}
            <LineItem label="Toplam Yönetim Giderleri (D)" amount={is.adminExpenses} bold />
          </>
        )}

        {/* === FAALİYET KÂRI === */}
        <div className={`flex justify-between items-center py-3 px-4 font-bold border-t-2 border-b-2 border-gray-800 ${is.operatingProfit >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
          <span className="text-sm text-gray-900">FAALİYET KÂRI / (ZARARI) (A - B - C - D)</span>
          <span className={`text-base tabular-nums ${is.operatingProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrency(is.operatingProfit)}</span>
        </div>

        {/* === E. FİNANSMAN GİDERLERİ === */}
        {is.expenseGroups['Finansman Giderleri'] && (
          <>
            <SectionHeader title="E. FİNANSMAN GİDERLERİ" />
            {is.expenseGroups['Finansman Giderleri'].items.map(item => (
              <LineItem key={item.name} label={item.name} amount={item.amount} indent />
            ))}
            <LineItem label="Toplam Finansman Giderleri (E)" amount={is.financeExpenses} bold />
          </>
        )}

        {/* === F. DİĞER GİDERLER === */}
        {is.expenseGroups['Diğer Giderler'] && (
          <>
            <SectionHeader title="F. DİĞER GİDERLER" />
            {is.expenseGroups['Diğer Giderler'].items.map(item => (
              <LineItem key={item.name} label={item.name} amount={item.amount} indent />
            ))}
            <LineItem label="Toplam Diğer Giderler (F)" amount={is.otherExpenses} bold />
          </>
        )}

        {/* === NET KÂR / ZARAR === */}
        <div className={`flex justify-between items-center py-4 px-4 font-black border-t-4 border-double border-gray-900 ${is.netProfit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
          <span className="text-base text-gray-900">NET KÂR / (ZARAR)</span>
          <span className={`text-xl tabular-nums ${is.netProfit >= 0 ? 'text-green-800' : 'text-red-800'}`}>{formatCurrency(is.netProfit)}</span>
        </div>
      </div>

      {/* ========= ÖDEME YÖNTEMİ DAĞILIMI ========= */}
      {Object.keys(is.byPaymentMethod).length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Ödeme Yöntemi Dağılımı</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Object.entries(is.byPaymentMethod)
              .sort((a, b) => b[1] - a[1])
              .map(([method, amount]) => {
                const total = Object.values(is.byPaymentMethod).reduce((s, v) => s + v, 0);
                const pct = total > 0 ? ((amount / total) * 100).toFixed(1) : 0;
                return (
                  <div key={method} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                    <div className="text-xs font-medium text-gray-600">{PAYMENT_METHOD_LABELS[method] || method}</div>
                    <div className="text-sm font-bold text-gray-800 mt-1">{formatCurrency(amount)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">%{pct}</div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ========= ÖDEME KAYNAĞI ========= */}
      {(is.byPaymentSource.company > 0 || is.byPaymentSource.personal > 0) && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Ödeme Kaynağı</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-xs font-medium text-blue-600">🏢 Şirket Hesabı</div>
              <div className="text-lg font-bold text-blue-800 mt-1">{formatCurrency(is.byPaymentSource.company)}</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
              <div className="text-xs font-medium text-purple-600">👤 Kişisel Hesap</div>
              <div className="text-lg font-bold text-purple-800 mt-1">{formatCurrency(is.byPaymentSource.personal)}</div>
            </div>
            {is.unsettledPersonal > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <div className="text-xs font-medium text-yellow-600">⏳ Mahsup Bekleyen</div>
                <div className="text-lg font-bold text-yellow-800 mt-1">{formatCurrency(is.unsettledPersonal)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========= ORTAK HAREKETLERİ ========= */}
      {Object.keys(is.byPartner).length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Ortak Hareketleri</h3>
          <div className="border border-gray-300 rounded-lg overflow-hidden">
            {/* Summary Row */}
            <div className="grid grid-cols-2 gap-0 border-b border-gray-200">
              <div className="bg-blue-50 p-3 text-center border-r border-gray-200">
                <div className="text-xs text-blue-600 font-medium">Toplam Ortak Yatırımı</div>
                <div className="text-lg font-bold text-blue-800">{formatCurrency(is.totalDeposits)}</div>
              </div>
              <div className="bg-orange-50 p-3 text-center">
                <div className="text-xs text-orange-600 font-medium">Toplam Ortak Çekimi</div>
                <div className="text-lg font-bold text-orange-800">{formatCurrency(is.totalWithdrawals)}</div>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-gray-700 font-semibold">Ortak</th>
                  <th className="px-4 py-2.5 text-right text-blue-700 font-semibold">Yatırım</th>
                  <th className="px-4 py-2.5 text-right text-orange-700 font-semibold">Çekim</th>
                  <th className="px-4 py-2.5 text-right text-gray-700 font-semibold">Net Bakiye</th>
                  <th className="px-4 py-2.5 text-right text-purple-700 font-semibold">Kişisel</th>
                  <th className="px-4 py-2.5 text-right text-yellow-700 font-semibold">Mahsup Bkl.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(is.byPartner).map(([pid, data]) => {
                  const net = data.deposits - data.withdrawals;
                  return (
                    <tr key={pid} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{getPartnerName(pid)}</td>
                      <td className="px-4 py-2.5 text-right text-blue-700">{formatCurrency(data.deposits)}</td>
                      <td className="px-4 py-2.5 text-right text-orange-700">{formatCurrency(data.withdrawals)}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${net >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(net)}</td>
                      <td className="px-4 py-2.5 text-right text-purple-700">{formatCurrency(data.expenses)}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${data.unsettled > 0 ? 'text-yellow-700' : 'text-green-700'}`}>{formatCurrency(data.unsettled)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========= AYLIK GELİR-GİDER TABLOSU ========= */}
      {selectedMonth === null && monthlyBreakdown.some(m => m.income > 0 || m.expense > 0) && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Aylık Gelir-Gider Tablosu</h3>
          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-white">
                <tr>
                  <th className="px-4 py-2.5 text-left">Ay</th>
                  <th className="px-4 py-2.5 text-right">Gelir</th>
                  <th className="px-4 py-2.5 text-right">Gider</th>
                  <th className="px-4 py-2.5 text-right">Net Kâr/Zarar</th>
                  <th className="px-4 py-2.5 text-right">Kâr Marjı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthlyBreakdown.map((m, idx) => {
                  const margin = m.income > 0 ? ((m.net / m.income) * 100).toFixed(1) : '-';
                  const hasData = m.income > 0 || m.expense > 0;
                  return (
                    <tr key={idx} className={`${hasData ? 'hover:bg-gray-50' : 'opacity-30'}`}>
                      <td className="px-4 py-2 font-medium text-gray-800">{m.month}</td>
                      <td className="px-4 py-2 text-right text-green-700">{m.income > 0 ? formatCurrency(m.income) : '-'}</td>
                      <td className="px-4 py-2 text-right text-red-700">{m.expense > 0 ? formatCurrency(m.expense) : '-'}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${m.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {hasData ? formatCurrency(m.net) : '-'}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-500">{typeof margin === 'string' ? margin : `%${margin}`}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-800 text-white font-bold">
                <tr>
                  <td className="px-4 py-2.5">TOPLAM</td>
                  <td className="px-4 py-2.5 text-right">{formatCurrency(is.totalIncome)}</td>
                  <td className="px-4 py-2.5 text-right">{formatCurrency(is.totalExpense)}</td>
                  <td className={`px-4 py-2.5 text-right ${is.netProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>{formatCurrency(is.netProfit)}</td>
                  <td className="px-4 py-2.5 text-right">{is.totalIncome > 0 ? `%${((is.netProfit / is.totalIncome) * 100).toFixed(1)}` : '-'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          Bu dönem için muhasebe kaydı bulunmamaktadır.
        </div>
      )}
    </div>
  );
};

export default AccountingReportView;
