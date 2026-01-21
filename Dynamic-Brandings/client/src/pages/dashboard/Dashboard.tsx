import { useAuth } from "@/hooks/use-auth";
import { useAttendance } from "@/hooks/use-attendance";
import { useSubjects } from "@/hooks/use-subjects";
import { useTeacherSchedules } from "@/hooks/use-schedules";
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

  // Calculate simple stats
  const totalClasses = attendance?.length || 0;
  const presentCount = attendance?.filter(a => a.status === 'present').length || 0;
  const attendanceRate = totalClasses ? Math.round((presentCount / totalClasses) * 100) : 100;

  const chartData = [
    { name: 'Present', value: presentCount, color: '#22c55e' },
    { name: 'Late', value: attendance?.filter(a => a.status === 'late').length || 0, color: '#f97316' },
    { name: 'Absent', value: attendance?.filter(a => a.status === 'absent').length || 0, color: '#ef4444' },
    { name: 'Excused', value: attendance?.filter(a => a.status === 'excused').length || 0, color: '#3b82f6' },
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
          value={attendance?.filter(a => a.status === 'absent').length || 0} 
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
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 text-xs text-muted-foreground mt-4">
              {chartData.map(item => (
                <div key={item.name} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TeacherDashboard() {
  const { data: subjects } = useSubjects();
  const { data: schedules } = useTeacherSchedules();

  // In a real app, we'd fetch aggregate stats
  const totalStudents = 120; // Mock
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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Classes" value={subjects?.length || 0} icon={BookOpen} description="Active subjects" />
        <StatsCard title="Total Students" value={totalStudents} icon={Users} description="Across all sections" />
        <StatsCard title="Avg. Attendance" value={avgAttendance} icon={TrendingUp} description="This semester" />
        <StatsCard title="Classes Today" value="3" icon={Clock} description="Upcoming sessions" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Schedule Card */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Class Schedule
            </CardTitle>
            <CardDescription>Your weekly class schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.values(groupedSchedules).length > 0 ? (
                Object.values(groupedSchedules).map((group, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{group.subjectName}</h4>
                        <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">
                          {group.subjectCode}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {consolidateSchedules(group.schedules).map((sched, schedIdx) => (
                          <div key={schedIdx} className="flex items-center justify-between text-sm bg-white p-2 rounded border border-gray-100">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <div className="font-medium text-gray-700 min-w-[90px]">
                                {sched.days.length > 1 
                                  ? sched.days.map((d, i) => (
                                      <div key={i}>{dayAbbr[d]}</div>
                                    ))
                                  : sched.days[0]
                                }
                              </div>
                              <span className="text-muted-foreground">
                                {formatTime(sched.startTime)} - {formatTime(sched.endTime)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>{sched.room}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground bg-gray-50 rounded-xl border border-dashed">
                  No schedules set up yet.
                </div>
              )}
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
                <div key={subject.id} className="p-4 rounded-xl border bg-card hover:border-primary/50 transition-colors group cursor-pointer">
                  <div className="flex justify-between items-start mb-2">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{subject.code}</span>
                  </div>
                  <h3 className="font-semibold text-base mb-1">{subject.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">{subject.description || "No description provided."}</p>
                  <div className="mt-3 pt-3 border-t flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">32 Students</span>
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
