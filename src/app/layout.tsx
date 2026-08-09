"use client";

import React from "react";
import "./globals.css";
import { NhostProvider } from "@nhost/react";
import { ApolloProvider } from "@apollo/client";
import { nhost } from "@/lib/nhost";
import { apolloClient } from "@/lib/apollo";
import { OrganizationProvider } from "@/context/OrganizationContext";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>VocalFlow — AI Workflow Automation Platform</title>
        <meta
          name="description"
          content="Enterprise AI workflow automation platform powered by Nhost and Hasura GraphQL."
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <NhostProvider nhost={nhost}>
          <ApolloProvider client={apolloClient}>
            <OrganizationProvider>
              <AuthGuard>
                {children}
              </AuthGuard>
              <Toaster position="top-right" richColors closeButton />
            </OrganizationProvider>
          </ApolloProvider>
        </NhostProvider>
      </body>
    </html>
  );
}

