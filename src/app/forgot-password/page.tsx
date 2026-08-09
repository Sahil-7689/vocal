"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { nhost } from "@/lib/nhost";
import { ShaderBackground } from "@/components/layout/ShaderBackground";
import { Zap, Mail, ArrowRight, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const resetSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ResetFormValues = z.infer<typeof resetSchema>;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ResetFormValues) => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await nhost.auth.resetPassword({
        email: data.email,
      });

      if (res.error) {
        throw new Error(res.error.message);
      }

      setSubmitted(true);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (err: any) {
      const msg = err.message || "Failed to send password reset email.";
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
          <h1 className="font-display font-bold text-2xl text-on-surface">Reset Password</h1>
          <p className="font-mono text-xs text-on-surface-variant">
            Enter your email to receive a password reset link
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-error-container/30 border border-error/40 text-xs text-error font-mono">
            {errorMessage}
          </div>
        )}

        {submitted ? (
          <div className="text-center space-y-4 py-4">
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
            <p className="text-xs text-on-surface font-mono">
              Password reset link sent! Check your email inbox.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary font-mono text-xs font-semibold shadow-md"
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
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
                  autoComplete="off"
                  placeholder="name@company.com"
                  className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-container-low border border-outline-variant/60 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono"
                />
              </div>
              {errors.email && (
                <span className="text-[10px] text-error font-mono">{errors.email.message}</span>
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
                  Sending link...
                </>
              ) : (
                <>
                  Send Reset Link
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Navigation Link */}
        <div className="pt-4 border-t border-outline-variant/40 text-center font-mono text-xs">
          <Link href="/login" className="inline-flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
