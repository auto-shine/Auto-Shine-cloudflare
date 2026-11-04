import { resolveZone } from '../../lib/zones.js';
import { getBasePrice, isVariablePrice, SERVICE_DEFS, type ServiceCode, type Size, type Zone } from '../lib/booking';

const VALID_SERVICE_CODES = Object.keys(SERVICE_DEFS) as ServiceCode[];
const STANDALONE = new Set<ServiceCode>(['ENGINE', 'HL', 'HLUV']);

const sizes = {
  S: { label: 'Small', examples: 'City cars, hatchbacks, compact cars' },
  M: { label: 'Medium', examples: 'Family saloons, SUVs, estates' },
  L: { label: 'Large', examples: 'Large SUVs, people carriers, vans' },
} as const;

const addons = {
  engine: { label: 'Engine bay detail', price: 35, notFor: ['ENGINE'], onlyFor: [], excludes: [] },
  headlights: { label: 'Headlight restoration (no UV coating)', price: 40, notFor: ['HL', 'HLUV'], onlyFor: [], excludes: ['headlights_uv'] },
  headlights_uv: { label: 'Headlight restoration + UV coating', price: 80, notFor: ['HL', 'HLUV'], onlyFor: [], excludes: ['headlights'] },
  softtop: { label: 'Soft top waterproofing', price: 50, notFor: [], onlyFor: [], excludes: [] },
};

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
  const postcode = zoneInfo.postcode;
  if (!zoneInfo.zone) {
    return Response.json({
      outOfArea: true,
      postcode,
      miles: zoneInfo.miles,
      message: 'That postcode is outside our online booking area. Please message Jake for a travel quote.',
      whatsapp: 'https://wa.me/447999923651?text=' + encodeURIComponent(`Hi Jake, I’m in ${postcode} and would like a quote.`),
    });
  }

  const zone = zoneInfo.zone as Zone;
  if (!requestedSize) return Response.json({ postcode, area: zoneInfo.area || zone, zone, miles: zoneInfo.miles, sizes });
  const size = (['S', 'M', 'L'].includes(requestedSize) ? requestedSize : 'M') as Size;
  const menu: Record<string, { label: string; price: number; isFrom: boolean }> = {};
  for (const serviceCode of VALID_SERVICE_CODES) {
    menu[serviceCode] = {
      label: SERVICE_DEFS[serviceCode].name,
      price: getBasePrice(serviceCode, size, zone),
      isFrom: isVariablePrice(serviceCode),
    };
  }

  return Response.json({
    postcode, area: zoneInfo.area || zone, zone, miles: zoneInfo.miles, size, sizes, menu, addons,
    pricingNotice: 'Prices marked “from” are starting estimates. We’ll confirm your final price during booking confirmation; photos or an inspection may be needed.',
    standaloneServices: [...STANDALONE],
  });
};
