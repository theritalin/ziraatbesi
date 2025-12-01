import React, { useState, useEffect } from 'react';
import { useFarmId } from '../hooks/useFarmId';
import { supabase } from '../supabaseClient';
import { FiUsers, FiTrendingUp, FiTrendingDown, FiClipboard } from 'react-icons/fi';

const OverviewPage = () => {
  const { farmId } = useFarmId();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAnimals: 0,
    activeRations: 0,
    topOverall: [],
    topLastWeighing: [],
    bottomOverall: [],
    bottomLastWeighing: []
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

      // 1. Total animal count
      const { count: totalAnimals, error: animalsCountError } = await supabase
        .from('animals')
        .select('*', { count: 'exact', head: true })
        .eq('farm_id', farmId);

      if (animalsCountError) {
        console.error('Error fetching animal count:', animalsCountError);
      }

      // 2. Active rations count
      const today = new Date().toISOString().split('T')[0];
      const { count: activeRations } = await supabase
        .from('rations')
        .select('*', { count: 'exact', head: true })
        .eq('farm_id', farmId)
        .or(`end_date.is.null,end_date.gte.${today}`);

      // 3. Get all animals with their weights
      const { data: animals, error: animalsError } = await supabase
        .from('animals')
        .select('id, tag_number, current_weight, last_weight_kg, last_weigh_date')
        .eq('farm_id', farmId);

      if (animalsError) {
        console.error('Error fetching animals:', animalsError);
      }

      console.log('📊 Fetched animals:', animals?.length || 0, 'for farmId:', farmId);

      // DEBUG: Try fetching ALL animals (no filter) to see if RLS is the issue
      const { data: allAnimals, error: allAnimalsError } = await supabase
        .from('animals')
        .select('id, tag_number, farm_id');

      console.log('🔍 DEBUG - All animals (no filter):', allAnimals?.length || 0);
      
      // Show farm_id distribution
      const farmIdCounts = {};
      allAnimals?.forEach(a => {
        farmIdCounts[a.farm_id] = (farmIdCounts[a.farm_id] || 0) + 1;
      });
      console.log('🔍 DEBUG - Animals by farm_id:', farmIdCounts);
      console.log('🔍 DEBUG - Current farmId trying to use:', farmId);
      
      if (allAnimalsError) {
        console.error('🔍 DEBUG - Error fetching all animals:', allAnimalsError);
      }

      // Get all weighings for more accurate calculations
      const { data: weighings } = await supabase
        .from('weighings')
        .select('*')
        .eq('farm_id', farmId)
        .order('weigh_date', { ascending: true });

      // Calculate overall gain for each animal
      const animalStats = (animals || []).map(animal => {
        const animalWeighings = (weighings || []).filter(w => w.animal_id === animal.id);
        
        // Determine first weight: use first weighing, or current_weight
        let firstWeight = null;
        if (animalWeighings.length > 0) {
          firstWeight = animalWeighings[0].weight_kg;
        } else if (animal.current_weight) {
          firstWeight = animal.current_weight;
        }
        
        // Determine last weight: use last_weight_kg, or last weighing, or current_weight
        let lastWeight = null;
        if (animal.last_weight_kg) {
          lastWeight = animal.last_weight_kg;
        } else if (animalWeighings.length > 0) {
          lastWeight = animalWeighings[animalWeighings.length - 1].weight_kg;
        } else if (animal.current_weight) {
          lastWeight = animal.current_weight; // No gain yet, but animal exists
        }
        
        const overallGain = (lastWeight && firstWeight) ? lastWeight - firstWeight : 0;
        
        // Last weighing gain (difference from previous weighing)
        let lastGain = 0;
        if (animalWeighings.length >= 2) {
          lastGain = animalWeighings[animalWeighings.length - 1].weight_kg - animalWeighings[animalWeighings.length - 2].weight_kg;
        } else if (animalWeighings.length === 1 && animal.current_weight) {
          // First weighing compared to current_weight
          lastGain = animalWeighings[0].weight_kg - animal.current_weight;
        }

        return {
          tag_number: animal.tag_number,
          initialWeight: firstWeight,
          lastWeight: lastWeight,
          overallGain,
          lastGain,
          lastWeighDate: animal.last_weigh_date,
          hasWeighings: animalWeighings.length > 0
        };
      });

      // Filter: must have at least initial and last weight (even if same)
      const validAnimals = animalStats.filter(a => a.initialWeight && a.lastWeight);

      console.log('🔍 Overview Debug Info:');
      console.log('Total animals from DB:', animals?.length || 0);
      console.log('Total weighings from DB:', weighings?.length || 0);
      console.log('Animal stats calculated:', animalStats.length);
      console.log('Valid animals (with weights):', validAnimals.length);
      console.log('Sample animal stats:', animalStats.slice(0, 3));
      console.log('Sample valid animals:', validAnimals.slice(0, 3));

      // Sort and get top/bottom 3
      const topOverall = [...validAnimals].sort((a, b) => b.overallGain - a.overallGain).slice(0, 3);
      const bottomOverall = [...validAnimals].sort((a, b) => a.overallGain - b.overallGain).slice(0, 3);
      
      // For last weighing, only include animals that have at least one weighing
      const animalsWithWeighings = validAnimals.filter(a => a.hasWeighings);
      const topLastWeighing = [...animalsWithWeighings].sort((a, b) => b.lastGain - a.lastGain).slice(0, 3);
      const bottomLastWeighing = [...animalsWithWeighings].sort((a, b) => a.lastGain - b.lastGain).slice(0, 3);

      console.log('Animals with weighings:', animalsWithWeighings.length);
      console.log('Top overall:', topOverall);
      console.log('Bottom overall:', bottomOverall);
      console.log('Top last weighing:', topLastWeighing);
      console.log('Bottom last weighing:', bottomLastWeighing);

      setStats({
        totalAnimals: totalAnimals || 0,
        activeRations: activeRations || 0,
        topOverall,
        topLastWeighing,
        bottomOverall,
        bottomLastWeighing
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

  const AnimalList = ({ animals, title, icon: Icon, isBest }) => (
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
                <span className="text-sm text-gray-500 ml-2">
                  {animal.initialWeight?.toFixed(1)} kg → {animal.lastWeight?.toFixed(1)} kg
                </span>
              </div>
              <div className={`font-bold ${isBest ? 'text-green-600' : 'text-red-600'}`}>
                {animal.overallGain > 0 ? '+' : ''}{animal.overallGain.toFixed(1)} kg
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-sm">Veri bulunamadı</p>
      )}
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
          title="Toplam Hayvan Sayısı"
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

      {/* Top and Bottom Performers - Overall */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Genel Performans (Toplam Kilo Artışı)</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnimalList 
            animals={stats.topOverall}
            title="En İyi 3 Hayvan"
            icon={FiTrendingUp}
            isBest={true}
          />
          <AnimalList 
            animals={stats.bottomOverall}
            title="En Düşük 3 Hayvan"
            icon={FiTrendingDown}
            isBest={false}
          />
        </div>
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
