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
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

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
      // First check if user exists in our users table
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, email, full_name, password")
        .eq("email", data.email.toLowerCase())
        .single();

      if (userError || !userData) {
        // For security, don't reveal whether email exists
        // Still show success message to prevent email enumeration
        setSubmittedEmail(data.email);
        setIsSubmitted(true);
        return;
      }

      // Try to sign up the user to Supabase Auth if they don't exist there yet
      // This is needed because resetPasswordForEmail only works for Supabase Auth users
      const tempPassword = userData.password || crypto.randomUUID();
      
      // First try to sign up (will fail if user already exists in auth)
      const { error: signUpError } = await supabase.auth.signUp({
        email: data.email.toLowerCase(),
        password: tempPassword,
        options: {
          data: {
            full_name: userData.full_name,
            user_id: userData.id,
          }
        }
      });
      
      // Ignore "User already registered" error - that's expected
      if (signUpError && !signUpError.message.includes("already registered")) {
        console.log("Sign up attempt result:", signUpError.message);
      }

      // Now request password reset
      // Determine the correct redirect URL based on environment
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const redirectUrl = isLocalhost 
        ? `${window.location.origin}/reset-password`
        : "https://dlsuqr.vercel.app/reset-password";
      
      console.log("🔐 Requesting password reset for:", data.email.toLowerCase());
      console.log("🔐 Redirect URL:", redirectUrl);
      console.log("🔐 Is localhost:", isLocalhost);
      
      const { data: resetData, error } = await supabase.auth.resetPasswordForEmail(data.email.toLowerCase(), {
        redirectTo: redirectUrl,
      });

      console.log("🔐 Reset response:", { resetData, error });

      if (error) {
        console.error("Supabase reset password error:", error);
        
        // If rate limited, show specific message
        if (error.message.includes("rate") || error.message.includes("limit")) {
          toast({
            title: "Too Many Requests",
            description: "Please wait a few minutes before requesting another reset email.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Notice",
            description: "If an account exists, a reset email will be sent shortly.",
            variant: "default",
          });
        }
      } else {
        toast({
          title: "Email Sent! ✉️",
          description: "Check your inbox (and spam folder) for the password reset link.",
        });
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

                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                  <p className="text-sm text-amber-800">
                    <strong>📧 Note:</strong> The email may arrive in your <strong>spam/junk folder</strong>. 
                    Please check there if you don't see it in your inbox.
                  </p>
                </div>

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
