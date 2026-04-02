export enum ANSWER_FORMAT {
  EXACT_MATCH = 'Exact match',
  CASE_INSENSITIVE = 'Case insensitive',
  CONTAINS_KEYWORDS = 'Contains keywords',
}

export enum LAUNCH_TYPE {
  SCHEDULED = 'Scheduled',
  MANUAL = 'Manual',
}

export enum QUESTION_TYPE {
  MULTIPLE_CHOICE = 'multiple_choice',
  FILL_IN_THE_BLANK = 'fill_in_the_blank',
  TRUE_FALSE = 'true_false',
}

export enum TRIVIA_STATUS {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
}
