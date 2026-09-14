// src/utils/numberToWords.ts
//
// Converts numbers into English words, specifically formatted for
// Ghana Cedis contracts, legal agreements, and payment durations.

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function convertLessThanOneThousand(num: number): string {
  let current = '';

  if (num >= 100) {
    current += ONES[Math.floor(num / 100)] + ' Hundred';
    num %= 100;
    if (num > 0) {
      current += ' and ';
    }
  }

  if (num >= 20) {
    current += TENS[Math.floor(num / 10)];
    if (num % 10 > 0) {
      current += ' ' + ONES[num % 10];
    }
  } else if (num > 0) {
    current += ONES[num];
  }

  return current.trim();
}

/**
 * Converts any integer up to trillions into standard English words.
 */
export function integerToWords(num: number): string {
  if (num === 0) return 'Zero';

  const absNum = Math.abs(Math.floor(num));
  const scales = [
    { value: 1_000_000_000, name: 'Billion' },
    { value: 1_000_000, name: 'Million' },
    { value: 1_000, name: 'Thousand' },
  ];

  let remaining = absNum;
  let words = '';

  for (const scale of scales) {
    if (remaining >= scale.value) {
      const count = Math.floor(remaining / scale.value);
      words += convertLessThanOneThousand(count) + ' ' + scale.name + ' ';
      remaining %= scale.value;
    }
  }

  if (remaining > 0) {
    words += convertLessThanOneThousand(remaining);
  }

  return words.trim();
}

/**
 * Converts a currency amount (in main units, e.g. 90000 or 5833.33)
 * to Ghana Cedis legal text format.
 * E.g. 90000 -> "Ninety Thousand Ghana Cedis"
 * E.g. 35000 -> "Thirty Five Thousand Ghana Cedis"
 * E.g. 5833.33 -> "Five Thousand Eight Hundred and Thirty Three Ghana Cedis, Thirty Three Pesewas"
 */
export function amountToGhanaCedisWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'Zero Ghana Cedis';

  const cedis = Math.floor(Math.abs(amount));
  const pesewas = Math.round((Math.abs(amount) - cedis) * 100);

  let result = `${integerToWords(cedis)} Ghana Cedis`;

  if (pesewas > 0) {
    result += `, ${integerToWords(pesewas)} Pesewas`;
  }

  return result;
}

/**
 * Converts month count into legal contract duration wording.
 * E.g. 6 -> "six (6) months"
 * E.g. 12 -> "twelve (12) months"
 * E.g. 1 -> "one (1) month"
 */
export function durationToWords(months: number): string {
  if (!months || months <= 0) return 'zero (0) months';
  const word = integerToWords(months).toLowerCase();
  return `${word} (${months}) ${months === 1 ? 'month' : 'months'}`;
}

/**
 * Formats an installment ordinal (1 -> "1st", 2 -> "2nd", etc.)
 */
export function toOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
