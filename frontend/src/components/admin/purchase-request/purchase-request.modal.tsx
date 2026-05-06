'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Modal, Form, Input, DatePicker, Select, InputNumber, 
  Button, Space, Typography, Divider, Row, Col, Card, Tooltip, Badge, Tag
} from 'antd';
import { notification } from '@/library/antd.static';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  ShoppingCartOutlined,
  InfoCircleOutlined,
  AppstoreOutlined,
  CalculatorOutlined,
  BlockOutlined,
  TeamOutlined,
  ShopOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
  BankOutlined,
  FlagOutlined,
  ProjectOutlined
} from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import { IProduct } from '@/types/product';
import { IPurchaseRequestItem } from '@/types/purchase-request';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';

const { Text, Title } = Typography;

interface IProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  fetchData: () => void;
  initialData?: any;
  mode?: 'create' | 'edit' | 'view';
}

interface IFormValues {
  requestDate: Dayjs;
  expectedDate?: Dayjs;
  department: string;
  priority: string;
  project?: string;
  purpose?: string;
  items: IPurchaseRequestItem[];
}

const DEFAULT_DEPARTMENTS = (t: any) => [
  { label: t('departments.KHO'), value: 'KHO', icon: <ShopOutlined style={{ color: '#1890ff' }} /> },
  { label: t('departments.SANXUAT'), value: 'SANXUAT', icon: <BlockOutlined style={{ color: '#52c41a' }} /> },
  { label: t('departments.MARKETING'), value: 'MARKETING', icon: <ThunderboltOutlined style={{ color: '#faad14' }} /> },
  { label: t('departments.HANHCHINH'), value: 'HANHCHINH', icon: <TeamOutlined style={{ color: '#722ed1' }} /> },
  { label: t('departments.KETOAN'), value: 'KETOAN', icon: <BankOutlined style={{ color: '#eb2f96' }} /> },
  { label: t('departments.KYTHUAT'), value: 'KYTHUAT', icon: <SafetyCertificateOutlined style={{ color: '#13c2c2' }} /> },
];

const PRIORITY_OPTIONS = (t: any) => [
  { label: t('priorities.LOW'), value: 'LOW', color: 'blue' },
  { label: t('priorities.MEDIUM'), value: 'MEDIUM', color: 'green' },
  { label: t('priorities.HIGH'), value: 'HIGH', color: 'orange' },
  { label: t('priorities.URGENT'), value: 'URGENT', color: 'red' },
];

const PurchaseRequestModal = (props: IProps) => {
  const { isOpen, setIsOpen, fetchData, initialData, mode = 'create' } = props;
  const t = useTranslations('PurchaseRequest');
  const { data: session } = useSession();
  const [form] = Form.useForm<IFormValues>();
  const [loading, setLoading] = useState<boolean>(false);
  const [products, setProducts] = useState<IProduct[]>([]);
  const [depts, setDepts] = useState(DEFAULT_DEPARTMENTS(t));
  
  useEffect(() => {
    setDepts(DEFAULT_DEPARTMENTS(t));
  }, [t]);
  const [newDeptName, setNewDeptName] = useState('');
  const inputRef = useRef<any>(null);

  // Watch for dynamic calculation
  const watchedItems = Form.useWatch('items', form);

  const onNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewDeptName(event.target.value);
  };

  const addItem = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    e.preventDefault();
    if (!newDeptName) return;
    const exists = depts.find(d => d.label.includes(newDeptName) || d.value === newDeptName);
    if (!exists) {
        setDepts([...depts, { 
            label: `${newDeptName}${t('departments.NEW')}`, 
            value: newDeptName.toUpperCase().replace(/\s+/g, '_'), 
            icon: <TeamOutlined /> 
        }]);
    }
    setNewDeptName('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  // Fetch products for selection
  useEffect(() => {
    const fetchProducts = async () => {
      const accessToken = session?.access_token;
      if (!accessToken) return;

      try {
        const res = await sendRequest<IBackendRes<IModelPaginate<IProduct>>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products`,
          method: 'GET',
          queryParams: { current: 1, pageSize: 1000 },
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        
        if (res?.data?.results) {
          setProducts(res.data.results);
        } else if (Array.isArray(res?.data)) {
          setProducts(res.data as unknown as IProduct[]);
        }
      } catch (error) {
        console.error('Error fetching products', error);
      }
    };
    if (isOpen && session) fetchProducts();
  }, [isOpen, session]);

  // Handle Edit/View mode - Set initial values
  useEffect(() => {
    if (isOpen && initialData) {
      form.setFieldsValue({
        ...initialData,
        requestDate: dayjs(initialData.createdAt),
        expectedDate: initialData.expectedDate ? dayjs(initialData.expectedDate) : undefined,
        items: initialData.items.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit,
          estimatedPrice: item.estimatedPrice,
          note: item.note
        })),
      });
    } else if (isOpen && mode === 'create') {
      form.resetFields();
    }
  }, [isOpen, initialData, form, mode]);

  const handleProductChange = (productId: string, index: number) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const currentItems = form.getFieldValue('items') || [];
      const updatedItems = [...currentItems];
      updatedItems[index] = {
        ...updatedItems[index],
        unit: product.unitOfMeasure || 'PCS',
        estimatedPrice: product.purchasePriceVnd || 0,
      };
      form.setFieldsValue({ items: updatedItems });
    }
  };

  const grandTotal = useMemo(() => {
    if (!watchedItems) return 0;
    return watchedItems.reduce((acc: number, curr: IPurchaseRequestItem) => {
      const q = curr?.quantity || 0;
      const p = curr?.estimatedPrice || 0;
      return acc + (q * p);
    }, 0);
  }, [watchedItems]);

  const onFinish = async (values: IFormValues) => {
    if (!values.items || values.items.length === 0) {
      notification.warning({ title: t('notifications.addItemWarning') });
      return;
    }

    setLoading(true);
    const accessToken = session?.access_token;

    try {
      const payload = {
        ...values,
        requiredDate: values.requestDate.format('YYYY-MM-DD'),
        expectedDate: values.expectedDate?.format('YYYY-MM-DD'),
        items: values.items.map((item: IPurchaseRequestItem) => ({
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit,
          estimatedPrice: item.estimatedPrice,
          note: (item as any).note
        })),
      };

      const res = await sendRequest<IBackendRes<any>>({
        url: mode === 'edit' 
            ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-requests/${initialData.id}`
            : `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-requests`,
        method: mode === 'edit' ? 'PATCH' : 'POST',
        body: payload,
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        notification.success({ title: mode === 'edit' ? t('notifications.updateSuccess') : t('notifications.createSuccess') });
        setIsOpen(false);
        form.resetFields();
        fetchData();
      } else {
        notification.error({ title: t('notifications.errorTitle'), description: res?.message });
      }
    } catch (error) {
      notification.error({ title: t('notifications.systemError') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <Space size="middle">
          <div style={{ 
            width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #fa8c16 0%, #ffbb96 100%)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(250, 140, 22, 0.2)'
          }}>
            <ShoppingCartOutlined style={{ color: '#fff', fontSize: 20 }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#262626', lineHeight: 1.2 }}>
                {mode === 'view' ? t('modal.titleView') : mode === 'edit' ? t('modal.titleEdit') : t('modal.titleCreate')}
            </div>
            <Text style={{ fontSize: 12, color: '#8c8c8c' }}>{t('title')}</Text>
          </div>
        </Space>
      }
      open={isOpen}
      onCancel={() => setIsOpen(false)}
      onOk={() => mode !== 'view' && form.submit()}
      footer={mode === 'view' ? [
        <Button key="close" onClick={() => setIsOpen(false)}>{t('modal.closeBtn')}</Button>
      ] : undefined}
      confirmLoading={loading}
      width={1100}
      destroyOnHidden
      mask={{ closable: false }}
      okText={t('modal.submitBtn')}
      cancelText={t('modal.cancelBtn')}
      style={{ top: 20 }}
      styles={{
        header: { padding: '20px 24px', borderBottom: '1px solid #f0f0f0' },
        body: { padding: '0', background: '#f8f9fa' },
        footer: { padding: '16px 24px', borderTop: '1px solid #f0f0f0', background: '#fff' }
      }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        disabled={mode === 'view'}
        initialValues={{
          requestDate: dayjs(),
          priority: 'MEDIUM',
          items: [{ quantity: 1, unit: 'PCS', estimatedPrice: 0 }],
        }}
        style={{ padding: '24px' }}
      >
        <Row gutter={24}>
          <Col span={16}>
            <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <Divider plain style={{ marginTop: 0 }}>
                <Space><InfoCircleOutlined style={{ color: '#1890ff' }} /> <Text strong>{t('modal.infoDivider')}</Text></Space>
              </Divider>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label={t('modal.form.requestDate')} name="requestDate" rules={[{ required: true, message: t('modal.form.required') }]}>
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder={t('modal.form.datePlaceholder')} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('modal.form.expectedDate')} name="expectedDate">
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder={t('modal.form.datePlaceholder')} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('modal.form.priority')} name="priority" rules={[{ required: true }]}>
                    <Select
                      options={PRIORITY_OPTIONS(t).map(opt => ({
                        label: <Badge color={opt.color} text={opt.label} />,
                        value: opt.value
                      }))}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                    <Select
                      placeholder={t('modal.form.deptPlaceholder')}
                      popupRender={(menu) => (
                        <>
                          {menu}
                          <Divider style={{ margin: '8px 0' }} />
                          <Space style={{ padding: '0 8px 4px' }}>
                            <Input
                              placeholder={t('modal.form.newDeptPlaceholder')}
                              ref={inputRef}
                              value={newDeptName}
                              onChange={onNameChange}
                              onKeyDown={(e) => e.stopPropagation()}
                            />
                            <Button type="text" icon={<PlusOutlined />} onClick={addItem}>
                              {t('modal.form.addBtn')}
                            </Button>
                          </Space>
                        </>
                      )}
                      options={depts.map(dept => ({
                        label: <Space>{dept.icon} {dept.label}</Space>,
                        value: dept.value
                      }))}
                    />
                  </Col>
                <Col span={12}>
                  <Form.Item label={t('modal.form.project')} name="project">
                    <Input prefix={<ProjectOutlined style={{ color: '#8c8c8c' }} />} placeholder={t('modal.form.projectPlaceholder')} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label={t('modal.form.purpose')} name="purpose" style={{ marginBottom: 0 }}>
                <Input.TextArea rows={2} placeholder={t('modal.form.purposePlaceholder')} />
              </Form.Item>
            </Card>
          </Col>

          <Col span={8}>
            <Card variant="borderless" style={{ height: '100%', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', background: 'linear-gradient(180deg, #fff 0%, #f0f5ff 100%)' }}>
                <Divider plain style={{ marginTop: 0 }}>
                    <Space><CalculatorOutlined style={{ color: '#fa8c16' }} /> <Text strong>{t('modal.summaryDivider')}</Text></Space>
                </Divider>
                
                <div style={{ padding: '20px 0', textAlign: 'center' }}>
                    <div style={{ color: '#8c8c8c', fontSize: 13, marginBottom: 8, fontWeight: 500 }}>{t('modal.form.totalEstimated')}</div>
                    <div style={{ color: '#fa8c16', fontSize: 32, fontWeight: 900, letterSpacing: -1 }}>
                        {grandTotal.toLocaleString('vi-VN')}
                    </div>
                    <Tag color="orange" style={{ marginTop: 8, borderRadius: 4, fontWeight: 600 }}>VND</Tag>
                </div>

                <div style={{ marginTop: 20, background: 'rgba(255,255,255,0.6)', padding: '16px', borderRadius: 10, border: '1px solid #d6e4ff' }}>
                    <Space orientation="vertical" style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text type="secondary">{t('modal.form.itemCount')}</Text>
                            <Text strong>{watchedItems?.length || 0}</Text>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text type="secondary">{t('modal.form.requestor')}</Text>
                            <Text strong>{session?.user?.name}</Text>
                        </div>
                    </Space>
                </div>
            </Card>
          </Col>
        </Row>

        <Divider plain style={{ margin: '32px 0 16px' }}>
          <Space><AppstoreOutlined style={{ color: '#fa8c16' }} /> <Text strong>{t('modal.itemsDivider')}</Text></Space>
        </Divider>

        <Form.List name="items">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }, index) => (
                <Card 
                  key={key} 
                  size="small" 
                  variant="borderless"
                  style={{ 
                    marginBottom: 12, 
                    border: '1px solid #f0f0f0', 
                    borderRadius: 12,
                    background: '#fff'
                  }}
                  styles={{ body: { padding: '16px' } }}
                >
                  <Row gutter={16} align="middle">
                    <Col span={1} style={{ textAlign: 'center' }}>
                        <Text type="secondary" style={{ fontWeight: 700 }}>#{index + 1}</Text>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        {...restField}
                        label={index === 0 ? t('modal.form.product') : ""}
                        name={[name, 'productId']}
                        rules={[{ required: true, message: t('modal.form.required') }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Select
                          showSearch
                          placeholder={t('modal.form.productPlaceholder')}
                          optionFilterProp="label"
                          onChange={(val) => handleProductChange(val, index)}
                          options={products.map(p => ({ 
                            label: `[${p.sku}] ${p.vietnameseName}`, 
                            value: p.id 
                          }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={3}>
                      <Form.Item
                        {...restField}
                        label={index === 0 ? t('modal.form.quantity') : ""}
                        name={[name, 'quantity']}
                        rules={[{ required: true }]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber min={0.01} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={3}>
                      <Form.Item
                        {...restField}
                        label={index === 0 ? t('modal.form.unit') : ""}
                        name={[name, 'unit']}
                        rules={[{ required: true }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder={t('modal.form.unitPlaceholder')} />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item
                        {...restField}
                        label={index === 0 ? t('modal.form.estimatedPrice') : ""}
                        name={[name, 'estimatedPrice']}
                        rules={[{ required: true }]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber
                          style={{ width: '100%' }}
                          formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={v => v ? Number(v.replace(/\$\s?|(,*)/g, '')) : 0}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      {index === 0 && <div style={{ height: 30 }} />}
                      <div style={{ textAlign: 'right' }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>{t('modal.form.lineSubtotal')}</Text><br/>
                        <Text strong style={{ color: '#fa8c16' }}>
                          {((watchedItems?.[index]?.quantity || 0) * 
                            (watchedItems?.[index]?.estimatedPrice || 0)
                          ).toLocaleString('vi-VN')}
                        </Text>
                      </div>
                    </Col>
                    <Col span={1}>
                      {index === 0 && <div style={{ height: 30 }} />}
                      <Button type="text" danger onClick={() => remove(name)} icon={<DeleteOutlined />} disabled={mode === 'view'} />
                    </Col>
                  </Row>
                </Card>
              ))}
              {mode !== 'view' && (
                <Button 
                    type="dashed" 
                    onClick={() => add({ quantity: 1, unit: 'PCS', estimatedPrice: 0 })} 
                    block 
                    icon={<PlusOutlined />} 
                    style={{ height: 45, borderRadius: 10, borderStyle: 'dashed', borderWidth: 2, color: '#fa8c16', borderColor: '#ffbb96' }}
                >
                    {t('modal.form.addLineBtn')}
                </Button>
              )}
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
};

export default PurchaseRequestModal;
