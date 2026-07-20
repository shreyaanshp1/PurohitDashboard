import net from "node:net";
import tls from "node:tls";

const DEFAULT_RESET_MINUTES = 60;

export async function sendPasswordResetEmail({ expiresInMinutes = DEFAULT_RESET_MINUTES, name = "", resetUrl, to }) {
  const subject = "Reset your Santosh Portfolio password";
  const displayName = String(name || "there").trim();
  const text = [
    `Hi ${displayName},`,
    "",
    "Use this link to reset your Santosh Portfolio password:",
    resetUrl,
    "",
    `This link expires in ${expiresInMinutes} minutes. If you did not request it, you can ignore this email.`
  ].join("\n");
  const html = [
    `<p>Hi ${escapeHtml(displayName)},</p>`,
    "<p>Use this link to reset your Santosh Portfolio password:</p>",
    `<p><a href="${escapeHtml(resetUrl)}">Reset password</a></p>`,
    `<p>This link expires in ${expiresInMinutes} minutes. If you did not request it, you can ignore this email.</p>`
  ].join("");

  return sendEmail({ html, subject, text, to });
}

async function sendEmail({ html, subject, text, to }) {
  if (process.env.RESEND_API_KEY) {
    return sendViaResend({ html, subject, text, to });
  }

  if (process.env.SMTP_HOST) {
    return sendViaSmtp({ html, subject, text, to });
  }

  if (process.env.PASSWORD_RESET_EMAIL_MODE === "console") {
    console.info("[password-reset-email]", { subject, text, to });
    return { mode: "console", sent: false, success: true };
  }

  const error = new Error(
    "Password reset email is not configured. Set RESEND_API_KEY with AUTH_EMAIL_FROM, or set SMTP_HOST, SMTP_FROM, SMTP_USER, and SMTP_PASS."
  );
  error.statusCode = 503;
  throw error;
}

async function sendViaResend({ html, subject, text, to }) {
  const from = emailFrom();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      html,
      subject,
      text,
      to: [to]
    })
  });
  const body = await response.text();
  const data = body ? JSON.parse(body) : {};

  if (!response.ok) {
    throw new Error(data?.message || `Resend request failed with status ${response.status}.`);
  }

  return { id: data.id || "", mode: "resend", sent: true, success: true };
}

async function sendViaSmtp({ html, subject, text, to }) {
  const config = smtpConfig();
  let session = await SmtpSession.connect(config);

  try {
    await session.expect([220]);
    await session.command(`EHLO ${config.heloName}`, [250]);

    if (!config.secure && config.startTls) {
      await session.command("STARTTLS", [220]);
      session = await session.upgradeToTls(config);
      await session.command(`EHLO ${config.heloName}`, [250]);
    }

    if (config.user || config.pass) {
      await session.command("AUTH LOGIN", [334]);
      await session.command(Buffer.from(config.user, "utf8").toString("base64"), [334]);
      await session.command(Buffer.from(config.pass, "utf8").toString("base64"), [235]);
    }

    await session.command(`MAIL FROM:<${config.fromAddress}>`, [250]);
    await session.command(`RCPT TO:<${to}>`, [250, 251]);
    await session.command("DATA", [354]);
    await session.writeData(buildMimeMessage({ from: config.from, html, subject, text, to }));
    await session.command("QUIT", [221]).catch(() => {});

    return { mode: "smtp", sent: true, success: true };
  } finally {
    session.close();
  }
}

function smtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = parseBoolean(process.env.SMTP_SECURE, port === 465);
  const startTls = parseBoolean(process.env.SMTP_STARTTLS, !secure);
  const from = emailFrom();
  const fromAddress = extractEmailAddress(from);

  if (!host) throw new Error("Missing SMTP_HOST.");
  if (!fromAddress) throw new Error("SMTP_FROM or AUTH_EMAIL_FROM must include an email address.");

  return {
    from,
    fromAddress,
    heloName: process.env.SMTP_HELO_NAME || "localhost",
    host,
    pass: process.env.SMTP_PASS || "",
    port,
    secure,
    startTls,
    user: process.env.SMTP_USER || ""
  };
}

function emailFrom() {
  return process.env.AUTH_EMAIL_FROM || process.env.SMTP_FROM || "";
}

function buildMimeMessage({ from, html, subject, text, to }) {
  const boundary = `portfolio-reset-${Date.now().toString(36)}`;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  ];
  const parts = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
    `--${boundary}--`
  ];

  return `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}`;
}

class SmtpSession {
  constructor(socket) {
    this.buffer = "";
    this.closed = false;
    this.completedResponses = [];
    this.pending = [];
    this.responseLines = [];
    this.socket = socket;
    this.socket.setEncoding("utf8");
    this.onData = (chunk) => this.handleData(chunk);
    this.onError = (error) => this.rejectPending(error);
    this.onClose = () => this.rejectPending(new Error("SMTP connection closed."));
    this.socket.on("data", this.onData);
    this.socket.on("error", this.onError);
    this.socket.on("close", this.onClose);
  }

  static connect(config) {
    return new Promise((resolve, reject) => {
      const onError = (error) => reject(error);
      const socket = config.secure
        ? tls.connect({ host: config.host, port: config.port, servername: config.host }, () => {
            socket.off("error", onError);
            resolve(new SmtpSession(socket));
          })
        : net.connect({ host: config.host, port: config.port }, () => {
            socket.off("error", onError);
            resolve(new SmtpSession(socket));
          });

      socket.once("error", onError);
    });
  }

  async command(command, expectedCodes) {
    this.socket.write(`${command}\r\n`);
    return this.expect(expectedCodes);
  }

  expect(expectedCodes) {
    return new Promise((resolve, reject) => {
      if (this.completedResponses.length) {
        this.resolveResponseForPending(this.completedResponses.shift(), { expectedCodes, reject, resolve });
        return;
      }

      this.pending.push({ expectedCodes, reject, resolve });
      this.drainResponses();
    });
  }

  writeData(message) {
    this.socket.write(`${message.replace(/\r?\n\./g, "\r\n..")}\r\n.\r\n`);
    return this.expect([250]);
  }

  async upgradeToTls(config) {
    this.detach();
    const secureSocket = tls.connect({ socket: this.socket, servername: config.host });
    await new Promise((resolve, reject) => {
      secureSocket.once("secureConnect", resolve);
      secureSocket.once("error", reject);
    });
    return new SmtpSession(secureSocket);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.detach();
    this.socket.end();
  }

  detach() {
    this.socket.off("data", this.onData);
    this.socket.off("error", this.onError);
    this.socket.off("close", this.onClose);
  }

  handleData(chunk) {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line) continue;
      this.responseLines.push(line);
      if (/^\d{3}\s/.test(line)) {
        const responseLines = this.responseLines;
        this.responseLines = [];
        this.resolveResponse(responseLines);
      }
    }
  }

  resolveResponse(lines) {
    const current = this.pending.shift();
    if (!current) {
      this.completedResponses.push(lines);
      return;
    }

    this.resolveResponseForPending(lines, current);
  }

  resolveResponseForPending(lines, current) {
    const code = Number(lines.at(-1)?.slice(0, 3));
    if (current.expectedCodes.includes(code)) {
      current.resolve({ code, lines });
      return;
    }

    current.reject(new Error(`SMTP returned ${code}: ${lines.join(" ")}`));
  }

  drainResponses() {
    if (!this.responseLines.length) return;
    const finalIndex = this.responseLines.findIndex((line) => /^\d{3}\s/.test(line));
    if (finalIndex === -1) return;
    const lines = this.responseLines.splice(0, finalIndex + 1);
    this.resolveResponse(lines);
  }

  rejectPending(error) {
    while (this.pending.length) {
      this.pending.shift().reject(error);
    }
  }
}

function encodeHeader(value) {
  return String(value || "").replace(/\r?\n/g, " ");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractEmailAddress(value) {
  const match = String(value || "").match(/<([^>]+)>/);
  return (match ? match[1] : value).trim();
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}
