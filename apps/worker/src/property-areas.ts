const PREFECTURE_ORDER = [
  '大阪府', '兵庫県', '和歌山県', '京都府', '奈良県', '滋賀県',
  '茨城県', '千葉県', '広島県', '高知県', '福岡県',
] as const;

const MUNICIPALITY_PREFECTURES: Record<string, string> = {
  '大阪市': '大阪府', '堺市': '大阪府', '東大阪市': '大阪府', '貝塚市': '大阪府', '藤井寺市': '大阪府',
  '八尾市': '大阪府', '泉佐野市': '大阪府', '和泉市': '大阪府', '阪南市': '大阪府', '岸和田市': '大阪府',
  '松原市': '大阪府', '枚方市': '大阪府', '羽曳野市': '大阪府', '富田林市': '大阪府', '池田市': '大阪府',
  '高石市': '大阪府', '寝屋川市': '大阪府', '守口市': '大阪府', '門真市': '大阪府', '高槻市': '大阪府',
  '大阪狭山市': '大阪府', '豊中市': '大阪府', '四條畷市': '大阪府', '柏原市': '大阪府', '茨木市': '大阪府',
  '泉南郡岬町': '大阪府', '泉南郡熊取町': '大阪府', '泉北郡忠岡町': '大阪府',
  '神戸市': '兵庫県', '西宮市': '兵庫県', '尼崎市': '兵庫県', '宝塚市': '兵庫県', '芦屋市': '兵庫県',
  '丹波市': '兵庫県', '丹波篠山市': '兵庫県', '豊岡市': '兵庫県', '三田市': '兵庫県', '洲本市': '兵庫県', '三木市': '兵庫県',
  '京都市': '京都府',
  '奈良市': '奈良県', '香芝市': '奈良県', '北葛城郡上牧町': '奈良県', '北葛城郡広陵町': '奈良県',
  '田辺市': '和歌山県', '御坊市': '和歌山県', '海南市': '和歌山県', '有田郡有田川町': '和歌山県',
  '東牟婁郡古座川町': '和歌山県',
};

const PREFECTURE_PATTERN = /(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/u;
const MUNICIPALITY_PATTERN = /^(.+?(?:市|区|(?:郡.+?)?町|(?:郡.+?)?村))/u;

export function prefectureFromText(value: string) {
  return value.normalize('NFKC').match(PREFECTURE_PATTERN)?.[1];
}

export function municipalityFromText(value: string) {
  const normalized = value.normalize('NFKC').trim();
  const withoutPrefecture = normalized.replace(PREFECTURE_PATTERN, '').trim();
  return withoutPrefecture.match(MUNICIPALITY_PATTERN)?.[1];
}

export function prefectureForMunicipality(municipality: string) {
  return MUNICIPALITY_PREFECTURES[municipality];
}

export function propertyArea(address: string) {
  const municipality = municipalityFromText(address);
  if (!municipality) return null;
  const prefecture = prefectureFromText(address) || prefectureForMunicipality(municipality);
  return prefecture ? { prefecture, municipality } : null;
}

export function sortPrefectures(values: string[]) {
  const index = new Map<string, number>(PREFECTURE_ORDER.map((value, position) => [value, position]));
  return [...values].sort((left, right) => (
    (index.get(left) ?? 999) - (index.get(right) ?? 999) || left.localeCompare(right, 'ja')
  ));
}
