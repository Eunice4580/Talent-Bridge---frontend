// Sends an email notification to the Talent Bridge team when a form row is inserted.
// Invoked by Supabase database webhooks on contact_messages, consultation_requests
// and job_applications. Deploy with JWT verification disabled and require a
// private x-webhook-secret header instead.

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

type RecordMap = Record<string, unknown>;

interface WebhookPayload {
    type?: string;
    table?: string;
    record?: RecordMap;
}

interface EmailContent {
    subject: string;
    rows: Array<[string, string]>;
    message: string;
    replyTo?: string;
}

function text(value: unknown): string {
    return value == null ? '' : String(value).trim();
}

function escapeHtml(value: unknown): string {
    return text(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDate(value: unknown): string {
    const raw = text(value);
    if (!raw) return '';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
}

function fullName(record: RecordMap): string {
    return [text(record.first_name), text(record.last_name)]
        .filter(Boolean)
        .join(' ');
}

async function vacancyLabel(vacancyId: unknown): Promise<string> {
    const id = text(vacancyId);
    if (!id) return '';

    const base = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!base || !serviceKey) return '';

    try {
        const response = await fetch(
            `${base}/rest/v1/job_vacancies?select=title,company&id=eq.${encodeURIComponent(id)}`,
            { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
        );
        if (!response.ok) return '';
        const rows = await response.json();
        const vacancy = Array.isArray(rows) ? rows[0] : null;
        if (!vacancy) return '';
        return [vacancy.title, vacancy.company].filter(Boolean).join(' at ');
    } catch (error) {
        console.error('Could not look up vacancy:', error);
        return '';
    }
}

async function buildContent(payload: WebhookPayload): Promise<EmailContent | null> {
    const table = payload.table;
    const record = payload.record || {};
    const submitted = formatDate(record.created_at);

    if (table === 'contact_messages') {
        const name = text(record.name);
        return {
            subject: `New contact message${name ? ` from ${name}` : ''}`,
            rows: [
                ['Name', name],
                ['Email', text(record.email)],
                ['Phone', text(record.phone)],
                ['Subject', text(record.subject)],
                ['Received', submitted]
            ],
            message: text(record.message),
            replyTo: text(record.email) || undefined
        };
    }

    if (table === 'consultation_requests') {
        const name = fullName(record) || text(record.name);
        return {
            subject: `New consultation booking${name ? ` from ${name}` : ''}`,
            rows: [
                ['Name', name],
                ['Email', text(record.email)],
                ['Phone', text(record.phone)],
                ['Service', text(record.service)],
                ['Received', submitted]
            ],
            message: text(record.message),
            replyTo: text(record.email) || undefined
        };
    }

    if (table === 'job_applications') {
        const candidate = text(record.full_name);
        const vacancy = await vacancyLabel(record.vacancy_id);
        return {
            subject: `New application${candidate ? ` from ${candidate}` : ''}${vacancy ? ` – ${vacancy}` : ''}`,
            rows: [
                ['Candidate', candidate],
                ['Email', text(record.email)],
                ['Phone', text(record.phone)],
                ['Vacancy', vacancy],
                ['CV file', text(record.cv_path)],
                ['Received', submitted]
            ],
            message: text(record.cover_note),
            replyTo: text(record.email) || undefined
        };
    }

    return null;
}

function renderHtml(content: EmailContent, adminUrl: string): string {
    const rows = content.rows
        .filter(([, value]) => value)
        .map(([label, value]) =>
            `<tr>
                <td style="padding:6px 16px 6px 0;color:#64748b;font-size:13px;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
                <td style="padding:6px 0;color:#0f172a;font-size:14px;">${escapeHtml(value)}</td>
            </tr>`
        )
        .join('');

    const message = content.message
        ? `<div style="margin-top:20px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                <p style="margin:0 0 6px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Message</p>
                <p style="margin:0;color:#0f172a;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(content.message)}</p>
           </div>`
        : '';

    const button = adminUrl
        ? `<p style="margin:24px 0 0;">
                <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:8px;">Open admin dashboard</a>
           </p>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;">
        <p style="margin:0 0 4px;color:#1e40af;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Talent Bridge HR Solutions</p>
        <h1 style="margin:0 0 18px;color:#0f172a;font-size:20px;line-height:1.3;">${escapeHtml(content.subject)}</h1>
        <table role="presentation" style="border-collapse:collapse;width:100%;">${rows}</table>
        ${message}
        ${button}
        <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">Sent automatically from the Talent Bridge website.</p>
    </div>
</body>
</html>`;
}

function renderText(content: EmailContent, adminUrl: string): string {
    const lines = [content.subject, ''];
    content.rows.forEach(([label, value]) => {
        if (value) lines.push(`${label}: ${value}`);
    });
    if (content.message) {
        lines.push('', content.message);
    }
    if (adminUrl) {
        lines.push('', `Admin dashboard: ${adminUrl}`);
    }
    return lines.join('\n');
}

Deno.serve(async (request: Request) => {
    if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    const expectedSecret = Deno.env.get('WEBHOOK_SECRET');
    if (!expectedSecret) {
        console.error('WEBHOOK_SECRET is not configured');
        return new Response('Server misconfigured', { status: 500 });
    }

    if (request.headers.get('x-webhook-secret') !== expectedSecret) {
        return new Response('Unauthorized', { status: 401 });
    }

    let payload: WebhookPayload;
    try {
        payload = await request.json();
    } catch (error) {
        console.error('Invalid webhook payload:', error);
        return new Response('Invalid JSON', { status: 400 });
    }

    if (payload.type && payload.type !== 'INSERT') {
        return Response.json({ skipped: true });
    }

    const content = await buildContent(payload);
    if (!content) {
        return Response.json({ skipped: true });
    }

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
        console.error('RESEND_API_KEY is not configured');
        return new Response('Server misconfigured', { status: 500 });
    }

    const recipients = (Deno.env.get('NOTIFY_TO') || 'tbridgehrsolutions@gmail.com')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    const from = Deno.env.get('RESEND_FROM') || 'Talent Bridge Website <onboarding@resend.dev>';
    const siteUrl = (Deno.env.get('SITE_URL') || '').replace(/\/$/, '');
    const adminUrl = siteUrl ? `${siteUrl}/admin.html` : '';

    const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from,
            to: recipients,
            subject: content.subject,
            html: renderHtml(content, adminUrl),
            text: renderText(content, adminUrl),
            reply_to: content.replyTo
        })
    });

    if (!response.ok) {
        const detail = await response.text();
        console.error('Resend rejected the email:', response.status, detail);
        return new Response('Email delivery failed', { status: 500 });
    }

    const result = await response.json();
    return Response.json({ sent: true, id: result.id });
});
