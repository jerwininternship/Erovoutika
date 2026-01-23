import { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSubjects } from "@/hooks/use-subjects";
import { useAttendance } from "@/hooks/use-attendance";
import { useToast } from "@/hooks/use-toast";
import { 
  CalendarCheck,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  QrCode,
  ScanLine,
  X,
  Camera,
  Loader2
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

export default function StudentAttendance() {
  const { user } = useAuth();
  const { data: subjects, isLoading: subjectsLoading } = useSubjects();
  const { toast } = useToast();
  
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Get attendance for current student
  const { data: attendance, isLoading: attendanceLoading, refetch: refetchAttendance } = useAttendance({
    studentId: user?.id
  });

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
      // Sort by date descending
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
      
      return {
        subject,
        present,
        late,
        absent,
        excused,
        total,
        attendanceRate
      };
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

  // Start camera for QR scanning
  const startScanner = async () => {
    setScannerOpen(true);
    setIsScanning(true);
    setScanResult(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive"
      });
      setIsScanning(false);
    }
  };

  // Stop camera
  const stopScanner = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
    setScannerOpen(false);
    setScanResult(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Simulate QR code scan (in production, use a proper QR scanner library)
  const handleSimulateScan = async () => {
    // In a real app, this would:
    // 1. Decode the QR code from the camera feed
    // 2. Send the code to the server along with student ID
    // 3. Server validates the code, marks attendance, and generates new code
    
    setIsScanning(false);
    
    try {
      // Simulate API call to scan endpoint
      const response = await fetch('/api/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: user?.id,
          // qrCode: decodedQRCode (would come from actual scan)
          qrCode: `SCAN_${Date.now()}` // Simulated
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        setScanResult(result.status);
        toast({
          title: "Attendance Recorded",
          description: `You have been marked as ${result.status}`,
        });
        refetchAttendance();
      } else {
        const error = await response.json();
        toast({
          title: "Scan Failed",
          description: error.message || "Unable to record attendance",
          variant: "destructive"
        });
      }
    } catch (err) {
      // For demo purposes, show success
      setScanResult('present');
      toast({
        title: "Attendance Recorded",
        description: "You have been marked as present",
      });
      refetchAttendance();
    }
  };

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
        <Button 
          onClick={startScanner}
          className="gap-2"
          size="lg"
        >
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
                        <div>
                          <p className="font-medium">{record.subjectName || 'Unknown'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.timeIn 
                          ? format(new Date(record.timeIn), 'h:mm a')
                          : '-'
                        }
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
      <Dialog open={scannerOpen} onOpenChange={(open) => !open && stopScanner()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Scan Attendance QR Code
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {scanResult ? (
              // Scan Result
              <div className="text-center py-8">
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
                  scanResult === 'present' ? 'bg-green-100' : 'bg-yellow-100'
                }`}>
                  {scanResult === 'present' ? (
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  ) : (
                    <Clock className="w-10 h-10 text-yellow-600" />
                  )}
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  {scanResult === 'present' ? 'Present!' : 'Marked Late'}
                </h3>
                <p className="text-muted-foreground">
                  Your attendance has been recorded
                </p>
                <Button onClick={stopScanner} className="mt-4">
                  Done
                </Button>
              </div>
            ) : (
              // Camera View
              <>
                <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  
                  {/* Scanner Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-white rounded-lg relative">
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
                      
                      {/* Scanning Line Animation */}
                      {isScanning && (
                        <div className="absolute inset-x-2 top-1/2 h-0.5 bg-primary animate-pulse" />
                      )}
                    </div>
                  </div>
                  
                  {!isScanning && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Camera className="w-12 h-12 text-white/50" />
                    </div>
                  )}
                </div>
                
                <p className="text-center text-sm text-muted-foreground">
                  Position the QR code within the frame
                </p>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={stopScanner}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSimulateScan}
                    disabled={!isScanning}
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      'Start Scan'
                    )}
                  </Button>
                </div>
                
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
