'use client'

import React, { useRef, useState, useEffect } from 'react';
import { Drawer, Tabs, Button, Space, Typography, Tag, Divider, Empty, Spin } from 'antd';
import { FilePdfOutlined, PrinterOutlined, DownloadOutlined, CloseOutlined, FileTextOutlined, ContainerOutlined } from '@ant-design/icons';
import { useReactToPrint } from 'react-to-print';
import { sendRequest } from '@/utils/api';
import type { IShipment } from '@/types/o2c';

const { Title, Text } = Typography;

interface IProps {
    open: boolean;
    onClose: () => void;
    shipmentId: string | null;
    session: any;
}

const ShipmentDocCenter = ({ open, onClose, shipmentId, session }: IProps) => {
    const [shipment, setShipment] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Export_Docs_${shipment?.shipmentNumber || ''}`,
    });

    useEffect(() => {
        if (open && shipmentId) {
            fetchShipmentDetail();
        }
    }, [open, shipmentId]);

    const fetchShipmentDetail = async () => {
        setLoading(true);
        try {
            const res = await sendRequest<IBackendRes<any>>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments/${shipmentId}`,
                method: 'GET',
                headers: { Authorization: `Bearer ${session?.access_token || session?.user?.access_token}` },
            });
            if (res?.data) {
                setShipment(res.data);
            }
        } catch (error) {
            console.error('Error fetching shipment detail:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!shipmentId) return null;

    return (
        <Drawer
            title={
                <Space>
                    <FilePdfOutlined className="text-red-500" />
                    <span className="font-bold text-slate-800">TRUNG TÂM CHỨNG TỪ XUẤT KHẨU</span>
                    <Tag color="blue">{shipment?.shipmentNumber}</Tag>
                </Space>
            }
            placement="right"
            styles={{ body: { background: '#f8fafc', padding: 0 }, wrapper: { width: 1000 } }}
            onClose={onClose}
            open={open}
            extra={
                <Space>
                    <Button icon={<PrinterOutlined />} type="primary" onClick={() => handlePrint()}>
                        In bộ chứng từ
                    </Button>
                </Space>
            }
        >
            {loading ? (
                <div className="h-full flex items-center justify-center">
                    <Spin size="large" description="Đang tải dữ liệu lô hàng..." />
                </div>
            ) : shipment ? (
                <div className="h-full flex flex-col">
                    <div className="flex-1 overflow-auto p-8">
                        {/* Area to print */}
                        <div ref={printRef} className="bg-white shadow-2xl mx-auto overflow-hidden" style={{ width: '210mm', minHeight: '297mm', padding: '20mm' }}>
                            <Tabs
                                defaultActiveKey="ci"
                                items={[
                                    {
                                        key: 'ci',
                                        label: (
                                            <span>
                                                <FileTextOutlined /> COMMERCIAL INVOICE
                                            </span>
                                        ),
                                        children: <CommercialInvoiceTemplate shipment={shipment} />,
                                    },
                                    {
                                        key: 'pl',
                                        label: (
                                            <span>
                                                <ContainerOutlined /> PACKING LIST
                                            </span>
                                        ),
                                        children: <PackingListTemplate shipment={shipment} />,
                                    },
                                ]}
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <Empty description="Không tìm thấy dữ liệu lô hàng" />
            )}
        </Drawer>
    );
};

// --- PREVIEW TEMPLATES ---

const CommercialInvoiceTemplate = ({ shipment }: { shipment: any }) => {
    const contract = shipment.salesContract;
    const buyer = contract?.buyer;
    
    return (
        <div className="document-preview text-slate-900" style={{ fontFamily: 'Times New Roman, serif' }}>
            {/* Header */}
            <div className="text-center mb-10">
                <Title level={2} style={{ margin: 0, textTransform: 'uppercase', color: '#000' }}>Commercial Invoice</Title>
                <Text type="secondary">Invoice No: CI-{shipment.shipmentNumber}</Text>
                <div className="mt-2 text-sm">Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 gap-12 mb-10 border-t border-b border-slate-200 py-6">
                <div>
                    <Text strong className="uppercase text-xs tracking-wider text-slate-400 block mb-2">Exporter / Shipper</Text>
                    <div className="font-bold text-base">CÔNG TY CỔ PHẦN XUẤT NHẬP KHẨU MINI ERP</div>
                    <div className="text-sm mt-1">123 Export Tower, District 1, Ho Chi Minh City, Vietnam</div>
                    <div className="text-sm">Tel: +84 28 3822 0000 | Email: export@minierp.com</div>
                </div>
                <div>
                    <Text strong className="uppercase text-xs tracking-wider text-slate-400 block mb-2">Importer / Consignee</Text>
                    <div className="font-bold text-base uppercase">{buyer?.name || 'N/A'}</div>
                    <div className="text-sm mt-1">{buyer?.address || 'N/A'}</div>
                    {buyer?.contactPerson && <div className="text-sm">Attn: {buyer.contactPerson}</div>}
                    {buyer?.taxId && <div className="text-sm">Tax ID: {buyer.taxId}</div>}
                </div>
            </div>

            {/* Shipment Info */}
            <div className="grid grid-cols-4 gap-4 mb-10 text-sm bg-slate-50 p-4 rounded-lg">
                <div>
                    <div className="text-slate-400 text-xs uppercase">Contract No.</div>
                    <div className="font-semibold">{contract?.contractNumber}</div>
                </div>
                <div>
                    <div className="text-slate-400 text-xs uppercase">Vessel / Flight</div>
                    <div className="font-semibold">{shipment.vesselName || '-'}</div>
                </div>
                <div>
                    <div className="text-slate-400 text-xs uppercase">Port of Loading</div>
                    <div className="font-semibold">{shipment.pol || '-'}</div>
                </div>
                <div>
                    <div className="text-slate-400 text-xs uppercase">Port of Discharge</div>
                    <div className="font-semibold">{shipment.pod || '-'}</div>
                </div>
            </div>

            {/* Items Table */}
            <table className="w-full mb-10 border-collapse">
                <thead>
                    <tr className="border-b-2 border-slate-900 text-left text-xs uppercase tracking-wider">
                        <th className="py-3 px-2">Description of Goods</th>
                        <th className="py-3 px-2 text-center">Quantity</th>
                        <th className="py-3 px-2 text-right">Unit Price ({contract?.currencyCode})</th>
                        <th className="py-3 px-2 text-right">Amount ({contract?.currencyCode})</th>
                    </tr>
                </thead>
                <tbody className="text-sm">
                    {contract?.items?.map((item: any, index: number) => (
                        <tr key={index} className="border-b border-slate-100">
                            <td className="py-4 px-2">
                                <div className="font-bold">{item.product?.vietnameseName}</div>
                                <div className="text-xs text-slate-500">{item.product?.englishName || item.productDescription}</div>
                                <div className="text-xs text-slate-400 mt-1">HS Code: {item.product?.hsCode || '-'}</div>
                            </td>
                            <td className="py-4 px-2 text-center">{item.quantity} {item.unit || 'PCS'}</td>
                            <td className="py-4 px-2 text-right">{item.unitPrice?.toLocaleString()}</td>
                            <td className="py-4 px-2 text-right font-semibold">{(item.quantity * item.unitPrice)?.toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="border-t-2 border-slate-900">
                        <td colSpan={3} className="py-4 px-2 text-right font-bold uppercase">Total {contract?.incoterm} Value:</td>
                        <td className="py-4 px-2 text-right font-black text-lg underline">
                            {contract?.currencyCode} {contract?.totalAmount?.toLocaleString()}
                        </td>
                    </tr>
                </tfoot>
            </table>

            {/* Footer */}
            <div className="grid grid-cols-2 mt-20">
                <div className="text-xs italic text-slate-500">
                    <div>Say: {contract?.currencyCode} {contract?.totalAmount?.toLocaleString()} Only.</div>
                    <div className="mt-4">Payment Terms: {contract?.paymentTerms || 'By T/T'}</div>
                </div>
                <div className="text-center">
                    <div className="font-bold uppercase mb-20">For and on behalf of Seller</div>
                    <div className="border-t border-slate-400 inline-block px-10 pt-2">Authorized Signature</div>
                </div>
            </div>
        </div>
    );
};

const PackingListTemplate = ({ shipment }: { shipment: any }) => {
    const contract = shipment.salesContract;
    const buyer = contract?.buyer;
    
    // Calculate totals for PL
    const totalQty = contract?.items?.reduce((sum: number, i: any) => sum + Number(i.quantity), 0);
    
    return (
        <div className="document-preview text-slate-900" style={{ fontFamily: 'Times New Roman, serif' }}>
            {/* Header */}
            <div className="text-center mb-10">
                <Title level={2} style={{ margin: 0, textTransform: 'uppercase', color: '#000' }}>Packing List</Title>
                <Text type="secondary">Ref No: PL-{shipment.shipmentNumber}</Text>
                <div className="mt-2 text-sm">Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>

            {/* Parties - Simplified for PL */}
            <div className="grid grid-cols-2 gap-12 mb-10 py-6 border-b border-slate-100">
                <div>
                    <Text strong className="uppercase text-[10px] text-slate-400 block mb-1">Shipper</Text>
                    <div className="font-bold text-sm">CÔNG TY CỔ PHẦN XUẤT NHẬP KHẨU MINI ERP</div>
                </div>
                <div>
                    <Text strong className="uppercase text-[10px] text-slate-400 block mb-1">Consignee</Text>
                    <div className="font-bold text-sm uppercase">{buyer?.name || 'N/A'}</div>
                </div>
            </div>

            {/* Containers Info */}
            <div className="mb-6">
                <Text strong className="uppercase text-xs mb-2 block">Container Detail:</Text>
                <div className="flex flex-wrap gap-2">
                    {shipment.containers?.map((c: any, i: number) => (
                        <Tag key={i} color="blue" className="rounded-md font-mono">
                            {c.containerNumber} / {c.containerType}
                        </Tag>
                    )) || <Text type="secondary">LCL Shipment</Text>}
                </div>
            </div>

            {/* Items Table */}
            <table className="w-full mb-10 border-collapse border border-slate-300">
                <thead>
                    <tr className="bg-slate-50 text-left text-xs uppercase border-b border-slate-300">
                        <th className="py-2 px-2 border-r border-slate-300">Description</th>
                        <th className="py-2 px-2 border-r border-slate-300 text-center">Unit</th>
                        <th className="py-2 px-2 border-r border-slate-300 text-center">Quantity</th>
                        <th className="py-2 px-2 border-r border-slate-300 text-center">Net Weight</th>
                        <th className="py-2 px-2 text-center">Gross Weight</th>
                    </tr>
                </thead>
                <tbody className="text-sm">
                    {contract?.items?.map((item: any, index: number) => (
                        <tr key={index} className="border-b border-slate-200">
                            <td className="py-3 px-2 border-r border-slate-200">
                                <div className="font-bold">{item.product?.englishName || item.product?.vietnameseName}</div>
                                <div className="text-[10px] text-slate-400">SKU: {item.product?.sku}</div>
                            </td>
                            <td className="py-3 px-2 border-r border-slate-200 text-center uppercase">{item.unit || 'PCS'}</td>
                            <td className="py-3 px-2 border-r border-slate-200 text-center font-bold">{item.quantity}</td>
                            <td className="py-3 px-2 border-r border-slate-200 text-center">
                                {item.product?.piecesPerCarton ? ((item.quantity / item.product.piecesPerCarton) * 10).toFixed(2) : '-'} KGS
                            </td>
                            <td className="py-3 px-2 text-center font-semibold">
                                {item.product?.grossWeightPerCarton ? ((item.quantity / (item.product.piecesPerCarton || 1)) * item.product.grossWeightPerCarton).toFixed(2) : '-'} KGS
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="font-bold bg-slate-50 border-t border-slate-300">
                        <td colSpan={2} className="py-3 px-2 text-right border-r border-slate-300">GRAND TOTAL:</td>
                        <td className="py-3 px-2 text-center border-r border-slate-300">{totalQty}</td>
                        <td className="py-3 px-2 text-center border-r border-slate-300">TBD</td>
                        <td className="py-3 px-2 text-center">TBD</td>
                    </tr>
                </tfoot>
            </table>

            {/* Summary */}
            <div className="bg-slate-50 p-6 rounded-xl text-sm italic">
                Notes: The goods are packed in export standard cartons and loaded into containers. 
                Shipping marks are according to Sales Contract {contract?.contractNumber}.
            </div>

            <div className="mt-20 text-center float-right w-1/2">
                <div className="font-bold uppercase mb-20">Authorized Signature</div>
                <div className="border-t border-slate-300 inline-block px-10 pt-2">Company Stamp & Signature</div>
            </div>
        </div>
    );
};

export default ShipmentDocCenter;
