/**
 * Культурно-зависимые тайминги для Казахстана.
 * Все проверки — по времени Астаны (UTC+5).
 *
 * "Не беспокоить" — не отправлять email до 9:00 и после 21:00.
 */

const ASTANA_TZ = 'Asia/Almaty'; // UTC+5 (Астана/Алматы)

export const QUIET_HOURS = {
  start: 9,   // 09:00 — начало рабочего/дневного времени
  end: 21,    // 21:00 — конец, после — тихие часы
};

export const SUNDAY_SENSITIVE = true; // воскресенье — тоже тихий день (можно включить/выключить)

/**
 * Возвращает текущее время в Астане.
 */
export function getAstanaNow() {
  const now = new Date();
  // Asia/Almaty — UTC+5 (круглый год, без перехода на летнее время)
  const astanaOffset = 5 * 60; // 5 часов в минутах
  const localOffset = now.getTimezoneOffset();
  const diffMs = (astanaOffset + localOffset) * 60 * 1000;
  return new Date(now.getTime() + diffMs);
}

/**
 * Возвращает объект { hour, dayOfWeek } для текущего времени Астаны.
 */
export function getAstanaTimeParts() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ASTANA_TZ,
    hour: 'numeric',
    hour12: false,
    weekday: 'short',
  });
  // Пример: "14" и "Mon"
  const parts = formatter.formatToParts(now);
  let hour = null;
  let weekday = null;
  for (const part of parts) {
    if (part.type === 'hour') hour = parseInt(part.value, 10);
    if (part.type === 'weekday') weekday = part.value;
  }
  return { hour, weekday };
}

/**
 * Проверяет, можно ли сейчас отправлять уведомление (с учётом казахстанских культурных норм).
 *
 * Правила:
 * 1. Время должно быть между 09:00 и 21:00 по Астане.
 * 2. Если SUNDAY_SENSITIVE = true — в воскресенье не отправляем.
 * 3. В пятницу — отправляем (упрощение: не блокируем пятницу).
 *
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function isSendingAllowed() {
  const { hour, weekday } = getAstanaTimeParts();

  if (hour === null) {
    return { allowed: true }; // fallback — разрешить
  }

  if (hour < QUIET_HOURS.start) {
    return {
      allowed: false,
      reason: `Сейчас ${hour}:00 по Астане — тихие часы (до ${QUIET_HOURS.start}:00). Отправка отложена.`,
    };
  }

  if (hour >= QUIET_HOURS.end) {
    return {
      allowed: false,
      reason: `Сейчас ${hour}:00 по Астане — тихие часы (после ${QUIET_HOURS.end - 1}:00). Отправка отложена.`,
    };
  }

  if (SUNDAY_SENSITIVE && weekday === 'Sun') {
    return {
      allowed: false,
      reason: 'Воскресенье — тихий день по казахстанским традициям. Отправка отложена.',
    };
  }

  return { allowed: true };
}

/**
 * Вычисляет задержку (в мс) до следующего разрешённого времени отправки.
 * Если сейчас разрешено — возвращает 0.
 */
export function getDelayUntilAllowed() {
  const { hour, weekday } = getAstanaTimeParts();

  if (hour === null) return 0;

  // Если сейчас день и не воскресенье — без задержки
  if (hour >= QUIET_HOURS.start && hour < QUIET_HOURS.end) {
    if (!SUNDAY_SENSITIVE || weekday !== 'Sun') {
      return 0;
    }
  }

  // Вычисляем время до следующего 09:00 Астаны
  const nowMs = Date.now();
  const astanaOffsetMs = 5 * 60 * 60 * 1000;
  const nowAstanaMs = nowMs + astanaOffsetMs;
  const nowAstana = new Date(nowAstanaMs);

  // Следующие 09:00 по Астане
  const nextAllowed = new Date(nowAstana);
  nextAllowed.setHours(QUIET_HOURS.start, 0, 0, 0);

  // Если сегодня ещё не было 09:00 — откладываем до сегодняшнего 09:00
  if (nowAstana.getHours() < QUIET_HOURS.start) {
    // то же самое — оставляем today
  } else {
    // Иначе — следующий день
    nextAllowed.setDate(nextAllowed.getDate() + 1);
  }

  // Если воскресенье — перекидываем на понедельник
  if (SUNDAY_SENSITIVE) {
    while (nextAllowed.getDay() === 0) {
      nextAllowed.setDate(nextAllowed.getDate() + 1);
    }
  }

  // Переводим обратно в UTC для расчета задержки
  const nextAllowedUtc = new Date(nextAllowed.getTime() - astanaOffsetMs);
  const delay = Math.max(0, nextAllowedUtc.getTime() - nowMs);

  return delay;
}

export default {
  QUIET_HOURS,
  SUNDAY_SENSITIVE,
  getAstanaNow,
  getAstanaTimeParts,
  isSendingAllowed,
  getDelayUntilAllowed,
};