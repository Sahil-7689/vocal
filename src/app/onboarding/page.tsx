"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useOrganization } from "@/context/OrganizationContext";
import { getAccessToken, getCurrentUser } from "@/lib/auth";
import { Building2, Sparkles, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const onboardingSchema = z.object({
  name: z
    .string()
    .min(2, "Organization name must be at least 2 characters")
    .max(50, "Organization name must be less than 50 characters"),
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

    const token = getAccessToken();
    const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

    // 1. Try local Express backend API first
    try {
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
        completeOnboarding(result.name || data.name, result.org_id);
        toast.success(`Organization "${data.name}" created! Role assigned: Owner`);
        router.push("/dashboard");
        return;
      }
    } catch (err) {
      // Ignore network error for local Express server — fallback to direct Hasura GraphQL below
    }

    // 2. Direct Hasura GraphQL Fallback (for live production Vercel deployment)
    try {
      const graphqlUrl =
        (process.env.NEXT_PUBLIC_GRAPHQL_URL || "").trim().replace(".graphql.", ".hasura.") ||
        (process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN
          ? `https://${process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN}.hasura.${process.env.NEXT_PUBLIC_NHOST_REGION || "us-east-1"}.nhost.run/v1/graphql`
          : "");

      if (!graphqlUrl) {
        throw new Error("No GraphQL URL configured.");
      }

      const gqlRes = await fetch(graphqlUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(currentUser?.id ? { "x-hasura-user-id": currentUser.id } : {}),
          "x-hasura-role": "user",
        },
        body: JSON.stringify({
          query: `mutation CreateOrganizationDirect($name: String!, $userId: uuid!) {
            insert_organizations_one(object: {
              name: $name
              quota_allowed: 100
              quota_used: 0
              members: {
                data: [{
                  user_id: $userId
                  role: "owner"
                }]
              }
            }) {
              id
              name
            }
          }`,
          variables: { name: data.name, userId: currentUser?.id },
        }),
      });

      const gqlJson = await gqlRes.json();
      const newOrg = gqlJson?.data?.insert_organizations_one;

      if (newOrg?.id) {
        completeOnboarding(newOrg.name || data.name, newOrg.id);
        toast.success(`Organization "${data.name}" created! Role assigned: Owner`);
        router.push("/dashboard");
        return;
      }

      if (gqlJson?.errors?.length) {
        throw new Error(gqlJson.errors[0].message);
      }
      throw new Error("Unable to create organization.");
    } catch (err: any) {
      const errMsg = err?.message || "Failed to create organization. Please try again.";
      setErrorMessage(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-on-surface p-6 relative overflow-hidden">
      <div className="max-w-md w-full bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-8 shadow-xl space-y-6 animate-fade-up relative z-10">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="font-display font-bold text-2xl text-on-surface">Welcome to VocalFlow</h1>
          <p className="text-xs text-on-surface-variant">
            Create an organization to start building and managing AI workflows.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-error/10 border border-error/30 text-xs text-error font-mono break-words">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-on-surface flex items-center justify-between">
              <span>Organization Name</span>
              <span className="text-[10px] text-on-surface-variant font-mono">Role: Owner</span>
            </label>
            <input
              {...register("name")}
              placeholder="e.g. Acme AI Studio"
              className="w-full h-10 px-3 rounded-lg bg-surface-container-low border border-outline-variant/60 text-xs font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            />
            {errors.name && (
              <p className="text-[11px] text-error font-mono mt-1">{errors.name.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-mono text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating Organization...
              </>
            ) : (
              <>
                <span>Complete Setup</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-outline-variant/40 text-center">
          <p className="text-[11px] text-on-surface-variant font-mono flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Includes 100 free monthly execution quota</span>
          </p>
        </div>
      </div>
    </div>
  );
}
