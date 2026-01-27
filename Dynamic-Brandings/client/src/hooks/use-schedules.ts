import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import type { InsertSchedule, Schedule } from "@shared/schema";

// Helper to map database row to Schedule type
function mapDbRowToSchedule(row: any): Schedule & { subjectName?: string; subjectCode?: string } {
  return {
    id: row.id,
    subjectId: row.subject_id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    room: row.room,
    subjectName: row.subjects?.name,
    subjectCode: row.subjects?.code,
  };
}

export function useTeacherSchedules() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["teacher-schedules"],
    queryFn: async () => {
      // TEMP: Get all schedules
      const { data, error } = await supabase
        .from("schedules")
        .select("*");
      
      if (error) {
        console.error("Failed to fetch schedules:", error);
        throw new Error("Failed to fetch schedules");
      }
      
      // Get subject info for all schedules
      const subjectIds = [...new Set(data?.map(s => s.subject_id) || [])];
      const { data: subjects, error: subjectsError } = await supabase
        .from("subjects")
        .select("id, name, code")
        .in("id", subjectIds);
      
      const subjectMap = subjects?.reduce((acc, s) => {
        acc[s.id] = { name: s.name, code: s.code };
        return acc;
      }, {} as Record<number, { name: string; code: string }>) || {};
      
      // Map data with subject info
      return (data || []).map(row => ({
        id: row.id,
        subjectId: row.subject_id,
        dayOfWeek: row.day_of_week,
        startTime: row.start_time,
        endTime: row.end_time,
        room: row.room,
        subjectName: subjectMap[row.subject_id]?.name,
        subjectCode: subjectMap[row.subject_id]?.code,
      }));
    },
    enabled: true,
  });
}

export function useSubjectSchedules(subjectId: number) {
  return useQuery({
    queryKey: ["subject-schedules", subjectId],
    queryFn: async () => {
      // First get the subject info
      const { data: subject, error: subjectError } = await supabase
        .from("subjects")
        .select("name, code")
        .eq("id", subjectId)
        .single();
      
      if (subjectError) {
        console.error("Failed to fetch subject:", subjectError);
      }
      
      // Then get schedules
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .eq("subject_id", subjectId);
      
      if (error) {
        console.error("Failed to fetch schedules:", error);
        throw new Error("Failed to fetch schedules");
      }
      
      return (data || []).map(row => ({
        id: row.id,
        subjectId: row.subject_id,
        dayOfWeek: row.day_of_week,
        startTime: row.start_time,
        endTime: row.end_time,
        room: row.room,
        subjectName: subject?.name,
        subjectCode: subject?.code,
      }));
    },
    enabled: !!subjectId,
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertSchedule) => {
      const dbData = {
        subject_id: data.subjectId,
        day_of_week: data.dayOfWeek,
        start_time: data.startTime,
        end_time: data.endTime,
        room: data.room,
      };
      
      const { data: result, error } = await supabase
        .from("schedules")
        .insert(dbData)
        .select("*")
        .single();
      
      if (error) {
        console.error("Failed to create schedule:", error);
        throw new Error("Failed to create schedule");
      }
      
      return {
        id: result.id,
        subjectId: result.subject_id,
        dayOfWeek: result.day_of_week,
        startTime: result.start_time,
        endTime: result.end_time,
        room: result.room,
      };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teacher-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["subject-schedules", variables.subjectId] });
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
      const { error } = await supabase
        .from("schedules")
        .delete()
        .eq("id", id);
      
      if (error) throw new Error("Failed to delete schedule");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["subject-schedules"] });
      toast({ title: "Schedule Deleted", description: "Schedule has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete schedule.", variant: "destructive" });
    },
  });
}
