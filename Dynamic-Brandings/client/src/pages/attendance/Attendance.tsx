import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSubjects, useSubjectStudents } from "@/hooks/use-subjects";
import { useTeacherSchedules } from "@/hooks/use-schedules";
import { 
  Search,
  Users,
  CheckCircle2,
  QrCode,
  Play,
  Square,
  Pause,
  RefreshCw
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
import { format } from "date-fns";

type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused' | null;

interface StudentAttendance {
  studentId: number;
  studentName: string;
  timeIn: string | null;
  status: AttendanceStatus;
}

export default function Attendance() {
  const { user } = useAuth();
  const { data: subjects } = useSubjects();
  const { data: schedules } = useTeacherSchedules();
  
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  // Session states: 'inactive' | 'active' | 'paused'
  const [sessionState, setSessionState] = useState<'inactive' | 'active' | 'paused'>('inactive');
  const [wasResumed, setWasResumed] = useState(false); // Track if session was paused and resumed
  const [currentTime, setCurrentTime] = useState(new Date());
  const [attendanceRecords, setAttendanceRecords] = useState<StudentAttendance[]>([]);
  
  // QR Code state - unique token that regenerates after each scan
  const [currentQRToken, setCurrentQRToken] = useState<string>("");
  const [scanCount, setScanCount] = useState(0);
  
  // Get students for selected subject
  const { data: students } = useSubjectStudents(
    selectedSubjectId ? parseInt(selectedSubjectId) : 0
  );

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

  // Set default selected subject to current/next class
  useEffect(() => {
    if (currentOrNextSubject && !selectedSubjectId) {
      setSelectedSubjectId(currentOrNextSubject.id.toString());
    } else if (subjects && subjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(subjects[0].id.toString());
    }
  }, [currentOrNextSubject, subjects, selectedSubjectId]);

  // Initialize attendance records when students load
  useEffect(() => {
    if (students && students.length > 0) {
      setAttendanceRecords(students.map(student => ({
        studentId: student.id,
        studentName: student.fullName,
        timeIn: null,
        status: null
      })));
    }
  }, [students]);

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

  // Generate a new unique QR token
  const generateNewToken = useCallback(() => {
    const newToken = uuidv4();
    setCurrentQRToken(newToken);
    return newToken;
  }, []);

  // QR Code data structure - contains token, subject, and timestamp for validation
  const qrCodeData = useMemo(() => {
    if (!currentQRToken || !selectedSubjectId) return "";
    
    const data = {
      token: currentQRToken,
      subjectId: selectedSubjectId,
      timestamp: Date.now(),
      sessionId: `${selectedSubjectId}-${format(new Date(), 'yyyy-MM-dd')}`
    };
    
    return JSON.stringify(data);
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

  const handleStartSession = () => {
    setSessionState('active');
    setWasResumed(false);
    setScanCount(0);
    // Generate initial QR code token when session starts
    generateNewToken();
  };

  const handlePauseSession = () => {
    setSessionState('paused');
  };

  const handleResumeSession = () => {
    setSessionState('active');
    setWasResumed(true); // Mark that session was resumed - late scanners will be marked absent
    // Generate new token when resuming
    generateNewToken();
  };

  const handleEndSession = () => {
    setSessionState('inactive');
    setWasResumed(false);
    setCurrentQRToken(""); // Invalidate QR code
    // Mark all students without status as absent
    setAttendanceRecords(prev => prev.map(record => ({
      ...record,
      status: record.status || 'absent'
    })));
  };

  const handleStatusChange = (studentId: number, status: AttendanceStatus) => {
    if (!isEditing && status === 'excused') return; // Excused only in edit mode
    
    setAttendanceRecords(prev => prev.map(record => {
      if (record.studentId === studentId) {
        return {
          ...record,
          status,
          timeIn: status === 'present' || status === 'late' || status === 'absent'
            ? record.timeIn || format(new Date(), 'h:mm a')
            : record.timeIn
        };
      }
      return record;
    }));
  };

  // Manual QR regeneration (teacher can force regenerate if needed)
  const handleManualRegenerate = () => {
    if (sessionState === 'active') {
      generateNewToken();
    }
  };

  const handleEditSave = () => {
    if (isEditing) {
      // Save changes - in real app, would call API
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
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
            <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
              <SelectTrigger className="w-full mb-6">
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
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 text-white"
                  size="lg"
                  onClick={handleStartSession}
                  disabled={!selectedSubjectId}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start
                </Button>
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
              <Button 
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                size="lg"
                onClick={handleEndSession}
                disabled={sessionState === 'inactive'}
              >
                <Square className="w-4 h-4 mr-2" />
                End
              </Button>
            </div>

            {sessionState !== 'inactive' && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                {sessionState === 'paused' ? (
                  <>Session paused for <strong>{selectedSubject?.name}</strong></>
                ) : wasResumed ? (
                  <>Session resumed for <strong>{selectedSubject?.name}</strong> <span className="text-red-500">(Late scans → Absent)</span></>
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
              >
                {isEditing ? "Save" : "Edit"}
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
                            }`}
                            disabled={sessionState !== 'active' && !isEditing}
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
                            }`}
                            disabled={sessionState !== 'active' && !isEditing}
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
                            }`}
                            disabled={sessionState !== 'active' && !isEditing}
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
