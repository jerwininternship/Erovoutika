import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { 
  GraduationCap, 
  Loader2, 
  Lock, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck
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
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

// Calculate password strength
function calculatePasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 10;
  if (/[A-Z]/.test(password)) score += 20;
  if (/[a-z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^A-Za-z0-9]/.test(password)) score += 15;
  
  if (score < 40) return { score, label: "Weak", color: "bg-red-500" };
  if (score < 70) return { score, label: "Fair", color: "bg-yellow-500" };
  if (score < 90) return { score, label: "Good", color: "bg-blue-500" };
  return { score: Math.min(score, 100), label: "Strong", color: "bg-green-500" };
}

export default function ResetPassword() {
  const { settings } = useSystemSettings();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValidSession, setIsValidSession] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const watchedPassword = form.watch("password");
  const passwordStrength = calculatePasswordStrength(watchedPassword || "");

  // Handle Supabase auth state change for password recovery
  useEffect(() => {
    console.log("🔐 ResetPassword: Page loaded");
    console.log("🔐 Full URL:", window.location.href);
    console.log("🔐 Hash:", window.location.hash);
    
    // Check for hash fragment (Supabase redirects with #access_token=...)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    const errorDesc = hashParams.get('error_description');
    const errorCode = hashParams.get('error_code');
    const error = hashParams.get('error');

    console.log("🔐 Parsed hash params:", { accessToken: accessToken ? "present" : "missing", type, errorDesc, errorCode, error });

    if (error || errorDesc) {
      const errorMsg = errorDesc 
        ? decodeURIComponent(errorDesc.replace(/\+/g, ' '))
        : error || "Unknown error";
      console.error("🔐 Error from URL:", errorMsg);
      setErrorMessage(errorMsg);
      setIsValidating(false);
      setIsValidSession(false);
      return;
    }

    // If we have a recovery type access token, we're in password recovery mode
    if (type === 'recovery' && accessToken) {
      // Set the session with the access token
      const refreshToken = hashParams.get('refresh_token');
      
      if (accessToken && refreshToken) {
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }).then(({ data, error }) => {
          if (error) {
            console.error("Error setting session:", error);
            setErrorMessage("Invalid or expired reset link.");
            setIsValidSession(false);
          } else if (data.user) {
            setUserEmail(data.user.email || null);
            setIsValidSession(true);
          }
          setIsValidating(false);
        });
      } else {
        setErrorMessage("Invalid reset link.");
        setIsValidating(false);
        setIsValidSession(false);
      }
    } else {
      // Check if there's already a valid session (user might have clicked the link)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setUserEmail(session.user.email || null);
          setIsValidSession(true);
        } else {
          // No valid session and no recovery token
          setErrorMessage("No valid password reset session found. Please request a new reset link.");
          setIsValidSession(false);
        }
        setIsValidating(false);
      });
    }

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setUserEmail(session?.user.email || null);
        setIsValidSession(true);
        setIsValidating(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (data: ResetPasswordFormValues) => {
    setIsSubmitting(true);
    
    try {
      // Update password using Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: data.password
      });

      if (error) {
        throw error;
      }

      // Also update the password in our users table if email is available
      if (userEmail) {
        await supabase
          .from("users")
          .update({ password: data.password })
          .eq("email", userEmail.toLowerCase());
      }

      // Sign out after password change
      await supabase.auth.signOut();

      setIsSuccess(true);
      
      toast({
        title: "Password Reset Successful",
        description: "Your password has been updated. You can now log in with your new password.",
      });
      
    } catch (error: any) {
      console.error("Reset password error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to reset password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Validating reset link...</p>
        </div>
      </div>
    );
  }

  // Invalid or expired token
  if (!isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-100 text-red-600 mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-display font-bold tracking-tight text-gray-900">
              Invalid or Expired Link
            </h1>
            <p className="text-muted-foreground">
              This password reset link is invalid, expired, or has already been used.
            </p>
          </div>

          <Card className="shadow-lg">
            <CardContent className="pt-6 space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Link Not Valid</AlertTitle>
                <AlertDescription>
                  {errorMessage || "Password reset links expire after 1 hour and can only be used once. Please request a new reset link if you still need to reset your password."}
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <Link href="/forgot-password">
                  <Button className="w-full">
                    Request New Reset Link
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-100 text-green-600 mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-display font-bold tracking-tight text-gray-900">
              Password Reset Complete
            </h1>
            <p className="text-muted-foreground">
              Your password has been successfully updated.
            </p>
          </div>

          <Card className="shadow-lg">
            <CardContent className="pt-6 space-y-4">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Success!</AlertTitle>
                <AlertDescription className="text-green-700">
                  You can now log in with your new password. For your security, 
                  you've been logged out of all other devices.
                </AlertDescription>
              </Alert>

              <Link href="/login">
                <Button className="w-full h-11 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
                  Continue to Login
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Reset password form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-white shadow-xl shadow-primary/20 mb-4">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
            ) : (
              <GraduationCap className="w-8 h-8" />
            )}
          </div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-gray-900">
            Reset Your Password
          </h1>
          <p className="text-muted-foreground">
            {userEmail ? `Resetting password for ${userEmail}` : "Create a new password for your account."}
          </p>
        </div>

        <Card className="shadow-lg">
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input 
                            type={showPassword ? "text" : "password"}
                            className="pl-9 pr-10 h-11" 
                            placeholder="Enter new password" 
                            {...field} 
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-11 w-10 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      {watchedPassword && (
                        <div className="space-y-2 mt-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Password strength:</span>
                            <span className={`font-medium ${
                              passwordStrength.label === "Weak" ? "text-red-500" :
                              passwordStrength.label === "Fair" ? "text-yellow-500" :
                              passwordStrength.label === "Good" ? "text-blue-500" :
                              "text-green-500"
                            }`}>
                              {passwordStrength.label}
                            </span>
                          </div>
                          <Progress 
                            value={passwordStrength.score} 
                            className="h-1.5"
                          />
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <ShieldCheck className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input 
                            type={showConfirmPassword ? "text" : "password"}
                            className="pl-9 pr-10 h-11" 
                            placeholder="Confirm new password" 
                            {...field} 
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-11 w-10 hover:bg-transparent"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Password requirements */}
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Password must contain:</p>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    <li className={`flex items-center gap-2 ${watchedPassword?.length >= 8 ? "text-green-600" : ""}`}>
                      <CheckCircle2 className={`h-3 w-3 ${watchedPassword?.length >= 8 ? "text-green-600" : "text-muted-foreground/50"}`} />
                      At least 8 characters
                    </li>
                    <li className={`flex items-center gap-2 ${/[A-Z]/.test(watchedPassword || "") ? "text-green-600" : ""}`}>
                      <CheckCircle2 className={`h-3 w-3 ${/[A-Z]/.test(watchedPassword || "") ? "text-green-600" : "text-muted-foreground/50"}`} />
                      One uppercase letter
                    </li>
                    <li className={`flex items-center gap-2 ${/[a-z]/.test(watchedPassword || "") ? "text-green-600" : ""}`}>
                      <CheckCircle2 className={`h-3 w-3 ${/[a-z]/.test(watchedPassword || "") ? "text-green-600" : "text-muted-foreground/50"}`} />
                      One lowercase letter
                    </li>
                    <li className={`flex items-center gap-2 ${/[0-9]/.test(watchedPassword || "") ? "text-green-600" : ""}`}>
                      <CheckCircle2 className={`h-3 w-3 ${/[0-9]/.test(watchedPassword || "") ? "text-green-600" : "text-muted-foreground/50"}`} />
                      One number
                    </li>
                  </ul>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting Password...
                    </>
                  ) : (
                    "Reset Password"
                  )}
                </Button>

                <div className="text-center">
                  <Link href="/login">
                    <Button variant="ghost" className="text-sm">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to login
                    </Button>
                  </Link>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
