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
  switchOrganization: (orgId: string) => void;
  switchUserRole: (userId: string, role: OrgRole) => void;
  switchPresetUser: (userPresetId: string) => void;
}

const defaultUser = MOCK_USERS[0];
const defaultOrg = MOCK_ORGANIZATIONS[0];
const defaultRole: OrgRole = "owner";

const OrganizationContext = createContext<OrganizationContextType>({
  currentUser: defaultUser,
  currentOrganization: defaultOrg,
  currentRole: defaultRole,
  organizations: MOCK_ORGANIZATIONS,
  members: MOCK_MEMBERS,
  switchOrganization: () => {},
  switchUserRole: () => {},
  switchPresetUser: () => {},
});

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(defaultUser);
  const [currentOrgId, setCurrentOrgId] = useState<string>("org-acme-a");
  const [members, setMembers] = useState<OrgMember[]>(MOCK_MEMBERS);

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

  const currentOrganization = MOCK_ORGANIZATIONS.find((o) => o.id === currentOrgId) || defaultOrg;

  const currentMember = members.find(
    (m) => m.organizationId === currentOrgId && m.userId === currentUser.id
  );

  const currentRole: OrgRole = currentMember ? currentMember.role : "viewer";

  const switchOrganization = (orgId: string) => {
    setCurrentOrgId(orgId);
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

    if (presetId === "user-orgb-1") {
      setCurrentOrgId("org-cyberdyne-b");
    } else {
      setCurrentOrgId("org-acme-a");
    }
  };

  return (
    <OrganizationContext.Provider
      value={{
        currentUser,
        currentOrganization,
        currentRole,
        organizations: MOCK_ORGANIZATIONS,
        members: members.filter((m) => m.organizationId === currentOrgId),
        switchOrganization,
        switchUserRole,
        switchPresetUser,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => useContext(OrganizationContext);
