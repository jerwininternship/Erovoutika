import { useState, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSubjects, useSubjectStudents } from "@/hooks/use-subjects";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { 
  FileText,
  Download,
  Calendar,
  Users,
  BookOpen,
  BarChart3,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Printer
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type ReportType = 'subject-monthly' | 'subject-semester' | 'student-subject';

export default function Reports() {
  const { user } = useAuth();
  const { data: subjects } = useSubjects();
  const reportRef = useRef<HTMLDivElement>(null);
  
  const [reportType, setReportType] = useState<ReportType>('subject-monthly');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // Fetch students for selected subject
  const { data: students } = useSubjectStudents(
    selectedSubjectId ? parseInt(selectedSubjectId) : 0
  );

  // Fetch all attendance records for teacher's subjects
  const { data: attendanceRecords } = useQuery<AttendanceRecord[]>({
    queryKey: ['teacher-attendance', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Get subjects taught by this teacher
      const { data: teacherSubjects } = await supabase
        .from("subjects")
        .select("id")
        .eq("teacher_id", user.id);
      
      if (!teacherSubjects || teacherSubjects.length === 0) return [];
      
      const subjectIds = teacherSubjects.map(s => s.id);
      
      // Get attendance records for those subjects
      const { data, error } = await supabase
        .from("attendance")
        .select(`
          *,
          student:users!student_id(full_name),
          subject:subjects!subject_id(name)
        `)
        .in("subject_id", subjectIds);
      
      if (error) throw new Error('Failed to fetch attendance records');
      
      return (data || []).map((r: any) => ({
        id: r.id,
        studentId: r.student_id,
        subjectId: r.subject_id,
        date: r.date,
        status: r.status,
        timeIn: r.time_in,
        remarks: r.remarks,
        studentName: r.student?.full_name || "Unknown",
        subjectName: r.subject?.name || "Unknown",
      }));
    },
    enabled: !!user?.id,
  });

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

  // Filter records based on report type
  const filteredRecords = useMemo(() => {
    if (!attendanceRecords || !selectedSubjectId) return [];
    
    let filtered = attendanceRecords.filter(r => r.subjectId.toString() === selectedSubjectId);
    
    if (reportType === 'subject-monthly' && selectedMonth) {
      const monthStart = startOfMonth(parseISO(selectedMonth + '-01'));
      const monthEnd = endOfMonth(parseISO(selectedMonth + '-01'));
      filtered = filtered.filter(r => {
        const recordDate = parseISO(r.date);
        return isWithinInterval(recordDate, { start: monthStart, end: monthEnd });
      });
    }
    
    if (reportType === 'student-subject' && selectedStudentId) {
      filtered = filtered.filter(r => r.studentId.toString() === selectedStudentId);
    }
    
    // Sort by date descending
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return filtered;
  }, [attendanceRecords, selectedSubjectId, selectedMonth, selectedStudentId, reportType]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = filteredRecords.length;
    const present = filteredRecords.filter(r => r.status === 'present').length;
    const late = filteredRecords.filter(r => r.status === 'late').length;
    const absent = filteredRecords.filter(r => r.status === 'absent').length;
    const excused = filteredRecords.filter(r => r.status === 'excused').length;
    const attendanceRate = total > 0 ? ((present + late) / total * 100).toFixed(1) : '0';
    return { total, present, late, absent, excused, attendanceRate };
  }, [filteredRecords]);

  // Group records by student for subject reports
  const recordsByStudent = useMemo(() => {
    const grouped: Record<string, { name: string; records: AttendanceRecord[]; stats: any }> = {};
    
    filteredRecords.forEach(record => {
      const key = record.studentId.toString();
      if (!grouped[key]) {
        grouped[key] = {
          name: record.studentName,
          records: [],
          stats: { present: 0, late: 0, absent: 0, excused: 0, total: 0 }
        };
      }
      grouped[key].records.push(record);
      grouped[key].stats[record.status]++;
      grouped[key].stats.total++;
    });
    
    return grouped;
  }, [filteredRecords]);

  const selectedSubject = subjects?.find(s => s.id.toString() === selectedSubjectId);
  const selectedStudent = students?.find(s => s.id.toString() === selectedStudentId);

  const handleGenerateReport = () => {
    setIsGenerating(true);
    setShowReport(true);
    setTimeout(() => setIsGenerating(false), 500);
  };

  const handlePrint = () => {
    const printContent = reportRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const styles = `
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #166534; margin-bottom: 5px; }
        h2 { color: #333; margin-top: 20px; }
        .header { border-bottom: 2px solid #166534; padding-bottom: 10px; margin-bottom: 20px; }
        .meta { color: #666; font-size: 14px; }
        .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 20px 0; }
        .stat-box { border: 1px solid #ddd; padding: 10px; border-radius: 5px; text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; }
        .stat-label { font-size: 12px; color: #666; }
        .present { color: #16a34a; }
        .late { color: #ca8a04; }
        .absent { color: #dc2626; }
        .excused { color: #2563eb; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f3f4f6; }
        .badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; }
        .badge-present { background: #dcfce7; color: #166534; }
        .badge-late { background: #fef3c7; color: #92400e; }
        .badge-absent { background: #fee2e2; color: #991b1b; }
        .badge-excused { background: #dbeafe; color: #1e40af; }
        @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Attendance Report - ${selectedSubject?.name || 'Report'}</title>
          ${styles}
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Present</Badge>;
      case 'late':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Late</Badge>;
      case 'absent':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Absent</Badge>;
      case 'excused':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Excused</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const canGenerate = () => {
    if (!selectedSubjectId) return false;
    if (reportType === 'subject-monthly' && !selectedMonth) return false;
    if (reportType === 'student-subject' && !selectedStudentId) return false;
    return true;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-display text-gray-900">Reports</h1>
        <p className="text-muted-foreground mt-1">
          Generate attendance reports and statistics
        </p>
      </div>

      <div className="grid lg:grid-cols-[400px_1fr] gap-6">
        {/* Report Configuration */}
        <Card className="shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Report Configuration
            </CardTitle>
            <CardDescription>
              Select the type of report and configure parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Report Type */}
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Tabs value={reportType} onValueChange={(v) => { setReportType(v as ReportType); setShowReport(false); }}>
                <TabsList className="grid w-full grid-cols-1 h-auto">
                  <TabsTrigger value="subject-monthly" className="flex items-center gap-2 py-3">
                    <Calendar className="w-4 h-4" />
                    Subject Monthly Report
                  </TabsTrigger>
                  <TabsTrigger value="subject-semester" className="flex items-center gap-2 py-3">
                    <BarChart3 className="w-4 h-4" />
                    Subject Semester Report
                  </TabsTrigger>
                  <TabsTrigger value="student-subject" className="flex items-center gap-2 py-3">
                    <Users className="w-4 h-4" />
                    Student Report
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Subject Selection */}
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={selectedSubjectId} onValueChange={(v) => { setSelectedSubjectId(v); setSelectedStudentId(""); setShowReport(false); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects?.map(subject => (
                    <SelectItem key={subject.id} value={subject.id.toString()}>
                      {subject.code} - {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Month Selection (for monthly report) */}
            {reportType === 'subject-monthly' && (
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setShowReport(false); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Student Selection (for student report) */}
            {reportType === 'student-subject' && selectedSubjectId && (
              <div className="space-y-2">
                <Label>Student</Label>
                <Select value={selectedStudentId} onValueChange={(v) => { setSelectedStudentId(v); setShowReport(false); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students?.map(student => (
                      <SelectItem key={student.id} value={student.id.toString()}>
                        {student.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Generate Button */}
            <Button 
              className="w-full" 
              size="lg"
              onClick={handleGenerateReport}
              disabled={!canGenerate() || isGenerating}
            >
              {isGenerating ? (
                <>Generating...</>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Report
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Report Preview */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Report Preview
              </CardTitle>
              <CardDescription>
                Preview and download your generated report
              </CardDescription>
            </div>
            {showReport && (
              <Button onClick={handlePrint} variant="outline">
                <Printer className="w-4 h-4 mr-2" />
                Print / Save PDF
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!showReport ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <FileText className="w-16 h-16 mb-4 opacity-50" />
                <p>Configure your report and click "Generate Report" to preview</p>
              </div>
            ) : (
              <div ref={reportRef} className="space-y-6">
                {/* Report Header */}
                <div className="header border-b-2 border-primary pb-4">
                  <h1 className="text-2xl font-bold text-primary">
                    {reportType === 'subject-monthly' && 'Monthly Attendance Report'}
                    {reportType === 'subject-semester' && 'Semester Attendance Report'}
                    {reportType === 'student-subject' && 'Student Attendance Report'}
                  </h1>
                  <div className="meta text-sm text-muted-foreground mt-2 space-y-1">
                    <p><strong>Subject:</strong> {selectedSubject?.code} - {selectedSubject?.name}</p>
                    {reportType === 'subject-monthly' && (
                      <p><strong>Period:</strong> {monthOptions.find(m => m.value === selectedMonth)?.label}</p>
                    )}
                    {reportType === 'subject-semester' && (
                      <p><strong>Period:</strong> Full Semester</p>
                    )}
                    {reportType === 'student-subject' && selectedStudent && (
                      <p><strong>Student:</strong> {selectedStudent.fullName}</p>
                    )}
                    <p><strong>Generated:</strong> {format(new Date(), 'MMMM d, yyyy h:mm a')}</p>
                    <p><strong>Generated By:</strong> {user?.fullName}</p>
                  </div>
                </div>

                {/* Statistics Summary */}
                <div>
                  <h2 className="text-lg font-semibold mb-3">Summary Statistics</h2>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="stat-box border rounded-lg p-4 text-center">
                      <p className="stat-value text-2xl font-bold">{stats.total}</p>
                      <p className="stat-label text-sm text-muted-foreground">Total Records</p>
                    </div>
                    <div className="stat-box border rounded-lg p-4 text-center">
                      <p className="stat-value text-2xl font-bold text-green-600">{stats.present}</p>
                      <p className="stat-label text-sm text-muted-foreground">Present</p>
                    </div>
                    <div className="stat-box border rounded-lg p-4 text-center">
                      <p className="stat-value text-2xl font-bold text-yellow-600">{stats.late}</p>
                      <p className="stat-label text-sm text-muted-foreground">Late</p>
                    </div>
                    <div className="stat-box border rounded-lg p-4 text-center">
                      <p className="stat-value text-2xl font-bold text-red-600">{stats.absent}</p>
                      <p className="stat-label text-sm text-muted-foreground">Absent</p>
                    </div>
                    <div className="stat-box border rounded-lg p-4 text-center">
                      <p className="stat-value text-2xl font-bold text-blue-600">{stats.excused}</p>
                      <p className="stat-label text-sm text-muted-foreground">Excused</p>
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-primary/5 rounded-lg">
                    <p className="text-center">
                      <span className="text-2xl font-bold text-primary">{stats.attendanceRate}%</span>
                      <span className="text-muted-foreground ml-2">Attendance Rate</span>
                    </p>
                  </div>
                </div>

                {/* Student-wise Breakdown (for subject reports) */}
                {(reportType === 'subject-monthly' || reportType === 'subject-semester') && (
                  <div>
                    <h2 className="text-lg font-semibold mb-3">Student-wise Breakdown</h2>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student Name</TableHead>
                            <TableHead className="text-center">Present</TableHead>
                            <TableHead className="text-center">Late</TableHead>
                            <TableHead className="text-center">Absent</TableHead>
                            <TableHead className="text-center">Excused</TableHead>
                            <TableHead className="text-center">Rate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(recordsByStudent).map(([id, data]) => {
                            const rate = data.stats.total > 0 
                              ? ((data.stats.present + data.stats.late) / data.stats.total * 100).toFixed(0)
                              : '0';
                            return (
                              <TableRow key={id}>
                                <TableCell className="font-medium">{data.name}</TableCell>
                                <TableCell className="text-center text-green-600">{data.stats.present}</TableCell>
                                <TableCell className="text-center text-yellow-600">{data.stats.late}</TableCell>
                                <TableCell className="text-center text-red-600">{data.stats.absent}</TableCell>
                                <TableCell className="text-center text-blue-600">{data.stats.excused}</TableCell>
                                <TableCell className="text-center font-medium">{rate}%</TableCell>
                              </TableRow>
                            );
                          })}
                          {Object.keys(recordsByStudent).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                No attendance records found for this period
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Detailed Records (for student report) */}
                {reportType === 'student-subject' && (
                  <div>
                    <h2 className="text-lg font-semibold mb-3">Detailed Attendance Records</h2>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Day</TableHead>
                            <TableHead>Time In</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Remarks</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRecords.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell>{format(parseISO(record.date), 'MMM d, yyyy')}</TableCell>
                              <TableCell>{format(parseISO(record.date), 'EEEE')}</TableCell>
                              <TableCell>
                                {record.timeIn 
                                  ? (typeof record.timeIn === 'string' 
                                      ? format(new Date(record.timeIn.replace('Z', '')), 'h:mm a')
                                      : format(record.timeIn, 'h:mm a'))
                                  : '-'}
                              </TableCell>
                              <TableCell>{getStatusBadge(record.status)}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {record.remarks || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                          {filteredRecords.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                No attendance records found for this student
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
