import crypto from "node:crypto";
import * as repo from "./repository.js";

export async function createSchedule(data) {
  const id = `sched_${crypto.randomBytes(4).toString('hex')}`;
  
  let nextRunAt = null;
  if (data.intervalMs) {
    nextRunAt = new Date(Date.now() + data.intervalMs);
  }

  return await repo.insertSchedule({
    id,
    name: data.name,
    type: data.type,
    automationId: data.automationId,
    taskType: data.taskType,
    payload: data.payload,
    inputs: data.inputs,
    cron: data.cron,
    intervalMs: data.intervalMs,
    enabled: data.enabled !== undefined ? (data.enabled ? 1 : 0) : 1,
    nextRunAt,
  });
}

export async function getSchedules() {
  return await repo.findSchedules();
}

export async function getSchedule(id) {
  return await repo.findScheduleById(id);
}

export async function updateSchedule(id, data) {
  if (data.enabled !== undefined) {
    data.enabled = data.enabled ? 1 : 0;
  }
  return await repo.updateSchedule(id, data);
}

export async function removeSchedule(id) {
  return await repo.deleteScheduleById(id);
}
