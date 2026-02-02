import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Attendance, type MarkAttendanceRequest } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { getPhilippineTimeISO } from "@/lib/utils";

// Helper to parse time stored as Philippine local time in the database
function parsePhilippineTime(timeString: string | null): Date | null {
  if (!timeString) return null;
  // Remove any trailing Z to prevent UTC interpretation
  // Database stores Philippine time without timezone
  const cleanedValue = timeString.replace('Z', '');
  return new Date(cleanedValue);
}

// Helper to map database row to Attendance type with extra fields
function mapDbRowToAttendance(row: any): Attendance & { studentName: string; subjectName: string } {
  return {
    id: row.id,
    studentId: row.student_id,
    subjectId: row.subject_id,
    date: row.date,
    status: row.status,
    timeIn: parsePhilippineTime(row.time_in),
    remarks: row.remarks,
    studentName: row.student?.full_name || row.users?.full_name || "Unknown",
    subjectName: row.subject?.name || row.subjects?.name || "Unknown",
  };
}

export function useAttendance(filters?: { subjectId?: number; studentId?: number; date?: string }, options?: { refetchInterval?: number }) {
  const queryKey = ["attendance", filters];
  
  return useQuery({
    queryKey,
    refetchInterval: options?.refetchInterval,
    queryFn: async () => {
      console.log('Fetching attendance with filters:', filters);
      
      // Use simpler query without explicit foreign key syntax
      // Supabase will automatically detect the relationships
      let query = supabase
        .from("attendance")
        .select(`
          *,
          student:users!student_id(full_name),
          subject:subjects!subject_id(name)
        `);
      
      if (filters?.subjectId) {
        query = query.eq("subject_id", filters.subjectId);
      }
      if (filters?.studentId) {
        console.log('Filtering by student_id:', filters.studentId, 'type:', typeof filters.studentId);
        query = query.eq("student_id", filters.studentId);
      }
      if (filters?.date) {
        query = query.eq("date", filters.date);
      }
      
      const { data, error } = await query;
      console.log('Attendance query result:', { data, error });
      if (error) {
        console.error('Supabase error:', error);
        throw new Error("Failed to fetch attendance: " + error.message);
      }
      return (data || []).map(mapDbRowToAttendance);
    },
  });
}

export function useMarkAttendance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: MarkAttendanceRequest) => {
      // Only record time_in for present or late status
      const shouldRecordTimeIn = data.status === 'present' || data.status === 'late';
      const dbData = {
        student_id: data.studentId,
        subject_id: data.subjectId,
        date: data.date,
        status: data.status,
        remarks: data.remarks,
        time_in: shouldRecordTimeIn ? getPhilippineTimeISO() : null,
      };
      
      const { data: result, error } = await supabase
        .from("attendance")
        .insert(dbData)
        .select(`
          *,
          student:users!student_id(full_name),
          subject:subjects!subject_id(name)
        `)
        .single();
      
      if (error) throw new Error("Failed to mark attendance: " + error.message);
      return mapDbRowToAttendance(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast({ title: "Success", description: "Attendance recorded successfully" });
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

export function useGenerateQR() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ subjectId, code }: { subjectId: number; code: string }) => {
      // First deactivate any existing QR codes for this subject
      await supabase
        .from("qr_codes")
        .update({ active: false })
        .eq("subject_id", subjectId);
      
      // Create new QR code
      const { data, error } = await supabase
        .from("qr_codes")
        .insert({ subject_id: subjectId, code, active: true })
        .select()
        .single();
      
      if (error) throw new Error("Failed to generate QR code");
      return data;
    },
    onSuccess: () => {
      toast({ title: "QR Code Generated", description: "Students can now scan to check in." });
    }
  });
}
