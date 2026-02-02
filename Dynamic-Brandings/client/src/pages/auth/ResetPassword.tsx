import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { Link, useLocation, useSearch } from "wouter";
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
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const token = searchParams.get("token");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [tokenData, setTokenData] = useState<{ userId: number; userName: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const watchedPassword = form.watch("password");
  const passwordStrength = calculatePasswordStrength(watchedPassword || "");

  // Validate token on mount
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setIsValidating(false);
        setIsValidToken(false);
        return;
      }

      try {
        // Check if token exists and is valid
        const { data: tokenRecord, error } = await supabase
          .from("password_reset_tokens")
          .select("id, user_id, expires_at, used_at")
          .eq("token", token)
          .single();

        if (error || !tokenRecord) {
          setIsValidToken(false);
          setIsValidating(false);
          return;
        }

        // Check if token is expired
        if (new Date(tokenRecord.expires_at) < new Date()) {
          setIsValidToken(false);
          setIsValidating(false);
          return;
        }

        // Check if token is already used
        if (tokenRecord.used_at) {
          setIsValidToken(false);
          setIsValidating(false);
          return;
        }

        // Get user info
        const { data: userData } = await supabase
          .from("users")
          .select("id, full_name")
          .eq("id", tokenRecord.user_id)
          .single();

        if (userData) {
          setTokenData({ userId: userData.id, userName: userData.full_name });
        }

        setIsValidToken(true);
      } catch (err) {
        console.error("Token validation error:", err);
        setIsValidToken(false);
      } finally {
        setIsValidating(false);
      }
    }

    validateToken();
  }, [token]);

  const onSubmit = async (data: ResetPasswordFormValues) => {
    if (!token || !tokenData) return;
    
    setIsSubmitting(true);
    
    try {
      // Update user password
      const { error: updateError } = await supabase
        .from("users")
        .update({ password: data.password })
        .eq("id", tokenData.userId);

      if (updateError) {
        throw new Error("Failed to update password");
      }

      // Mark token as used
      await supabase
        .from("password_reset_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("token", token);

      setIsSuccess(true);
      
      toast({
        title: "Password Reset Successful",
        description: "Your password has been updated. You can now log in with your new password.",
      });
      
    } catch (error) {
      console.error("Reset password error:", error);
      toast({
        title: "Error",
        description: "Failed to reset password. Please try again.",
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
  if (!isValidToken) {
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
                  Password reset links expire after 1 hour and can only be used once. 
                  Please request a new reset link if you still need to reset your password.
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
            {tokenData?.userName ? `Hi ${tokenData.userName.split(' ')[0]}, create` : "Create"} a new password for your account.
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