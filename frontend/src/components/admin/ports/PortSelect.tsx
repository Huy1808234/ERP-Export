'use client';

import { Select, Space, Tag, Typography } from 'antd';
import type { SelectProps } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import { getAccessToken } from '@/lib/auth-token';
import { formatPortLabel, portService, type IPort, type PortType } from '@/services/port.service';
import { useDebounce } from '@/hooks/useDebounce';
import { getCountryDisplayName } from '@/constants/geo';

const { Text } = Typography;

type PortSelectProps = {
  value?: string | null;
  onChange?: (value?: string) => void;
  placeholder?: string;
  legacyText?: string | null;
  type?: PortType;
  countryCode?: string;
  disabled?: boolean;
  afterChange?: (value?: string) => void;
  onPortChange?: (port?: IPort) => void;
};

const toOption = (port: IPort): NonNullable<SelectProps['options']>[number] => ({
  value: port._id,
  label: `${port.code} - ${port.localName || port.name}`,
});

export default function PortSelect({
  value,
  onChange,
  placeholder,
  legacyText,
  type = 'SEA',
  countryCode,
  disabled,
  afterChange,
  onPortChange,
}: PortSelectProps) {
  const t = useTranslations('Ports.select');
  const locale = useLocale();
  const { data: session, status: sessionStatus } = useSession();
  const [ports, setPorts] = useState<IPort[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const fetchPorts = useCallback(async () => {
    if (disabled || sessionStatus === 'loading') return;
    if (sessionStatus !== 'authenticated') {
      setPorts([]);
      return;
    }

    const accessToken = getAccessToken(session);
    if (!accessToken) {
      setPorts([]);
      setLoadError(t('sessionNotReady'));
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const res = await portService.findAll({
        search: debouncedSearch || undefined,
        countryCode,
        type,
        isActive: true,
        current: 1,
        pageSize: 50,
      }, accessToken);

      if (res.data) {
        setPorts(res.data.results || []);
      } else {
        setPorts([]);
        setLoadError(res.message || t('loadError'));
      }
    } finally {
      setLoading(false);
    }
  }, [countryCode, debouncedSearch, disabled, session, sessionStatus, t, type]);

  useEffect(() => {
    fetchPorts();
  }, [fetchPorts]);

  const options = useMemo(() => {
    const baseOptions = ports.map(toOption);
    if (value && !ports.some((port) => port._id === value)) {
      return [
        { value, label: legacyText || value },
        ...baseOptions,
      ];
    }
    return baseOptions;
  }, [legacyText, ports, value]);
  const selectedPort = ports.find((port) => port._id === value);
  const showLegacy = !value && legacyText;
  const selectedCountry = useMemo(() => {
    if (!selectedPort) return '';

    return getCountryDisplayName(selectedPort.countryCode, locale) || selectedPort.country;
  }, [locale, selectedPort]);

  return (
    <Space orientation="vertical" size={4} style={{ width: '100%' }}>
      <Select
        allowClear
        showSearch
        value={value || undefined}
        disabled={disabled}
        loading={loading}
        filterOption={false}
        onSearch={setSearch}
        onChange={(nextValue) => {
          const nextPort = ports.find((port) => port._id === nextValue);
          onChange?.(nextValue);
          onPortChange?.(nextPort);
          afterChange?.(nextValue);
        }}
        optionFilterProp="label"
        placeholder={placeholder || t('placeholder')}
        options={options}
        notFoundContent={loading ? t('loading') : loadError || t('notFound')}
        suffixIcon={<EnvironmentOutlined />}
      />
      {showLegacy && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('legacy')}: <Tag>{legacyText}</Tag>
        </Text>
      )}
      {selectedPort && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatPortLabel(selectedPort)} - {selectedCountry}
        </Text>
      )}
    </Space>
  );
}
