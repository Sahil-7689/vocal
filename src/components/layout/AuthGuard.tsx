"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthenticationStatus } from "@nhost/react";
import { useOrganization } from "@/context/OrganizationContext";
import { Loader2 } from "lucide-react";

const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password"];

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuthenticationStatus();
  const { hasOrganization, pendingOnboarding, orgFetching } = useOrganization();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLiveBackend = Boolean(
    process.env.NEXT_PUBLIC_GRAPHQL_URL || process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN
  );

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (!mounted) return;

    // Still waiting for Nhost session check or org membership fetch — do nothing yet
    if (isLoading || orgFetching) return;

    // 1. Unauthenticated user on protected route → /login
    if (isLiveBackend && !isAuthenticated && !isPublicRoute) {
      router.replace("/login");
      return;
    }

    // If new signup flow is in progress
    if (pendingOnboarding) {
      if (pathname !== "/onboarding" && !isPublicRoute) {
        router.replace("/onboarding");
      }
      return;
    }

    // 2. Authenticated + no org on protected routes → /onboarding
    //    Only redirect AFTER orgFetching is complete (prevents false redirect when org loads slowly)
    if (isAuthenticated && !hasOrganization && pathname !== "/onboarding" && !isPublicRoute) {
      router.replace("/onboarding");
      return;
    }

    // 3. Authenticated WITH org on /onboarding → /dashboard
    if (isAuthenticated && hasOrganization && pathname === "/onboarding") {
      router.replace("/dashboard");
      return;
    }

    // 4. Authenticated WITH org visiting public auth routes → /dashboard
    if (isLiveBackend && isAuthenticated && isPublicRoute && pathname !== "/forgot-password") {
      if (hasOrganization) {
        router.replace("/dashboard");
      } else {
        router.replace("/onboarding");
      }
      return;
    }
  }, [
    isLiveBackend,
    isLoading,
    orgFetching,
    isAuthenticated,
    hasOrganization,
    pendingOnboarding,
    isPublicRoute,
    pathname,
    router,
    mounted,
  ]);

  if (!mounted) return null;

  // Show loading spinner while Nhost session OR org membership fetch is in-flight on protected routes
  if (isLiveBackend && (isLoading || orgFetching) && !isPublicRoute) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-on-surface font-mono text-xs space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="text-on-surface-variant">
          {isLoading ? "Verifying session..." : "Loading organization..."}
        </span>
      </div>
    );
  }

  return <>{children}</>;
};
