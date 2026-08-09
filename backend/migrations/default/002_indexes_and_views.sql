-- VocalFlow Migration 002_indexes_and_views.sql

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.org_members(user_id);

CREATE INDEX IF NOT EXISTS idx_workflows_org_id ON public.workflows(org_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id ON public.workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_workflow_id ON public.workflow_triggers(workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON public.workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON public.workflow_runs(status);

CREATE INDEX IF NOT EXISTS idx_step_runs_workflow_run_id ON public.step_runs(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_step_runs_workflow_step_id ON public.step_runs(workflow_step_id);

CREATE INDEX IF NOT EXISTS idx_workflow_results_org_id ON public.workflow_results(org_id);

-- PostgreSQL View: organization_monthly_usage
CREATE OR REPLACE VIEW public.organization_monthly_usage AS
SELECT
    id AS org_id,
    name AS org_name,
    quota_allowed,
    quota_used,
    GREATEST(0, quota_allowed - quota_used) AS remaining,
    ROUND(
        (quota_used::NUMERIC / NULLIF(quota_allowed, 0)) * 100,
        2
    ) AS usage_percentage,
    quota_period_start
FROM public.organizations;
