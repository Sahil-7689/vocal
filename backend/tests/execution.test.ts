import { describe, it, expect } from "vitest";
import {
  resolveTemplate,
  checkSSRFProtection,
  executeConditional,
  executeLLMCall,
} from "../functions/_shared/workflowEngine";

describe("VocalFlow Workflow Execution Engine Test Suite", () => {
  it("Template Variable Interpolation: Resolves input and previous step outputs", () => {
    const context = {
      input: { text: "Urgent billing inquiry" },
      previous: { output: { ticketId: "ZD-9912" } },
    };

    const res1 = resolveTemplate("Ticket ID: {{previous.output.ticketId}}", context);
    expect(res1).toBe("Ticket ID: ZD-9912");

    const res2 = resolveTemplate("Query: {{input.text}}", context);
    expect(res2).toBe("Query: Urgent billing inquiry");
  });

  it("SSRF Protection: Rejects internal/localhost/metadata endpoints", () => {
    expect(() => checkSSRFProtection("http://localhost:8080/admin")).toThrow("SSRF Blocked");
    expect(() => checkSSRFProtection("http://127.0.0.1/status")).toThrow("SSRF Blocked");
    expect(() => checkSSRFProtection("http://169.254.169.254/latest/meta-data")).toThrow("SSRF Blocked");
    expect(() => checkSSRFProtection("http://10.0.0.1/internal")).toThrow("SSRF Blocked");

    // Public URL allowed
    expect(() => checkSSRFProtection("https://httpbin.org/get")).not.toThrow();
  });

  it("Conditional Branch: Evaluates equals and contains operators", async () => {
    const res1 = await executeConditional(
      { path: "status", operator: "equals", value: "200" },
      { status: 200 }
    );
    expect(res1.result).toBe(true);

    const res2 = await executeConditional(
      { path: "sentiment", operator: "equals", value: "negative" },
      { sentiment: "positive" }
    );
    expect(res2.result).toBe(false);
  });

  it("LLM Call Execution: Returns structured response object", async () => {
    const res = await executeLLMCall(
      { provider: "groq", model: "llama-3.3-70b-versatile", prompt: "{{input.text}}" },
      { input: { text: "Analyze ticket" } }
    );

    expect(res).toHaveProperty("text");
    expect(res).toHaveProperty("model");
  });
});
