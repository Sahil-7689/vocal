"use client";

import React, { useState } from "react";
import { useOrganization } from "@/context/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ShaderBackground } from "@/components/layout/ShaderBackground";
import { OrgRole } from "@/types";
import { Users, UserPlus, Shield, Lock, Trash2, Mail, Check } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { currentOrganization, members, switchUserRole } = useOrganization();
  const { canManageMembers, isOwner } = usePermissions();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("editor");

  const handleRoleChange = (userId: string, newRole: OrgRole) => {
    if (!canManageMembers()) {
      toast.error("Unauthorized: Only organization owners can change member roles.");
      return;
    }

    switchUserRole(userId, newRole);
    toast.success("Updated member role.");
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    toast.success(`Invitation sent to ${inviteEmail} as ${inviteRole}.`);
    setInviteEmail("");
    setShowInviteModal(false);
  };

  return (
    <div className="min-h-screen flex bg-background text-on-surface relative">
      <ShaderBackground />
      <Sidebar />

      <div className="flex-1 ml-60 flex flex-col min-h-screen relative z-10">
        <Header title="Organization Settings" />

        <main className="flex-1 pt-20 pb-10 px-8 max-w-container-max mx-auto w-full space-y-6 animate-fade-up">
          {/* Header & Invite Action */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display font-bold text-2xl text-on-surface">
                Organization &amp; Members
              </h1>
              <p className="text-xs text-on-surface-variant mt-1">
                Manage access permissions and team members for <strong className="text-primary">{currentOrganization.name}</strong>.
              </p>
            </div>

            {canManageMembers() ? (
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-mono text-xs font-semibold flex items-center gap-2 shadow-md transition-all shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                Invite Member
              </button>
            ) : (
              <div className="p-2 rounded bg-surface-container-low border border-outline-variant/40 font-mono text-[10px] text-on-surface-variant flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-blue-600" />
                <span>Read-only: Member management restricted to Owner.</span>
              </div>
            )}
          </div>

          {/* Members Table */}
          <div className="bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/60 rounded-xl overflow-hidden shadow-sm space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
              <h3 className="font-display font-bold text-base text-on-surface flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Active Team Members
              </h3>
              <span className="font-mono text-xs text-on-surface-variant">
                {members.length} Total Members
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container-low/70 border-b border-outline-variant/40 font-mono text-[11px] text-on-surface-variant uppercase">
                  <tr>
                    <th className="p-3">User</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Role</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={member.user.avatarUrl}
                            alt={member.user.displayName}
                            className="w-8 h-8 rounded-full object-cover border border-outline-variant shrink-0"
                          />
                          <span className="font-display font-semibold text-sm text-on-surface">
                            {member.user.displayName}
                          </span>
                        </div>
                      </td>

                      <td className="p-3 font-mono text-on-surface-variant">
                        {member.user.email}
                      </td>

                      <td className="p-3">
                        {canManageMembers() ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.userId, e.target.value as OrgRole)}
                            className="h-7 px-2 rounded bg-surface-container-low border border-outline-variant/60 font-mono text-xs font-semibold text-primary outline-none"
                          >
                            <option value="owner">Owner</option>
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span className="font-mono text-xs font-semibold capitalize text-primary bg-primary/10 px-2 py-0.5 rounded">
                            {member.role}
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right">
                        {canManageMembers() && member.role !== "owner" ? (
                          <button
                            onClick={() => toast.success(`Removed member ${member.user.displayName}`)}
                            className="p-1.5 rounded hover:bg-error-container/20 text-on-surface-variant hover:text-error transition-colors"
                            title="Remove Member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="font-mono text-[10px] text-on-surface-variant">Active</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-up">
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
              <h3 className="font-display font-bold text-base text-on-surface flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" /> Invite Team Member
              </h3>
              <button onClick={() => setShowInviteModal(false)} className="text-on-surface-variant">✕</button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-mono text-[11px] text-on-surface-variant">Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full h-9 px-3 rounded-lg bg-surface-container-low border border-outline-variant/60 font-mono text-xs focus:border-primary outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-mono text-[11px] text-on-surface-variant">Assign Organization Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                  className="w-full h-9 px-3 rounded-lg bg-surface-container-low border border-outline-variant/60 font-mono text-xs font-semibold text-primary outline-none"
                >
                  <option value="editor">Editor — Can build & run workflows</option>
                  <option value="viewer">Viewer — Read-only access</option>
                  <option value="owner">Owner — Full administrative access</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-lg border border-outline-variant/60 text-xs font-medium text-on-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-primary text-on-primary font-mono text-xs font-semibold hover:bg-primary-container transition-all"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
