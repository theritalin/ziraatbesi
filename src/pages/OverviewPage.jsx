import React, { useState, useEffect } from 'react';
import { useFarmId } from '../hooks/useFarmId';
import { supabase } from '../supabaseClient';
import { FiUsers, FiClipboard, FiDollarSign, FiPieChart, FiTrendingUp } from 'react-icons/fi';

const StatCard = ({ icon: Icon, title, value, bgColor }) => (
  <div className={`${bgColor} rounded-lg shadow-md p-6 text-white`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm opacity-90">{title}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
      </div>
      <Icon className="w-12 h-12 opacity-80" />
    </div>
  </div>
);

const GroupCostList = ({ groups }) => (
  <div className="bg-white rounded-lg shadow-md p-6">
     <div className="flex items-center gap-2 mb-4">
      <FiDollarSign className="w-6 h-6 text-blue-600" />
      <h3 className="text-lg font-semibold text-gray-800">Grup Ortalama Maliyetleri</h3>
    </div>
    {groups.length > 0 ? (
      <div className="overflow-x-auto">
          <table className="min-w-full">
              <thead>
                  <tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-sm text-gray-600">Grup</th>
                      <th className="text-right py-2 text-sm text-gray-600">Ortalama Maliyet</th>
                  </tr>
              </thead>
              <tbody>
                  {groups.map((group, index) => (
                      <tr key={index} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="py-2 text-gray-800 font-medium">
                              {group.id === 'Grutsuz' ? 'Grup Yok' : `Grup ${group.id}`}
                          </td>
                          <td className="py-2 text-right text-gray-800 font-bold">
                              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(group.avgCost)}
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>
    ) : (
       <p className="text-gray-500 text-sm">Veri bulunamadı</p>
    )}
  </div>
);

const SalesProjection = ({ groups, salesProjections, onProjectionChange }) => {
  let totalRevenue = 0;
  let totalProfit = 0;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <FiPieChart className="w-6 h-6 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-800">Grup Satış Projeksiyonu</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 text-sm text-gray-600">Grup</th>
              <th className="text-center py-2 text-sm text-gray-600">Mevcut Hayvan</th>
              <th className="text-center py-2 text-sm text-gray-600 w-32">Satılacak Adet</th>
              <th className="text-center py-2 text-sm text-gray-600 w-40">Tahmini Fiyat (TL/Adet)</th>
              <th className="text-right py-2 text-sm text-gray-600">Tahmini Gelir</th>
              <th className="text-right py-2 text-sm text-gray-600">Tahmini Kar</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const projection = salesProjections[group.id] || {};
              
              const count = projection.count !== undefined ? projection.count : 0;
              // Default price to average cost if not set, to avoid negative profit confusion
              const price = projection.price !== undefined ? projection.price : Math. ceil(group.avgCost);
              
              const revenue = count * price;
              const profit = revenue - (group.avgCost * count);
              
              totalRevenue += revenue;
              totalProfit += profit;

              return (
                <tr key={group.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="py-3 text-gray-800 font-medium">
                    {group.id === 'Grutsuz' ? 'Grup Yok' : `Grup ${group.id}`}
                  </td>
                  <td className="py-3 text-center text-gray-600">
                    {group.count}
                  </td>
                  <td className="py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <input 
                        type="range" 
                        min="0"
                        max={group.count}
                        value={count}
                        onChange={(e) => onProjectionChange(group.id, 'count', e.target.value)}
                        className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                      <span className="text-sm font-medium text-gray-700 w-6 text-left">{count}</span>
                    </div>
                  </td>
                  <td className="py-3 text-center">
                      <div className="relative inline-block w-32">
                           <input 
                              type="number" 
                              min="0"
                              value={price}
                              onChange={(e) => onProjectionChange(group.id, 'price', e.target.value)}
                              className="w-full pl-6 pr-2 py-1 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          <span className="absolute left-2 top-1.5 text-gray-400">₺</span>
                      </div>
                  </td>
                  <td className="py-3 text-right font-medium text-gray-800">
                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(revenue)}
                  </td>
                  <td className={`py-3 text-right font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(profit)}
                  </td>
                </tr>
              );
            })}
            
            {/* Totals Row */}
            <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
              <td className="py-4 text-gray-800" colSpan={4}>TOPLAM DEĞERLER</td>
              <td className="py-4 text-right text-gray-800">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(totalRevenue)}
              </td>
              <td className={`py-4 text-right ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(totalProfit)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

const OverviewPage = () => {
  const { farmId } = useFarmId();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAnimals: 0,
    activeRations: 0,
    groupCosts: [],
    groupCounts: {} // Store counts to default projection inputs
  });
  
  // Sales Projection State: { groupId: { price: number, count: number } }
  const [salesProjections, setSalesProjections] = useState({});

  useEffect(() => {
    if (farmId) {
      const savedProjections = localStorage.getItem(`sales_projections_${farmId}`);
      if (savedProjections) {
        const parsed = JSON.parse(savedProjections);
        // Reset counts to 0, keep prices
        const resetCounts = {};
        Object.keys(parsed).forEach(key => {
            resetCounts[key] = { ...parsed[key], count: 0 };
        });
        setSalesProjections(resetCounts);
      }
      fetchOverviewData();
    }
  }, [farmId]);

  // Persist projections when they change
  useEffect(() => {
    if (farmId && Object.keys(salesProjections).length > 0) {
      localStorage.setItem(`sales_projections_${farmId}`, JSON.stringify(salesProjections));
    }
  }, [salesProjections, farmId]);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);

      console.log('🔍 farmId in Overview:', farmId);

      if (!farmId) {
        console.warn('⚠️ No farmId available yet, skipping fetch');
        setLoading(false);
        return;
      }

      // Parallel Fetching for performance
      const [
        animalsRes,
        activeRationsRes,
        feedsRes,
        rationsRes,
        vetRes,
        expensesRes
      ] = await Promise.all([
         // 1. Animals (Active Only for performance stats)
        supabase
          .from('animals')
          .select('id, group_id, purchase_price, birth_date, passive_date, status')
          .eq('status', 'active')
          .eq('farm_id', farmId),
          
        // 2. Count Active Rations
        supabase
          .from('rations')
          .select('*', { count: 'exact', head: true })
          .eq('farm_id', farmId)
          .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`),

        // 3. Feeds (For Cost Calc)
        supabase.from('feeds').select('id, price_per_kg').eq('farm_id', farmId),

        // 4. Rations (For Cost Calc)
        supabase.from('rations').select('*').eq('farm_id', farmId),

        // 5. Vet Records (For Cost Calc)
        supabase.from('veterinary_records').select('*').eq('farm_id', farmId),
         
        // 6. General Expenses (For Cost Calc)
        supabase.from('general_expenses').select('*').eq('farm_id', farmId)
      ]);

      const animals = animalsRes.data || [];
      const feeds = feedsRes.data || [];
      const rations = rationsRes.data || [];
      const veterinaryRecords = vetRes.data || [];
      const generalExpenses = expensesRes.data || [];


      // --- Cost Calculations (Matching ReportsPage Logic) ---
      
       // Helper: Calculate daily cost of a ration
      const calculateRationCost = (ration) => {
        if (!ration) return 0;
        let dailyCost = 0;
        const items = ration.content || [];
        if (Array.isArray(items)) {
          items.forEach(item => {
            const feed = feeds.find(f => f.id == item.feed_id);
            if (feed) {
              dailyCost += (parseFloat(item.amount) || 0) * (parseFloat(feed.price_per_kg) || 0);
            }
          });
        }
        return dailyCost;
      };

      // General Expenses Distribution
      // RE-FETCHING ALL ANIMALS FOR ACCURACY (needed for accurate historical expense distribution)
       const { data: allAnimals } = await supabase
        .from('animals')
        .select('id, group_id, birth_date, passive_date, status')
        .eq('farm_id', farmId);

       const animalShares = {}; 
       // Initialize for active animals (which we care about displaying)
       animals.forEach(a => animalShares[a.id] = 0);

       generalExpenses.forEach(exp => {
          const expDate = new Date(exp.expense_date);
          expDate.setHours(0,0,0,0);
          
          // Count active animals on this date
          const activeAnimalsCountOnDate = (allAnimals || []).filter(a => {
              const regDate = new Date(a.birth_date); 
              regDate.setHours(0,0,0,0);
              if (regDate > expDate) return false; 
              
              if (a.status === 'passive') {
                  const pDate = new Date(a.passive_date);
                  pDate.setHours(0,0,0,0);
                  if (pDate <= expDate) return false; 
              }
              return true;
          }).length;

          if (activeAnimalsCountOnDate > 0) {
              const share = (parseFloat(exp.amount) || 0) / activeAnimalsCountOnDate;
              // Add share to currently active animals if they were active then
               animals.forEach(a => {
                   const regDate = new Date(a.birth_date); 
                   regDate.setHours(0,0,0,0);
                   let isActive = true;
                   if (regDate > expDate) isActive = false;
                   
                   if (isActive) {
                       animalShares[a.id] = (animalShares[a.id] || 0) + share;
                   }
              });
          }
      });

      // Calculate Cost Per Animal
      const animalCosts = animals.map(animal => {
          // Purchase
          const purchasePrice = parseFloat(animal.purchase_price) || 0;

          // Feed
          let totalFeedCost = 0;
          if (animal.group_id) {
            const groupRations = rations.filter(r => r.group_id == animal.group_id);
            groupRations.forEach(ration => {
                const dailyCost = calculateRationCost(ration);
                
                let startDate = ration.start_date ? new Date(ration.start_date) : (animal.birth_date ? new Date(animal.birth_date) : new Date());
                startDate.setHours(0,0,0,0);
                
                let endDate = ration.end_date ? new Date(ration.end_date) : new Date();
                endDate.setHours(0,0,0,0);
                
                // Active animal, so no passive_date cap needed usually, 
                // but strictly: intersection of [RationStart, RationEnd] and [AnimalStart, Now]
                const animStart = animal.birth_date ? new Date(animal.birth_date) : new Date();
                animStart.setHours(0,0,0,0);
                
                const effectiveStart = startDate < animStart ? animStart : startDate;
                const effectiveEnd = endDate; 

                if (effectiveEnd >= effectiveStart) {
                     const duration = Math.floor((effectiveEnd - effectiveStart) / (1000 * 60 * 60 * 24)) + 1;
                     if (duration > 0) totalFeedCost += duration * dailyCost;
                }
            });
          }

          // Vet
          const vetCost = veterinaryRecords
            .filter(r => r.animal_id === animal.id)
            .reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);

          return {
              ...animal,
              total_cost: purchasePrice + totalFeedCost + vetCost + (animalShares[animal.id] || 0)
          };
      });

      // Aggregating by Group
      const groupStats = {};
      animalCosts.forEach(a => {
          const gId = a.group_id || 'Grutsuz';
          if (!groupStats[gId]) groupStats[gId] = { id: gId, count: 0, totalCost: 0 };
          groupStats[gId].count += 1;
          groupStats[gId].totalCost += a.total_cost;
      });

      const groupCosts = Object.values(groupStats).map(g => ({
          id: g.id,
          avgCost: g.count > 0 ? g.totalCost / g.count : 0,
          count: g.count
      })).sort((a,b) => b.avgCost - a.avgCost);
      
      const counts = {};
      groupCosts.forEach(g => counts[g.id] = g.count);

      setStats({
        totalAnimals: animals.length,
        activeRations: activeRationsRes.count || 0,
        groupCosts,
        groupCounts: counts
      });

    } catch (error) {
      console.error('Error fetching overview data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectionChange = (groupId, field, value) => {
    setSalesProjections(prev => ({
      ...prev,
      [groupId]: {
        ...prev[groupId],
        [field]: parseFloat(value) || 0
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-1">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Genel Bakış</h1>
        <p className="mt-1 text-sm sm:text-base text-gray-600">Çiftlik özet istatistikleri</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <StatCard 
          icon={FiUsers}
          title="Aktif Hayvan Sayısı"
          value={stats.totalAnimals}
          bgColor="bg-gradient-to-r from-blue-500 to-blue-600"
        />
        <StatCard 
          icon={FiClipboard}
          title="Aktif Rasyon Sayısı"
          value={stats.activeRations}
          bgColor="bg-gradient-to-r from-green-500 to-green-600"
        />
      </div>

      {/* Group Costs & Sales Projection Stacked */}
      <div className="space-y-6">
         {/* Group Costs */}
        <div className="w-full">
            <GroupCostList groups={stats.groupCosts} />
        </div>

        {/* Sales Projection */}
        <div className="w-full">
            <SalesProjection 
              groups={stats.groupCosts} 
              salesProjections={salesProjections}
              onProjectionChange={handleProjectionChange}
            />
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;
