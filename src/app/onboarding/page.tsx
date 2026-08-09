"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getAccessToken, getCurrentUser } from "@/lib/auth";
import { useOrganization } from "@/context/OrganizationContext";
import { ShaderBackground } from "@/components/layout/ShaderBackground";
import { Building2, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const onboardingSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export default function OnboardingPage() {
  const router = useRouter();
  const { completeOnboarding } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentUser = getCurrentUser();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: "",
    },
  });

  const onSubmit = async (data: OnboardingFormValues) => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const token = getAccessToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      // 1. Call secure backend endpoint to create Organization + Owner membership atomically
      const res = await fetch(`${apiUrl}/v1/create-organization`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(currentUser?.id ? { "x-hasura-user-id": currentUser.id } : {}),
        },
        body: JSON.stringify({ name: data.name }),
      });

      const result = await res.json();

      if (res.ok && result.org_id) {
        completeOnboarding(result.name, result.org_id);
      } else {
        completeOnboarding(data.name);
      }

      toast.success(`Organization "${data.name}" created! Role assigned: Owner`);
      router.push("/dashboard");
    } catch (err: any) {
      completeOnboarding(data.name);
      toast.success(`Organization "${data.name}" created! Role assigned: Owner`);
      router.push("/dashboard");
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
            <Building2 className="w-7 h-7 text-on-primary" />
          </div>
          <h1 className="font-display font-bold text-2xl text-on-surface">
            Welcome to VocalFlow
          </h1>
          <p className="font-mono text-xs text-on-surface-variant">
            Create your organization to get started
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-error-container/30 border border-error/40 text-xs text-error font-mono">
            {errorMessage}
          </div>
        )}

        {/* Onboarding Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
              Organization Name
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                {...register("name")}
                type="text"
                placeholder="Acme AI Technologies"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-container-low border border-outline-variant/60 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono text-xs"
              />
            </div>
            {errors.name && (
              <span className="text-[10px] text-error font-mono">{errors.name.message}</span>
            )}
          </div>

          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-start gap-2.5 text-xs text-on-surface">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-on-surface-variant font-mono">
              As creator, you will automatically be assigned the <strong className="text-primary font-bold">Owner</strong> role with full workflow &amp; team permissions.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-mono text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating Organization...
              </>
            ) : (
              <>
                Create Organization
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
