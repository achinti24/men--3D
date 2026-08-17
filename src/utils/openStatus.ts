import type { RestaurantSchedule } from '../types/restaurant.types';

const DAY_ORDER: RestaurantSchedule['day'][] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export interface OpenStatus {
  isOpen: boolean;
  label: string;
}

/**
 * Determines open/closed status from the restaurant's weekly schedule and
 * the visitor's local clock — deliberately conservative: any parsing
 * ambiguity resolves to "closed" rather than falsely inviting someone in.
 */
export function getOpenStatus(schedule: RestaurantSchedule[], now: Date = new Date()): OpenStatus {
  const today = DAY_ORDER[now.getDay()];
  const todaySchedule = schedule.find((s) => s.day === today);

  if (!todaySchedule || todaySchedule.closed) {
    return { isOpen: false, label: 'Cerrado hoy' };
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const opens = toMinutes(todaySchedule.opensAt);
  const closes = toMinutes(todaySchedule.closesAt);

  const isOpen = nowMinutes >= opens && nowMinutes < closes;

  return {
    isOpen,
    label: isOpen ? `Abierto · cierra ${todaySchedule.closesAt}` : `Cerrado · abre ${todaySchedule.opensAt}`,
  };
}
