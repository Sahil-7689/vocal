"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuthenticationStatus, useUserData } from "@nhost/react";
import { Organization, OrgMember, OrgRole, User } from "@/types";
import { getCurrentUser, getAccessToken } from "@/lib/auth";

interface OrganizationContextType {
  currentUser: User;
  currentOrganization: Organization;
  currentRole: OrgRole;
  organizations: Organization[];
  members: OrgMember[];
  hasOrganization: boolean;
  /** True immediately after signup, before the user completes onboarding. */
  pendingOnboarding: boolean;
  switchOrganization: (orgId: string) => void;
  switchUserRole: (userId: string, role: OrgRole) => void;
  startOnboardingForNewUser: (user: Partial<User>) => void;
  completeOnboarding: (orgName: string, orgId?: string) => void;
}

const fallbackUser: User = {
  id: "unauthenticated",
  email: "",
  displayName: "",
  avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
};

const fallbackOrg: Organization = {
  id: "org-default",
  name: "My Organization",
  slug: "my-organization",
  quotaLimit: 100,
  quotaUsed: 0,
  createdAt: new Date().toISOString(),
};

const OrganizationContext = createContext<OrganizationContextType>({
  currentUser: fallbackUser,
  currentOrganization: fallbackOrg,
  currentRole: "viewer",
  organizations: [],
  members: [],
  hasOrganization: false,
  pendingOnboarding: false,
  switchOrganization: () => {},
  switchUserRole: () => {},
  startOnboardingForNewUser: () => {},
  completeOnboarding: () => {},
});

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const nhostUser = useUserData(); // live Nhost user — null when not authed
  const { isAuthenticated } = useAuthenticationStatus();

  const [currentUser, setCurrentUser] = useState<User>(fallbackUser);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [pendingOnboarding, setPendingOnboarding] = useState(false);

  // 1. Sync currentUser from live Nhost session
  useEffect(() => {
    if (nhostUser && isAuthenticated) {
      setCurrentUser({
        id: nhostUser.id,
        email: nhostUser.email || "",
        displayName: nhostUser.displayName || nhostUser.email || "User",
        avatarUrl: nhostUser.avatarUrl || fallbackUser.avatarUrl,
      });
    } else {
      const active = getCurrentUser();
      if (active) {
        setCurrentUser({
          id: active.id,
          email: active.email || "",
          displayName: active.displayName || active.email || "User",
          avatarUrl: active.avatarUrl || fallbackUser.avatarUrl,
        });
      } else {
        setCurrentUser(fallbackUser);
      }
    }
  }, [nhostUser, isAuthenticated]);

  // 2. Fetch real org_members and organizations from PostgreSQL via Hasura GraphQL
  useEffect(() => {
    if (!currentUser.id || currentUser.id === "unauthenticated") {
      setOrganizations([]);
      setMembers([]);
      setCurrentOrgId(null);
      return;
    }

    async function fetchUserOrgMembers() {
      try {
        const token = getAccessToken();
        const graphqlUrl =
          (process.env.NEXT_PUBLIC_GRAPHQL_URL || "").trim() ||
          (process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN
            ? `https://${process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN}.graphql.${process.env.NEXT_PUBLIC_NHOST_REGION || "us-east-1"}.nhost.run/v1/graphql`
            : "http://localhost:4000/v1/graphql");

        const query = `
          query GetUserOrgMembers {
            org_members {
              id
              org_id
              user_id
              role
              organization {
                id
                name
                quota_allowed
                quota_used
                created_at
              }
            }
          }
        `;

        const res = await fetch(graphqlUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(currentUser.id ? { "x-hasura-user-id": currentUser.id } : {}),
          },
          body: JSON.stringify({ query }),
        });

        const json = await res.json();
        const orgMembers = json?.data?.org_members || [];

        if (Array.isArray(orgMembers) && orgMembers.length > 0) {
          const loadedOrgs: Organization[] = [];
          const loadedMembers: OrgMember[] = [];

          for (const m of orgMembers) {
            if (m.organization && !loadedOrgs.some((o) => o.id === m.organization.id)) {
              loadedOrgs.push({
                id: m.organization.id,
                name: m.organization.name,
                slug: m.organization.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                quotaLimit: m.organization.quota_allowed || 100,
                quotaUsed: m.organization.quota_used || 0,
                createdAt: m.organization.created_at || new Date().toISOString(),
              });
            }

            loadedMembers.push({
              id: m.id,
              organizationId: m.org_id,
              userId: m.user_id,
              role: m.role as OrgRole,
              user: currentUser,
              createdAt: new Date().toISOString(),
            });
          }

          setOrganizations(loadedOrgs);
          setMembers(loadedMembers);
          if (loadedOrgs.length > 0 && !currentOrgId) {
            setCurrentOrgId(loadedOrgs[0].id);
          }
        } else {
          setOrganizations([]);
          setMembers([]);
        }
      } catch (err) {
        console.error("Error fetching user org_members:", err);
      }
    }

    fetchUserOrgMembers();
  }, [currentUser.id]);

  const userMemberships =
    currentUser.id && currentUser.id !== "unauthenticated"
      ? members.filter((m) => m.userId === currentUser.id)
      : [];

  const hasOrganization = !pendingOnboarding && userMemberships.length > 0;

  const currentOrganization =
    organizations.find((o) => o.id === currentOrgId) ||
    (organizations.length > 0 ? organizations[0] : fallbackOrg);

  const currentMember = members.find(
    (m) => m.organizationId === currentOrganization.id && m.userId === currentUser.id
  );

  const currentRole: OrgRole = currentMember ? currentMember.role : "owner";

  const switchOrganization = (orgId: string) => {
    setCurrentOrgId(orgId);
  };

  const switchUserRole = (userId: string, newRole: OrgRole) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.organizationId === currentOrgId && m.userId === userId ? { ...m, role: newRole } : m
      )
    );
  };

  const startOnboardingForNewUser = (user: Partial<User>) => {
    const userId = user.id || currentUser.id || `user-${Date.now()}`;
    const newUser: User = {
      id: userId,
      email: user.email || "",
      displayName: user.displayName || user.email?.split("@")[0] || "User",
      avatarUrl: fallbackUser.avatarUrl,
    };
    setCurrentUser(newUser);
    setPendingOnboarding(true);
  };

  const completeOnboarding = (orgName: string, customOrgId?: string) => {
    // GUARD: customOrgId MUST be a valid PostgreSQL UUID.
    // If it looks like a fake fallback (e.g. "org-1234567890") refuse it and log an error.
    const isValidUuid = customOrgId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customOrgId);

    if (!isValidUuid) {
      console.error(
        "[OrganizationContext] completeOnboarding called without a valid UUID org_id.",
        "Got:", customOrgId,
        "The backend create-organization function must return a real PostgreSQL UUID."
      );
      // Do NOT proceed with a fake org ID — it will break all Hasura operations.
      return;
    }

    const newOrg: Organization = {
      id: customOrgId,
      name: orgName,
      slug: orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      quotaLimit: 100,
      quotaUsed: 0,
      createdAt: new Date().toISOString(),
    };

    const newMember: OrgMember = {
      id: `member-${customOrgId}`,
      organizationId: customOrgId,
      userId: currentUser.id,
      role: "owner",
      user: currentUser,
      createdAt: new Date().toISOString(),
    };

    setOrganizations((prev) => [newOrg, ...prev]);
    setMembers((prev) => [newMember, ...prev]);
    setCurrentOrgId(customOrgId);
    setPendingOnboarding(false);
  };

  return (
    <OrganizationContext.Provider
      value={{
        currentUser,
        currentOrganization,
        currentRole,
        organizations,
        members: members.filter((m) => m.organizationId === currentOrganization.id),
        hasOrganization,
        pendingOnboarding,
        switchOrganization,
        switchUserRole,
        startOnboardingForNewUser,
        completeOnboarding,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => useContext(OrganizationContext);
