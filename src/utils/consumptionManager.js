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
 * @param {object} ration - The ration to be deleted.
 */
export const restoreRationStock = async (ration) => {
  if (!ration.start_date || !ration.group_id) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Get animal count (approximate, using current count)
    // ideally we would need historical count, but for MVP current count is acceptable approximation
    const { count, error: countError } = await supabase
        .from('animals')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', ration.group_id);

    if (countError || !count) return;

    const start = new Date(ration.start_date);
    const end = ration.end_date ? new Date(ration.end_date) : new Date();
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return;

    const consumption = calculateDailyConsumption(ration, count);

    // Restore stock
    for (const [feedId, amount] of Object.entries(consumption)) {
        const totalRestoration = amount * diffDays;
        
        const { data: currentFeed } = await supabase
            .from('feeds')
            .select('current_stock_kg')
            .eq('id', feedId)
            .single();

        if (currentFeed) {
            await supabase
                .from('feeds')
                .update({ current_stock_kg: currentFeed.current_stock_kg + totalRestoration })
                .eq('id', feedId);
        }
    }
    console.log(`Restored stock for ration ${ration.name}: ${diffDays} days`);

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

        // 3. Loop through missing days
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + 1);

        while (nextDate <= today) {
            console.log('Processing daily consumption for:', nextDate.toISOString().split('T')[0]);
            
            let dailyTotalCost = 0;
            const dailyFeedConsumption = {}; // feed_id -> amount

            for (const ration of rations) {
                // Skip if ration started after this date
                if (ration.start_date && new Date(ration.start_date) > nextDate) continue;

                if (ration.group_id) {
                     const { count } = await supabase
                        .from('animals')
                        .select('*', { count: 'exact', head: true })
                        .eq('group_id', ration.group_id);
                    
                    if (count > 0) {
                        const consumption = calculateDailyConsumption(ration, count);
                        for (const [feedId, amount] of Object.entries(consumption)) {
                            dailyFeedConsumption[feedId] = (dailyFeedConsumption[feedId] || 0) + amount;
                            
                            // Calculate cost (need feed price)
                            // Optimization: Fetch feeds once outside loop
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
