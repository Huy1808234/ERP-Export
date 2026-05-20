'use client';

import React, { useMemo } from 'react';
import { Modal } from 'antd';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  Mail,
  PackageCheck,
  ReceiptText,
  Truck,
  Warehouse,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { IGoodsReceipt } from '@/types/goods-receipt';
import { formatDate } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/utils/cn';

interface IProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  data: IGoodsReceipt | null;
}

type MetricTone = 'default' | 'success' | 'danger' | 'warning';

const qualityBadgeClass: Record<string, string> = {
  PASS: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  DAMAGED: 'bg-red-50 text-red-700 ring-red-100',
  WRONG_SPEC: 'bg-amber-50 text-amber-700 ring-amber-100',
  QUARANTINE: 'bg-purple-50 text-purple-700 ring-purple-100',
};

const metricToneClass: Record<MetricTone, string> = {
  default: 'bg-white text-slate-900 ring-slate-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  danger: 'bg-red-50 text-red-700 ring-red-100',
  warning: 'bg-amber-50 text-amber-700 ring-amber-100',
};

const InfoBlock = ({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  highlight?: boolean;
}) => (
  <div className="rounded-xl bg-white p-4 ring-1 ring-slate-100">
    <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
      {icon}
      <span>{label}</span>
    </div>
    <div className={cn('truncate text-sm text-slate-700', highlight && 'text-base font-semibold text-slate-950')}>
      {value || '-'}
    </div>
  </div>
);

const MetricCard = ({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  tone?: MetricTone;
}) => (
  <div className={cn('rounded-xl p-5 ring-1 transition-colors', metricToneClass[tone])}>
    <div className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</div>
    <div className="mt-3 text-2xl font-semibold leading-none">{value}</div>
  </div>
);

const GoodsReceiptDetailModal = (props: IProps) => {
  const t = useTranslations('GoodsReceipt');
  const tCommon = useTranslations('Common');
  const { isOpen, setIsOpen, data } = props;
  const { formatNumber, formatMoney } = useCurrency();

  const grNumber = data?.grNumber || data?.grnNumber || 'N/A';
  const attachmentHref = data?.attachmentUrl
    ? `${process.env.NEXT_PUBLIC_BACKEND_URL}${data.attachmentUrl}`
    : '';

  const summary = useMemo(() => {
    const items = data?.items || [];
    const totalLines = items.length;
    const orderedQty = items.reduce((sum, item) => sum + Number(item.quantityOrdered || 0), 0);
    const receivedQty = items.reduce((sum, item) => sum + Number(item.quantityReceived || 0), 0);
    const rejectedQty = items.reduce((sum, item) => sum + Number(item.quantityRejected || 0), 0);
    const acceptedQty = Math.max(receivedQty - rejectedQty, 0);
    const variance = Math.max(orderedQty - receivedQty, 0);

    return { totalLines, orderedQty, receivedQty, rejectedQty, acceptedQty, variance };
  }, [data?.items]);

  return (
    <Modal
      title={null}
      open={isOpen}
      onCancel={() => setIsOpen(false)}
      footer={null}
      width={1180}
      style={{ top: 20 }}
      styles={{ body: { padding: 0 } }}
    >
      {!data ? (
        <div className="flex min-h-64 items-center justify-center bg-white text-sm text-slate-500">
          {tCommon('loading')}
        </div>
      ) : (
        <div className="bg-white">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
                  <PackageCheck size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">{t('detail.cleanTitle')}</h2>
                  <p className="mt-0.5 text-sm text-slate-500">{t('detail.subtitle')}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pr-8">
              <span className="inline-flex items-center rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 ring-1 ring-blue-100">
                {data.purchaseOrder?.poNumber || 'N/A'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm">
                <CheckCircle2 size={15} />
                {data.status ? t(`status.${data.status}`) : 'N/A'}
              </span>
            </div>
          </div>

          <div className="max-h-[78vh] overflow-y-auto bg-gray-50 px-6 py-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InfoBlock
                label={t('detail.poValue')}
                value={formatMoney(Number(data.purchaseOrder?.totalAmount || 0), data.purchaseOrder?.currency)}
                icon={<ReceiptText size={15} />}
                highlight
              />
              <InfoBlock
                label={t('detail.vendor')}
                value={data.purchaseOrder?.vendor?.name || '-'}
                icon={<Truck size={15} />}
              />
              <InfoBlock
                label={t('detail.dateRange')}
                value={`${formatDate(data.receivedDate)} / ${data.purchaseOrder?.expectedDeliveryDate ? formatDate(data.purchaseOrder.expectedDeliveryDate) : '-'}`}
                icon={<CalendarDays size={15} />}
              />
              <InfoBlock
                label={t('detail.receivedBy')}
                value={data.receivedByUsername || data.receivedBy?.username || 'system'}
                icon={<Mail size={15} />}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <MetricCard label={t('detail.summary.totalLines')} value={formatNumber(summary.totalLines)} />
              <MetricCard label={t('detail.summary.orderedQty')} value={formatNumber(summary.orderedQty)} />
              <MetricCard label={t('detail.summary.receivedQty')} value={formatNumber(summary.receivedQty)} />
              <MetricCard label={t('detail.summary.acceptedQty')} value={formatNumber(summary.acceptedQty)} tone="success" />
              <MetricCard
                label={t('detail.summary.rejectedQty')}
                value={formatNumber(summary.rejectedQty)}
                tone={summary.rejectedQty > 0 ? 'danger' : 'default'}
              />
              <MetricCard
                label={t('detail.summary.variance')}
                value={formatNumber(summary.variance)}
                tone={summary.variance > 0 ? 'warning' : 'default'}
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl bg-white p-4 ring-1 ring-slate-100">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Warehouse size={16} />
                  {t('detail.warehouseName')}
                </div>
                <div className="space-y-2 text-sm text-slate-600">
                  <div>{data.warehouseName || '-'}</div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">{data.warehouseLocation || '-'}</div>
                </div>
              </div>

              <div className="rounded-xl bg-white p-4 ring-1 ring-slate-100">
                <div className="mb-3 text-sm font-semibold text-slate-800">{t('detail.deliveryNoteNumber')}</div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <FileText size={16} className="text-slate-400" />
                  <span>{data.deliveryNoteNumber || '-'}</span>
                </div>
                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {data.note || '---'}
                </div>
              </div>

              <div className="rounded-xl bg-white p-4 ring-1 ring-slate-100">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <FileText size={16} />
                    {t('detail.attachmentsTitle')}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-3">
                  {data.attachmentUrl ? (
                    <>
                      <div className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
                        <FileText size={16} className="shrink-0 text-slate-400" />
                        <span className="truncate">{t('detail.attachmentAvailable')}</span>
                      </div>
                      <a
                        href={attachmentHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-blue-600 ring-1 ring-blue-100 transition hover:bg-blue-50"
                      >
                        <Download size={14} />
                        {t('detail.openAttachment')}
                      </a>
                    </>
                  ) : (
                    <span className="text-sm text-slate-400">{t('detail.noAttachment')}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-white p-4 ring-1 ring-slate-100">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-950">{t('detail.itemsDivider')}</h3>
                  <p className="mt-1 text-sm text-slate-500">{grNumber}</p>
                </div>
                {(summary.rejectedQty > 0 || summary.variance > 0) && (
                  <div className="hidden items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 ring-1 ring-amber-100 sm:flex">
                    <AlertTriangle size={16} />
                    {t('detail.hasVariance')}
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="rounded-l-lg bg-slate-50 px-4 py-3">{t('detail.columns.product')}</th>
                      <th className="bg-slate-50 px-4 py-3 text-right">{t('detail.columns.qtyOrdered')}</th>
                      <th className="bg-slate-50 px-4 py-3 text-right">{t('detail.columns.qtyReceived')}</th>
                      <th className="bg-slate-50 px-4 py-3 text-right">{t('detail.columns.qtyRejected')}</th>
                      <th className="bg-slate-50 px-4 py-3 text-right">{t('detail.columns.qtyAccepted')}</th>
                      <th className="bg-slate-50 px-4 py-3">{t('detail.columns.qualityStatus')}</th>
                      <th className="bg-slate-50 px-4 py-3">{t('detail.columns.lotNumber')}</th>
                      <th className="rounded-r-lg bg-slate-50 px-4 py-3">{t('detail.columns.reason')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.items || []).map((item) => {
                      const rejected = Number(item.quantityRejected || 0);
                      const accepted = Math.max(Number(item.quantityReceived || 0) - rejected, 0);
                      const qualityStatus = item.qualityStatus || 'PASS';

                      return (
                        <tr key={item._id} className="group transition hover:bg-slate-50">
                          <td className="border-b border-slate-100 px-4 py-4">
                            <div className="font-semibold text-slate-900">{item.product?.vietnameseName || '-'}</div>
                            <div className="mt-1 text-xs text-slate-400">SKU: {item.product?.sku || '-'}</div>
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right font-medium text-slate-700">
                            {formatNumber(Number(item.quantityOrdered || 0))}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right font-semibold text-slate-900">
                            {formatNumber(Number(item.quantityReceived || 0))}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right font-semibold text-red-600">
                            {formatNumber(rejected)}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-right font-semibold text-slate-900">
                            {formatNumber(accepted)}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4">
                            <span className={cn('inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ring-1', qualityBadgeClass[qualityStatus] || 'bg-slate-50 text-slate-700 ring-slate-100')}>
                              {t(`modal.quality.${qualityStatus}`)}
                            </span>
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4">
                            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                              {item.lotNumber || '-'}
                            </span>
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-slate-600">
                            <div className="max-w-[260px] truncate">{item.rejectionReason || '-'}</div>
                            {item.lineNote && <div className="mt-1 text-xs text-slate-400">{item.lineNote}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default GoodsReceiptDetailModal;
