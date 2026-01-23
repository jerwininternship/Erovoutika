import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import type { InsertSchedule } from "@shared/schema";

export function useTeacherSchedules() {
  return useQuery({
    queryKey: [api.schedules.listByTeacher.path],
    queryFn: async () => {
      const res = await fetch(api.schedules.listByTeacher.path);
      if (!res.ok) throw new Error("Failed to fetch schedules");
      return api.schedules.listByTeacher.responses[200].parse(await res.json());
    },
  });
}

export function useSubjectSchedules(subjectId: number) {
  return useQuery({
    queryKey: [api.schedules.listBySubject.path, subjectId],
    queryFn: async () => {
      const url = buildUrl(api.schedules.listBySubject.path, { id: subjectId });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch schedules");
      return api.schedules.listBySubject.responses[200].parse(await res.json());
    },
    enabled: !!subjectId,
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertSchedule) => {
      const validated = api.schedules.create.input.parse(data);
      const res = await fetch(api.schedules.create.path, {
        method: api.schedules.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      
      if (!res.ok) throw new Error("Failed to create schedule");
      return api.schedules.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.schedules.listByTeacher.path] });
      queryClient.invalidateQueries({ queryKey: [api.schedules.listBySubject.path, variables.subjectId] });
      toast({ title: "Schedule Created", description: "New schedule has been added." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create schedule.", variant: "destructive" });
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.schedules.delete.path, { id });
      const res = await fetch(url, {
        method: api.schedules.delete.method,
      });
      
      if (!res.ok) throw new Error("Failed to delete schedule");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.schedules.listByTeacher.path] });
      // Invalidate all subject schedule queries
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0] === api.schedules.listBySubject.path 
      });
      toast({ title: "Schedule Deleted", description: "Schedule has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete schedule.", variant: "destructive" });
    },
  });
}
