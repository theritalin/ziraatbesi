import AuthForm from '../components/Auth/AuthForm';
import { GiCow } from 'react-icons/gi';

const RegisterPage = () => {
  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Side - Image (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-green-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/90 to-black/50 z-10" />
        <img 
          src="https://images.unsplash.com/photo-1516467508483-a7212febe31a?q=80&w=2073&auto=format&fit=crop" 
          alt="Cows in field" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative z-20 flex flex-col justify-center px-12 text-white h-full">
          <div className="flex items-center mb-6">
            <GiCow className="text-6xl text-green-400" />
            <h1 className="ml-4 text-5xl font-bold tracking-tight">ZiraatBesi</h1>
          </div>
          <p className="text-xl text-gray-200 max-w-md leading-relaxed">
            Hemen ücretsiz hesabınızı oluşturun ve çiftliğinizi profesyonelce yönetmeye başlayın.
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-16 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center mb-8">
            <GiCow className="text-5xl text-green-600" />
            <h1 className="ml-3 text-3xl font-bold text-gray-800">Ziraat Besi</h1>
          </div>
          
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-gray-900">Kayıt Ol</h2>
            <p className="mt-2 text-gray-600">Yeni bir hesap oluşturarak aramıza katılın.</p>
          </div>

          <AuthForm type="register" />
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
