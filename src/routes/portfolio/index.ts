import { FastifyPluginAsync } from "fastify";
import { eq, and, sql } from "drizzle-orm";
import { portfolios, personalTasks, tableSwimlanes, tableWeeks } from "../../db/schema";
import { verifyAccessToken, AuthenticatedRequest } from "../auth/auth";
import {
  getPortfolioRouteSchema,
  upsertPortfolioRouteSchema,
  deletePortfolioRouteSchema,
} from "./schemas";

// Calculate commits from personal tasks done
async function calculateCommits(drizzle: any, userId: string): Promise<number> {
  try {
    // Count all personal tasks with status 'done' for this user
    // 1 personal task done = 1 commit
    const result = await drizzle
      .select()
      .from(personalTasks)
      .innerJoin(tableSwimlanes, eq(personalTasks.swimlaneId, tableSwimlanes.swimlaneId))
      .innerJoin(tableWeeks, eq(tableSwimlanes.tableId, tableWeeks.tableId))
      .where(
        and(
          eq(tableWeeks.userId, userId),
          eq(personalTasks.status, "done")
        )
      );

    return result.length;
  } catch (error) {
    console.error("Error calculating commits:", error);
    return 0;
  }
}

const portfolioRoutes: FastifyPluginAsync = async (fastify) => {
  // Get user's portfolio
  fastify.get(
    "/api/portfolio",
    {
      schema: getPortfolioRouteSchema,
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

        const [portfolio] = await fastify.drizzle
          .select()
          .from(portfolios)
          .where(eq(portfolios.userId, userId))
          .limit(1);

        if (!portfolio) {
          return { data: null };
        }

        // Calculate commits from personal tasks
        const commits = await calculateCommits(fastify.drizzle, userId);

        return {
          data: {
            ...portfolio,
            commits,
          },
        };
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: error.message || "Internal server error" });
      }
    }
  );

  // Create or update portfolio
  fastify.post(
    "/api/portfolio",
    {
      schema: upsertPortfolioRouteSchema,
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

        const portfolioData = request.body as {
          username?: string;
          bio?: string;
          avatarUrl?: string;
          readme?: string;
          location?: string;
          company?: string;
          blog?: string;
          twitterUsername?: string;
        };

        // Check if portfolio exists
        const [existing] = await fastify.drizzle
          .select()
          .from(portfolios)
          .where(eq(portfolios.userId, userId))
          .limit(1);

        let portfolio;
        if (existing) {
          // Update existing portfolio
          const [updated] = await fastify.drizzle
            .update(portfolios)
            .set({
              ...portfolioData,
              updatedAt: new Date(),
            })
            .where(eq(portfolios.userId, userId))
            .returning();

          portfolio = updated;
        } else {
          // Create new portfolio
          const [created] = await fastify.drizzle
            .insert(portfolios)
            .values({
              userId,
              ...portfolioData,
            })
            .returning();

          portfolio = created;
        }

        // Calculate commits
        const commits = await calculateCommits(fastify.drizzle, userId);

        return {
          data: {
            ...portfolio,
            commits,
          },
        };
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: error.message || "Internal server error" });
      }
    }
  );

  // Delete portfolio
  fastify.delete(
    "/api/portfolio",
    {
      schema: deletePortfolioRouteSchema,
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

        // Check if portfolio exists
        const [existing] = await fastify.drizzle
          .select()
          .from(portfolios)
          .where(eq(portfolios.userId, userId))
          .limit(1);

        if (!existing) {
          return reply.status(404).send({ error: "Portfolio not found" });
        }

        // Delete portfolio
        await fastify.drizzle
          .delete(portfolios)
          .where(eq(portfolios.userId, userId));

        return { message: "Portfolio deleted successfully" };
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: error.message || "Internal server error" });
      }
    }
  );

  // Get contribution calendar data (tasks done by date)
  fastify.get(
    "/api/portfolio/contributions",
    {
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

        // Get tasks done grouped by date (last 365 days)
        // Calculate exactly 365 days ago (not 1 year ago)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysAgo365 = new Date(today);
        daysAgo365.setDate(daysAgo365.getDate() - 364); // 364 days ago = 365 days including today
        daysAgo365.setHours(0, 0, 0, 0);
        const daysAgo365Str = daysAgo365.toISOString().split("T")[0];

        const contributions = await fastify.drizzle
          .select({
            date: sql<string>`${personalTasks.taskDate}::text`,
            count: sql<number>`COUNT(*)::int`,
          })
          .from(personalTasks)
          .innerJoin(tableSwimlanes, eq(personalTasks.swimlaneId, tableSwimlanes.swimlaneId))
          .innerJoin(tableWeeks, eq(tableSwimlanes.tableId, tableWeeks.tableId))
          .where(
            and(
              eq(tableWeeks.userId, userId),
              eq(personalTasks.status, "done"),
              sql`${personalTasks.taskDate} >= ${sql.raw(`'${daysAgo365Str}'`)}`
            )
          )
          .groupBy(personalTasks.taskDate);

        // Convert to map for easy lookup
        // Ensure date is in YYYY-MM-DD format
        const contributionMap: Record<string, number> = {};
        contributions.forEach((item) => {
          // PostgreSQL date::text returns YYYY-MM-DD format, but ensure it's normalized
          const dateStr = item.date.split("T")[0]; // Remove time part if present
          contributionMap[dateStr] = item.count;
        });

        return {
          data: contributionMap,
        };
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: error.message || "Internal server error" });
      }
    }
  );
};

export default portfolioRoutes;
