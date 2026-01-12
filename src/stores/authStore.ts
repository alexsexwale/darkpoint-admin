import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import type { AdminUser } from '@/types';

interface AuthState {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          // Authenticate with Supabase
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (authError) {
            set({ error: authError.message, isLoading: false });
            return false;
          }

          if (!authData.user) {
            set({ error: 'Authentication failed', isLoading: false });
            return false;
          }

          // Check if user is an admin
          const { data: adminUser, error: adminError } = await supabase
            .from('admin_users')
            .select('*')
            .eq('id', authData.user.id)
            .single();

          if (adminError || !adminUser) {
            await supabase.auth.signOut();
            set({ error: 'You do not have admin access', isLoading: false });
            return false;
          }

          set({
            user: adminUser as AdminUser,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          return true;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Login failed';
          set({ error: message, isLoading: false });
          return false;
        }
      },

      logout: async () => {
        await supabase.auth.signOut();
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      checkAuth: async () => {
        set({ isLoading: true });
        
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session?.user) {
            set({ isAuthenticated: false, user: null, isLoading: false });
            return;
          }

          // Verify admin status
          const { data: adminUser } = await supabase
            .from('admin_users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (!adminUser) {
            await supabase.auth.signOut();
            set({ isAuthenticated: false, user: null, isLoading: false });
            return;
          }

          set({
            user: adminUser as AdminUser,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          set({ isAuthenticated: false, user: null, isLoading: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'admin-auth',
      partialize: (state) => ({ 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);

