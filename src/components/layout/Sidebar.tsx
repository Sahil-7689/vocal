"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOrganization } from "@/context/OrganizationContext";
import {
  LayoutDashboard,
  GitFork,
  Play,
  BarChart3,
  Settings,
  Zap,
  ChevronDown,
  UserCheck,
  Building2,
  LogOut,
} from "lucide-react";

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const {
    currentUser,
    currentOrganization,
    currentRole,
    organizations,
    switchOrganization,
    switchPresetUser,
  } = useOrganization();

  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [showUserPresetModal, setShowUserPresetModal] = useState(false);

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Workflows", href: "/workflows", icon: GitFork },
    { label: "Usage", href: "/usage", icon: BarChart3 },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <>
      <aside className="w-60 h-screen fixed left-0 top-0 bg-surface-container-lowest/90 backdrop-blur-xl border-r border-outline-variant/50 flex flex-col p-4 z-20 transition-all duration-300">
        {/* Brand & Organization Selector */}
        <div className="mb-6 px-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0 shadow-sm">
              <Zap className="w-5 h-5 text-on-primary fill-current" />
            </div>
            <div>
              <h1 className="font-display font-semibold text-lg text-primary leading-none">
                VocalFlow
              </h1>
              <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
                AI Automation
              </p>
            </div>
          </div>

          {/* Org Selector Pill */}
          <div className="relative">
            <button
              onClick={() => setShowOrgDropdown(!showOrgDropdown)}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-surface-container-low/70 hover:bg-surface-container-low border border-outline-variant/40 text-xs font-medium text-on-surface transition-all"
            >
              <div className="flex items-center gap-2 truncate">
                <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">{currentOrganization.name}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
            </button>

            {showOrgDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-lg py-1 z-30 animate-fade-up">
                <div className="px-3 py-1 font-mono text-[10px] uppercase text-outline">
                  Switch Organization
                </div>
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => {
                      switchOrganization(org.id);
                      setShowOrgDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-surface-container-low transition-colors ${
                      org.id === currentOrganization.id ? "font-bold text-primary" : "text-on-surface"
                    }`}
                  >
                    <span className="truncate">{org.name}</span>
                    {org.id === currentOrganization.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "text-primary font-semibold bg-secondary-container/80 shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-low/80 hover:text-on-surface"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-on-surface-variant"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Preset Switcher Badge & Role Tag */}
        <div className="mt-auto pt-4 border-t border-outline-variant/40 space-y-2">
          <div className="px-2 py-1.5 rounded-lg bg-surface-container-low/60 border border-outline-variant/30 flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] text-on-surface-variant uppercase">Current Role</div>
              <div className="text-xs font-semibold capitalize text-primary flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${currentRole === "owner" ? "bg-emerald-500" : currentRole === "editor" ? "bg-amber-500" : "bg-blue-500"}`} />
                {currentRole}
              </div>
            </div>
            <button
              onClick={() => setShowUserPresetModal(true)}
              className="px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary font-mono text-[10px] transition-colors"
              title="Quick demo user switcher"
            >
              Switch Role
            </button>
          </div>

          {/* User Footer Profile */}
          <div className="flex items-center gap-3 px-2 py-1.5">
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.displayName}
              className="w-8 h-8 rounded-full object-cover border border-outline-variant shrink-0"
            />
            <div className="flex-1 truncate">
              <div className="text-xs font-medium text-on-surface truncate">
                {currentUser.displayName}
              </div>
              <div className="font-mono text-[10px] text-on-surface-variant truncate">
                {currentUser.email}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Preset Switcher Modal for Demo Verification */}
      {showUserPresetModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-up">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-primary" />
                <h3 className="font-display font-bold text-base text-on-surface">Demo Persona Switcher</h3>
              </div>
              <button
                onClick={() => setShowUserPresetModal(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-on-surface-variant">
              Quickly test roles across Org A and Org B as required by the VocalFlow prompt demonstration:
            </p>

            <div className="space-y-2">
              <button
                onClick={() => {
                  switchPresetUser("user-owner-1");
                  setShowUserPresetModal(false);
                }}
                className="w-full p-3 rounded-lg border border-outline-variant/60 hover:border-primary bg-surface/50 text-left transition-all"
              >
                <div className="text-xs font-semibold text-on-surface">Org A — Owner (Sahil Kumar)</div>
                <div className="text-[11px] text-on-surface-variant">Full access: Create, Edit, Delete, Run, Approve steps, Manage Members, Restricted steps.</div>
              </button>

              <button
                onClick={() => {
                  switchPresetUser("user-editor-1");
                  setShowUserPresetModal(false);
                }}
                className="w-full p-3 rounded-lg border border-outline-variant/60 hover:border-primary bg-surface/50 text-left transition-all"
              >
                <div className="text-xs font-semibold text-on-surface">Org A — Editor (Alex Rivera)</div>
                <div className="text-[11px] text-on-surface-variant">Can create & edit workflows, trigger runs. Cannot manage members or add owner-only steps.</div>
              </button>

              <button
                onClick={() => {
                  switchPresetUser("user-viewer-1");
                  setShowUserPresetModal(false);
                }}
                className="w-full p-3 rounded-lg border border-outline-variant/60 hover:border-primary bg-surface/50 text-left transition-all"
              >
                <div className="text-xs font-semibold text-on-surface">Org A — Viewer (Jordan Lee)</div>
                <div className="text-[11px] text-on-surface-variant">Read-only mode. Cannot create, edit, delete, run, or approve workflow steps.</div>
              </button>

              <button
                onClick={() => {
                  switchPresetUser("user-orgb-1");
                  setShowUserPresetModal(false);
                }}
                className="w-full p-3 rounded-lg border border-outline-variant/60 hover:border-primary bg-surface/50 text-left transition-all"
              >
                <div className="text-xs font-semibold text-on-surface">Org B — Cyberdyne User (Miles Dyson)</div>
                <div className="text-[11px] text-on-surface-variant">Belongs to Cyberdyne Systems. Opening Org A workflows triggers "Workflow unavailable".</div>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowUserPresetModal(false)}
                className="px-4 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-xs font-medium text-on-surface"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
