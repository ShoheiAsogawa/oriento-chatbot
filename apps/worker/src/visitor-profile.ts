export const VISITOR_GENDERS = ['male', 'female'] as const;
export const VISITOR_AGE_DECADES = ['teens', '20s', '30s', '40s', '50s', '60s_plus'] as const;

export type VisitorGender = (typeof VISITOR_GENDERS)[number];
export type VisitorAgeDecade = (typeof VISITOR_AGE_DECADES)[number];

export const VISITOR_GENDER_LABELS: Record<VisitorGender, string> = {
  male: '男性',
  female: '女性',
};

export const VISITOR_AGE_LABELS: Record<VisitorAgeDecade, string> = {
  teens: '10代',
  '20s': '20代',
  '30s': '30代',
  '40s': '40代',
  '50s': '50代',
  '60s_plus': '60代以上',
};

export type VisitorProfile = {
  gender: VisitorGender;
  ageDecade: VisitorAgeDecade;
};

function isVisitorGender(value: string): value is VisitorGender {
  return (VISITOR_GENDERS as readonly string[]).includes(value);
}

function isVisitorAgeDecade(value: string): value is VisitorAgeDecade {
  return (VISITOR_AGE_DECADES as readonly string[]).includes(value);
}

export function parseVisitorProfile(input: { visitorGender?: unknown; visitorAgeDecade?: unknown }): VisitorProfile | undefined {
  const gender = typeof input.visitorGender === 'string' ? input.visitorGender : '';
  const ageDecade = typeof input.visitorAgeDecade === 'string' ? input.visitorAgeDecade : '';
  if (!isVisitorGender(gender) || !isVisitorAgeDecade(ageDecade)) return undefined;
  return { gender, ageDecade };
}

export function visitorProfileLabel(profile: VisitorProfile) {
  return `${VISITOR_AGE_LABELS[profile.ageDecade]}の${VISITOR_GENDER_LABELS[profile.gender]}`;
}
