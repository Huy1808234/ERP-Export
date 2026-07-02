'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  notification,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  DeleteOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';

import {
  useCustomerPortalCurrencies,
  useCustomerPortalPorts,
  useCustomerPortalProducts,
  useCustomerPortalProfile,
} from '@/hooks/useCustomerPortal';
import { PageState, PortalShell } from '@/components/admin/portal/_shared/PortalShell';
import { formatMoney } from '@/components/admin/portal/_shared/helpers';
import {
  incotermOptions,
  type InquiryCartItem,
  type InquiryFormValues,
} from '@/components/admin/portal/_shared/constants';
import { formatPortLabel } from '@/services/port.service';
import type { PortalProductPricing } from '@/types/customer-portal';

const { Text, Title } = Typography;

export const ProductsPage = () => {
  const locale = useLocale();
  const t = useTranslations('CustomerPortal');
  const [form] = Form.useForm<InquiryFormValues>();
  const [api, contextHolder] = notification.useNotification();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [incoterm, setIncoterm] = useState('FOB');
  const [isRfqOpen, setIsRfqOpen] = useState(false);
  const [cartItems, setCartItems] = useState<InquiryCartItem[]>([]);
  const { profile, fetchProfile } = useCustomerPortalProfile();
  const { currencies, loading: currenciesLoading, fetchCurrencies } = useCustomerPortalCurrencies();
  const { ports, loading: portsLoading, fetchPorts } = useCustomerPortalPorts();
  const {
    catalog,
    loading,
    submitting,
    error,
    fetchProducts,
    submitInquiry,
  } = useCustomerPortalProducts();

  const fetchCatalog = useCallback(() => fetchProducts({
    search: search.trim(),
    category: categoryFilter || undefined,
    quantity: 1,
    currency,
    incoterm,
  }), [categoryFilter, currency, fetchProducts, incoterm, search]);

  useEffect(() => {
    void fetchProducts({
      search: '',
      category: undefined,
      quantity: 1,
      currency: 'USD',
      incoterm: 'FOB',
    });
  }, [fetchProducts]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    void fetchCurrencies();
  }, [fetchCurrencies]);

  useEffect(() => {
    void fetchPorts();
  }, [fetchPorts]);

  useEffect(() => {
    if (!isRfqOpen) return;
    form.setFieldsValue({
      incoterm,
      customerPhone: profile?.contact.phone || '',
      contactEmail: profile?.contact.email || '',
    });
  }, [form, incoterm, profile, isRfqOpen]);

  useEffect(() => {
    const defaultCurrency = profile?.finance.defaultCurrency || profile?.partner.defaultCurrency;
    if (defaultCurrency && currency === 'USD') {
      setCurrency(defaultCurrency);
    }
  }, [currency, profile]);

  const products = catalog?.results || [];
  const categoryOptions = useMemo(() => (
    (catalog?.categories || []).map((item) => ({
      value: item,
      label: item,
    }))
  ), [catalog?.categories]);
  const destinationPortOptions = useMemo(() => (
    ports.map((port) => {
      const label = `${formatPortLabel(port)} (${port.countryCode})`;
      return {
        value: label,
        label,
      };
    })
  ), [ports]);
  const currencyOptions = useMemo(() => (
    currencies.map((item) => ({
      value: item.code,
      label: `${item.code} - ${item.name}${item.symbol ? ` (${item.symbol})` : ''}`,
    }))
  ), [currencies]);
  const cartTotalQuantity = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  );

  const clearProductFilters = () => {
    setSearch('');
    setCategoryFilter('');
    void fetchProducts({
      search: '',
      category: undefined,
      quantity: 1,
      currency,
      incoterm,
    });
  };

  const addToCart = (item: PortalProductPricing) => {
    const nextQuantity = Number(item.quantity || 1);
    setCartItems((currentItems) => {
      const existingItem = currentItems.find((cartItem) => cartItem.product._id === item.product._id);
      if (existingItem) {
        return currentItems.map((cartItem) => (
          cartItem.product._id === item.product._id
            ? { ...cartItem, quantity: cartItem.quantity + nextQuantity }
            : cartItem
        ));
      }

      return [
        ...currentItems,
        {
          product: item.product,
          quantity: nextQuantity,
          targetPrice: typeof item.unitPrice === 'number' ? item.unitPrice : null,
          unitPrice: item.unitPrice,
          currency: item.currency,
          incoterm: item.incoterm,
        },
      ];
    });
  };

  const updateCartQuantity = (product_id: string, value: number | null) => {
    setCartItems((currentItems) => currentItems.map((item) => (
      item.product._id === product_id ? { ...item, quantity: Number(value || 1) } : item
    )));
  };

  const updateCartTargetPrice = (product_id: string, value: number | null) => {
    setCartItems((currentItems) => currentItems.map((item) => (
      item.product._id === product_id ? { ...item, targetPrice: value } : item
    )));
  };

  const removeCartItem = (product_id: string) => {
    setCartItems((currentItems) => currentItems.filter((item) => item.product._id !== product_id));
  };

  const handleSubmitInquiry = async () => {
    if (!cartItems.length) return;
    const values = await form.validateFields();

    const result = await submitInquiry({
      lineItems: cartItems.map((item) => ({
        product_id: item.product._id,
        quantity: item.quantity,
        targetPrice: item.targetPrice,
        note: null,
      })),
      incoterm: values.incoterm,
      destinationPort: values.destinationPort || null,
      expectedShipmentDate: values.expectedShipmentDate?.toISOString() || null,
      targetPriceCurrency: currency,
      customerPhone: values.customerPhone || null,
      contactEmail: values.contactEmail || null,
      note: values.note || null,
    });

    if (!result.success) {
      api.error({
        title: t('inquiryFailed'),
        description: result.message,
      });
      return;
    }

    api.success({
      title: t('inquirySubmitted'),
      description: result.inquiry?.inquiryNumber
        ? `${t('inquirySubmittedDesc')} (${result.inquiry.inquiryNumber})`
        : t('inquirySubmittedDesc'),
    });
    setCartItems([]);
    setIsRfqOpen(false);
    form.resetFields();
  };

  return (
    <PortalShell title={t('productsTitle')} subtitle={t('productsSubtitle')} icon={<ShoppingCartOutlined />} fullWidth>
      {contextHolder}
      <Row gutter={[24, 24]}>
        {/* Left Column: Products & Filters */}
        <Col xs={24} lg={16} xl={17} xxl={18}>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Card variant="borderless" styles={{ body: { padding: 16 } }}>
              <Row gutter={[16, 16]} align="bottom">
                <Col xs={24} md={8} xl={6}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>
                    {t('searchLabel')}
                  </Text>
                  <Input.Search
                    allowClear
                    size="large"
                    value={search}
                    placeholder={t('productSearch')}
                    onChange={(event) => setSearch(event.target.value)}
                    onSearch={() => void fetchCatalog()}
                  />
                </Col>
                <Col xs={12} md={8} xl={5}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>
                    {t('category')}
                  </Text>
                  <Select
                    allowClear
                    showSearch
                    size="large"
                    value={categoryFilter || undefined}
                    placeholder={t('allCategories')}
                    style={{ width: '100%' }}
                    popupMatchSelectWidth={280}
                    optionFilterProp="label"
                    options={categoryOptions}
                    onChange={(value) => setCategoryFilter(value || '')}
                  />
                </Col>
                <Col xs={12} md={8} xl={4}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>
                    {t('currency')}
                  </Text>
                  <Select
                    showSearch
                    loading={currenciesLoading}
                    size="large"
                    value={currency}
                    style={{ width: '100%' }}
                    popupMatchSelectWidth={320}
                    optionFilterProp="label"
                    options={currencyOptions}
                    onChange={setCurrency}
                  />
                </Col>
                <Col xs={24} md={12} xl={5}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>
                    {t('incoterm')}
                  </Text>
                  <Select
                    showSearch
                    size="large"
                    value={incoterm}
                    style={{ width: '100%' }}
                    popupMatchSelectWidth={360}
                    optionFilterProp="label"
                    options={incotermOptions}
                    onChange={setIncoterm}
                  />
                </Col>
                <Col xs={24} md={12} xl={4}>
                  <Space.Compact block>
                    <Button block size="large" type="primary" loading={loading} onClick={() => void fetchCatalog()}>
                      {t('applyFilters')}
                    </Button>
                    <Button size="large" onClick={clearProductFilters}>
                      {t('clearFilters')}
                    </Button>
                  </Space.Compact>
                </Col>
              </Row>
            </Card>

            <PageState loading={loading} error={error} empty={products.length === 0} onRetry={() => void fetchCatalog()}>
              <Row gutter={[16, 16]}>
                {products.map((item) => {
                  const product = item.product;
                  const productName = product.englishName || product.vietnameseName;
                  const priceText = item.unitPrice === null
                    ? t('contactSales')
                    : formatMoney(item.unitPrice, item.currency, locale);
                  const stockText = Number(product.currentStock || 0).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US');

                  return (
                    <Col xs={24} md={12} xl={8} xxl={8} key={product._id}>
                      <Card
                        variant="borderless"
                        cover={product.imageUrl ? (
                          <Image
                            preview={false}
                            src={product.imageUrl}
                            alt={productName}
                            height={180}
                            width="100%"
                            style={{ objectFit: 'cover' }}
                          />
                        ) : undefined}
                        actions={[
                          <Button
                            key="request"
                            type="primary"
                            icon={<ShoppingCartOutlined />}
                            onClick={() => addToCart(item)}
                          >
                            {t('addToInquiry')}
                          </Button>,
                        ]}
                      >
                        <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                          <Space wrap>
                            <Tag color="blue">{product.sku}</Tag>
                            {product.isNew ? <Tag color="green">New</Tag> : null}
                            {product.isBestseller ? <Tag color="gold">Best seller</Tag> : null}
                          </Space>
                          <Title level={5} style={{ margin: 0 }}>{productName}</Title>
                          <Text type="secondary">{product.description || product.vietnameseName}</Text>
                          <Row gutter={[8, 8]}>
                            <Col span={12}>
                              <Text type="secondary">{t('price')}</Text>
                              <div><Text strong>{priceText}</Text></div>
                            </Col>
                            <Col span={12}>
                              <Text type="secondary">{t('stock')}</Text>
                              <div><Text strong>{stockText} {product.unitOfMeasure || ''}</Text></div>
                            </Col>
                            <Col span={12}>
                              <Text type="secondary">HS</Text>
                              <div>{product.hsCode || '-'}</div>
                            </Col>
                            <Col span={12}>
                              <Text type="secondary">{t('origin')}</Text>
                              <div>{product.originCountry || '-'}</div>
                            </Col>
                          </Row>
                          <Space wrap>
                            {product.category ? <Tag>{t('category')}: {product.category}</Tag> : null}
                            {product.packingType ? <Tag>{t('packing')}: {product.packingType}</Tag> : null}
                          </Space>
                        </Space>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </PageState>
          </Space>
        </Col>

        {/* Right Column: RFQ Cart Sidebar */}
        <Col xs={24} lg={8} xl={7} xxl={6}>
          <div style={{ position: 'sticky', top: 16 }}>
            <Card
              variant="borderless"
              title={t('inquiryCart')}
              extra={<Tag color="blue">{cartItems.length} SKU</Tag>}
              actions={[
                <div key="build-rfq" style={{ padding: '0 16px' }}>
                  <Button
                    type="primary"
                    size="large"
                    block
                    disabled={!cartItems.length}
                    icon={<ShoppingCartOutlined />}
                    onClick={() => setIsRfqOpen(true)}
                  >
                    {t('buildRfq')} ({cartTotalQuantity.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')})
                  </Button>
                </div>
              ]}
              styles={{ body: { padding: '12px 16px', maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' } }}
            >
              {cartItems.length ? (
                <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                  {cartItems.map((item) => (
                    <div key={item.product._id} style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 12 }}>
                      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                        <Col span={20}>
                          <Text strong>{item.product.englishName || item.product.vietnameseName}</Text>
                          <div><Text type="secondary" style={{ fontSize: 12 }}>{item.product.sku}</Text></div>
                        </Col>
                        <Col span={4} style={{ textAlign: 'right' }}>
                          <Button
                            danger
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => removeCartItem(item.product._id)}
                          />
                        </Col>
                      </Row>
                      <Row gutter={8}>
                        <Col span={10}>
                          <Text type="secondary" style={{ fontSize: 12 }}>{t('productQuantity')}</Text>
                          <Space.Compact style={{ width: '100%' }}>
                            <InputNumber
                              min={1}
                              size="small"
                              value={item.quantity}
                              style={{ width: '100%' }}
                              onChange={(value) => updateCartQuantity(item.product._id, value)}
                            />
                            {item.product.unitOfMeasure ? (
                              <Input
                                readOnly
                                tabIndex={-1}
                                value={item.product.unitOfMeasure}
                                size="small"
                                style={{ width: 48, padding: '0 4px', textAlign: 'center', pointerEvents: 'none' }}
                              />
                            ) : null}
                          </Space.Compact>
                        </Col>
                        <Col span={14}>
                          <Text type="secondary" style={{ fontSize: 12 }}>{t('targetPrice')}</Text>
                          <Space.Compact style={{ width: '100%' }}>
                            <InputNumber
                              min={0}
                              size="small"
                              value={item.targetPrice}
                              style={{ width: '100%' }}
                              onChange={(value) => updateCartTargetPrice(item.product._id, value)}
                            />
                            <Input
                              readOnly
                              tabIndex={-1}
                              value={item.currency}
                              size="small"
                              style={{ width: 48, padding: '0 4px', textAlign: 'center', pointerEvents: 'none' }}
                            />
                          </Space.Compact>
                        </Col>
                      </Row>
                    </div>
                  ))}
                </Space>
              ) : (
                <Empty description={t('inquiryCartEmpty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </div>
        </Col>
      </Row>

      <Modal
        open={isRfqOpen}
        title={t('buildRfq')}
        okText={t('requestQuote')}
        cancelText={t('cancel')}
        confirmLoading={submitting}
        okButtonProps={{ disabled: !cartItems.length }}
        onCancel={() => setIsRfqOpen(false)}
        onOk={() => void handleSubmitInquiry()}
        width={760}
      >
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="customerPhone" label={t('inquiryPhone')}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="contactEmail" label={t('inquiryEmail')}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="incoterm"
                label={t('incoterm')}
                rules={[{ required: true, message: t('incoterm') }]}
              >
                <Select
                  showSearch
                  popupMatchSelectWidth={360}
                  optionFilterProp="label"
                  options={incotermOptions}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="destinationPort" label={t('destinationPort')}>
                <Select
                  allowClear
                  showSearch
                  loading={portsLoading}
                  placeholder={t('destinationPortPlaceholder')}
                  optionFilterProp="label"
                  options={destinationPortOptions}
                  popupMatchSelectWidth={360}
                  onSearch={(value) => {
                    if (value.trim().length >= 2 || value.trim().length === 0) {
                      void fetchPorts(value.trim() || undefined);
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="expectedShipmentDate" label={t('expectedShipmentDate')}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Card size="small" title={t('lineItems')} style={{ marginBottom: 16 }}>
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              {cartItems.map((item) => (
                <Row key={item.product._id} gutter={8} align="middle">
                  <Col span={12}>
                    <Text strong>{item.product.sku}</Text>
                    <div><Text type="secondary">{item.product.englishName || item.product.vietnameseName}</Text></div>
                  </Col>
                  <Col span={5}>
                    <Text>{item.quantity.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} {item.product.unitOfMeasure || ''}</Text>
                  </Col>
                  <Col span={7}>
                    <Text type="secondary">{t('targetPrice')}: </Text>
                    <Text>{item.targetPrice === null ? '-' : formatMoney(item.targetPrice, item.currency, locale)}</Text>
                  </Col>
                </Row>
              ))}
            </Space>
          </Card>
          <Form.Item name="note" label={t('inquiryNote')}>
            <Input.TextArea rows={4} placeholder={t('inquiryNotePlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </PortalShell>
  );
};