"use client";

import React from "react";
import { Layout, App } from "antd";

const { Content } = Layout;

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <App>
      <Layout style={{ minHeight: '100vh', background: '#fff' }}>
        <Content>
          {children}
        </Content>
      </Layout>
    </App>
  );
}
