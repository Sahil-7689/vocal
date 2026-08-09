"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "@apollo/client";
import { GET_WORKFLOWS } from "@/graphql/queries/workflows";
import { DELETE_WORKFLOW } from "@/graphql/mutations/workflows";
import { useOrganization } from "@/context/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ShaderBackground } from "@/components/layout/ShaderBackground";
import { RunWorkflowModal } from "@/components/workflow/RunWorkflowModal";
import { Workflow } from "@/types";
import {
  Search,
  Plus,
  GitFork,
  Play,
  Trash2,
  Lock,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

export default function WorkflowsPage() {
  const { currentOrganization } = useOrganization();
  const { canCreateWorkflow, canEditWorkflow, canDeleteWorkflow, canRunWorkflow, isViewer } =
    usePermissions();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRunWorkflow, setSelectedRunWorkflow] = useState<{ id: string; name: string } | null>(null);

  const { data, loading, refetch } = useQuery(GET_WORKFLOWS, {
    variables: { orgId: currentOrganization.id },
  });

  const [deleteWorkflow] = useMutation(DELETE_WORKFLOW);

  const workflows: Workflow[] = data?.workflows || [];

  const filteredWorkflows = workflows.filter((w) =>
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (w.description && w.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleDelete = async (id: string, name: string) => {
    if (!canDeleteWorkflow()) {
      toast.error("Unauthorized", { description: "Only organization owners can delete workflows." });
      return;
    }

    if (confirm(`Are you sure you want to delete workflow "${name}"?`)) {
      try {
        await deleteWorkflow({ variables: { id } });
        toast.success(`Deleted workflow "${name}".`);
        refetch();
      } catch (err: any) {
        toast.error("Failed to delete workflow", { description: err.message });
      }
    }
  };

  return (
    <div className="min-h-screen flex bg-background text-on-surface relative">
      <ShaderBackground />
      <Sidebar />

      <div className="flex-1 ml-60 flex flex-col min-h-screen relative z-10">
        <Header title="Workflows" />

        <main className="flex-1 pt-20 pb-10 px-8 max-w-container-max mx-auto w-full space-y-6 animate-fade-up">
          {/* Header & Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-display font-bold text-2xl text-on-surface">
                Organization Workflows
              </h1>
              <p className="text-xs text-on-surface-variant mt-1">
                Manage and automate multi-step AI pipelines for <strong className="text-primary">{currentOrganization.name}</strong>.
              </p>
            </div>

            {canCreateWorkflow() ? (
              <Link
                href="/workflows/new"
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-mono text-xs font-semibold flex items-center gap-2 shadow-md transition-all shrink-0"
              >
                <Plus className="w-4 h-4" />
                New Workflow
              </Link>
            ) : (
              <div className="p-2 rounded bg-surface-container-low border border-outline-variant/40 font-mono text-[10px] text-on-surface-variant flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-blue-600" />
                <span>Viewer mode: Workflow creation disabled.</span>
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div className="bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/60 rounded-xl p-4 flex items-center justify-between gap-4 shadow-sm">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search workflows by name or description..."
                className="w-full h-9 pl-9 pr-4 rounded-lg bg-surface-container-low border border-outline-variant/60 text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
            </div>
            <span className="font-mono text-xs text-on-surface-variant shrink-0">
              Showing {filteredWorkflows.length} workflows
            </span>
          </div>

          {/* Workflows Table */}
          <div className="bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/60 rounded-xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-12 text-center text-xs font-mono text-on-surface-variant animate-pulse">
                Loading workflows...
              </div>
            ) : filteredWorkflows.length === 0 ? (
              <div className="p-12 text-center text-xs text-on-surface-variant space-y-3">
                <GitFork className="w-8 h-8 text-outline mx-auto" />
                <div>No workflows matching your criteria.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container-low/70 border-b border-outline-variant/40 font-mono text-[11px] text-on-surface-variant uppercase">
                    <tr>
                      <th className="p-4">Workflow</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Steps</th>
                      <th className="p-4">Triggers</th>
                      <th className="p-4">Last Updated</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {filteredWorkflows.map((wf) => (
                      <tr key={wf.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="p-4">
                          <Link
                            href={`/workflows/${wf.id}`}
                            className="font-display font-semibold text-sm text-on-surface hover:text-primary transition-colors block"
                          >
                            {wf.name}
                          </Link>
                          <span className="text-[11px] text-on-surface-variant line-clamp-1">
                            {wf.description || "No description."}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="font-mono text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-700 px-2 py-0.5 rounded">
                            {wf.status}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-medium text-on-surface">
                          {wf.steps?.length || 0} Steps
                        </td>
                        <td className="p-4">
                          <div className="flex gap-1 flex-wrap">
                            {wf.triggers?.map((t) => (
                              <span
                                key={t.id}
                                className="font-mono text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded capitalize"
                              >
                                {t.type}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 font-mono text-on-surface-variant">
                          {new Date(wf.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/workflows/${wf.id}`}
                              className="px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-xs font-mono font-medium text-on-surface flex items-center gap-1 transition-colors"
                              title="Open Builder"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Open
                            </Link>

                            {canRunWorkflow() && (
                              <button
                                onClick={() => setSelectedRunWorkflow({ id: wf.id, name: wf.name })}
                                className="px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-mono font-semibold flex items-center gap-1 transition-colors shadow-sm"
                                title="Run Workflow"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                Run
                              </button>
                            )}

                            {canDeleteWorkflow() && (
                              <button
                                onClick={() => handleDelete(wf.id, wf.name)}
                                className="p-1.5 rounded-lg hover:bg-error-container/20 text-on-surface-variant hover:text-error transition-colors"
                                title="Delete Workflow"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Run Confirmation Modal */}
      {selectedRunWorkflow && (
        <RunWorkflowModal
          workflowId={selectedRunWorkflow.id}
          workflowName={selectedRunWorkflow.name}
          isOpen={Boolean(selectedRunWorkflow)}
          onClose={() => setSelectedRunWorkflow(null)}
        />
      )}
    </div>
  );
}
