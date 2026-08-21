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

    const account = msalInstance.getActiveAccount() || (msalInstance.getAllAccounts().length > 0 ? msalInstance.getAllAccounts()[0] : null);
    if (!account) {
        console.warn('[GraphMail] No active Microsoft 365 account found in MSAL.');
        return false;
    }

    try {
        // 1. Acquire Access Token with Mail.Send and Mail.Read scopes
        let tokenResponse;
        try {
            tokenResponse = await msalInstance.acquireTokenSilent({
                scopes: ["Mail.Send", "Mail.Read"],
                account
            });
        } catch (silentErr) {
            console.warn('[GraphMail] Silent token acquisition failed:', silentErr);
            try {
                tokenResponse = await msalInstance.acquireTokenPopup({
                    scopes: ["Mail.Send", "Mail.Read"],
                    account
                });
            } catch (popupErr) {
                console.warn('[GraphMail] Popup token acquisition failed or blocked by tenant policy:', popupErr);
                return false;
            }
        }

        if (!tokenResponse?.accessToken) {
            console.warn('[GraphMail] No Graph access token available.');
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
        const cleanSubject = ticketSubject.replace(/^(RE:\s*)+/i, '').trim();
        const emailSubject = isReply 
            ? `RE: ${trackingTag} ${cleanSubject}`
            : `${trackingTag} ${cleanSubject}`;

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
        //    For replies: createReply draft → PATCH to set HTML body + attachments → send
        //    For first email: sendMail directly
        const accessToken = tokenResponse.accessToken;
        const authHeader = { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" };

        if (isReply) {
            // Step A: Find the original message in the thread
            let originalMsgId: string | null = null;
            try {
                const searchFilter = `contains(subject, '[AVANA-TICKET #${ticketId}]')`;
                const searchUrl = `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(searchFilter)}&$select=id,internetMessageId&$top=1&$orderby=receivedDateTime asc`;
                const searchRes = await fetch(searchUrl, { headers: { "Authorization": `Bearer ${accessToken}` } });
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    if (searchData.value?.length > 0) {
                        originalMsgId = searchData.value[0].id;
                    }
                }
            } catch (err) {
                console.warn('[GraphMail] Thread search failed, will send fresh email:', err);
            }

            if (originalMsgId) {
                // Step B: Create a reply draft from the original message
                const draftRes = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${originalMsgId}/createReply`, {
                    method: "POST",
                    headers: authHeader,
                    body: JSON.stringify({})
                });

                if (draftRes.ok) {
                    const draft = await draftRes.json();
                    const draftId = draft.id;

                    // Step C: PATCH the draft with proper HTML body, recipient, and attachments
                    const patchBody: any = {
                        body: { contentType: "HTML", content: htmlContent },
                        toRecipients: [{ emailAddress: { address: toEmail, name: toName || '' } }],
                        subject: emailSubject,
                    };
                    if (graphAttachments.length > 0) {
                        patchBody.attachments = graphAttachments;
                    }

                    const patchRes = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${draftId}`, {
                        method: "PATCH",
                        headers: authHeader,
                        body: JSON.stringify(patchBody)
                    });

                    if (patchRes.ok) {
                        // Step D: Send the draft
                        const sendRes = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${draftId}/send`, {
                            method: "POST",
                            headers: { "Authorization": `Bearer ${accessToken}` }
                        });
                        if (sendRes.ok || sendRes.status === 202) {
                            console.log(`[GraphMail] Successfully sent threaded reply for ticket #${ticketId}`);
                            return true;
                        } else {
                            console.warn('[GraphMail] Draft send failed:', await sendRes.json().catch(() => ({})));
                        }
                    } else {
                        console.warn('[GraphMail] Draft PATCH failed:', await patchRes.json().catch(() => ({})));
                    }
                } else {
                    console.warn('[GraphMail] createReply failed:', await draftRes.json().catch(() => ({})));
                }
                // Fall through to sendMail if any step above failed
            }
        }

        // First email or reply fallback: use sendMail
        const payload: any = {
            message: {
                subject: emailSubject,
                body: { contentType: "HTML", content: htmlContent },
                toRecipients: [{ emailAddress: { address: toEmail, name: toName || '' } }],
                ...(graphAttachments.length > 0 ? { attachments: graphAttachments } : {})
            },
            saveToSentItems: "true"
        };

        const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
            method: "POST",
            headers: authHeader,
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

/**
 * Extracts clean user reply text from an incoming Outlook email body (stripping quoted thread history).
 */
export function cleanOutlookEmailBody(bodyContent: string): string {
    if (!bodyContent) return '';
    try {
        // Parse HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(bodyContent, 'text/html');

        // Remove Outlook quotation blocks if present
        const quotedDivs = doc.querySelectorAll('#divRplyFwdMsg, .OutlookReply, #OLK_SRC_BODY_SECTION, blockquote');
        quotedDivs.forEach(el => el.remove());

        let text = doc.body.textContent || '';
        
        // Strip classic text separators
        const separators = [
            /-----Original Message-----/i,
            /From:.*Sent:.*To:/i,
            /On\s+.*,\s+.*wrote:/i,
            /_{10,}/,
            /-{10,}/
        ];

        for (const sep of separators) {
            const match = text.search(sep);
            if (match !== -1) {
                text = text.substring(0, match);
            }
        }

        return text.trim();
    } catch {
        return bodyContent.substring(0, 1000).trim();
    }
}

/**
 * Checks the user's Microsoft 365 inbox for new replies to a specific ticket and syncs them to the backend portal.
 */
export async function syncIncomingEmailReplies(
    msalInstance: IPublicClientApplication | undefined,
    ticketId: number,
    getHeaders: () => Record<string, string>,
    onCommentSynced?: (comment: any) => void,
    isManual: boolean = false
): Promise<number> {
    if (!msalInstance) return 0;
    const accounts = msalInstance.getAllAccounts();
    const account = msalInstance.getActiveAccount() || accounts[0];
    if (!account) return 0;

    const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

    try {
        // 1. Acquire Token with Mail.Read scope
        let tokenResponse;
        try {
            tokenResponse = await msalInstance.acquireTokenSilent({
                scopes: ["Mail.Read"],
                account
            });
        } catch (silentErr) {
            if (!isManual) return 0; // Don't interrupt user with popups on passive sync
            console.warn('[GraphMail] Silent sync failed, attempting manual popup for Mail.Read:', silentErr);
            try {
                tokenResponse = await msalInstance.acquireTokenPopup({
                    scopes: ["Mail.Read"],
                    account
                });
            } catch (popupErr) {
                console.warn('[GraphMail] Manual popup sync failed:', popupErr);
                return 0;
            }
        }

        if (!tokenResponse?.accessToken) return 0;

        // 2. Query Microsoft Graph for ALL messages (Inbox & Sent Items) matching this ticket ID
        const filter = `contains(subject, '[AVANA-TICKET #${ticketId}]')`;
        const graphUrl = `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(filter)}&$select=id,internetMessageId,subject,body,from,receivedDateTime,hasAttachments&$expand=attachments&$top=15&$orderby=receivedDateTime desc`;

        const graphRes = await fetch(graphUrl, {
            headers: {
                "Authorization": `Bearer ${tokenResponse.accessToken}`
            }
        });

        if (!graphRes.ok) return 0;
        const data = await graphRes.json();
        const messages: any[] = data.value || [];

        let syncedCount = 0;

        for (const msg of messages) {
            if (!msg.internetMessageId) continue;

            const cleanText = cleanOutlookEmailBody(msg.body?.content || '');
            if (!cleanText) continue;

            // Process any attachments
            const attachedFiles: TicketAttachment[] = [];
            if (msg.hasAttachments && Array.isArray(msg.attachments)) {
                for (const att of msg.attachments) {
                    if (att['@odata.type'] === '#microsoft.graph.fileAttachment' && att.contentBytes) {
                        try {
                            // Convert base64 back to Blob and upload to backend
                            const byteChars = atob(att.contentBytes);
                            const byteNumbers = new Array(byteChars.length);
                            for (let i = 0; i < byteChars.length; i++) {
                                byteNumbers[i] = byteChars.charCodeAt(i);
                            }
                            const byteArray = new Uint8Array(byteNumbers);
                            const blob = new Blob([byteArray], { type: att.contentType || 'application/octet-stream' });
                            const file = new File([blob], att.name, { type: att.contentType || 'application/octet-stream' });

                            const formData = new FormData();
                            formData.append('file', file);

                            const uploadHeaders = getHeaders() as any;
                            delete uploadHeaders['Content-Type'];

                            const upRes = await fetch(`${API_URL}/api/upload`, {
                                method: 'POST',
                                headers: uploadHeaders,
                                body: formData,
                                credentials: 'include'
                            });

                            if (upRes.ok) {
                                attachedFiles.push(await upRes.json());
                            }
                        } catch (attErr) {
                            console.warn('Failed to upload email attachment:', attErr);
                        }
                    }
                }
            }

            // Sync to backend
            const syncRes = await fetch(`${API_URL}/api/tickets/${ticketId}/sync-email-reply`, {
                method: 'POST',
                headers: getHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    message: cleanText,
                    emailMessageId: msg.internetMessageId,
                    senderEmail: msg.from?.emailAddress?.address,
                    senderName: msg.from?.emailAddress?.name,
                    receivedAt: msg.receivedDateTime,
                    attachments: attachedFiles.length > 0 ? attachedFiles : null
                })
            });

            if (syncRes.ok) {
                const resData = await syncRes.json();
                if (resData.status === 'synced') {
                    syncedCount++;
                    if (onCommentSynced) onCommentSynced(resData.comment);
                }
            }
        }

        return syncedCount;
    } catch (err) {
        console.warn('[GraphMail] Error syncing email replies:', err);
        return 0;
    }
}

