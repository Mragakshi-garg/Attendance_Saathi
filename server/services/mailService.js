'use strict';

const nodemailer = require('nodemailer');

const MAIL_HOST = process.env.MAIL_HOST || 'smtp.gmail.com';
const MAIL_PORT = parseInt(process.env.MAIL_PORT, 10) || 587;
const MAIL_USERNAME = process.env.MAIL_USERNAME;
const MAIL_PASSWORD = process.env.MAIL_PASSWORD;

let transporter = null;

/**
 * Initialise the nodemailer transporter.
 * Falls back to console-logging OTPs when credentials are missing.
 */
function getTransporter() {
  if (transporter) return transporter;

  if (!MAIL_USERNAME || !MAIL_PASSWORD) {
    console.warn('[Mail] No MAIL_USERNAME / MAIL_PASSWORD set — OTPs will be logged to console.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: MAIL_HOST,
    port: MAIL_PORT,
    secure: MAIL_PORT === 465,
    auth: {
      user: MAIL_USERNAME,
      pass: MAIL_PASSWORD,
    },
  });

  return transporter;
}

/**
 * Send an OTP verification email.
 *
 * @param {string} to    — Recipient email
 * @param {string} otp   — Plain-text OTP (6 digits)
 * @returns {Promise<boolean>} true if sent (or logged), false on error
 */
async function sendOTPEmail(to, otp) {
  const transport = getTransporter();

  // ── Fallback: log to console ──────────────────────────────────────────────
  if (!transport) {
    console.log('══════════════════════════════════════════════');
    console.log(`  [Mail-Fallback] OTP for ${to}: ${otp}`);
    console.log('══════════════════════════════════════════════');
    return true;
  }

  // ── Send real email ───────────────────────────────────────────────────────
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin:0;padding:0;background:#0a0a0f;font-family:'Inter',Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 0;">
      <tr>
        <td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,rgba(30,30,50,0.95),rgba(20,20,35,0.98));border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px;">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <div style="width:56px;height:56px;background:linear-gradient(135deg,#7c3aed,#a855f7);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;">
                  <span style="font-size:24px;font-weight:800;color:#fff;">F</span>
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="color:#ffffff;font-size:22px;font-weight:700;padding-bottom:8px;">
                Verify Your Email
              </td>
            </tr>
            <tr>
              <td align="center" style="color:rgba(255,255,255,0.6);font-size:14px;padding-bottom:32px;">
                Use the code below to complete your FaceAttend registration.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:32px;">
                <div style="background:rgba(124,58,237,0.12);border:1px solid rgba(124,58,237,0.3);border-radius:12px;padding:20px 40px;display:inline-block;">
                  <span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#a855f7;">${otp}</span>
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="color:rgba(255,255,255,0.4);font-size:12px;padding-bottom:8px;">
                This code expires in <strong style="color:rgba(255,255,255,0.6);">10 minutes</strong>.
              </td>
            </tr>
            <tr>
              <td align="center" style="color:rgba(255,255,255,0.3);font-size:11px;">
                If you didn't request this, you can safely ignore this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;

  try {
    await transport.sendMail({
      from: `"FaceAttend" <${MAIL_USERNAME}>`,
      to,
      subject: 'Your FaceAttend Verification Code',
      html,
    });
    console.log(`[Mail] OTP sent to ${to}`);
    return true;
  } catch (err) {
    console.error(`[Mail] Failed to send OTP to ${to}:`, err.message);
    // Fallback: log OTP so the user isn't locked out
    console.log(`[Mail-Fallback] OTP for ${to}: ${otp}`);
    return false;
  }
}

module.exports = { sendOTPEmail };
