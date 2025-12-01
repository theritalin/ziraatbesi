import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

const CreateFarmPage = () => {
  const [farmName, setFarmName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleCreateFarm = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: farm, error: farmError } = await supabase
        .from('farms')
        .insert([{ name: farmName, subscription_end_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) }]) // 3 days trial
        .select();

      if (farmError) {
        setMessage(farmError.message);
      } else if (farm) {
        const { error: userError } = await supabase
          .from('users')
          .update({ farm_id: farm[0].id })
          .eq('id', user.id);

        if (userError) {
          setMessage(userError.message);
        } else {
          navigate('/dashboard');
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Create Your Farm</h2>
        <form onSubmit={handleCreateFarm}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Farm Name
            </label>
            <input
              type="text"
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-gray-700 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 transition-colors duration-300"
          >
            {loading ? 'Creating...' : 'Create Farm'}
          </button>
        </form>
        {message && <p className="mt-4 text-center text-red-500">{message}</p>}
      </div>
    </div>
  );
};

export default CreateFarmPage;
