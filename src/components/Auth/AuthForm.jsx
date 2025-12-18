import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import Input from './Input';

const AuthForm = ({ type }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', content: '' });
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && type === 'login') {
        navigate('/dashboard');
      }
    };
    checkSession();
  }, [navigate, type]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', content: '' });

    const { data, error } =
      type === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ 
            email, 
            password,
            options: {
              emailRedirectTo: window.location.origin
            }
          });

    if (error) {
      setMessage({ type: 'error', content: error.message });
    } else {
      if (type === 'login') {
        setMessage({ type: 'success', content: 'Giriş başarılı! Yönlendiriliyorsunuz...' });
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        // Sync user to public.users table
        if (data?.user) {
          const { error: userError } = await supabase
            .from('users')
            .insert([{ id: data.user.id, email: email }]);

          if (userError) {
            console.error('Error creating user profile:', userError);
          }
        }

        setMessage({
          type: 'success',
          content: 'Kayıt başarılı! Lütfen e-postanızı kontrol edin.',
        });
      }
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
        {type === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
      </h2>

      {message.content && (
        <div
          className={`p-4 mb-4 rounded-lg text-sm ${
            message.type === 'error'
              ? 'bg-red-50 text-red-600 border border-red-200'
              : 'bg-green-50 text-green-600 border border-green-200'
          }`}
        >
          {message.content}
        </div>
      )}

      <form onSubmit={handleAuth} className="space-y-5">
        <Input
          label="E-posta"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ornek@ziraatbesi.com"
        />
        <Input
          label="Şifre"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-colors duration-200 ${
            loading
              ? 'bg-green-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 shadow-md hover:shadow-lg'
          }`}
        >
          {loading
            ? 'İşlem yapılıyor...'
            : type === 'login'
            ? 'Giriş Yap'
            : 'Kayıt Ol'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        {type === 'login' ? (
          <>
            Hesabınız yok mu?{' '}
            <Link
              to="/register"
              className="text-green-600 hover:text-green-700 font-medium hover:underline"
            >
              Kayıt Olun
            </Link>
          </>
        ) : (
          <>
            Zaten hesabınız var mı?{' '}
            <Link
              to="/"
              className="text-green-600 hover:text-green-700 font-medium hover:underline"
            >
              Giriş Yapın
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthForm;