import { describe, expect, it } from 'vitest';
import {
  parseVisitorProfile,
  visitorProfileLabel,
  VISITOR_AGE_DECADES,
  VISITOR_GENDERS,
} from '../src/visitor-profile';

describe('visitor profile', () => {
  it('accepts a complete gender and age-decade pair', () => {
    expect(parseVisitorProfile({ visitorGender: 'female', visitorAgeDecade: '30s' })).toEqual({
      gender: 'female',
      ageDecade: '30s',
    });
    expect(visitorProfileLabel({ gender: 'male', ageDecade: '20s' })).toBe('20代の男');
    expect(parseVisitorProfile({ visitorGender: 'other', visitorAgeDecade: '40s' })).toEqual({
      gender: 'other',
      ageDecade: '40s',
    });
    expect(visitorProfileLabel({ gender: 'other', ageDecade: '40s' })).toBe('40代・そのほか');
  });

  it('rejects incomplete or unknown values', () => {
    expect(parseVisitorProfile({ visitorGender: 'male' })).toBeUndefined();
    expect(parseVisitorProfile({ visitorGender: 'unknown', visitorAgeDecade: '20s' })).toBeUndefined();
    expect(parseVisitorProfile({ visitorGender: 'female', visitorAgeDecade: '70s' })).toBeUndefined();
  });

  it('covers the selectable gender and decade values', () => {
    expect(VISITOR_GENDERS).toEqual(['male', 'female', 'other']);
    expect(VISITOR_AGE_DECADES).toEqual(['teens', '20s', '30s', '40s', '50s', '60s_plus']);
  });
});
