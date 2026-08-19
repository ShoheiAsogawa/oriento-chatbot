import { describe, expect, it } from 'vitest';
import { choicesForChatAnswer } from '../src/chat-choices';

describe('chat choices', () => {
  it('offers rental, purchase, and custom-home paths after starting a home search', () => {
    expect(choicesForChatAnswer('住まい探しだね。賃貸・購入・注文住宅のどれを考えているか選んでにゃん。'))
      .toMatchObject([
        { label: '賃貸', value: '賃貸' },
        { label: '購入', value: '購入' },
        { label: '注文住宅', value: '注文住宅' },
      ]);
  });

  it('offers button-only rental criteria in response to each prompt', () => {
    expect(choicesForChatAnswer('住みたい都道府県を選んでにゃん。').map((item) => item.value))
      .toContain('和歌山県');
    expect(choicesForChatAnswer('住みたい都道府県を選んでにゃん。').map((item) => item.value))
      .toContain('広島県');
    expect(choicesForChatAnswer('家賃の上限を教えてにゃん。').map((item) => item.value))
      .toContain('家賃10万円まで');
    expect(choicesForChatAnswer('希望の間取りや条件を教えてにゃん。').map((item) => item.value))
      .toContain('こだわりなし');
  });

  it('offers button-only purchase criteria in response to each prompt', () => {
    expect(choicesForChatAnswer('購入予算の上限を選んでにゃん。').map((item) => item.value))
      .toContain('購入予算3000万円まで');
    expect(choicesForChatAnswer('購入する物件の種類を選んでにゃん。').map((item) => item.value))
      .toContain('新築戸建て');
    expect(choicesForChatAnswer('購入する物件の種類を選んでにゃん。').map((item) => item.value))
      .toContain('その他・事業用');
    expect(choicesForChatAnswer('購入物件の希望間取りを選んでにゃん。').map((item) => item.value))
      .toContain('間取りはこだわりなし');
  });

  it('keeps the compact layout selected by the visitor when they confirm it', () => {
    expect(choicesForChatAnswer(
      '4人家族で1Kはかなり手狭になりそうにゃん。1Kのまま探すか、2LDK以上に広げるか教えてにゃん。',
    )).toMatchObject([
      { label: '2LDK以上で探す', value: '2LDK以上' },
      { label: 'そのまま探す', value: '1Kのまま' },
    ]);
  });

  it('offers a one-tap way to continue without an unsupported condition', () => {
    expect(choicesForChatAnswer(
      '「ペット」は登録物件情報だけでは全件を正確に絞り込めないにゃん。公式LINEで担当者に確認してにゃん。',
    )).toEqual([{
      label: 'この条件を外して検索',
      value: 'ペットを条件から外す',
      tone: 'primary',
    }]);
  });
});
