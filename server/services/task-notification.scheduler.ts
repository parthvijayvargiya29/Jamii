import cron from 'node-cron';
import { PgStorage } from '../pg-storage';
import { sendIncompleteTasksEmail, type IncompleteTaskSummary } from './email.service';

const storage = new PgStorage();

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getDayOfWeek(date: Date): string {
  return DAYS_OF_WEEK[date.getDay()];
}

function getDateRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

export async function checkAndNotifyIncompleteTasks(): Promise<void> {
  console.log('[Task Notification] Starting incomplete task check...');
  
  const today = new Date();
  const dayOfWeek = getDayOfWeek(today);
  const { start, end } = getDateRange(today);
  
  console.log(`[Task Notification] Checking tasks for ${dayOfWeek} (${start.toISOString()} - ${end.toISOString()})`);
  
  try {
    const restaurants = await storage.getAllRestaurants();
    console.log(`[Task Notification] Found ${restaurants.length} restaurants to check`);
    
    for (const restaurant of restaurants) {
      const incompleteTasks = await storage.getIncompleteTasksForDay(
        restaurant.id,
        dayOfWeek,
        start,
        end
      );
      
      if (incompleteTasks.length === 0) {
        console.log(`[Task Notification] ${restaurant.name}: All tasks completed`);
        continue;
      }
      
      console.log(`[Task Notification] ${restaurant.name}: ${incompleteTasks.length} incomplete tasks found`);
      
      const admins = await storage.getAdminsByRestaurant(restaurant.id);
      
      if (admins.length === 0) {
        console.log(`[Task Notification] ${restaurant.name}: No admins to notify`);
        continue;
      }
      
      for (const admin of admins) {
        const success = await sendIncompleteTasksEmail({
          adminEmail: admin.email,
          adminName: admin.name,
          restaurantName: restaurant.name,
          incompleteTasks: incompleteTasks as IncompleteTaskSummary[],
        });
        
        if (success) {
          console.log(`[Task Notification] Email sent to ${admin.email} for ${restaurant.name}`);
        }
      }
    }
    
    console.log('[Task Notification] Incomplete task check completed');
  } catch (error) {
    console.error('[Task Notification] Error checking incomplete tasks:', error);
  }
}

export function startTaskNotificationScheduler(): void {
  const timezone = process.env.SCHEDULER_TZ || 'UTC';
  
  console.log(`[Task Notification] Starting scheduler (timezone: ${timezone})`);
  console.log('[Task Notification] Scheduled to run at midnight every day');
  
  cron.schedule('0 0 * * *', async () => {
    console.log('[Task Notification] Midnight check triggered');
    await checkAndNotifyIncompleteTasks();
  }, {
    timezone,
  });
  
  console.log('[Task Notification] Scheduler started successfully');
}
