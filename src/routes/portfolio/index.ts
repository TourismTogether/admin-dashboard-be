import { FastifyPluginAsync } from "fastify";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { portfolios, personalTasks, tableSwimlanes, tableWeeks, users } from "../../db/schema";
import { verifyAccessToken, AuthenticatedRequest } from "../auth/auth";
import {
  getPortfolioRouteSchema,
  upsertPortfolioRouteSchema,
  deletePortfolioRouteSchema,
  getLeaderboardRouteSchema,
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

function toDateOnly(dateValue: Date | string): string {
  if (dateValue instanceof Date) {
    return dateValue.toISOString().split("T")[0];
  }
  return String(dateValue).split("T")[0];
}

function calculateStreak(dateSet: Set<string>, todayStr: string): number {
  let streak = 0;
  let cursor = new Date(`${todayStr}T00:00:00.000Z`);

  while (true) {
    const cursorStr = cursor.toISOString().split("T")[0];
    if (!dateSet.has(cursorStr)) {
      break;
    }
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
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

  // Leaderboard based on portfolio-like contributions
  fastify.get(
    "/api/portfolio/leaderboard",
    {
      schema: getLeaderboardRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }

        const query = request.query as { period?: "current" | "previous" };
        const selectedPeriod = query.period === "previous" ? "previous" : "current";

        const usersWithPortfolio = await fastify.drizzle
          .select({
            userId: users.userId,
            email: users.email,
            nickname: users.nickname,
            fullname: users.fullname,
            imageUrl: users.imageUrl,
            username: portfolios.username,
            avatarUrl: portfolios.avatarUrl,
          })
          .from(users)
          .leftJoin(portfolios, eq(users.userId, portfolios.userId));

        const weekAnchor = new Date();
        weekAnchor.setHours(0, 0, 0, 0);
        const dayOfWeek = weekAnchor.getDay(); // 0 (Sun) -> 6 (Sat)
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStart = new Date(weekAnchor);
        weekStart.setDate(weekStart.getDate() + diffToMonday);
        if (selectedPeriod === "previous") {
          weekStart.setDate(weekStart.getDate() - 7);
        }
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const weekStartStr = weekStart.toISOString().split("T")[0];
        const weekEndStr = weekEnd.toISOString().split("T")[0];

        const doneTasks = await fastify.drizzle
          .select({
            userId: tableWeeks.userId,
            taskDate: personalTasks.taskDate,
            priority: personalTasks.priority,
          })
          .from(personalTasks)
          .innerJoin(tableSwimlanes, eq(personalTasks.swimlaneId, tableSwimlanes.swimlaneId))
          .innerJoin(tableWeeks, eq(tableSwimlanes.tableId, tableWeeks.tableId))
          .where(
            and(
              eq(personalTasks.status, "done"),
              gte(personalTasks.taskDate, weekStartStr),
              lte(personalTasks.taskDate, weekEndStr)
            )
          );

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split("T")[0];
        const last30 = new Date(today);
        last30.setDate(last30.getDate() - 29);

        const taskStats = new Map<
          string,
          {
            commits: number;
            commitsLast30Days: number;
            highPriorityCommits: number;
            doneDates: Set<string>;
          }
        >();

        for (const task of doneTasks) {
          const userId = task.userId;
          const existing =
            taskStats.get(userId) ?? {
              commits: 0,
              commitsLast30Days: 0,
              highPriorityCommits: 0,
              doneDates: new Set<string>(),
            };

          existing.commits += 1;
          const taskDate = new Date(toDateOnly(task.taskDate));
          taskDate.setHours(0, 0, 0, 0);
          const taskDateStr = taskDate.toISOString().split("T")[0];
          existing.doneDates.add(taskDateStr);

          if (taskDate >= last30) {
            existing.commitsLast30Days += 1;
          }

          if (task.priority === "high") {
            existing.highPriorityCommits += 1;
          }

          taskStats.set(userId, existing);
        }

        const leaderboard = usersWithPortfolio
          .map((user) => {
            const stats =
              taskStats.get(user.userId) ?? {
                commits: 0,
                commitsLast30Days: 0,
                highPriorityCommits: 0,
                doneDates: new Set<string>(),
              };

            const streakDays = calculateStreak(stats.doneDates, todayStr);
            const displayName =
              user.username ||
              user.fullname ||
              user.nickname ||
              user.email.split("@")[0] ||
              "Unknown";

            // Creative score: emphasize consistency + recent productivity + hard tasks
            const score =
              stats.commits * 2 +
              stats.commitsLast30Days * 3 +
              stats.highPriorityCommits * 4 +
              streakDays * 5;

            return {
              userId: user.userId,
              displayName,
              email: user.email,
              avatarUrl: user.avatarUrl || user.imageUrl || null,
              commits: stats.commits,
              commitsLast30Days: stats.commitsLast30Days,
              highPriorityCommits: stats.highPriorityCommits,
              streakDays,
              score,
            };
          })
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (b.commits !== a.commits) return b.commits - a.commits;
            return b.streakDays - a.streakDays;
          })
          .map((item, index) => ({
            ...item,
            rank: index + 1,
          }));

        return { data: leaderboard };
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: error.message || "Internal server error" });
      }
    }
  );
};

export default portfolioRoutes;
