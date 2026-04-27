import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateAnimalsGroupHistory() {
  console.log('Starting group_history migration...');

  // Fetch all animals
  const { data: animals, error } = await supabase
    .from('animals')
    .select('id, group_id, birth_date, group_history');

  if (error) {
    console.error('Error fetching animals:', error);
    return;
  }

  let updatedCount = 0;

  for (const animal of animals) {
    // If animal has a group but NO group_history, or empty group_history
    if (animal.group_id && (!animal.group_history || animal.group_history.length === 0)) {
      // Create initial history entry using birth_date (or a default past date if missing)
      const startDate = animal.birth_date || new Date('2023-01-01').toISOString().split('T')[0];
      
      const newHistory = [{
        group_id: animal.group_id,
        date: startDate
      }];

      const { error: updateError } = await supabase
        .from('animals')
        .update({ group_history: newHistory })
        .eq('id', animal.id);

      if (updateError) {
        console.error(`Error updating animal ${animal.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`Migration completed! Updated ${updatedCount} animals.`);
}

migrateAnimalsGroupHistory();
