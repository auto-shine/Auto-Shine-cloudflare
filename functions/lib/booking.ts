export type Zone = 'Z1' | 'Z2' | 'Z3';
export type ServiceCode = 'EFD' | 'DCD' | 'PC1' | 'PC2' | 'CC';
export type Size = 'S' | 'M' | 'L';

export const SERVICE_DEFS = {
  EFD: { name: 'Essential Full Detail', duration: 150, summary: '2–3 hours' },
  DCD: { name: 'Deep Clean Detail', duration: 240, summary: '3–6 hours' },
  PC1: { name: 'Paint Correction Stage 1', duration: 360, summary: '6 hours' },
  PC2: { name: 'Paint Correction Stage 2', duration: 480, summary: 'Full day' },
  CC: { name: 'Ceramic Coating', duration: 480, summary: 'Full day' }
} as const;

export const PRICING: Record<Zone, Record<ServiceCode, Record<Size, number>>> = {
  Z1: {
    EFD: { S: 90, M: 100, L: 110 },
    DCD: { S: 140, M: 150, L: 170 },
    PC1: { S: 250, M: 260, L: 280 },
    PC2: { S: 300, M: 320, L: 350 },
    CC: { S: 550, M: 580, L: 620 }
  },
  Z2: {
    EFD: { S: 100, M: 110, L: 120 },
    DCD: { S: 150, M: 160, L: 180 },
    PC1: { S: 260, M: 270, L: 300 },
    PC2: { S: 320, M: 340, L: 370 },
    CC: { S: 560, M: 590, L: 630 }
  },
  Z3: {
    EFD: { S: 110, M: 120, L: 130 },
    DCD: { S: 160, M: 170, L: 190 },
    PC1: { S: 270, M: 280, L: 310 },
    PC2: { S: 330, M: 350, L: 380 },
    CC: { S: 570, M: 600, L: 640 }
  }
};

export function isFullDay(serviceCode: ServiceCode) {
  return serviceCode === 'PC2' || serviceCode === 'CC';
}

export function getDurationMinutes(serviceCode: ServiceCode, size: Size) {
  const base = SERVICE_DEFS[serviceCode].duration;

  if (isFullDay(serviceCode)) return 480;

  if (size === 'M' || size === 'L') return base + 60;
  return base;
}

export function detectZone(postcode: string): Zone {
  const cleaned = postcode.trim().toUpperCase();

  if (/CV8/i.test(cleaned)) return 'Z1';
  if (/CV2|CV3|CV4|CV5|CV6|CV7|CV9|CV10|CV11|CV12|B\d+/i.test(cleaned)) return 'Z2';
  return 'Z3';
}

export function getBasePrice(serviceCode: ServiceCode, size: Size, zone: Zone) {
  return PRICING[zone][serviceCode][size];
}

export function getAddonPrice(addons: string[] = []) {
  let total = 0;

  if (addons.includes('engine-bay')) total += 35;
  if (addons.includes('headlight-restoration')) total += 50;
  if (addons.includes('headlight-restoration-uv')) total += 80;
  if (addons.includes('soft-top')) total += 50;

  return total;
}

export function getTotalPrice({
  serviceCode,
  size,
  zone,
  addons = []
}: {
  serviceCode: ServiceCode;
  size: Size;
  zone: Zone;
  addons?: string[];
}) {
  const base = getBasePrice(serviceCode, size, zone);
  const extra = getAddonPrice(addons);
  return base + extra;
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