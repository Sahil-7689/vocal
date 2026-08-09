import { describe, it, expect } from "vitest";
import { executeStep, WorkflowStep } from "../functions/_shared/executor";
import { resolveTemplate } from "../functions/_shared/template";
import { checkSSRFProtection } from "../functions/_shared/ssrf";
import { handleLLMCall } from "../functions/_shared/handlers/llm";
import { handleHttpRequest } from "../functions/_shared/handlers/http";
import { handleConditionalBranch } from "../functions/_shared/handlers/conditional";

describe("Phase 3 — Modular Workflow Execution Engine Test Suite", () => {
  describe("Template Interpolation", () => {
    it("Interpolates context variables into template strings", () => {
      const context = {
        input: { text: "Urgent billing inquiry" },
        previousOutput: { status: 200, sentiment: "negative" },
      };

      const res1 = resolveTemplate("Prompt: {{input.text}}", context);
      expect(res1).toBe("Prompt: Urgent billing inquiry");

      const res2 = resolveTemplate("Status: {{previousOutput.status}}", context);
      expect(res2).toBe("Status: 200");
    });
  });

  describe("SSRF Protection", () => {
    it("Blocks internal loopback, metadata, and private IP addresses", () => {
      expect(() => checkSSRFProtection("http://localhost:8080/admin")).toThrow("SSRF Blocked");
      expect(() => checkSSRFProtection("http://127.0.0.1/status")).toThrow("SSRF Blocked");
      expect(() => checkSSRFProtection("http://169.254.169.254/latest/meta-data")).toThrow("SSRF Blocked");
      expect(() => checkSSRFProtection("http://10.0.0.1/internal")).toThrow("SSRF Blocked");
      expect(() => checkSSRFProtection("http://192.168.1.1/router")).toThrow("SSRF Blocked");
    });

    it("Allows valid public HTTP/HTTPS URLs", () => {
      expect(() => checkSSRFProtection("https://httpbin.org/get")).not.toThrow();
      expect(() => checkSSRFProtection("https://api.github.com/users")).not.toThrow();
    });
  });

  describe("Modular LLM Call Handler (handleLLMCall)", () => {
    it("Executes LLM call with prompt interpolation and returns structured result", async () => {
      const res = await handleLLMCall(
        { provider: "groq", model: "llama-3.3-70b-versatile", prompt: "{{input.text}}" },
        { input: { text: "Analyze ticket" } }
      );

      expect(res).toHaveProperty("text");
      expect(res).toHaveProperty("model");
      expect(res).toHaveProperty("attempts");
      expect(res.attempts).toBe(1);
    });
  });

  describe("Modular HTTP Request Handler (handleHttpRequest)", () => {
    it("Executes HTTP request to public endpoint and returns status code & payload", async () => {
      const res = await handleHttpRequest(
        { method: "GET", url: "https://httpbin.org/get" },
        {}
      );

      expect(res.status).toBe(200);
      expect(res).toHaveProperty("response");
      expect(res.attempts).toBe(1);
    });

    it("Immediately throws SSRF block without retrying internal URLs", async () => {
      await expect(
        handleHttpRequest({ url: "http://127.0.0.1:9000/internal" }, {})
      ).rejects.toThrow("SSRF Blocked");
    });
  });

  describe("Modular Conditional Branch Handler (handleConditionalBranch)", () => {
    it("Evaluates 'equals' operator correctly", async () => {
      const res1 = await handleConditionalBranch(
        { path: "status", operator: "equals", value: "200" },
        { status: 200 }
      );
      expect(res1.result).toBe(true);

      const res2 = await handleConditionalBranch(
        { path: "sentiment", operator: "equals", value: "positive" },
        { sentiment: "negative" }
      );
      expect(res2.result).toBe(false);
    });

    it("Evaluates 'contains' operator correctly", async () => {
      const res = await handleConditionalBranch(
        { path: "message", operator: "contains", value: "urgent" },
        { message: "This is an urgent request" }
      );
      expect(res.result).toBe(true);
    });

    it("Evaluates 'greater_than' and 'less_than' numeric operators", async () => {
      const resGt = await handleConditionalBranch(
        { path: "score", operator: "greater_than", value: 80 },
        { score: 95 }
      );
      expect(resGt.result).toBe(true);

      const resLt = await handleConditionalBranch(
        { path: "score", operator: "less_than", value: 50 },
        { score: 95 }
      );
      expect(resLt.result).toBe(false);
    });

    it("Evaluates 'is_not_null' and 'is_null' operators", async () => {
      const resNotNull = await handleConditionalBranch(
        { path: "data", operator: "is_not_null" },
        { data: "valid_payload" }
      );
      expect(resNotNull.result).toBe(true);

      const resNull = await handleConditionalBranch(
        { path: "data", operator: "is_null" },
        { data: null }
      );
      expect(resNull.result).toBe(true);
    });
  });

  describe("Modular Step Dispatcher (executeStep)", () => {
    it("Dispatches 'llm_call' step to LLM handler", async () => {
      const step: WorkflowStep = {
        id: "step-1",
        workflow_id: "wf-1",
        position: 1,
        name: "LLM Step",
        type: "llm_call",
        config: { prompt: "Hello AI" },
      };

      const result = await executeStep(step, { input: { text: "Hi" } });
      expect(result.status).toBe("completed");
      expect(result.output).toHaveProperty("text");
    });

    it("Dispatches 'http_request' step to HTTP handler", async () => {
      const step: WorkflowStep = {
        id: "step-2",
        workflow_id: "wf-1",
        position: 2,
        name: "HTTP Step",
        type: "http_request",
        config: { url: "https://httpbin.org/get" },
      };

      const result = await executeStep(step, {});
      expect(result.status).toBe("completed");
      expect(result.output.status).toBe(200);
    });

    it("Dispatches 'conditional_branch' step to Conditional handler", async () => {
      const step: WorkflowStep = {
        id: "step-3",
        workflow_id: "wf-1",
        position: 3,
        name: "Branch Step",
        type: "conditional_branch",
        config: { path: "status", operator: "equals", value: "200" },
      };

      const result = await executeStep(step, { previousOutput: { status: 200 } });
      expect(result.status).toBe("completed");
      expect(result.output.result).toBe(true);
    });

    it("Gracefully handles unsupported step types with clear error message", async () => {
      const step: WorkflowStep = {
        id: "step-bad",
        workflow_id: "wf-1",
        position: 99,
        name: "Unknown Step",
        type: "invalid_type",
        config: {},
      };

      const result = await executeStep(step, {});
      expect(result.status).toBe("failed");
      expect(result.error).toMatch(/Unsupported step type/);
    });

    it("Maintains extension points for Phase 4 step types (approval_gate, db_write, notify)", async () => {
      const gateStep: WorkflowStep = {
        id: "step-gate",
        workflow_id: "wf-1",
        position: 4,
        name: "Approval Gate",
        type: "approval_gate",
        config: { required_role: "owner" },
      };

      const gateRes = await executeStep(gateStep, {});
      expect(gateRes.status).toBe("paused");

      const dbStep: WorkflowStep = {
        id: "step-db",
        workflow_id: "wf-1",
        position: 5,
        name: "DB Write",
        type: "db_write",
        config: {},
      };
      const mockDbClient: any = {
        query: async () => ({ rows: [{ id: "res-test-100", created_at: new Date().toISOString() }] }),
      };
      const dbRes = await executeStep(dbStep, {}, mockDbClient, "org-1", "run-1");
      expect(dbRes.status).toBe("completed");
    });
  });
});
