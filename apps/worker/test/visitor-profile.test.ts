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
    expect(visitorProfileLabel({ gender: 'male', ageDecade: '20s' })).toBe('20代の男性');
  });

  it('rejects incomplete or unknown values', () => {
    expect(parseVisitorProfile({ visitorGender: 'male' })).toBeUndefined();
    expect(parseVisitorProfile({ visitorGender: 'other', visitorAgeDecade: '20s' })).toBeUndefined();
    expect(parseVisitorProfile({ visitorGender: 'female', visitorAgeDecade: '70s' })).toBeUndefined();
  });

  it('covers the selectable gender and decade values', () => {
    expect(VISITOR_GENDERS).toEqual(['male', 'female']);
    expect(VISITOR_AGE_DECADES).toEqual(['teens', '20s', '30s', '40s', '50s', '60s_plus']);
  });
});
