import { supabase } from '../supabaseClient';

export const seedAnimals = async (farmId) => {
  const animals = [
    { tag_number: 'TR001', current_weight: 450, birth_date: '2022-01-15', group_id: null, farm_id: farmId },
    { tag_number: 'TR002', current_weight: 470, birth_date: '2022-02-20', group_id: null, farm_id: farmId },
    { tag_number: 'TR003', current_weight: 430, birth_date: '2022-03-10', group_id: null, farm_id: farmId },
    { tag_number: 'TR004', current_weight: 500, birth_date: '2021-12-05', group_id: null, farm_id: farmId },
    { tag_number: 'TR005', current_weight: 480, birth_date: '2022-01-01', group_id: null, farm_id: farmId },
    { tag_number: 'TR006', current_weight: 460, birth_date: '2022-02-15', group_id: null, farm_id: farmId },
    { tag_number: 'TR007', current_weight: 440, birth_date: '2022-03-05', group_id: null, farm_id: farmId },
    { tag_number: 'TR008', current_weight: 510, birth_date: '2021-11-20', group_id: null, farm_id: farmId },
    { tag_number: 'TR009', current_weight: 490, birth_date: '2022-01-10', group_id: null, farm_id: farmId },
    { tag_number: 'TR010', current_weight: 455, birth_date: '2022-02-25', group_id: null, farm_id: farmId },
  ];

  try {
    const { data, error } = await supabase
      .from('animals')
      .insert(animals)
      .select();

    if (error) {
      console.error('Supabase error seeding animals:', error);
      throw error;
    }
    return { success: true, data };
  } catch (error) {
    console.error('Error seeding animals:', error);
    return { success: false, error };
  }
};
