import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSubjects } from "@/hooks/use-subjects";
import { useAttendance } from "@/hooks/use-attendance";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { getPhilippineTimeISO } from "@/lib/utils";
import { Html5Qrcode } from "html5-qrcode";
import { 
  CalendarCheck,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  QrCode,
  ScanLine,
  Loader2,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";

// Status badge component - matches teacher's design
const StatusBadge = ({ status }: { status: string }) => {
  const normalizedStatus = status?.toLowerCase() || 'absent';
  
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

// Scan result type
type ScanResultType = 'present' | 'late' | 'error' | 'already' | null;

export default function StudentAttendance() {
  const { user } = useAuth();
  const { data: subjects, isLoading: subjectsLoading } = useSubjects();
  const { toast } = useToast();
  
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResultType>(null);
  const [scanMessage, setScanMessage] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "qr-reader";
  
  // Get attendance for current student with polling for real-time updates
  const { data: attendance, isLoading: attendanceLoading, refetch: refetchAttendance } = useAttendance({
    studentId: user?.id
  }, { refetchInterval: 5000 }); // Poll every 5 seconds

  // Debug: Log user and attendance data
  useEffect(() => {
    console.log('Student user:', user);
    console.log('Student attendance data:', attendance);
  }, [user, attendance]);

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy')
      });
    }
    return months;
  }, []);

  // Filter attendance by subject and month
  const filteredAttendance = useMemo(() => {
    if (!attendance) return [];
    
    return attendance.filter(record => {
      const matchesSubject = selectedSubjectId === "all" || 
        record.subjectId?.toString() === selectedSubjectId;
      const matchesMonth = selectedMonth === "all" || 
        record.date?.startsWith(selectedMonth);
      return matchesSubject && matchesMonth;
    }).sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateB.localeCompare(dateA);
    });
  }, [attendance, selectedSubjectId, selectedMonth]);

  // Group attendance by subject for stats
  const subjectStats = useMemo(() => {
    if (!attendance || !subjects) return [];
    
    return subjects.map(subject => {
      const subjectRecords = attendance.filter(r => r.subjectId === subject.id);
      const present = subjectRecords.filter(r => r.status?.toLowerCase() === 'present').length;
      const late = subjectRecords.filter(r => r.status?.toLowerCase() === 'late').length;
      const absent = subjectRecords.filter(r => r.status?.toLowerCase() === 'absent').length;
      const excused = subjectRecords.filter(r => r.status?.toLowerCase() === 'excused').length;
      const total = subjectRecords.length;
      const attendanceRate = total > 0 ? ((present + late) / total * 100).toFixed(1) : '0.0';
      
      return { subject, present, late, absent, excused, total, attendanceRate };
    });
  }, [attendance, subjects]);

  // Overall stats
  const overallStats = useMemo(() => {
    if (!attendance) return { present: 0, late: 0, absent: 0, excused: 0, total: 0, rate: '0.0' };
    
    const present = attendance.filter(r => r.status?.toLowerCase() === 'present').length;
    const late = attendance.filter(r => r.status?.toLowerCase() === 'late').length;
    const absent = attendance.filter(r => r.status?.toLowerCase() === 'absent').length;
    const excused = attendance.filter(r => r.status?.toLowerCase() === 'excused').length;
    const total = attendance.length;
    const rate = total > 0 ? ((present + late) / total * 100).toFixed(1) : '0.0';
    
    return { present, late, absent, excused, total, rate };
  }, [attendance]);

  // Stop the QR scanner
  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState();
        if (state === 2) { // SCANNING state
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // Process the scanned QR code - uses Supabase directly for Vercel compatibility
  // Supports both JSON format (in-app scanner) and URL format (external scanner redirect)
  const processQRCode = useCallback(async (qrData: string) => {
    if (isProcessing) return;
    
    console.log('Raw QR data received:', qrData);
    console.log('QR data length:', qrData?.length);
    
    let token: string;
    let subjectId: string;
    
    // Try to parse as JSON first (in-app QR scanner)
    if (qrData.startsWith('{') && qrData.endsWith('}')) {
      try {
        const parsedData = JSON.parse(qrData);
        token = parsedData.token;
        subjectId = parsedData.subjectId;
        console.log('Parsed JSON QR data:', parsedData);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return; // Silently ignore invalid JSON
      }
    } 
    // Try to parse as URL (external QR scanner redirect)
    else if (qrData.includes('?') && qrData.includes('token=')) {
      try {
        const url = new URL(qrData);
        token = url.searchParams.get('token') || '';
        subjectId = url.searchParams.get('subjectId') || '';
        console.log('Parsed URL QR data - token:', token, 'subjectId:', subjectId);
      } catch (urlError) {
        console.error('URL parse error:', urlError);
        return; // Silently ignore invalid URL
      }
    }
    // Invalid format
    else {
      console.log('Invalid QR format, ignoring...');
      return;
    }
    
    if (!token || !subjectId) {
      console.log('Missing token or subjectId');
      return;
    }
    
    setIsProcessing(true);
    
    // Stop scanner immediately to prevent multiple scans
    await stopScanner();

    try {
      // Check if user is logged in
      if (!user || !user.id) {
        throw new Error("Please log in to scan attendance");
      }

      if (user.role !== 'student') {
        throw new Error("Only students can scan attendance QR codes");
      }

      console.log('Processing scan for user:', user.id, 'token:', token, 'subjectId:', subjectId);

      // Step 1: Validate QR code against database
      const { data: qrRecord, error: qrError } = await supabase
        .from('qr_codes')
        .select('id, subject_id, code, active')
        .eq('code', token)
        .eq('active', true)
        .single();

      if (qrError || !qrRecord) {
        console.log('QR validation failed:', qrError);
        throw new Error("Invalid or expired QR code. Please ask your teacher to regenerate.");
      }

      const validSubjectId = qrRecord.subject_id;
      const isLate = token.includes('_LATE');

      console.log('QR code validated, subjectId:', validSubjectId, 'isLate:', isLate);

      // Step 2: Check if student is enrolled in this subject
      const { data: enrollment, error: enrollError } = await supabase
        .from('enrollments')
        .select('id')
        .eq('student_id', user.id)
        .eq('subject_id', validSubjectId)
        .single();

      if (enrollError || !enrollment) {
        console.log('Enrollment check failed:', enrollError);
        throw new Error("You are not enrolled in this subject");
      }

      // Step 3: Check if already marked attendance today
      const today = new Date().toISOString().split('T')[0];
      const { data: existingAttendance } = await supabase
        .from('attendance')
        .select('id, status')
        .eq('student_id', user.id)
        .eq('subject_id', validSubjectId)
        .eq('date', today);

      // Determine the new status based on QR code
      const newStatus = isLate ? 'late' : 'present';

      // If already has attendance record, UPDATE it (allows changing from absent to present/late)
      if (existingAttendance && existingAttendance.length > 0) {
        const existingRecord = existingAttendance[0];
        
        // If already present or late, don't change it
        if (existingRecord.status === 'present' || existingRecord.status === 'late') {
          setScanResult('already');
          setScanMessage(`You're already checked in as ${existingRecord.status}`);
          return;
        }
        
        // Update the existing record (e.g., from absent to present/late)
        const { error: updateError } = await supabase
          .from('attendance')
          .update({ 
            status: newStatus,
            time_in: getPhilippineTimeISO(),
            remarks: isLate ? 'Arrived late (updated)' : 'On time (updated)'
          })
          .eq('id', existingRecord.id);
        
        if (updateError) {
          console.error('Failed to update attendance:', updateError);
          throw new Error("Failed to update attendance record");
        }

        // Deactivate QR code after successful scan
        await supabase
          .from('qr_codes')
          .update({ active: false })
          .eq('id', qrRecord.id);

        setScanResult(newStatus);
        setScanMessage(`Attendance updated to ${newStatus}!`);
        refetchAttendance();
        
        toast({
          title: newStatus === 'present' ? "✓ Present!" : "⏰ Marked Late",
          description: `Your attendance has been updated to ${newStatus}.`,
        });
        return;
      }

      // Step 4: Deactivate the QR code (single use)
      await supabase
        .from('qr_codes')
        .update({ active: false })
        .eq('id', qrRecord.id);

      // Step 5: Record attendance
      const status = isLate ? 'late' : 'present';
      const { data: newRecord, error: insertError } = await supabase
        .from('attendance')
        .insert({
          student_id: user.id,
          subject_id: validSubjectId,
          date: today,
          status,
          time_in: getPhilippineTimeISO(),
          remarks: isLate ? 'Arrived late' : 'On time'
        })
        .select()
        .single();

      if (insertError) {
        console.error('Failed to insert attendance:', insertError);
        throw new Error("Failed to record attendance. Please try again.");
      }

      console.log('Attendance recorded successfully:', newRecord);

      setScanResult(status);
      setScanMessage(`Attendance recorded as ${status}`);
      refetchAttendance();
      
      toast({
        title: status === 'present' ? "✓ Present!" : "⏰ Marked Late",
        description: `Attendance recorded as ${status}`,
      });
    } catch (error) {
      console.error("QR scan error:", error);
      setScanResult('error');
      setScanMessage(error instanceof Error ? error.message : "Failed to process QR code");
      
      toast({
        title: "Scan Failed",
        description: error instanceof Error ? error.message : "Failed to process QR code",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, stopScanner, refetchAttendance, toast, user]);

  // Start the QR scanner
  const startScanner = useCallback(async () => {
    setScannerOpen(true);
    setScanResult(null);
    setScanMessage("");
    setIsScanning(false);

    // Wait for dialog to render
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode(scannerContainerId);
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 5, // Reduced FPS to prevent rapid partial scans
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            disableFlip: false
          },
          (decodedText) => {
            console.log("Scanned QR:", decodedText);
            processQRCode(decodedText);
          },
          () => {
            // Ignore scan errors (fires when no QR detected)
          }
        );
        setIsScanning(true);
      } catch (err) {
        console.error("Failed to start scanner:", err);
        setIsScanning(false);
        toast({
          title: "Camera Error",
          description: "Unable to access camera. Please check permissions.",
          variant: "destructive"
        });
      }
    }, 200);
  }, [processQRCode, toast]);

  // Close the scanner dialog
  const closeScanner = useCallback(() => {
    stopScanner();
    setScannerOpen(false);
    setScanResult(null);
    setScanMessage("");
  }, [stopScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Check for pending attendance scan from QR code scanned via external app
  useEffect(() => {
    const pendingScanData = sessionStorage.getItem('pendingAttendanceScan');
    if (pendingScanData && user && user.role === 'student') {
      try {
        const { token, subjectId, timestamp } = JSON.parse(pendingScanData);
        
        // Check if scan is not too old (5 minutes max)
        const fiveMinutes = 5 * 60 * 1000;
        if (Date.now() - timestamp < fiveMinutes) {
          // Clear the pending scan first to prevent re-processing
          sessionStorage.removeItem('pendingAttendanceScan');
          
          // Create the URL format string that processQRCode expects
          const qrUrl = `${window.location.origin}/login?token=${token}&subjectId=${subjectId}&scan=attendance`;
          
          // Process the attendance
          toast({
            title: "Processing Attendance",
            description: "Recording your attendance from QR code scan...",
          });
          
          processQRCode(qrUrl);
        } else {
          // Scan expired
          sessionStorage.removeItem('pendingAttendanceScan');
          toast({
            title: "QR Code Expired",
            description: "The scanned QR code has expired. Please scan again.",
            variant: "destructive"
          });
        }
      } catch (e) {
        console.error('Failed to process pending scan:', e);
        sessionStorage.removeItem('pendingAttendanceScan');
      }
    }
  }, [user, processQRCode, toast]);

  // Reset scanner for another scan
  const resetScanner = useCallback(() => {
    setScanResult(null);
    setScanMessage("");
    startScanner();
  }, [startScanner]);

  if (subjectsLoading || attendanceLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-display">
            Attendance
          </h1>
          <p className="text-muted-foreground mt-1">
            View your attendance records and scan QR to check-in
          </p>
        </div>
        <Button onClick={startScanner} className="gap-2" size="lg">
          <ScanLine className="w-5 h-5" />
          Scan QR Code
        </Button>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CalendarCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overallStats.total}</p>
                <p className="text-xs text-muted-foreground">Total Classes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{overallStats.present}</p>
                <p className="text-xs text-muted-foreground">Present</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{overallStats.late}</p>
                <p className="text-xs text-muted-foreground">Late</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{overallStats.absent}</p>
                <p className="text-xs text-muted-foreground">Absent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-lg font-bold text-primary">%</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{overallStats.rate}%</p>
                <p className="text-xs text-muted-foreground">Attendance Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per Subject Stats */}
      {subjectStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Attendance by Subject</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjectStats.map(stat => (
                <div 
                  key={stat.subject.id}
                  className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{stat.subject.name}</h3>
                      <p className="text-xs text-muted-foreground">{stat.subject.code}</p>
                    </div>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      {stat.attendanceRate}%
                    </Badge>
                  </div>
                  <div className="flex gap-3 text-sm">
                    <span className="text-green-600">{stat.present} Present</span>
                    <span className="text-yellow-600">{stat.late} Late</span>
                    <span className="text-red-600">{stat.absent} Absent</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Attendance History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by subject" />
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
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {monthOptions.map(month => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Attendance Table */}
          {filteredAttendance.length > 0 ? (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Date</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Time In</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttendance.map((record, index) => (
                    <TableRow key={record.id || index}>
                      <TableCell className="font-medium">
                        {record.date ? format(parseISO(record.date), 'EEEE, MMM d, yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{record.subjectName || 'Unknown'}</p>
                      </TableCell>
                      <TableCell>
                        {record.timeIn && record.timeIn instanceof Date && !isNaN(record.timeIn.getTime())
                          ? record.timeIn.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={record.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {record.remarks || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No attendance records found</p>
              <p className="text-sm">Your attendance will appear here once recorded</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Scanner Dialog */}
      <Dialog open={scannerOpen} onOpenChange={(open) => !open && closeScanner()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Scan Attendance QR Code
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {scanResult ? (
              <div className="text-center py-8">
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
                  scanResult === 'present' ? 'bg-green-100' : 
                  scanResult === 'late' ? 'bg-yellow-100' :
                  scanResult === 'already' ? 'bg-blue-100' : 'bg-red-100'
                }`}>
                  {scanResult === 'present' ? (
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  ) : scanResult === 'late' ? (
                    <Clock className="w-10 h-10 text-yellow-600" />
                  ) : scanResult === 'already' ? (
                    <AlertCircle className="w-10 h-10 text-blue-600" />
                  ) : (
                    <XCircle className="w-10 h-10 text-red-600" />
                  )}
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  {scanResult === 'present' ? 'Present!' : 
                   scanResult === 'late' ? 'Marked Late' :
                   scanResult === 'already' ? 'Already Checked In' : 'Scan Failed'}
                </h3>
                <p className="text-muted-foreground mb-4">{scanMessage}</p>
                <div className="flex gap-2 justify-center">
                  {scanResult === 'error' && (
                    <Button onClick={resetScanner} variant="outline">Try Again</Button>
                  )}
                  <Button onClick={closeScanner}>Done</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
                  <div id={scannerContainerId} className="w-full h-full" />
                  
                  {isProcessing && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                      <div className="text-center text-white">
                        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-2" />
                        <p>Processing...</p>
                      </div>
                    </div>
                  )}
                  
                  {!isScanning && !isProcessing && (
                    <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                      <div className="text-center text-white">
                        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-2" />
                        <p>Starting camera...</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <p className="text-center text-sm text-muted-foreground">
                  Point your camera at the QR code displayed by your teacher
                </p>
                
                <Button variant="outline" className="w-full" onClick={closeScanner}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                
                <p className="text-xs text-center text-muted-foreground">
                  Note: The QR code changes after each scan to prevent sharing
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
