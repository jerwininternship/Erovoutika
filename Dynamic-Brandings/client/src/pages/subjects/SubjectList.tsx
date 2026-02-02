import { useState, useEffect } from "react";
import { useSubjects, useCreateSubject, useSubjectStudents, useStudentSubjects } from "@/hooks/use-subjects";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  BookOpen,
  Plus,
  Search,
  MoreVertical,
  Users,
  User,
  X,
  Calendar,
  Trash2,
  Clock,
  MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSubjectSchema, type Subject } from "@shared/schema";
import { z } from "zod";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TimePicker } from "@/components/ui/time-picker";
import { useSubjectSchedules, useCreateSchedule, useDeleteSchedule } from "@/hooks/use-schedules";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export default function SubjectList() {
  const { user } = useAuth();
  
  // Use different hooks based on user role
  const { data: allSubjects, isLoading: isLoadingAll } = useSubjects();
  const { data: studentSubjects, isLoading: isLoadingStudent } = useStudentSubjects(
    user?.role === "student" ? user?.id : undefined
  );
  
  // Select the appropriate subjects based on role
  const subjects = user?.role === "student" ? studentSubjects : allSubjects;
  const isLoading = user?.role === "student" ? isLoadingStudent : isLoadingAll;
  
  const [search, setSearch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [editScheduleSubject, setEditScheduleSubject] = useState<Subject | null>(null);
  const [deleteSubject, setDeleteSubject] = useState<Subject | null>(null);
  const [location, setLocation] = useLocation();

  // Handle URL parameter to auto-open student dialog
  useEffect(() => {
    if (subjects && subjects.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const viewStudentsId = params.get('viewStudents');
      if (viewStudentsId) {
        const subject = subjects.find(s => s.id === parseInt(viewStudentsId));
        if (subject) {
          setSelectedSubject(subject);
          // Clear the URL parameter
          setLocation('/subjects', { replace: true });
        }
      }
    }
  }, [subjects, setLocation]);

  const filteredSubjects = subjects?.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubjectClick = (subject: Subject) => {
    setSelectedSubject(subject);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-gray-900">
            {user?.role === "teacher" ? "My Classes" : user?.role === "student" ? "My Subjects" : "Subjects"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {user?.role === "student" 
              ? "View your enrolled subjects and class details."
              : "Manage your academic courses and view details."}
          </p>
        </div>
        {user?.role === "teacher" && <CreateSubjectDialog />}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search subjects..."
          className="pl-9 max-w-md"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSubjects?.map((subject) => (
            <Card
              key={subject.id}
              className="group cursor-pointer hover:border-primary/50 hover:shadow-lg transition-all duration-300"
              onClick={() => handleSubjectClick(subject)}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-semibold font-mono">
                    {subject.code}
                  </div>
                  {user?.role === "teacher" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 -mt-2 -mr-2 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem
                          className="cursor-pointer focus:text-white hover:!text-white"
                          onClick={() => setEditScheduleSubject(subject)}
                        >
                          <Calendar className="w-4 h-4 mr-2" />
                          Edit Schedule
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive cursor-pointer focus:text-white hover:!text-white hover:!bg-destructive focus:!bg-destructive"
                          onClick={() => setDeleteSubject(subject)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Subject
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <CardTitle className="mt-2 text-xl">{subject.name}</CardTitle>
                <CardDescription className="line-clamp-2 min-h-[40px]">
                  {subject.description || "No description provided."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground border-t pt-4">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    <span>View Students</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" />
                    <span>Active</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredSubjects?.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center bg-gray-50 border border-dashed rounded-xl">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Search className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No subjects found</h3>
              <p className="text-muted-foreground">Try adjusting your search terms.</p>
            </div>
          )}
        </div>
      )}

      {/* Student List Dialog */}
      <StudentListDialog
        subject={selectedSubject}
        open={!!selectedSubject}
        onClose={() => setSelectedSubject(null)}
      />

      {/* Edit Schedule Dialog */}
      <EditScheduleDialog
        subject={editScheduleSubject}
        open={!!editScheduleSubject}
        onClose={() => setEditScheduleSubject(null)}
      />

      {/* Delete Subject Confirmation */}
      <DeleteSubjectDialog
        subject={deleteSubject}
        open={!!deleteSubject}
        onClose={() => setDeleteSubject(null)}
      />
    </div>
  );
}

function StudentListDialog({ subject, open, onClose }: { subject: Subject | null; open: boolean; onClose: () => void }) {
  const { data: students, isLoading } = useSubjectStudents(subject?.id || 0);

  if (!subject) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">{subject.name}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <span className="font-mono text-xs bg-secondary px-2 py-0.5 rounded">{subject.code}</span>
                <span>•</span>
                <span>{students?.length || 0} Students Enrolled</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : students && students.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Student Number</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student, index) => (
                  <TableRow key={student.id}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {student.fullName.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{student.fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {String(student.id).padStart(6, '0')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No students enrolled</h3>
              <p className="text-muted-foreground mt-1">Students will appear here once they enroll in this subject.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateSubjectDialog() {
  const [open, setOpen] = useState(false);
  const { mutate: createSubject, isPending } = useCreateSubject();
  const { user } = useAuth();

  const form = useForm<z.infer<typeof insertSubjectSchema>>({
    resolver: zodResolver(insertSubjectSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      teacherId: user?.id,
    },
  });

  const onSubmit = (data: z.infer<typeof insertSubjectSchema>) => {
    createSubject(data, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-lg shadow-primary/20 hover:shadow-primary/30">
          <Plus className="w-4 h-4 mr-2" />
          New Subject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Subject</DialogTitle>
          <DialogDescription>
            Add a new course to your teaching catalog.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Advanced Calculus" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Course Code</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. MATH101" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief overview of the course..." {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create Subject"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditScheduleDialog({ subject, open, onClose }: { subject: Subject | null; open: boolean; onClose: () => void }) {
  const { data: schedules, isLoading } = useSubjectSchedules(subject?.id || 0);
  const { mutate: createSchedule, isPending: isCreating } = useCreateSchedule();
  const { mutate: deleteSchedule } = useDeleteSchedule();
  const [showAddForm, setShowAddForm] = useState(false);

  const [newSchedule, setNewSchedule] = useState({
    dayOfWeek: "Monday",
    startTime: "09:00",
    endTime: "10:30",
    room: ""
  });

  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedHour = h % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
  };
  // Helper function to convert time string to minutes for comparison
  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Check if two time ranges overlap
  const timesOverlap = (start1: string, end1: string, start2: string, end2: string) => {
    const s1 = timeToMinutes(start1);
    const e1 = timeToMinutes(end1);
    const s2 = timeToMinutes(start2);
    const e2 = timeToMinutes(end2);
    return s1 < e2 && s2 < e1;
  };

  // Find any conflicting schedule on the same day with overlapping time
  const conflictingSchedule = schedules?.find(schedule =>
    schedule.dayOfWeek === newSchedule.dayOfWeek &&
    timesOverlap(schedule.startTime, schedule.endTime, newSchedule.startTime, newSchedule.endTime)
  );

  const hasScheduleConflict = !!conflictingSchedule;

  const handleAddSchedule = () => {
    if (!subject || !newSchedule.room || hasScheduleConflict) return;

    createSchedule({
      subjectId: subject.id,
      dayOfWeek: newSchedule.dayOfWeek as any,
      startTime: newSchedule.startTime,
      endTime: newSchedule.endTime,
      room: newSchedule.room
    }, {
      onSuccess: () => {
        setShowAddForm(false);
        setNewSchedule({ dayOfWeek: "Monday", startTime: "09:00", endTime: "10:30", room: "" });
      }
    });
  };

  const handleDeleteSchedule = (scheduleId: number) => {
    deleteSchedule(scheduleId);
  };

  if (!subject) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Schedule</DialogTitle>
          <DialogDescription>
            Manage the schedule for {subject.name} ({subject.code})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : schedules && schedules.length > 0 ? (
            <div className="space-y-2">
              {schedules
                .sort((a, b) => dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek))
                .map((schedule) => (
                  <div key={schedule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{schedule.dayOfWeek}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{schedule.room}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteSchedule(schedule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground bg-gray-50 rounded-lg border border-dashed">
              No schedules set. Add one below.
            </div>
          )}

          {showAddForm ? (
            <div className="p-4 border rounded-lg space-y-4 bg-gray-50">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Day</label>
                  <Select value={newSchedule.dayOfWeek} onValueChange={(v) => setNewSchedule({ ...newSchedule, dayOfWeek: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dayOrder.map(day => (
                        <SelectItem key={day} value={day}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Room</label>
                  <Input
                    placeholder="e.g. Q3212"
                    value={newSchedule.room}
                    onChange={(e) => setNewSchedule({ ...newSchedule, room: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Time</label>
                  <TimePicker
                    value={newSchedule.startTime}
                    onChange={(value) => setNewSchedule({ ...newSchedule, startTime: value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Time</label>
                  <TimePicker
                    value={newSchedule.endTime}
                    onChange={(value) => setNewSchedule({ ...newSchedule, endTime: value })}
                  />
                </div>
              </div>
              {hasScheduleConflict && conflictingSchedule && (
                <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md border border-destructive/20">
                  Schedule conflict: This time overlaps with an existing schedule on {conflictingSchedule.dayOfWeek} ({formatTime(conflictingSchedule.startTime)} - {formatTime(conflictingSchedule.endTime)}). Please choose a different time.
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAddSchedule} disabled={isCreating || !newSchedule.room || hasScheduleConflict}>
                  {isCreating ? "Adding..." : "Add Schedule"}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setShowAddForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Schedule
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteSubjectDialog({ subject, open, onClose }: { subject: Subject | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { mutate: deleteSubject, isPending } = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("subjects")
        .delete()
        .eq("id", id);
      if (error) throw new Error("Failed to delete subject");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast({ title: "Subject Deleted", description: "The subject has been removed." });
      onClose();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete subject.", variant: "destructive" });
    }
  });

  if (!subject) return null;

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Subject</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{subject.name}</strong> ({subject.code})?
            This action cannot be undone. All schedules and enrollment data for this subject will also be removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              deleteSubject(subject.id);
            }}
            disabled={isPending}
          >
            {isPending ? "Deleting..." : "Delete Subject"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
