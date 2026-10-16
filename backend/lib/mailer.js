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

export async function sendPasswordResetEmail(email, resetLink) {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || '"FIGBLOOM FLEET" <no-reply@figbloomfleet.com>',
    to: email,
    subject: "Reset your FIGBLOOM FLEET password",
    text: `Reset your password by visiting this link (expires in 30 minutes): ${resetLink}`,
    html: `
      <p>Someone requested a password reset for this account.</p>
      <p><a href="${resetLink}">Click here to reset your password</a> (expires in 30 minutes).</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) console.log(`[mailer] Preview: ${previewUrl}`);

  return info;
}
