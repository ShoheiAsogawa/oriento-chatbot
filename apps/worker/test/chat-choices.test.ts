import { describe, expect, it } from 'vitest';
import { choicesForChatAnswer } from '../src/chat-choices';

describe('chat choices', () => {
  it('offers rental and purchase after starting property search', () => {
    expect(choicesForChatAnswer('物件探しだね。賃貸と購入のどちらを探しているか教えてにゃん。'))
      .toMatchObject([{ label: '賃貸', value: '賃貸' }, { label: '購入', value: '購入' }]);
  });

  it('offers button-only rental criteria in response to each prompt', () => {
    expect(choicesForChatAnswer('住みたい地域や最寄り駅を教えてにゃん。').map((item) => item.value))
      .toContain('堺市');
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
    expect(choicesForChatAnswer('購入物件の希望間取りを選んでにゃん。').map((item) => item.value))
      .toContain('間取りはこだわりなし');
  });
});
