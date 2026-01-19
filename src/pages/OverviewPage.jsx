import React, { useState, useEffect } from 'react';
import { useFarmId } from '../hooks/useFarmId';
import { supabase } from '../supabaseClient';
import { FiUsers, FiTrendingUp, FiTrendingDown, FiClipboard, FiDollarSign } from 'react-icons/fi';

const OverviewPage = () => {
  const { farmId } = useFarmId();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAnimals: 0,
    activeRations: 0,
    topLastWeighing: [],
    bottomLastWeighing: [],
    groupCosts: []
  });

  useEffect(() => {
    if (farmId) {
      fetchOverviewData();
    }
  }, [farmId]);

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
        weighingsRes,
        feedsRes,
        rationsRes,
        vetRes,
        expensesRes
      ] = await Promise.all([
         // 1. Animals (Active Only for performance stats)
        supabase
          .from('animals')
          .select('id, tag_number, current_weight, last_weight_kg, last_weigh_date, group_id, purchase_price, birth_date, passive_date, status') // Selected all needed fields
          .eq('status', 'active')
          .eq('farm_id', farmId),
          
        // 2. Count Active Rations
        supabase
          .from('rations')
          .select('*', { count: 'exact', head: true })
          .eq('farm_id', farmId)
          .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`),

        // 3. Weighings
        supabase
          .from('weighings')
          .select('*')
          .eq('farm_id', farmId)
          .order('weigh_date', { ascending: true }),

        // 4. Feeds (For Cost Calc)
        supabase.from('feeds').select('id, price_per_kg').eq('farm_id', farmId),

        // 5. Rations (For Cost Calc)
        supabase.from('rations').select('*').eq('farm_id', farmId),

        // 6. Vet Records (For Cost Calc)
         supabase.from('veterinary_records').select('*').eq('farm_id', farmId),
         
        // 7. General Expenses (For Cost Calc)
        supabase.from('general_expenses').select('*').eq('farm_id', farmId)
      ]);

      const animals = animalsRes.data || [];
      const weighings = weighingsRes.data || [];
      const feeds = feedsRes.data || [];
      const rations = rationsRes.data || [];
      const veterinaryRecords = vetRes.data || [];
      const generalExpenses = expensesRes.data || [];


      // --- Performance Stats Calculations (Active Animals Only) ---

      // Calculate gains for valid active animals
      const animalStats = animals.map(animal => {
        const animalWeighings = weighings.filter(w => w.animal_id === animal.id);
        
        // Last weighing gain (difference from previous weighing)
        let lastGain = 0;
        if (animalWeighings.length >= 2) {
          lastGain = animalWeighings[animalWeighings.length - 1].weight_kg - animalWeighings[animalWeighings.length - 2].weight_kg;
        } else if (animalWeighings.length === 1 && animal.current_weight) {
             // If manual current_weight exists and different from the single weighing? 
             // Logic from original file: "First weighing compared to current_weight"
             // Actually, usually current_weight IS the last weighing weight.
             // If we have 1 weighing record, and that IS the current weight, gain is 0 unless we have initial registration weight seperate.
             // Standard logic: Gain = Last - Previous. 
             // If only 1 weighing, we can't really calc last gain unless we treat 'purchase/birth' as weighing.
             // Using original logic:
             lastGain = animalWeighings[0].weight_kg - (animal.initial_weight || animal.current_weight); // Fallback, likely 0
             // Correction: Original logic used current_weight as base if 1 weighing.
             // Let's stick to: we need at least 2 data points for a "Gain".
             // If animalWeighings.length == 1, lastGain is 0 unless we assume initial=0 (wrong).
             // Let's keep strict:
             if (animalWeighings.length === 1 && animal.current_weight != animalWeighings[0].weight_kg) {
                  lastGain =  animalWeighings[0].weight_kg - animal.current_weight;
             }
        }
        
        // Better logic for Last Gain:
        // If sorting by WeighDate, last item is latest.
        // Gain = Last.Weight - SecondToLast.Weight
        let lastWeighDate = null;
        if (animalWeighings.length > 0) {
            lastWeighDate = animalWeighings[animalWeighings.length - 1].weigh_date;
            if (animalWeighings.length >= 2) {
                lastGain = animalWeighings[animalWeighings.length - 1].weight_kg - animalWeighings[animalWeighings.length - 2].weight_kg;
            }
        }

        return {
          tag_number: animal.tag_number,
          lastGain,
          lastWeighDate,
          hasWeighings: animalWeighings.length > 0
        };
      });

      // Filter: only include animals that have at least one weighing for display
      const animalsWithWeighings = animalStats.filter(a => a.hasWeighings && a.lastGain !== 0); // show only if gain exists? Or even 0.
      
      const topLastWeighing = [...animalsWithWeighings].sort((a, b) => b.lastGain - a.lastGain).slice(0, 3);
      const bottomLastWeighing = [...animalsWithWeighings].sort((a, b) => a.lastGain - b.lastGain).slice(0, 3);


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
      // Note: We need ALL animals to distribute correctly (denominator includes passives if they were active then).
      // But we constrained `animals` fetch to active only. 
      // To catch true cost, we technically need ALL animals for the denominator.
      // However, making a second fetch just for accurate historical denominator might be heavy.
      // Approximation: Use active animals count? 
      // User said "Pasifleri çıkar", but for cost accuracy, if we divide $1000 by only active animals (50) instead of all (100), cost doubles wrongly.
      // Let's quickly fetch ALL animals ID/Dates for calculation correctnes, but simplified.
      // Actually, let's fetch ALL animals in the main query but filter for UI lists.
      // RE-FETCHING ALL ANIMALS FOR ACCURACY
       const { data: allAnimals } = await supabase
        .from('animals')
        .select('id, group_id, birth_date, passive_date, status, tag_number, purchase_price')
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
                   // We know 'a' is currently active, so no passive check needed for 'a'
                   
                   if (isActive) {
                       animalShares[a.id] = (animalShares[a.id] || 0) + share;
                   }
              });
          }
      });

      // Calculate Cost Per Animal
      // We use 'allAnimals' for group aggregation to be robust, or just 'animals' (active)?
      // "Grup Maliyet Raporu" typically includes all costs. 
      // User asked "Genel performansı çıkar, grup maliyeti ekle".
      // Usually you want to see costs of CURRENT stock? Or historical?
      // Given it's "Overview" (Genel Bakış), seeing current active inventory cost makes sense.
      // Let's calculate for ACTIVE animals.
      
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
                const effectiveEnd = endDate; // Currently active, so up to ration end (or today if ration ongoing)

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
      const groups = {};
      animalCosts.forEach(a => {
          const gId = a.group_id || 'Grutsuz';
          if (!groups[gId]) groups[gId] = { id: gId, count: 0, totalCost: 0 };
          groups[gId].count += 1;
          groups[gId].totalCost += a.total_cost;
      });

      const groupCosts = Object.values(groups).map(g => ({
          id: g.id,
          avgCost: g.count > 0 ? g.totalCost / g.count : 0
      })).sort((a,b) => b.avgCost - a.avgCost);


      setStats({
        totalAnimals: animals.length,
        activeRations: activeRationsRes.count || 0,
        topLastWeighing,
        bottomLastWeighing,
        groupCosts
      });

    } catch (error) {
      console.error('Error fetching overview data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

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

  const LastWeighingList = ({ animals, title, icon: Icon, isBest }) => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`w-6 h-6 ${isBest ? 'text-green-600' : 'text-red-600'}`} />
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      </div>
      {animals.length > 0 ? (
        <div className="space-y-3">
          {animals.map((animal, index) => (
            <div key={index} className="flex justify-between items-center border-b border-gray-100 pb-2 last:border-0">
              <div>
                <span className="font-medium text-gray-800">{animal.tag_number}</span>
                {animal.lastWeighDate && (
                  <span className="text-xs text-gray-400 ml-2">
                    {new Date(animal.lastWeighDate).toLocaleDateString('tr-TR')}
                  </span>
                )}
              </div>
              <div className={`font-bold ${isBest ? 'text-green-600' : 'text-red-600'}`}>
                {animal.lastGain > 0 ? '+' : ''}{animal.lastGain.toFixed(1)} kg
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-sm">Veri bulunamadı</p>
      )}
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
                        <tr key={index} className="border-b border-gray-100 last:border-0">
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

  return (
    <div className="h-full overflow-auto">
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

      {/* Group Costs */}
      <div className="mb-6">
          <GroupCostList groups={stats.groupCosts} />
      </div>

      {/* Top and Bottom Performers - Last Weighing */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Son Tartım Performansı (Son Kilo Artışı)</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LastWeighingList 
            animals={stats.topLastWeighing}
            title="En İyi 3 Hayvan"
            icon={FiTrendingUp}
            isBest={true}
          />
          <LastWeighingList 
            animals={stats.bottomLastWeighing}
            title="En Düşük 3 Hayvan"
            icon={FiTrendingDown}
            isBest={false}
          />
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;
