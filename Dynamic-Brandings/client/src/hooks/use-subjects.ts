import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type CreateSubjectRequest, type Subject, type User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

// Helper to map database row (snake_case) to Subject type (camelCase)
function mapDbRowToSubject(row: any): Subject {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    teacherId: row.teacher_id,
    description: row.description,
  };
}

// Helper to map database row to User type
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

export function useSubjects() {
  return useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("*");
      if (error) throw new Error("Failed to fetch subjects");
      return (data || []).map(mapDbRowToSubject);
    },
  });
}

// Fetch only subjects that a specific student is enrolled in
export function useStudentSubjects(studentId: number | undefined) {
  return useQuery({
    queryKey: ["student-subjects", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      
      // Get enrolled subject IDs for this student
      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select("subject_id")
        .eq("student_id", studentId);
      
      if (enrollError) throw new Error("Failed to fetch enrollments");
      
      if (!enrollments || enrollments.length === 0) {
        return [];
      }
      
      // Get subject details for enrolled subjects
      const subjectIds = enrollments.map(e => e.subject_id);
      const { data: subjects, error: subjectsError } = await supabase
        .from("subjects")
        .select("*")
        .in("id", subjectIds);
      
      if (subjectsError) throw new Error("Failed to fetch subjects");
      return (subjects || []).map(mapDbRowToSubject);
    },
    enabled: !!studentId,
  });
}

export function useSubject(id: number) {
  return useQuery({
    queryKey: ["subjects", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw new Error("Failed to fetch subject");
      return mapDbRowToSubject(data);
    },
    enabled: !!id,
  });
}

export function useSubjectStudents(subjectId: number) {
  return useQuery({
    queryKey: ["subject-students", subjectId],
    queryFn: async () => {
      // Get enrolled student IDs
      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("subject_id", subjectId);
      
      if (enrollError) throw new Error("Failed to fetch enrollments");
      
      if (!enrollments || enrollments.length === 0) {
        return [];
      }
      
      // Get user details for enrolled students
      const studentIds = enrollments.map(e => e.student_id);
      const { data: students, error: studentsError } = await supabase
        .from("users")
        .select("*")
        .in("id", studentIds);
      
      if (studentsError) throw new Error("Failed to fetch students");
      return (students || []).map(mapDbRowToUser);
    },
    enabled: !!subjectId,
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateSubjectRequest) => {
      const dbData = {
        name: data.name,
        code: data.code,
        teacher_id: data.teacherId,
        description: data.description,
      };
      
      const { data: result, error } = await supabase
        .from("subjects")
        .insert(dbData)
        .select()
        .single();
      
      if (error) throw new Error("Failed to create subject");
      return mapDbRowToSubject(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast({ title: "Subject Created", description: "New subject has been added to the catalog." });
    },
  });
}

export function useEnrollStudent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ subjectId, studentId }: { subjectId: number; studentId: number }) => {
      const { data, error } = await supabase
        .from("enrollments")
        .insert({ subject_id: subjectId, student_id: studentId })
        .select()
        .single();
      
      if (error) throw new Error("Failed to enroll student");
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["subject-students", variables.subjectId] });
      toast({ title: "Enrolled", description: "Student successfully enrolled in the subject." });
    },
  });
}
