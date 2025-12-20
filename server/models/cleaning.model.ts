/**
 * Cleaning Models
 * 
 * This file contains the CleaningTask and CleaningLog model interfaces.
 */

import type { CleaningTask, InsertCleaningTask, CleaningLog, InsertCleaningLog } from "@shared/schema";

// Cleaning Task model interface
export interface ICleaningTaskModel {
  findById(id: string): Promise<CleaningTask | undefined>;
  findByRestaurant(restaurantId: string): Promise<CleaningTask[]>;
  findByFrequency(restaurantId: string, frequency: string): Promise<CleaningTask[]>;
  create(task: InsertCleaningTask): Promise<CleaningTask>;
  update(id: string, data: Partial<CleaningTask>): Promise<CleaningTask | undefined>;
  delete(id: string): Promise<boolean>;
}

// Cleaning Log model interface
export interface ICleaningLogModel {
  findById(id: string): Promise<CleaningLog | undefined>;
  findByTask(taskId: string): Promise<CleaningLog[]>;
  findByUser(userId: string): Promise<CleaningLog[]>;
  create(log: InsertCleaningLog): Promise<CleaningLog>;
}
