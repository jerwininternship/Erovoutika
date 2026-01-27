import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSubjects } from "@/hooks/use-subjects";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { 
  Search,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Filter
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
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

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
  
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Fetch all attendance records for teacher's subjects
  const { data: attendanceRecords, isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['teacher-attendance'],
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
      const studentIds = [...new Set(data.map(r => r.student_id))];
      const subjectIdsFromAttendance = [...new Set(data.map(r => r.subject_id))];
      
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
            <div className="text-center py-8 text-muted-foreground">
              Loading attendance records...
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
                              {record.timeIn 
                                ? format(new Date(record.timeIn), 'h:mm a')
                                : '-'}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(record.status)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {record.remarks || '-'}
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
    </div>
  );
}
