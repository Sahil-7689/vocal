import axios from "axios";
import { resolveTemplate } from "../template";

export interface LLMStepConfig {
  provider?: string;
  model?: string;
  system_prompt?: string;
  prompt?: string;
  temperature?: number;
  max_retries?: number;
}

export interface LLMStepOutput {
  text: string;
  model: string;
  tokens?: number;
  confidence?: number;
  attempts: number;
  usage?: any;
}

/**
 * Modular LLM Call Step Handler
 * Supports prompt interpolation, configurable model, temperature, and exponential backoff retry handling.
 */
export async function handleLLMCall(
  config: LLMStepConfig,
  context: Record<string, any>
): Promise<LLMStepOutput> {
  const apiKey = process.env.LLM_API_KEY || process.env.GROQ_API_KEY || "demo_key";
  const promptText = resolveTemplate(config.prompt || "{{input.text}}", context);
  const systemPrompt = config.system_prompt || "You are a helpful AI assistant.";
  const model = config.model || "llama-3.3-70b-versatile";
  const maxRetries = config.max_retries ?? 3;

  let attempts = 0;
  let lastError: any = null;

  while (attempts < maxRetries) {
    attempts++;
    try {
      if (apiKey === "demo_key" || apiKey === "mock") {
        // Simulated LLM execution output
        return {
          text: `[Groq AI Output]: Processed prompt "${promptText.slice(0, 60)}...". Analysis complete.`,
          model,
          confidence: 0.98,
          tokens: 142,
          attempts,
        };
      }

      // Real OpenAI/Groq compatible chat completions call
      const res = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: promptText },
          ],
          temperature: config.temperature ?? 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 12000,
        }
      );

      return {
        text: res.data.choices?.[0]?.message?.content || "",
        model: res.data.model || model,
        usage: res.data.usage,
        attempts,
      };
    } catch (err: any) {
      lastError = err;
      if (attempts < maxRetries) {
        // Exponential backoff: 300ms, 600ms, 1200ms...
        const backoffMs = 300 * Math.pow(2, attempts - 1);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }

  throw new Error(`LLM Call failed after ${attempts} attempts: ${lastError?.message || "Timeout/Network Error"}`);
}
