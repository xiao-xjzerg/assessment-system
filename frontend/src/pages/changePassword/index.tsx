/**
 * 修改密码页。
 *
 * 场景：已登录用户自助修改；需验证旧密码（后端校验）。
 * 修改成功后清登录态，强制重新登录。
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, App as AntdApp, Space } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { authApi } from '@/services/api/auth';
import { useUserStore } from '@/stores/userStore';

const { Title, Text } = Typography;

interface FormValues {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const clearSession = useUserStore((s) => s.clear);
  const userName = useUserStore((s) => s.user?.name);

  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      await authApi.changePassword({
        old_password: values.old_password,
        new_password: values.new_password,
      });
      message.success('密码修改成功，请重新登录');
      clearSession();
      navigate('/login', { replace: true });
    } catch {
      // 错误已由拦截器展示
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={{
      maxWidth: 560,
      margin: '24px auto',
      borderRadius: 'var(--neu-radius-md)',
      boxShadow: 'var(--neu-shadow-out-2)',
      border: 'none',
    }}>
      <Space direction="vertical" size={4} style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          修改密码
        </Title>
        <Text type="secondary">
          当前账号：{userName || '未知用户'}。修改成功后需使用新密码重新登录。
        </Text>
      </Space>

      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        autoComplete="off"
        requiredMark
      >
        <Form.Item
          label="原密码"
          name="old_password"
          rules={[{ required: true, message: '请输入原密码' }]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="请输入原密码" />
        </Form.Item>

        <Form.Item
          label="新密码"
          name="new_password"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 6, message: '新密码长度至少 6 位' },
            { max: 32, message: '新密码长度不超过 32 位' },
          ]}
          hasFeedback
        >
          <Input.Password prefix={<LockOutlined />} placeholder="6-32 位新密码" />
        </Form.Item>

        <Form.Item
          label="确认新密码"
          name="confirm_password"
          dependencies={['new_password']}
          hasFeedback
          rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator(_rule, value) {
                if (!value || getFieldValue('new_password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="再次输入新密码" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              提交
            </Button>
            <Button htmlType="button" onClick={() => form.resetFields()}>
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}
