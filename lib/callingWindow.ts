export type CallingWindowState = {
  withinWindow: boolean;
  windowLabel: string;
  nowCstLabel: string;
};

const CST_TZ = "America/Chicago";
const WINDOW_LABEL = "9:00 AM – 5:00 PM CST";
const START_MINUTES = 9 * 60;
const END_MINUTES = 17 * 60;

function cstParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CST_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  return { hour, minute };
}

function formatCstTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CST_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function getCallingWindowState(date: Date = new Date()): CallingWindowState {
  const { hour, minute } = cstParts(date);
  const minutes = Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : NaN;
  const withinWindow = Number.isFinite(minutes) ? minutes >= START_MINUTES && minutes < END_MINUTES : false;

  return {
    withinWindow,
    windowLabel: WINDOW_LABEL,
    nowCstLabel: `${formatCstTime(date)} CST`,
  };
}

