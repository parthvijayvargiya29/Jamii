import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function escapeHtml(text: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };
  return text.replace(/[&<>"']/g, (char) => escapeMap[char] || char);
}

export interface IncompleteTaskSummary {
  taskId: string;
  taskName: string;
  station: string;
  day: string;
}

export interface AdminNotification {
  adminEmail: string;
  adminName: string;
  restaurantName: string;
  incompleteTasks: IncompleteTaskSummary[];
}

export async function sendIncompleteTasksEmail(notification: AdminNotification): Promise<boolean> {
  if (!resend) {
    console.warn('[Email Service] RESEND_API_KEY not configured. Skipping email send.');
    return false;
  }

  // Use Resend's testing domain by default (works without domain verification)
  const fromEmail = process.env.ALERT_FROM_EMAIL || 'onboarding@resend.dev';
  
  const taskList = notification.incompleteTasks.map(t => 
    `<li>${escapeHtml(t.station)} - ${escapeHtml(t.taskName)}</li>`
  ).join('');

  const htmlContent = `
    <p>Dear Admin,</p>
    <p>The following tasks haven't been marked complete at <strong>${escapeHtml(notification.restaurantName)}</strong>:</p>
    <ul>
      ${taskList}
    </ul>
    <p>Please inspect the cleaning conditions.</p>
    <p>Thank you.</p>
  `;

  const plainTaskList = notification.incompleteTasks.map(t => 
    `- ${t.station} - ${t.taskName}`
  ).join('\n');

  const textContent = `Dear Admin,

The following tasks haven't been marked complete at ${notification.restaurantName}:

${plainTaskList}

Please inspect the cleaning conditions.

Thank you.
`;

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: notification.adminEmail,
      subject: `RE: INCOMPLETE TASKS - ${notification.restaurantName}`,
      html: htmlContent,
      text: textContent,
    });

    console.log(`[Email Service] Sent incomplete tasks alert to ${notification.adminEmail}`, result);
    return true;
  } catch (error) {
    console.error('[Email Service] Failed to send email:', error);
    return false;
  }
}
