// src/components/layout/AppShell.tsx
import React, { useState } from 'react';
import { Layout, theme } from 'antd';
import { Outlet } from 'react-router-dom';
import { NavMenu } from './NavMenu';
import { TopHeader } from './TopHeader';

const { Sider, Content } = Layout;

export const AppShell: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Fixed Sider */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          overflow: 'auto',
          height: '100vh',
          boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
        }}
        width={256}
        theme="dark"
      >
        {/* Logo Area */}
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          {!collapsed ? (
            // Expanded view - Logo with text
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 12,
              width: '100%',
            }}>
              <img 
                src="/images/logo1.png" 
                alt="Omark Real Estate" 
                style={{ 
                  height: 40, 
                  width: 'auto',
                  objectFit: 'contain',
                }} 
              />
              <span style={{ 
                color: 'white', 
                fontWeight: 'bold', 
                fontSize: 18,
                whiteSpace: 'nowrap',
              }}>
                OMARK
              </span>
            </div>
          ) : (
            // Collapsed view - Logo only
            <img 
              src="/images/logo1.png" 
              alt="Omark Real Estate" 
              style={{ 
                height: 40, 
                width: 'auto',
                objectFit: 'contain',
              }} 
            />
          )}
        </div>
        <NavMenu />
      </Sider>

      {/* Main Layout with fixed header */}
      <Layout style={{ marginLeft: collapsed ? 80 : 256, transition: 'margin-left 0.2s' }}>
        {/* Fixed Header */}
        <div style={{ 
          position: 'sticky',
          top: 0,
          zIndex: 99,
          width: '100%',
        }}>
          <TopHeader />
        </div>

        {/* Scrollable Content */}
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: 8,
            overflow: 'initial',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};