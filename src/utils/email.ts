import nodemailer from "nodemailer";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

let _transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT
    ? parseInt(process.env.SMTP_PORT, 10)
    : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    // Fallback: log-only mode
    return null;
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  return _transporter;
}

export async function sendEmail(options: SendEmailOptions) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) {
    const errorMsg = "[email] SMTP_FROM or SMTP_USER is not configured. Email will not be sent.";
    console.warn(errorMsg);
    console.info(
      `[email:debug] To: ${options.to}\nSubject: ${options.subject}\n${options.html}`
    );
    throw new Error(errorMsg);
  }

  const transporter = getTransporter();
  if (!transporter) {
    const errorMsg = "[email] SMTP_* environment variables are not fully configured. Email will not be sent.";
    console.warn(errorMsg);
    console.info(
      `[email:debug] To: ${options.to}\nSubject: ${options.subject}\n${options.html}`
    );
    throw new Error(errorMsg);
  }

  // Log SMTP configuration (without password)
  console.info(
    `[email] SMTP Config - Host: ${process.env.SMTP_HOST}, Port: ${process.env.SMTP_PORT}, User: ${process.env.SMTP_USER}, From: ${from}`
  );

  try {
    // Verify SMTP connection before sending
    console.info(`[email] Verifying SMTP connection...`);
    await transporter.verify();
    console.info(`[email] SMTP connection verified successfully`);

    console.info(
      `[email] Sending email to: ${options.to}, Subject: ${options.subject}`
    );

    const result = await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    console.info(
      `[email] Email sent successfully. MessageId: ${result.messageId}, To: ${options.to}, Response: ${JSON.stringify(result.response)}`
    );
    return result;
  } catch (error: any) {
    console.error(
      `[email] Failed to send email to ${options.to}:`,
      error.message || error,
      `\nStack: ${error.stack}`
    );
    throw error;
  }
}

