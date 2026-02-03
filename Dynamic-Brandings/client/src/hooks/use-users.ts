import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type CreateUserRequest, type User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

// Helper to map database row (snake_case) to User type (camelCase)
function mapDbRowToUser(row: any): User {
  return {
    id: row.id,
    idNumber: row.id_number,
    email: row.email,
    password: row.password,
    fullName: row.full_name,
    role: row.role,
    profilePicture: row.profile_picture,
    createdAt: row.created_at ? new Date(row.created_at) : null,
  };
}

export function useUsers(role?: "student" | "teacher" | "superadmin") {
  const queryKey = ["users", role];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase.from("users").select("*");
      if (role) {
        query = query.eq("role", role);
      }
      const { data, error } = await query;
      if (error) throw new Error("Failed to fetch users");
      return (data || []).map(mapDbRowToUser);
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateUserRequest) => {
      // Use the server API to create users - this ensures they're added to both
      // the users table AND Supabase Auth (using admin privileges)
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create user');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "User Created", description: "New user account has been successfully created." });
    },
    onError: (err) => {
      toast({ 
        title: "Error", 
        description: err.message, 
        variant: "destructive" 
      });
    }
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      // Use server API to delete - this ensures deletion from both
      // users table AND Supabase Auth
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete user");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "User Deleted", description: "The user account has been removed from all systems." });
    },
    onError: (err) => {
      toast({ 
        title: "Error", 
        description: err.message, 
        variant: "destructive" 
      });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CreateUserRequest> }) => {
      // Use server API to update - this ensures updates to both
      // users table AND Supabase Auth
      const response = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update user");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "User Updated", description: "User account has been successfully updated." });
    },
    onError: (err) => {
      toast({ 
        title: "Error", 
        description: err.message, 
        variant: "destructive" 
      });
    }
  });
}
