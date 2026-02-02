import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSubjects, useSubjectStudents } from "@/hooks/use-subjects";
import { useTeacherSchedules } from "@/hooks/use-schedules";
import { useAttendance } from "@/hooks/use-attendance";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getPhilippineTimeISO } from "@/lib/utils";
import { 
  Search,
  Users,
  CheckCircle2,
  QrCode,
  Play,
  Square,
  Pause,
  RefreshCw,
  Loader2
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { v4 as uuidv4 } from "uuid";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";

type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused' | null;

interface StudentAttendance {
  studentId: number;
  studentName: string;
  timeIn: string | null;
  status?: AttendanceStatus; // Made optional for new sessions
}

export default function Attendance() {
  const { user } = useAuth();
  const { data: subjects } = useSubjects();
  const { data: schedules } = useTeacherSchedules();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  // Session states: 'inactive' | 'active' | 'paused'
  const [sessionState, setSessionState] = useState<'inactive' | 'active' | 'paused'>('inactive');
  const [wasResumed, setWasResumed] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [attendanceRecords, setAttendanceRecords] = useState<StudentAttendance[]>([]);
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  
  // QR Code state
  const [currentQRToken, setCurrentQRToken] = useState<string>("");
  const [scanCount, setScanCount] = useState(0);
  const [lastAttendanceCount, setLastAttendanceCount] = useState(0);
  
  // Track if session was ended (show Resume instead of Start)
  const [sessionEnded, setSessionEnded] = useState(false);

  // Restore FULL session state from localStorage on mount (runs once)
  useEffect(() => {
    const savedSession = localStorage.getItem('attendanceSession');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        const sessionDate = session.date;
        const today = format(new Date(), 'yyyy-MM-dd');
        
        // Only restore if it's from today
        if (sessionDate === today) {
          setSelectedSubjectId(session.subjectId || "");
          setSessionState(session.sessionState || 'inactive');
          setWasResumed(session.wasResumed || false);
          setCurrentQRToken(session.qrToken || "");
          setScanCount(session.scanCount || 0);
          setSessionEnded(session.sessionEnded || false);
          // Restore attendance records if saved
          if (session.attendanceRecords && session.attendanceRecords.length > 0) {
            setAttendanceRecords(session.attendanceRecords);
          }
        } else {
          localStorage.removeItem('attendanceSession');
        }
      } catch (e) {
        console.error("Failed to restore session:", e);
        localStorage.removeItem('attendanceSession');
      }
    }
    setHasRestoredSession(true);
  }, []);

  // Persist FULL session state to localStorage whenever anything changes
  useEffect(() => {
    if (!hasRestoredSession) return; // Don't save until we've tried to restore
    
    const session = {
      date: format(new Date(), 'yyyy-MM-dd'),
      subjectId: selectedSubjectId,
      sessionState,
      wasResumed,
      qrToken: currentQRToken,
      scanCount,
      sessionEnded,
      attendanceRecords // Save the actual records!
    };
    localStorage.setItem('attendanceSession', JSON.stringify(session));
  }, [sessionState, selectedSubjectId, wasResumed, currentQRToken, scanCount, attendanceRecords, hasRestoredSession]);
  
  // Get students for selected subject
  const { data: students } = useSubjectStudents(
    selectedSubjectId ? parseInt(selectedSubjectId) : 0
  );

  // Fetch today's attendance records for selected subject (real-time polling)
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: todayAttendance, refetch: refetchAttendance } = useAttendance({
    subjectId: selectedSubjectId ? parseInt(selectedSubjectId) : undefined,
    date: today
  });

  // Poll for attendance updates when session is active
  useEffect(() => {
    if (sessionState === 'active' && selectedSubjectId) {
      const pollInterval = setInterval(() => {
        refetchAttendance();
      }, 3000); // Poll every 3 seconds
      return () => clearInterval(pollInterval);
    }
  }, [sessionState, selectedSubjectId, refetchAttendance]);

  // Sync local records with database when todayAttendance changes (e.g., student scanned QR)
  useEffect(() => {
    if (!todayAttendance || !students || students.length === 0) return;
    if (!hasRestoredSession) return;
    
    // Update local records to reflect any database changes from student scans
    setAttendanceRecords(prev => {
      const updated = prev.map(record => {
        const dbRecord = todayAttendance.find(a => a.studentId === record.studentId);
        if (dbRecord && dbRecord.status) {
          // Database has a status (student scanned or was manually updated)
          // Only update if local status is null OR if database status is different
          if (!record.status || (record.status !== dbRecord.status && dbRecord.status !== 'absent')) {
            return {
              ...record,
              status: dbRecord.status as AttendanceStatus,
              timeIn: dbRecord.timeIn 
                ? new Date(dbRecord.timeIn).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' })
                : record.timeIn
            };
          }
        }
        return record;
      });
      
      // Only update if something actually changed
      const hasChanges = updated.some((r, i) => 
        r.status !== prev[i]?.status || r.timeIn !== prev[i]?.timeIn
      );
      
      return hasChanges ? updated : prev;
    });
  }, [todayAttendance, students, hasRestoredSession]);

  // Initialize attendance records from database ONLY when subject changes or on first load
  // This effect should NOT overwrite local edits - it only initializes
  useEffect(() => {
    // Skip if we haven't restored session yet or no students
    if (!hasRestoredSession || !students || students.length === 0) return;
    
    // Skip if we already have records for this subject (from localStorage or previous load)
    if (attendanceRecords.length > 0 && attendanceRecords[0]?.studentId) {
      // Check if the records match current students (same subject)
      const recordStudentIds = new Set(attendanceRecords.map(r => r.studentId));
      const studentIds = new Set(students.map(s => s.id));
      const isSameSubject = students.every(s => recordStudentIds.has(s.id));
      if (isSameSubject) return; // Records are already loaded for this subject
    }
    
    // Initialize records from database or create empty ones
    const newRecords = students.map(student => {
      const dbRecord = todayAttendance?.find(a => a.studentId === student.id);
      
      if (dbRecord) {
        return {
          studentId: student.id,
          studentName: student.fullName,
          timeIn: dbRecord.timeIn 
            ? new Date(dbRecord.timeIn).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' })
            : null,
          status: dbRecord.status as AttendanceStatus
        };
      }
      
      return {
        studentId: student.id,
        studentName: student.fullName,
        timeIn: null,
        status: null
      };
    });
    
    setAttendanceRecords(newRecords);
  }, [students, todayAttendance, hasRestoredSession]); // Removed attendanceRecords from deps to prevent loops

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Determine current/next class based on schedule
  const currentOrNextSubject = useMemo(() => {
    if (!schedules || !subjects) return null;
    
    const now = new Date();
    const today = now.toLocaleDateString('en-US', { weekday: 'long' });
    const currentTimeStr = format(now, 'HH:mm');
    
    // Find today's schedules sorted by start time
    const todaySchedules = schedules
      .filter(s => s.dayOfWeek === today)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    // Find current class (time is between start and end)
    const currentClass = todaySchedules.find(s => 
      currentTimeStr >= s.startTime && currentTimeStr <= s.endTime
    );
    
    if (currentClass) {
      return subjects.find(sub => sub.id === currentClass.subjectId);
    }
    
    // Find next upcoming class
    const nextClass = todaySchedules.find(s => currentTimeStr < s.startTime);
    if (nextClass) {
      return subjects.find(sub => sub.id === nextClass.subjectId);
    }
    
    return null;
  }, [schedules, subjects]);

  // Note: Removed auto-select subject - let teacher manually choose
  // This prevents overriding restored session state

  // Filter students by search
  const filteredRecords = attendanceRecords.filter(record =>
    record.studentName.toLowerCase().includes(search.toLowerCase())
  );

  // Calculate stats
  const stats = useMemo(() => {
    const total = attendanceRecords.length;
    const present = attendanceRecords.filter(r => r.status === 'present').length;
    const late = attendanceRecords.filter(r => r.status === 'late').length;
    const absent = attendanceRecords.filter(r => r.status === 'absent').length;
    const excused = attendanceRecords.filter(r => r.status === 'excused').length;
    return { total, present, late, absent, excused };
  }, [attendanceRecords]);

  // Generate a new unique QR token and persist to database
  const generateNewToken = useCallback(async (isLateMode = false) => {
    const newToken = uuidv4();
    const tokenWithMode = isLateMode ? `${newToken}_LATE` : newToken;
    
    if (selectedSubjectId) {
      try {
        // Deactivate any existing QR codes for this subject
        await supabase
          .from("qr_codes")
          .update({ active: false })
          .eq("subject_id", parseInt(selectedSubjectId));
        
        // Create new QR code in database
        await supabase
          .from("qr_codes")
          .insert({ 
            subject_id: parseInt(selectedSubjectId), 
            code: tokenWithMode, 
            active: true 
          });
      } catch (error) {
        console.error("Failed to persist QR code:", error);
      }
    }
    
    setCurrentQRToken(tokenWithMode);
    return tokenWithMode;
  }, [selectedSubjectId]);

  // Auto-regenerate QR code when a new scan is detected (attendance count increases)
  useEffect(() => {
    if (sessionState === 'active' && todayAttendance) {
      const currentCount = todayAttendance.length;
      // Regenerate if count increased (new student scanned)
      // The lastAttendanceCount is initialized when session starts
      if (currentCount > lastAttendanceCount) {
        // A new scan was detected - regenerate QR code
        generateNewToken(wasResumed || sessionEnded);
        setScanCount(prev => prev + 1);
        toast({
          title: "Student Checked In",
          description: "QR code regenerated automatically.",
        });
      }
      setLastAttendanceCount(currentCount);
    }
  }, [todayAttendance, sessionState, lastAttendanceCount, wasResumed, sessionEnded, generateNewToken, toast]);

  // QR Code data structure - contains URL with token, subject, and timestamp for validation
  // When scanned with any QR scanner, it redirects to login page with attendance params
  const qrCodeData = useMemo(() => {
    if (!currentQRToken || !selectedSubjectId) return "";
    
    // Create a URL that redirects to login with attendance parameters
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
      token: currentQRToken,
      subjectId: selectedSubjectId,
      ts: Date.now().toString(),
      scan: 'attendance'
    });
    
    return `${baseUrl}/login?${params.toString()}`;
  }, [currentQRToken, selectedSubjectId]);

  // Simulate a student scanning the QR code (for testing)
  // In production, this would be triggered by an API call from the student's device
  const handleQRScanned = useCallback((studentId: number, scannedToken: string) => {
    // Validate the token matches current valid token
    if (scannedToken !== currentQRToken) {
      console.log("Invalid or expired QR code!");
      return false;
    }
    
    if (sessionState !== 'active') {
      console.log("Session is not active!");
      return false;
    }
    
    // Mark student as present (or absent if session was resumed)
    const statusToSet: AttendanceStatus = wasResumed ? 'absent' : 'present';
    handleStatusChange(studentId, statusToSet);
    
    // Regenerate QR code immediately - old one becomes invalid
    generateNewToken();
    setScanCount(prev => prev + 1);
    
    return true;
  }, [currentQRToken, sessionState, wasResumed, generateNewToken]);

  const handleStartSession = async () => {
    setSessionState('active');
    setWasResumed(false);
    setScanCount(0);
    // Reset attendance count tracking for auto-regeneration
    setLastAttendanceCount(todayAttendance?.length || 0);
    
    // If session was previously ended (Resume button was shown), generate late QR codes
    const shouldBeLate = sessionEnded;
    
    // Generate initial QR code token when session starts
    await generateNewToken(shouldBeLate);
    
    if (shouldBeLate) {
      setWasResumed(true); // This ensures continued scans are also late
      toast({
        title: "Session Resumed",
        description: "Students scanning now will be marked as late."
      });
    } else {
      toast({
        title: "Session Started",
        description: "Students can now scan the QR code to check in."
      });
    }
  };

  const handlePauseSession = async () => {
    setSessionState('paused');
    // Deactivate current QR code when pausing
    if (selectedSubjectId) {
      await supabase
        .from("qr_codes")
        .update({ active: false })
        .eq("subject_id", parseInt(selectedSubjectId));
    }
    setCurrentQRToken("");
    toast({
      title: "Session Paused",
      description: "QR code scanning is temporarily disabled."
    });
  };

  const handleResumeSession = async () => {
    setSessionState('active');
    setWasResumed(true); // Mark that session was resumed - late scanners will be marked late
    // Generate new token with late mode when resuming
    await generateNewToken(true);
    toast({
      title: "Session Resumed",
      description: "Students scanning now will be marked as late.",
      variant: "default"
    });
  };

  const handleEndSession = async () => {
    setIsEnding(true);
    
    // Deactivate QR code in database first
    if (selectedSubjectId) {
      await supabase
        .from("qr_codes")
        .update({ active: false })
        .eq("subject_id", parseInt(selectedSubjectId));
    }
    setCurrentQRToken(""); // Invalidate QR code
    
    // Refresh attendance from database first to get latest student scans
    await refetchAttendance();
    
    // Get the LATEST attendance records from database
    const { data: latestAttendance } = await supabase
      .from('attendance')
      .select('student_id, status')
      .eq('subject_id', parseInt(selectedSubjectId))
      .eq('date', today);
    
    const dbStudentIds = new Set((latestAttendance || []).map(a => a.student_id));
    
    // Collect all students who need to be marked as absent
    const absentRecords = attendanceRecords
      .filter(record => !dbStudentIds.has(record.studentId))
      .map(record => ({
        student_id: record.studentId,
        subject_id: parseInt(selectedSubjectId),
        date: today,
        status: 'absent',
        time_in: null,
        remarks: 'Did not scan QR'
      }));
    
    // Batch insert all absent records at once (much faster than individual inserts)
    let absentCount = 0;
    if (absentRecords.length > 0) {
      const { error } = await supabase
        .from("attendance")
        .insert(absentRecords);
      
      if (error) {
        console.error("Failed to mark absent:", error);
      } else {
        absentCount = absentRecords.length;
      }
    }
    
    // Update local state with database values
    const updatedRecords = attendanceRecords.map(record => {
      const dbRecord = (latestAttendance || []).find(a => a.student_id === record.studentId);
      return {
        ...record,
        status: dbRecord?.status as AttendanceStatus || 'absent'
      };
    });
    setAttendanceRecords(updatedRecords);
    
    // Update session state
    setSessionState('inactive');
    setWasResumed(false);
    setSessionEnded(false); // Reset to show "Start" button instead of "Resume"
    
    // Refresh attendance data
    refetchAttendance();
    // Invalidate teacher-attendance cache so AttendanceHistory updates
    queryClient.invalidateQueries({ queryKey: ['teacher-attendance'] });
    
    // Clear session from localStorage
    localStorage.removeItem('attendanceSession');
    
    setIsEnding(false);
    
    toast({
      title: "Session Ended",
      description: `${absentCount} students marked as absent.`
    });
  };

  const handleStatusChange = async (studentId: number, status: AttendanceStatus) => {
    if (!isEditing && status === 'excused') return; // Excused only in edit mode
    
    // Update local state first for immediate UI feedback
    setAttendanceRecords(prev => prev.map(record => {
      if (record.studentId === studentId) {
        return {
          ...record,
          status,
          timeIn: status === 'present' || status === 'late' || status === 'absent'
            ? record.timeIn || new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' })
            : record.timeIn
        };
      }
      return record;
    }));

    // Note: When in edit mode, we only update local state here.
    // The database will be updated when the Save button is clicked in handleEditSave.
    // This ensures the "No Changes" message works correctly.
  };

  // Manual QR regeneration (teacher can force regenerate if needed)
  const handleManualRegenerate = async () => {
    if (sessionState === 'active') {
      await generateNewToken(wasResumed);
      setScanCount(prev => prev + 1);
      toast({
        title: "QR Code Regenerated",
        description: "Previous QR code is now invalid."
      });
    }
  };

  const handleEditSave = async () => {
    if (isEditing) {
      setIsSaving(true);
      // Save all changes to database
      if (selectedSubjectId) {
        let successCount = 0;
        let errorCount = 0;
        
        // Fetch all existing records in a single query
        const { data: allDbRecords } = await supabase
          .from('attendance')
          .select('id, student_id, status')
          .eq('subject_id', parseInt(selectedSubjectId))
          .eq('date', today);
        
        // Create a map for quick lookup
        const dbRecordMap = new Map(
          (allDbRecords || []).map(r => [r.student_id, { id: r.id, status: r.status }])
        );
        
        // Separate records into updates and inserts
        const recordsToUpdate: Array<{ id: number; status: string; time_in: string | null; remarks: string }> = [];
        const recordsToInsert: Array<{ student_id: number; subject_id: number; date: string; status: string; time_in: string | null }> = [];
        
        const currentTime = getPhilippineTimeISO();
        
        for (const record of attendanceRecords) {
          if (record.status) {
            const existingRecord = dbRecordMap.get(record.studentId);
            const shouldRecordTimeIn = record.status === 'present' || record.status === 'late';
            
            if (existingRecord) {
              // Only update if status actually changed
              if (existingRecord.status !== record.status) {
                recordsToUpdate.push({
                  id: existingRecord.id,
                  status: record.status,
                  time_in: shouldRecordTimeIn ? currentTime : null,
                  remarks: 'Manually edited'
                });
              }
            } else {
              // New record to insert
              recordsToInsert.push({
                student_id: record.studentId,
                subject_id: parseInt(selectedSubjectId),
                date: today,
                status: record.status,
                time_in: shouldRecordTimeIn ? currentTime : null
              });
            }
          }
        }
        
        // Batch insert new records
        if (recordsToInsert.length > 0) {
          const { error } = await supabase
            .from('attendance')
            .insert(recordsToInsert);
          
          if (error) {
            console.error('Failed to insert attendance records:', error);
            errorCount += recordsToInsert.length;
          } else {
            successCount += recordsToInsert.length;
          }
        }
        
        // Update records (Supabase doesn't support batch updates with different values, so we use Promise.all)
        if (recordsToUpdate.length > 0) {
          const updatePromises = recordsToUpdate.map(record =>
            supabase
              .from('attendance')
              .update({ 
                status: record.status,
                time_in: record.time_in,
                remarks: record.remarks
              })
              .eq('id', record.id)
          );
          
          const results = await Promise.all(updatePromises);
          results.forEach(({ error }) => {
            if (error) {
              console.error('Failed to update attendance:', error);
              errorCount++;
            } else {
              successCount++;
            }
          });
        }
        
        // Refresh data from database to confirm changes
        await refetchAttendance();
        // Invalidate teacher-attendance cache so AttendanceHistory updates
        queryClient.invalidateQueries({ queryKey: ['teacher-attendance'] });
        
        if (errorCount > 0) {
          toast({
            title: "Partial Save",
            description: `${successCount} records saved, ${errorCount} failed.`,
            variant: "destructive"
          });
        } else if (successCount > 0) {
          toast({
            title: "Changes Saved",
            description: `${successCount} attendance records have been updated.`
          });
        } else {
          toast({
            title: "No Changes",
            description: "All records are already up to date."
          });
        }
      }
      setIsSaving(false);
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  };

  // Reset session - clears all local state AND deletes today's attendance records from database
  const handleNewSession = async () => {
    if (!selectedSubjectId) {
      toast({
        title: "No Subject Selected",
        description: "Please select a subject first.",
        variant: "destructive"
      });
      return;
    }

    // Delete today's attendance records for this subject from database
    try {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('subject_id', parseInt(selectedSubjectId))
        .eq('date', today);
      
      if (error) {
        console.error('Failed to delete attendance records:', error);
        toast({
          title: "Error",
          description: "Failed to reset attendance records.",
          variant: "destructive"
        });
        return;
      }
    } catch (error) {
      console.error('Error deleting attendance:', error);
    }

    // Deactivate any active QR codes for this subject
    await supabase
      .from('qr_codes')
      .update({ active: false })
      .eq('subject_id', parseInt(selectedSubjectId));

    // Clear local state but keep the subject selected
    localStorage.removeItem('attendanceSession');
    setAttendanceRecords([]);
    setSessionState('inactive');
    setCurrentQRToken("");
    setScanCount(0);
    setWasResumed(false);
    setSessionEnded(false); // Reset - next start will be normal Start (present mode)
    
    // Refresh attendance data
    await refetchAttendance();
    // Invalidate teacher-attendance cache so AttendanceHistory updates
    queryClient.invalidateQueries({ queryKey: ['teacher-attendance'] });
    
    // Reinitialize the attendance records with enrolled students
    if (students) {
      const freshRecords: StudentAttendance[] = students.map((student: any) => ({
        studentId: student.id,
        studentName: student.fullName || 'Unknown',
        status: undefined,
        timeIn: null
      }));
      setAttendanceRecords(freshRecords);
    }
    
    toast({
      title: "Session Reset",
      description: "Today's attendance records have been cleared. Ready to start a new session."
    });
  };

  const selectedSubject = subjects?.find(s => s.id.toString() === selectedSubjectId);

  // Real QR Code Display component using qrcode.react
  const QRCodeDisplay = () => (
    <div className="flex flex-col items-center justify-center p-4">
      {sessionState === 'active' && qrCodeData ? (
        <div className="bg-white p-4 rounded-lg shadow-inner relative">
          <QRCodeSVG 
            value={qrCodeData}
            size={192}
            level="M"
            includeMargin={true}
          />
          {/* Scan counter badge */}
          <div className="absolute -top-2 -right-2 bg-primary text-white text-xs font-bold px-2 py-1 rounded-full">
            #{scanCount + 1}
          </div>
        </div>
      ) : sessionState === 'paused' ? (
        <div className="w-48 h-48 bg-yellow-50 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-yellow-400">
          <Pause className="w-16 h-16 text-yellow-500" />
          <span className="text-yellow-600 font-medium mt-2">Paused</span>
        </div>
      ) : (
        <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
          <QrCode className="w-16 h-16 text-gray-400" />
        </div>
      )}
      
      {/* Manual regenerate button - visible when session is active */}
      {sessionState === 'active' && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-xs text-muted-foreground hover:text-primary"
          onClick={handleManualRegenerate}
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Regenerate QR
        </Button>
      )}
      
      {/* Token info for debugging - can be removed in production */}
      {sessionState === 'active' && currentQRToken && (
        <p className="text-xs text-muted-foreground mt-1 font-mono">
          Token: {currentQRToken.slice(0, 8)}...
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display text-gray-900">Take Attendance</h1>
        <p className="text-muted-foreground mt-1">
          Record and manage class attendance
        </p>
      </div>

      <div className="grid lg:grid-cols-[350px_1fr] gap-6">
        {/* Left Panel - QR Code & Controls */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            {/* Subject Selector */}
            <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId} disabled={sessionState !== 'inactive'}>
              <SelectTrigger className={`w-full mb-6 ${sessionState !== 'inactive' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <SelectValue placeholder="Select a subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects?.map(subject => (
                  <SelectItem key={subject.id} value={subject.id.toString()}>
                    {subject.code} - {subject.name}
                    {currentOrNextSubject?.id === subject.id && (
                      <span className="ml-2 text-xs text-primary">(Current)</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* QR Code Display */}
            <QRCodeDisplay />

            {/* Date & Time */}
            <div className="text-center mt-4 mb-6">
              <p className="text-lg font-medium text-gray-900">
                {format(currentTime, 'MMMM d, yyyy')}
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {format(currentTime, 'h:mm a')}
              </p>
            </div>

            {/* Control Buttons */}
            <div className="space-y-3">
              {sessionState === 'inactive' ? (
                // Show Resume (yellow) if session was ended, otherwise Show Start (green)
                sessionEnded ? (
                  <Button 
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                    size="lg"
                    onClick={handleStartSession}
                    disabled={!selectedSubjectId}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Resume
                  </Button>
                ) : (
                  <Button 
                    className="w-full bg-primary hover:bg-primary/90 text-white"
                    size="lg"
                    onClick={handleStartSession}
                    disabled={!selectedSubjectId}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start
                  </Button>
                )
              ) : sessionState === 'active' ? (
                <Button 
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                  size="lg"
                  onClick={handlePauseSession}
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </Button>
              ) : (
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 text-white"
                  size="lg"
                  onClick={handleResumeSession}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                    size="lg"
                    disabled={sessionState === 'inactive' || isEnding}
                  >
                    {isEnding ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ending...</>
                    ) : (
                      <><Square className="w-4 h-4 mr-2" />End</>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>End Attendance Session?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will end the current session and mark all students who haven't scanned as absent. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleEndSession}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      End Session
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              
              {/* New Session button - resets everything */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    New Session
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Start New Session?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete all attendance records for today's session and reset everything. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleNewSession}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Reset Session
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {sessionState !== 'inactive' && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                {sessionState === 'paused' ? (
                  <>Session paused for <strong>{selectedSubject?.name}</strong></>
                ) : (wasResumed || sessionEnded) ? (
                  <>Session resumed for <strong>{selectedSubject?.name}</strong> <span className="text-yellow-600">(Scans → Late)</span></>
                ) : (
                  <>Session active for <strong>{selectedSubject?.name}</strong></>
                )}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Right Panel - Student List */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            {/* Search & Edit */}
            <div className="flex gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search students..." 
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button 
                variant={isEditing ? "default" : "outline"}
                onClick={handleEditSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                ) : isEditing ? "Save" : "Edit"}
              </Button>
            </div>

            {/* Attendance Table */}
            <div className="rounded-md border max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-white">
                  <TableRow>
                    <TableHead className="w-[250px]">Name</TableHead>
                    <TableHead className="w-[100px]">Time-in</TableHead>
                    <TableHead className="text-center w-[80px]">Present</TableHead>
                    <TableHead className="text-center w-[80px]">Late</TableHead>
                    <TableHead className="text-center w-[80px]">Absent</TableHead>
                    <TableHead className="text-center w-[80px]">Excused</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((record) => (
                      <TableRow key={record.studentId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">
                                {record.studentName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{record.studentName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {record.timeIn || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            onClick={() => handleStatusChange(record.studentId, 'present')}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                              record.status === 'present' 
                                ? 'bg-green-500 border-green-500' 
                                : 'border-gray-300 hover:border-green-400'
                            } ${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={!isEditing}
                          >
                            {record.status === 'present' && (
                              <CheckCircle2 className="w-4 h-4 text-white" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            onClick={() => handleStatusChange(record.studentId, 'late')}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                              record.status === 'late' 
                                ? 'bg-yellow-500 border-yellow-500' 
                                : 'border-gray-300 hover:border-yellow-400'
                            } ${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={!isEditing}
                          >
                            {record.status === 'late' && (
                              <div className="w-3 h-3 rounded-full bg-white" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            onClick={() => handleStatusChange(record.studentId, 'absent')}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                              record.status === 'absent' 
                                ? 'bg-red-500 border-red-500' 
                                : 'border-gray-300 hover:border-red-400'
                            } ${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={!isEditing}
                          >
                            {record.status === 'absent' && (
                              <div className="w-3 h-3 rounded-full bg-white" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            onClick={() => handleStatusChange(record.studentId, 'excused')}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                              record.status === 'excused' 
                                ? 'bg-blue-500 border-blue-500' 
                                : 'border-gray-300 hover:border-blue-400'
                            } ${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={!isEditing}
                          >
                            {record.status === 'excused' && (
                              <div className="w-3 h-3 rounded-full bg-white" />
                            )}
                          </button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {selectedSubjectId 
                          ? "No students enrolled in this subject" 
                          : "Select a subject to view students"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Stats Footer */}
            <div className="flex justify-between items-center mt-4 pt-4 border-t bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-600" />
                <span className="font-medium">Students</span>
                <span className="text-gray-600">{stats.total}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="font-medium">Present</span>
                <span className="text-gray-600">{stats.present}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="font-medium">Late</span>
                <span className="text-gray-600">{stats.late}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="font-medium">Absent</span>
                <span className="text-gray-600">{stats.absent}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="font-medium">Excused</span>
                <span className="text-gray-600">{stats.excused}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
