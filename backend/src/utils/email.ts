import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

// --- Backend Email Helper (Microsoft Graph API Certificate/Secret OAuth2 & Nodemailer SMTP Fallback) ---
export function cleanPem(raw?: string): string | undefined {
    if (!raw) return undefined;
    let cleaned = raw.trim();
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
        cleaned = cleaned.slice(1, -1);
    }
    cleaned = cleaned.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
    return cleaned.trim();
}

export async function getGraphAppToken(): Promise<{ token: string | null; error?: string; method?: string }> {
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;

    // 1. Check for Certificate-Based Authentication (Enterprise Standard)
    let privateKeyPem = cleanPem(process.env.AZURE_CLIENT_CERTIFICATE_PRIVATE_KEY);
    let certPem = cleanPem(process.env.AZURE_CLIENT_CERTIFICATE);

    // Fallback to local files if present
    if (!privateKeyPem) {
        const keyPath = path.join(process.cwd(), 'avana-private-key.pem');
        if (fs.existsSync(keyPath)) {
            try { privateKeyPem = cleanPem(fs.readFileSync(keyPath, 'utf8')); } catch (e) {}
        }
    }
    if (!certPem) {
        const certPath = path.join(process.cwd(), 'avana-certificate.crt');
        if (fs.existsSync(certPath)) {
            try { certPem = cleanPem(fs.readFileSync(certPath, 'utf8')); } catch (e) {}
        }
    }

    if (tenantId && clientId && privateKeyPem) {
        try {
            // Compute base64url SHA-1 thumbprint (x5t)
            let x5t: string | undefined;
            if (process.env.AZURE_CLIENT_CERTIFICATE_THUMBPRINT) {
                const rawThumb = process.env.AZURE_CLIENT_CERTIFICATE_THUMBPRINT.trim();
                if (/^[0-9a-fA-F]{40}$/.test(rawThumb)) {
                    x5t = Buffer.from(rawThumb, 'hex').toString('base64url');
                } else {
                    x5t = rawThumb;
                }
            } else if (certPem) {
                const certBase64 = certPem.replace(/-----[^\n]+-----/g, '').replace(/\s+/g, '');
                const certDer = Buffer.from(certBase64, 'base64');
                x5t = crypto.createHash('sha1').update(certDer).digest('base64url');
            }

            if (!x5t) {
                console.warn('[Graph Email] Could not determine x5t thumbprint from certificate.');
            } else {
                const now = Math.floor(Date.now() / 1000);
                const clientAssertion = jwt.sign(
                    {
                        aud: `https://login.microsoftonline.com/${tenantId}/v2.0`,
                        exp: now + 300,
                        iss: clientId,
                        jti: crypto.randomUUID(),
                        nbf: now - 10,
                        sub: clientId
                    },
                    privateKeyPem,
                    {
                        algorithm: 'RS256',
                        header: {
                            alg: 'RS256',
                            typ: 'JWT',
                            x5t: x5t
                        }
                    }
                );

                const params = new URLSearchParams();
                params.append('client_id', clientId);
                params.append('scope', 'https://graph.microsoft.com/.default');
                params.append('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
                params.append('client_assertion', clientAssertion);
                params.append('grant_type', 'client_credentials');

                const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                    signal: AbortSignal.timeout(8000)
                });

                if (res.ok) {
                    const data = await res.json();
                    console.log('[Graph Email] Successfully acquired Microsoft Graph token via Certificate Authentication!');
                    return { token: data.access_token, method: 'Certificate' };
                } else {
                    const errText = await res.text();
                    console.error('[Graph Email] Certificate Token acquisition failed:', errText);
                    return { token: null, error: `Certificate token error: ${errText}`, method: 'Certificate' };
                }
            }
        } catch (certErr: any) {
            console.error('[Graph Email] Error during Certificate auth:', certErr.message || certErr);
            return { token: null, error: `Certificate exception: ${certErr.message || certErr}`, method: 'Certificate' };
        }
    }

    // 2. Fallback to Client Secret if available
    if (tenantId && clientId && clientSecret) {
        try {
            const params = new URLSearchParams();
            params.append('client_id', clientId);
            params.append('scope', 'https://graph.microsoft.com/.default');
            params.append('client_secret', clientSecret);
            params.append('grant_type', 'client_credentials');

            const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
                signal: AbortSignal.timeout(8000)
            });

            if (res.ok) {
                const data = await res.json();
                return { token: data.access_token, method: 'ClientSecret' };
            } else {
                const errText = await res.text();
                console.error('[Graph Email] Secret Token acquisition failed:', errText);
                return { token: null, error: `Secret token error: ${errText}`, method: 'ClientSecret' };
            }
        } catch (err: any) {
            console.error('[Graph Email] Error requesting app token via secret:', err.message || err);
            return { token: null, error: `Secret exception: ${err.message || err}`, method: 'ClientSecret' };
        }
    }

    return { token: null, error: 'No certificate private key or client secret configured' };
}

export async function sendTicketEmail(options: {
    toEmail: string;
    toName: string;
    ticketId: number;
    ticketSubject: string;
    senderName: string;
    senderEmail?: string;  // actual sender's email for Reply-To
    messageBody: string;
    category?: string;
    priority?: string;
    status?: string;
    assetName?: string;
    isReply: boolean;
}): Promise<{ success: boolean; method?: string; error?: string }> {
    const fromMail = process.env.SMTP_FROM || process.env.SMTP_USER || 'itsupport@avanamedical.com';
    const portalUrl = process.env.FRONTEND_URL || 'https://avana-it-management.vercel.app';
    const ticketUrl = `${portalUrl}/tickets/${options.ticketId}`;
    const trackingTag = `[AVANA-TICKET #${options.ticketId}]`;
    const cleanSubject = (options.ticketSubject || 'Support Ticket').replace(/\[AVANA-TICKET\s*#\d+\]/gi, '').replace(/^(RE:\s*)+/i, '').trim();
    const subject = options.isReply ? `RE: ${trackingTag} ${cleanSubject}` : `${trackingTag} ${cleanSubject}`;

    // Outlook/Exchange threads by Thread-Index — a base64 value where replies append 5 bytes
    // Base: sha1-like 27-byte header derived from ticketId; replies append 5 null bytes
    const baseThreadIndex = Buffer.alloc(27);
    baseThreadIndex.writeUInt32BE(Math.floor(Date.UTC(2024, 0, 1) / 10000000), 0); // FILETIME hi
    baseThreadIndex.writeUInt32BE(options.ticketId * 1000, 4); // FILETIME lo (stable per ticket)
    // GUID bytes seeded from ticketId
    for (let i = 8; i < 27; i++) baseThreadIndex[i] = (options.ticketId * (i + 1)) & 0xff;
    const replyBytes = options.isReply ? Buffer.alloc(5) : Buffer.alloc(0);
    const threadIndex = Buffer.concat([baseThreadIndex, replyBytes]).toString('base64');

    const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f8fafc;margin:0;padding:20px;color:#1e293b}
  .container{max-width:600px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,.1)}
  .header{background:#0f172a;color:#fff;padding:24px;text-align:left}
  .badge{display:inline-block;background:#dc2626;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:9999px;text-transform:uppercase;letter-spacing:.05em}
  .title{font-size:20px;font-weight:800;margin:12px 0 4px 0;color:#fff}
  .meta{font-size:12px;color:#94a3b8}
  .content{padding:24px;line-height:1.6;font-size:14px;color:#334155}
  .message-box{background:#f1f5f9;border-left:4px solid #dc2626;padding:16px;border-radius:8px;margin:16px 0;font-size:14px;white-space:pre-wrap}
  .cta{text-align:center;padding:8px 0 20px}
  .btn{display:inline-block;background:#0f172a;color:#fff !important;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px}
  .footer{padding:12px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <span class="badge">${options.category || 'IT Support'}</span>
    <div class="title">${options.isReply ? 'New Response on Your Ticket' : 'New Support Ticket Received'}</div>
    <div class="meta">Ticket #${options.ticketId} &bull; From: ${options.senderName}${options.senderEmail ? ` &lt;${options.senderEmail}&gt;` : ''}</div>
  </div>
  <div class="content">
    <p>Hello <strong>${options.toName}</strong>,</p>
    <p>${options.isReply ? `<strong>${options.senderName}</strong> has posted a reply:` : 'A new support ticket has been submitted:'}</p>
    <div class="message-box">${options.messageBody.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    ${options.priority ? `<p><strong>Priority:</strong> ${options.priority}</p>` : ''}
    ${options.status ? `<p><strong>Status:</strong> ${options.status}</p>` : ''}
    ${options.assetName ? `<p><strong>Related Asset:</strong> ${options.assetName}</p>` : ''}
  </div>
  <div class="cta">
    <a href="${ticketUrl}" class="btn">&#128172; View &amp; Reply in Portal</a>
    <p style="font-size: 12px; color: #64748b; margin-top: 14px; margin-bottom: 0; line-height: 1.4;">
      Please do not reply directly to this email. Replies to this address are not monitored.<br/>To reply or attach screenshots/files, click the button above to respond in the IT Portal.
    </p>
  </div>
  <div class="footer">
    Avana IT Management &bull; Ticket ${trackingTag}
  </div>
</div>
</body>
</html>`;

    function recordLog(status: 'SUCCESS' | 'FAILED', method?: string, error?: string) {
        if (status === 'SUCCESS') {
            console.log(`[Email] Ticket #${options.ticketId} notification sent via ${method || 'dispatcher'}`);
        } else {
            console.warn(`[Email] Ticket #${options.ticketId} notification failed via ${method || 'dispatcher'}: ${error || 'Unknown error'}`);
        }
    }

    // 1. Try Microsoft Graph API
    const authResult = await getGraphAppToken();
    const threadMsgId = `<ticket-${options.ticketId}@avanamedical.com>`;
    const internetMessageHeaders = options.isReply ? [
        { name: 'In-Reply-To', value: threadMsgId },
        { name: 'References', value: threadMsgId },
        { name: 'Thread-Topic', value: `${trackingTag} ${cleanSubject}` },
        { name: 'Thread-Index', value: threadIndex }
    ] : [
        { name: 'Thread-Topic', value: `${trackingTag} ${cleanSubject}` },
        { name: 'Thread-Index', value: threadIndex }
    ];

    if (authResult.token) {
        try {
            const sendViaGraph = async (sendAsMailbox: string) => {
                const graphPayload = {
                    message: {
                        subject,
                        body: {
                            contentType: 'HTML',
                            content: htmlContent
                        },
                        toRecipients: [
                            {
                                emailAddress: {
                                    address: options.toEmail,
                                    name: options.toName
                                }
                            }
                        ],
                        internetMessageHeaders
                    },
                    saveToSentItems: "false"
                };

                return await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sendAsMailbox)}/sendMail`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authResult.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(graphPayload),
                    signal: AbortSignal.timeout(10000)
                });
            };

            let graphRes = await sendViaGraph(fromMail);

            // If shared mailbox failed with 403 / 404, try sending via the admin mailbox
            const adminFallback = process.env.SMTP_USER || 'aravinth@avanamedical.com';
            if (!graphRes.ok && fromMail !== adminFallback) {
                console.warn(`[Email] Sending as ${fromMail} returned ${graphRes.status}. Retrying as ${adminFallback}...`);
                const retryRes = await sendViaGraph(adminFallback);
                if (retryRes.ok || retryRes.status === 202) {
                    graphRes = retryRes;
                }
            }

            if (graphRes.ok || graphRes.status === 202) {
                console.log(`[Email] Successfully dispatched ticket #${options.ticketId} email via Microsoft Graph API -> ${options.toEmail}`);
                recordLog('SUCCESS', `Microsoft Graph API (${authResult.method})`);
                return { success: true, method: `Microsoft Graph API (${authResult.method})` };
            } else {
                const errText = await graphRes.text();
                console.warn(`[Email] Graph API sendMail failed (${graphRes.status}):`, errText);
                recordLog('FAILED', `Microsoft Graph API (${authResult.method})`, `Graph API (${graphRes.status}): ${errText}`);
                return { success: false, error: `Graph API (${graphRes.status}): ${errText}`, method: `Microsoft Graph API (${authResult.method})` };
            }
        } catch (graphErr: any) {
            console.warn('[Email] Graph API exception:', graphErr.message || graphErr);
            recordLog('FAILED', 'Microsoft Graph API', `Graph API exception: ${graphErr.message || graphErr}`);
            return { success: false, error: `Graph API exception: ${graphErr.message || graphErr}`, method: 'Microsoft Graph API' };
        }
    }

    // 2. Nodemailer SMTP Fallback (Only if no Graph Token was available)
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (smtpUser && smtpPass) {
        try {
            const transporter = nodemailer.createTransport({
                host: 'smtp.office365.com',
                port: 587,
                secure: false, // STARTTLS on port 587
                requireTLS: true,
                connectionTimeout: 4000,
                greetingTimeout: 4000,
                socketTimeout: 4000,
                auth: { user: smtpUser, pass: smtpPass },
                tls: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
            });

            try {
                await transporter.sendMail({
                    from: `"${options.senderName} via IT Support" <${fromMail}>`,
                    to: `"${options.toName}" <${options.toEmail}>`,
                    replyTo: fromMail,
                    subject,
                    html: htmlContent,
                    headers: {
                        'Thread-Topic': `${trackingTag} ${cleanSubject}`,
                        ...(options.isReply ? {
                            'In-Reply-To': threadMsgId,
                            'References': threadMsgId
                        } : {
                            'Message-ID': threadMsgId
                        })
                    }
                });
                console.log(`[Email] Successfully dispatched ticket #${options.ticketId} email via SMTP (${fromMail} -> ${options.toEmail})`);
                recordLog('SUCCESS', 'SMTP (Direct)');
                return { success: true, method: 'SMTP (Direct)' };
            } catch (sendAsErr: any) {
                if (fromMail !== smtpUser) {
                    console.warn(`[Email] Failed to send as ${fromMail} (${sendAsErr.message}). Retrying from ${smtpUser}...`);
                    await transporter.sendMail({
                        from: `"${options.senderName} via IT Support" <${smtpUser}>`,
                        to: `"${options.toName}" <${options.toEmail}>`,
                        replyTo: smtpUser,
                        subject,
                        html: htmlContent,
                        headers: {
                            'Thread-Topic': `${trackingTag} ${cleanSubject}`,
                            ...(options.isReply ? {
                                'In-Reply-To': threadMsgId,
                                'References': threadMsgId
                            } : {
                                'Message-ID': threadMsgId
                            })
                        }
                    });
                    console.log(`[Email] Successfully dispatched ticket #${options.ticketId} email via SMTP fallback (${smtpUser} -> ${options.toEmail})`);
                    recordLog('SUCCESS', 'SMTP (User Fallback)');
                    return { success: true, method: 'SMTP (User Fallback)' };
                }
                throw sendAsErr;
            }
        } catch (smtpErr: any) {
            console.error('[Email] Nodemailer SMTP send error:', smtpErr.message || smtpErr);
            recordLog('FAILED', 'SMTP', `SMTP Error: ${smtpErr.message}`);
            return { success: false, error: `SMTP Error: ${smtpErr.message}`, method: 'SMTP' };
        }
    }

    const lastError = authResult.error || 'No valid email configuration (Certificate or SMTP) found.';
    console.warn(`[Email] No email dispatched for ticket #${options.ticketId}. Reason: ${lastError}`);
    recordLog('FAILED', undefined, lastError);
    return { success: false, error: lastError };
}

export async function sendAssetRequestEmail(options: {
    toEmail: string;
    toName: string;
    requestId: number;
    requestType: string;
    category: string;
    priority?: string;
    status: string;
    actionTitle: string;
    actionMessage: string;
    actorName: string;
    description?: string;
    rejectionReason?: string;
    allocatedAssetName?: string;
    allocatedAssetSerial?: string;
    remarks?: string;
}): Promise<{ success: boolean; method?: string; error?: string }> {
    const fromMail = process.env.SMTP_FROM || process.env.SMTP_USER || 'itsupport@avanamedical.com';
    const portalUrl = process.env.FRONTEND_URL || 'https://avana-it-management.vercel.app';
    const requestUrl = `${portalUrl}/requests`;
    const trackingTag = `[AVANA-REQUEST #${options.requestId}]`;
    const subject = `${trackingTag} ${options.actionTitle} - ${options.category} (${options.requestType})`;

    const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f8fafc;margin:0;padding:20px;color:#1e293b}
  .container{max-width:600px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,.1)}
  .header{background:#0f172a;color:#fff;padding:24px;text-align:left}
  .badge{display:inline-block;background:#dc2626;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:9999px;text-transform:uppercase;letter-spacing:.05em}
  .status-badge{display:inline-block;background:#334155;color:#f8fafc;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;margin-left:6px}
  .title{font-size:20px;font-weight:800;margin:12px 0 4px 0;color:#fff}
  .meta{font-size:12px;color:#94a3b8}
  .content{padding:24px;line-height:1.6;font-size:14px;color:#334155}
  .info-table{width:100%;border-collapse:collapse;margin:16px 0;background:#f8fafc;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0}
  .info-table td{padding:10px 14px;font-size:13px;border-bottom:1px solid #e2e8f0}
  .info-table td.label{font-weight:700;color:#64748b;width:35%}
  .message-box{background:#f1f5f9;border-left:4px solid #dc2626;padding:14px 16px;border-radius:8px;margin:16px 0;font-size:14px}
  .rejection-box{background:#fef2f2;border-left:4px solid #ef4444;padding:14px 16px;border-radius:8px;margin:16px 0;font-size:14px;color:#991b1b}
  .allocated-box{background:#f0fdf4;border-left:4px solid #16a34a;padding:14px 16px;border-radius:8px;margin:16px 0;font-size:14px;color:#166534}
  .cta{text-align:center;padding:12px 0 20px}
  .btn{display:inline-block;background:#0f172a;color:#fff !important;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px}
  .footer{padding:12px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <span class="badge">${options.requestType || 'Asset Request'}</span>
    <span class="status-badge">${options.status}</span>
    <div class="title">${options.actionTitle}</div>
    <div class="meta">Request #REQ-${options.requestId.toString().padStart(4, '0')} &bull; Updated by: ${options.actorName}</div>
  </div>
  <div class="content">
    <p>Hello <strong>${options.toName}</strong>,</p>
    <p>${options.actionMessage}</p>

    <table class="info-table">
      <tr><td class="label">Request ID:</td><td><strong>REQ-${options.requestId.toString().padStart(4, '0')}</strong></td></tr>
      <tr><td class="label">Category:</td><td>${options.category}</td></tr>
      <tr><td class="label">Request Type:</td><td>${options.requestType}</td></tr>
      <tr><td class="label">Priority:</td><td>${options.priority || 'Medium'}</td></tr>
      <tr><td class="label">Current Status:</td><td><strong>${options.status}</strong></td></tr>
    </table>

    ${options.rejectionReason ? `
      <div class="rejection-box">
        <strong>Reason for Rejection:</strong><br/>
        ${options.rejectionReason.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </div>` : ''}

    ${options.allocatedAssetName ? `
      <div class="allocated-box">
        <strong style="font-size:15px;">&#10004; Allocated Device:</strong><br/>
        <strong>${options.allocatedAssetName}</strong><br/>
        <span style="font-size:13px;">Serial Number: <code>${options.allocatedAssetSerial || 'N/A'}</code></span><br/>
        <p style="margin:8px 0 0 0; font-size:12px;"><strong>Action Required:</strong> A digital handover form has been generated. Please log in to the IT Portal to inspect and digitally sign off on this asset.</p>
      </div>` : ''}

    ${options.description ? `
      <p style="margin-bottom:4px; font-weight:600; font-size:13px; color:#64748b;">Original Request Description:</p>
      <div class="message-box">${options.description.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}

    ${options.remarks ? `
      <p style="margin-bottom:4px; font-weight:600; font-size:13px; color:#64748b;">Remarks:</p>
      <div class="message-box">${options.remarks.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
  </div>
  <div class="cta">
    <a href="${requestUrl}" class="btn">View Asset Request in Portal</a>
    <p style="font-size: 12px; color: #64748b; margin-top: 14px; margin-bottom: 0;">
      Replies to this automated notification are not monitored. Please use the IT Management portal.
    </p>
  </div>
  <div class="footer">
    Avana IT Management &bull; Asset Lifecycle Notification
  </div>
</div>
</body>
</html>`;

    function recordLog(status: 'SUCCESS' | 'FAILED', method?: string, error?: string) {
        if (status === 'SUCCESS') {
            console.log(`[Email] Request #${options.requestId} notification sent via ${method || 'dispatcher'} to ${options.toEmail}`);
        } else {
            console.warn(`[Email] Request #${options.requestId} notification failed via ${method || 'dispatcher'} to ${options.toEmail}: ${error || 'Unknown error'}`);
        }
    }

    // 1. Try Microsoft Graph API
    const authResult = await getGraphAppToken();
    if (authResult.token) {
        try {
            const sendViaGraph = async (sendAsMailbox: string) => {
                const graphPayload = {
                    message: {
                        subject,
                        body: {
                            contentType: 'HTML',
                            content: htmlContent
                        },
                        toRecipients: [
                            {
                                emailAddress: {
                                    address: options.toEmail,
                                    name: options.toName
                                }
                            }
                        ]
                    },
                    saveToSentItems: "false"
                };

                return await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sendAsMailbox)}/sendMail`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authResult.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(graphPayload),
                    signal: AbortSignal.timeout(10000)
                });
            };

            let graphRes = await sendViaGraph(fromMail);
            const adminFallback = process.env.SMTP_USER || 'aravinth@avanamedical.com';
            if (!graphRes.ok && fromMail !== adminFallback) {
                const retryRes = await sendViaGraph(adminFallback);
                if (retryRes.ok || retryRes.status === 202) {
                    graphRes = retryRes;
                }
            }

            if (graphRes.ok || graphRes.status === 202) {
                recordLog('SUCCESS', `Microsoft Graph API (${authResult.method})`);
                return { success: true, method: `Microsoft Graph API (${authResult.method})` };
            } else {
                const errText = await graphRes.text();
                recordLog('FAILED', `Microsoft Graph API (${authResult.method})`, errText);
            }
        } catch (graphErr: any) {
            recordLog('FAILED', 'Microsoft Graph API', graphErr.message || graphErr);
        }
    }

    // 2. Fallback to Nodemailer SMTP
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (smtpUser && smtpPass) {
        try {
            const transporter = nodemailer.createTransport({
                host: 'smtp.office365.com',
                port: 587,
                secure: false,
                requireTLS: true,
                connectionTimeout: 4000,
                greetingTimeout: 4000,
                socketTimeout: 4000,
                auth: { user: smtpUser, pass: smtpPass },
                tls: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
            });

            await transporter.sendMail({
                from: `"Avana IT Asset Management" <${smtpUser}>`,
                to: `"${options.toName}" <${options.toEmail}>`,
                replyTo: smtpUser,
                subject,
                html: htmlContent
            });
            recordLog('SUCCESS', 'SMTP');
            return { success: true, method: 'SMTP' };
        } catch (smtpErr: any) {
            recordLog('FAILED', 'SMTP', smtpErr.message || smtpErr);
            return { success: false, error: smtpErr.message, method: 'SMTP' };
        }
    }

    return { success: false, error: 'No valid email configuration available' };
}

export async function sendSelfAuditEmail(options: {
    toEmail: string;
    toName: string;
    auditId?: number;
    assetName: string;
    assetIdTag: string;
    actionType: 'ASSIGNED' | 'APPROVED' | 'REJECTED';
    actionTitle: string;
    actionMessage: string;
    dueDate?: string;
    instructions?: string;
    rejectionReason?: string;
    adminRemarks?: string;
}): Promise<{ success: boolean; method?: string; error?: string }> {
    const fromMail = process.env.SMTP_FROM || process.env.SMTP_USER || 'itsupport@avanamedical.com';
    const portalUrl = process.env.FRONTEND_URL || 'https://avana-it-management.vercel.app';
    const trackingTag = `[AVANA-AUDIT]`;
    const subject = `${trackingTag} ${options.actionTitle} - ${options.assetName} (${options.assetIdTag})`;

    const isApproved = options.actionType === 'APPROVED';
    const isRejected = options.actionType === 'REJECTED';

    const headerColor = isRejected ? '#991b1b' : isApproved ? '#166534' : '#0f172a';
    const badgeColor = isRejected ? '#dc2626' : isApproved ? '#16a34a' : '#2563eb';

    const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f8fafc;margin:0;padding:20px;color:#1e293b}
  .container{max-width:600px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,.1)}
  .header{background:${headerColor};color:#fff;padding:24px;text-align:left}
  .badge{display:inline-block;background:${badgeColor};color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:9999px;text-transform:uppercase;letter-spacing:.05em}
  .title{font-size:20px;font-weight:800;margin:12px 0 4px 0;color:#fff}
  .meta{font-size:12px;color:#94a3b8}
  .content{padding:24px;line-height:1.6;font-size:14px;color:#334155}
  .info-table{width:100%;border-collapse:collapse;margin:16px 0;background:#f8fafc;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0}
  .info-table td{padding:10px 14px;font-size:13px;border-bottom:1px solid #e2e8f0}
  .info-table td.label{font-weight:700;color:#64748b;width:35%}
  .message-box{background:#f1f5f9;border-left:4px solid #2563eb;padding:14px 16px;border-radius:8px;margin:16px 0;font-size:14px}
  .rejection-box{background:#fef2f2;border-left:4px solid #ef4444;padding:14px 16px;border-radius:8px;margin:16px 0;font-size:14px;color:#991b1b}
  .success-box{background:#f0fdf4;border-left:4px solid #16a34a;padding:14px 16px;border-radius:8px;margin:16px 0;font-size:14px;color:#166534}
  .cta{text-align:center;padding:12px 0 20px}
  .btn{display:inline-block;background:#0f172a;color:#fff !important;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px}
  .footer{padding:12px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <span class="badge">Equipment Self-Audit</span>
    <div class="title">${options.actionTitle}</div>
    <div class="meta">Asset: ${options.assetName} &bull; Tag: ${options.assetIdTag}</div>
  </div>
  <div class="content">
    <p>Hello <strong>${options.toName}</strong>,</p>
    <p>${options.actionMessage}</p>

    <table class="info-table">
      <tr><td class="label">Device Name:</td><td><strong>${options.assetName}</strong></td></tr>
      <tr><td class="label">Asset ID Tag:</td><td><strong style="font-family:monospace;">${options.assetIdTag}</strong></td></tr>
      ${options.dueDate ? `<tr><td class="label">Completion Deadline:</td><td><strong style="color:#b91c1c;">${options.dueDate}</strong></td></tr>` : ''}
    </table>

    ${options.instructions ? `
      <p style="margin-bottom:4px; font-weight:600; font-size:13px; color:#64748b;">Audit Instructions:</p>
      <div class="message-box">${options.instructions.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}

    ${isApproved ? `
      <div class="success-box">
        <strong>&#10004; Verification Confirmed:</strong><br/>
        Your self-audit submission has been verified and approved by IT Administration.
        ${options.adminRemarks ? `<br/><span style="font-size:12px; margin-top:4px; display:inline-block;">Notes: ${options.adminRemarks}</span>` : ''}
      </div>` : ''}

    ${isRejected && options.rejectionReason ? `
      <div class="rejection-box">
        <strong>Reason for Rejection:</strong><br/>
        ${options.rejectionReason.replace(/</g, '&lt;').replace(/>/g, '&gt;')}<br/>
        <span style="font-size:12px; margin-top:6px; display:inline-block;">Please log in to the portal and resubmit a clear photo and updated condition notes.</span>
      </div>` : ''}
  </div>
  <div class="cta">
    <a href="${portalUrl}" class="btn">Open IT Management Portal</a>
    <p style="font-size: 12px; color: #64748b; margin-top: 14px; margin-bottom: 0;">
      Replies to this automated notification are not monitored. Please use the IT Management portal.
    </p>
  </div>
  <div class="footer">
    Avana IT Management &bull; Asset Lifecycle Compliance
  </div>
</div>
</body>
</html>`;

    function recordLog(status: 'SUCCESS' | 'FAILED', method?: string, error?: string) {
        if (status === 'SUCCESS') {
            console.log(`[Email] SelfAudit notification sent via ${method || 'dispatcher'} to ${options.toEmail}`);
        } else {
            console.warn(`[Email] SelfAudit notification failed via ${method || 'dispatcher'} to ${options.toEmail}: ${error || 'Unknown error'}`);
        }
    }

    // 1. Try Microsoft Graph API
    const authResult = await getGraphAppToken();
    if (authResult.token) {
        try {
            const sendViaGraph = async (sendAsMailbox: string) => {
                const graphPayload = {
                    message: {
                        subject,
                        body: {
                            contentType: 'HTML',
                            content: htmlContent
                        },
                        toRecipients: [
                            {
                                emailAddress: {
                                    address: options.toEmail,
                                    name: options.toName
                                }
                            }
                        ]
                    },
                    saveToSentItems: "false"
                };

                return await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sendAsMailbox)}/sendMail`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authResult.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(graphPayload),
                    signal: AbortSignal.timeout(10000)
                });
            };

            let graphRes = await sendViaGraph(fromMail);
            const adminFallback = process.env.SMTP_USER || 'aravinth@avanamedical.com';
            if (!graphRes.ok && fromMail !== adminFallback) {
                const retryRes = await sendViaGraph(adminFallback);
                if (retryRes.ok || retryRes.status === 202) {
                    graphRes = retryRes;
                }
            }

            if (graphRes.ok || graphRes.status === 202) {
                recordLog('SUCCESS', `Microsoft Graph API (${authResult.method})`);
                return { success: true, method: `Microsoft Graph API (${authResult.method})` };
            } else {
                const errText = await graphRes.text();
                recordLog('FAILED', `Microsoft Graph API (${authResult.method})`, errText);
            }
        } catch (graphErr: any) {
            recordLog('FAILED', 'Microsoft Graph API', graphErr.message || graphErr);
        }
    }

    // 2. Fallback to Nodemailer SMTP
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (smtpUser && smtpPass) {
        try {
            const transporter = nodemailer.createTransport({
                host: 'smtp.office365.com',
                port: 587,
                secure: false,
                requireTLS: true,
                connectionTimeout: 4000,
                greetingTimeout: 4000,
                socketTimeout: 4000,
                auth: { user: smtpUser, pass: smtpPass },
                tls: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
            });

            await transporter.sendMail({
                from: `"Avana IT Asset Management" <${smtpUser}>`,
                to: `"${options.toName}" <${options.toEmail}>`,
                replyTo: smtpUser,
                subject,
                html: htmlContent
            });
            recordLog('SUCCESS', 'SMTP');
            return { success: true, method: 'SMTP' };
        } catch (smtpErr: any) {
            recordLog('FAILED', 'SMTP', smtpErr.message || smtpErr);
            return { success: false, error: smtpErr.message, method: 'SMTP' };
        }
    }

    return { success: false, error: 'No valid email configuration available' };
}

// --- OTP Login Email Helper ---
export async function sendOtpEmail(options: {
    toEmail: string;
    toName: string;
    otp: string;
}): Promise<{ success: boolean; error?: string; method?: string }> {
    const fromMail = process.env.SMTP_FROM || 'itsupport@avanamedical.com';
    const subject = `Your Avana IT Portal Verification Code: ${options.otp}`;

    const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f8fafc;margin:0;padding:24px;color:#1e293b}
  .container{max-width:540px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.05)}
  .header{background:#0f172a;color:#ffffff;padding:28px 24px;text-align:center}
  .badge{display:inline-block;background:#dc2626;color:#ffffff;font-size:11px;font-weight:800;padding:4px 12px;border-radius:9999px;text-transform:uppercase;letter-spacing:.06em}
  .title{font-size:22px;font-weight:800;margin:14px 0 0 0;color:#ffffff;letter-spacing:-0.02em}
  .content{padding:28px 24px;line-height:1.6;font-size:14px;color:#334155}
  .otp-box{background:#f1f5f9;border:2px dashed #cbd5e1;border-radius:12px;padding:20px;text-align:center;margin:24px 0}
  .otp-code{font-size:36px;font-weight:900;letter-spacing:10px;color:#0f172a;font-family:Consolas,monaco,monospace}
  .otp-label{font-size:12px;color:#64748b;font-weight:600;margin-top:6px;text-transform:uppercase;letter-spacing:.05em}
  .warning{font-size:12px;color:#64748b;background:#f8fafc;border-left:4px solid #f59e0b;padding:12px 14px;border-radius:6px;margin:20px 0}
  .footer{padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <span class="badge">Security Authentication</span>
    <div class="title">Avana IT Management</div>
  </div>
  <div class="content">
    <p>Hello <strong>${options.toName}</strong>,</p>
    <p>Use the 6-digit verification code below to sign in to your Avana IT Management workspace:</p>
    <div class="otp-box">
      <div class="otp-code">${options.otp}</div>
      <div class="otp-label">One-Time Verification Code</div>
    </div>
    <div class="warning">
      <strong>Security Notice:</strong> This code is valid for <strong>10 minutes</strong> and can only be used once. Never share this code with anyone. If you did not request this login, please contact IT Support immediately at <a href="mailto:itsupport@avanamedical.com" style="color:#dc2626;text-decoration:none;">itsupport@avanamedical.com</a>.
    </div>
  </div>
  <div class="footer">
    &copy; ${new Date().getFullYear()} Avana Group IT Operations &bull; Automated Security Dispatch
  </div>
</div>
</body>
</html>`;

    // 1. Try Microsoft Graph API with app token
    const authResult = await getGraphAppToken();
    if (authResult.token) {
        try {
            const sendViaGraph = async (sendAsMailbox: string) => {
                const graphPayload = {
                    message: {
                        subject,
                        body: {
                            contentType: 'HTML',
                            content: htmlContent
                        },
                        toRecipients: [
                            {
                                emailAddress: {
                                    address: options.toEmail,
                                    name: options.toName
                                }
                            }
                        ]
                    },
                    saveToSentItems: "false"
                };

                return await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sendAsMailbox)}/sendMail`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authResult.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(graphPayload),
                    signal: AbortSignal.timeout(10000)
                });
            };

            let graphRes = await sendViaGraph(fromMail);
            const adminFallback = process.env.SMTP_USER || 'aravinth@avanamedical.com';
            if (!graphRes.ok && fromMail !== adminFallback) {
                console.warn(`[OTP Email] Sending as ${fromMail} failed (${graphRes.status}). Retrying as ${adminFallback}...`);
                const retryRes = await sendViaGraph(adminFallback);
                if (retryRes.ok || retryRes.status === 202) {
                    graphRes = retryRes;
                }
            }

            if (graphRes.ok || graphRes.status === 202) {
                console.log(`[OTP Email] Successfully dispatched OTP code to ${options.toEmail} via Microsoft Graph API`);
                return { success: true, method: `Microsoft Graph API (${authResult.method})` };
            } else {
                const errText = await graphRes.text();
                console.warn(`[OTP Email] Graph sendMail failed (${graphRes.status}):`, errText);
            }
        } catch (graphErr: any) {
            console.warn('[OTP Email] Graph API exception:', graphErr.message || graphErr);
        }
    }

    // 2. Fallback to Nodemailer SMTP
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (smtpUser && smtpPass) {
        try {
            const transporter = nodemailer.createTransport({
                host: 'smtp.office365.com',
                port: 587,
                secure: false,
                requireTLS: true,
                connectionTimeout: 4000,
                greetingTimeout: 4000,
                socketTimeout: 4000,
                auth: { user: smtpUser, pass: smtpPass },
                tls: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
            });

            await transporter.sendMail({
                from: `"Avana IT Security" <${smtpUser}>`,
                to: `"${options.toName}" <${options.toEmail}>`,
                replyTo: fromMail,
                subject,
                html: htmlContent
            });
            console.log(`[OTP Email] Dispatched OTP code to ${options.toEmail} via SMTP fallback`);
            return { success: true, method: 'SMTP' };
        } catch (smtpErr: any) {
            console.error('[OTP Email] SMTP exception:', smtpErr.message || smtpErr);
            return { success: false, error: smtpErr.message, method: 'SMTP' };
        }
    }

    return { success: false, error: 'No email service available' };
}