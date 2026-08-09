"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { loginWithEmailPassword } from "@/lib/auth";
import { ShaderBackground } from "@/components/layout/ShaderBackground";
import { Zap, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    setErrorMessage(null);

    try {
      await loginWithEmailPassword(data.email, data.password);
      toast.success("Welcome back to VocalFlow!");
      router.push("/dashboard");
    } catch (err: any) {
      const msg = err.message || "Sign in failed. Please check your credentials.";
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
            AI Workflow Automation Platform
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-error-container/30 border border-error/40 text-xs text-error font-mono">
            {errorMessage}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
              Email address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                {...register("email")}
                type="email"
                placeholder="name@company.com"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-container-low border border-outline-variant/60 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
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
                placeholder="••••••••"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-container-low border border-outline-variant/60 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
            </div>
            {errors.password && (
              <span className="text-[10px] text-error font-mono">{errors.password.message}</span>
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
                Signing in...
              </>
            ) : (
              <>
                Sign in to VocalFlow
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
