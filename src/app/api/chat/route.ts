// app/api/chat/route.ts
import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import * as cheerio from 'cheerio';
import docsData from './glean_docs.json';
import TurndownService from 'turndown';

// Initialize OpenAI client with OpenRouter
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPEN_ROUTER_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    'X-Title': 'OpenRouter Chat App',
  },
});

// -----------------------------
// Docs index and utilities
// -----------------------------

type TopicEntry = { url: string; content_description?: string };
type DocsJson = {
  crawl_info?: Record<string, unknown>;
  topics: Record<string, TopicEntry[]>;
};

const DEVELOPERS_HOST = 'developers.glean.com';

function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    url.protocol = 'https:';
    url.host = url.host.toLowerCase();
    url.search = '';
    url.hash = '';
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }
    return url.toString();
  } catch {
    return null;
  }
}

function isAllowedDomain(urlString: string): boolean {
  try {
    const u = new URL(urlString);
    return u.host.toLowerCase() === DEVELOPERS_HOST;
  } catch {
    return false;
  }
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function findClosestUrl(target: string, candidates: string[]): { url: string; distance: number } | null {
  let best: { url: string; distance: number } | null = null;
  for (const c of candidates) {
    const d = levenshtein(target, c);
    if (!best || d < best.distance) {
      best = { url: c, distance: d };
    }
  }
  return best;
}

// Build indices from docs JSON
const docs: DocsJson = docsData as unknown as DocsJson;
const categoryToPages = new Map<string, TopicEntry[]>();
const normalizedUrlToEntry = new Map<string, { category: string; entry: TopicEntry }>();

for (const [category, entries] of Object.entries(docs.topics || {})) {
  const filtered: TopicEntry[] = [];
  for (const e of entries) {
    const n = normalizeUrl(e.url);
    if (!n) continue;
    if (!isAllowedDomain(n)) continue;
    const entry = { url: n, content_description: e.content_description };
    filtered.push(entry);
    normalizedUrlToEntry.set(n, { category, entry });
  }
  categoryToPages.set(category, filtered);
}

// Simple LRU cache with TTL
class LruCache<V> {
  private map: Map<string, { value: V; expiresAt: number }>;
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries: number, ttlMs: number) {
    this.map = new Map();
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    if (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value as string | undefined;
      if (oldestKey !== undefined) this.map.delete(oldestKey);
    }
  }
}

const htmlCache = new LruCache<string>(200, 1000 * 60 * 30);

const turndown = new TurndownService();

// Logging helpers removed - using minimal logging to reduce noise

async function fetchAndExtractMain(url: string): Promise<string> {
  const cached = htmlCache.get(url);
  if (cached) return cached;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Failed to fetch (${res.status})`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  $('script, style').remove();
  const mainEl = $('main').first();
  let serialized = '';
  if (mainEl.length > 0) {
    serialized = cheerio.load('<div></div>')('div').append(mainEl.clone()).children().toString();
  } else {
    const bodyEl = $('body').first();
    serialized = cheerio.load('<div></div>')('div').append(bodyEl.clone()).children().toString();
  }
  htmlCache.set(url, serialized);
  return serialized;
}

// Tool definitions for OpenAI
const tools = [
    {
      "type": "function",
      "function": {
        "name": "select_category",
        "description": "Selects a documentation category to retrieve a list of relevant page URLs and their descriptions. Use this as the first step to find documents related to a topic.",
        "parameters": {
          "type": "object",
          "properties": {
            "category": {
              "type": "string",
              "description": "The documentation category to explore.",
              "enum": [
                "authentication",
                "getting-started",
                "chat",
                "search",
                "agents",
                "actions",
                "mcp",
                "web-sdk",
                "api-clients",
                "client-api",
                "indexing-api",
                "documents",
                "collections",
                "entities",
                "permissions",
                "troubleshooting",
                "verification",
                "messages",
                "insights",
                "datasources",
                "automation",
                "pins",
                "governance",
                "answers",
                "knowledge-base",
                "changelog",
                "core-concepts",
                "development-tools",
                "components",
                "integration",
                "administration",
                "feed",
                "recommendations"
              ]
            }
          },
          "required": ["category"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "load_pages",
        "description": "Loads the full content of one or more documentation pages given their URLs. Use this after 'select_category' to get the detailed information needed to answer a user's question.",
        "parameters": {
          "type": "object",
          "properties": {
            "urls": {
              "type": "array",
              "description": "A list of one or more page URLs to load content from.",
              "items": {
                "type": "string",
                "description": "A single URL from the developer documentation."
              }
            }
          },
          "required": ["urls"]
        }
      }
    }
  ] satisfies OpenAI.Chat.Completions.ChatCompletionTool[];
const system_prompt = `
You are the Glean Developer Onboarding Assistant. Your primary purpose is to help developers understand and build on the Glean platform by providing accurate information from the official developer documentation.

---

### About Glean

Glean is a **Work AI platform** that connects to all of a company's data sources (like Google Drive, Slack, Jira, etc.) to create a powerful, **permission-aware knowledge base**. As a developer, you can use Glean's APIs and SDKs to build applications with advanced search, conversational AI (chat), and intelligent agent capabilities.

**Core Services & APIs:**

* **Indexing API**: Used for backend, administrative tasks. Its main purpose is to push content from custom data sources into Glean's search index, manage user and group permissions, and define custom data models.
* **Client API**: Used to build user-facing applications. It provides endpoints for searching indexed content, building AI-powered chat experiences, managing content collections (like curated lists of documents), and executing AI agents.
* **Agents**: AI programs that can perform complex, multi-step tasks and workflows by reasoning over your company's knowledge. They can be built with a no-code interface or programmatically.
* **Web SDK**: A set of pre-built JavaScript components for easily embedding Glean's search and chat interfaces directly into your websites or internal portals.
* **Model Context Protocol (MCP)**: A standardized way to connect external AI models and tools (like Claude or Cursor) directly to your Glean instance, allowing them to securely access your enterprise knowledge.

---

### How to Answer

1.  **Understand the Query**: First, carefully analyze the user's question to determine the main topic. If the query is ambiguous, ask for clarification.
2.  **Select a Category**: Use the \`select_category\` tool to find relevant documentation pages for that topic. This tool will give you a list of page URLs and their descriptions.
3.  **Load Page Content**: From the list of pages returned by \`select_category\`, identify the most relevant URLs based on their descriptions and the user's specific question. Then, use the \`load_pages\` tool to retrieve the full content of those pages. It is better to load fewer, highly relevant pages than many irrelevant ones.
4.  **Synthesize and Cite**: Based **only** on the content you've loaded, formulate a comprehensive answer.
    * You **MUST** cite your sources. After a sentence or piece of information taken from or adapted from a document, add a citation link in the format \`[source](url)\`.
    * Do NOT use the pattern \`url source\`. Always use \`[source](url)\` so links render properly.
    * When possible, use direct quotes and include full code examples from the documentation to provide clear, actionable information.
    * Format your answers clearly using markdown, especially for code blocks and lists, use code blocks for curl commands and other code examples.
    * Don't mix ordered and unordered lists.

### Important Rules

* Do not answer from memory. Your knowledge is limited to the documents you retrieve using your tools.
* If the retrieved documents do not contain the answer, state that you could not find the specific information in the developer docs.
* Your tool calls and their results are not visible to the user. Your final answer must be complete and contain all necessary information and citations.

### Available Documentation Categories

You can use the \`select_category\` tool with any of the following categories: \`getting-started\`, \`authentication\`, \`client-api\`, \`indexing-api\`, \`chat\`, \`search\`, \`agents\`, \`actions\`, \`web-sdk\`, \`api-clients\`, \`documents\`, \`permissions\`, \`troubleshooting\`, \`datasources\`, \`integration\`, and \`core-concepts\`.
`
// Types for accumulated tool calls during streaming
type AccumulatedToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

type IncomingMessage = { role: 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json() as { messages: IncomingMessage[] };

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid messages format', { status: 400 });
    }

    const conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: system_prompt },
      ...messages,
    ];

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const maxIterations = 6;
          for (let iteration = 0; iteration < maxIterations; iteration++) {
            let fullContent = '';
            const toolCalls: AccumulatedToolCall[] = [];
            console.log('conversationMessages', conversationMessages);
            const response = await openai.chat.completions.create({
              model: 'openai/gpt-5-mini',
              messages: conversationMessages,
              tools,
              tool_choice: 'auto',
              stream: true,
              temperature: 0.7,
           
            });

            for await (const chunk of response) {
              const delta = chunk.choices[0]?.delta;

              if (delta?.content) {
                fullContent += delta.content;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: 'content',
                    content: delta.content,
                  })}\n\n`)
                );
              }

              if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  if (toolCall.index !== undefined) {
                    if (!toolCalls[toolCall.index]) {
                      toolCalls[toolCall.index] = {
                        id: toolCall.id || '',
                        type: 'function',
                        function: { name: '', arguments: '' },
                      };
                    }
                    const tc = toolCalls[toolCall.index];
                    if (toolCall.id) tc.id = toolCall.id;
                    if (toolCall.function?.name) tc.function.name = toolCall.function.name;
                    if (toolCall.function?.arguments) tc.function.arguments += toolCall.function.arguments;
                  }
                }
              }

              if (chunk.choices[0]?.finish_reason === 'tool_calls') {
                break;
              }

              if (chunk.choices[0]?.finish_reason === 'stop') {
                controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                controller.close();
                return;
              }
            }

            // If we get here, model requested tool calls for this iteration
            const executableToolCalls = toolCalls.filter(tc => tc && tc.function && tc.function.name);

            const toolResults: Array<{ tool_call_id: string; role: 'tool'; content: string }> = [];
            for (const toolCall of executableToolCalls) {
              const toolName = toolCall.function?.name;
              const toolArgsRaw = toolCall.function?.arguments || '';
              if (!toolName) continue;

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'tool_call',
                  tool_name: toolName,
                  tool_args: toolArgsRaw,
                })}\n\n`)
              );

              try {
                const args = toolArgsRaw ? JSON.parse(toolArgsRaw) : {};
                let result: unknown;

                switch (toolName) {
                  case 'select_category': {
                    const category: string | undefined = args.category;
                    if (!category) {
                      result = { error: 'Missing required parameter: category' };
                      break;
                    }
                    const pages = categoryToPages.get(category) || [];
                    result = {
                      category,
                      pages: pages.map(p => ({ url: p.url, content_description: p.content_description || '' })),
                    };
                    break;
                  }
                  case 'load_pages': {
                    const urls: string[] = Array.isArray(args.urls) ? args.urls : [];
                    if (urls.length === 0) {
                      result = { error: 'Missing required parameter: urls' };
                      break;
                    }
                    const outputs: Array<{
                      url: string;
                      normalized_url?: string;
                      markdown?: string;
                      error?: string;
                      suggestion?: string;
                    }> = [];
                    for (const rawUrl of urls) {
                      const normalized = normalizeUrl(rawUrl);
                      if (!normalized) {
                        outputs.push({ url: rawUrl, error: 'Invalid URL' });
                        continue;
                      }
                      if (!isAllowedDomain(normalized)) {
                        outputs.push({ url: rawUrl, normalized_url: normalized, error: 'URL not allowed: outside developers.glean.com' });
                        continue;
                      }
                      if (!normalizedUrlToEntry.has(normalized)) {
                        const candidates = Array.from(normalizedUrlToEntry.keys());
                        const close = findClosestUrl(normalized, candidates);
                        const suggestion = close && close.distance <= Math.max(5, Math.floor(normalized.length * 0.1)) ? close.url : undefined;
                        outputs.push({ url: rawUrl, normalized_url: normalized, error: 'URL not found in docs index', suggestion });
                        continue;
                      }
                      try {
                        const html = await fetchAndExtractMain(normalized);
                        const markdown = turndown.turndown(html);
                        outputs.push({ url: rawUrl, normalized_url: normalized, markdown });
                      } catch (e: unknown) {
                        outputs.push({ url: rawUrl, normalized_url: normalized, error: e instanceof Error ? e.message : 'Fetch failed' });
                      }
                    }
                    result = outputs;
                    break;
                  }
                  default:
                    result = { error: 'Unknown tool' };
                }

                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  content: JSON.stringify(result),
                });

                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: 'tool_result',
                    tool_name: toolName,
                    result,
                  })}\n\n`)
                );
              } catch {
                const errorResult = { error: 'Failed to execute tool' };
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  content: JSON.stringify(errorResult),
                });
              }
            }

            // Append assistant pre-tool content and tool results to conversation
            const toolCallsForOpenAI = executableToolCalls as unknown as OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
            const assistantMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
              role: 'assistant',
              content: fullContent || null,
              tool_calls: toolCallsForOpenAI,
            };
            conversationMessages.push(assistantMessage);
            const toolMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = toolResults.map(tr => ({
              role: 'tool',
              content: tr.content,
              tool_call_id: tr.tool_call_id,
            }));
            conversationMessages.push(...toolMessages);
          }

          // If loop exits due to iteration cap
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Max tool iterations reached.' })}\n\n`));
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              message: 'An error occurred while processing your request.',
            })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('API Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}