export type Zone = 'Z1' | 'Z2' | 'Z3';
export type ServiceCode = 'EFD' | 'DCD' | 'PC1' | 'PC2' | 'CC' | 'ENGINE' | 'HL' | 'HLUV';
export type Size = 'S' | 'M' | 'L';

type ZonePrices = Record<Zone, number>;
type ServiceDefinition = { name: string; duration: number; summary: string; flat?: number; zonePrices?: ZonePrices; variable?: boolean };

export const SERVICE_DEFS: Record<ServiceCode, ServiceDefinition> = {
  EFD: { name: 'Essential Full Detail', duration: 150, summary: '2–3 hours' },
  DCD: { name: 'Deep Clean Detail', duration: 240, summary: '3–6 hours' },
  PC1: { name: 'Paint Correction Stage 1', duration: 360, summary: '6 hours' },
  PC2: { name: 'Paint Correction Stage 2', duration: 480, summary: 'Full day' },
  CC: { name: 'Ceramic Coating', duration: 480, summary: 'Full day' },
  ENGINE: { name: 'Engine Bay Detail (stand-alone)', duration: 60, summary: '1 hour', zonePrices: { Z1: 50, Z2: 60, Z3: 70 }, variable: true },
  HL: { name: 'Headlight Restoration (stand-alone, no UV)', duration: 90, summary: '1.5 hours', zonePrices: { Z1: 50, Z2: 60, Z3: 70 }, variable: true },
  HLUV: { name: 'Headlight Restoration + UV Coating (stand-alone)', duration: 120, summary: '2 hours', zonePrices: { Z1: 80, Z2: 90, Z3: 100 }, variable: true },
};

export const PRICING: Record<Zone, Record<Exclude<ServiceCode, 'ENGINE' | 'HL' | 'HLUV'>, Record<Size, number>>> = {
  Z1: { EFD: { S: 90, M: 100, L: 110 }, DCD: { S: 140, M: 150, L: 170 }, PC1: { S: 250, M: 260, L: 280 }, PC2: { S: 300, M: 320, L: 350 }, CC: { S: 550, M: 580, L: 620 } },
  Z2: { EFD: { S: 100, M: 110, L: 120 }, DCD: { S: 150, M: 160, L: 180 }, PC1: { S: 260, M: 270, L: 300 }, PC2: { S: 320, M: 340, L: 370 }, CC: { S: 560, M: 590, L: 630 } },
  Z3: { EFD: { S: 110, M: 120, L: 130 }, DCD: { S: 160, M: 170, L: 190 }, PC1: { S: 270, M: 280, L: 310 }, PC2: { S: 330, M: 350, L: 380 }, CC: { S: 570, M: 600, L: 640 } },
};

const STANDALONE: ServiceCode[] = ['ENGINE', 'HL', 'HLUV'];
export function isStandaloneService(code: ServiceCode) { return STANDALONE.includes(code); }
export function isVariablePrice(_code: ServiceCode) { return true; }
export function isFullDay(code: ServiceCode) { return code === 'PC2' || code === 'CC'; }
export function getDurationMinutes(code: ServiceCode, size: Size) {
  const base = SERVICE_DEFS[code].duration;
  if (isFullDay(code)) return 480;
  if (isStandaloneService(code)) return base;
  return size === 'M' || size === 'L' ? base + 60 : base;
}
// All quote/booking endpoints resolve a postcode to a distance zone server-side.
export function detectZone(_postcode: string): Zone { return 'Z1'; }
export function getBasePrice(code: ServiceCode, size: Size, zone: Zone) {
  const service = SERVICE_DEFS[code];
  if (service.zonePrices) return service.zonePrices[zone];
  if (service.flat !== undefined) return service.flat;
  return PRICING[zone][code as Exclude<ServiceCode, 'ENGINE' | 'HL' | 'HLUV'>][size];
}
export function getTotalPrice({ serviceCode, size, zone, addons = [] }: { serviceCode: ServiceCode; size: Size; zone: Zone; addons?: string[] }) {
  const prices: Record<string, number> = { engine: 35, 'engine-bay': 35, headlights: 40, 'headlight-restoration': 40, headlights_uv: 80, 'headlight-restoration-uv': 80, softtop: 50, 'soft-top': 50 };
  return getBasePrice(serviceCode, size, zone) + addons.reduce((sum, addon) => sum + (prices[addon] || 0), 0);
}
// Allowed start hours (inclusive). Mon-Fri and Saturday rules per service; Sunday is closed.
const hourRange = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const WEEKDAY_START_HOURS: Record<ServiceCode, number[]> = {
  EFD: hourRange(10, 16), DCD: hourRange(10, 12), PC1: [10], PC2: [10], CC: [10],
  ENGINE: hourRange(10, 17), HL: hourRange(10, 17), HLUV: hourRange(10, 17),
};
const SATURDAY_START_HOURS: Partial<Record<ServiceCode, number[]>> = { EFD: [11], ENGINE: [11], HL: [11], HLUV: [11] };
export function getAllowedStartTimes(code: ServiceCode, date: string): string[] {
  const day = new Date(`${date}T00:00:00`).getDay();
  const hours = day === 6 ? SATURDAY_START_HOURS[code] : day >= 1 && day <= 5 ? WEEKDAY_START_HOURS[code] : undefined;
  return (hours || []).map((h) => `${String(h).padStart(2, '0')}:00`);
}
export function combineDateTime(date: string, time: string) {
  const [hour, minute] = time.split(':').map(Number);
  const dateObj = new Date(`${date}T00:00:00`);
  dateObj.setHours(hour, minute, 0, 0);
  return dateObj;
}
export function roundToHalfHour(date: Date) {
  const newDate = new Date(date);
  newDate.setMinutes(date.getMinutes() <= 30 ? 30 : 60, 0, 0);
  return newDate;
}
