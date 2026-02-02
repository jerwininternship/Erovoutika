import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { Link, useSearch } from "wouter";
import { supabase } from "@/lib/supabase";
import { 
  GraduationCap, 
  Loader2, 
  Mail, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

// Generate a secure random token
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export default function ForgotPassword() {
  const { settings } = useSystemSettings();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const search = useSearch();
  const isFromProfile = new URLSearchParams(search).get('from') === 'profile';

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsSubmitting(true);
    
    try {
      // Check if user exists with this email
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, email, full_name")
        .eq("email", data.email.toLowerCase())
        .single();

      if (userError || !userData) {
        // For security, don't reveal whether email exists
        // Still show success message to prevent email enumeration
        setSubmittedEmail(data.email);
        setIsSubmitted(true);
        return;
      }

      // Generate secure token
      const token = generateSecureToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Delete any existing tokens for this user
      await supabase
        .from("password_reset_tokens")
        .delete()
        .eq("user_id", userData.id);

      // Store the token in the database
      const { error: tokenError } = await supabase
        .from("password_reset_tokens")
        .insert({
          user_id: userData.id,
          token: token,
          expires_at: expiresAt.toISOString(),
        });

      if (tokenError) {
        throw new Error("Failed to create reset token");
      }

      // Build the reset URL
      const resetUrl = `${window.location.origin}/reset-password?token=${token}`;

      // Send password reset email via API
      const emailResponse = await fetch('/api/send-reset-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: userData.email, 
          resetUrl, 
          name: userData.full_name,
          systemName: settings.systemTitle || 'Attendance Monitoring System',
          schoolName: settings.schoolName || 'Your School',
        })
      });

      const emailResult = await emailResponse.json();

      // Check if we're in development mode
      const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';
      
      if (emailResult.success) {
        // Email sent successfully!
        toast({
          title: "Email Sent! ✉️",
          description: "Check your inbox for the password reset link.",
        });
      } else if (isDevelopment) {
        // Development fallback: show link in toast if email fails
        console.log("🔐 [DEV] Password Reset URL:", resetUrl);
        console.log("🔐 [DEV] For user:", userData.full_name, userData.email);
        console.warn("Email sending failed, showing dev fallback:", emailResult.error);
        
        toast({
          title: "🔧 Development Mode",
          description: (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-yellow-600 font-medium">⚠️ Email failed - using dev fallback</p>
              <p className="text-xs">Reset link (copy this):</p>
              <code className="block p-2 bg-muted rounded text-xs break-all select-all">
                {resetUrl}
              </code>
            </div>
          ),
          duration: 60000,
        });
      } else {
        // Production: email failed but don't expose the link
        console.error("Failed to send password reset email:", emailResult.error);
        // Still show success to prevent email enumeration
      }

      setSubmittedEmail(data.email);
      setIsSubmitted(true);
      
    } catch (error) {
      console.error("Forgot password error:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
            {isFromProfile ? "Reset Password" : "Forgot Password?"}
          </h1>
          <p className="text-muted-foreground">
            No worries, we'll send you reset instructions.
          </p>
        </div>

        <Card className="shadow-lg">
          <CardContent className="pt-6">
            {isSubmitted ? (
              // Success State
              <div className="space-y-6">
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800">Check your email</AlertTitle>
                  <AlertDescription className="text-green-700">
                    If an account exists for <span className="font-medium">{submittedEmail}</span>, 
                    you will receive a password reset link shortly.
                  </AlertDescription>
                </Alert>

                <div className="text-center space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Didn't receive the email? Check your spam folder or
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsSubmitted(false);
                      form.reset();
                    }}
                  >
                    Try another email
                  </Button>
                </div>

                <div className="pt-4 border-t">
                  <Link href={isFromProfile ? "/profile" : "/login"}>
                    <Button variant="ghost" className="w-full">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      {isFromProfile ? "Back" : "Back to login"}
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              // Form State
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input 
                              className="pl-9 h-11" 
                              placeholder="Enter your email address" 
                              type="email"
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full h-11 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>

                  <div className="text-center">
                    <Link href={isFromProfile ? "/profile" : "/login"}>
                      <Button variant="ghost" className="text-sm">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {isFromProfile ? "Back" : "Back to login"}
                      </Button>
                    </Link>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Alert variant="default" className="bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-700 text-sm">
            For your security, password reset links expire after 1 hour and can only be used once.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}