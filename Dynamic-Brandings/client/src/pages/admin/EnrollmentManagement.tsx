import { useState } from "react";
import { useSubjects, useSubjectStudents, useEnrollStudent, useUnenrollStudent } from "@/hooks/use-subjects";
import { useUsers } from "@/hooks/use-users";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserPlus, UserMinus, Search, Users, BookOpen, Loader2 } from "lucide-react";

export default function EnrollmentManagement() {
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: subjects = [], isLoading: subjectsLoading } = useSubjects();
  const { data: enrolledStudents = [], isLoading: enrolledLoading } = useSubjectStudents(selectedSubjectId || 0);
  const { data: allStudents = [], isLoading: studentsLoading } = useUsers("student");
  
  const enrollStudent = useEnrollStudent();
  const unenrollStudent = useUnenrollStudent();

  // Get students not enrolled in the selected subject
  const enrolledStudentIds = new Set(enrolledStudents.map(s => s.id));
  const availableStudents = allStudents.filter(s => !enrolledStudentIds.has(s.id));

  // Filter students by search term
  const filteredAvailable = availableStudents.filter(s =>
    s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.idNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredEnrolled = enrolledStudents.filter(s =>
    s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.idNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEnroll = (studentId: number) => {
    if (!selectedSubjectId) return;
    enrollStudent.mutate({ subjectId: selectedSubjectId, studentId });
  };

  const handleUnenroll = (studentId: number) => {
    if (!selectedSubjectId) return;
    unenrollStudent.mutate({ subjectId: selectedSubjectId, studentId });
  };

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Enrollment Management</h1>
        <p className="text-muted-foreground">
          Enroll or remove students from subjects
        </p>
      </div>

      {/* Subject Selection */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Select Subject
          </CardTitle>
          <CardDescription>
            Choose a subject to manage student enrollments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedSubjectId?.toString() || ""}
            onValueChange={(value) => setSelectedSubjectId(Number(value))}
            disabled={subjectsLoading}
          >
            <SelectTrigger className="w-full md:w-[400px]">
              <SelectValue placeholder="Select a subject..." />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id.toString()}>
                  {subject.code} - {subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedSubjectId && (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students by name, ID number, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Enrolled Students */}
            <Card className="border-2 border-primary/20 min-w-0 overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Enrolled Students
                  </span>
                  <Badge variant="secondary">{enrolledStudents.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Students currently enrolled in {selectedSubject?.code}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                {enrolledLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredEnrolled.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "No matching enrolled students" : "No students enrolled yet"}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID Number</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEnrolled.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell className="font-mono text-sm">
                              {student.idNumber}
                            </TableCell>
                            <TableCell>{student.fullName}</TableCell>
                            <TableCell className="text-right">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    disabled={unenrollStudent.isPending}
                                  >
                                    <UserMinus className="h-4 w-4 mr-1" />
                                    Remove
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove Student</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove <strong>{student.fullName}</strong> from{" "}
                                      <strong>{selectedSubject?.code}</strong>? This will remove their enrollment
                                      but keep their attendance records.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleUnenroll(student.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Available Students */}
            <Card className="border-2 border-primary/20 min-w-0 overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Available Students
                  </span>
                  <Badge variant="outline">{availableStudents.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Students not enrolled in {selectedSubject?.code}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                {studentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredAvailable.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "No matching available students" : "All students are enrolled"}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID Number</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAvailable.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell className="font-mono text-sm">
                              {student.idNumber}
                            </TableCell>
                            <TableCell>{student.fullName}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-primary hover:text-primary hover:bg-primary/10"
                                onClick={() => handleEnroll(student.id)}
                                disabled={enrollStudent.isPending}
                              >
                                <UserPlus className="h-4 w-4 mr-1" />
                                Enroll
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
