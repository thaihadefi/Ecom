import cron, { ScheduledTask } from "node-cron";
import { getStorefront } from "../configs/storefront.config";

const tasks: ScheduledTask[] = [];

// Jobs follow the store's clock (Settings > Storefront), not the server's time zone, and a run
// that is still going makes the next one wait instead of overlapping it.
export const scheduleJob = (name: string, expression: string, run: () => Promise<void>): void => {
  tasks.push(cron.schedule(expression, run, { name, timezone: getStorefront().timezone, noOverlap: true }));
};

export const stopJobs = (): void => {
  tasks.forEach((task) => task.stop());
  tasks.length = 0;
};
