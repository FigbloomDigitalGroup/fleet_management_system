import nodemailer from "nodemailer";

let transporterPromise = null;

// Uses real SMTP credentials from env when present; otherwise falls back to
// an auto-generated Ethereal test inbox so email sending works out of the
// box in dev without requiring a real provider.
async function getTransporter() {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    if (process.env.SMTP_HOST) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
    }

    const testAccount = await nodemailer.createTestAccount();
    console.log(`[mailer] No SMTP_HOST set — using an Ethereal test inbox (${testAccount.user})`);
    return nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  })();

  return transporterPromise;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Fleet alert notification — sent to the recipients a company picked in
// its alert settings, for the alert types it opted into.
export async function sendAlertEmail(recipients, { companyName, plateNumber, typeLabel, message }) {
  if (!recipients.length) return null;
  const transporter = await getTransporter();
  const subject = `[${companyName || "FIGBLOOM FLEET"}] ${typeLabel}${plateNumber ? ` — ${plateNumber}` : ""}`;
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || '"FIGBLOOM FLEET" <no-reply@figbloomfleet.com>',
    to: recipients.join(", "),
    subject,
    text: `${typeLabel}${plateNumber ? ` (${plateNumber})` : ""}: ${message}`,
    html: `<p><strong>${escapeHtml(typeLabel)}</strong>${plateNumber ? ` — ${escapeHtml(plateNumber)}` : ""}</p><p>${escapeHtml(message)}</p>`,
  });
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) console.log(`[mailer] Alert preview: ${previewUrl}`);
  return info;
}

// ---------------------------------------------------------------------------
// Account emails (welcome, approval, password reset) — a shared branded layout (logo green header, orange button).

const FROM = () => process.env.SMTP_FROM || '"FIGBLOOM FLEET" <no-reply@figbloomfleet.com>';
export const frontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");

// `paragraphs` go above the button and `after` below it; both are HTML, so
// anything user-supplied in them must already be escaped.
function layout({ heading, paragraphs, button, after = [] }) {
  const para = (p) => `<p style="margin:0 0 14px;line-height:1.5">${p}</p>`;
  const body = paragraphs.map(para).join("");
  const cta = button
    ? `<p style="margin:22px 0"><a href="${button.href}" style="background:#ff8a12;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:600;display:inline-block">${escapeHtml(button.label)}</a></p>`
    : "";
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f6f5;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden">
    <div style="background:#0e4f27;color:#ffffff;padding:18px 24px;font-size:18px;font-weight:700;letter-spacing:.02em">FIGBLOOM FLEET</div>
    <div style="padding:24px;color:#1f2937;font-size:15px">
      <h2 style="margin:0 0 16px;font-size:20px;color:#0e4f27">${escapeHtml(heading)}</h2>
      ${body}${cta}${after.map(para).join("")}
    </div>
  </div>
</div>`;
}

async function send({ to, subject, heading, paragraphs, button, after, text }) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: FROM(),
    to,
    subject,
    text,
    html: layout({ heading, paragraphs, button, after }),
  });
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) console.log(`[mailer] Preview: ${previewUrl}`);
  return info;
}

// New company registered — to its owner. `pending` when the platform
// requires manual approval before anyone can sign in.
export function sendCompanyWelcomeEmail(to, { ownerName, companyName, pending }) {
  const login = `${frontendUrl()}/login`;
  const next = pending
    ? "Your account is now waiting for approval by the FIGBLOOM FLEET team. We'll email you as soon as it's approved — usually within one working day."
    : "Your account is ready. Sign in to add your vehicles and drivers and start tracking.";
  return send({
    to,
    subject: `Welcome to FIGBLOOM FLEET, ${companyName}`,
    heading: `Welcome, ${ownerName}!`,
    paragraphs: [`Thanks for registering <strong>${escapeHtml(companyName)}</strong> on FIGBLOOM FLEET.`, next],
    button: pending ? null : { label: "Sign in", href: login },
    text: `Welcome to FIGBLOOM FLEET, ${ownerName}. ${next}${pending ? "" : ` Sign in: ${login}`}`,
  });
}

// A pending company was approved — to its owner(s).
export function sendCompanyApprovedEmail(to, { companyName }) {
  const login = `${frontendUrl()}/login`;
  return send({
    to,
    subject: `${companyName} is approved — you can sign in now`,
    heading: "Your account is approved",
    paragraphs: [
      `Good news — <strong>${escapeHtml(companyName)}</strong> has been approved on FIGBLOOM FLEET.`,
      "Sign in to add your vehicles and drivers and start tracking your fleet.",
    ],
    button: { label: "Sign in", href: login },
    text: `${companyName} has been approved on FIGBLOOM FLEET. Sign in: ${login}`,
  });
}

// A company added this person as an admin or driver. The link lets them set
// their own password; drivers also get the app download.
export function sendUserWelcomeEmail(to, { fullName, companyName, role, setPasswordLink, validDays }) {
  const isDriver = role === "DRIVER";
  const login = `${frontendUrl()}/login`;
  const app = `${frontendUrl()}/downloads/fig-fleet-driver.apk`;
  const next = isDriver
    ? `Then install the driver app on your Android phone — <a href="${app}">download the FIGBLOOM FLEET app</a> — and sign in with this email address.`
    : `Then sign in on the web dashboard at <a href="${login}">${escapeHtml(login)}</a>.`;
  return send({
    to,
    subject: `You've been added to ${companyName} on FIGBLOOM FLEET`,
    heading: `Welcome, ${fullName}!`,
    paragraphs: [
      `<strong>${escapeHtml(companyName)}</strong> has added you to FIGBLOOM FLEET as ${isDriver ? "a driver" : "an admin"}.`,
      `Set your own password to get started — the link works for ${validDays} days.`,
    ],
    button: { label: "Set your password", href: setPasswordLink },
    after: [next],
    text: `${companyName} has added you to FIGBLOOM FLEET. Set your password (link valid ${validDays} days): ${setPasswordLink} — then ${
      isDriver ? `install the driver app: ${app}` : `sign in: ${login}`
    }`,
  });
}

// Forgot-password link (from POST /api/auth/forgot-password), valid 30 minutes.
export function sendPasswordResetEmail(email, resetLink) {
  return send({
    to: email,
    subject: "Reset your FIGBLOOM FLEET password",
    heading: "Reset your password",
    paragraphs: ["Someone asked to reset the password for this FIGBLOOM FLEET account. The link below works for 30 minutes."],
    button: { label: "Reset password", href: resetLink },
    after: ["If you didn't ask for this, you can ignore this email — your password stays the same."],
    text: `Reset your FIGBLOOM FLEET password (link valid 30 minutes): ${resetLink}
If you didn't ask for this, ignore this email.`,
  });
}
