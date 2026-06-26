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

const DOCUMENT_OPTIONS: Array<{ value: DocumentTypeValue; label: string }> = [
    { value: 'COMMERCIAL_INVOICE', label: 'Commercial Invoice (Hóa đơn thương mại)' },
    { value: 'PACKING_LIST', label: 'Packing List (Phiếu đóng gói)' },
    { value: 'PROFORMA_INVOICE', label: 'Proforma Invoice (Hóa đơn chiếu lệ)' },
    { value: 'BILL_OF_LADING', label: 'Bill of Lading (Vận đơn đường biển)' },
    { value: 'AIRWAY_BILL', label: 'Airway Bill (Vận đơn hàng không)' },
    { value: 'CERTIFICATE_OF_ORIGIN', label: 'Certificate of Origin (Giấy chứng nhận xuất xứ)' },
    { value: 'CUSTOMS_DECLARATION', label: 'Customs Declaration (Tờ khai hải quan)' },
    { value: 'PACKING_DECLARATION', label: 'Packing Declaration (Khai báo đóng gói)' },
    { value: 'PHYTOSANITARY_CERTIFICATE', label: 'Phytosanitary Certificate (Giấy chứng nhận kiểm dịch thực vật)' },
    { value: 'HEALTH_CERTIFICATE', label: 'Health Certificate (Giấy chứng nhận y tế)' },
    { value: 'FUMIGATION_CERTIFICATE', label: 'Fumigation Certificate (Giấy chứng nhận khử trùng)' },
    { value: 'QUALITY_INSPECTION_CERTIFICATE', label: 'Quality Inspection Certificate (Giấy chứng nhận chất lượng)' },
    { value: 'VAT_REFUND_DOSSIER', label: 'VAT Refund Dossier (Hồ sơ hoàn thuế)' },
    { value: 'OTHER', label: 'Other Document (Chứng từ khác)' },
];

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

const STATUS_LABEL: Record<ChecklistStatus, string> = {
    MISSING: 'Thiếu',
    DRAFT: 'Nháp',
    UPLOADED: 'Đã upload',
    GENERATED: 'Đã sinh',
    REVIEWED: 'Đã rà soát',
    APPROVED: 'Đã duyệt',
    EXPIRED: 'Hết hạn',
    NOT_APPLICABLE: 'Không áp dụng',
};

const ACTION_LABEL: Record<string, string> = {
    VERSION_CREATED: 'Tạo version',
    FILE_UPLOADED: 'Upload file',
    GENERATED: 'Sinh chứng từ',
    REVIEWED: 'Rà soát',
    SHARED: 'Share portal',
    UNSHARED: 'Gỡ share',
    DOWNLOADED: 'Buyer tải',
};

const requiredRule = { required: true, message: 'Bắt buộc' };

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
    const { notification } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [center, setCenter] = useState<DocumentCenter | null>(null);
    const [registerOpen, setRegisterOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
    const [form] = Form.useForm<RegisterDocumentValues>();
    const { token } = theme.useToken();

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
            const message = error instanceof Error ? error.message : 'Không tải được dữ liệu';
            notification.error({ title: 'Không tải được bộ chứng từ', description: message });
        } finally {
            setLoading(false);
        }
    }, [accessToken, notification, shipmentId]);

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
            notification.success({ title: `Đã tải ${type}` });
            void fetchDocumentCenter();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Không thể tải PDF';
            notification.error({ title: 'Không thể tải PDF', description: message });
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
            notification.success({ title: 'Đã tạo snapshot chứng từ' });
            void fetchDocumentCenter();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Không tạo được chứng từ';
            notification.error({ title: 'Không tạo được chứng từ', description: message });
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
            throw new Error(res?.message || 'Upload file thất bại');
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
            notification.success({ title: 'Đã ghi nhận phiên bản chứng từ' });
            form.resetFields();
            setUploadFiles([]);
            setRegisterOpen(false);
            void fetchDocumentCenter();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Không lưu được chứng từ';
            notification.error({ title: 'Không lưu được chứng từ', description: message });
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
            notification.success({ title: 'Đã cập nhật trạng thái chứng từ' });
            void fetchDocumentCenter();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Không cập nhật được chứng từ';
            notification.error({ title: 'Không cập nhật được chứng từ', description: message });
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
            notification.success({ title: shared ? 'Đã chia sẻ lên buyer portal' : 'Đã gỡ chia sẻ' });
            void fetchDocumentCenter();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Không cập nhật chia sẻ';
            notification.error({ title: 'Không cập nhật chia sẻ', description: message });
        }
    };

    const setBusinessPortSnapshot = useCallback((fieldName: 'portOfLoading' | 'portOfDischarge', port?: IPort) => {
        form.setFieldValue(['businessData', fieldName], port ? formatPortLabel(port) : undefined);
    }, [form]);

    const renderBusinessFormFields = () => {
        if (selectedDocumentType === 'BILL_OF_LADING') {
            return (
                <>
                    <Divider titlePlacement="start">Bill of Lading (Vận đơn đường biển)</Divider>
                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
                        <Form.Item label="B/L number (Số vận đơn)" name={['businessData', 'blNumber']} rules={[requiredRule]}>
                            <Input placeholder="BL-HCM-0001" />
                        </Form.Item>
                        <Form.Item label="B/L type (Loại vận đơn)" name={['businessData', 'blType']}>
                            <Select options={[
                                { value: 'ORIGINAL', label: 'Original B/L' },
                                { value: 'SEAWAY', label: 'Seaway Bill' },
                                { value: 'TELEX_RELEASE', label: 'Telex Release' },
                            ]} />
                        </Form.Item>
                        <Form.Item label="Carrier (Hãng tàu/Hàng không)" name={['businessData', 'carrierName']} rules={[requiredRule]}>
                            <Input placeholder="Maersk, ONE, CMA CGM..." />
                        </Form.Item>
                        <Form.Item label="Shipper (Người gửi hàng)" name={['businessData', 'shipperName']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Consignee (Người nhận hàng)" name={['businessData', 'consigneeName']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Notify party (Bên nhận thông báo)" name={['businessData', 'notifyParty']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Vessel (Tàu biển)" name={['businessData', 'vesselName']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Voyage (Chuyến tàu)" name={['businessData', 'voyageNumber']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item name={['businessData', 'portOfLoading']} hidden>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Port of loading (Cảng xếp)" name={['businessData', 'portOfLoading_port_id']} rules={[requiredRule]}>
                            <PortSelect
                                legacyText={getRecordString(form.getFieldValue('businessData'), 'portOfLoading')}
                                onPortChange={(port) => setBusinessPortSnapshot('portOfLoading', port)}
                            />
                        </Form.Item>
                        <Form.Item name={['businessData', 'portOfDischarge']} hidden>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Port of discharge (Cảng dỡ)" name={['businessData', 'portOfDischarge_port_id']} rules={[requiredRule]}>
                            <PortSelect
                                legacyText={getRecordString(form.getFieldValue('businessData'), 'portOfDischarge')}
                                onPortChange={(port) => setBusinessPortSnapshot('portOfDischarge', port)}
                            />
                        </Form.Item>
                        <Form.Item label="On board date (Ngày lên tàu)" name={['businessData', 'onBoardDate']} rules={[requiredRule]}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label="Freight terms (Điều kiện cước)" name={['businessData', 'freightTerms']} rules={[requiredRule]}>
                            <Select options={[
                                { value: 'PREPAID', label: 'Prepaid' },
                                { value: 'COLLECT', label: 'Collect' },
                            ]} />
                        </Form.Item>
                        <Form.Item label="Place of receipt (Nơi nhận hàng)" name={['businessData', 'placeOfReceipt']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Place of delivery (Nơi giao hàng)" name={['businessData', 'placeOfDelivery']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Containers (Số container)" name={['businessData', 'containerNumbers']}>
                            <Input placeholder="MSCU1234567, TEMU7654321" />
                        </Form.Item>
                        <Form.Item label="Seals (Số chì)" name={['businessData', 'sealNumbers']}>
                            <Input />
                        </Form.Item>
                        <Form.Item className="md:col-span-2" label="Marks and numbers (Ký mã hiệu)" name={['businessData', 'marksAndNumbers']}>
                            <Input.TextArea rows={2} />
                        </Form.Item>
                        <Form.Item label="Packages (Số kiện)" name={['businessData', 'packageCount']}>
                            <InputNumber min={0} className="w-full" />
                        </Form.Item>
                        <Form.Item label="Package type (Loại kiện)" name={['businessData', 'packageType']}>
                            <Input placeholder="Cartons, pallets, bags..." />
                        </Form.Item>
                    </div>
                </>
            );
        }

        if (selectedDocumentType === 'AIRWAY_BILL') {
            return (
                <>
                    <Divider titlePlacement="start">Airway Bill (Vận đơn hàng không)</Divider>
                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
                        <Form.Item label="AWB number (Số AWB)" name={['businessData', 'awbNumber']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="AWB type (Loại AWB)" name={['businessData', 'awbType']}>
                            <Select options={[
                                { value: 'MASTER', label: 'Master AWB' },
                                { value: 'HOUSE', label: 'House AWB' },
                            ]} />
                        </Form.Item>
                        <Form.Item label="Airline (Hãng hàng không)" name={['businessData', 'airlineName']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Shipper (Người gửi hàng)" name={['businessData', 'shipperName']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Consignee (Người nhận hàng)" name={['businessData', 'consigneeName']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Flight (Chuyến bay)" name={['businessData', 'flightNumber']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Departure airport (Sân bay đi)" name={['businessData', 'airportOfDeparture']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Destination airport (Sân bay đến)" name={['businessData', 'airportOfDestination']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Departure date (Ngày đi)" name={['businessData', 'departureDate']} rules={[requiredRule]}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label="Arrival date (Ngày đến)" name={['businessData', 'arrivalDate']}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label="Gross weight kg (Trọng lượng cả bì)" name={['businessData', 'grossWeightKg']}>
                            <InputNumber min={0} precision={2} className="w-full" />
                        </Form.Item>
                        <Form.Item label="Chargeable weight kg (Trọng lượng tính cước)" name={['businessData', 'chargeableWeightKg']}>
                            <InputNumber min={0} precision={2} className="w-full" />
                        </Form.Item>
                        <Form.Item label="Pieces (Số kiện)" name={['businessData', 'pieces']}>
                            <InputNumber min={0} className="w-full" />
                        </Form.Item>
                        <Form.Item label="Commodity (Tên hàng)" name={['businessData', 'commodity']}>
                            <Input />
                        </Form.Item>
                    </div>
                </>
            );
        }

        if (selectedDocumentType === 'CERTIFICATE_OF_ORIGIN') {
            return (
                <>
                    <Divider titlePlacement="start">Certificate of Origin (Giấy chứng nhận xuất xứ)</Divider>
                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
                        <Form.Item label="C/O number (Số C/O)" name={['businessData', 'coNumber']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Form (Mẫu C/O)" name={['businessData', 'coForm']} rules={[requiredRule]}>
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
                        <Form.Item label="Issuing authority (Cơ quan cấp)" name={['businessData', 'issuingAuthority']} rules={[requiredRule]}>
                            <Input placeholder="VCCI, MOIT..." />
                        </Form.Item>
                        <Form.Item label="Issue date (Ngày cấp)" name={['businessData', 'issueDate']} rules={[requiredRule]}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label="Origin country (Nước xuất xứ)" name={['businessData', 'originCountry']} rules={[requiredRule]}>
                            <Input placeholder="Vietnam" />
                        </Form.Item>
                        <Form.Item label="Destination country (Nước nhập khẩu)" name={['businessData', 'destinationCountry']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Invoice number (Số hóa đơn)" name={['businessData', 'invoiceNumber']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Invoice date (Ngày hóa đơn)" name={['businessData', 'invoiceDate']}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label="HS code summary (Mã HS)" name={['businessData', 'hsCodeSummary']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Transport route (Tuyến đường vận chuyển)" name={['businessData', 'transportRoute']}>
                            <Input placeholder="Vietnam to destination country" />
                        </Form.Item>
                        <Form.Item className="md:col-span-2" label="Origin criteria (Tiêu chí xuất xứ)" name={['businessData', 'criteria']}>
                            <Input.TextArea rows={2} />
                        </Form.Item>
                    </div>
                </>
            );
        }

        if (selectedDocumentType === 'CUSTOMS_DECLARATION') {
            return (
                <>
                    <Divider titlePlacement="start">Customs Declaration (Tờ khai hải quan)</Divider>
                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
                        <Form.Item label="Declaration number (Số tờ khai)" name={['businessData', 'declarationNumber']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Customs office (Chi cục hải quan)" name={['businessData', 'customsOffice']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Declaration date (Ngày khai báo)" name={['businessData', 'declarationDate']} rules={[requiredRule]}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label="Clearance date (Ngày thông quan)" name={['businessData', 'clearanceDate']} rules={[requiredRule]}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label="Channel (Luồng tờ khai)" name={['businessData', 'channel']} rules={[requiredRule]}>
                            <Select options={[
                                { value: 'GREEN', label: 'Green' },
                                { value: 'YELLOW', label: 'Yellow' },
                                { value: 'RED', label: 'Red' },
                            ]} />
                        </Form.Item>
                        <Form.Item label="Export type (Loại hình xuất khẩu)" name={['businessData', 'exportType']}>
                            <Input placeholder="B11, E62..." />
                        </Form.Item>
                        <Form.Item label="Exporter tax code (Mã số thuế xuất khẩu)" name={['businessData', 'exporterTaxCode']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Invoice number (Số hóa đơn)" name={['businessData', 'invoiceNumber']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Total invoice value (Tổng trị giá hóa đơn)" name={['businessData', 'invoiceValue']}>
                            <InputNumber min={0} precision={2} className="w-full" />
                        </Form.Item>
                        <Form.Item label="Currency (Đơn vị tiền tệ)" name={['businessData', 'currency']}>
                            <Input placeholder="USD, VND..." />
                        </Form.Item>
                        <Form.Item className="md:col-span-2" label="HS summary (Tóm tắt mã HS)" name={['businessData', 'hsCodeSummary']}>
                            <Input.TextArea rows={2} />
                        </Form.Item>
                    </div>
                </>
            );
        }

        if (selectedDocumentType === 'PACKING_DECLARATION') {
            return (
                <>
                    <Divider titlePlacement="start">Packing Declaration (Khai báo đóng gói)</Divider>
                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
                        <Form.Item label="Declaration number (Số khai báo)" name={['businessData', 'declarationNumber']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Issue date (Ngày cấp)" name={['businessData', 'issueDate']} rules={[requiredRule]}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label="Packing material (Vật liệu đóng gói)" name={['businessData', 'packingMaterial']} rules={[requiredRule]}>
                            <Select options={[
                                { value: 'WOODEN', label: 'Wooden packing' },
                                { value: 'NON_WOODEN', label: 'Non-wooden packing' },
                                { value: 'MIXED', label: 'Mixed packing' },
                            ]} />
                        </Form.Item>
                        <Form.Item label="ISPM 15 applied (Áp dụng ISPM 15)" name={['businessData', 'ispm15Applied']}>
                            <Select options={[
                                { value: 'YES', label: 'Yes' },
                                { value: 'NO', label: 'No' },
                                { value: 'NOT_APPLICABLE', label: 'Not applicable' },
                            ]} />
                        </Form.Item>
                        <Form.Item label="Declarant (Người khai báo)" name={['businessData', 'declarantName']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Position (Chức vụ)" name={['businessData', 'declarantPosition']}>
                            <Input />
                        </Form.Item>
                        <Form.Item className="md:col-span-2" label="Treatment statement (Khai báo xử lý)" name={['businessData', 'treatmentStatement']} rules={[requiredRule]}>
                            <Input.TextArea rows={2} placeholder="Describe fumigation / heat treatment / non-wood declaration." />
                        </Form.Item>
                    </div>
                </>
            );
        }

        if (selectedDocumentType === 'PHYTOSANITARY_CERTIFICATE') {
            return (
                <>
                    <Divider titlePlacement="start">Phytosanitary Certificate (Giấy chứng nhận kiểm dịch thực vật)</Divider>
                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
                        <Form.Item label="Certificate number (Số chứng nhận)" name={['businessData', 'certificateNumber']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Issuing authority (Cơ quan cấp)" name={['businessData', 'issuingAuthority']} rules={[requiredRule]}>
                            <Input placeholder="Plant Protection Department..." />
                        </Form.Item>
                        <Form.Item label="Issue date (Ngày cấp)" name={['businessData', 'issueDate']} rules={[requiredRule]}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label="Inspection place (Nơi kiểm dịch)" name={['businessData', 'inspectionPlace']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Botanical name (Tên thực vật)" name={['businessData', 'botanicalName']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Treatment (Biện pháp xử lý)" name={['businessData', 'treatment']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Quantity (Số lượng)" name={['businessData', 'quantity']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Destination country (Nước đến)" name={['businessData', 'destinationCountry']}>
                            <Input />
                        </Form.Item>
                        <Form.Item className="md:col-span-2" label="Additional declaration (Khai báo bổ sung)" name={['businessData', 'additionalDeclaration']}>
                            <Input.TextArea rows={2} />
                        </Form.Item>
                    </div>
                </>
            );
        }

        if (selectedDocumentType === 'HEALTH_CERTIFICATE') {
            return (
                <>
                    <Divider titlePlacement="start">Health Certificate (Giấy chứng nhận y tế)</Divider>
                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
                        <Form.Item label="Certificate number (Số chứng nhận)" name={['businessData', 'certificateNumber']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Issuing authority (Cơ quan cấp)" name={['businessData', 'issuingAuthority']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Issue date (Ngày cấp)" name={['businessData', 'issueDate']} rules={[requiredRule]}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label="Product description (Mô tả sản phẩm)" name={['businessData', 'productDescription']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Batch / lot (Số lô)" name={['businessData', 'batchOrLotNumber']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Manufacturing date (Ngày sản xuất)" name={['businessData', 'manufacturingDate']}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label="Expiry date (Ngày hết hạn)" name={['businessData', 'expiryDate']}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label="Destination country (Nước đến)" name={['businessData', 'destinationCountry']}>
                            <Input />
                        </Form.Item>
                        <Form.Item className="md:col-span-2" label="Health statement (Tuyên bố sức khỏe)" name={['businessData', 'healthStatement']} rules={[requiredRule]}>
                            <Input.TextArea rows={2} />
                        </Form.Item>
                    </div>
                </>
            );
        }

        if (selectedDocumentType === 'FUMIGATION_CERTIFICATE') {
            return (
                <>
                    <Divider titlePlacement="start">Fumigation Certificate (Giấy chứng nhận khử trùng)</Divider>
                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
                        <Form.Item label="Certificate number (Số chứng nhận)" name={['businessData', 'certificateNumber']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Fumigation company (Công ty khử trùng)" name={['businessData', 'fumigationCompany']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Fumigation date (Ngày khử trùng)" name={['businessData', 'fumigationDate']} rules={[requiredRule]}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label="Chemical used (Hóa chất sử dụng)" name={['businessData', 'chemicalUsed']} rules={[requiredRule]}>
                            <Input placeholder="Methyl Bromide, Phosphine..." />
                        </Form.Item>
                        <Form.Item label="Dosage (Liều lượng)" name={['businessData', 'dosage']} rules={[requiredRule]}>
                            <Input placeholder="g/m3" />
                        </Form.Item>
                        <Form.Item label="Exposure duration (Thời gian ủ thuốc)" name={['businessData', 'exposureDuration']}>
                            <Input placeholder="24 hours" />
                        </Form.Item>
                        <Form.Item label="Temperature (Nhiệt độ)" name={['businessData', 'temperature']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Treatment location (Địa điểm xử lý)" name={['businessData', 'treatmentLocation']}>
                            <Input />
                        </Form.Item>
                        <Form.Item className="md:col-span-2" label="Container / seal numbers (Số container / seal)" name={['businessData', 'containerSealNumbers']}>
                            <Input.TextArea rows={2} />
                        </Form.Item>
                    </div>
                </>
            );
        }

        if (selectedDocumentType === 'QUALITY_INSPECTION_CERTIFICATE') {
            return (
                <>
                    <Divider titlePlacement="start">Quality Inspection Certificate (Giấy chứng nhận chất lượng)</Divider>
                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
                        <Form.Item label="Certificate number (Số chứng nhận)" name={['businessData', 'certificateNumber']} rules={[requiredRule]}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Inspection agency (Cơ quan giám định)" name={['businessData', 'inspectionAgency']} rules={[requiredRule]}>
                            <Input placeholder="SGS, Bureau Veritas, Vinacontrol..." />
                        </Form.Item>
                        <Form.Item label="Issue date (Ngày cấp)" name={['businessData', 'issueDate']} rules={[requiredRule]}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label="Inspection date (Ngày giám định)" name={['businessData', 'inspectionDate']}>
                            <DatePicker className="w-full" />
                        </Form.Item>
                        <Form.Item label="Inspection standard (Tiêu chuẩn giám định)" name={['businessData', 'inspectionStandard']} rules={[requiredRule]}>
                            <Input placeholder="Contract spec, ISO, buyer spec..." />
                        </Form.Item>
                        <Form.Item label="Inspection result (Kết quả giám định)" name={['businessData', 'inspectionResult']} rules={[requiredRule]}>
                            <Select options={[
                                { value: 'PASSED', label: 'Passed' },
                                { value: 'CONDITIONALLY_PASSED', label: 'Conditionally passed' },
                                { value: 'FAILED', label: 'Failed' },
                            ]} />
                        </Form.Item>
                        <Form.Item label="Sample size (Cỡ mẫu)" name={['businessData', 'sampleSize']}>
                            <Input />
                        </Form.Item>
                        <Form.Item label="Defect rate (Tỷ lệ lỗi)" name={['businessData', 'defectRate']}>
                            <Input />
                        </Form.Item>
                        <Form.Item className="md:col-span-2" label="Inspection remarks (Nhận xét giám định)" name={['businessData', 'inspectionRemarks']}>
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
            title: 'Thời gian',
            dataIndex: 'at',
            width: 180,
            render: (value?: string) => formatDateTime(value),
        },
        {
            title: 'Sự kiện',
            dataIndex: 'action',
            width: 150,
            render: (value: string) => ACTION_LABEL[value] || value,
        },
        { title: 'Người xử lý', dataIndex: 'username', width: 140 },
        {
            title: 'Ghi chú',
            dataIndex: 'note',
            render: (value?: string | null) => value || '-',
        },
        {
            title: 'File',
            width: 110,
            render: (_, record) => record.fileUrl ? (
                <Button size="small" icon={<EyeOutlined />} onClick={() => handleOpenFile(record.fileUrl)}>
                    Mở
                </Button>
            ) : '-',
        },
    ];

    const checklistColumns: ColumnsType<ChecklistRow> = [
        {
            title: 'Chứng từ',
            dataIndex: 'label',
            render: (label: string, record) => (
                <Space>
                    <FileDoneOutlined />
                    <div>
                        <Text strong>{label}</Text>
                        {record.required && <Tag className="ml-2" color="red">Bắt buộc</Tag>}
                    </div>
                </Space>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 150,
            render: (status: ChecklistStatus) => <Tag color={STATUS_COLOR[status] || 'default'}>{STATUS_LABEL[status] || status}</Tag>,
        },
        {
            title: 'Phiên bản',
            width: 110,
            render: (_, record) => record.document ? `v${record.document.versionNo}` : '-',
        },
        {
            title: 'Số chứng từ',
            width: 180,
            render: (_, record) => record.document?.documentNumber || '-',
        },
        {
            title: 'Thao tác',
            width: 380,
            render: (_, record) => (
                <Space wrap>
                    {['COMMERCIAL_INVOICE', 'PACKING_LIST'].includes(record.documentType) && (
                        <Button size="small" icon={<ReloadOutlined />} onClick={() => handleGenerate(record.documentType)}>
                            Sinh
                        </Button>
                    )}
                    {record.documentType === 'COMMERCIAL_INVOICE' && (
                        <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownloadPdf('CI')}>
                            CI
                        </Button>
                    )}
                    {record.documentType === 'PACKING_LIST' && (
                        <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownloadPdf('PL')}>
                            PL
                        </Button>
                    )}
                    {isBusinessDocumentType(record.documentType) && (
                        <Button size="small" icon={<FormOutlined />} onClick={() => openRegisterModal(record.documentType)}>
                            Form
                        </Button>
                    )}
                    {record.document?.fileUrl && (
                        <Button size="small" icon={<EyeOutlined />} onClick={() => handleOpenFile(record.document?.fileUrl)}>
                            File
                        </Button>
                    )}
                    {record.document && record.status !== 'APPROVED' && (
                        <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleReview(record, 'APPROVED')}>
                            Duyệt
                        </Button>
                    )}
                    {record.document && (
                        <Button
                            size="small"
                            icon={<ShareAltOutlined />}
                            onClick={() => handleShare(record.document?._id || '', !record.document?.sharedWithBuyer)}
                        >
                            {record.document.sharedWithBuyer ? 'Gỡ share' : 'Share'}
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    const versionsColumns: ColumnsType<ExportDocumentRecord> = [
        { title: 'Loại', dataIndex: 'documentType', width: 210 },
        { title: 'Số CT', dataIndex: 'documentNumber', render: (value?: string | null) => value || '-' },
        { title: 'Version', dataIndex: 'versionNo', width: 90, render: (value: number) => `v${value}` },
        {
            title: 'Trạng thái',
            dataIndex: 'checklistStatus',
            width: 140,
            render: (status: ChecklistStatus) => <Tag color={STATUS_COLOR[status] || 'default'}>{STATUS_LABEL[status] || status}</Tag>,
        },
        {
            title: 'File',
            width: 120,
            render: (_, record) => record.fileUrl ? (
                <Button size="small" icon={<EyeOutlined />} onClick={() => handleOpenFile(record.fileUrl)}>
                    Mở file
                </Button>
            ) : '-',
        },
        {
            title: 'Files ref',
            dataIndex: 'fileAsset_id',
            width: 120,
            render: (value?: string | null) => value ? <Text code>{value.slice(-12)}</Text> : '-',
        },
        {
            title: 'Current',
            dataIndex: 'isCurrentVersion',
            width: 90,
            render: (value: boolean) => <Badge status={value ? 'success' : 'default'} text={value ? 'Có' : 'Cũ'} />,
        },
        {
            title: 'Người xử lý',
            width: 160,
            render: (_, record) => record.reviewedByUsername || record.uploadedByUsername || '-',
        },
        {
            title: 'Audit mới nhất',
            width: 170,
            render: (_, record) => {
                const latest = record.auditTrail?.[record.auditTrail.length - 1];
                return latest ? `${ACTION_LABEL[latest.action] || latest.action} - ${latest.username}` : '-';
            },
        },
        {
            title: 'Buyer portal',
            width: 120,
            render: (_, record) => (
                <Tag color={record.sharedWithBuyer ? 'green' : 'default'}>
                    {record.sharedWithBuyer ? 'Đang share' : 'Nội bộ'}
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
                    locale={{ emptyText: 'Chưa có audit trail' }}
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
                    <Text strong>Trung tâm chứng từ xuất khẩu</Text>
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
                        Ghi nhận chứng từ
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={fetchDocumentCenter}>
                        Làm mới
                    </Button>
                </Space>
            }
        >
            <Space className="w-full" orientation="vertical" size={16}>
                <Descriptions bordered size="small" column={3}>
                    <Descriptions.Item label="Lô hàng">{shipment?.shipmentNumber || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Hợp đồng">{shipment?.salesContract?.contractNumber || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Trạng thái">{shipment?.status || '-'}</Descriptions.Item>
                    <Descriptions.Item label="POL">{shipment?.pol || '-'}</Descriptions.Item>
                    <Descriptions.Item label="POD">{shipment?.pod || '-'}</Descriptions.Item>
                    <Descriptions.Item label="B/L">{shipment?.blNumber || '-'}</Descriptions.Item>
                </Descriptions>

                <Tabs
                    defaultActiveKey="checklist"
                    items={[
                        {
                            key: 'checklist',
                            label: 'Checklist chứng từ',
                            children: (
                                <Space className="w-full" orientation="vertical" size={16}>
                                    <div 
                                        className="rounded-lg border p-4" 
                                        style={{ background: token.colorBgContainer, borderColor: token.colorBorderSecondary }}
                                    >
                                        <Space className="w-full justify-between" wrap>
                                            <div>
                                                <Text strong>Hồ sơ hoàn thuế GTGT xuất khẩu</Text>
                                                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>Cần đủ CI, PL, B/L, C/O và tờ khai hải quan.</div>
                                            </div>
                                            <Tag color={dossierReady ? 'green' : 'orange'}>
                                                {dossierReady ? 'Sẵn sàng' : 'Chưa đủ chứng từ'}
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
                            label: 'Lịch sử phiên bản',
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
                title="Ghi nhận phiên bản chứng từ"
                open={registerOpen}
                onCancel={() => setRegisterOpen(false)}
                onOk={() => form.submit()}
                confirmLoading={uploading}
                destroyOnHidden
                width={760}
            >
                <Form form={form} layout="vertical" onFinish={handleRegister}>
                    <Form.Item label="Loại chứng từ" name="documentType" rules={[requiredRule]}>
                        <Select options={DOCUMENT_OPTIONS} showSearch optionFilterProp="label" />
                    </Form.Item>

                    {renderBusinessFormFields()}

                    <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
                        <Form.Item label="Số chứng từ" name="documentNumber">
                            <Input placeholder="Nếu bỏ trống sẽ lấy từ form nghiệp vụ" />
                        </Form.Item>
                        <Form.Item label="Tên file" name="fileName">
                            <Input placeholder="commercial-invoice.pdf" />
                        </Form.Item>
                    </div>

                    <Form.Item label="Upload file PDF/ảnh qua Files module">
                        <Upload
                            beforeUpload={() => false}
                            maxCount={1}
                            fileList={uploadFiles}
                            onChange={({ fileList }) => setUploadFiles(fileList)}
                            accept="application/pdf,image/*"
                        >
                            <Button icon={<UploadOutlined />}>Chọn file từ máy</Button>
                        </Upload>
                    </Form.Item>
                    <Form.Item label="Đường dẫn file" name="fileUrl">
                        <Input placeholder="/uploads/documents/... nếu file đã có sẵn" />
                    </Form.Item>
                    <Form.Item label="Số tờ khai hải quan" name="customsDeclarationNumber">
                        <Input placeholder="Nếu là tờ khai hải quan và muốn nhập nhanh" />
                    </Form.Item>
                    <Form.Item label="Ghi chú" name="notes">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                </Form>
            </Modal>
        </Drawer>
    );
};

export default ShipmentDocCenter;
