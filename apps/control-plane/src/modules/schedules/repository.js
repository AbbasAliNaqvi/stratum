import { eq, desc } from "drizzle-orm";
import { db } from "../../db/client.js";
import { schedules } from "../../db/schema.js";

export async function insertSchedule(data) {
  const [record] = await db.insert(schedules).values(data).returning();
  return record;
}

export async function findSchedules() {
  return await db.select().from(schedules).orderBy(desc(schedules.createdAt));
}

export async function findScheduleById(id) {
  const [record] = await db.select().from(schedules).where(eq(schedules.id, id));
  return record;
}

export async function updateSchedule(id, data) {
  const [record] = await db.update(schedules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schedules.id, id))
    .returning();
  return record;
}

export async function deleteScheduleById(id) {
  await db.delete(schedules).where(eq(schedules.id, id));
}
