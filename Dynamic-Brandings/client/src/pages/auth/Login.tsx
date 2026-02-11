import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { useLocation, Link } from "wouter";
import { 
  GraduationCap, 
  Loader2, 
  User, 
  Lock, 
  BookOpen, 
  ShieldCheck,
  QrCode
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Using z.enum directly for type safety with the backend schema
const loginSchema = z.object({
  identifier: z.string().min(1, "Email or ID Number is required"),
  password: z.string().min(1, "Password is required"),
  role: z.enum(["student", "teacher", "superadmin"]),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { login, isLoggingIn, user } = useAuth();
  const { settings } = useSystemSettings();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"student" | "teacher" | "superadmin">("student");
  const [hasAttendanceScan, setHasAttendanceScan] = useState(false);

  // Check for attendance scan parameters in URL (from QR code scanned via external app)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const scan = urlParams.get('scan');
    const token = urlParams.get('token');
    const subjectId = urlParams.get('subjectId');
    
    if (scan === 'attendance' && token && subjectId) {
      // Store attendance data in sessionStorage for processing after login
      sessionStorage.setItem('pendingAttendanceScan', JSON.stringify({
        token,
        subjectId,
        timestamp: Date.now()
      }));
      setHasAttendanceScan(true);
      // Force student tab since only students scan attendance
      setActiveTab('student');
    }
  }, []);

  // Redirect if already logged in
  if (user) {
    // If there's a pending attendance scan, redirect to attendance page
    const pendingScan = sessionStorage.getItem('pendingAttendanceScan');
    if (pendingScan && user.role === 'student') {
      setLocation("/attendance");
    } else {
      setLocation("/dashboard");
    }
    return null;
  }

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
      role: "student",
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    login({ ...data, role: activeTab });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-gray-50">
      {/* Left Side - Form */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-white shadow-xl shadow-primary/20 mb-4">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
              ) : (
                <GraduationCap className="w-8 h-8" />
              )}
            </div>
            <h1 className="text-3xl font-display font-bold tracking-tight text-gray-900">
              Welcome Back
            </h1>
            <p className="text-muted-foreground">
              Sign in to your {settings.systemTitle} account
            </p>
          </div>

          {/* Show alert if redirected from QR scan */}
          {hasAttendanceScan && (
            <Alert className="bg-primary/10 border-primary/20">
              <QrCode className="h-4 w-4 text-primary" />
              <AlertDescription className="text-primary">
                <strong>Attendance QR Code Detected!</strong><br />
                Please sign in with your student account to record your attendance.
              </AlertDescription>
            </Alert>
          )}

          <Tabs 
            defaultValue="student" 
            value={activeTab} 
            onValueChange={(v) => setActiveTab(v as any)}
            className="w-full"
          >
            {/* -- removed the tablist of the roles
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="student">Student</TabsTrigger>
              <TabsTrigger value="teacher">Teacher</TabsTrigger>
              <TabsTrigger value="superadmin">Admin</TabsTrigger>
            </TabsList>
*/}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="identifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email or ID Number</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9 h-11" placeholder="Email or ID Number" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input type="password" className="pl-9 h-11" placeholder="••••••••" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
                <div className="text-center">
                  <Link href="/forgot-password">
                    <Button variant="ghost" type="button" className="text-sm text-muted-foreground hover:text-primary">
                      Forgot your password?
                    </Button>
                  </Link>
                </div>
              </form>
            </Form>
          </Tabs>
        </div>
      </div>

      {/* Right Side - Visual */}
            <div className="hidden lg:flex relative bg-primary items-center justify-center p-12 overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay" />
            {/* <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80" /> */}
        
        <div className="relative z-10 max-w-lg text-white space-y-8">
          <div className="space-y-4">
            <h2 className="text-4xl font-display font-bold leading-tight">
              {settings.tagline || "Streamlining Academic Attendance"} at {settings.schoolName}
            </h2>
            <p className="text-lg text-primary-foreground/80 leading-relaxed">
              Efficient, accurate, and real-time attendance monitoring for students and faculty.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
              <CardHeader className="space-y-1">
                <BookOpen className="w-8 h-8 mb-2 text-white" />
                <CardTitle className="text-white text-lg">Smart Tracking</CardTitle>
                <CardDescription className="text-white/60">Automated attendance management for all classes</CardDescription>
              </CardHeader>
            </Card>
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
              <CardHeader className="space-y-1">
                <ShieldCheck className="w-8 h-8 mb-2 text-white" />
                <CardTitle className="text-white text-lg">Secure Access</CardTitle>
                <CardDescription className="text-white/60">Role-based permissions and data protection</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
