import { resolveZone } from '../../lib/zones.js';
import { getTotalPrice, SERVICE_DEFS, type ServiceCode, type Size, type Zone } from '../lib/booking';

const VALID_SERVICE_CODES = Object.keys(SERVICE_DEFS) as ServiceCode[];
const STANDALONE = new Set<ServiceCode>(['ENGINE', 'HL', 'HLUV']);

function parseAddons(raw?: string | string[]) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return String(raw).split(',').map((part) => part.trim()).filter(Boolean);
}

const addonCatalog = {
  engine: { label: 'Engine bay detail', price: 35, notFor: ['ENGINE'], onlyFor: [], excludes: [], extraMinutes: 45 },
  headlights: { label: 'Headlight restoration (no UV coating)', price: 40, notFor: ['HL', 'HLUV'], onlyFor: [], excludes: ['headlights_uv'], extraMinutes: 60 },
  headlights_uv: { label: 'Headlight restoration + UV coating', price: 80, notFor: ['HL', 'HLUV'], onlyFor: [], excludes: ['headlights'], extraMinutes: 75 },
  softtop: { label: 'Soft top waterproofing', price: 50, notFor: [], onlyFor: [], excludes: [], extraMinutes: 60 },
};

const sizes = {
  S: { label: 'Small', examples: 'City cars, hatchbacks, compact cars' },
  M: { label: 'Medium', examples: 'Family saloons, SUVs, estates' },
  L: { label: 'Large', examples: 'Large SUVs, people carriers, vans' },
} as const;

export const onRequest: PagesFunction = async ({ request }) => {
  const params = new URL(request.url).searchParams;
  const rawPostcode = (params.get('postcode') || '').trim();
  const requestedSize = (params.get('size') || '').trim().toUpperCase();

  if (!rawPostcode) return Response.json({ error: 'Please enter a full UK postcode.' }, { status: 400 });

  let zoneInfo;
  try {
    zoneInfo = await resolveZone(rawPostcode);
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Could not validate that postcode. Please try again.' }, { status: 400 });
  }

  const cleanPostcode = zoneInfo.postcode;
  if (!zoneInfo.zone) {
    return Response.json({
      outOfArea: true,
      postcode: cleanPostcode,
      miles: zoneInfo.miles,
      message: 'That postcode is outside our online booking area. Please message Jake for a travel quote.',
      whatsapp: 'https://wa.me/447999923651?text=' + encodeURIComponent(`Hi Jake, I’m in ${cleanPostcode} and would like a quote.`),
    });
  }

  if (!requestedSize) {
    return Response.json({ postcode: cleanPostcode, area: zoneInfo.area || zoneInfo.zone, zone: zoneInfo.zone, miles: zoneInfo.miles, sizes });
  }

  const size = (['S', 'M', 'L'].includes(requestedSize) ? requestedSize : 'M') as Size;
  const menu: Record<string, { label: string; price: number; isFrom: boolean }> = {};
  for (const serviceCode of VALID_SERVICE_CODES) {
    menu[serviceCode] = {
      label: SERVICE_DEFS[serviceCode].name,
      price: getTotalPrice({ serviceCode, size, zone: zoneInfo.zone as Zone }),
      isFrom: false,
    };
  }

  return Response.json({
    postcode: cleanPostcode,
    area: zoneInfo.area || zoneInfo.zone,
    zone: zoneInfo.zone,
    miles: zoneInfo.miles,
    size,
    sizes,
    menu,
    addons: addonCatalog,
  });
};
