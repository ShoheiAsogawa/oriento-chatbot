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

const AREA_CHOICES = [
  choice('大阪市'),
  choice('堺市'),
  choice('高槻市'),
  choice('岸和田市'),
  choice('茨木市'),
  choice('泉佐野市'),
];

export function choicesForChatAnswer(answer: string): ChatChoice[] {
  if (/賃貸(?:と|か)購入.*(?:教えて|選んで)/u.test(answer)) {
    return [choice('賃貸', '賃貸', 'primary'), choice('購入', '購入', 'primary')];
  }
  if (/(?:住みたい地域や最寄り駅|希望エリアを選んで)/u.test(answer)) {
    return AREA_CHOICES;
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
    return [
      choice('2LDK以上で探す', '2LDK', 'primary'),
      choice('そのまま探す', 'ワンルームのまま'),
    ];
  }
  if (/条件に合う.*(?:物件|賃貸).*(?:見つかった|見つからなかった)/su.test(answer)) {
    return [choice('条件を変えて探す', '物件を探す')];
  }
  return [];
}
