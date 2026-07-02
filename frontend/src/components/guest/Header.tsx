"use client";

import React from "react";
import { Menu, Button, Row, Col, Typography, Dropdown, Avatar, type MenuProps } from "antd";
import {
  GlobalOutlined,
  ArrowRightOutlined,
  LoginOutlined,
  DashboardOutlined,
  LogoutOutlined
} from "@ant-design/icons";
import { Link, useRouter } from "@/i18n/routing";
import { motion, useScroll, useTransform } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import type { Session } from "next-auth";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { isStaff } from "@/utils/auth-utils";
import { CUSTOMER_PORTAL_ENTRY_PATH } from "@/utils/auth-redirect";

const { Text, Title } = Typography;

export const Header = ({ session: serverSession }: { session: Session | null }) => {
  const t = useTranslations('GuestHeader');
  const { data: clientSession } = useSession();
  const session = clientSession || serverSession;
  const router = useRouter();
  const { scrollY } = useScroll();
  const params = useParams();
  const locale = params?.locale ?? 'vi';

  const height = useTransform(scrollY, [0, 100], [90, 70]);

  const backgroundColor = useTransform(
    scrollY,
    [0, 100],
    ["rgba(0, 8, 20, 0)", "rgba(0, 8, 20, 0.95)"]
  );

  const backdropFilter = useTransform(
    scrollY,
    [0, 100],
    ["blur(0px)", "blur(20px)"]
  );

  const headerShadow = useTransform(
    scrollY,
    [0, 100],
    ["none", "0 10px 40px rgba(0,0,0,0.3)"]
  );

  const isStaffUser = isStaff(session?.user);
  const guestLoginHref = `/auth/login?callbackUrl=${encodeURIComponent('/')}`;

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'user-info',
      label: (
        <div style={{ padding: '12px' }}>
          <Text strong style={{ display: 'block', fontSize: '14px' }}>{session?.user?.name}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>{session?.user?.email}</Text>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' as const },
    {
      key: 'system-dashboard',
      icon: <DashboardOutlined />,
      label: <Text strong style={{ color: '#1890ff' }}>{isStaffUser ? t('adminDashboard') : t('customerPortal')}</Text>,
      onClick: () => router.push(isStaffUser ? '/dashboard' : CUSTOMER_PORTAL_ENTRY_PATH),
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: <Text type="danger" strong>{t('logout')}</Text>,
      onClick: () => { signOut({ callbackUrl: `/${locale}` }); },
    },
  ];

  return (
    <motion.div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        height,
        backgroundColor,
        backdropFilter,
        boxShadow: headerShadow,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 60px',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}
    >
      <div style={{ maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
        <Row align="middle" justify="space-between" gutter={24}>
          <Col>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <motion.div
                whileHover={{ rotate: 90, scale: 1.1 }}
                style={{
                  width: '38px',
                  height: '38px',
                  background: 'linear-gradient(135deg, #1890ff, #003eb3)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 16px rgba(24, 144, 255, 0.3)'
                }}
              >
                <GlobalOutlined style={{ fontSize: '22px', color: '#fff' }} />
              </motion.div>
              <Title level={4} style={{
                color: '#fff',
                margin: 0,
                fontWeight: 900,
                letterSpacing: '-1.5px',
                fontSize: '22px'
              }}>
                VINAEXPORT
              </Title>
            </Link>
          </Col>

          <Col flex="auto" className="hidden lg:block" style={{ paddingLeft: '60px' }}>
            <Menu
              theme="dark"
              mode="horizontal"
              selectable={false}
              style={{
                background: 'transparent',
                borderBottom: 'none',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
              }}
              items={[
                { key: 'services', label: t('navServices'), onClick: () => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' }) },
                { key: 'products', label: t('navProducts'), onClick: () => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }) },
                { key: 'about', label: t('navAbout'), onClick: () => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' }) },
                { key: 'tracking', label: t('navTracking'), onClick: () => document.getElementById('tracking')?.scrollIntoView({ behavior: 'smooth' }) },
              ]}
              className="custom-nav-menu"
            />
          </Col>

          <Col>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              {session ? (
                <Dropdown
                  menu={{ items: userMenuItems }}
                  placement="bottomRight"
                  trigger={['click']}
                  styles={{ root: { width: '280px', paddingTop: '10px' } }}
                >
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '5px 16px 5px 5px',
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '40px',
                      cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.15)',
                      transition: 'all 0.3s'
                    }}
                  >
                    <Avatar
                      style={{
                        backgroundColor: isStaffUser ? '#f59e0b' : '#1890ff',
                        fontWeight: 800,
                        fontSize: '12px',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                      }}
                      size={32}
                    >
                      {session.user?.name?.charAt(0)?.toUpperCase()}
                    </Avatar>
                    <Text strong style={{ color: '#fff', fontSize: '13px' }}>
                      {session.user?.name?.split(' ')[0]}
                    </Text>
                  </motion.div>
                </Dropdown>
              ) : (
                <Link href={guestLoginHref}>
                  <Button
                    type="text"
                    icon={<LoginOutlined />}
                    style={{
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '12px',
                      letterSpacing: '1px'
                    }}
                  >
                    {t('login')}
                  </Button>
                </Link>
              )}

              <Button type="primary" size="large" style={{
                height: '46px',
                padding: '0 28px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '13px',
                letterSpacing: '0.5px',
                background: 'linear-gradient(135deg, #1890ff 0%, #0050b3 100%)',
                border: 'none',
                boxShadow: '0 10px 20px rgba(24, 144, 255, 0.3)'
              }}>
                {t('contact')} <ArrowRightOutlined style={{ marginLeft: '8px' }} />
              </Button>
            </div>
          </Col>
        </Row>
      </div>

      <style jsx global>{`
        .custom-nav-menu .ant-menu-item {
          transition: all 0.3s !important;
        }
        .custom-nav-menu .ant-menu-item:hover {
          color: #1890ff !important;
          transform: translateY(-2px);
        }
        .ant-dropdown-menu {
          padding: 8px !important;
          border-radius: 16px !important;
          box-shadow: 0 20px 40px rgba(0,0,0,0.15) !important;
          border: 1px solid #f1f5f9 !important;
        }
        .ant-dropdown-menu-item {
          border-radius: 8px !important;
          padding: 8px 12px !important;
        }
      `}</style>
    </motion.div>
  );
};

export default Header;
