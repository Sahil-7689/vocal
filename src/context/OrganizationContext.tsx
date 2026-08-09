"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Organization, OrgMember, OrgRole, User } from "@/types";
import { getCurrentUser } from "@/lib/auth";

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
  quotaLimit: 10000,
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
  const [currentUser, setCurrentUser] = useState<User>(() => {
    if (typeof window !== "undefined") {
      const nhostUser = getCurrentUser();
      if (nhostUser) {
        return {
          id: nhostUser.id,
          email: nhostUser.email || "",
          displayName: nhostUser.displayName || nhostUser.email || "User",
          avatarUrl: nhostUser.avatarUrl || fallbackUser.avatarUrl,
        };
      }
    }
    return fallbackUser;
  });

  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  // pendingOnboarding is set to true right after signup, cleared after completeOnboarding
  const [pendingOnboarding, setPendingOnboarding] = useState(false);

  // Sync with Nhost auth if logged in
  useEffect(() => {
    const nhostUser = getCurrentUser();
    if (nhostUser) {
      setCurrentUser({
        id: nhostUser.id,
        email: nhostUser.email || "",
        displayName: nhostUser.displayName || nhostUser.email || "User",
        avatarUrl: nhostUser.avatarUrl || fallbackUser.avatarUrl,
      });
    } else {
      setCurrentUser(fallbackUser);
    }
  }, []);

  const userMemberships =
    currentUser.id && currentUser.id !== "unauthenticated"
      ? members.filter((m) => m.userId === currentUser.id)
      : [];

  // A user has an org only if they have a real membership AND are not in the middle of onboarding
  const hasOrganization = !pendingOnboarding && userMemberships.length > 0;

  const currentOrganization =
    organizations.find((o) => o.id === currentOrgId) ||
    (organizations.length > 0 ? organizations[0] : fallbackOrg);

  const currentMember = members.find(
    (m) => m.organizationId === currentOrgId && m.userId === currentUser.id
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
    const userId = user.id || `user-new-${Date.now()}`;
    const newUser: User = {
      id: userId,
      email: user.email || "",
      displayName: user.displayName || user.email?.split("@")[0] || "New User",
      avatarUrl: fallbackUser.avatarUrl,
    };
    setCurrentUser(newUser);
    // Signal that this user is brand-new and must complete onboarding first
    setPendingOnboarding(true);
  };

  const completeOnboarding = (orgName: string, customOrgId?: string) => {
    const newOrgId = customOrgId || `org-${Date.now()}`;
    const newOrg: Organization = {
      id: newOrgId,
      name: orgName,
      slug: orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      quotaLimit: 10000,
      quotaUsed: 0,
      createdAt: new Date().toISOString(),
    };

    const newMember: OrgMember = {
      id: `member-${Date.now()}`,
      organizationId: newOrgId,
      userId: currentUser.id,
      role: "owner",
      user: currentUser,
      createdAt: new Date().toISOString(),
    };

    setOrganizations((prev) => [newOrg, ...prev]);
    setMembers((prev) => [newMember, ...prev]);
    setCurrentOrgId(newOrgId);
    // Onboarding complete — clear the pending flag
    setPendingOnboarding(false);
  };

  return (
    <OrganizationContext.Provider
      value={{
        currentUser,
        currentOrganization,
        currentRole,
        organizations,
        members: members.filter((m) => m.organizationId === currentOrgId),
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
