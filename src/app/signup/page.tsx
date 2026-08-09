"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signUpWithEmailPassword, loginWithEmailPassword } from "@/lib/auth";
import { useOrganization } from "@/context/OrganizationContext";
import { ShaderBackground } from "@/components/layout/ShaderBackground";
import { Zap, Mail, Lock, User, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

const signupSchema = z
  .object({
    displayName: z.string().min(2, "Full Name is required"),
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const { startOnboardingForNewUser } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: SignupFormValues) => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Nhost Auth User Registration
      const session = await signUpWithEmailPassword(data.email, data.password, data.displayName);
      toast.success("Account created successfully!");

      // 2. Automatically log user in to establish Nhost session
      await loginWithEmailPassword(data.email, data.password);
      
      // 3. Mark user in OrganizationContext as needing onboarding
      startOnboardingForNewUser({
        id: session?.user?.id,
        email: data.email,
        displayName: data.displayName,
      });

      // 4. Redirect to /onboarding for organization setup
      router.push("/onboarding");
    } catch (err: any) {
      let msg = err.message || "Account registration failed. Please try again.";
      if (msg.toLowerCase().includes("email already in use") || msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already exists")) {
        msg = "An account with this email already exists. Please Sign In below.";
      }
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden bg-background">
      {/* WebGL Shader Canvas Background */}
      <ShaderBackground />

      <div className="relative z-10 w-full max-w-md bg-surface-container-lowest/95 backdrop-blur-xl border border-outline-variant/60 rounded-2xl p-8 shadow-2xl space-y-6 animate-fade-up">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto shadow-md">
            <Zap className="w-7 h-7 text-on-primary fill-current" />
          </div>
          <h1 className="font-display font-bold text-2xl text-on-surface">VocalFlow</h1>
          <p className="font-mono text-xs text-on-surface-variant">
            Create your account to build AI Agent Workflows
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-error-container/30 border border-error/40 text-xs text-error font-mono">
            {errorMessage}
          </div>
        )}

        {/* Signup Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                {...register("displayName")}
                type="text"
                placeholder="Sahil Kumar"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-container-low border border-outline-variant/60 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
            </div>
            {errors.displayName && (
              <span className="text-[10px] text-error font-mono">{errors.displayName.message}</span>
            )}
          </div>

          <div className="space-y-1">
            <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
              Email address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                {...register("email")}
                type="email"
                autoComplete="off"
                placeholder="name@company.com"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-container-low border border-outline-variant/60 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono"
              />
            </div>
            {errors.email && (
              <span className="text-[10px] text-error font-mono">{errors.email.message}</span>
            )}
          </div>

          <div className="space-y-1">
            <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                {...register("password")}
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-container-low border border-outline-variant/60 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono"
              />
            </div>
            {errors.password && (
              <span className="text-[10px] text-error font-mono">{errors.password.message}</span>
            )}
          </div>

          <div className="space-y-1">
            <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                {...register("confirmPassword")}
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-container-low border border-outline-variant/60 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono"
              />
            </div>
            {errors.confirmPassword && (
              <span className="text-[10px] text-error font-mono">{errors.confirmPassword.message}</span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-mono text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                Create Account
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Link to Sign In */}
        <div className="pt-4 border-t border-outline-variant/40 text-center font-mono text-xs">
          <p className="text-on-surface-variant">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-bold hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
