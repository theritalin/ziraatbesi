import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const PrivateRoute = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [farmStatus, setFarmStatus] = useState('checking'); // checking, no_farm, active, expired
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const checkAuthAndFarm = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (!session) {
          setSession(null);
          setLoading(false);
          return;
        }

        setSession(session);

        // Check user profile for farm_id
        let { data: userProfile, error: userError } = await supabase
          .from('users')
          .select('farm_id')
          .eq('id', session.user.id)
          .single();

        if (userError || !userProfile?.farm_id) {
          // Fallback 1: Check if user is in farm_users by user_id
          let { data: farmUser } = await supabase
            .from('farm_users')
            .select('farm_id')
            .eq('user_id', session.user.id)
            .limit(1)
            .single();

          // Fallback 2: Check if user is in farm_users by email (invite)
          if (!farmUser && session.user.email) {
             // Try to claim invites first
             await supabase.rpc('claim_my_invites');
             
             // Now try to fetch again by user_id
             const { data: claimedUser } = await supabase
              .from('farm_users')
              .select('farm_id')
              .eq('user_id', session.user.id)
              .limit(1)
              .single();
             
             if (claimedUser) {
               farmUser = claimedUser;
             }
          }

          if (farmUser) {
            // Found a farm, update users table to set this as active farm
            await supabase
              .from('users')
              .update({ farm_id: farmUser.farm_id })
              .eq('id', session.user.id);
            
            userProfile = { farm_id: farmUser.farm_id };
          } else {
            setFarmStatus('no_farm');
            setLoading(false);
            return;
          }
        }

        // Check farm subscription
        const { data: farm, error: farmError } = await supabase
          .from('farms')
          .select('subscription_end_date')
          .eq('id', userProfile.farm_id)
          .single();

        if (farmError || !farm) {
          // If we have a farm_id but can't fetch the farm, it might be an RLS issue or deleted farm.
          // However, we shouldn't redirect to create-farm if we HAVE a farm_id.
          // Let's assume active for now to allow access to Dashboard (where we can fix things).
          console.warn('Farm found in profile but fetch failed:', farmError);
          setFarmStatus('active'); 
        } else {
          const endDate = new Date(farm.subscription_end_date);
          const now = new Date();
          if (endDate < now) {
            setFarmStatus('expired');
          } else {
            setFarmStatus('active');
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    checkAuthAndFarm();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSession(session);
        if (!session) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  // If user has no farm, redirect to create farm page
  // But allow access if they are already on the create farm page
  if (farmStatus === 'no_farm') {
    if (location.pathname !== '/create-farm') {
      return <Navigate to="/create-farm" replace />;
    }
  }

  // If subscription is expired, show warning (Block access)
  // You might want to allow access to a renewal page, but for now we block
  if (farmStatus === 'expired') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center border border-red-100">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Abonelik Süresi Doldu</h2>
          <p className="text-gray-600 mb-6">
            Çiftlik yönetim sistemine erişiminiz kısıtlanmıştır. Lütfen aboneliğinizi uzatmak için <span className="font-bold text-gray-800">bsckbilgi@gmail.com</span> ile iletişime geçin.
          </p>
          {/* <button className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors">
            Aboneliği Yenile
          </button> */}
        </div>
      </div>
    );
  }

  return children;
};

export default PrivateRoute;
