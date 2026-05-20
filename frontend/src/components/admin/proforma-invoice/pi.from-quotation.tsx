'use client'

import {
  Button,
  Form,
  InputNumber,
  Modal,
  Select,
  Input,
  Typography,
  Divider,
  Tag,
  App,
  Row,
  Col,
  Space,
  Card,
  theme,
} from 'antd';
import { 
  ThunderboltOutlined, 
  InfoCircleOutlined, 
  BankOutlined, 
  ClockCircleOutlined, 
  CreditCardOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { getSession } from 'next-auth/react';
import { Clock, DollarSign, FileText, Zap } from 'lucide-react';
import { sendRequest } from '@/lib/api-client';
import { useTranslations } from 'next-intl';
import { getAccessToken } from '@/lib/auth-token';

const { Text, Title } = Typography;

interface IProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  quotation: any;
  onSuccess: () => void;
}

/**
 * Senior Thought:
 * 1. Separation of concerns: Logic calculations are separated from JSX.
 * 2. Pre-validation: Using useMemo to provide real-time financial feedback.
 * 3. UX: Grouping related fields and providing clear hierarchy.
 */
const PIFromQuotationModal = ({ open, setOpen, quotation, onSuccess }: IProps) => {
  const { notification } = App.useApp();
  const tPI = useTranslations('ProformaInvoice');
  const tInc = useTranslations('Incoterms');
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [bankDetailPreview, setBankDetailPreview] = useState<string>('');

  const paymentTermsOptions = [
    { label: '30% T/T Deposit, 70% after B/L', value: 'TT_30_70_BL' },
    { label: '100% T/T Advance', value: 'TT_100_ADVANCE' },
    { label: 'L/C at sight', value: 'LC_AT_SIGHT' },
    { label: '30% T/T Deposit, 70% before Shipment', value: 'TT_30_70_SHIPMENT' },
    { label: 'CAD (Cash Against Documents)', value: 'CAD' },
  ];

  const bankOptions = [
    { 
      label: 'VIETCOMBANK - ABC IMPORT EXPORT', 
      value: 'VCB_ABC', 
      fullInfo: 'Bank Name: VIETCOMBANK\nBeneficiary: CÔNG TY TNHH XUẤT NHẬP KHẨU ABC\nAccount Number: 0123456789\nSwift Code: BFTVVNVX' 
    },
    { 
      label: 'BIDV - ABC IMPORT EXPORT', 
      value: 'BIDV_ABC', 
      fullInfo: 'Bank Name: BIDV\nBeneficiary: CÔNG TY TNHH XUẤT NHẬP KHẨU ABC\nAccount Number: 9876543210\nSwift Code: BIDVVNVX' 
    }
  ];

  useEffect(() => {
    const fetchBankInfo = async () => {
      const currentSession = await getSession();
      const accessToken = getAccessToken(currentSession);
      if (accessToken && open && quotation && !form.getFieldValue('bankInfo')) {
        const bankSetting = await sendRequest<IBackendRes<any>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/settings/COMPANY_BANK_INFO`,
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (bankSetting?.data?.value) {
          form.setFieldValue('bankInfo', 'VCB_ABC'); // Default to VCB for demo
          setBankDetailPreview(bankOptions[0].fullInfo);
        }
      }
    };

    if (open && quotation) {
      // SENIOR LOGIC: Advanced Payment Term Mapping (Key & Label)
      let detectedPercent = 30; // Default
      const terms = quotation.paymentTerms || '';
      
      if (terms.includes('100')) {
        detectedPercent = 100;
      } else if (terms.includes('30_70') || terms.includes('30%')) {
        detectedPercent = 30;
      } else if (terms.includes('CAD') || terms.includes('LC_AT_SIGHT')) {
        detectedPercent = 0; // Usually no deposit for LC/CAD if handled via bank
      }

      form.setFieldsValue({
        depositPercent: detectedPercent,
        paymentTerms: quotation.paymentTerms,
        deliveryTime: quotation.deliveryTime ?? '30-45 working days after receiving deposit',
        logisticsFee: quotation.logisticsFee || 0,
        otherFee: quotation.otherFee || 0,
        domesticTransportCost: quotation.domesticTransportCost || 0,
        portCharges: quotation.portCharges || 0,
        seaFreight: quotation.seaFreight || 0,
        insuranceCost: quotation.insuranceCost || 0,
        bankInfo: quotation.bankInfo,
      });
      fetchBankInfo();
    }
  }, [open, quotation, form]);

  const handleClose = () => {
    form.resetFields();
    setOpen(false);
  };

  // Watch form values for real-time calculations
  const depositPercent = Form.useWatch('depositPercent', form) ?? 30;
  const watchedLogisticsFee = Form.useWatch('logisticsFee', form) || 0;
  const watchedOtherFee = Form.useWatch('otherFee', form) || 0;
  const watchedSeaFreight = Form.useWatch('seaFreight', form) || 0;
  const watchedInsurance = Form.useWatch('insuranceCost', form) || 0;
  const watchedDomestic = Form.useWatch('domesticTransportCost', form) || 0;
  const watchedPort = Form.useWatch('portCharges', form) || 0;

  // Real-time financial calculations
  const financialSummary = useMemo(() => {
    if (!quotation) return { subTotal: 0, currentTotal: 0, depositAmount: 0 };
    
    const subTotal = parseFloat(quotation.totalAmount ?? 0) - (quotation.logisticsFee || 0) - (quotation.otherFee || 0);
    const currentTotal = subTotal + 
                        Number(watchedLogisticsFee) + 
                        Number(watchedOtherFee) +
                        Number(watchedSeaFreight) +
                        Number(watchedInsurance) +
                        Number(watchedDomestic) +
                        Number(watchedPort);
    const depositAmount = (currentTotal * depositPercent) / 100;
    
    return { subTotal, currentTotal, depositAmount };
  }, [quotation, depositPercent, watchedLogisticsFee, watchedOtherFee, watchedSeaFreight, watchedInsurance, watchedDomestic, watchedPort]);

  const onFinish = async (values: any) => {
    setSubmitting(true);
    try {
      const currentSession = await getSession();
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/proforma-invoices/from-quotation`,
        method: 'POST',
        body: {
          quotationId: quotation._id,
          ...values,
          depositAmount: financialSummary.depositAmount
        },
        headers: { Authorization: `Bearer ${getAccessToken(currentSession)}` },
      });

      if (res?.data) {
        notification.success({ 
          title: tPI('createFromQuotation.notifications.success'),
          description: tPI('createFromQuotation.notifications.successDetail', { piNumber: res.data.piNumber, quotationNumber: quotation.quotationNumber })
        });
        handleClose();
        onSuccess();
      } else {
        notification.error({ 
          title: tPI('createFromQuotation.notifications.error'), 
          description: res?.message || tPI('createFromQuotation.notifications.errorDetail') 
        });
      }
    } catch (error) {
      notification.error({ title: tPI('createFromQuotation.notifications.systemError'), description: tPI('createFromQuotation.notifications.connectionError') });
    } finally {
      setSubmitting(false);
    }
  };

  if (!quotation) return null;

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Zap size={20} className="text-blue-600" />
          <span className="text-lg font-semibold text-slate-800">{tPI('createFromQuotation.modalTitle')}</span>
        </div>
      }
      open={open}
      onOk={() => form.submit()}
      onCancel={handleClose}
      centered
      width={800}
      confirmLoading={submitting}
      okText={tPI('createFromQuotation.okText')}
      cancelText={tPI('createFromQuotation.cancelText')}
      okButtonProps={{ 
        className: "bg-blue-600 hover:bg-blue-700 h-11 px-8 rounded-lg font-semibold border-none" 
      }}
      cancelButtonProps={{ 
        className: "h-11 rounded-lg border-slate-200 text-slate-600 hover:text-slate-800" 
      }}
    >
      <div className="py-4 space-y-6">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{tPI('createFromQuotation.baseQuotation')}</span>
            <span className="text-sm font-bold text-slate-700">{quotation.quotationNumber}</span>
          </div>
          <div className="flex flex-col gap-1 border-x border-slate-200 px-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{tPI('createFromQuotation.customer')}</span>
            <span className="text-sm font-semibold text-slate-600 truncate">{quotation.customer?.name}</span>
          </div>
          <div className="flex flex-col gap-1 items-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{tPI('createFromQuotation.terms')}</span>
            <Tag color="purple" className="m-0 rounded-md font-bold border-none bg-purple-100 text-purple-700 px-3 py-0.5">
              {quotation.incoterm ? tInc(quotation.incoterm) : '-'}
            </Tag>
          </div>
        </div>

        <Form 
          form={form} 
          layout="vertical" 
          onFinish={onFinish} 
          requiredMark={false}
          className="space-y-6"
          onValuesChange={(changedValues) => {
            if (changedValues.paymentTerms) {
              const term = changedValues.paymentTerms;
              let newPercent = 30;
              if (term.includes('100')) newPercent = 100;
              else if (term.includes('30_70') || term.includes('30%')) newPercent = 30;
              else if (term.includes('CAD') || term.includes('LC_AT_SIGHT')) newPercent = 0;
              form.setFieldsValue({ depositPercent: newPercent });
            }
          }}
        >
          <div>
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px]">1</span>
              {tPI('createFromQuotation.sections.finance')}
            </h3>
            
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <Form.Item
                label={<span className="text-slate-600 font-medium">{tPI('createFromQuotation.form.depositPercent')}</span>}
                name="depositPercent"
                className="mb-4"
              >
                <InputNumber
                  min={0}
                  max={100}
                  className="w-full h-10 rounded-lg text-right pr-2"
                  suffix={<span className="text-slate-400 font-bold">%</span>}
                />
              </Form.Item>

              <Form.Item 
                label={<span className="text-slate-600 font-medium">{tPI('createFromQuotation.form.seaFreight')}</span>} 
                name="seaFreight"
              >
                <InputNumber 
                  className="w-full h-10 rounded-lg text-right" 
                  min={0}
                  prefix={<span className="text-slate-400 text-xs">{quotation.currency}</span>}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>

              <Form.Item 
                label={<span className="text-slate-600 font-medium">{tPI('createFromQuotation.form.insurance')}</span>} 
                name="insuranceCost"
              >
                <InputNumber 
                  className="w-full h-10 rounded-lg text-right" 
                  min={0}
                  prefix={<span className="text-slate-400 text-xs">{quotation.currency}</span>}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>

              <Form.Item 
                label={<span className="text-slate-600 font-medium">{tPI('createFromQuotation.form.domesticTransport')}</span>} 
                name="domesticTransportCost"
              >
                <InputNumber 
                  className="w-full h-10 rounded-lg text-right" 
                  min={0}
                  prefix={<span className="text-slate-400 text-xs">{quotation.currency}</span>}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>

              <Form.Item 
                label={<span className="text-slate-600 font-medium">{tPI('createFromQuotation.form.portCharges')}</span>} 
                name="portCharges"
              >
                <InputNumber 
                  className="w-full h-10 rounded-lg text-right" 
                  min={0}
                  prefix={<span className="text-slate-400 text-xs">{quotation.currency}</span>}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>

              <Form.Item 
                label={<span className="text-slate-600 font-medium">{tPI('createFromQuotation.form.otherFee')}</span>} 
                name="otherFee"
              >
                <InputNumber 
                  className="w-full h-10 rounded-lg text-right" 
                  min={0}
                  prefix={<span className="text-slate-400 text-xs">{quotation.currency}</span>}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </div>

            <div className="mt-2 bg-blue-50 border border-blue-100 rounded-xl p-5 flex justify-between items-center shadow-sm">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{tPI('createFromQuotation.summary.depositTitle')}</p>
                <p className="text-lg font-bold text-slate-700">
                  <span className="text-sm font-normal text-slate-400 mr-1">{quotation.currency}</span>
                  {financialSummary.depositAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{tPI('createFromQuotation.summary.totalTitle')}</p>
                <p className="text-2xl font-black text-blue-600 tracking-tight">
                  <span className="text-sm font-medium text-blue-400 mr-2">{quotation.currency}</span>
                  {financialSummary.currentTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px]">2</span>
              {tPI('createFromQuotation.sections.payment')}
            </h3>

            <div className="grid grid-cols-2 gap-6 mb-4">
              <Form.Item
                label={<span className="text-slate-600 font-medium">{tPI('createFromQuotation.form.paymentTerms')}</span>}
                name="paymentTerms"
                rules={[{ required: true }]}
              >
                <Select
                  options={paymentTermsOptions}
                  className="w-full h-10 rounded-lg"
                  placeholder={tPI('createFromQuotation.form.paymentTermsPlaceholder')}
                />
              </Form.Item>

              <Form.Item
                label={<span className="text-slate-600 font-medium">{tPI('createFromQuotation.form.deliveryTime')}</span>}
                name="deliveryTime"
              >
                <Input 
                  prefix={<Clock size={16} className="text-slate-400" />}
                  className="w-full h-10 rounded-lg"
                  placeholder={tPI('createFromQuotation.form.deliveryTimePlaceholder')}
                />
              </Form.Item>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <Form.Item
                label={<span className="text-slate-600 font-medium">{tPI('createFromQuotation.form.bankAccount')}</span>}
                name="bankInfo"
              >
                <Select
                  placeholder={tPI('createFromQuotation.form.bankAccountPlaceholder')}
                  className="w-full h-10"
                  options={bankOptions}
                  onChange={(val) => {
                    const selected = bankOptions.find(b => b.value === val);
                    if (selected) setBankDetailPreview(selected.fullInfo);
                  }}
                />
              </Form.Item>

              {bankDetailPreview && (
                <div className="bg-slate-50 border border-slate-200 border-dashed rounded-lg p-4 text-[13px] text-slate-500 leading-relaxed">
                  <pre className="font-sans whitespace-pre-wrap m-0">{bankDetailPreview}</pre>
                </div>
              )}

              <Form.Item
                label={<span className="text-slate-600 font-medium">{tPI('createFromQuotation.form.note')}</span>}
                name="note"
              >
                <Input.TextArea
                  rows={3}
                  className="rounded-lg"
                  placeholder={tPI('createFromQuotation.form.notePlaceholder')}
                />
              </Form.Item>
            </div>
          </div>
        </Form>
      </div>
    </Modal>
  );
};

export default PIFromQuotationModal;
