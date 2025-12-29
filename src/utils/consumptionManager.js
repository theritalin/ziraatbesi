import { supabase } from '../supabaseClient';

/**
 * Calculates the daily consumption for a ration based on the number of animals in its group.
 * @param {object} ration - The ration object (must include content, group_id).
 * @param {number} animalCount - Number of animals in the group.
 * @returns {object} - Map of feed_id to total amount (kg).
 */
export const calculateDailyConsumption = (ration, animalCount) => {
  const consumption = {};
  if (!ration.content || !Array.isArray(ration.content) || !animalCount) return consumption;

  ration.content.forEach(item => {
    if (item.feed_id && item.amount) {
      consumption[item.feed_id] = (consumption[item.feed_id] || 0) + (item.amount * animalCount);
    }
  });
  return consumption;
};

/**
 * Restores stock when a ration is deleted.
 * Calculates consumption from start_date to today (or end_date) and adds it back to feeds.
 * Now respects animal active/passive status day-by-day.
 * @param {object} ration - The ration to be deleted.
 */
export const restoreRationStock = async (ration) => {
  if (!ration.start_date || !ration.group_id) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Fetch all animals for this group to calculate accurate history
    const { data: animals, error: animalsError } = await supabase
        .from('animals')
        .select('id, birth_date, status, passive_date')
        .eq('group_id', ration.group_id);

    if (animalsError || !animals) return;

    const start = new Date(ration.start_date);
    const end = ration.end_date ? new Date(ration.end_date) : new Date();
    // Cap end date at today if ration is still active
    const today = new Date();
    const actualEnd = end > today ? today : end;
    
    // Iterate day by day
    const currentDate = new Date(start);
    const consumptionTotals = {}; // feed_id -> total amount

    while (currentDate <= actualEnd) {
        // Count valid animals for this day
        const dayStr = currentDate.toISOString().split('T')[0];
        const dayTime = currentDate.getTime();

        const validCount = animals.filter(animal => {
            const birthDate = new Date(animal.birth_date).getTime();
            if (birthDate > dayTime) return false; // Born after this day
            
            if (animal.status === 'passive') {
                const passiveDate = new Date(animal.passive_date).getTime();
                // If passive_date is BEFORE or ON this day, don't count?
                // Req: "o tarih itibari ile ... hesaplama yapılmasın" -> If passive date is Today, stop.
                // So if passiveDate <= dayTime, return false.
                if (animal.passive_date && passiveDate <= dayTime) return false;
            }
            return true;
        }).length;

        if (validCount > 0) {
            const daily = calculateDailyConsumption(ration, validCount);
            for (const [feedId, amount] of Object.entries(daily)) {
                consumptionTotals[feedId] = (consumptionTotals[feedId] || 0) + amount;
            }
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Restore stock
    for (const [feedId, totalAmount] of Object.entries(consumptionTotals)) {
        const { data: currentFeed } = await supabase
            .from('feeds')
            .select('current_stock_kg')
            .eq('id', feedId)
            .single();

        if (currentFeed) {
            await supabase
                .from('feeds')
                .update({ current_stock_kg: currentFeed.current_stock_kg + totalAmount })
                .eq('id', feedId);
        }
    }
    console.log(`Restored stock for ration ${ration.name}`);

  } catch (error) {
    console.error('Error restoring ration stock:', error);
    throw error;
  }
};

/**
 * Processes daily consumption for all active rations.
 * Should be called on app load.
 * Checks for missing daily logs and fills them in.
 */
export const processDailyConsumption = async (farmId) => {
    if (!farmId) return;

    try {
        // 1. Check last log date
        const { data: lastLog } = await supabase
            .from('daily_logs')
            .select('date')
            .eq('farm_id', farmId)
            .order('date', { ascending: false })
            .limit(1)
            .single();

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let lastDate = lastLog ? new Date(lastLog.date) : new Date();
        // If no logs exist, assume we start tracking from today (or don't backfill indefinitely)
        if (!lastLog) {
             // For first run, maybe just log today? Or do nothing until tomorrow?
             // Let's assume we log today if it's not logged.
             lastDate = new Date();
             lastDate.setDate(lastDate.getDate() - 1); // Pretend last log was yesterday
        }
        
        lastDate.setHours(0,0,0,0);

        // If last log is today, nothing to do
        if (lastDate.getTime() >= today.getTime()) return;

        // 2. Fetch active rations
        const { data: rations } = await supabase
            .from('rations')
            .select('*')
            .eq('farm_id', farmId)
            .is('end_date', null); // Only active rations

        if (!rations || rations.length === 0) return;

        // Fetch ALL animals for the farm once to optimize
        const { data: allAnimals, error: animalsError } = await supabase
            .from('animals')
            .select('id, group_id, birth_date, status, passive_date')
            .eq('farm_id', farmId);

        if (animalsError) {
             console.error('Error fetching animals for consumption:', animalsError);
             return;
        }

        // 3. Loop through missing days
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + 1);

        while (nextDate <= today) {
            console.log('Processing daily consumption for:', nextDate.toISOString().split('T')[0]);
            const dayTime = nextDate.getTime();
            
            let dailyTotalCost = 0;
            const dailyFeedConsumption = {}; // feed_id -> amount

            for (const ration of rations) {
                // Skip if ration started after this date
                if (ration.start_date && new Date(ration.start_date) > nextDate) continue;

                if (ration.group_id) {
                    // Filter animals for this group and date
                    const validCount = allAnimals.filter(a => {
                        if (a.group_id !== ration.group_id) return false;
                        
                        const birthDate = new Date(a.birth_date).getTime();
                        if (birthDate > dayTime) return false;

                        if (a.status === 'passive') {
                             const passiveDate = new Date(a.passive_date).getTime();
                             // If passive date is <= current day, exclude
                             if (a.passive_date && passiveDate <= dayTime) return false;
                        }
                        return true;
                    }).length;
                    
                    if (validCount > 0) {
                        const consumption = calculateDailyConsumption(ration, validCount);
                        for (const [feedId, amount] of Object.entries(consumption)) {
                            dailyFeedConsumption[feedId] = (dailyFeedConsumption[feedId] || 0) + amount;
                        }
                    }
                }
            }

            // 4. Update stocks and calculate cost
            // Fetch feeds to get prices and current stock
            const { data: feeds, error: feedsError } = await supabase.from('feeds').select('*').eq('farm_id', farmId);
            
            if (feedsError || !feeds) {
                console.error('Error fetching feeds for daily processing:', feedsError);
                continue; // Skip this day if feeds can't be fetched
            }
            
            for (const [feedId, amount] of Object.entries(dailyFeedConsumption)) {
                const feed = feeds.find(f => f.id === parseInt(feedId));
                if (feed) {
                    dailyTotalCost += (amount * feed.price_per_kg);
                    
                    // Update stock
                    await supabase
                        .from('feeds')
                        .update({ current_stock_kg: feed.current_stock_kg - amount })
                        .eq('id', feedId);
                    
                    // Update local feed object for next iteration if needed (though we refetch or just decrement)
                    feed.current_stock_kg -= amount; 
                }
            }

            // 5. Create Daily Log
            await supabase.from('daily_logs').insert([{
                farm_id: farmId,
                date: nextDate.toISOString().split('T')[0],
                total_feed_cost: dailyTotalCost,
                operational_cost: 0 // Placeholder
            }]);

            nextDate.setDate(nextDate.getDate() + 1);
        }

    } catch (error) {
        console.error('Error processing daily consumption:', error);
    }
};
