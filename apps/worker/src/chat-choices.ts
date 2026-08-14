export type ChatChoice = {
  label: string;
  value: string;
  tone?: 'primary' | 'default';
};

const choice = (label: string, value = label, tone: ChatChoice['tone'] = 'default'): ChatChoice => ({
  label,
  value,
  tone,
});

const PREFECTURE_CHOICES = [
  choice('大阪府'),
  choice('兵庫県'),
  choice('和歌山県'),
  choice('京都府'),
  choice('奈良県'),
];

export function choicesForChatAnswer(answer: string): ChatChoice[] {
  if (/賃貸(?:と|か)購入.*(?:教えて|選んで)/u.test(answer)) {
    return [choice('賃貸', '賃貸', 'primary'), choice('購入', '購入', 'primary')];
  }
  if (/(?:住みたい|希望の)(?:都道府県|地域)|都道府県を選んで/u.test(answer)) {
    return PREFECTURE_CHOICES;
  }
  if (/家賃の上限/u.test(answer)) {
    return [
      choice('5万円まで', '家賃5万円まで'),
      choice('7万円まで', '家賃7万円まで'),
      choice('10万円まで', '家賃10万円まで', 'primary'),
      choice('15万円まで', '家賃15万円まで'),
    ];
  }
  if (/購入予算の上限/u.test(answer)) {
    return [
      choice('2,000万円まで', '購入予算2000万円まで'),
      choice('3,000万円まで', '購入予算3000万円まで', 'primary'),
      choice('4,000万円まで', '購入予算4000万円まで'),
      choice('5,000万円まで', '購入予算5000万円まで'),
      choice('6,000万円まで', '購入予算6000万円まで'),
    ];
  }
  if (/購入する物件の種類/u.test(answer)) {
    return [
      choice('新築戸建て', '新築戸建て'),
      choice('中古戸建て', '中古戸建て'),
      choice('中古マンション', '中古マンション'),
      choice('土地', '土地'),
      choice('その他・事業用', 'その他・事業用'),
      choice('こだわりなし', '物件種別はこだわりなし'),
    ];
  }
  if (/購入物件の希望間取り/u.test(answer)) {
    return [
      choice('2LDK'),
      choice('3LDK', '3LDK', 'primary'),
      choice('4LDK'),
      choice('こだわりなし', '間取りはこだわりなし'),
    ];
  }
  if (/希望の間取りや条件/u.test(answer)) {
    return [
      choice('ワンルーム'),
      choice('1K'),
      choice('1LDK'),
      choice('2LDK', '2LDK', 'primary'),
      choice('3LDK'),
      choice('こだわりなし', 'こだわりなし'),
    ];
  }
  if (/かなり手狭/u.test(answer)) {
    const compactLayout = answer.match(/(?:ワンルーム|1R|1K)/u)?.[0] || 'ワンルーム';
    return [
      choice('2LDK以上で探す', '2LDK以上', 'primary'),
      choice('そのまま探す', `${compactLayout}のまま`),
    ];
  }
  if (/登録物件情報だけでは全件を正確に絞り込めない/u.test(answer)) {
    const condition = answer.match(/「([^」]+)」/u)?.[1] || 'この条件';
    return [choice('この条件を外して検索', `${condition}を条件から外す`, 'primary')];
  }
  if (/条件に合う.*(?:物件|賃貸).*(?:見つかった|見つからなかった)/su.test(answer)) {
    return [choice('条件を変えて探す', '物件を探す')];
  }
  return [];
}
