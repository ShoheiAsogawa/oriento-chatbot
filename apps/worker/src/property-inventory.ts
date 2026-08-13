export type ManagedPropertyInput = {
  title: string;
  category: 'properties_for_sale' | 'properties_for_rent';
  sourceUrl: string;
  address?: string;
  lineStation?: string;
  priceOrRent?: string;
  managementFee?: string;
  layout?: string;
  buildingType?: string;
  availability?: string;
};

export type ManagedPropertyRow = {
  source_url: string;
  category: 'properties_for_sale' | 'properties_for_rent';
  title: string;
  address: string;
  line_station: string;
  price_or_rent: string;
  management_fee: string;
  layout: string;
  building_type: string;
  availability: string;
};

export function yenFromText(value: string) {
  const normalized = value.normalize('NFKC');
  const tenThousands = normalized.match(/([\d,]+(?:\.\d+)?)\s*万円/u)?.[1];
  if (tenThousands) return Math.round(Number(tenThousands.replace(/,/gu, '')) * 10_000);
  const yen = normalized.match(/([\d,]+)\s*円/u)?.[1];
  return yen ? Number(yen.replace(/,/gu, '')) : undefined;
}

export function walkMinutesFromText(value: string) {
  const values = Array.from(value.normalize('NFKC').matchAll(/徒歩\s*(\d+)分/gu))
    .map((match) => Number(match[1]));
  return values.length > 0 ? Math.min(...values) : null;
}

export function transportFromText(value: string) {
  return value.split(/\r?\n|\s+\/\s+|\s+／\s+/u).map((line) => line.trim()).filter(Boolean);
}

export async function loadManagedProperties(db: D1Database, category: ManagedPropertyRow['category']) {
  const [managed, exclusions] = await Promise.all([
    db.prepare(
      `SELECT source_url, category, title, address, line_station, price_or_rent,
        management_fee, layout, building_type, availability
       FROM managed_property_inventory WHERE category = ?`,
    ).bind(category).all<ManagedPropertyRow>(),
    db.prepare('SELECT source_url FROM knowledge_source_exclusions WHERE category = ?')
      .bind(category).all<{ source_url: string }>(),
  ]);
  return {
    managed: managed.results,
    excludedUrls: new Set(exclusions.results.map((row) => row.source_url)),
  };
}

export async function upsertManagedProperty(db: D1Database, input: ManagedPropertyInput) {
  await db.prepare(
    `INSERT INTO managed_property_inventory (
      source_url, category, title, address, line_station, price_or_rent,
      management_fee, layout, building_type, availability, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(source_url) DO UPDATE SET
      category = excluded.category,
      title = excluded.title,
      address = excluded.address,
      line_station = excluded.line_station,
      price_or_rent = excluded.price_or_rent,
      management_fee = excluded.management_fee,
      layout = excluded.layout,
      building_type = excluded.building_type,
      availability = excluded.availability,
      updated_at = CURRENT_TIMESTAMP`,
  ).bind(
    input.sourceUrl,
    input.category,
    input.title,
    input.address || '',
    input.lineStation || '',
    input.priceOrRent || '',
    input.managementFee || '',
    input.layout || '',
    input.buildingType || '',
    input.availability || '',
  ).run();
}

export async function deleteManagedProperty(db: D1Database, sourceUrl: string) {
  await db.prepare('DELETE FROM managed_property_inventory WHERE source_url = ?').bind(sourceUrl).run();
}
