import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSubjects } from "@/hooks/use-subjects";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getPhilippineTimeISO } from "@/lib/utils";
import { 
  Search,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Filter,
  Edit2,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

// Helper to format time - the database stores Philippine local time directly
const formatTimeLocal = (timeValue: string | Date | null): string => {
  if (!timeValue) return '-';
  try {
    let date: Date;
    if (typeof timeValue === 'string') {
      // Database stores Philippine time without timezone info
      // Parse as local time (don't convert, just format)
      // Remove any trailing Z to prevent UTC interpretation
      const cleanedValue = timeValue.replace('Z', '');
      date = new Date(cleanedValue);
    } else {
      date = timeValue;
    }
    // Format without timezone conversion since it's already in Philippine time
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true
    });
  } catch {
    return '-';
  }
};

interface AttendanceRecord {
  id: number;
  studentId: number;
  subjectId: number;
  date: string;
  status: 'present' | 'late' | 'absent' | 'excused';
  timeIn: string | null;
  remarks: string | null;
  studentName: string;
  subjectName: string;
}

export default function AttendanceHistory() {
  const { user } = useAuth();
  const { data: subjects } = useSubjects();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  
  // Edit dialog state
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState<string>("");
  const [editRemarks, setEditRemarks] = useState<string>("");

  // Mutation for updating attendance
  const updateMutation = useMutation({
    mutationFn: async ({ id, status, remarks, originalStatus }: { id: number; status: string; remarks: string; originalStatus: string }) => {
      // Determine if we should record time_in based on status
      const shouldRecordTimeIn = status === 'present' || status === 'late';
      // Only set "Manually edited" if the status changed, otherwise use the user's remarks
      const statusChanged = status !== originalStatus;
      const updateData: { status: string; remarks: string; time_in?: string | null } = { 
        status, 
        remarks: statusChanged ? 'Manually edited' : remarks,
        // Set time_in for present/late, clear it for absent/excused (only if status changed)
        time_in: statusChanged ? (shouldRecordTimeIn ? getPhilippineTimeISO() : null) : undefined
      };
      
      // Remove time_in from update if status didn't change (keep existing value)
      if (!statusChanged) {
        delete updateData.time_in;
      }
      
      const { data, error } = await supabase
        .from('attendance')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast({ title: "Success", description: "Attendance record updated" });
      setEditingRecord(null);
    },
    onError: (error) => {
      console.error('Update error:', error);
      toast({ title: "Error", description: "Failed to update attendance", variant: "destructive" });
    }
  });

  const openEditDialog = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setEditStatus(record.status);
    setEditRemarks(record.remarks || "");
  };

  const handleSaveEdit = () => {
    if (!editingRecord) return;
    updateMutation.mutate({
      id: editingRecord.id,
      status: editStatus,
      remarks: editRemarks,
      originalStatus: editingRecord.status
    });
  };

  // Fetch all attendance records for teacher's subjects with polling
  const { data: attendanceRecords, isLoading, refetch: refetchAttendance } = useQuery<AttendanceRecord[]>({
    queryKey: ['teacher-attendance'],
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
    refetchIntervalInBackground: false,
    queryFn: async () => {
      console.log('Current user:', user);
      
      // TEMP: Get all attendance records to test
      const { data, error } = await supabase
        .from("attendance")
        .select("*");
      
      console.log('Raw attendance data count:', data?.length, 'Error:', error);
      
      if (error) throw new Error('Failed to fetch attendance records');
      
      if (!data || data.length === 0) return [];
      
      // Get unique student and subject IDs
      const studentIds = Array.from(new Set(data.map(r => r.student_id)));
      const subjectIdsFromAttendance = Array.from(new Set(data.map(r => r.subject_id)));
      
      // Fetch student names
      const { data: students, error: studentsError } = await supabase
        .from("users")
        .select("id, full_name")
        .in("id", studentIds);
      
      console.log('Students data:', students, 'Error:', studentsError);
      
      // Fetch subject names
      const { data: subjects, error: subjectsError } = await supabase
        .from("subjects")
        .select("id, name")
        .in("id", subjectIdsFromAttendance);
      
      console.log('Subjects data:', subjects, 'Error:', subjectsError);
      
      // Create lookup maps
      const studentMap = new Map(students?.map(s => [s.id, s.full_name]) || []);
      const subjectMap = new Map(subjects?.map(s => [s.id, s.name]) || []);
      
      const mappedData = data.map((r: any) => ({
        id: r.id,
        studentId: r.student_id,
        subjectId: r.subject_id,
        date: r.date,
        status: r.status,
        timeIn: r.time_in,
        remarks: r.remarks,
        studentName: studentMap.get(r.student_id) || "Unknown",
        subjectName: subjectMap.get(r.subject_id) || "Unknown",
      }));
      
      console.log('Final mapped data:', mappedData);
      
      return mappedData;
    },
    enabled: true,
  });

  // Filter records based on selections
  const filteredRecords = useMemo(() => {
    if (!attendanceRecords) return [];
    
    let filtered = [...attendanceRecords];
    
    // Filter by subject
    if (selectedSubjectId !== "all") {
      filtered = filtered.filter(r => r.subjectId.toString() === selectedSubjectId);
    }
    
    // Filter by month
    if (selectedMonth) {
      const monthStart = startOfMonth(parseISO(selectedMonth + '-01'));
      const monthEnd = endOfMonth(parseISO(selectedMonth + '-01'));
      filtered = filtered.filter(r => {
        const recordDate = parseISO(r.date);
        return isWithinInterval(recordDate, { start: monthStart, end: monthEnd });
      });
    }
    
    // Filter by status (case-insensitive)
    if (selectedStatus !== "all") {
      filtered = filtered.filter(r => r.status?.toLowerCase() === selectedStatus.toLowerCase());
    }
    
    // Filter by search (student name)
    if (search) {
      filtered = filtered.filter(r => 
        r.studentName.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Sort by date descending
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return filtered;
  }, [attendanceRecords, selectedSubjectId, selectedMonth, selectedStatus, search]);

  // Group records by date for display
  const recordsByDate = useMemo(() => {
    const grouped: Record<string, AttendanceRecord[]> = {};
    filteredRecords.forEach(record => {
      if (!grouped[record.date]) {
        grouped[record.date] = [];
      }
      grouped[record.date].push(record);
    });
    return grouped;
  }, [filteredRecords]);

  // Calculate summary stats (case-insensitive)
  const stats = useMemo(() => {
    const total = filteredRecords.length;
    const present = filteredRecords.filter(r => r.status?.toLowerCase() === 'present').length;
    const late = filteredRecords.filter(r => r.status?.toLowerCase() === 'late').length;
    const absent = filteredRecords.filter(r => r.status?.toLowerCase() === 'absent').length;
    const excused = filteredRecords.filter(r => r.status?.toLowerCase() === 'excused').length;
    return { total, present, late, absent, excused };
  }, [filteredRecords]);

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy')
      });
    }
    return options;
  }, []);

  const getStatusBadge = (status: string) => {
    const normalizedStatus = status?.toLowerCase();
    switch (normalizedStatus) {
      case 'present':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle2 className="w-3 h-3 mr-1" />Present</Badge>;
      case 'late':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"><Clock className="w-3 h-3 mr-1" />Late</Badge>;
      case 'absent':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100"><XCircle className="w-3 h-3 mr-1" />Absent</Badge>;
      case 'excused':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100"><AlertCircle className="w-3 h-3 mr-1" />Excused</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-display text-gray-900">Attendance History</h1>
        <p className="text-muted-foreground mt-1">
          View past attendance records for your classes
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Users className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Records</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.present}</p>
                <p className="text-sm text-muted-foreground">Present</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{stats.late}</p>
                <p className="text-sm text-muted-foreground">Late</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
                <p className="text-sm text-muted-foreground">Absent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.excused}</p>
                <p className="text-sm text-muted-foreground">Excused</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Filters:</span>
            </div>
            
            <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects?.map(subject => (
                  <SelectItem key={subject.id} value={subject.id.toString()}>
                    {subject.code} - {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select Month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="excused">Excused</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by student name..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Attendance Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p>Loading attendance records...</p>
            </div>
          ) : Object.keys(recordsByDate).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(recordsByDate).map(([date, records]) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-gray-900">
                      {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
                    </h3>
                    <Badge variant="secondary" className="ml-2">
                      {records.length} record{records.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Time In</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Remarks</TableHead>
                          <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {records.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">
                              {record.studentName}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {record.subjectName}
                            </TableCell>
                            <TableCell>
                              {formatTimeLocal(record.timeIn)}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(record.status)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {record.remarks || '-'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(record)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No attendance records found for the selected filters.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingRecord} onOpenChange={(open) => !open && setEditingRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Attendance Record</DialogTitle>
          </DialogHeader>
          {editingRecord && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Student:</span>
                  <p className="font-medium">{editingRecord.studentName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Subject:</span>
                  <p className="font-medium">{editingRecord.subjectName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date:</span>
                  <p className="font-medium">{format(parseISO(editingRecord.date), 'MMMM d, yyyy')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Time In:</span>
                  <p className="font-medium">
                    {formatTimeLocal(editingRecord.timeIn)}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="excused">Excused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="Add any notes or remarks..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRecord(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
