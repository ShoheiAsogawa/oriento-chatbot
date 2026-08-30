import { describe, expect, it } from 'vitest';
import { autoBottomOffset, obstacleBottomReserve, parseOffsetBottom } from './dock-offset';

const visibleFixed = {
  display: 'block',
  visibility: 'visible',
  opacity: '1',
  position: 'fixed',
};

describe('parseOffsetBottom', () => {
  it('treats a missing or blank value as automatic', () => {
    expect(parseOffsetBottom(null)).toBeNull();
    expect(parseOffsetBottom('')).toBeNull();
    expect(parseOffsetBottom('  ')).toBeNull();
  });

  it('accepts an explicit pixel reserve including zero', () => {
    expect(parseOffsetBottom('0')).toBe(0);
    expect(parseOffsetBottom('56px')).toBe(56);
  });

  it('ignores invalid numbers', () => {
    expect(parseOffsetBottom('auto')).toBeNull();
    expect(parseOffsetBottom('-12')).toBeNull();
  });
});

describe('obstacleBottomReserve', () => {
  it('reserves the official 50px click-to-call bar when it sits on the bottom edge', () => {
    expect(obstacleBottomReserve(
      { top: 686, bottom: 736, height: 50, width: 390 },
      736,
      visibleFixed,
    )).toBe(50);
  });

  it('includes a small gap when the bar is slightly above the viewport bottom', () => {
    expect(obstacleBottomReserve(
      { top: 670, bottom: 720, height: 50, width: 390 },
      736,
      visibleFixed,
    )).toBe(66);
  });

  it('ignores the desktop-hidden phone bar', () => {
    expect(obstacleBottomReserve(
      { top: 0, bottom: 50, height: 50, width: 1280 },
      800,
      { ...visibleFixed, display: 'none' },
    )).toBe(0);
  });

  it('adds a small gap only when a bottom bar is present', () => {
    expect(autoBottomOffset(0)).toBe(0);
    expect(autoBottomOffset(50)).toBe(58);
  });

  it('ignores floating buttons that are not docked to the bottom', () => {
    expect(obstacleBottomReserve(
      { top: 200, bottom: 260, height: 60, width: 60 },
      736,
      visibleFixed,
    )).toBe(0);
  });
});
