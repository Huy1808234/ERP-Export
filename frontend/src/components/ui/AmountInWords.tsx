'use client';

import { Typography } from 'antd';
import type { CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { amountToWords } from '@/utils/amount-in-words';

const { Text } = Typography;

type AmountInWordsProps = {
  amount?: number | string | null;
  currency?: string;
  prefix?: string;
  style?: CSSProperties;
};

const AmountInWords = ({
  amount,
  currency = 'VND',
  prefix,
  style,
}: AmountInWordsProps) => {
  const locale = useLocale();
  const t = useTranslations('Common');
  const label = prefix ?? t('amountInWords');

  return (
    <div
      style={{
        marginTop: 6,
        minHeight: 18,
        lineHeight: 1.35,
        ...style,
      }}
    >
      <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
        {label} {amountToWords(amount, currency, locale)}
      </Text>
    </div>
  );
};

export default AmountInWords;
