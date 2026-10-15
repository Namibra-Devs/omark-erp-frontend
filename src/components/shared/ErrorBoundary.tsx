// src/components/shared/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button, Card, Typography, Result } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    // Protect offline/unreconciled business data (e.g. omark_* keys)
    // Clear only authentication credentials and temporary session data
    localStorage.removeItem('omark_access_token');
    localStorage.removeItem('omark_refresh_token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('omark_auth_user');
    try {
      sessionStorage.clear();
    } catch (_) {}
    window.location.href = '/login';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: 20, background: '#f5f7fa' }}>
          <Card style={{ maxWidth: 500, width: '100%', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <Result
              status="warning"
              title="Something went wrong"
              subTitle="An unexpected application error occurred."
              extra={[
                <Button type="primary" icon={<ReloadOutlined />} onClick={this.handleReload} key="reload" style={{ borderRadius: 8 }}>
                  Reload Page
                </Button>,
                <Button onClick={this.handleReset} key="reset" danger style={{ borderRadius: 8 }}>
                  Reset App Session
                </Button>,
              ]}
            >
              {this.state.error && (
                <div style={{ textAlign: 'left', background: '#fafafa', padding: 12, borderRadius: 8, marginTop: 12, border: '1px solid #f0f0f0' }}>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Technical Details:</Text>
                  <Paragraph code style={{ fontSize: 12, margin: 0, whiteSpace: 'pre-wrap' }}>
                    {this.state.error.message}
                  </Paragraph>
                </div>
              )}
            </Result>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
