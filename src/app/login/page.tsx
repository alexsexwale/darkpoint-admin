'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff } from 'react-icons/hi';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setIsSubmitting(true);
    clearError();
    
    const success = await login(email, password);
    
    if (success) {
      router.push('/');
    }
    
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-dark-1 flex items-center justify-center p-4">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-dark-1 via-dark-2 to-dark-1 opacity-50" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-main-1/10 via-transparent to-transparent" />
      
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-main-1 to-amber-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-main-1/20">
            <span className="text-white font-bold text-2xl">D</span>
          </div>
          <h1 className="font-heading text-2xl text-gray-1 tracking-wider">DARKPOINT</h1>
          <p className="text-gray-5 text-sm mt-1">Admin Dashboard</p>
        </div>

        {/* Login Card */}
        <div className="bg-dark-2 border border-dark-4 rounded-xl p-8 shadow-xl">
          <h2 className="font-heading text-xl text-gray-1 text-center mb-6 tracking-wide">Sign In</h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400 text-center">{error}</p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-1 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <HiOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@darkpoint.co.za"
                  className="w-full pl-10 pr-4 py-3 bg-dark-3 border border-dark-4 rounded-lg text-gray-1 placeholder:text-gray-5 focus:outline-none focus:border-main-1 focus:ring-2 focus:ring-main-1/20 transition-all"
                  required
                />
              </div>
            </div>
            
            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-1 mb-1.5">
                Password
              </label>
              <div className="relative">
                <HiOutlineLockClosed className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 bg-dark-3 border border-dark-4 rounded-lg text-gray-1 placeholder:text-gray-5 focus:outline-none focus:border-main-1 focus:ring-2 focus:ring-main-1/20 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-5 hover:text-gray-1 transition-colors"
                >
                  {showPassword ? (
                    <HiOutlineEyeOff className="w-5 h-5" />
                  ) : (
                    <HiOutlineEye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
            
            {/* Submit */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-6"
              isLoading={isSubmitting}
            >
              Sign In
            </Button>
          </form>
        </div>
        
        {/* Footer */}
        <p className="text-center text-gray-5 text-xs mt-6">
          © {new Date().getFullYear()} Darkpoint. Admin access only.
        </p>
      </div>
    </div>
  );
}

