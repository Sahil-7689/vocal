"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useOrganization } from "@/context/OrganizationContext";
import { logoutUser } from "@/lib/auth";
import {
  LayoutDashboard,
  GitFork,
  BarChart3,
  Settings,
  Zap,
  ChevronDown,
  Building2,
  LogOut,
} from "lucide-react";

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const {
    currentUser,
    currentOrganization,
    currentRole,
    organizations,
    switchOrganization,
  } = useOrganization();

  const [showOrgDropdown, setShowOrgDropdown] = useState(false);

  const handleLogout = async () => {
    await logoutUser();
    router.replace("/login");
  };

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Workflows", href: "/workflows", icon: GitFork },
    { label: "Usage", href: "/usage", icon: BarChart3 },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="w-60 h-screen fixed left-0 top-0 bg-surface-container-lowest/90 backdrop-blur-xl border-r border-outline-variant/50 flex flex-col p-4 z-20 transition-all duration-300">
      {/* Brand & Organization Selector */}
      <div className="mb-6 px-1">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0 shadow-sm">
            <Zap className="w-5 h-5 text-on-primary fill-current" />
          </div>
          <div>
            <h1 className="font-display font-bold text-sm tracking-tight text-on-surface">VocalFlow</h1>
            <p className="font-mono text-[10px] text-on-surface-variant">Workflow Automation</p>
          </div>
        </div>

        {/* Organization Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowOrgDropdown(!showOrgDropdown)}
            className="w-full flex items-center justify-between p-2 rounded-lg bg-surface-container-low/80 hover:bg-surface-container border border-outline-variant/60 text-left transition-all"
          >
            <div className="flex items-center gap-2 truncate">
              <Building2 className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-semibold text-on-surface truncate">
                {currentOrganization ? currentOrganization.name : "Select Organization"}
              </span>
            </div>
            {organizations.length > 1 && (
              <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
            )}
          </button>

          {showOrgDropdown && organizations.length > 1 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-xl py-1 z-30 animate-fade-up">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => {
                    switchOrganization(org.id);
                    setShowOrgDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-surface-container-low transition-colors ${
                    currentOrganization?.id === org.id ? "text-primary font-semibold" : "text-on-surface"
                  }`}
                >
                  <span className="truncate">{org.name}</span>
                  {currentOrganization?.id === org.id && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Navigation Menu */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg font-mono text-xs font-medium transition-all ${
                isActive
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/60"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Role Tag & User Profile */}
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
            onClick={handleLogout}
            className="p-1.5 rounded hover:bg-error-container/30 text-on-surface-variant hover:text-error transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* User Footer Profile */}
        {currentUser && (
          <div className="flex items-center gap-3 px-2 py-1.5">
            <img
              src={currentUser?.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"}
              alt={currentUser?.displayName || "User"}
              className="w-8 h-8 rounded-full object-cover border border-outline-variant shrink-0"
            />
            <div className="flex-1 truncate">
              <div className="text-xs font-medium text-on-surface truncate">
                {currentUser?.displayName || currentUser?.email || "User"}
              </div>
              <div className="font-mono text-[10px] text-on-surface-variant truncate">
                {currentUser?.email || ""}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
