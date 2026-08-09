"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Organization, OrgMember, OrgRole, User } from "@/types";
import { MOCK_ORGANIZATIONS, MOCK_MEMBERS, MOCK_USERS } from "@/lib/mockBackend";
import { getCurrentUser } from "@/lib/auth";

interface OrganizationContextType {
  currentUser: User;
  currentOrganization: Organization;
  currentRole: OrgRole;
  organizations: Organization[];
  members: OrgMember[];
  hasOrganization: boolean;
  switchOrganization: (orgId: string) => void;
  switchUserRole: (userId: string, role: OrgRole) => void;
  switchPresetUser: (userPresetId: string) => void;
  startOnboardingForNewUser: (user: Partial<User>) => void;
  completeOnboarding: (orgName: string, orgId?: string) => void;
}

const defaultUser = MOCK_USERS[0];
const defaultOrg = MOCK_ORGANIZATIONS[0];

const OrganizationContext = createContext<OrganizationContextType>({
  currentUser: defaultUser,
  currentOrganization: defaultOrg,
  currentRole: "owner",
  organizations: MOCK_ORGANIZATIONS,
  members: MOCK_MEMBERS,
  hasOrganization: true,
  switchOrganization: () => {},
  switchUserRole: () => {},
  switchPresetUser: () => {},
  startOnboardingForNewUser: () => {},
  completeOnboarding: () => {},
});

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(defaultUser);
  const [currentOrgId, setCurrentOrgId] = useState<string>("org-acme-a");
  const [organizations, setOrganizations] = useState<Organization[]>(MOCK_ORGANIZATIONS);
  const [members, setMembers] = useState<OrgMember[]>(MOCK_MEMBERS);
  const [hasOrganization, setHasOrganization] = useState<boolean>(true);

  // Sync with Nhost auth if logged in
  useEffect(() => {
    const nhostUser = getCurrentUser();
    if (nhostUser) {
      setCurrentUser({
        id: nhostUser.id,
        email: nhostUser.email || "user@vocalflow.ai",
        displayName: nhostUser.displayName || nhostUser.email || "User",
        avatarUrl: nhostUser.avatarUrl || defaultUser.avatarUrl,
      });
    }
  }, []);

  const currentOrganization = organizations.find((o) => o.id === currentOrgId) || defaultOrg;

  const currentMember = members.find(
    (m) => m.organizationId === currentOrgId && m.userId === currentUser.id
  );

  const currentRole: OrgRole = currentMember ? currentMember.role : "owner";

  const switchOrganization = (orgId: string) => {
    setCurrentOrgId(orgId);
    setHasOrganization(true);
  };

  const switchUserRole = (userId: string, newRole: OrgRole) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.organizationId === currentOrgId && m.userId === userId
          ? { ...m, role: newRole }
          : m
      )
    );
  };

  const switchPresetUser = (presetId: string) => {
    const targetUser = MOCK_USERS.find((u) => u.id === presetId) || defaultUser;
    setCurrentUser(targetUser);
    setHasOrganization(true);

    if (presetId === "user-orgb-1") {
      setCurrentOrgId("org-cyberdyne-b");
    } else {
      setCurrentOrgId("org-acme-a");
    }
  };

  const startOnboardingForNewUser = (user: Partial<User>) => {
    const newUser: User = {
      id: user.id || `user-new-${Date.now()}`,
      email: user.email || "newuser@vocalflow.ai",
      displayName: user.displayName || user.email?.split("@")[0] || "New User",
      avatarUrl: defaultUser.avatarUrl,
    };
    setCurrentUser(newUser);
    setHasOrganization(false);
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
    setHasOrganization(true);
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
        switchOrganization,
        switchUserRole,
        switchPresetUser,
        startOnboardingForNewUser,
        completeOnboarding,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => useContext(OrganizationContext);
