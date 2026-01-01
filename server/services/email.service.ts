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

  const fromEmail = process.env.ALERT_FROM_EMAIL || 'noreply@example.com';
  
  const tasksByStation = notification.incompleteTasks.reduce((acc, task) => {
    if (!acc[task.station]) {
      acc[task.station] = [];
    }
    acc[task.station].push(task);
    return acc;
  }, {} as Record<string, IncompleteTaskSummary[]>);

  const stationSections = Object.entries(tasksByStation)
    .map(([station, tasks]) => {
      const taskList = tasks.map(t => `  - ${t.taskName}`).join('\n');
      return `${station}:\n${taskList}`;
    })
    .join('\n\n');

  const htmlContent = `
    <h2>Incomplete Cleaning Tasks Alert</h2>
    <p>Hello ${escapeHtml(notification.adminName)},</p>
    <p>The following cleaning tasks were not completed today at <strong>${escapeHtml(notification.restaurantName)}</strong>:</p>
    
    ${Object.entries(tasksByStation).map(([station, tasks]) => `
      <h3>${escapeHtml(station)}</h3>
      <ul>
        ${tasks.map(t => `<li>${escapeHtml(t.taskName)}</li>`).join('')}
      </ul>
    `).join('')}
    
    <p><strong>Total incomplete tasks: ${notification.incompleteTasks.length}</strong></p>
    <p>Please follow up with your team to ensure these tasks are completed.</p>
    <hr>
    <p style="color: #666; font-size: 12px;">This is an automated message from your Restaurant Inventory Management System.</p>
  `;

  const textContent = `
Incomplete Cleaning Tasks Alert

Hello ${notification.adminName},

The following cleaning tasks were not completed today at ${notification.restaurantName}:

${stationSections}

Total incomplete tasks: ${notification.incompleteTasks.length}

Please follow up with your team to ensure these tasks are completed.
`;

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: notification.adminEmail,
      subject: `[Alert] ${notification.incompleteTasks.length} Incomplete Cleaning Tasks - ${notification.restaurantName}`,
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
