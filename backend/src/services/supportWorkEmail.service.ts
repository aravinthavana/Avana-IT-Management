import nodemailer from 'nodemailer';
import { getGraphAppToken } from '../utils/email';

// Explicitly requested summaries only. No ticket links or invitations to portal chat.
export async function sendSupportWorkSummary(to: string, subject: string, text: string): Promise<boolean> {
    const mailbox = process.env.SMTP_FROM || process.env.SMTP_USER;
    const auth = await getGraphAppToken();
    if (auth.token && mailbox) {
        try {
            const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`, {
                method: 'POST', signal: AbortSignal.timeout(15000),
                headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: { subject: `IT support update: ${subject}`, body: { contentType: 'Text', content: text }, toRecipients: [{ emailAddress: { address: to } }] }, saveToSentItems: true })
            });
            if (response.ok) return true;
        } catch { /* Try the configured SMTP transport. */ }
    }
    if (!process.env.SMTP_HOST || !mailbox) return false;
    try {
        const port = Number(process.env.SMTP_PORT || 587);
        const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, connectionTimeout: 10000, socketTimeout: 15000 });
        await transport.sendMail({ from: mailbox, to, subject: `IT support update: ${subject}`, text });
        return true;
    } catch { return false; }
}
