import nodemailer from 'nodemailer';
import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { OtpChallenge } from './models.js';

export async function createOtpChallenge(mobile, purpose) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const codeHash = await bcrypt.hash(code, 10);
  await OtpChallenge.deleteMany({ mobile, purpose });
  await OtpChallenge.create({ mobile, purpose, codeHash, expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
  if (process.env.NODE_ENV !== 'production') return { developmentCode: code };
  const message = `Your ${config.companyName} verification code is ${code}. It expires in 5 minutes.`;
  if (process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID) {
    const response = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: { authkey: process.env.MSG91_AUTH_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ template_id: process.env.MSG91_TEMPLATE_ID, recipients: [{ mobiles: mobile, OTP: code }] })
    });
    if (!response.ok) throw new Error('The OTP provider could not send the verification code.');
  } else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
    const payload = new URLSearchParams({ To: `+${mobile}`, From: process.env.TWILIO_FROM, Body: message });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: payload
    });
    if (!response.ok) throw new Error('The OTP provider could not send the verification code.');
  } else {
    throw new Error('Configure MSG91 or Twilio to send verification codes in production.');
  }
  return {};
}

export async function verifyOtpChallenge(mobile, purpose, code) {
  const challenge = await OtpChallenge.findOne({ mobile, purpose, expiresAt: { $gt: new Date() } });
  if (!challenge || challenge.attempts >= 5) return false;
  if (!(await bcrypt.compare(code, challenge.codeHash))) {
    challenge.attempts += 1;
    await challenge.save();
    return false;
  }
  await challenge.deleteOne();
  return true;
}

export async function notifyBackOffice(subject, message) {
  if (!config.backOfficeEmails.length) {
    console.info(JSON.stringify({ level: 'info', event: 'notification', subject, message }));
    return;
  }
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) {
    console.warn('Back-office notification skipped: configure SMTP_HOST and SMTP_FROM.');
    return;
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined
  });
  await transport.sendMail({ from: process.env.SMTP_FROM, to: config.backOfficeEmails, subject, text: message });
}

export async function notifyEngineerAssignment({ mobile, engineerName, ticketNumber, machineCode, issueCategory }) {
  const publicUrl = process.env.PUBLIC_APP_URL || config.publicUrl;
  const message = `Hi ${engineerName}, service request ${ticketNumber} (${issueCategory}) for machine ${machineCode} is assigned to you. Verify at ${publicUrl}/engineer to view it and update its status.`;
  const normalizedMobile = /^\d{10}$/.test(mobile) ? `+91${mobile}` : `+${mobile}`;
  const whatsappNumber = /^\d{10}$/.test(mobile) ? `91${mobile}` : mobile.replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  try {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
      const payload = new URLSearchParams({ To: normalizedMobile, From: process.env.TWILIO_FROM, Body: message });
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
        body: payload
      });
      if (!response.ok) throw new Error(`SMS provider returned HTTP ${response.status}.`);
      return { sent: true };
    }
    if (process.env.MSG91_AUTH_KEY && process.env.MSG91_ASSIGNMENT_TEMPLATE_ID) {
      const response = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: { authkey: process.env.MSG91_AUTH_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({
          template_id: process.env.MSG91_ASSIGNMENT_TEMPLATE_ID,
          recipients: [{
            mobiles: normalizedMobile.replace('+', ''),
            engineer_name: engineerName,
            ticket_number: ticketNumber,
            machine_code: machineCode,
            issue_category: issueCategory,
            portal_url: `${publicUrl}/engineer`
          }]
        })
      });
      if (!response.ok) throw new Error(`MSG91 returned HTTP ${response.status}.`);
      return { sent: true };
    }
    console.warn(`Engineer assignment SMS not sent to ${normalizedMobile}: configure Twilio or MSG91_ASSIGNMENT_TEMPLATE_ID.`);
    return { sent: false, message: 'SMS is not configured. Send the assignment link to the engineer using WhatsApp.', whatsappUrl };
  } catch (error) {
    console.error(`Engineer assignment SMS failed for ${ticketNumber}: ${error.message}`);
    return { sent: false, message: 'The ticket was assigned, but SMS failed. Send the assignment link to the engineer using WhatsApp.', whatsappUrl };
  }
}

export const sendCustomerConfirmation = async (ticketNumber, mobile) => {
  console.info(JSON.stringify({ level: 'info', event: 'customer_confirmation_hook', ticketNumber, mobile }));
};
