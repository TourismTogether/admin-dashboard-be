import { and, between, eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import {
  userSettings,
  users,
  personalTasks,
  tableSwimlanes,
  tableWeeks,
} from "../db/schema";
import { sendEmail } from "../utils/email";

interface WeeklyTaskSummary {
  date: string;
  tasks: {
    content: string;
    status: string;
    priority: string;
    detail: string | null;
  }[];
}

function getLastWeekDateRange() {
  const today = new Date();
  // Assume job runs on Monday -> last week = previous Monday-Sunday
  const end = new Date(today);
  end.setDate(end.getDate() - 1); // Sunday
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setDate(start.getDate() - 6); // Monday
  start.setHours(0, 0, 0, 0);

  const format = (d: Date) => d.toISOString().slice(0, 10);

  return {
    startDate: format(start),
    endDate: format(end),
  };
}

function getCurrentWeekDateRange() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ...
  
  // Calculate Monday of current week
  const monday = new Date(today);
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, go back 6 days
  monday.setDate(today.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);

  // Calculate Sunday of current week
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const format = (d: Date) => d.toISOString().slice(0, 10);

  return {
    startDate: format(monday),
    endDate: format(sunday),
  };
}

async function buildWeeklySummary(
  fastify: FastifyInstance,
  userId: string,
  startDate: string,
  endDate: string
): Promise<WeeklyTaskSummary[]> {
  if (!fastify.drizzle) {
    return [];
  }

  // Join: personal_tasks -> table_swimlanes -> table_weeks (to filter by user)
  const rows = await fastify.drizzle
    .select({
      taskDate: personalTasks.taskDate,
      content: personalTasks.content,
      status: personalTasks.status,
      priority: personalTasks.priority,
      detail: personalTasks.detail,
    })
    .from(personalTasks)
    .innerJoin(
      tableSwimlanes,
      eq(personalTasks.swimlaneId, tableSwimlanes.swimlaneId)
    )
    .innerJoin(tableWeeks, eq(tableSwimlanes.tableId, tableWeeks.tableId))
    .where(
      and(
        eq(tableWeeks.userId, userId),
        between(personalTasks.taskDate, startDate, endDate)
      )
    );

  // Group by date
  const byDate = new Map<string, WeeklyTaskSummary["tasks"]>();
  for (const row of rows) {
    // Handle taskDate which can be string or Date from Drizzle
    // Convert to string format (YYYY-MM-DD)
    let dateKey: string;
    const taskDateRaw = row.taskDate;
    if (typeof taskDateRaw === "string") {
      dateKey = taskDateRaw;
    } else {
      // Type assertion: if not string, treat as Date object
      const dateObj = taskDateRaw as unknown as Date;
      dateKey = dateObj.toISOString().slice(0, 10);
    }
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, []);
    }
    byDate.get(dateKey)!.push({
      content: row.content,
      status: row.status,
      priority: row.priority,
      detail: row.detail ?? null,
    });
  }

  const summaries: WeeklyTaskSummary[] = Array.from(byDate.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, tasks]) => ({ date, tasks }));

  return summaries;
}

function renderEmailHtml(
  userEmail: string,
  startDate: string,
  endDate: string,
  summaries: WeeklyTaskSummary[]
) {
  if (summaries.length === 0) {
    return `
      <p>Xin chào ${userEmail},</p>
      <p>Tuần vừa rồi (${startDate} → ${endDate}) bạn không có Personal Task nào.</p>
    `;
  }

  const sections = summaries
    .map((day) => {
      const items = day.tasks
        .map(
          (t) =>
            `<li><strong>[${t.priority}] [${t.status}]</strong> ${t.content}${
              t.detail ? ` – <em>${t.detail}</em>` : ""
            }</li>`
        )
        .join("");
      return `
        <h3>${day.date}</h3>
        <ul>${items}</ul>
      `;
    })
    .join("");

  return `
    <p>Xin chào ${userEmail},</p>
    <p>Đây là tổng kết Personal Tasks tuần của bạn (${startDate} → ${endDate}):</p>
    ${sections}
    <p>— Admin Dashboard</p>
  `;
}

/**
 * @deprecated - Server will mainly be shut down, email sending is now manual via API endpoint
 * Use sendWeeklyEmailForUser() instead for manual email sending
 */
export async function runWeeklyPersonalTasksEmailJob(_fastify: FastifyInstance) {
  // Deprecated - functionality moved to manual API endpoint
  // This function is kept for backward compatibility but does nothing
  return;
}
/**
 * Send weekly email report for current week for a specific user
 * Used for manual email sending via API endpoint
 */
export async function sendWeeklyEmailForUser(
  fastify: FastifyInstance,
  userId: string
): Promise<{ success: boolean; message: string }> {
  if (!fastify.drizzle) {
    return {
      success: false,
      message: "Database not available",
    };
  }

  // Check if user has email enabled in settings
  const [setting] = await fastify.drizzle
    .select({
      sendPersonalTasksEmail: userSettings.sendPersonalTasksEmail,
      emailOverride: userSettings.personalTasksEmail,
      userEmail: users.email,
    })
    .from(userSettings)
    .innerJoin(users, eq(userSettings.userId, users.userId))
    .where(eq(userSettings.userId, userId))
    .limit(1);

  if (!setting || !setting.sendPersonalTasksEmail) {
    return {
      success: false,
      message: "Email notifications are not enabled in settings",
    };
  }

  const targetEmail = setting.emailOverride || setting.userEmail;
  if (!targetEmail) {
    return {
      success: false,
      message: "No email address found",
    };
  }

  // Get current week date range
  const { startDate, endDate } = getCurrentWeekDateRange();

  // Build summary for current week
  const summaries = await buildWeeklySummary(
    fastify,
    userId,
    startDate,
    endDate
  );

  const html = renderEmailHtml(targetEmail, startDate, endDate, summaries);

  try {
    fastify.log.info(
      {
        userId,
        email: targetEmail,
        startDate,
        endDate,
        summaryCount: summaries.length,
        htmlLength: html.length,
      },
      "[send-weekly-email] Attempting to send email"
    );

    // Log HTML preview (first 200 chars)
    fastify.log.debug(
      {
        htmlPreview: html.substring(0, 200),
      },
      "[send-weekly-email] Email HTML preview"
    );

    const emailResult = await sendEmail({
      to: targetEmail,
      subject: `Weekly Personal Task Summary (${startDate} → ${endDate})`,
      html,
    });
    
    fastify.log.info(
      {
        userId,
        email: targetEmail,
        startDate,
        endDate,
        messageId: emailResult?.messageId,
        response: emailResult?.response,
      },
      "[send-weekly-email] Email sent successfully"
    );
    return {
      success: true,
      message: "Email sent successfully",
    };
  } catch (err: any) {
    fastify.log.error(
      {
        userId,
        email: targetEmail,
        error: err.message || err,
        stack: err.stack,
        errorName: err.name,
        errorCode: err.code,
      },
      "[send-weekly-email] Failed to send email"
    );
    return {
      success: false,
      message: err.message || "Failed to send email",
    };
  }
}

/**
 * @deprecated - Server will mainly be shut down, email sending is now manual via API endpoint
 * Use POST /api/personal-tasks/send-weekly-email instead
 */
export function scheduleWeeklyPersonalTasksEmailJob(
  fastify: FastifyInstance
) {
  // Chạy ngay khi server start (nếu đang là thứ 2) và sau đó mỗi 24h
  // const run = () => {
  //   runWeeklyPersonalTasksEmailJob(fastify).catch((err) => {
  //     fastify.log.error(
  //       { err },
  //       "[weekly-personal-tasks-email] Unhandled error in job"
  //     );
  //   });
  // };

  // // Run once on startup
  // run();

  // // Run every 24 hours
  // const oneDayMs = 24 * 60 * 60 * 1000;
  // setInterval(run, oneDayMs);
}
