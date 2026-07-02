'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    App,
    Badge,
    Button,
    DatePicker,
    Descriptions,
    Divider,
    Drawer,
    Form,
    Input,
    InputNumber,
    Modal,
    Select,
    Space,
    Table,
    Tabs,
    Tag,
    Typography,
    Upload,
    theme,
} from 'antd';
import {
    CheckCircleOutlined,
    DownloadOutlined,
    EyeOutlined,
    FileAddOutlined,
    FileDoneOutlined,
    FilePdfOutlined,
    FormOutlined,
    ReloadOutlined,
    ShareAltOutlined,
    UploadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload/interface';
import { useTranslations } from 'next-intl';
import { backendFetch, sendRequest, sendRequestFile } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';
import PortSelect from '@/components/admin/ports/PortSelect';
import { formatPortLabel, type IPort } from '@/services/port.service';

const { Text } = Typography;

type SessionTokenShape = {
    accessToken?: string | null;
} | null | undefined;

type DocumentTypeValue =
    | 'COMMERCIAL_INVOICE'
    | 'PACKING_LIST'
    | 'PROFORMA_INVOICE'
    | 'BILL_OF_LADING'
    | 'AIRWAY_BILL'
    | 'CERTIFICATE_OF_ORIGIN'
    | 'PACKING_DECLARATION'
    | 'CUSTOMS_DECLARATION'
    | 'PHYTOSANITARY_CERTIFICATE'
    | 'HEALTH_CERTIFICATE'
    | 'FUMIGATION_CERTIFICATE'
    | 'QUALITY_INSPECTION_CERTIFICATE'
    | 'VAT_REFUND_DOSSIER'
    | 'OTHER';

type ChecklistStatus =
    | 'MISSING'
    | 'DRAFT'
    | 'UPLOADED'
    | 'GENERATED'
    | 'REVIEWED'
    | 'APPROVED'
    | 'EXPIRED'
    | 'NOT_APPLICABLE';

type ExportDocumentAuditEvent = {
    action: string;
    username: string;
    at: string;
    note?: string | null;
    fileName?: string | null;
    fileUrl?: string | null;
    fileAsset_id?: string | null;
    versionNo?: number;
    checklistStatus?: ChecklistStatus;
};

type ExportDocumentRecord = {
    _id: string;
    documentType: DocumentTypeValue;
    documentNumber?: string | null;
    versionNo: number;
    isCurrentVersion: boolean;
    checklistStatus: ChecklistStatus;
    fileName?: string | null;
    originalFileName?: string | null;
    mimeType?: string | null;
    fileSize?: number;
    fileUrl?: string | null;
    fileAsset_id?: string | null;
    businessData?: Record<string, unknown> | null;
    auditTrail?: ExportDocumentAuditEvent[] | null;
    uploadedByUsername?: string | null;
    reviewedByUsername?: string | null;
    sharedWithBuyer?: boolean;
    notes?: string | null;
    createdAt?: string;
};

type ChecklistRow = {
    documentType: DocumentTypeValue;
    label: string;
    required: boolean;
    status: ChecklistStatus;
    document?: ExportDocumentRecord | null;
};

type DocumentCenter = {
    shipment?: {
        _id: string;
        shipmentNumber?: string;
        status?: string;
        pol?: string;
        pod?: string;
        blNumber?: string;
        salesContract?: {
            contractNumber?: string;
        } | null;
    };
    checklist?: ChecklistRow[];
    documents?: ExportDocumentRecord[];
    vatRefundDossier?: {
        ready: boolean;
    };
};

type RegisterDocumentValues = {
    documentType: DocumentTypeValue;
    documentNumber?: string;
    fileName?: string;
    fileUrl?: string;
    customsDeclarationNumber?: string;
    notes?: string;
    businessData?: Record<string, unknown>;
};

type UploadedDocumentFile = {
    _id: string;
    fileName: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
};

interface IProps {
    open: boolean;
    onClose: () => void;
    shipmentId: string | null;
    session: SessionTokenShape;
}

type DocCenterLabels = {
  docCommercialInvoice: string;
  docPackingList: string;
  docProformaInvoice: string;
  docBillOfLading: string;
  docAirwayBill: string;
  docCertificateOfOrigin: string;
  docCustomsDeclaration: string;
  docPackingDeclaration: string;
  docPhytosanitary: string;
  docHealth: string;
  docFumigation: string;
  docQualityInspection: string;
  docVatRefund: string;
  docOther: string;
  statusMissing: string;
  statusDraft: string;
  statusUploaded: string;
  statusGenerated: string;
  statusReviewed: string;
  statusApproved: string;
  statusExpired: string;
  statusNotApplicable: string;
  actionVersionCreated: string;
  actionFileUploaded: string;
  actionGenerated: string;
  actionReviewed: string;
  actionShared: string;
  actionUnshared: string;
  actionDownloaded: string;
  requiredMessage: string;
};

const buildDocumentOptions = (l: DocCenterLabels): Array<{ value: DocumentTypeValue; label: string }> => [
  { value: 'COMMERCIAL_INVOICE', label: l.docCommercialInvoice },
  { value: 'PACKING_LIST', label: l.docPackingList },
  { value: 'PROFORMA_INVOICE', label: l.docProformaInvoice },
  { value: 'BILL_OF_LADING', label: l.docBillOfLading },
  { value: 'AIRWAY_BILL', label: l.docAirwayBill },
  { value: 'CERTIFICATE_OF_ORIGIN', label: l.docCertificateOfOrigin },
  { value: 'CUSTOMS_DECLARATION', label: l.docCustomsDeclaration },
  { value: 'PACKING_DECLARATION', label: l.docPackingDeclaration },
  { value: 'PHYTOSANITARY_CERTIFICATE', label: l.docPhytosanitary },
  { value: 'HEALTH_CERTIFICATE', label: l.docHealth },
  { value: 'FUMIGATION_CERTIFICATE', label: l.docFumigation },
  { value: 'QUALITY_INSPECTION_CERTIFICATE', label: l.docQualityInspection },
  { value: 'VAT_REFUND_DOSSIER', label: l.docVatRefund },
  { value: 'OTHER', label: l.docOther },
];

const buildStatusLabel = (l: DocCenterLabels): Record<ChecklistStatus, string> => ({
  MISSING: l.statusMissing,
  DRAFT: l.statusDraft,
  UPLOADED: l.statusUploaded,
  GENERATED: l.statusGenerated,
  REVIEWED: l.statusReviewed,
  APPROVED: l.statusApproved,
  EXPIRED: l.statusExpired,
  NOT_APPLICABLE: l.statusNotApplicable,
});

const buildActionLabel = (l: DocCenterLabels): Record<string, string> => ({
  VERSION_CREATED: l.actionVersionCreated,
  FILE_UPLOADED: l.actionFileUploaded,
  GENERATED: l.actionGenerated,
  REVIEWED: l.actionReviewed,
  SHARED: l.actionShared,
  UNSHARED: l.actionUnshared,
  DOWNLOADED: l.actionDownloaded,
});

const BUSINESS_DOCUMENT_TYPES: DocumentTypeValue[] = [
    'BILL_OF_LADING',
    'AIRWAY_BILL',
    'CERTIFICATE_OF_ORIGIN',
    'CUSTOMS_DECLARATION',
    'PACKING_DECLARATION',
    'PHYTOSANITARY_CERTIFICATE',
    'HEALTH_CERTIFICATE',
    'FUMIGATION_CERTIFICATE',
    'QUALITY_INSPECTION_CERTIFICATE',
];

const STATUS_COLOR: Record<ChecklistStatus, string> = {
    MISSING: 'red',
    DRAFT: 'default',
    UPLOADED: 'blue',
    GENERATED: 'cyan',
    REVIEWED: 'purple',
    APPROVED: 'green',
    EXPIRED: 'volcano',
    NOT_APPLICABLE: 'default',
};

const isBusinessDocumentType = (documentType?: DocumentTypeValue) => (
    !!documentType && BUSINESS_DOCUMENT_TYPES.includes(documentType)
);

const getRecordString = (record: Record<string, unknown> | undefined, key: string) => {
    const value = record?.[key];
    if (value === null || value === undefined || value === '') return undefined;
    return String(value);
};

const serializeFormValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map((item) => serializeFormValue(item));
    if (value && typeof value === 'object') {
        const maybeDate = value as { toISOString?: () => string };
        if (typeof maybeDate.toISOString === 'function') return maybeDate.toISOString();

        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, serializeFormValue(item)]),
        );
    }
    return value;
};

const resolveFileUrl = (fileUrl?: string | null) => {
    if (!fileUrl) return undefined;
    if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
    return `${baseUrl}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
};

const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
};

const formatFieldValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '-';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

const humanizeKey = (key: string) => (
    key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (char) => char.toUpperCase())
);

const ShipmentDocCenter = ({ open, onClose, shipmentId, session }: IProps) => {
    const t = useTranslations('ShipmentDocCenter');
    const { notification } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [center, setCenter] = useState<DocumentCenter | null>(null);
    const [registerOpen, setRegisterOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
    const [form] = Form.useForm<RegisterDocumentValues>();
    const { token } = theme.useToken();

    const docLabels = useMemo<DocCenterLabels>(() => ({
      docCommercialInvoice: t('docCommercialInvoice'),
      docPackingList: t('docPackingList'),
      docProformaInvoice: t('docProformaInvoice'),
      docBillOfLading: t('docBillOfLading'),
      docAirwayBill: t('docAirwayBill'),
      docCertificateOfOrigin: t('docCertificateOfOrigin'),
      docCustomsDeclaration: t('docCustomsDeclaration'),
      docPackingDeclaration: t('docPackingDeclaration'),
      docPhytosanitary: t('docPhytosanitary'),
      docHealth: t('docHealth'),
      docFumigation: t('docFumigation'),
      docQualityInspection: t('docQualityInspection'),
      docVatRefund: t('docVatRefund'),
      docOther: t('docOther'),
      statusMissing: t('statusMissing'),
      statusDraft: t('statusDraft'),
      statusUploaded: t('statusUploaded'),
      statusGenerated: t('statusGenerated'),
      statusReviewed: t('statusReviewed'),
      statusApproved: t('statusApproved'),
      statusExpired: t('statusExpired'),
      statusNotApplicable: t('statusNotApplicable'),
      actionVersionCreated: t('actionVersionCreated'),
      actionFileUploaded: t('actionFileUploaded'),
      actionGenerated: t('actionGenerated'),
      actionReviewed: t('actionReviewed'),
      actionShared: t('actionShared'),
      actionUnshared: t('actionUnshared'),
      actionDownloaded: t('actionDownloaded'),
      requiredMessage: t('requiredMessage'),
    }), [t]);

    const DOCUMENT_OPTIONS = useMemo(() => buildDocumentOptions(docLabels), [docLabels]);
    const STATUS_LABEL = useMemo(() => buildStatusLabel(docLabels), [docLabels]);
    const ACTION_LABEL = useMemo(() => buildActionLabel(docLabels), [docLabels]);
    const requiredRule = useMemo(() => ({ required: true, message: docLabels.requiredMessage }), [docLabels.requiredMessage]);

    const accessToken = useMemo(() => getAccessToken(session), [session]);
    const selectedDocumentType = Form.useWatch('documentType', form) as DocumentTypeValue | undefined;

    const fetchDocumentCenter = useCallback(async () => {
        if (!shipmentId || !accessToken) return;
        setLoading(true);
        try {
            const res = await sendRequest<IBackendRes<DocumentCenter>>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/export-documents/shipment/${shipmentId}`,
                method: 'GET',
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (res?.data) setCenter(res.data);
        } catch (error) {
            const message = error instanceof Error ? error.message : t('loadError');
            notification.error({ title: t('loadErrorTitle'), description: message });
        } finally {
            setLoading(false);
        }
    }, [accessToken, notification, shipmentId, t]);

    useEffect(() => {
        if (open) void fetchDocumentCenter();
    }, [fetchDocumentCenter, open]);

    const openRegisterModal = useCallback((documentType?: DocumentTypeValue) => {
        form.resetFields();
        setUploadFiles([]);
        if (documentType) form.setFieldsValue({ documentType });
        setRegisterOpen(true);
    }, [form]);

    const handleOpenFile = (fileUrl?: string | null) => {
        const resolvedUrl = resolveFileUrl(fileUrl);
        if (resolvedUrl) window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
    };

    const handleDownloadPdf = async (type: 'CI' | 'PL') => {
        if (!shipmentId || !accessToken) return;

        try {
            const response = await backendFetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/export-documents/download/${shipmentId}/${type}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (!response.ok) throw new Error(await response.text());

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${type}_${center?.shipment?.shipmentNumber || shipmentId}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            notification.success({ title: t('downloaded', { type }) });
            void fetchDocumentCenter();
        } catch (error) {
            const message = error instanceof Error ? error.message : t('downloadError');
            notification.error({ title: t('downloadError'), description: message });
        }
    };

    const handleGenerate = async (documentType: DocumentTypeValue) => {
        if (!shipmentId || !accessToken) return;

        try {
            await sendRequest<IBackendRes<ExportDocumentRecord>>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/export-documents/shipment/${shipmentId}/generate/${documentType}`,
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            notification.success({ title: t('generateSuccess') });
            void fetchDocumentCenter();
        } catch (error) {
            const message = error instanceof Error ? error.message : t('generateError');
            notification.error({ title: t('generateError'), description: message });
        }
    };

    const uploadDocumentFile = async (): Promise<UploadedDocumentFile | null> => {
        const file = uploadFiles[0]?.originFileObj;
        if (!file || !accessToken) return null;

        const formData = new FormData();
        formData.append('file', file);

        const res = await sendRequestFile<IBackendRes<UploadedDocumentFile>>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/files/upload`,
            method: 'POST',
            queryParams: { folder: 'documents' },
            body: formData,
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res?.data?.url) {
            throw new Error(res?.message || t('uploadFailed'));
        }

        return res.data;
    };

    const handleRegister = async (values: RegisterDocumentValues) => {
        if (!shipmentId || !accessToken) return;

        try {
            setUploading(true);
            const uploaded = await uploadDocumentFile();
            const businessData = serializeFormValue(values.businessData) as Record<string, unknown> | undefined;
            const hasFile = Boolean(uploaded?.url || values.fileUrl);

            await sendRequest<IBackendRes<ExportDocumentRecord>>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/export-documents`,
                method: 'POST',
                body: {
                    documentType: values.documentType,
                    documentNumber: values.documentNumber,
                    shipmentId,
                    fileName: uploaded?.fileName || values.fileName,
                    originalFileName: uploaded?.originalName,
                    mimeType: uploaded?.mimeType,
                    fileSize: uploaded?.size || 0,
                    fileUrl: uploaded?.url || values.fileUrl,
                    fileAsset_id: uploaded?._id,
                    businessData: isBusinessDocumentType(values.documentType) ? businessData : undefined,
                    customsDeclarationNumber: values.customsDeclarationNumber || getRecordString(businessData, 'declarationNumber'),
                    customsClearedAt: getRecordString(businessData, 'clearanceDate'),
                    checklistStatus: hasFile ? 'UPLOADED' : 'DRAFT',
                    notes: values.notes,
                },
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            notification.success({ title: t('registerSuccess') });
            form.resetFields();
            setUploadFiles([]);
            setRegisterOpen(false);
            void fetchDocumentCenter();
        } catch (error) {
            const message = error instanceof Error ? error.message : t('registerSaveError');
            notification.error({ title: t('registerSaveError'), description: message });
        } finally {
            setUploading(false);
        }
    };

    const handleReview = async (record: ChecklistRow, checklistStatus: ChecklistStatus) => {
        if (!record.document?._id || !accessToken) return;

        try {
            await sendRequest<IBackendRes<ExportDocumentRecord>>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/export-documents/${record.document._id}/review`,
                method: 'PATCH',
                body: { checklistStatus },
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            notification.success({ title: t('reviewSuccess') });
            void fetchDocumentCenter();
        } catch (error) {
            const message = error instanceof Error ? error.message : t('reviewError');
            notification.error({ title: t('reviewError'), description: message });
        }
    };

    const handleShare = async (documentId: string, shared: boolean) => {
        if (!accessToken) return;

        try {
            await sendRequest<IBackendRes<ExportDocumentRecord>>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/export-documents/${documentId}/${shared ? 'share' : 'unshare'}`,
                method: 'PATCH',
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            notification.success({ title: shared ? t('shareYes') : t('shareNo') });
            void fetchDocumentCenter();
        } catch (error) {
            const message = error instanceof Error ? error.message : t('shareError');
            notification.error({ title: t('shareError'), description: message });
        }
    };

    const setBusinessPortSnapshot = useCallback((fieldName: 'portOfLoading' | 'portOfDischarge', port?: IPort) => {
        form.setFieldValue(['businessData', fieldName], port ? formatPortLabel(port) : undefined);
    }, [form]);

    const renderBusinessFormFields = () => {
        if (selectedDocumentType === 'BILL_OF_LADING') {
            return (
                <>
                    <Divider titlePlacement="start">{t('dividerBillOfLading')}</Divider>
                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
                        <Form.Item label={`${t('lblBlNumber')} (${t('hintBlNumber')})`} name={['businessData', 'blNumber']} rules={[requiredRule]}>
                            <Input placeholder="BL-HCM-0001" />
                        </Form.Item>
                        <Form.Item label={`${t('lblBlType')} (${t('hintBlType')})`} name={['businessData', 'blType']}>
                            <Select options={[
                                { value: 'ORIGINAL', label: t('blOriginal') },
                                { value: 'SEAWAY', label: t('blSeaway') },
                                { value: 'TELEX_RELEASE', label: t('blTelex') },
                            ]} />
                        </Form.Item>
                        <Form.Item label={`${t('lblCarrier')} (${t('hintCarrier')})`} name={['businessData', 'carrierName']} rules={[requiredRule]}>
                            <Input placeholder="Maersk, ONE, CMA CGM..." />
                        </Form.Item>
                        <Form.Item label={`${t('lblShipper')} (${t('hintShipper')})`} name={['businessData', 'shipperName']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblConsignee')} (${t('hintConsignee')})`} name={['businessData', 'consigneeName']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblNotifyParty')} (${t('hintNotifyParty')})`} name={['businessData', 'notifyParty']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblVessel')} (${t('hintVessel')})`} name={['businessData', 'vesselName']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblVoyage')} (${t('hintVoyage')})`} name={['businessData', 'voyageNumber']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item name={['businessData', 'portOfLoading']} hidden>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblPortOfLoading')} (${t('hintPortOfLoading')})`} name={['businessData', 'portOfLoading_port_id']} rules={[requiredRule]}>
                            <PortSelect
                                legacyText={getRecordString(form.getFieldValue('businessData'), 'portOfLoading')}
                                onPortChange={(port) => setBusinessPortSnapshot('portOfLoading', port)}
                            />
                        </Form.Item>
                        <Form.Item name={['businessData', 'portOfDischarge']} hidden>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblPortOfDischarge')} (${t('hintPortOfDischarge')})`} name={['businessData', 'portOfDischarge_port_id']} rules={[requiredRule]}>
                            <PortSelect
                                legacyText={getRecordString(form.getFieldValue('businessData'), 'portOfDischarge')}
                                onPortChange={(port) => setBusinessPortSnapshot('portOfDischarge', port)}
                            />
                        </Form.Item>
                        <Form.Item label={`${t('lblOnBoardDate')} (${t('hintOnBoardDate')})`} name={['businessData', 'onBoardDate']} rules={[requiredRule]}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label={`${t('lblFreightTerms')} (${t('hintFreightTerms')})`} name={['businessData', 'freightTerms']} rules={[requiredRule]}>
                            <Select options={[
                                { value: 'PREPAID', label: t('freightPrepaid') },
                                { value: 'COLLECT', label: t('freightCollect') },
                            ]} />
                        </Form.Item>
                        <Form.Item label={`${t('lblPlaceOfReceipt')} (${t('hintPlaceOfReceipt')})`} name={['businessData', 'placeOfReceipt']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblPlaceOfDelivery')} (${t('hintPlaceOfDelivery')})`} name={['businessData', 'placeOfDelivery']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblContainers')} (${t('hintContainers')})`} name={['businessData', 'containerNumbers']}>
                            <Input placeholder="MSCU1234567, TEMU7654321" />
                        </Form.Item>
                        <Form.Item label={`${t('lblSeals')} (${t('hintSeals')})`} name={['businessData', 'sealNumbers']}>
                            <Input />
                        </Form.Item>
                        <Form.Item className="md:col-span-2" label={`${t('lblMarksAndNumbers')} (${t('hintMarksAndNumbers')})`} name={['businessData', 'marksAndNumbers']}>
                            <Input.TextArea rows={2} />
                        </Form.Item>
                        <Form.Item label={`${t('lblPackages')} (${t('hintPackages')})`} name={['businessData', 'packageCount']}>
                            <InputNumber min={0} className="w-full" />
                        </Form.Item>
                        <Form.Item label={`${t('lblPackageType')} (${t('hintPackageType')})`} name={['businessData', 'packageType']}>
                            <Input placeholder="Cartons, pallets, bags..." />
                        </Form.Item>
                    </div>
                </>
            );
        }

        if (selectedDocumentType === 'AIRWAY_BILL') {
            return (
                <>
                    <Divider titlePlacement="start">{t('dividerAirwayBill')}</Divider>
                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
                        <Form.Item label={`${t('lblAwbNumber')} (${t('hintAwbNumber')})`} name={['businessData', 'awbNumber']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblAwbType')} (${t('hintAwbType')})`} name={['businessData', 'awbType']}>
                            <Select options={[
                                { value: 'MASTER', label: t('awbMaster') },
                                { value: 'HOUSE', label: t('awbHouse') },
                            ]} />
                        </Form.Item>
                        <Form.Item label={`${t('lblAirline')} (${t('hintAirline')})`} name={['businessData', 'airlineName']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblShipper')} (${t('hintShipper')})`} name={['businessData', 'shipperName']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblConsignee')} (${t('hintConsignee')})`} name={['businessData', 'consigneeName']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblFlight')} (${t('hintFlight')})`} name={['businessData', 'flightNumber']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblDepartureAirport')} (${t('hintDepartureAirport')})`} name={['businessData', 'airportOfDeparture']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblDestinationAirport')} (${t('hintDestinationAirport')})`} name={['businessData', 'airportOfDestination']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblDepartureDate')} (${t('hintDepartureDate')})`} name={['businessData', 'departureDate']} rules={[requiredRule]}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label={`${t('lblArrivalDate')} (${t('hintArrivalDate')})`} name={['businessData', 'arrivalDate']}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label={`${t('lblGrossWeight')} (${t('hintGrossWeight')})`} name={['businessData', 'grossWeightKg']}>
                            <InputNumber min={0} precision={2} className="w-full" />
                        </Form.Item>
                        <Form.Item label={`${t('lblChargeableWeight')} (${t('hintChargeableWeight')})`} name={['businessData', 'chargeableWeightKg']}>
                            <InputNumber min={0} precision={2} className="w-full" />
                        </Form.Item>
                        <Form.Item label={`${t('lblPieces')} (${t('hintPieces')})`} name={['businessData', 'pieces']}>
                            <InputNumber min={0} className="w-full" />
                        </Form.Item>
                        <Form.Item label={`${t('lblCommodity')} (${t('hintCommodity')})`} name={['businessData', 'commodity']}>
                            <Input />
                        </Form.Item>
                    </div>
                </>
            );
        }

        if (selectedDocumentType === 'CERTIFICATE_OF_ORIGIN') {
            return (
                <>
                    <Divider titlePlacement="start">{t('dividerCertificateOfOrigin')}</Divider>
                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
                        <Form.Item label={`${t('lblCoNumber')} (${t('hintCoNumber')})`} name={['businessData', 'coNumber']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblCoForm')} (${t('hintCoForm')})`} name={['businessData', 'coForm']} rules={[requiredRule]}>
                            <Select options={[
                                { value: 'B', label: 'Form B' },
                                { value: 'D', label: 'Form D' },
                                { value: 'E', label: 'Form E' },
                                { value: 'AI', label: 'Form AI' },
                                { value: 'AK', label: 'Form AK' },
                                { value: 'VJ', label: 'Form VJ' },
                                { value: 'RCEP', label: 'RCEP' },
                            ]} />
                        </Form.Item>
                        <Form.Item label={`${t('lblIssuingAuthority')} (${t('hintIssuingAuthority')})`} name={['businessData', 'issuingAuthority']} rules={[requiredRule]}>
                            <Input placeholder="VCCI, MOIT..." />
                        </Form.Item>
                        <Form.Item label={`${t('lblIssueDate')} (${t('hintIssueDate')})`} name={['businessData', 'issueDate']} rules={[requiredRule]}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label={`${t('lblOriginCountry')} (${t('hintOriginCountry')})`} name={['businessData', 'originCountry']} rules={[requiredRule]}>
                            <Input placeholder="Vietnam" />
                        </Form.Item>
                        <Form.Item label={`${t('lblDestinationCountry')} (${t('hintDestinationCountry')})`} name={['businessData', 'destinationCountry']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblInvoiceNumber')} (${t('hintInvoiceNumber')})`} name={['businessData', 'invoiceNumber']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblInvoiceDate')} (${t('hintInvoiceDate')})`} name={['businessData', 'invoiceDate']}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label={`${t('lblHsCode')} (${t('hintHsCode')})`} name={['businessData', 'hsCodeSummary']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblTransportRoute')} (${t('hintTransportRoute')})`} name={['businessData', 'transportRoute']}>
                            <Input placeholder="Vietnam to destination country" />
                        </Form.Item>
                        <Form.Item className="md:col-span-2" label={`${t('lblOriginCriteria')} (${t('hintOriginCriteria')})`} name={['businessData', 'criteria']}>
                            <Input.TextArea rows={2} />
                        </Form.Item>
                    </div>
                </>
            );
        }

        if (selectedDocumentType === 'CUSTOMS_DECLARATION') {
            return (
                <>
                    <Divider titlePlacement="start">{t('dividerCustomsDeclaration')}</Divider>
                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
                        <Form.Item label={`${t('lblDeclarationNumber')} (${t('hintDeclarationNumber')})`} name={['businessData', 'declarationNumber']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblCustomsOffice')} (${t('hintCustomsOffice')})`} name={['businessData', 'customsOffice']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblDeclarationDate')} (${t('hintDeclarationDate')})`} name={['businessData', 'declarationDate']} rules={[requiredRule]}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label={`${t('lblClearanceDate')} (${t('hintClearanceDate')})`} name={['businessData', 'clearanceDate']} rules={[requiredRule]}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label={`${t('lblChannel')} (${t('hintChannel')})`} name={['businessData', 'channel']} rules={[requiredRule]}>
                            <Select options={[
                                { value: 'GREEN', label: t('channelGreen') },
                                { value: 'YELLOW', label: t('channelYellow') },
                                { value: 'RED', label: t('channelRed') },
                            ]} />
                        </Form.Item>
                        <Form.Item label={`${t('lblExportType')} (${t('hintExportType')})`} name={['businessData', 'exportType']}>
                            <Input placeholder="B11, E62..." />
                        </Form.Item>
                        <Form.Item label={`${t('lblExporterTaxCode')} (${t('hintExporterTaxCode')})`} name={['businessData', 'exporterTaxCode']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblInvoiceNumber')} (${t('hintInvoiceNumber')})`} name={['businessData', 'invoiceNumber']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblInvoiceValue')} (${t('hintInvoiceValue')})`} name={['businessData', 'invoiceValue']}>
                            <InputNumber min={0} precision={2} className="w-full" />
                        </Form.Item>
                        <Form.Item label={`${t('lblCurrency')} (${t('hintCurrency')})`} name={['businessData', 'currency']}>
                            <Input placeholder="USD, VND..." />
                        </Form.Item>
                        <Form.Item className="md:col-span-2" label={`${t('lblHsSummary')} (${t('hintHsSummary')})`} name={['businessData', 'hsCodeSummary']}>
                            <Input.TextArea rows={2} />
                        </Form.Item>
                    </div>
                </>
            );
        }

        if (selectedDocumentType === 'PACKING_DECLARATION') {
            return (
                <>
                    <Divider titlePlacement="start">{t('dividerPackingDeclaration')}</Divider>
                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
                        <Form.Item label="Declaration number (Số khai báo)" name={['businessData', 'declarationNumber']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblIssueDate')} (${t('hintIssueDate')})`} name={['businessData', 'issueDate']} rules={[requiredRule]}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label={`${t('lblPackingMaterial')} (${t('hintPackingMaterial')})`} name={['businessData', 'packingMaterial']} rules={[requiredRule]}>
                            <Select options={[
                                { value: 'WOODEN', label: t('packingWooden') },
                                { value: 'NON_WOODEN', label: t('packingNonWooden') },
                                { value: 'MIXED', label: t('packingMixed') },
                            ]} />
                        </Form.Item>
                        <Form.Item label={`${t('lblIspm15')} (${t('hintIspm15')})`} name={['businessData', 'ispm15Applied']}>
                            <Select options={[
                                { value: 'YES', label: t('yes') },
                                { value: 'NO', label: t('no') },
                                { value: 'NOT_APPLICABLE', label: t('notApplicable') },
                            ]} />
                        </Form.Item>
                        <Form.Item label={`${t('lblDeclarant')} (${t('hintDeclarant')})`} name={['businessData', 'declarantName']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblDeclarantPosition')} (${t('hintDeclarantPosition')})`} name={['businessData', 'declarantPosition']}>
                            <Input />
                        </Form.Item>
                        <Form.Item className="md:col-span-2" label={`${t('lblTreatmentStatement')} (${t('hintTreatmentStatement')})`} name={['businessData', 'treatmentStatement']} rules={[requiredRule]}>
                            <Input.TextArea rows={2} placeholder="Describe fumigation / heat treatment / non-wood declaration." />
                        </Form.Item>
                    </div>
                </>
            );
        }

        if (selectedDocumentType === 'PHYTOSANITARY_CERTIFICATE') {
            return (
                <>
                    <Divider titlePlacement="start">{t('dividerPhytosanitary')}</Divider>
                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
                        <Form.Item label={`${t('lblCertificateNumber')} (${t('hintCertificateNumber')})`} name={['businessData', 'certificateNumber']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblIssuingAuthority')} (${t('hintIssuingAuthority')})`} name={['businessData', 'issuingAuthority']} rules={[requiredRule]}>
                            <Input placeholder="Plant Protection Department..." />
                        </Form.Item>
                        <Form.Item label={`${t('lblIssueDate')} (${t('hintIssueDate')})`} name={['businessData', 'issueDate']} rules={[requiredRule]}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label={`${t('lblInspectionPlace')} (${t('hintInspectionPlace')})`} name={['businessData', 'inspectionPlace']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblBotanicalName')} (${t('hintBotanicalName')})`} name={['businessData', 'botanicalName']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblTreatment')} (${t('hintTreatment')})`} name={['businessData', 'treatment']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblQuantity')} (${t('hintQuantity')})`} name={['businessData', 'quantity']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Destination country (Nước đến)" name={['businessData', 'destinationCountry']}>
                            <Input />
                        </Form.Item>
                        <Form.Item className="md:col-span-2" label={`${t('lblAdditionalDeclaration')} (${t('hintAdditionalDeclaration')})`} name={['businessData', 'additionalDeclaration']}>
                            <Input.TextArea rows={2} />
                        </Form.Item>
                    </div>
                </>
            );
        }

        if (selectedDocumentType === 'HEALTH_CERTIFICATE') {
            return (
                <>
                    <Divider titlePlacement="start">{t('dividerHealth')}</Divider>
                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
                        <Form.Item label={`${t('lblCertificateNumber')} (${t('hintCertificateNumber')})`} name={['businessData', 'certificateNumber']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblIssuingAuthority')} (${t('hintIssuingAuthority')})`} name={['businessData', 'issuingAuthority']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblIssueDate')} (${t('hintIssueDate')})`} name={['businessData', 'issueDate']} rules={[requiredRule]}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label={`${t('lblProductDescription')} (${t('hintProductDescription')})`} name={['businessData', 'productDescription']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblBatchLot')} (${t('hintBatchLot')})`} name={['businessData', 'batchOrLotNumber']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblManufacturingDate')} (${t('hintManufacturingDate')})`} name={['businessData', 'manufacturingDate']}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label={`${t('lblExpiryDate')} (${t('hintExpiryDate')})`} name={['businessData', 'expiryDate']}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label="Destination country (Nước đến)" name={['businessData', 'destinationCountry']}>
                            <Input />
                        </Form.Item>
                        <Form.Item className="md:col-span-2" label={`${t('lblHealthStatement')} (${t('hintHealthStatement')})`} name={['businessData', 'healthStatement']} rules={[requiredRule]}>
                            <Input.TextArea rows={2} />
                        </Form.Item>
                    </div>
                </>
            );
        }

        if (selectedDocumentType === 'FUMIGATION_CERTIFICATE') {
            return (
                <>
                    <Divider titlePlacement="start">{t('dividerFumigation')}</Divider>
                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
                        <Form.Item label={`${t('lblCertificateNumber')} (${t('hintCertificateNumber')})`} name={['businessData', 'certificateNumber']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblFumigationCompany')} (${t('hintFumigationCompany')})`} name={['businessData', 'fumigationCompany']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblFumigationDate')} (${t('hintFumigationDate')})`} name={['businessData', 'fumigationDate']} rules={[requiredRule]}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label={`${t('lblChemicalUsed')} (${t('hintChemicalUsed')})`} name={['businessData', 'chemicalUsed']} rules={[requiredRule]}>
                            <Input placeholder="Methyl Bromide, Phosphine..." />
                        </Form.Item>
                        <Form.Item label={`${t('lblDosage')} (${t('hintDosage')})`} name={['businessData', 'dosage']} rules={[requiredRule]}>
                            <Input placeholder="g/m3" />
                        </Form.Item>
                        <Form.Item label={`${t('lblExposureDuration')} (${t('hintExposureDuration')})`} name={['businessData', 'exposureDuration']}>
                            <Input placeholder="24 hours" />
                        </Form.Item>
                        <Form.Item label={`${t('lblTemperature')} (${t('hintTemperature')})`} name={['businessData', 'temperature']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblTreatmentLocation')} (${t('hintTreatmentLocation')})`} name={['businessData', 'treatmentLocation']}>
                            <Input />
                        </Form.Item>
                        <Form.Item className="md:col-span-2" label={`${t('lblContainerSealNumbers')} (${t('hintContainerSealNumbers')})`} name={['businessData', 'containerSealNumbers']}>
                            <Input.TextArea rows={2} />
                        </Form.Item>
                    </div>
                </>
            );
        }

        if (selectedDocumentType === 'QUALITY_INSPECTION_CERTIFICATE') {
            return (
                <>
                    <Divider titlePlacement="start">{t('dividerQualityInspection')}</Divider>
                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
                        <Form.Item label={`${t('lblCertificateNumber')} (${t('hintCertificateNumber')})`} name={['businessData', 'certificateNumber']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblInspectionAgency')} (${t('hintInspectionAgency')})`} name={['businessData', 'inspectionAgency']} rules={[requiredRule]}>
                            <Input placeholder="SGS, Bureau Veritas, Vinacontrol..." />
                        </Form.Item>
                        <Form.Item label={`${t('lblIssueDate')} (${t('hintIssueDate')})`} name={['businessData', 'issueDate']} rules={[requiredRule]}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label={`${t('lblInspectionDate')} (${t('hintInspectionDate')})`} name={['businessData', 'inspectionDate']}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label={`${t('lblInspectionStandard')} (${t('hintInspectionStandard')})`} name={['businessData', 'inspectionStandard']} rules={[requiredRule]}>
                            <Input placeholder="Contract spec, ISO, buyer spec..." />
                        </Form.Item>
                        <Form.Item label={`${t('lblInspectionResult')} (${t('hintInspectionResult')})`} name={['businessData', 'inspectionResult']} rules={[requiredRule]}>
                            <Select options={[
                                { value: 'PASSED', label: t('resultPassed') },
                                { value: 'CONDITIONALLY_PASSED', label: t('resultConditionallyPassed') },
                                { value: 'FAILED', label: t('resultFailed') },
                            ]} />
                        </Form.Item>
                        <Form.Item label={`${t('lblSampleSize')} (${t('hintSampleSize')})`} name={['businessData', 'sampleSize']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label={`${t('lblDefectRate')} (${t('hintDefectRate')})`} name={['businessData', 'defectRate']}>
                            <Input />
                        </Form.Item>
                        <Form.Item className="md:col-span-2" label={`${t('lblInspectionRemarks')} (${t('hintInspectionRemarks')})`} name={['businessData', 'inspectionRemarks']}>
                            <Input.TextArea rows={2} />
                        </Form.Item>
                    </div>
                </>
            );
        }

        return null;
    };

    const auditColumns: ColumnsType<ExportDocumentAuditEvent> = [
        {
            title: t('colTime'),
            dataIndex: 'at',
            width: 180,
            render: (value?: string) => formatDateTime(value),
        },
        {
            title: t('colEvent'),
            dataIndex: 'action',
            width: 150,
            render: (value: string) => ACTION_LABEL[value] || value,
        },
        { title: t('colUser'), dataIndex: 'username', width: 140 },
        {
            title: t('colNote'),
            dataIndex: 'note',
            render: (value?: string | null) => value || '-',
        },
        {
            title: t('colFile'),
            width: 110,
            render: (_, record) => record.fileUrl ? (
                <Button size="small" icon={<EyeOutlined />} onClick={() => handleOpenFile(record.fileUrl)}>
                    {t('actionOpen')}
                </Button>
            ) : '-',
        },
    ];

    const checklistColumns: ColumnsType<ChecklistRow> = [
        {
            title: t('colDocument'),
            dataIndex: 'label',
            render: (label: string, record) => (
                <Space>
                    <FileDoneOutlined />
                    <div>
                        <Text strong>{label}</Text>
                        {record.required && <Tag className="ml-2" color="red">{t('required')}</Tag>}
                    </div>
                </Space>
            ),
        },
        {
            title: t('colStatus'),
            dataIndex: 'status',
            width: 150,
            render: (status: ChecklistStatus) => <Tag color={STATUS_COLOR[status] || 'default'}>{STATUS_LABEL[status] || status}</Tag>,
        },
        {
            title: t('colVersion'),
            width: 110,
            render: (_, record) => record.document ? `v${record.document.versionNo}` : '-',
        },
        {
            title: t('colDocNumber'),
            width: 180,
            render: (_, record) => record.document?.documentNumber || '-',
        },
        {
            title: t('colActions'),
            width: 380,
            render: (_, record) => (
                <Space wrap>
                    {['COMMERCIAL_INVOICE', 'PACKING_LIST'].includes(record.documentType) && (
                        <Button size="small" icon={<ReloadOutlined />} onClick={() => handleGenerate(record.documentType)}>
                            {t('actionGenerate')}
                        </Button>
                    )}
                    {record.documentType === 'COMMERCIAL_INVOICE' && (
                        <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownloadPdf('CI')}>
                            {t('actionCi')}
                        </Button>
                    )}
                    {record.documentType === 'PACKING_LIST' && (
                        <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownloadPdf('PL')}>
                            {t('actionPl')}
                        </Button>
                    )}
                    {isBusinessDocumentType(record.documentType) && (
                        <Button size="small" icon={<FormOutlined />} onClick={() => openRegisterModal(record.documentType)}>
                            {t('actionForm')}
                        </Button>
                    )}
                    {record.document?.fileUrl && (
                        <Button size="small" icon={<EyeOutlined />} onClick={() => handleOpenFile(record.document?.fileUrl)}>
                            {t('actionFile')}
                        </Button>
                    )}
                    {record.document && record.status !== 'APPROVED' && (
                        <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleReview(record, 'APPROVED')}>
                            {t('actionApprove')}
                        </Button>
                    )}
                    {record.document && (
                        <Button
                            size="small"
                            icon={<ShareAltOutlined />}
                            onClick={() => handleShare(record.document?._id || '', !record.document?.sharedWithBuyer)}
                        >
                            {record.document.sharedWithBuyer ? t('actionUnshare') : t('actionShare')}
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    const versionsColumns: ColumnsType<ExportDocumentRecord> = [
        { title: t('colType'), dataIndex: 'documentType', width: 210 },
        { title: t('colDocNoShort'), dataIndex: 'documentNumber', render: (value?: string | null) => value || '-' },
        { title: t('colVersion'), dataIndex: 'versionNo', width: 90, render: (value: number) => `v${value}` },
        {
            title: t('colStatus'),
            dataIndex: 'checklistStatus',
            width: 140,
            render: (status: ChecklistStatus) => <Tag color={STATUS_COLOR[status] || 'default'}>{STATUS_LABEL[status] || status}</Tag>,
        },
        {
            title: t('colFile'),
            width: 120,
            render: (_, record) => record.fileUrl ? (
                <Button size="small" icon={<EyeOutlined />} onClick={() => handleOpenFile(record.fileUrl)}>
                    {t('actionOpenFile')}
                </Button>
            ) : '-',
        },
        {
            title: t('colFilesRef'),
            dataIndex: 'fileAsset_id',
            width: 120,
            render: (value?: string | null) => value ? <Text code>{value.slice(-12)}</Text> : '-',
        },
        {
            title: t('colCurrent'),
            dataIndex: 'isCurrentVersion',
            width: 90,
            render: (value: boolean) => <Badge status={value ? 'success' : 'default'} text={value ? t('currentYes') : t('currentNo')} />,
        },
        {
            title: t('colReviewer'),
            width: 160,
            render: (_, record) => record.reviewedByUsername || record.uploadedByUsername || '-',
        },
        {
            title: t('colLatestAudit'),
            width: 170,
            render: (_, record) => {
                const latest = record.auditTrail?.[record.auditTrail.length - 1];
                return latest ? `${ACTION_LABEL[latest.action] || latest.action} - ${latest.username}` : '-';
            },
        },
        {
            title: t('colBuyerPortal'),
            width: 120,
            render: (_, record) => (
                <Tag color={record.sharedWithBuyer ? 'green' : 'default'}>
                    {record.sharedWithBuyer ? t('sharedYes') : t('sharedNo')}
                </Tag>
            ),
        },
    ];

    const renderVersionDetails = (record: ExportDocumentRecord) => {
        const businessEntries = Object.entries(record.businessData || {})
            .filter(([key]) => !key.endsWith('_port_id'));

        return (
            <Space className="w-full" orientation="vertical" size={12}>
                {businessEntries.length > 0 && (
                    <Descriptions bordered size="small" column={2}>
                        {businessEntries.map(([key, value]) => (
                            <Descriptions.Item key={key} label={humanizeKey(key)}>
                                {formatFieldValue(value)}
                            </Descriptions.Item>
                        ))}
                    </Descriptions>
                )}
                <Table
                    rowKey={(event) => `${record._id}-${event.action}-${event.at}`}
                    size="small"
                    bordered
                    dataSource={record.auditTrail || []}
                    columns={auditColumns}
                    pagination={false}
                    locale={{ emptyText: t('noAuditTrail') }}
                />
            </Space>
        );
    };

    const shipment = center?.shipment;
    const dossierReady = center?.vatRefundDossier?.ready;

    return (
        <Drawer
            title={
                <Space>
                    <FilePdfOutlined className="text-red-500" />
                    <Text strong>{t('drawerTitle')}</Text>
                    {shipment?.shipmentNumber && <Tag color="blue">{shipment.shipmentNumber}</Tag>}
                </Space>
            }
            placement="right"
            size={1080}
            styles={{ body: { padding: 20 } }}
            onClose={onClose}
            open={open}
            extra={
                <Space>
                    <Button icon={<FileAddOutlined />} onClick={() => openRegisterModal()}>
                        {t('registerDocument')}
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={fetchDocumentCenter}>
                        {t('refresh')}
                    </Button>
                </Space>
            }
        >
            <Space className="w-full" orientation="vertical" size={16}>
                <Descriptions bordered size="small" column={3}>
                    <Descriptions.Item label={t('metaShipment')}>{shipment?.shipmentNumber || '-'}</Descriptions.Item>
                    <Descriptions.Item label={t('metaContract')}>{shipment?.salesContract?.contractNumber || '-'}</Descriptions.Item>
                    <Descriptions.Item label={t('metaStatus')}>{shipment?.status || '-'}</Descriptions.Item>
                    <Descriptions.Item label="POL">{shipment?.pol || '-'}</Descriptions.Item>
                    <Descriptions.Item label="POD">{shipment?.pod || '-'}</Descriptions.Item>
                    <Descriptions.Item label="B/L">{shipment?.blNumber || '-'}</Descriptions.Item>
                </Descriptions>

                <Tabs
                    defaultActiveKey="checklist"
                    items={[
                        {
                            key: 'checklist',
                            label: t('tabChecklist'),
                            children: (
                                <Space className="w-full" orientation="vertical" size={16}>
                                    <div
                                        className="rounded-lg border p-4"
                                        style={{ background: token.colorBgContainer, borderColor: token.colorBorderSecondary }}
                                    >
                                        <Space className="w-full justify-between" wrap>
                                            <div>
                                                <Text strong>{t('vatRefundDossier')}</Text>
                                                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{t('vatRefundDossierDesc')}</div>
                                            </div>
                                            <Tag color={dossierReady ? 'green' : 'orange'}>
                                                {dossierReady ? t('dossierReady') : t('dossierNotReady')}
                                            </Tag>
                                        </Space>
                                    </div>

                                    <Table
                                        rowKey="documentType"
                                        bordered
                                        loading={loading}
                                        dataSource={center?.checklist || []}
                                        columns={checklistColumns}
                                        pagination={false}
                                        scroll={{ x: 860 }}
                                    />
                                </Space>
                            ),
                        },
                        {
                            key: 'versions',
                            label: t('tabVersions'),
                            children: (
                                <Table
                                    rowKey="_id"
                                    bordered
                                    size="small"
                                    dataSource={center?.documents || []}
                                    columns={versionsColumns}
                                    expandable={{ expandedRowRender: renderVersionDetails }}
                                    pagination={{ pageSize: 6 }}
                                    scroll={{ x: 960 }}
                                />
                            ),
                        },
                    ]}
                />
            </Space>

            <Modal
                title={t('registerSuccess')}
                open={registerOpen}
                onCancel={() => setRegisterOpen(false)}
                onOk={() => form.submit()}
                confirmLoading={uploading}
                destroyOnHidden
                forceRender
                width={760}
            >
                <Form form={form} layout="vertical" onFinish={handleRegister}>
                    <Form.Item label={t('formDocumentType')} name="documentType" rules={[requiredRule]}>
                        <Select options={DOCUMENT_OPTIONS} showSearch optionFilterProp="label" />
                    </Form.Item>

                    {renderBusinessFormFields()}

                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
                        <Form.Item label={t('formDocumentNumber')} name="documentNumber">
                            <Input placeholder={t('formDocumentNumberHint')} />
                        </Form.Item>
                        <Form.Item label={t('formFileName')} name="fileName">
                            <Input placeholder="commercial-invoice.pdf" />
                        </Form.Item>
                    </div>

                    <Form.Item label={t('formUploadFile')}>
                        <Upload
                            beforeUpload={() => false}
                            maxCount={1}
                            fileList={uploadFiles}
                            onChange={({ fileList }) => setUploadFiles(fileList)}
                            accept="application/pdf,image/*"
                        >
                            <Button icon={<UploadOutlined />}>{t('formChooseFile')}</Button>
                        </Upload>
                    </Form.Item>
                    <Form.Item label={t('formFileUrl')} name="fileUrl">
                        <Input placeholder={t('formFileUrlHint')} />
                    </Form.Item>
                    <Form.Item label={t('formCustomsDeclNumber')} name="customsDeclarationNumber">
                        <Input placeholder={t('formCustomsDeclNumberHint')} />
                    </Form.Item>
                    <Form.Item label={t('formNotes')} name="notes">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                </Form>
            </Modal>
        </Drawer>
    );
};

export default ShipmentDocCenter;
