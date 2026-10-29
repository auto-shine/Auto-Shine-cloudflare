import { detectZone, getTotalPrice, SERVICE_DEFS, type ServiceCode, type Size } from '../lib/booking';

const VALID_SERVICE_CODES = Object.keys(SERVICE_DEFS) as ServiceCode[];

function parseAddons(raw?: string | string[]) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return String(raw)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildSizes() {
  return {
    S: { label: 'Small', examples: 'City cars, hatchbacks, compact cars' },
    M: { label: 'Medium', examples: 'Family saloons, SUVs, estates' },
    L: { label: 'Large', examples: 'Large SUVs, people carriers, vans' }
  } as const;
}

export const onRequest: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());

  const postcode = String(params.postcode || '').trim();
  const size = String(params.size || '').trim().toUpperCase();

  if (!postcode) {
    return Response.json({ error: 'Missing postcode' }, { status: 400 });
  }

  const cleanPostcode = postcode.toUpperCase();
  const zone = detectZone(cleanPostcode);
  const coveragePattern = /[A-Z]{1,2}\d[A-Z0-9]?/i;

  if (!coveragePattern.test(cleanPostcode)) {
    return Response.json({
      outOfArea: true,
      postcode: cleanPostcode,
      message: 'We can only quote for valid UK postcodes in our service area. Message Jake for a custom quote.',
      whatsapp: 'https://wa.me/447999923651?text=' + encodeURIComponent('Hi Jake, I’d like a custom quote for my vehicle.')
    });
  }

  if (!size) {
    return Response.json({
      postcode: cleanPostcode,
      area: zone,
      sizes: buildSizes()
    });
  }

  const normalisedSize = (['S', 'M', 'L'].includes(size) ? size : 'M') as Size;
  const menu: Record<string, { label: string; price: number; isFrom: boolean }> = {};

  for (const code of VALID_SERVICE_CODES) {
    const serviceCode = code as ServiceCode;
    menu[serviceCode] = {
      label: SERVICE_DEFS[serviceCode].name,
      price: getTotalPrice({
        serviceCode,
        size: normalisedSize,
        zone,
        addons: parseAddons(params.addons)
      }),
      isFrom: false
    };
  }

  return Response.json({
    postcode: cleanPostcode,
    area: zone,
    size: normalisedSize,
    menu
  });
};
