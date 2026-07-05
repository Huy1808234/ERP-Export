'use client';

import { type ReactNode, useState } from 'react';
import { App, Collapse, Divider, Drawer, Empty, Space, Typography, Input, Modal, Form } from 'antd';
import {
  FileTextOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';

import type { CustomerCommercialDocument, CustomerTimelineItem } from '@/types/customer-portal';
import { DocumentHeader } from './DocumentHeader';
import { DocumentActionBar } from './DocumentActionBar';
import { DocumentSummary, DocumentTerms } from './DocumentSummary';
import { DocumentLineItems } from './DocumentLineItems';
import { DocumentAttachments } from './DocumentAttachments';
import { DocumentTimeline } from './DocumentTimeline';
import { DocumentAuditLogs } from './DocumentAuditLogs';
import { ContractSigningModal } from '../signing/ContractSigningModal';
import { MissingSignerEmailModal } from '../signing/MissingSignerEmailModal';
import { useContractSigning } from '../signing/useContractSigning';

const { Text } = Typography;

const sectionStyle = {
  border: '1px solid rgba(148, 163, 184, 0.24)',
  borderRadius: 12,
  padding: 20,
  background: 'rgba(15, 23, 42, 0.22)',
};

const sectionHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 12,
};

const SectionHeader = ({ icon, title, extra }: { icon?: ReactNode; title: string; extra?: ReactNode }) => (
  <div style={sectionHeaderStyle}>
    <Space size={8}>
      {icon}
      <Text strong>{title}</Text>
    </Space>
    {extra}
  </div>
);

type CommercialDocumentDetailDrawerProps = {
  open: boolean;
  document: CustomerCommercialDocument | null;
  timeline: CustomerTimelineItem[];
  loading: boolean;
  submitting: boolean;
  downloading: boolean;
  onClose: () => void;
  onAccept: (recordId: string) => Promise<void>;
  onReject: (recordId: string, reason: string) => Promise<void>;
  onRequestRevision: (recordId: string, reason: string) => Promise<void>;
  onDownloadPdf: (document: CustomerCommercialDocument) => Promise<void>;
  onRequestSigning?: (recordId: string, signerEmail?: string) => Promise<{ success: boolean; signingToken?: string; signingUrl?: string; message?: string }>;
};

export function CommercialDocumentDetailDrawer({
  open,
  document,
  timeline,
  loading,
  submitting,
  downloading,
  onClose,
  onAccept,
  onReject,
  onRequestRevision,
  onDownloadPdf,
  onRequestSigning,
}: CommercialDocumentDetailDrawerProps) {
  const { modal } = App.useApp();
  const t = useTranslations('CustomerPortal');

  const [rejectOpen, setRejectOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [reason, setReason] = useState('');

  const contractSigningHook = useContractSigning({ document, onRequestSigning });

  const handleAccept = () => {
    if (!document) return;
    modal.confirm({
      title: t('documentDetail.acceptQuotationTitle', { documentNumber: document.documentNumber }),
      content: t('documentDetail.acceptQuotationContent'),
      okText: t('documentDetail.accept'),
      onOk: () => onAccept(document._id),
    });
  };

  const handleReasonSubmit = async () => {
    if (!document || !reason.trim()) return;
    if (rejectOpen) {
      await onReject(document._id, reason.trim());
    } else {
      await onRequestRevision(document._id, reason.trim());
    }
    setReason('');
    setRejectOpen(false);
    setRevisionOpen(false);
  };

  return (
    <>
      <Drawer
        title={<DocumentHeader document={document} />}
        open={open}
        onClose={onClose}
        size="large"
        loading={loading}
        styles={{
          header: { padding: '16px 24px' },
          body: { padding: 24 },
        }}
      >
        {!document ? (
          <Empty description={t('documentDetail.selectDocument')} />
        ) : (
          <Space orientation="vertical" size={24} style={{ width: '100%' }}>
            
            <DocumentActionBar
              document={document}
              downloading={downloading}
              onDownloadPdf={onDownloadPdf}
              onAccept={handleAccept}
              onReject={() => setRejectOpen(true)}
              onRequestRevision={() => setRevisionOpen(true)}
              onRequestSigning={() => contractSigningHook.actions.handleRequestSigning()}
            />

            <DocumentSummary document={document} />

            <div style={sectionStyle}>
              <SectionHeader icon={<InfoCircleOutlined />} title={t('documentDetail.terms')} />
              <DocumentTerms document={document} />
            </div>

            <div style={sectionStyle}>
              <SectionHeader
                icon={<FileTextOutlined />}
                title={t('documentDetail.lineItems')}
              />
              <DocumentLineItems document={document} />
            </div>

            <Collapse
              ghost
              items={[
                {
                  key: 'attachments',
                  label: (
                    <Space size={8}>
                      <PaperClipOutlined />
                      <Text strong>{t('documentDetail.attachments')}</Text>
                      {document.attachments && document.attachments.length > 0 && (
                        <div
                          style={{
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: '#3b82f6',
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {document.attachments.length}
                        </div>
                      )}
                    </Space>
                  ),
                  children: <DocumentAttachments document={document} />,
                },
              ]}
            />
            <Divider style={{ margin: '8px 0' }} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
              <div>
                <SectionHeader icon={<HistoryOutlined />} title={t('documentDetail.timeline')} />
                <div style={{ padding: '12px 0 0 16px' }}>
                  <DocumentTimeline timeline={timeline} />
                </div>
              </div>

              <div>
                <SectionHeader
                  icon={<HistoryOutlined />}
                  title={t('documentDetail.auditLogs')}
                  extra={<Text type="secondary" style={{ fontSize: 12 }}>{t('documentDetail.auditLogHint')}</Text>}
                />
                <DocumentAuditLogs auditLogs={document.auditLogs || []} />
              </div>
            </div>
          </Space>
        )}
      </Drawer>

      <Modal
        title={rejectOpen ? t('documentDetail.rejectQuotation') : t('documentDetail.requestQuotationRevision')}
        open={rejectOpen || revisionOpen}
        onOk={handleReasonSubmit}
        onCancel={() => {
          setRejectOpen(false);
          setRevisionOpen(false);
          setReason('');
        }}
        confirmLoading={submitting}
        okButtonProps={{ disabled: !reason.trim(), danger: rejectOpen }}
        okText={rejectOpen ? t('documentDetail.reject') : t('documentDetail.requestRevision')}
        destroyOnHidden
      >
        <Input.TextArea
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('documentDetail.reasonPlaceholder')}
          disabled={submitting}
        />
      </Modal>

      <ContractSigningModal hookParams={contractSigningHook} />
      <MissingSignerEmailModal hookParams={contractSigningHook} />
    </>
  );
}
