// "2023" -> "two thousand twenty three"
// Small typographic flourish on film pages. Handles 1900–2099 cleanly; falls
// back to the numeric form for anything outside that range.

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];

const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o === 0 ? TENS[t] : `${TENS[t]} ${ONES[o]}`;
}

export function yearInWords(year: number): string {
  if (!Number.isInteger(year) || year < 1900 || year > 2099) {
    return String(year);
  }
  if (year >= 2000) {
    const remainder = year - 2000;
    if (remainder === 0) return "two thousand";
    return `two thousand ${twoDigitWords(remainder)}`;
  }
  // 1900–1999
  const remainder = year - 1900;
  if (remainder === 0) return "nineteen hundred";
  return `nineteen ${twoDigitWords(remainder)}`;
}
