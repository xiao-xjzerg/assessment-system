/**
 * 登录页 —— Neumorphism 软萌风格。
 *
 * 登录成功后：
 *   1) 写入 userStore（同步 localStorage）
 *   2) 预拉取当前活跃周期（失败不阻断）
 *   3) 跳转到 redirect 参数指定的页面；若无，跳到 /dashboard
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { Form, Input, Button, Typography, App as AntdApp } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { authApi } from '@/services/api/auth';
import { useUserStore } from '@/stores/userStore';
import { useCycleStore } from '@/stores/cycleStore';
import { useTheme } from '@/theme/useTheme';
import type { LoginRequest } from '@/types';

const { Title, Text } = Typography;

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';
  const { message } = AntdApp.useApp();
  const { resolvedMode } = useTheme();

  const token = useUserStore((s) => s.token);
  const setSession = useUserStore((s) => s.setSession);
  const fetchActiveCycle = useCycleStore((s) => s.fetchActive);

  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm<LoginRequest>();

  useEffect(() => {
    // 只在挂载时判断一次，避免 setSession 后的循环
  }, []);

  if (token) {
    return <Navigate to={redirect} replace />;
  }

  const onSubmit = async (values: LoginRequest) => {
    setLoading(true);
    try {
      const resp = await authApi.login({
        phone: values.phone.trim(),
        password: values.password,
      });
      setSession(resp);
      message.success(`欢迎回来，${resp.name}`);
      fetchActiveCycle().catch(() => undefined);
      navigate(redirect, { replace: true });
    } catch {
      // 错误消息已由 axios 拦截器展示
    } finally {
      setLoading(false);
    }
  };

  const isDark = resolvedMode === 'dark';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDark
          ? 'linear-gradient(135deg, #1e2028 0%, #2a2d35 50%, #23262d 100%)'
          : 'linear-gradient(135deg, #d5dae3 0%, #e4e9f0 50%, #edf1f7 100%)',
        padding: 24,
        transition: 'background 0.4s ease',
      }}
    >
      <div
        style={{
          width: 420,
          background: 'var(--neu-bg)',
          borderRadius: 'var(--neu-radius-xl)',
          boxShadow: 'var(--neu-shadow-out-3)',
          padding: '48px 40px 36px',
          transition: 'box-shadow 0.3s ease, background 0.3s ease',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          {/* 圆形 logo 占位 */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'var(--neu-bg)',
              boxShadow: 'var(--neu-shadow-out-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: 28,
              color: 'var(--neu-accent)',
            }}
          >
            <UserOutlined />
          </div>
          <Title level={3} style={{ marginBottom: 4, color: 'var(--neu-text-primary)' }}>
            员工季度考核管理系统
          </Title>
          <Text style={{ color: 'var(--neu-text-secondary)' }}>
            请使用您的手机号和密码登录
          </Text>
        </div>

        <Form<LoginRequest>
          form={form}
          layout="vertical"
          size="large"
          onFinish={onSubmit}
          autoComplete="off"
          requiredMark={false}
        >
          <Form.Item
            label={<span style={{ color: 'var(--neu-text-secondary)' }}>手机号</span>}
            name="phone"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1\d{10}$/, message: '手机号格式不正确' },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: 'var(--neu-text-tertiary)' }} />}
              placeholder="11 位手机号"
              maxLength={11}
              allowClear
              style={{
                background: 'var(--neu-bg-sunken)',
                boxShadow: 'var(--neu-shadow-in-1)',
                border: 'none',
                borderRadius: 'var(--neu-radius-sm)',
              }}
            />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: 'var(--neu-text-secondary)' }}>密码</span>}
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--neu-text-tertiary)' }} />}
              placeholder="登录密码"
              style={{
                background: 'var(--neu-bg-sunken)',
                boxShadow: 'var(--neu-shadow-in-1)',
                border: 'none',
                borderRadius: 'var(--neu-radius-sm)',
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 12, marginTop: 12 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              style={{
                height: 44,
                borderRadius: 'var(--neu-radius-sm)',
                boxShadow: 'var(--neu-shadow-out-1)',
                fontWeight: 600,
                fontSize: 15,
                border: 'none',
              }}
            >
              登录
            </Button>
          </Form.Item>

          <Text style={{ fontSize: 12, color: 'var(--neu-text-tertiary)' }}>
            初次登录或忘记密码请联系管理员重置。
          </Text>
        </Form>
      </div>
    </div>
  );
}
