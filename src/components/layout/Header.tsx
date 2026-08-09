"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@/context/OrganizationContext";
import { logoutUser } from "@/lib/auth";
import { Bell, Search, LogOut } from "lucide-react";
import { toast } from "sonner";

interface HeaderProps {
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  const router = useRouter();
  const { currentUser, currentOrganization, currentRole } = useOrganization();

  const handleLogout = async () => {
    try {
      if (typeof window !== "undefined") sessionStorage.removeItem("vocalflow_authenticated");
      await logoutUser();
      toast.success("Logged out successfully");
      router.push("/login");
    } catch (err: any) {
      if (typeof window !== "undefined") sessionStorage.removeItem("vocalflow_authenticated");
      toast.success("Logged out successfully");
      router.push("/login");
    }
  };

  return (
    <header className="h-14 fixed top-0 right-0 left-60 z-10 bg-surface-container-lowest/80 backdrop-blur-xl border-b border-outline-variant/50 flex justify-between items-center px-6">
      <div className="flex items-center gap-3">
        {title && <h2 className="font-display font-bold text-base text-on-surface">{title}</h2>}
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="hidden sm:flex items-center bg-surface-container-low/70 rounded-full px-3 py-1 border border-outline-variant/40 focus-within:border-primary transition-colors">
          <Search className="w-3.5 h-3.5 text-on-surface-variant mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search workflows, runs..."
            className="bg-transparent border-none focus:ring-0 p-0 text-xs w-48 text-on-surface placeholder:text-outline outline-none"
          />
        </div>

        {/* Notifications */}
        <button
          onClick={() => toast.info("No unread notifications.")}
          className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-all rounded-full"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* User Profile & Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-outline-variant/40">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant shrink-0">
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.displayName}
              className="w-full h-full object-cover"
            />
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/20 transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
