import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button, Input } from '../components/ui/Components';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      if (formData.email && formData.password.length >= 6) {
        localStorage.setItem('token', 'fake-jwt-token');
        navigate('/dashboard');
      } else {
        setError('Credenciais inválidas. Tente novamente.');
      }
    }, 1500);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left Column - Brand */}
      <div className="w-full md:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 p-8 md:p-12 flex flex-col justify-center items-center text-white relative overflow-hidden">
        <div className="relative z-10 text-center">
          <div className="mb-6 inline-flex p-4 bg-white/10 rounded-full backdrop-blur-sm">
            <ShieldCheck className="h-16 w-16 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">SISTEMA DE PLANOS</h1>
          <p className="text-blue-100 text-lg max-w-md mx-auto">
            Gestão completa de planos funerários, assinaturas e clientes em uma única plataforma.
          </p>
        </div>
        {/* Abstract shapes */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />
      </div>

      {/* Right Column - Form */}
      <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-bold text-gray-900">Bem-vindo de volta</h2>
            <p className="text-gray-600 mt-2">Acesse sua conta para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="seu@email.com"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
              
              <div className="relative">
                <Input
                  label="Senha"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                Lembrar-me
              </label>
              <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                Esqueci minha senha
              </a>
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" loading={isLoading}>
              Entrar
            </Button>
          </form>
          
          <div className="text-center text-sm text-gray-500">
            Não tem uma conta? <a href="#" className="text-blue-600 font-medium">Contate o admin</a>
          </div>
        </div>
      </div>
    </div>
  );
};