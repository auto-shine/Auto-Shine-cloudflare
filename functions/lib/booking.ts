export type Zone = 'Z1' | 'Z2' | 'Z3';
export type ServiceCode = 'EFD' | 'DCD' | 'PC1' | 'PC2' | 'CC' | 'ENGINE' | 'HL' | 'HLUV';
export type Size = 'S' | 'M' | 'L';

export const SERVICE_DEFS: Record<ServiceCode, { name: string; duration: number; summary: string; flat?: number }> = {
  EFD: { name: 'Essential Full Detail', duration: 150, summary: '2–3 hours' },
  DCD: { name: 'Deep Clean Detail', duration: 240, summary: '3–6 hours' },
  PC1: { name: 'Paint Correction Stage 1', duration: 360, summary: '6 hours' },
  PC2: { name: 'Paint Correction Stage 2', duration: 480, summary: 'Full day' },
  CC: { name: 'Ceramic Coating', duration: 480, summary: 'Full day' },
  ENGINE: { name: 'Engine Bay Detail (stand-alone)', duration: 60, summary: '1 hour', flat: 50 },
  HL: { name: 'Headlight Restoration (stand-alone)', duration: 90, summary: '1.5 hours', flat: 50 },
  HLUV: { name: 'Headlight Restoration + UV Coating (stand-alone)', duration: 120, summary: '2 hours', flat: 100 },
};

export const PRICING: Record<Zone, Record<Exclude<ServiceCode, 'ENGINE' | 'HL' | 'HLUV'>, Record<Size, number>>> = {
  Z1: {
    EFD: { S: 90, M: 100, L: 110 }, DCD: { S: 140, M: 150, L: 170 },
    PC1: { S: 250, M: 260, L: 280 }, PC2: { S: 300, M: 320, L: 350 }, CC: { S: 550, M: 580, L: 620 },
  },
  Z2: {
    EFD: { S: 100, M: 110, L: 120 }, DCD: { S: 150, M: 160, L: 180 },
    PC1: { S: 260, M: 270, L: 300 }, PC2: { S: 320, M: 340, L: 370 }, CC: { S: 560, M: 590, L: 630 },
  },
  Z3: {
    EFD: { S: 110, M: 120, L: 130 }, DCD: { S: 160, M: 170, L: 190 },
    PC1: { S: 270, M: 280, L: 310 }, PC2: { S: 330, M: 350, L: 380 }, CC: { S: 570, M: 600, L: 640 },
  },
};

const STANDALONE: ServiceCode[] = ['ENGINE', 'HL', 'HLUV'];
const BASE_SERVICES: ServiceCode[] = ['EFD', 'DCD', 'PC1', 'PC2', 'CC'];

export function isFullDay(serviceCode: ServiceCode) {
  return serviceCode === 'PC2' || serviceCode === 'CC';
}

export function getDurationMinutes(serviceCode: ServiceCode, size: Size) {
  const base = SERVICE_DEFS[serviceCode].duration;
  if (isFullDay(serviceCode)) return 480;
  if (STANDALONE.includes(serviceCode)) return base;
  return size === 'M' || size === 'L' ? base + 60 : base;
}

// Distance zoning is resolved server-side by /api/quote using postcodes.io.
// This helper remains a compatibility default only; never use it for pricing.
export function detectZone(_postcode: string): Zone {
  return 'Z1';
}

export function getBasePrice(serviceCode: ServiceCode, size: Size, zone: Zone) {
  const service = SERVICE_DEFS[serviceCode];
  if (service.flat !== undefined) return service.flat;
  return PRICING[zone][serviceCode as Exclude<ServiceCode, 'ENGINE' | 'HL' | 'HLUV'>][size];
}

export function getAddonPrice(addons: string[] = []) {
  let total = 0;
  if (addons.includes('engine-bay')) total += 35;
  if (addons.includes('headlight-restoration')) total += 40;
  if (addons.includes('headlight-restoration-uv')) total += 80;
  if (addons.includes('soft-top')) total += 50;
  return total;
}

export function getTotalPrice({ serviceCode, size, zone, addons = [] }: {
  serviceCode: ServiceCode; size: Size; zone: Zone; addons?: string[];
}) {
  return getBasePrice(serviceCode, size, zone) + getAddonPrice(addons);
}

export function combineDateTime(date: string, time: string) {
  const [hour, minute] = time.split(':').map(Number);
  const dateObj = new Date(`${date}T00:00:00`);
  dateObj.setHours(hour, minute, 0, 0);
  return dateObj;
}

export function roundToHalfHour(date: Date) {
  const minutes = date.getMinutes();
  const rounded = minutes <= 30 ? 30 : 60;
  const newDate = new Date(date);
  newDate.setMinutes(rounded, 0, 0);
  return newDate;
}
