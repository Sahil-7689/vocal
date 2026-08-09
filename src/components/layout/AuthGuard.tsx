"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthenticationStatus } from "@nhost/react";
import { Loader2 } from "lucide-react";

const PUBLIC_ROUTES = ["/login"];

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuthenticationStatus();
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

    const isDemoAuthenticated =
      typeof window !== "undefined" &&
      sessionStorage.getItem("vocalflow_authenticated") === "true";

    // Only redirect if backend is live, Nhost isn't loading, user isn't authenticated via Nhost or Demo preset, and route is protected
    if (
      isLiveBackend &&
      !isLoading &&
      !isAuthenticated &&
      !isDemoAuthenticated &&
      !isPublicRoute
    ) {
      router.replace("/login");
    }
  }, [isLiveBackend, isLoading, isAuthenticated, isPublicRoute, router, mounted, pathname]);

  if (!mounted) return null;

  const isDemoAuthenticated =
    typeof window !== "undefined" &&
    sessionStorage.getItem("vocalflow_authenticated") === "true";

  // Show loading indicator while Nhost is determining session state on protected routes
  if (isLiveBackend && isLoading && !isAuthenticated && !isDemoAuthenticated && !isPublicRoute) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-on-surface font-mono text-xs space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="text-on-surface-variant">Verifying session...</span>
      </div>
    );
  }

  return <>{children}</>;
};
