import { describe, expect, it } from 'vitest';
import {
  isObviousConversationDetour,
  scopePropertySearchMessages,
  shouldContinueCompletedPropertySearch,
  wantsOtherPropertyCandidates,
} from '../src/property-search-continuation';

describe('property search conversation routing', () => {
  it.each([
    'あなたはだれ？',
    'おなかすいた',
    'こんにちは',
    'ありがとう',
  ])('recognizes a real conversation detour: %s', (message) => {
    expect(isObviousConversationDetour(message)).toBe(true);
  });

  it.each([
    'ありがとう、ほかの物件も見たい',
    'こんにちは、賃貸を探したい',
  ])('keeps a search request even when it also contains a greeting: %s', (message) => {
    expect(isObviousConversationDetour(message)).toBe(false);
  });

  it.each([
    '堺市でいい？',
    '購入予算5000万円まででいい？',
    '間取りはこだわりなしでいい？',
    '駐車場はありますか？',
  ])('does not mistake a property criterion or fact question for small talk: %s', (message) => {
    expect(isObviousConversationDetour(message)).toBe(false);
  });

  it('uses only the newest search after the visitor restarts', () => {
    const scoped = scopePropertySearchMessages([
      { role: 'user', content: '物件を探す' },
      { role: 'assistant', content: '賃貸と購入のどちらか選んでにゃん。' },
      { role: 'user', content: '賃貸' },
      { role: 'assistant', content: '大阪府で探すにゃん。' },
      { role: 'user', content: '物件を探す' },
      { role: 'assistant', content: '賃貸と購入のどちらか選んでにゃん。' },
    ], '購入');

    expect(scoped.map((message) => message.content)).toEqual([
      '物件を探す',
      '賃貸と購入のどちらか選んでにゃん。',
      '購入',
    ]);
  });

  it('switches from rental to purchase without carrying the previous criteria', () => {
    const scoped = scopePropertySearchMessages([
      { role: 'user', content: '賃貸' },
      { role: 'assistant', content: '住みたい地域を教えてにゃん。' },
      { role: 'user', content: '堺市' },
      { role: 'assistant', content: '家賃を教えてにゃん。' },
    ], '購入したい');

    expect(scoped).toEqual([{ role: 'user', content: '購入したい' }]);
  });

  it('switches from purchase to rental when the visitor changes their choice conversationally', () => {
    const scoped = scopePropertySearchMessages([
      { role: 'user', content: '購入' },
      { role: 'assistant', content: '希望の都道府県を選んでにゃん。' },
      { role: 'user', content: '大阪府' },
      { role: 'assistant', content: '市区町村を選んでにゃん。' },
    ], '賃貸に変更したい');

    expect(scoped).toEqual([{ role: 'user', content: '賃貸に変更したい' }]);
  });

  it('recognizes search-again phrasing as an explicit mode switch', () => {
    expect(scopePropertySearchMessages([
      { role: 'user', content: '購入' },
      { role: 'assistant', content: '希望の都道府県を選んでにゃん。' },
    ], '賃貸で探し直す')).toEqual([{ role: 'user', content: '賃貸で探し直す' }]);

    expect(scopePropertySearchMessages([
      { role: 'user', content: '賃貸' },
      { role: 'assistant', content: '住みたい都道府県を選んでにゃん。' },
    ], '購入で検索したい')).toEqual([{ role: 'user', content: '購入で検索したい' }]);
  });

  it.each(['購入じゃなくて賃貸', '部屋探ししたい', '引っ越したい'])
  ('clears purchase criteria for a natural rental-mode switch: %s', (message) => {
    expect(scopePropertySearchMessages([
      { role: 'user', content: '購入' },
      { role: 'assistant', content: '希望の都道府県を選んでにゃん。' },
      { role: 'user', content: '大阪府' },
    ], message)).toEqual([{ role: 'user', content: message }]);
  });

  it('continues a completed search only for a property-related follow-up', () => {
    const messages = [
      { role: 'assistant' as const, content: '田辺市で条件に合う購入物件が見つかったにゃん。' },
    ];
    expect(shouldContinueCompletedPropertySearch(messages, 'ほかの物件も見たい')).toBe(true);
    expect(shouldContinueCompletedPropertySearch(messages, 'あなたはだれ？')).toBe(false);
    expect(shouldContinueCompletedPropertySearch(messages, 'どれがおすすめ？')).toBe(false);
    expect(shouldContinueCompletedPropertySearch(messages, 'この物件を内見したい')).toBe(false);
    expect(shouldContinueCompletedPropertySearch(messages, '問い合わせしたい')).toBe(false);
  });

  it('recognizes a natural property-search starter as a fresh scope', () => {
    expect(scopePropertySearchMessages([
      { role: 'user', content: '購入' },
      { role: 'assistant', content: '希望の都道府県を選んでにゃん。' },
    ], '物件を探したい')).toEqual([{ role: 'user', content: '物件を探したい' }]);
  });

  it.each(['ほかの物件', '別の候補を見たい', 'もっとありますか', '他は？'])
  ('recognizes a request for unseen candidates: %s', (message) => {
    expect(wantsOtherPropertyCandidates(message)).toBe(true);
  });

  it.each(['もっと安い', '駅に近い物件', '3LDKに変更'])
  ('does not treat a condition refinement as pagination: %s', (message) => {
    expect(wantsOtherPropertyCandidates(message)).toBe(false);
  });
});
