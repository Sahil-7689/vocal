-- VocalFlow Seeds: demo.sql

-- Clear existing seed data if needed
TRUNCATE TABLE public.organizations CASCADE;

-- Insert Organization A and Organization B
INSERT INTO public.organizations (id, name, quota_allowed, quota_used) VALUES
('a0000000-0000-0000-0000-000000000001', 'Acme AI (Org A)', 100, 84),
('b0000000-0000-0000-0000-000000000002', 'Beta AI (Org B)', 50, 12);

-- Insert Org Memberships
INSERT INTO public.org_members (id, org_id, user_id, role) VALUES
('m0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'owner'),
('m0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
('m0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'viewer'),
('m0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'owner');

-- Insert Org A Demo Workflow
INSERT INTO public.workflows (id, org_id, name, description, status, created_by) VALUES
('w0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Customer Support Agent Workflow', 'Processes customer tickets via LLM, REST API calls, conditional checks, owner review gate, and DB audit logging.', 'active', '11111111-1111-1111-1111-111111111111');

-- Insert Steps for Customer Support Workflow
INSERT INTO public.workflow_steps (id, workflow_id, position, name, type, config) VALUES
(
    's0000000-0000-0000-0000-000000000001',
    'w0000000-0000-0000-0000-000000000001',
    1,
    'LLM Call (Groq Llama 3.3)',
    'llm_call',
    '{"provider": "groq", "model": "llama-3.3-70b-versatile", "system_prompt": "Analyze customer support ticket.", "prompt": "User Inquiry: {{input.text}}", "temperature": 0.7}'::jsonb
),
(
    's0000000-0000-0000-0000-000000000002',
    'w0000000-0000-0000-0000-000000000001',
    2,
    'HTTP Request (Zendesk API)',
    'http_request',
    '{"method": "GET", "url": "https://httpbin.org/get", "headers": {"Accept": "application/json"}}'::jsonb
),
(
    's0000000-0000-0000-0000-000000000003',
    'w0000000-0000-0000-0000-000000000001',
    3,
    'Conditional Branch (Urgent Check)',
    'conditional_branch',
    '{"path": "status", "operator": "equals", "value": "200"}'::jsonb
),
(
    's0000000-0000-0000-0000-000000000004',
    'w0000000-0000-0000-0000-000000000001',
    4,
    'Approval Gate (Owner Review)',
    'approval_gate',
    '{"description": "Owner authorization required for audit commit.", "required_role": "owner"}'::jsonb
),
(
    's0000000-0000-0000-0000-000000000005',
    'w0000000-0000-0000-0000-000000000001',
    5,
    'DB Write (Audit Log Commit)',
    'db_write',
    '{"key": "ticket_audit", "value": {"action": "approved", "processed_by": "VocalFlow Engine"}}'::jsonb
);

-- Insert Triggers
INSERT INTO public.workflow_triggers (id, workflow_id, type, config, enabled) VALUES
('t0000000-0000-0000-0000-000000000001', 'w0000000-0000-0000-0000-000000000001', 'manual', '{}'::jsonb, true),
('t0000000-0000-0000-0000-000000000002', 'w0000000-0000-0000-0000-000000000001', 'webhook', '{"secret": "whsec_live_acme_991823"}'::jsonb, true);
