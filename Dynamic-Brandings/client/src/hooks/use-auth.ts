import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type LoginRequest, type User } from "@shared/schema";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

// Storage key for persisting user session
const USER_STORAGE_KEY = "attendance_user";

// Helper to get stored user from localStorage
function getStoredUser(): User | null {
  try {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as User;
    }
  } catch {
    // Invalid stored data
    localStorage.removeItem(USER_STORAGE_KEY);
  }
  return null;
}

// Helper to store user in localStorage
function storeUser(user: User | null) {
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Check for existing session from localStorage
  const { data: user, isLoading } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      // Return stored user (persisted login)
      return getStoredUser();
    },
    retry: false,
    staleTime: Infinity, // Don't refetch automatically
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const { identifier, password } = credentials;
      
      // Query the users table directly via Supabase
      // Try to find user by email first, then by ID number
      let { data: userData, error } = await supabase
        .from("users")
        .select("*")
        .or(`email.eq.${identifier},id_number.eq.${identifier}`)
        .single();

      if (error || !userData) {
        throw new Error("Invalid email/ID number or password");
      }

      // Verify password (currently plaintext comparison - matches your existing backend)
      // Note: In production, you should use proper password hashing
      if (userData.password !== password) {
        throw new Error("Invalid email/ID number or password");
      }

      // Also authenticate with Express server to establish session cookie
      // This is needed for admin operations (create/update/delete users)
      try {
        await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ identifier, password }),
        });
      } catch (e) {
        console.warn("Express login failed (non-blocking):", e);
      }

      // Map database columns to User type (handle snake_case to camelCase)
      const user: User = {
        id: userData.id,
        idNumber: userData.id_number,
        email: userData.email,
        password: userData.password,
        fullName: userData.full_name,
        role: userData.role,
        profilePicture: userData.profile_picture,
        createdAt: userData.created_at ? new Date(userData.created_at) : null,
      };

      return user;
    },
    onSuccess: (user) => {
      // Store user in localStorage for persistence
      storeUser(user);
      queryClient.setQueryData(["auth-user"], user);
      toast({ title: "Welcome back!", description: `Logged in as ${user.fullName}` });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Clear localStorage
      storeUser(null);
      
      // Also logout from Express server
      try {
        await fetch('/api/logout', {
          method: 'POST',
          credentials: 'include',
        });
      } catch (e) {
        console.warn("Express logout failed (non-blocking):", e);
      }
      
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.setQueryData(["auth-user"], null);
      queryClient.clear();
      setLocation("/login");
      toast({ title: "Logged out", description: "See you next time!" });
    },
  });

  const refreshUser = async () => {
    // Re-fetch user data from database if we have a stored user
    const storedUser = getStoredUser();
    if (storedUser?.id) {
      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("id", storedUser.id)
        .single();
      
      if (userData) {
        const user: User = {
          id: userData.id,
          idNumber: userData.id_number,
          email: userData.email,
          password: userData.password,
          fullName: userData.full_name,
          role: userData.role,
          profilePicture: userData.profile_picture,
          createdAt: userData.created_at ? new Date(userData.created_at) : null,
        };
        storeUser(user);
        queryClient.setQueryData(["auth-user"], user);
      }
    }
  };

  return {
    user,
    isLoading,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    refreshUser,
  };
}
