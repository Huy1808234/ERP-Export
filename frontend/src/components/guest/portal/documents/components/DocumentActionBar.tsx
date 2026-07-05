import { type CSSProperties } from 'react';
import { Space, Typography, Button, Tooltip, Dropdown } from 'antd';
import {
  DownloadOutlined,
  EditOutlined,
  FilePdfOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileProtectOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { DISABLED_REASON_MAP } from '../document.constants';
import type { CustomerCommercialDocument } from '@/types/customer-portal';

const { Text } = Typography;

const actionBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 12,
  border: '1px solid rgba(148, 163, 184, 0.2)',
  borderRadius: 12,
  padding: 14,
  background: 'rgba(2, 6, 23, 0.22)',
};

const actionGroupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
};

type DocumentActionBarProps = {
  document: CustomerCommercialDocument;
  downloading: boolean;
  onDownloadPdf: (document: CustomerCommercialDocument) => Promise<void>;
  onAccept: () => void;
  onReject: () => void;
  onRequestRevision: () => void;
  onRequestSigning: () => void;
};

export const DocumentActionBar = ({
  document,
  downloading,
  onDownloadPdf,
  onAccept,
  onReject,
  onRequestRevision,
  onRequestSigning,
}: DocumentActionBarProps) => {
  const t = useTranslations('CustomerPortal');

  const disabledActionReason = document.actions.disabledReason
    ? DISABLED_REASON_MAP[document.actions.disabledReason]
      ? t(`documentDetail.disabledReasons.${DISABLED_REASON_MAP[document.actions.disabledReason]}`)
      : document.actions.disabledReason
    : t('documentDetail.unavailableAction');

  const isQuotation = document.documentType === 'QUOTATION';
  const isPendingSignature = document.status === 'PENDING_BUYER_SIGNATURE';
  const canSignInPortal = document.documentType === 'SALES_CONTRACT' && isPendingSignature;

  return (
    <div style={actionBarStyle}>
      <Space orientation="vertical" size={2}>
        <Text strong>{t(`documentTypes.${document.documentType}`)}</Text>
        <Text type="secondary">{document.documentNumber}</Text>
      </Space>
      <div style={actionGroupStyle}>
        <Tooltip title={isQuotation ? t('documentDetail.quotationOnlyPdf') : t('documentDetail.downloadPdf')}>
          <Button
            icon={<DownloadOutlined />}
            loading={downloading}
            onClick={() => onDownloadPdf(document)}
          >
            {t('documentDetail.exportPdf')}
          </Button>
        </Tooltip>

        {isQuotation ? (
          <>
            <Tooltip title={!document.actions.canRequestRevision ? disabledActionReason : ''}>
              <Button
                icon={<HistoryOutlined />}
                disabled={!document.actions.canRequestRevision}
                onClick={onRequestRevision}
              >
                {t('documentDetail.requestRevision')}
              </Button>
            </Tooltip>
            <Tooltip title={!document.actions.canReject ? disabledActionReason : ''}>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                disabled={!document.actions.canReject}
                onClick={onReject}
              >
                {t('documentDetail.reject')}
              </Button>
            </Tooltip>
            <Tooltip title={!document.actions.canAccept ? disabledActionReason : ''}>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                disabled={!document.actions.canAccept}
                onClick={onAccept}
              >
                {t('documentDetail.accept')}
              </Button>
            </Tooltip>
          </>
        ) : null}

        {canSignInPortal && (
          <Tooltip title={t('documentDetail.signNowDescription')}>
            <Button
              type="primary"
              icon={<FileProtectOutlined />}
              onClick={onRequestSigning}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
            >
              {t('documentDetail.signNow')}
            </Button>
          </Tooltip>
        )}

        {!canSignInPortal && document.documentType === 'SALES_CONTRACT' && document.signatureStatus === 'PENDING_SIGNATURE' && (
          <Dropdown
            menu={{
              items: [
                {
                  key: 'request_signature',
                  label: t('documentDetail.signatureActions'),
                  icon: <EditOutlined />,
                  disabled: true,
                },
                {
                  key: 'download_pdf',
                  label: t('documentDetail.downloadPdf'),
                  icon: <FilePdfOutlined />,
                  onClick: () => onDownloadPdf(document),
                },
              ],
            }}
          >
            <Button type="primary">{t('documentDetail.signatureActions')}</Button>
          </Dropdown>
        )}
      </div>
    </div>
  );
};
