/**
 * LLM Proxy
 * Wrapper for calling OpenRouter, Groq, Gemini, and mock fallback
 * Features 8-second timeout with AbortController for resilient cascade
 */

import type { ModelConfig, ChatCompletionRequest, ChatCompletionResponse } from './types';
import { OPENROUTER_API_KEY, GROQ_API_KEY, GEMINI_API_KEY } from './constants';

// 8-second timeout for LLM requests
const LLM_TIMEOUT_MS = 8000;

// ============================================================================
// Main LLM Call Function
// ============================================================================

export async function callLLM(
  model: ModelConfig,
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  switch (model.provider) {
    case 'openrouter':
      return callOpenRouter(model, request);
    case 'groq':
      return callGroq(model, request);
    case 'gemini':
      return callGemini(model, request);
    case 'mock':
      return callMock(model, request);
    default:
      throw new Error(`Unsupported provider: ${model.provider}`);
  }
}

// ============================================================================
// OpenRouter
// ============================================================================

async function callOpenRouter(
  model: ModelConfig,
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await fetch(model.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://untouched.example.com',
        'X-Title': 'Untouched',
      },
      body: JSON.stringify({
        model: model.id,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 1000,
      }),
      signal: abortController.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter error: ${response.status} ${error}`);
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`OpenRouter timeout after ${LLM_TIMEOUT_MS}ms`);
    }
    throw error;
  }
}

// ============================================================================
// Groq
// ============================================================================

async function callGroq(
  model: ModelConfig,
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await fetch(model.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.id,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 1000,
      }),
      signal: abortController.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq error: ${response.status} ${error}`);
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Groq timeout after ${LLM_TIMEOUT_MS}ms`);
    }
    throw error;
  }
}

// ============================================================================
// Gemini
// ============================================================================

async function callGemini(
  model: ModelConfig,
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  // Gemini uses different format - convert OpenAI messages to Gemini format
  const contents = request.messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await fetch(`${model.endpoint}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.max_tokens ?? 1000,
        },
      }),
      signal: abortController.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini error: ${response.status} ${error}`);
    }

    const data = await response.json();

    // Convert Gemini response to OpenAI format
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const promptTokens = data.usageMetadata?.promptTokenCount || 0;
    const completionTokens = data.usageMetadata?.candidatesTokenCount || 0;

    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model.id,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: text,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Gemini timeout after ${LLM_TIMEOUT_MS}ms`);
    }
    throw error;
  }
}

// ============================================================================
// Mock Fallback (always succeeds)
// ============================================================================

async function callMock(
  model: ModelConfig,
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  // Simulate a delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  const userMessage = request.messages[request.messages.length - 1]?.content || '';
  const mockResponse = `[Mock Response] I received your message: "${userMessage.slice(0, 50)}${userMessage.length > 50 ? '...' : ''}"`;

  const promptTokens = Math.ceil(
    request.messages.reduce((sum, m) => sum + m.content.length, 0) / 4
  );
  const completionTokens = Math.ceil(mockResponse.length / 4);

  return {
    id: `chatcmpl-mock-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model.id,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: mockResponse,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}
