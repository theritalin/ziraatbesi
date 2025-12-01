
import React, { useState, useEffect, useMemo } from 'react';
import { useFarmId } from '../hooks/useFarmId';
import { supabase } from '../supabaseClient';
import { ReactTabulator } from 'react-tabulator';
import 'react-tabulator/lib/styles.css';
import 'react-tabulator/lib/css/tabulator.min.css';

const moneyFormatter = (cell) => {
  if (!cell || !cell.getValue) return '-';
  const val = cell.getValue();
  if (val === null || val === undefined || isNaN(val)) return '-';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
};

const ReportsPage = () => {
  const { farmId } = useFarmId();
  const [animals, setAnimals] = useState([]);
  const [weighings, setWeighings] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [rations, setRations] = useState([]);
  const [veterinaryRecords, setVeterinaryRecords] = useState([]);
  const [generalExpenses, setGeneralExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('inventory');

  useEffect(() => {
    if (farmId) {
      fetchData();
    }
  }, [farmId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (farmId) {
        const [animalsRes, weighingsRes, feedsRes, rationsRes, vetRes, expensesRes] = await Promise.all([
          supabase.from('animals').select('*').eq('farm_id', farmId).order('tag_number', { ascending: true }),
          supabase.from('weighings').select('*').eq('farm_id', farmId).order('weigh_date', { ascending: true }),
          supabase.from('feeds').select('*').eq('farm_id', farmId),
          supabase.from('rations').select('*').eq('farm_id', farmId),
          supabase.from('veterinary_records').select('*').eq('farm_id', farmId),
          supabase.from('general_expenses').select('*').eq('farm_id', farmId)
        ]);

        setAnimals(animalsRes.data || []);
        setWeighings(weighingsRes.data || []);
        setFeeds(feedsRes.data || []);
        setRations(rationsRes.data || []);
        setVeterinaryRecords(vetRes.data || []);
        setGeneralExpenses(expensesRes.data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- Calculations ---

  // 1. Animal Inventory & GCAA
  const inventoryData = useMemo(() => {
    return animals.map(animal => {
      const animalWeighings = weighings
        .filter(w => w.animal_id === animal.id)
        .sort((a, b) => new Date(a.weigh_date) - new Date(b.weigh_date));

      const lastWeighing = animalWeighings[animalWeighings.length - 1];
      
      // Calculate General GCAA: (Last Weight - Registration Weight) / Days
      // Registration Weight = current_weight
      // Registration Date = birth_date (User requested to use birth_date as registration date)
      let generalGcaa = '-';
      const regDate = animal.birth_date ? new Date(animal.birth_date) : null;
      
      if (lastWeighing && animal.current_weight && regDate) {
        const weightDiff = lastWeighing.weight_kg - animal.current_weight;
        const daysDiff = Math.ceil((new Date(lastWeighing.weigh_date) - regDate) / (1000 * 60 * 60 * 24));
        if (daysDiff > 0) {
          generalGcaa = (weightDiff / daysDiff).toFixed(3);
        }
      }

      return {
        id: animal.id,
        tag_number: animal.tag_number,
        group_id: animal.group_id,
        initial_weight: animal.current_weight || '-', // Registration Weight
        registration_date: regDate ? regDate.toLocaleDateString('tr-TR') : '-',
        last_weigh_date: lastWeighing ? new Date(lastWeighing.weigh_date).toLocaleDateString('tr-TR') : '-',
        last_weight: lastWeighing?.weight_kg || '-',
        general_gcaa: generalGcaa
      };
    });
  }, [animals, weighings]);

  // 2. Feed Stock Report
  const feedConsumption = useMemo(() => {
    const consumption = {}; // feed_id -> daily_amount
    
    // Count animals per group
    const animalsPerGroup = {};
    animals.forEach(a => {
      if (a.group_id) {
        animalsPerGroup[a.group_id] = (animalsPerGroup[a.group_id] || 0) + 1;
      }
    });

    rations.forEach(ration => {
      if (ration.group_id && animalsPerGroup[ration.group_id]) {
          const items = ration.ration_items || [];
          items.forEach(item => {
              const feedId = item.feed_id;
              const amount = parseFloat(item.amount) || 0;
              consumption[feedId] = (consumption[feedId] || 0) + (amount * animalsPerGroup[ration.group_id]);
          });
      }
    });
    return consumption;
  }, [animals, rations]);

  const feedStockData = useMemo(() => {
    return feeds.map(feed => {
      const dailyUse = feedConsumption[feed.id] || 0;
      const daysLeft = dailyUse > 0 ? Math.floor(feed.stock_amount / dailyUse) : 999;
      const bagWeight = parseFloat(feed.bag_weight) || 0;
      const bagsLeft = bagWeight > 0 ? Math.floor(feed.stock_amount / bagWeight) : '-';
      const unitPrice = parseFloat(feed.price_per_kg) || 0;
      
      return {
        id: feed.id,
        name: feed.name,
        stock_amount: feed.stock_amount,
        unit_price: unitPrice,
        total_value: (feed.stock_amount * unitPrice).toFixed(2),
        daily_consumption: dailyUse.toFixed(2),
        days_remaining: dailyUse > 0 ? daysLeft : 'Yeterli',
        bags_remaining: bagsLeft
      };
    });
  }, [feeds, feedConsumption]);

  const pivotData = useMemo(() => {
    const animalMap = {};
    animals.forEach(a => {
      animalMap[a.id] = { tag_number: a.tag_number };
    });
    weighings.forEach(w => {
      if (animalMap[w.animal_id]) {
        animalMap[w.animal_id][w.weigh_date] = w.weight_kg;
      }
    });
    return Object.values(animalMap);
  }, [animals, weighings]);

  // 3. Cost Reports (Animal & Group)
  const costData = useMemo(() => {
    // Helper: Format Currency
    const formatCurrency = (value) => {
      return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
    };

    // Helper: Calculate daily cost of a ration
    const getRationDailyCost = (groupId) => {
      const ration = rations.find(r => r.group_id == groupId);
      if (!ration) return 0;
      
      let dailyCost = 0;
      // Ration items are stored in 'content' column (JSONB)
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

    // Helper: General Expenses Share per Animal
    const totalGeneralExpenses = generalExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    const generalExpensePerAnimal = animals.length > 0 ? totalGeneralExpenses / animals.length : 0;

    return animals.map(animal => {
      // Purchase Cost
      const purchasePrice = parseFloat(animal.purchase_price) || 0;

      // Feed Cost Calculation
      let totalFeedCost = 0;
      if (animal.group_id) {
        // Find all rations assigned to this group
        // Note: Currently the system might only have one active ration per group or multiple.
        // The user mentioned "20 days" in Rations screen.
        // We should look for rations matching the group_id.
        const groupRations = rations.filter(r => r.group_id == animal.group_id);
        
        groupRations.forEach(ration => {
            const dailyCost = getRationDailyCost(ration.group_id); 

            // Calculate duration
            let startDate;
            if (ration.start_date) {
                startDate = new Date(ration.start_date);
            } else {
                startDate = animal.birth_date ? new Date(animal.birth_date) : new Date();
            }

            const endDate = ration.end_date ? new Date(ration.end_date) : new Date();
            
            // Calculate duration in days
            const duration = Math.max(0, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
            totalFeedCost += duration * dailyCost;
        });
      }

      // Veterinary Cost
      const vetCost = veterinaryRecords
        .filter(r => r.animal_id === animal.id)
        .reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);

      // Total
      const totalCost = purchasePrice + totalFeedCost + vetCost + generalExpensePerAnimal;

      return {
        id: animal.id,
        tag_number: animal.tag_number,
        group_id: animal.group_id || 'Grup Yok',
        purchase_price: purchasePrice, // Keep as number for sorting/calc
        feed_cost: totalFeedCost,
        vet_cost: vetCost,
        general_cost: generalExpensePerAnimal,
        total_cost: totalCost
      };
    });
  }, [animals, rations, feeds, veterinaryRecords, generalExpenses]);

  // Group Aggregation
  const groupCostData = useMemo(() => {
    const groups = {};
    let grandTotal = 0;

    costData.forEach(item => {
      const groupId = item.group_id;
      if (!groups[groupId]) {
        groups[groupId] = {
          group_id: groupId,
          animal_count: 0,
          total_purchase: 0,
          total_feed: 0,
          total_vet: 0,
          total_general: 0,
          grand_total: 0
        };
      }
      
      groups[groupId].animal_count += 1;
      groups[groupId].total_purchase += item.purchase_price;
      groups[groupId].total_feed += item.feed_cost;
      groups[groupId].total_vet += item.vet_cost;
      groups[groupId].total_general += item.general_cost;
      groups[groupId].grand_total += item.total_cost;
      
      grandTotal += item.total_cost;
    });

    // Convert to array and format
    const result = Object.values(groups).map(g => ({
      ...g,
      avg_cost: g.animal_count > 0 ? g.grand_total / g.animal_count : 0
    }));

    return result;
  }, [costData]);

  // --- Columns Definitions ---
  
  const columnsInventory = useMemo(() => [
    { title: "Küpe No", field: "tag_number", sorter: "string", headerFilter: "input" },
    { title: "Grup", field: "group_id", sorter: "number", headerFilter: "input" },
    { title: "Kayıt Tarihi", field: "registration_date", sorter: "string" },
    { title: "Kayıt Ağırlığı (kg)", field: "initial_weight", sorter: "number" },
    { title: "Son Tartım Tarihi", field: "last_weigh_date", sorter: "string" },
    { title: "Son Tartım (kg)", field: "last_weight", sorter: "number" },
    { title: "Genel GCAA (kg/gün)", field: "general_gcaa", sorter: "number" },
  ], []);



  const columnsFeedStock = useMemo(() => [
    { title: "Yem Adı", field: "name", sorter: "string", headerFilter: "input" },
    { title: "Stok (kg)", field: "stock_amount", sorter: "number" },
    { title: "Birim Fiyat", field: "unit_price", sorter: "number", formatter: moneyFormatter },
    { title: "Toplam Değer", field: "total_value", sorter: "number", formatter: moneyFormatter },
    { title: "Günlük Tüketim (kg)", field: "daily_consumption", sorter: "number" },
    { title: "Tahmini Bitiş (Gün)", field: "days_remaining", sorter: "number" },
    { title: "Kalan Çuval", field: "bags_remaining", sorter: "number" },
  ], []);

  const columnsAnimalCost = useMemo(() => [
    { title: "Küpe No", field: "tag_number", sorter: "string", headerFilter: "input" },
    { title: "Grup", field: "group_id", sorter: "string", headerFilter: "input" },
    { title: "Alış Maliyeti", field: "purchase_price", sorter: "number", formatter: moneyFormatter, bottomCalc:"sum", bottomCalcFormatter: moneyFormatter },
    { title: "Yem Maliyeti", field: "feed_cost", sorter: "number", formatter: moneyFormatter, bottomCalc:"sum", bottomCalcFormatter: moneyFormatter },
    { title: "Veteriner", field: "vet_cost", sorter: "number", formatter: moneyFormatter, bottomCalc:"sum", bottomCalcFormatter: moneyFormatter },
    { title: "Genel Gider Payı", field: "general_cost", sorter: "number", formatter: moneyFormatter, bottomCalc:"sum", bottomCalcFormatter: moneyFormatter },
    { title: "Toplam Maliyet", field: "total_cost", sorter: "number", formatter: moneyFormatter, bottomCalc:"sum", bottomCalcFormatter: moneyFormatter },
  ], []);

  const columnsGroupCost = useMemo(() => [
    { title: "Grup", field: "group_id", sorter: "string" },
    { title: "Hayvan Sayısı", field: "animal_count", sorter: "number", bottomCalc:"sum" },
    { title: "Top. Alış", field: "total_purchase", sorter: "number", formatter: moneyFormatter, bottomCalc:"sum", bottomCalcFormatter: moneyFormatter },
    { title: "Top. Yem", field: "total_feed", sorter: "number", formatter: moneyFormatter, bottomCalc:"sum", bottomCalcFormatter: moneyFormatter },
    { title: "Top. Veteriner", field: "total_vet", sorter: "number", formatter: moneyFormatter, bottomCalc:"sum", bottomCalcFormatter: moneyFormatter },
    { title: "Top. Genel Gider", field: "total_general", sorter: "number", formatter: moneyFormatter, bottomCalc:"sum", bottomCalcFormatter: moneyFormatter },
    { title: "GENEL TOPLAM", field: "grand_total", sorter: "number", formatter: moneyFormatter, bottomCalc:"sum", bottomCalcFormatter: moneyFormatter },
    { title: "Ortalama Maliyet", field: "avg_cost", sorter: "number", formatter: moneyFormatter },
  ], []);

  const pivotColumns = useMemo(() => {
    const dates = [...new Set(weighings.map(w => w.weigh_date))].sort((a, b) => new Date(b) - new Date(a)); // Descending
    const cols = [
        { title: "Küpe No", field: "tag_number", sorter: "string", headerFilter: "input", frozen: true }
    ];
    dates.forEach(date => {
        cols.push({ title: new Date(date).toLocaleDateString('tr-TR'), field: date, sorter: "number" });
    });
    return cols;
  }, [weighings]);

  const getColumns = () => {
    switch (reportType) {
      case 'inventory': return columnsInventory;
      case 'feed_stock': return columnsFeedStock;
      case 'animal_cost': return columnsAnimalCost;
      case 'group_cost': return columnsGroupCost;
      case 'weighing_pivot': return pivotColumns;
      default: return columnsInventory;
    }
  };

  const getData = () => {
    switch (reportType) {
      case 'inventory': return inventoryData;
      case 'feed_stock': return feedStockData;
      case 'animal_cost': return costData;
      case 'group_cost': return groupCostData;
      case 'weighing_pivot': return pivotData;
      default: return inventoryData;
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div></div>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Raporlar</h1>
          <p className="mt-1 text-sm sm:text-base text-gray-600">Çiftlik performans ve maliyet raporları</p>
        </div>
        <div className="w-auto">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="inventory">Hayvan Envanteri</option>
            <option value="feed_stock">Yem Stoğu</option>
            <option value="animal_cost">Hayvan Maliyet Raporu</option>
            <option value="group_cost">Grup Maliyet Raporu</option>
            <option value="weighing_pivot">Kilo Takip Raporu</option>
          </select>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden flex-1 flex flex-col p-4">
        <ReactTabulator
          data={getData()}
          columns={getColumns()}
          layout="fitColumns"
          options={{
            pagination: "local",
            paginationSize: 20,
            movableColumns: true,
            placeholder: "Veri bulunamadı",
            height: "100%"
          }}
        />
      </div>
    </div>
  );
};

export default ReportsPage;
