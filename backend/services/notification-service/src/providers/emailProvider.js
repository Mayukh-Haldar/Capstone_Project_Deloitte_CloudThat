const nodemailer = require("nodemailer");
const env = require("../config/env");

let transporter = null;

const isEmailConfigured = () => Boolean(env.smtpHost && env.smtpUsername && env.smtpPassword);

const getTransporter = () => {
  if (!isEmailConfigured()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: env.smtpAuth
        ? {
            user: env.smtpUsername,
            pass: env.smtpPassword
          }
        : undefined,
      requireTLS: env.smtpStartTls
    });
  }

  return transporter;
};

const sendEmail = async ({ to, subject, text, html, attachments = [] }) => {
  const mailer = getTransporter();

  if (!mailer) {
    return {
      provider: "MockEmailProvider",
      status: "SUCCESS",
      responseCode: "202",
      responseMessage: `SMTP not configured. Mock email accepted for ${to || "unknown-recipient"}`,
      externalId: `mock-email-${Date.now()}`,
      metadata: { subject, mock: true }
    };
  }

  const info = await mailer.sendMail({
    from: `"${env.mailFromName}" <${env.mailFromEmail}>`,
    to,
    subject,
    text,
    html: html || undefined,
    attachments: attachments.length
      ? attachments.map((item) => ({
          filename: item.filename,
          contentType: item.contentType || "application/octet-stream",
          content: item.contentBase64,
          encoding: "base64",
          contentDisposition: item.disposition || "attachment"
        }))
      : undefined
  });

  return {
    provider: "SMTP",
    status: "SUCCESS",
    responseCode: "250",
    responseMessage: `Email accepted by SMTP transport for ${to}`,
    externalId: info.messageId,
    metadata: {
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response
    }
  };
};

module.exports = { sendEmail, isEmailConfigured };
