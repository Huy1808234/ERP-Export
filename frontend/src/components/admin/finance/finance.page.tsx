'use client';

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Statistic, Empty } from 'antd';
import { DollarOutlined, BankOutlined, LineChartOutlined, PieChartOutlined, LoadingOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { SafeResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend, Cell
} from 'recharts';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';
import { canReadCostFields } from '@/lib/field-access';

const { Title, Text } = Typography;

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const FinanceDashboardPage = () => {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const accessToken = getAccessToken(session);
  const canViewCost = canReadCostFields(session?.user);

  useEffect(() => {
    const fetchData = async () => {
      if (!accessToken) return;
      setLoading(true);
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/dashboards`,
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data) {
        setData(res.data);
      }
      setLoading(false);
    };

    fetchData();
  }, [accessToken]);

  const finance = data?.finance || {};
  const history = finance.history || [];
  const exchangeRate = finance.exchangeRate || 25450;

  const allocationData = canViewCost ? (finance.logisticsCostBreakdown || []) : [];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300 } }
  };

  if (loading) return (
    <div className="p-8 min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingOutlined style={{ fontSize: 48, color: '#3b82f6' }} spin />
    </div>
  );

  return (
    <motion.div
      className="p-8 min-h-screen bg-slate-950"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants} className="mb-8 flex justify-between items-center">
        <div>
          <PageHeader
            title="Executive Financial Dashboard"
            icon={<LineChartOutlined />}
            description="Báo cáo Dòng tiền & Lợi nhuận gộp sau phân bổ chi phí"
          />
          <Text className="text-slate-400">Báo cáo Dòng tiền & Lợi nhuận gộp sau phân bổ chi phí</Text>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <Row gutter={[24, 24]} className="mb-8">
        <Col xs={24} sm={12} lg={6}>
          <motion.div variants={itemVariants}>
            <Card className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><DollarOutlined className="text-6xl text-emerald-500" /></div>
              <Statistic
                title={<Text className="text-slate-400 font-bold uppercase tracking-wider text-xs">Doanh Thu (USD)</Text>}
                value={(finance.totalRevenueVnd / exchangeRate)}
                precision={0}
                prefix="$"
                styles={{ content: { color: '#34d399', fontWeight: 900, fontSize: '32px' } }}
              />
              <div className="mt-4 flex items-center text-slate-400 text-sm">
                 ≈ {finance.totalRevenueVnd?.toLocaleString()} VND
              </div>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <motion.div variants={itemVariants}>
            <Card className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><LineChartOutlined className="text-6xl text-blue-500" /></div>
              <Statistic
                title={<Text className="text-slate-400 font-bold uppercase tracking-wider text-xs">Lợi Nhuận Gộp (Gross Profit)</Text>}
                value={canViewCost ? (finance.grossProfitVnd / exchangeRate) : 0}
                formatter={(value) => canViewCost ? Number(value || 0).toLocaleString() : 'Ẩn theo phân quyền'}
                precision={0}
                prefix={canViewCost ? '$' : undefined}
                styles={{ content: { color: '#60a5fa', fontWeight: 900, fontSize: '32px' } }}
              />
              <div className="mt-4 flex items-center text-blue-400 text-sm font-bold">
                 DSO: {finance.dso} ngày
              </div>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <motion.div variants={itemVariants}>
            <Card className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><PieChartOutlined className="text-6xl text-orange-500" /></div>
              <Statistic
                title={<Text className="text-slate-400 font-bold uppercase tracking-wider text-xs">Vòng Quay Tồn Kho</Text>}
                value={finance.inventoryTurnover}
                precision={1}
                suffix="x"
                styles={{ content: { color: '#fb923c', fontWeight: 900, fontSize: '32px' } }}
              />
              <div className="mt-4 flex items-center text-slate-400 text-sm font-bold">
                Tốc độ luân chuyển hàng
              </div>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <motion.div variants={itemVariants}>
            <Card className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><BankOutlined className="text-6xl text-rose-500" /></div>
              <Statistic
                title={<Text className="text-slate-400 font-bold uppercase tracking-wider text-xs">Công Nợ Phải Thu (AR)</Text>}
                value={(finance.totalArVnd / exchangeRate)}
                precision={0}
                prefix="$"
                styles={{ content: { color: '#fb7185', fontWeight: 900, fontSize: '32px' } }}
              />
              <div className="mt-4 flex items-center text-rose-400 text-sm font-bold">
                On-time: {finance.onTimeRate}%
              </div>
            </Card>
          </motion.div>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <motion.div variants={itemVariants} className="h-full">
            <Card
              className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-[32px] h-full"
              title={<Text className="text-white font-bold text-lg">Xu Hướng Doanh Thu & Lợi Nhuận</Text>}
              styles={{ header: { borderBottom: '1px solid rgba(30, 41, 59, 0.5)' } }}
            >
              <div className="h-80 w-full mt-4" style={{ minWidth: 0, minHeight: 320 }}>
                <SafeResponsiveContainer height={320}>
                  <AreaChart data={history} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" stroke="#64748b" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${(val / exchangeRate / 1000).toFixed(0)}k`} />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }}
                      itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                      formatter={(val: any) => [`$${(val / exchangeRate).toLocaleString()}`, '']}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" name="Doanh Thu (USD)" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                    {canViewCost && <Area type="monotone" dataKey="profit" name="Lợi Nhuận Est." stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProf)" />}
                  </AreaChart>
                </SafeResponsiveContainer>
              </div>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} lg={8}>
          <motion.div variants={itemVariants} className="h-full">
            <Card
              className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-[32px] h-full"
              title={<Text className="text-white font-bold text-lg">Cơ Cấu Chi Phí Logistics</Text>}
              styles={{ header: { borderBottom: '1px solid rgba(30, 41, 59, 0.5)' } }}
            >
              <div className="h-80 w-full mt-4 flex items-center justify-center" style={{ minWidth: 0, minHeight: 320 }}>
                {!canViewCost ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: '#94a3b8' }}>Chi phí logistics đang được ẩn theo phân quyền</span>} />
                ) : allocationData.length > 0 ? (
                  <SafeResponsiveContainer height={320}>
                    <BarChart data={allocationData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" stroke="#64748b" axisLine={false} tickLine={false} width={120} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff' }}
                        formatter={(val: any) => [`${Number(val).toLocaleString()} VND`, '']}
                      />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24}>
                        {allocationData.map((entry: any, index: number) => (
                          <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </SafeResponsiveContainer>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: '#94a3b8' }}>Chưa có chi phí logistics trong kỳ</span>} />
                )}
              </div>
            </Card>
          </motion.div>
        </Col>
      </Row>
    </motion.div>
  );
};

export default FinanceDashboardPage;
