import { FastifyPluginAsync } from "fastify";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  researchConversations,
  researchMessages,
  type ResearchSource,
} from "../../db/schema";
import { verifyAccessToken, AuthenticatedRequest } from "../auth/auth";
import {
  createResearchMessageRouteSchema,
  deleteResearchConversationRouteSchema,
  getResearchConversationsRouteSchema,
} from "./schemas";

type ResearchConversation = typeof researchConversations.$inferSelect;
type ResearchMessage = typeof researchMessages.$inferSelect;

type ConversationWithMessages = ResearchConversation & {
  messages: ResearchMessage[];
};

type SerperOrganicResult = {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
  position?: number;
};

const RESEARCH_SYSTEM_PROMPT =
  "You are a research assistant. Produce accurate, well-structured answers grounded in the provided search sources. Do not invent citations or claims beyond the supplied source snippets.";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function getGeminiApiKey(): string | null {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) return geminiKey;

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey?.startsWith("AIza")) return openAiKey;

  return null;
}

function makeConversationTitle(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (!normalized) return "Untitled research";
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

async function searchSources(prompt: string): Promise<ResearchSource[]> {
  const apiKey = requireEnv("SERPER_API_KEY");
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      q: prompt,
      num: 6,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Serper search failed: ${text || response.statusText}`);
  }

  const json = (await response.json()) as { organic?: SerperOrganicResult[] };
  return (json.organic ?? [])
    .filter((item) => item.title && item.link)
    .slice(0, 6)
    .map((item, index) => ({
      title: item.title ?? "Untitled source",
      link: item.link ?? "",
      snippet: item.snippet ?? "",
      position: item.position ?? index + 1,
      ...(item.date ? { date: item.date } : {}),
    }));
}

function buildAggregationPrompt(prompt: string, sources: ResearchSource[]): string {
  const sourceText = sources
    .map(
      (source, index) =>
        `[${index + 1}] ${source.title}\nURL: ${source.link}\nSnippet: ${
          source.snippet || "No snippet available"
        }${source.date ? `\nDate: ${source.date}` : ""}`,
    )
    .join("\n\n");

  return `User prompt:
${prompt}

Search sources:
${sourceText}

Write a complete answer to the user prompt using only the evidence from these six search sources. Synthesize the sources instead of listing them one by one. If the sources disagree or are insufficient, say so clearly. Include concise inline citations in the form [1], [2], etc.`;
}

async function aggregateResearchAnswer(
  prompt: string,
  sources: ResearchSource[],
): Promise<string> {
  const geminiApiKey = getGeminiApiKey();
  if (geminiApiKey) {
    return aggregateResearchAnswerWithGemini(prompt, sources, geminiApiKey);
  }

  return aggregateResearchAnswerWithOpenAi(prompt, sources);
}

async function aggregateResearchAnswerWithGemini(
  prompt: string,
  sources: ResearchSource[],
  apiKey: string,
): Promise<string> {
  const configuredModel = process.env.GEMINI_MODEL?.trim();
  const models = configuredModel
    ? [configuredModel]
    : ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
  const baseUrl =
    process.env.GEMINI_API_BASE_URL?.trim() ||
    "https://generativelanguage.googleapis.com/v1beta";

  let lastError = "";
  for (const model of models) {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/models/${model}:generateContent?key=${encodeURIComponent(
        apiKey,
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: RESEARCH_SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: buildAggregationPrompt(prompt, sources) }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
          },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      lastError = text || response.statusText;
      if (!configuredModel && response.status === 404) {
        continue;
      }
      throw new Error(`Gemini aggregation failed: ${lastError}`);
    }

    const json = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };
    const answer = json.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!answer) {
      throw new Error(`Gemini aggregation returned an empty answer for ${model}`);
    }
    return answer;
  }

  throw new Error(`Gemini aggregation failed: ${lastError}`);
}

async function aggregateResearchAnswerWithOpenAi(
  prompt: string,
  sources: ResearchSource[],
): Promise<string> {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const baseUrl =
    process.env.OPENAI_API_BASE_URL?.trim() || "https://api.openai.com/v1";

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: RESEARCH_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildAggregationPrompt(prompt, sources),
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM aggregation failed: ${text || response.statusText}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const answer = json.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    throw new Error("LLM aggregation returned an empty answer");
  }
  return answer;
}

async function getConversationWithMessages(
  fastify: Parameters<FastifyPluginAsync>[0],
  userId: string,
  conversationId: string,
): Promise<ConversationWithMessages | null> {
  const [conversation] = await fastify.drizzle
    .select()
    .from(researchConversations)
    .where(
      and(
        eq(researchConversations.id, conversationId),
        eq(researchConversations.userId, userId),
      ),
    )
    .limit(1);

  if (!conversation) return null;

  const messages = await fastify.drizzle
    .select()
    .from(researchMessages)
    .where(eq(researchMessages.conversationId, conversationId))
    .orderBy(asc(researchMessages.createdAt));

  return { ...conversation, messages };
}

const researchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/api/research",
    {
      schema: getResearchConversationsRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }

        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const conversations = await fastify.drizzle
          .select()
          .from(researchConversations)
          .where(eq(researchConversations.userId, authRequest.user.userId))
          .orderBy(desc(researchConversations.updatedAt));

        const data = await Promise.all(
          conversations.map(async (conversation) => {
            const messages = await fastify.drizzle
              .select()
              .from(researchMessages)
              .where(eq(researchMessages.conversationId, conversation.id))
              .orderBy(asc(researchMessages.createdAt));
            return { ...conversation, messages };
          }),
        );

        return { data };
      } catch (error: unknown) {
        const err = error as Error;
        fastify.log.error({ err }, "Error fetching research conversations");
        return reply.status(500).send({ error: err.message });
      }
    },
  );

  fastify.post(
    "/api/research/message",
    {
      schema: createResearchMessageRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }

        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const userId = authRequest.user.userId;
        const body = request.body as {
          conversationId?: string;
          prompt: string;
        };
        const prompt = body.prompt.trim();
        if (!prompt) {
          return reply.status(400).send({ error: "Prompt is required" });
        }

        let conversationId = body.conversationId;
        if (conversationId) {
          const existing = await getConversationWithMessages(
            fastify,
            userId,
            conversationId,
          );
          if (!existing) {
            return reply.status(404).send({ error: "Conversation not found" });
          }
        } else {
          const [createdConversation] = await fastify.drizzle
            .insert(researchConversations)
            .values({
              userId,
              title: makeConversationTitle(prompt),
            })
            .returning();
          conversationId = createdConversation.id;
        }

        await fastify.drizzle.insert(researchMessages).values({
          conversationId,
          role: "user",
          content: prompt,
        });

        const sources = await searchSources(prompt);
        if (sources.length === 0) {
          throw new Error("Serper returned no usable search sources");
        }

        const answer = await aggregateResearchAnswer(prompt, sources);

        await fastify.drizzle.insert(researchMessages).values({
          conversationId,
          role: "assistant",
          content: answer,
          sources,
        });

        await fastify.drizzle
          .update(researchConversations)
          .set({
            updatedAt: new Date(),
          })
          .where(eq(researchConversations.id, conversationId));

        const data = await getConversationWithMessages(
          fastify,
          userId,
          conversationId,
        );

        return { data };
      } catch (error: unknown) {
        const err = error as Error;
        fastify.log.error({ err }, "Error creating research message");
        return reply.status(500).send({ error: err.message });
      }
    },
  );

  fastify.delete(
    "/api/research/:id",
    {
      schema: deleteResearchConversationRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }

        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const { id } = request.params as { id: string };
        const [existing] = await fastify.drizzle
          .select()
          .from(researchConversations)
          .where(
            and(
              eq(researchConversations.id, id),
              eq(researchConversations.userId, authRequest.user.userId),
            ),
          )
          .limit(1);

        if (!existing) {
          return reply.status(404).send({ error: "Conversation not found" });
        }

        await fastify.drizzle
          .delete(researchConversations)
          .where(eq(researchConversations.id, id));

        return { message: "Conversation deleted successfully" };
      } catch (error: unknown) {
        const err = error as Error;
        fastify.log.error({ err }, "Error deleting research conversation");
        return reply.status(500).send({ error: err.message });
      }
    },
  );
};

export default researchRoutes;
