"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthenticationStatus } from "@nhost/react";
import { useOrganization } from "@/context/OrganizationContext";
import { Loader2 } from "lucide-react";

const PUBLIC_ROUTES = ["/login", "/signup"];

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuthenticationStatus();
  const { hasOrganization } = useOrganization();
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

    // 1. Unauthenticated user on protected route -> Redirect to /login
    if (isLiveBackend && !isLoading && !isAuthenticated && !isPublicRoute) {
      router.replace("/login");
      return;
    }

    // 2. Authenticated user without an organization trying to access protected routes -> Redirect to /onboarding
    if (!hasOrganization && pathname !== "/onboarding" && !isPublicRoute) {
      router.replace("/onboarding");
      return;
    }

    // 3. Authenticated user with an organization trying to visit /onboarding -> Redirect to /dashboard
    if (hasOrganization && pathname === "/onboarding") {
      router.replace("/dashboard");
      return;
    }
  }, [isLiveBackend, isLoading, isAuthenticated, hasOrganization, isPublicRoute, pathname, router, mounted]);

  // Show loading spinner while Nhost determines authentication session on protected routes
  if (isLiveBackend && isLoading && !isPublicRoute) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-on-surface font-mono text-xs space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="text-on-surface-variant">Verifying Nhost session...</span>
      </div>
    );
  }

  return <>{children}</>;
};
