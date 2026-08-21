import { IPublicClientApplication } from "@azure/msal-browser";
import { loginRequest } from "../authConfig";
import { TicketAttachment } from "../types";

export interface SendEmailOptions {
    msalInstance?: IPublicClientApplication;
    toEmail: string;
    toName?: string;
    subject: string;
    ticketId: number;
    ticketSubject: string;
    senderName: string;
    senderEmail?: string;
    messageBody: string;
    category?: string;
    priority?: string;
    status?: string;
    assetName?: string;
    attachments?: TicketAttachment[];
    isReply?: boolean;
}

/**
 * Converts a remote/hosted file URL to Base64 format for Microsoft Graph fileAttachment
 */
async function fetchFileAsBase64(url: string): Promise<string | null> {
    try {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) return null;
        const blob = await res.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result as string;
                // Remove data:mime/type;base64, prefix
                const base64Content = base64data.split(',')[1];
                resolve(base64Content);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn('Failed to convert attachment to base64:', url, e);
        return null;
    }
}

/**
 * Sends an email directly from the logged-in user's Microsoft 365 mailbox via Microsoft Graph API.
 */
export async function sendTicketEmailViaGraph(options: SendEmailOptions): Promise<boolean> {
    const { msalInstance, toEmail, toName, ticketId, ticketSubject, senderName, messageBody, category, priority, status, assetName, attachments = [], isReply = false } = options;

    if (!msalInstance) {
        console.warn('MSAL instance not provided; skipping direct Graph email send.');
        return false;
    }

    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
        console.warn('No active Microsoft 365 account found.');
        return false;
    }

    try {
        // 1. Acquire Access Token with Mail.Send scope
        let tokenResponse;
        try {
            tokenResponse = await msalInstance.acquireTokenSilent({
                ...loginRequest,
                account: accounts[0]
            });
        } catch (silentErr) {
            tokenResponse = await msalInstance.acquireTokenPopup({
                ...loginRequest,
                account: accounts[0]
            });
        }

        if (!tokenResponse?.accessToken) {
            console.error('Failed to obtain Graph access token.');
            return false;
        }

        // 2. Prepare Graph Attachments
        const graphAttachments: any[] = [];
        for (const att of attachments) {
            const base64Data = await fetchFileAsBase64(att.url);
            if (base64Data) {
                graphAttachments.push({
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    name: att.name,
                    contentType: att.type || 'application/octet-stream',
                    contentBytes: base64Data
                });
            }
        }

        // 3. Format Subject and HTML Template
        const trackingTag = `[AVANA-TICKET #${ticketId}]`;
        const emailSubject = isReply 
            ? `Re: ${trackingTag} ${ticketSubject}`
            : `${trackingTag} ${ticketSubject}`;

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background: #0f172a; color: #ffffff; padding: 24px; text-align: left; }
    .badge { display: inline-block; background: #dc2626; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; }
    .title { font-size: 20px; font-weight: 800; margin: 12px 0 4px 0; color: #ffffff; }
    .meta { font-size: 12px; color: #94a3b8; }
    .content { padding: 24px; line-height: 1.6; font-size: 14px; color: #334155; }
    .message-box { background: #f1f5f9; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin: 16px 0; font-size: 14px; white-space: pre-wrap; }
    .info-grid { display: table; width: 100%; margin: 16px 0; border-collapse: collapse; }
    .info-row { display: table-row; }
    .info-label { display: table-cell; padding: 6px 12px 6px 0; font-size: 12px; font-weight: 700; color: #64748b; width: 120px; text-transform: uppercase; }
    .info-value { display: table-cell; padding: 6px 0; font-size: 13px; font-weight: 600; color: #1e293b; }
    .attachments-box { margin-top: 20px; padding: 12px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; font-size: 12px; color: #475569; }
    .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
    .reply-hint { font-weight: 600; color: #0284c7; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="badge">${category || 'IT Support'}</span>
      <div class="title">${isReply ? 'New Response Added' : 'New Support Ticket Created'}</div>
      <div class="meta">Ticket ID: #${ticketId} &bull; Requester: ${senderName}</div>
    </div>
    <div class="content">
      <p>Hello <strong>${toName || 'Team'}</strong>,</p>
      <p>${isReply ? `<strong>${senderName}</strong> posted an update regarding this ticket:` : `A new IT support ticket has been submitted with the details below:`}</p>
      
      <div class="message-box">${messageBody.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>

      <div class="info-grid">
        ${priority ? `<div class="info-row"><div class="info-label">Priority:</div><div class="info-value">${priority}</div></div>` : ''}
        ${status ? `<div class="info-row"><div class="info-label">Status:</div><div class="info-value">${status}</div></div>` : ''}
        ${assetName ? `<div class="info-row"><div class="info-label">Related Asset:</div><div class="info-value">${assetName}</div></div>` : ''}
      </div>

      ${attachments.length > 0 ? `
      <div class="attachments-box">
        <strong>📎 Attached Files (${attachments.length}):</strong><br/>
        ${attachments.map(a => `&bull; ${a.name} (${(a.size / 1024).toFixed(1)} KB)`).join('<br/>')}
      </div>` : ''}
    </div>
    <div class="footer">
      <span class="reply-hint">&#9993; Tip: You can reply directly to this email from Outlook to add a comment to this ticket.</span><br/>
      Avana IT Asset & Support Management &bull; Please do not modify the subject line tag [AVANA-TICKET #${ticketId}].
    </div>
  </div>
</body>
</html>
`;

        // 4. Dispatch Email via Graph API
        const payload: any = {
            message: {
                subject: emailSubject,
                body: {
                    contentType: "HTML",
                    content: htmlContent
                },
                toRecipients: [
                    {
                        emailAddress: {
                            address: toEmail
                        }
                    }
                ],
                ...(graphAttachments.length > 0 ? { attachments: graphAttachments } : {})
            },
            saveToSentItems: "true"
        };

        const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${tokenResponse.accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (response.ok || response.status === 202) {
            console.log(`[GraphMail] Successfully sent ticket #${ticketId} email to ${toEmail}`);
            return true;
        } else {
            const errData = await response.json().catch(() => ({}));
            console.warn(`[GraphMail] Graph sendMail returned ${response.status}:`, errData);
            return false;
        }
    } catch (error) {
        console.error('[GraphMail] Error dispatching email via Microsoft Graph:', error);
        return false;
    }
}
