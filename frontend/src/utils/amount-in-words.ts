type SupportedLocale = 'en' | 'vi';

const VI_DIGITS = [
  'không',
  'một',
  'hai',
  'ba',
  'bốn',
  'năm',
  'sáu',
  'bảy',
  'tám',
  'chín',
];

const VI_GROUP_UNITS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

const VI_CURRENCY_NAMES: Record<string, string> = {
  VND: 'đồng',
  USD: 'đô la Mỹ',
  EUR: 'euro',
  GBP: 'bảng Anh',
  JPY: 'yên Nhật',
  CNY: 'nhân dân tệ',
  AUD: 'đô la Úc',
};

const EN_ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];

const EN_TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];

const EN_GROUP_UNITS = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'];

const EN_CURRENCY_NAMES: Record<string, string> = {
  VND: 'Vietnamese dong',
  USD: 'US dollars',
  EUR: 'euros',
  GBP: 'British pounds',
  JPY: 'Japanese yen',
  CNY: 'Chinese yuan',
  AUD: 'Australian dollars',
};

const toFiniteNumber = (value: number | string | null | undefined): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const capitalize = (value: string) => {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const readVietnameseTriple = (value: number, readFull = false): string => {
  const hundreds = Math.floor(value / 100);
  const tens = Math.floor((value % 100) / 10);
  const units = value % 10;
  const parts: string[] = [];

  if (hundreds > 0 || readFull) {
    parts.push(`${VI_DIGITS[hundreds]} trăm`);
  }

  if (tens > 1) {
    parts.push(`${VI_DIGITS[tens]} mươi`);
  } else if (tens === 1) {
    parts.push('mười');
  } else if ((hundreds > 0 || readFull) && units > 0) {
    parts.push('lẻ');
  }

  if (units > 0) {
    if (tens > 1 && units === 1) {
      parts.push('mốt');
    } else if (tens > 1 && units === 4) {
      parts.push('tư');
    } else if (tens >= 1 && units === 5) {
      parts.push('lăm');
    } else {
      parts.push(VI_DIGITS[units]);
    }
  }

  return parts.join(' ');
};

const readVietnameseInteger = (value: number): string => {
  if (value === 0) return VI_DIGITS[0];

  const groups: number[] = [];
  let remaining = value;

  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const parts: string[] = [];

  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const groupValue = groups[index];
    if (groupValue === 0) continue;

    const readFull = parts.length > 0 && groupValue < 100;
    const unit = VI_GROUP_UNITS[index] ?? '';
    parts.push(`${readVietnameseTriple(groupValue, readFull)}${unit ? ` ${unit}` : ''}`);
  }

  return parts.join(' ');
};

const amountToVietnameseWords = (
  value: number | string | null | undefined,
  currency = 'VND',
): string => {
  const amount = toFiniteNumber(value);
  const currencyName = VI_CURRENCY_NAMES[currency] ?? currency;

  if (amount === 0) {
    return capitalize(`${VI_DIGITS[0]} ${currencyName}`);
  }

  const sign = amount < 0 ? 'âm ' : '';
  const absoluteAmount = Math.abs(amount);
  const integerPart = Math.floor(absoluteAmount);
  const decimalPart = Math.round((absoluteAmount - integerPart) * 100);
  const words = `${sign}${readVietnameseInteger(integerPart)} ${currencyName}`;

  if (decimalPart > 0 && !['VND', 'JPY'].includes(currency)) {
    return capitalize(`${words} và ${readVietnameseInteger(decimalPart)} xu`);
  }

  return capitalize(words);
};

const readEnglishBelowThousand = (value: number): string => {
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  const parts: string[] = [];

  if (hundreds > 0) {
    parts.push(`${EN_ONES[hundreds]} hundred`);
  }

  if (remainder > 0) {
    if (remainder < 20) {
      parts.push(EN_ONES[remainder]);
    } else {
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      parts.push(ones > 0 ? `${EN_TENS[tens]}-${EN_ONES[ones]}` : EN_TENS[tens]);
    }
  }

  return parts.join(' ');
};

const readEnglishInteger = (value: number): string => {
  if (value === 0) return EN_ONES[0];

  const groups: number[] = [];
  let remaining = value;

  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const parts: string[] = [];

  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const groupValue = groups[index];
    if (groupValue === 0) continue;

    const unit = EN_GROUP_UNITS[index] ?? '';
    parts.push(`${readEnglishBelowThousand(groupValue)}${unit ? ` ${unit}` : ''}`);
  }

  return parts.join(' ');
};

const amountToEnglishWords = (
  value: number | string | null | undefined,
  currency = 'VND',
): string => {
  const amount = toFiniteNumber(value);
  const currencyName = EN_CURRENCY_NAMES[currency] ?? currency;

  if (amount === 0) {
    return capitalize(`${EN_ONES[0]} ${currencyName}`);
  }

  const sign = amount < 0 ? 'negative ' : '';
  const absoluteAmount = Math.abs(amount);
  const integerPart = Math.floor(absoluteAmount);
  const decimalPart = Math.round((absoluteAmount - integerPart) * 100);
  const words = `${sign}${readEnglishInteger(integerPart)} ${currencyName}`;

  if (decimalPart > 0 && !['VND', 'JPY'].includes(currency)) {
    const centLabel = decimalPart === 1 ? 'cent' : 'cents';
    return capitalize(`${words} and ${readEnglishInteger(decimalPart)} ${centLabel}`);
  }

  return capitalize(words);
};

export const amountToWords = (
  value: number | string | null | undefined,
  currency = 'VND',
  locale: string = 'vi',
): string => {
  const normalizedLocale: SupportedLocale = locale === 'en' ? 'en' : 'vi';

  return normalizedLocale === 'en'
    ? amountToEnglishWords(value, currency)
    : amountToVietnameseWords(value, currency);
};

