/**
 * Email sending utilities using Microsoft 365 SMTP
 * Sends emails from support@ovrsee.ai via Microsoft 365
 */

import nodemailer from "nodemailer";

const MS365_SMTP_HOST = process.env.MS365_SMTP_HOST || "smtp.office365.com";
const MS365_SMTP_PORT = parseInt(process.env.MS365_SMTP_PORT || "587", 10);
const MS365_SMTP_USER = process.env.MS365_SMTP_USER; // e.g., nematollah@ovrsee.onmicrosoft.com
const MS365_SMTP_PASS = process.env.MS365_SMTP_PASS; // App password / secret

/**
 * Create nodemailer transporter for Microsoft 365 SMTP
 */
function createTransporter() {
  if (!MS365_SMTP_USER || !MS365_SMTP_PASS) {
    throw new Error(
      "MS365_SMTP_USER and MS365_SMTP_PASS environment variables must be set"
    );
  }

  return nodemailer.createTransport({
    host: MS365_SMTP_HOST,
    port: MS365_SMTP_PORT,
    secure: false, // Use TLS (port 587)
    requireTLS: true,
    auth: {
      user: MS365_SMTP_USER,
      pass: MS365_SMTP_PASS,
    },
    tls: {
      ciphers: "SSLv3",
    },
  });
}

/**
 * Send email from OVRSEE Support (support@ovrsee.ai)
 * 
 * @param opts - Email options
 * @param opts.to - Recipient email address
 * @param opts.subject - Email subject
 * @param opts.html - HTML email body
 * @param opts.text - Plain text email body (optional, will be generated from HTML if not provided)
 */
export async function sendSupportEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const { to, subject, html, text } = opts;

  if (!to || !subject || !html) {
    throw new Error("to, subject, and html are required");
  }

  try {
    const transporter = createTransporter();

    // Generate plain text from HTML if not provided
    const plainText =
      text ||
      html
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .trim();

    const mailOptions = {
      from: "OVRSEE Support <support@ovrsee.ai>",
      to,
      subject,
      text: plainText,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", {
      messageId: info.messageId,
      to,
      subject,
    });
  } catch (error: any) {
    console.error("Failed to send email:", {
      error: error.message,
      to,
      subject,
      stack: error.stack,
    });
    throw new Error(`Failed to send email: ${error.message}`);
  }
}


