const PACIFIC_TIME_ZONE = "America/Los_Angeles";

export function formatPacificDate(value: string | number | Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: PACIFIC_TIME_ZONE,
    timeZoneName: "short",
  }).format(new Date(value));
}

export function formatPacificDateTime(value: string | number | Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: PACIFIC_TIME_ZONE,
    timeZoneName: "short",
  }).format(new Date(value));
}

export function formatPacificTime(value: string | number | Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: PACIFIC_TIME_ZONE,
    timeZoneName: "short",
  }).format(new Date(value));
}
