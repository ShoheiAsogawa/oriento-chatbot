import { describe, expect, it } from 'vitest';
import { evaluatePurchaseConsultation, extractPurchaseConsultationState } from '../src/purchase-consultation';
import {
  extractSaleCriteria,
  formatSaleAnswer,
  recommendSaleProperties,
  salePropertyChunk,
  type SaleProperty,
} from '../src/sale-catalog';

const tanabeHouse: SaleProperty = {
  id: '134006',
  title: '和歌山県田辺市文里2丁目',
  url: 'https://orijyu.com/buy/post-134006.html',
  property_type: '中古一戸建て',
  price_yen: 49_800_000,
  address: '和歌山県田辺市文里2丁目',
  transport: ['JR紀勢本線「紀伊田辺」徒歩23分'],
  layout: '5LLDDKK',
  walk_minutes: 23,
  status: '',
};

const throughTanabeBudget = [
  { role: 'user' as const, content: '物件を探す' },
  { role: 'assistant' as const, content: '賃貸と購入のどちらを探しているか教えてにゃん。' },
  { role: 'user' as const, content: '購入' },
  { role: 'assistant' as const, content: '購入物件を一緒に探すにゃん。まず、希望の都道府県を選んでにゃん。' },
  { role: 'user' as const, content: '和歌山県' },
  { role: 'assistant' as const, content: '和歌山県で購入物件を探すにゃん。次に、市区町村を選んでにゃん。' },
  { role: 'user' as const, content: '田辺市' },
  { role: 'assistant' as const, content: '購入予算の上限を選んでにゃん。諸費用を除いた物件価格の目安で大丈夫にゃん。' },
] as const;

describe('purchase-to-sale catalog regressions', () => {
  it('returns the reported Tanabe used house immediately after the final no-layout selection', () => {
    const history = [
      ...throughTanabeBudget,
      { role: 'user' as const, content: '購入予算5000万円まで' },
      { role: 'assistant' as const, content: '購入する物件の種類を選んでにゃん。' },
      { role: 'user' as const, content: '中古戸建て' },
      { role: 'assistant' as const, content: '購入物件の希望間取りを選んでにゃん。' },
    ];

    expect(evaluatePurchaseConsultation(history, '間取りはこだわりなし')).toEqual({ active: true });
    const criteria = extractSaleCriteria(history, '間取りはこだわりなし');
    expect(criteria).toEqual({
      prefecture: '和歌山県',
      area: '田辺市',
      maxPriceYen: 50_000_000,
      propertyType: '中古戸建て',
      layout: undefined,
    });
    expect(recommendSaleProperties([tanabeHouse], criteria)).toEqual([tanabeHouse]);
  });

  it('returns the same Tanabe house when both type and layout are unrestricted', () => {
    const history = [
      ...throughTanabeBudget,
      { role: 'user' as const, content: '購入予算6000万円まで' },
      { role: 'assistant' as const, content: '購入する物件の種類を選んでにゃん。' },
      { role: 'user' as const, content: '物件種別はこだわりなし' },
      { role: 'assistant' as const, content: '購入物件の希望間取りを選んでにゃん。' },
    ];

    expect(evaluatePurchaseConsultation(history, '間取りはこだわりなし')).toEqual({ active: true });
    expect(recommendSaleProperties(
      [tanabeHouse],
      extractSaleCriteria(history, '間取りはこだわりなし'),
    )).toEqual([tanabeHouse]);
  });

  it('parses a prefecture, municipality and high budget from one free-text request', () => {
    const message = '中古戸建てを和歌山県の田辺市で1億2,000万円までで購入したい';
    expect(extractPurchaseConsultationState([], message)).toMatchObject({
      prefecture: '和歌山県',
      area: '田辺市',
      maxPriceYen: 120_000_000,
      propertyType: '中古戸建て',
    });
    expect(evaluatePurchaseConsultation([], message).response).toContain('希望間取り');
  });

  it('accepts a suffix-less municipality after the municipality prompt', () => {
    const history = [
      { role: 'user' as const, content: '購入' },
      { role: 'assistant' as const, content: '希望の都道府県を選んでにゃん。' },
      { role: 'user' as const, content: '広島県' },
      { role: 'assistant' as const, content: '次に、市区町村を選んでにゃん。' },
    ];
    expect(extractPurchaseConsultationState(history, '福山').area).toBe('福山');
    expect(evaluatePurchaseConsultation(history, '福山').response).toContain('購入する物件の種類');
  });

  it('starts cleanly when purchase is selected again after a completed search', () => {
    const history = [
      ...throughTanabeBudget,
      { role: 'user' as const, content: '購入予算6000万円まで' },
      { role: 'assistant' as const, content: '購入する物件の種類を選んでにゃん。' },
      { role: 'user' as const, content: '物件種別はこだわりなし' },
      { role: 'assistant' as const, content: '購入物件の希望間取りを選んでにゃん。' },
      { role: 'user' as const, content: '間取りはこだわりなし' },
      { role: 'assistant' as const, content: '田辺市で条件に合う購入物件が見つかったにゃん。' },
    ];

    expect(extractPurchaseConsultationState(history, '購入')).toEqual({
      propertyTypeSet: false,
      layoutSet: false,
    });
    expect(evaluatePurchaseConsultation(history, '購入').response).toContain('希望の都道府県');
  });

  it('clears an old municipality when the visitor changes prefecture', () => {
    const state = extractPurchaseConsultationState([
      ...throughTanabeBudget,
      { role: 'user' as const, content: '購入予算6000万円まで' },
    ], '広島県');
    expect(state.prefecture).toBe('広島県');
    expect(state.area).toBeUndefined();
  });

  it('does not hijack an explanatory purchase question as a guided search', () => {
    expect(evaluatePurchaseConsultation([], '中古戸建てのメリットを教えて')).toEqual({ active: false });
    expect(evaluatePurchaseConsultation([], 'どんな中古戸建てがありますか').active).toBe(true);
  });

  it('accepts common free-text budget formats without changing their magnitude', () => {
    const history = [
      { role: 'user' as const, content: '購入' },
      { role: 'assistant' as const, content: '希望エリアを選んでにゃん。' },
      { role: 'user' as const, content: '田辺市' },
      { role: 'assistant' as const, content: '購入予算の上限を選んでにゃん。' },
    ];
    expect(extractPurchaseConsultationState(history, '5,000万円').maxPriceYen).toBe(50_000_000);
    expect(extractPurchaseConsultationState(history, '50000000').maxPriceYen).toBe(50_000_000);
    expect(extractPurchaseConsultationState(history, '5千万').maxPriceYen).toBe(50_000_000);
  });

  it('filters a generic detached-house follow-up and clears an obsolete layout for land', () => {
    expect(recommendSaleProperties([
      tanabeHouse,
      { ...tanabeHouse, id: 'mansion', property_type: 'マンション' },
    ], { area: '田辺市', propertyType: '戸建て' })).toEqual([tanabeHouse]);

    const state = extractPurchaseConsultationState([
      ...throughTanabeBudget,
      { role: 'user' as const, content: '購入予算6000万円まで' },
      { role: 'assistant' as const, content: '購入する物件の種類を選んでにゃん。' },
      { role: 'user' as const, content: '中古戸建て' },
      { role: 'assistant' as const, content: '購入物件の希望間取りを選んでにゃん。' },
      { role: 'user' as const, content: '3LDK' },
      { role: 'assistant' as const, content: '田辺市で条件に合う購入物件が見つかったにゃん。' },
    ], '土地');
    expect(state.propertyType).toBe('土地');
    expect(state.layout).toBeUndefined();
  });

  it('keeps other and business inventory as an explicit purchase type', () => {
    const history = [
      ...throughTanabeBudget,
      { role: 'user' as const, content: '購入予算6000万円まで' },
      { role: 'assistant' as const, content: '購入する物件の種類を選んでにゃん。' },
    ];
    expect(extractPurchaseConsultationState(history, 'その他・事業用').propertyType).toBe('その他・事業用');

    const hotel = { ...tanabeHouse, id: 'hotel', property_type: 'その他', title: '福山市のホテル', address: '広島県福山市' };
    expect(recommendSaleProperties([tanabeHouse, hotel], {
      prefecture: '広島県',
      area: '福山市',
      propertyType: 'その他・事業用',
    })).toEqual([hotel]);

    const terrace = { ...tanabeHouse, id: 'terrace', property_type: 'テラスハウス' };
    expect(recommendSaleProperties([terrace], { propertyType: 'その他・事業用' })).toEqual([terrace]);
  });

  it('can exclude already displayed properties when the visitor asks for more', () => {
    const alternatives = [
      tanabeHouse,
      { ...tanabeHouse, id: '2', url: 'https://orijyu.com/buy/post-2.html', price_yen: 50_000_000 },
      { ...tanabeHouse, id: '3', url: 'https://orijyu.com/buy/post-3.html', price_yen: 51_000_000 },
      { ...tanabeHouse, id: '4', url: 'https://orijyu.com/buy/post-4.html', price_yen: 52_000_000 },
    ];
    const firstPage = recommendSaleProperties(alternatives, { area: '田辺市' });
    expect(firstPage.map((property) => property.id)).toEqual(['134006', '2', '3']);
    expect(recommendSaleProperties(alternatives, { area: '田辺市' }, {
      ids: firstPage.map((property) => property.id),
      urls: firstPage.map((property) => property.url),
    }).map((property) => property.id)).toEqual(['4']);
  });

  it('uses prefecture as well as municipality for duplicate municipality names', () => {
    const osakaFuchu = { ...tanabeHouse, id: 'osaka', address: '大阪府和泉市府中町', title: '大阪府の府中市周辺' };
    const hiroshimaFuchu = { ...tanabeHouse, id: 'hiroshima', address: '広島県府中市府川町', title: '広島県府中市' };
    expect(recommendSaleProperties([osakaFuchu, hiroshimaFuchu], {
      prefecture: '広島県',
      area: '府中市',
      maxPriceYen: 60_000_000,
    })).toEqual([hiroshimaFuchu]);
  });

  it('excludes unavailable listings and normalizes duplicated scraped labels', () => {
    const unavailable = { ...tanabeHouse, id: 'sold', status: '成約済' };
    expect(recommendSaleProperties([unavailable], { area: '田辺市' })).toEqual([]);

    const duplicated = {
      ...tanabeHouse,
      property_type: '中古一戸建て,中古一戸建て',
    };
    const answer = formatSaleAnswer([duplicated], { prefecture: '和歌山県', area: '田辺市' });
    expect(answer).toContain('中古一戸建て、販売価格4980万円、5LDK');
    expect(answer).not.toContain('中古一戸建て,中古一戸建て');
    expect(salePropertyChunk(duplicated, 0).text).toContain('間取り 5LDK');
  });
});
