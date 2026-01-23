import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateUserRequest, type User } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useUsers(role?: "student" | "teacher" | "superadmin") {
  const queryKey = [api.users.list.path, role];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      let url = api.users.list.path;
      if (role) {
        url += `?role=${role}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch users");
      return api.users.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateUserRequest) => {
      const validated = api.users.create.input.parse(data);
      const res = await fetch(api.users.create.path, {
        method: api.users.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create user");
      }
      return api.users.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.users.list.path] });
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
      const url = buildUrl(api.users.delete.path, { id });
      const res = await fetch(url, {
        method: api.users.delete.method,
      });
      
      if (!res.ok) throw new Error("Failed to delete user");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.users.list.path] });
      toast({ title: "User Deleted", description: "The user account has been removed." });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CreateUserRequest> }) => {
      const url = buildUrl(api.users.update.path, { id });
      const res = await fetch(url, {
        method: api.users.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update user");
      }
      return api.users.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.users.list.path] });
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
