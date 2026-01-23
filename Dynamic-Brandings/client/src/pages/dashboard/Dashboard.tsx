import { useAuth } from "@/hooks/use-auth";
import { useAttendance } from "@/hooks/use-attendance";
import { useSubjects } from "@/hooks/use-subjects";
import { useTeacherSchedules } from "@/hooks/use-schedules";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Users, 
  BookOpen, 
  CalendarCheck, 
  Clock,
  TrendingUp,
  AlertCircle,
  MapPin
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import { format } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display text-gray-900">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back, {user.fullName}. Here's what's happening today.
        </p>
      </div>

      {user.role === "student" && <StudentDashboard />}
      {user.role === "teacher" && <TeacherDashboard />}
      {user.role === "superadmin" && <AdminDashboard />}
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, description, trend }: any) {
  return (
    <Card className="shadow-sm border-border hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">
            {trend && <span className="text-green-600 font-medium mr-1">{trend}</span>}
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StudentDashboard() {
  const { data: attendance } = useAttendance();
  const { data: subjects } = useSubjects();

  // Calculate simple stats (case-insensitive status comparison)
  const totalClasses = attendance?.length || 0;
  const presentCount = attendance?.filter(a => a.status?.toLowerCase() === 'present').length || 0;
  const lateCount = attendance?.filter(a => a.status?.toLowerCase() === 'late').length || 0;
  const absentCount = attendance?.filter(a => a.status?.toLowerCase() === 'absent').length || 0;
  const excusedCount = attendance?.filter(a => a.status?.toLowerCase() === 'excused').length || 0;
  const attendanceRate = totalClasses ? Math.round(((presentCount + lateCount) / totalClasses) * 100) : 100;

  const chartData = [
    { name: 'Present', value: presentCount, color: '#22c55e' },
    { name: 'Late', value: lateCount, color: '#f97316' },
    { name: 'Absent', value: absentCount, color: '#ef4444' },
    { name: 'Excused', value: excusedCount, color: '#3b82f6' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard 
          title="Attendance Rate" 
          value={`${attendanceRate}%`} 
          icon={TrendingUp} 
          description="Overall participation"
          trend={attendanceRate >= 85 ? "Excellent" : "Needs Attention"}
        />
        <StatsCard 
          title="Active Subjects" 
          value={subjects?.length || 0} 
          icon={BookOpen} 
          description="Currently enrolled"
        />
        <StatsCard 
          title="Absences" 
          value={absentCount} 
          icon={AlertCircle} 
          description="Total unexcused"
        />
        <StatsCard 
          title="Classes Attended" 
          value={presentCount} 
          icon={CalendarCheck} 
          description="Total sessions"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Attendance</CardTitle>
            <CardDescription>Your latest class records</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {attendance?.slice(0, 5).map((record) => (
                <div key={record.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-900">{record.subjectName || "Subject"}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(record.date), 'MMMM d, yyyy')}</p>
                    </div>
                  </div>
                  <StatusBadge status={record.status} />
                </div>
              ))}
              {(!attendance || attendance.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">No attendance records found</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>Status breakdown</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {totalClasses > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie
                      data={chartData.filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value, percent }) => `${value} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {chartData.filter(d => d.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name: string) => [`${value} classes`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
                  {chartData.map(item => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span>{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <CalendarCheck className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">No attendance data yet</p>
                <p className="text-xs">Your records will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TeacherDashboard() {
  const { data: subjects } = useSubjects();
  const { data: schedules } = useTeacherSchedules();
  const [, setLocation] = useLocation();
  const { data: teacherStats } = useQuery({
    queryKey: ['/api/teacher/stats'],
    queryFn: async () => {
      const res = await fetch('/api/teacher/stats', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch teacher stats');
      return res.json() as Promise<{ totalStudents: number }>;
    }
  });

  const totalStudents = teacherStats?.totalStudents || 0;
  const avgAttendance = "88%"; // Mock

  // Group schedules by subject
  const groupedSchedules = schedules?.reduce((acc, schedule) => {
    const key = schedule.subjectId;
    if (!acc[key]) {
      acc[key] = {
        subjectName: schedule.subjectName,
        subjectCode: schedule.subjectCode,
        schedules: []
      };
    }
    acc[key].schedules.push({
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      room: schedule.room
    });
    return acc;
  }, {} as Record<number, { subjectName: string; subjectCode: string; schedules: { dayOfWeek: string; startTime: string; endTime: string; room: string }[] }>) || {};

  // Sort days in order
  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const dayAbbr: Record<string, string> = {
    "Monday": "Mon",
    "Tuesday": "Tue", 
    "Wednesday": "Wed",
    "Thursday": "Thu",
    "Friday": "Fri",
    "Saturday": "Sat",
    "Sunday": "Sun"
  };

  // Consolidate schedules with same time and room into single rows
  const consolidateSchedules = (schedules: { dayOfWeek: string; startTime: string; endTime: string; room: string }[]) => {
    const grouped = schedules.reduce((acc, sched) => {
      const key = `${sched.startTime}-${sched.endTime}-${sched.room}`;
      if (!acc[key]) {
        acc[key] = {
          days: [],
          startTime: sched.startTime,
          endTime: sched.endTime,
          room: sched.room
        };
      }
      acc[key].days.push(sched.dayOfWeek);
      return acc;
    }, {} as Record<string, { days: string[]; startTime: string; endTime: string; room: string }>);

    return Object.values(grouped).map(g => ({
      ...g,
      days: g.days.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b))
    }));
  };
  
  // Format time from 24h to 12h format
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedHour = h % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
  };

  // Get today's day name
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  
  // Get today's classes from all schedules
  const todayClasses = schedules?.filter(s => s.dayOfWeek === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime)) || [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Classes" value={subjects?.length || 0} icon={BookOpen} description="Active subjects" />
        <StatsCard title="Total Students" value={totalStudents} icon={Users} description="Across all sections" />
        <StatsCard title="Avg. Attendance" value={avgAttendance} icon={TrendingUp} description="This semester" />
        <StatsCard title="Classes Today" value={todayClasses.length} icon={Clock} description={today} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Schedule Card */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Class Schedule
            </CardTitle>
            <CardDescription>Your daily and weekly class schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Today's Schedule */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Today's Classes ({today})
                </h3>
                {todayClasses.length > 0 ? (
                  <div className="space-y-2">
                    {todayClasses.map((cls, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                            <BookOpen className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{cls.subjectName}</h4>
                            <span className="text-xs text-muted-foreground">{cls.subjectCode}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {formatTime(cls.startTime)} - {formatTime(cls.endTime)}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
                            <MapPin className="h-3 w-3" />
                            {cls.room}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground bg-gray-50 rounded-lg border border-dashed text-sm">
                    No classes scheduled for today
                  </div>
                )}
              </div>

              {/* Weekly Schedule */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Weekly Schedule</h3>
                <div className="space-y-3">
                  {Object.values(groupedSchedules).length > 0 ? (
                    Object.values(groupedSchedules).map((group, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900 text-sm">{group.subjectName}</h4>
                            <span className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              {group.subjectCode}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {consolidateSchedules(group.schedules).map((sched, schedIdx) => (
                            <div key={schedIdx} className="grid grid-cols-[180px_1fr_auto] items-center gap-2 text-xs bg-white p-2 rounded border border-gray-100">
                              <div className="flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <div className="font-medium text-gray-700 truncate">
                                  {sched.days.length > 1 
                                    ? sched.days.map(d => dayAbbr[d]).join(', ')
                                    : sched.days[0]
                                  }
                                </div>
                              </div>
                              <div className="flex justify-center">
                                <span className="text-muted-foreground min-w-[140px]">
                                  {formatTime(sched.startTime)} - {formatTime(sched.endTime)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span>{sched.room}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-muted-foreground bg-gray-50 rounded-lg border border-dashed text-sm">
                      No schedules set up yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* My Classes Card */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>My Classes</CardTitle>
            <CardDescription>Manage your subjects and students</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {subjects?.map(subject => (
                <div 
                  key={subject.id} 
                  className="p-4 rounded-xl border bg-card hover:border-primary/50 transition-colors group cursor-pointer"
                  onClick={() => setLocation(`/subjects?viewStudents=${subject.id}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{subject.code}</span>
                  </div>
                  <h3 className="font-semibold text-base mb-1">{subject.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">{subject.description || "No description provided."}</p>
                  <div className="mt-3 pt-3 border-t flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">View Students</span>
                    <span className="text-primary font-medium group-hover:underline">View →</span>
                  </div>
                </div>
              ))}
              {(!subjects || subjects.length === 0) && (
                <div className="text-center py-8 text-muted-foreground bg-gray-50 rounded-xl border border-dashed">
                  No classes assigned yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdminDashboard() {
  return (
    <div className="space-y-6">
       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Users" value="1,234" icon={Users} description="+12 this week" />
        <StatsCard title="Active Classes" value="48" icon={BookOpen} description="Currently in session" />
        <StatsCard title="System Health" value="98%" icon={TrendingUp} description="Operational" />
        <StatsCard title="Reports Generated" value="156" icon={CalendarCheck} description="Last 30 days" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Attendance Trends</CardTitle>
            <CardDescription>Weekly overview</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { day: 'Mon', attendance: 85 },
                { day: 'Tue', attendance: 92 },
                { day: 'Wed', attendance: 88 },
                { day: 'Thu', attendance: 90 },
                { day: 'Fri', attendance: 82 },
              ]}>
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="attendance" fill="#006837" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>System logs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 text-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <p className="flex-1 text-gray-600">
                    <span className="font-medium text-gray-900">System</span> backup completed successfully.
                  </p>
                  <span className="text-muted-foreground text-xs">2h ago</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
