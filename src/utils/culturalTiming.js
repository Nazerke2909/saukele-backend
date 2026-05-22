const ASTANA_TZ = 'Asia/Almaty'; 

export const QUIET_HOURS = {
  start: 9,   
  end: 21,    
};

export const SUNDAY_SENSITIVE = true; 

export function getAstanaNow() {
  const now = new Date();
  
  const astanaOffset = 5 * 60;
  const localOffset = now.getTimezoneOffset();
  const diffMs = (astanaOffset + localOffset) * 60 * 1000;
  return new Date(now.getTime() + diffMs);
}

export function getAstanaTimeParts() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ASTANA_TZ,
    hour: 'numeric',
    hour12: false,
    weekday: 'short',
  });
  
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
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function isSendingAllowed() {
  const { hour, weekday } = getAstanaTimeParts();

  if (hour === null) {
    return { allowed: true }; 
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

export function getDelayUntilAllowed() {
  const { hour, weekday } = getAstanaTimeParts();

  if (hour === null) return 0;

  
  if (hour >= QUIET_HOURS.start && hour < QUIET_HOURS.end) {
    if (!SUNDAY_SENSITIVE || weekday !== 'Sun') {
      return 0;
    }
  }

 
  const nowMs = Date.now();
  const astanaOffsetMs = 5 * 60 * 60 * 1000;
  const nowAstanaMs = nowMs + astanaOffsetMs;
  const nowAstana = new Date(nowAstanaMs);

  const nextAllowed = new Date(nowAstana);
  nextAllowed.setHours(QUIET_HOURS.start, 0, 0, 0);

  
  if (nowAstana.getHours() < QUIET_HOURS.start) {
    
  } else {
    
    nextAllowed.setDate(nextAllowed.getDate() + 1);
  }

  
  if (SUNDAY_SENSITIVE) {
    while (nextAllowed.getDay() === 0) {
      nextAllowed.setDate(nextAllowed.getDate() + 1);
    }
  }

 
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