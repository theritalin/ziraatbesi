import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export const useFarmId = () => {
  const [farmId, setFarmId] = useState(null);
  const [availableFarms, setAvailableFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [userRole, setUserRole] = useState('user');

  const fetchFarmId = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setLoading(false);
        return null;
      }

      const userId = session.user.id;

      // Fetch all farms the user has access to
      const { data: farms, error: farmsError } = await supabase
        .from('farms')
        .select('id, name');

      if (farmsError) throw farmsError;

      setAvailableFarms(farms || []);

      let activeId = null;

      if (farms && farms.length > 0) {
        // Check localStorage for a selected farm
        const storedFarmId = localStorage.getItem('selected_farm_id');
        const storedFarm = farms.find(f => f.id.toString() === storedFarmId);

        if (storedFarm) {
          activeId = storedFarm.id;
        } else {
          // Default to the first farm
          activeId = farms[0].id;
          localStorage.setItem('selected_farm_id', activeId);
        }
        setFarmId(activeId);
      } else {
        setFarmId(null);
        activeId = null;
      }

      // Fetch Permissions for the active farm
      if (activeId) {
        // 1. Check if legacy admin in users table
        const { data: userRecord } = await supabase
          .from('users')
          .select('role, farm_id')
          .eq('id', userId)
          .single();

        if (userRecord?.role === 'admin' && userRecord.farm_id === activeId) {
          setUserRole('admin');
          setPermissions({}); // Admin has full access
        } else {
          // 2. Check farm_users
          const { data: farmUser } = await supabase
            .from('farm_users')
            .select('role, permissions')
            .eq('farm_id', activeId)
            .eq('user_id', userId)
            .single();

          if (farmUser) {
            setUserRole(farmUser.role);
            setPermissions(farmUser.permissions || {});
          } else {
            setUserRole('user');
            setPermissions({});
          }
        }
      }

      return activeId;

    } catch (err) {
      console.error('Error fetching farm ID:', err);
      setError(err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFarmId();
  }, [fetchFarmId]);

  return { farmId, availableFarms, loading, error, fetchFarmId, permissions, userRole };
};
