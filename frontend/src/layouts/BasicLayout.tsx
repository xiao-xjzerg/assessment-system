/**
 * 基础布局：ProLayout 侧边菜单 + 顶栏（Neumorphism 软萌风格）。
 *
 * 职责：
 *   - 根据登录用户角色过滤路由树并生成菜单
 *   - 顶栏右侧展示当前活跃周期 + 阶段徽标 + 主题切换
 *   - 顶栏右侧用户下拉：修改密码 / 退出登录
 *   - 通过 <Outlet/> 渲染当前命中的子路由
 */
import { useEffect, useMemo } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ProLayout, type MenuDataItem } from '@ant-design/pro-components';
import { Dropdown, Space, Tag, Typography, App as AntdApp, Avatar } from 'antd';
import {
  LogoutOutlined,
  KeyOutlined,
  UserOutlined,
  DownOutlined,
  SunOutlined,
  MoonOutlined,
  DesktopOutlined,
} from '@ant-design/icons';
import { useUserStore } from '@/stores/userStore';
import { useCycleStore } from '@/stores/cycleStore';
import { appRoutes, filterRoutesByRole, joinPath, type AppRouteNode } from '@/router/routes';
import { useTheme } from '@/theme/useTheme';
import type { ThemeMode } from '@/theme/ThemeProvider';

const { Text } = Typography;

function toMenuData(nodes: AppRouteNode[], parent = ''): MenuDataItem[] {
  return nodes
    .filter((n) => !n.hideInMenu)
    .map((n) => {
      const full = joinPath(parent, n.path);
      const item: MenuDataItem = {
        path: full,
        name: n.title,
        icon: n.icon,
      };
      if (n.children && n.children.length > 0) {
        item.children = toMenuData(n.children, full);
      }
      return item;
    });
}

export default function BasicLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { message, modal } = AntdApp.useApp();

  const user = useUserStore((s) => s.user);
  const clearSession = useUserStore((s) => s.clear);
  const activeCycle = useCycleStore((s) => s.activeCycle);
  const phaseName = useCycleStore((s) => s.phaseName);
  const fetchActiveCycle = useCycleStore((s) => s.fetchActive);
  const { mode, setMode, resolvedMode } = useTheme();

  const themeIcon = mode === 'system' ? <DesktopOutlined /> : resolvedMode === 'dark' ? <MoonOutlined /> : <SunOutlined />;
  const modeLabel: Record<ThemeMode, string> = { system: '跟随系统', light: '浅色模式', dark: '深色模式' };
  const isDark = resolvedMode === 'dark';

  useEffect(() => {
    if (!activeCycle) {
      fetchActiveCycle().catch(() => undefined);
    }
  }, [activeCycle, fetchActiveCycle]);

  const menuData = useMemo<MenuDataItem[]>(() => {
    const filtered = filterRoutesByRole(
      appRoutes,
      user?.role,
      !!user?.is_pm,
      user?.assess_type,
    );
    return toMenuData(filtered);
  }, [user?.role, user?.is_pm, user?.assess_type]);

  const handleLogout = () => {
    modal.confirm({
      title: '确认退出登录？',
      content: '退出后需要重新登录才能继续使用系统。',
      okText: '退出',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        clearSession();
        message.success('已退出登录');
        navigate('/login', { replace: true });
      },
    });
  };

  return (
    <ProLayout
      title="员工季度考核系统"
      logo={false}
      layout="mix"
      fixSiderbar
      fixedHeader
      contentWidth="Fluid"
      location={{ pathname: location.pathname }}
      menuDataRender={() => menuData}
      menuItemRender={(item, dom) => {
        if (!item.path) return dom;
        return <Link to={item.path}>{dom}</Link>;
      }}
      siderMenuType="sub"
      token={{
        header: {
          colorBgHeader: 'var(--neu-bg)',
          colorTextMenu: 'var(--neu-text-primary)',
          colorTextMenuActive: 'var(--neu-accent)',
          colorTextMenuSelected: 'var(--neu-accent)',
          heightLayoutHeader: 56,
        },
        sider: {
          colorBgMenuItemSelected: isDark ? 'var(--neu-bg-sunken)' : 'var(--neu-bg-sunken)',
          colorTextMenuSelected: 'var(--neu-accent)',
          colorTextMenuActive: 'var(--neu-accent)',
          colorTextMenu: 'var(--neu-text-secondary)',
          colorBgCollapsedButton: 'var(--neu-bg)',
          colorTextCollapsedButton: 'var(--neu-text-secondary)',
          colorTextCollapsedButtonHover: 'var(--neu-accent)',
          colorMenuBackground: 'var(--neu-bg)',
          colorBgMenuItemHover: isDark ? 'var(--neu-bg-elevated)' : 'var(--neu-bg-elevated)',
        },
        pageContainer: {
          paddingBlockPageContainerContent: 24,
          paddingInlinePageContainerContent: 24,
        },
      }}
      headerTitleRender={(logo, title) => (
        <Link
          to="/dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--neu-text-primary)',
            fontWeight: 600,
          }}
        >
          {logo}
          {title}
        </Link>
      )}
      avatarProps={{
        icon: <UserOutlined />,
        size: 'small',
        style: {
          background: 'var(--neu-accent)',
          boxShadow: 'var(--neu-shadow-out-1)',
        },
        title: user?.name || '未登录',
        render: (_props, dom) => (
          <Dropdown
            menu={{
              items: [
                {
                  key: 'profile',
                  icon: <UserOutlined />,
                  label: '个人信息',
                  onClick: () => navigate('/profile/me'),
                },
                {
                  key: 'change-password',
                  icon: <KeyOutlined />,
                  label: '修改密码',
                  onClick: () => navigate('/profile/change-password'),
                },
                { type: 'divider' },
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  danger: true,
                  onClick: handleLogout,
                },
              ],
            }}
          >
            <Space style={{ cursor: 'pointer' }}>
              {dom}
              <DownOutlined style={{ fontSize: 10 }} />
            </Space>
          </Dropdown>
        ),
      }}
      actionsRender={() => [
        activeCycle ? (
          <Space size={6} key="cycle">
            <Text style={{ color: 'var(--neu-text-secondary)', fontSize: 13 }}>当前周期：</Text>
            <Text strong style={{ color: 'var(--neu-text-primary)' }}>{activeCycle.name}</Text>
            <Tag color="blue" style={{ marginInlineEnd: 0, borderRadius: 8 }}>
              {phaseName()}
            </Tag>
          </Space>
        ) : (
          <Tag key="cycle-empty" color="default" style={{ borderRadius: 8 }}>
            暂无活跃周期
          </Tag>
        ),
        <Dropdown
          key="theme-toggle"
          menu={{
            items: [
              { key: 'system', icon: <DesktopOutlined />, label: '跟随系统' },
              { key: 'light', icon: <SunOutlined />, label: '浅色模式' },
              { key: 'dark', icon: <MoonOutlined />, label: '深色模式' },
            ],
            selectedKeys: [mode],
            onClick: ({ key }) => setMode(key as ThemeMode),
          }}
        >
          <span
            title={modeLabel[mode]}
            style={{
              cursor: 'pointer',
              fontSize: 16,
              padding: '4px 8px',
              borderRadius: 'var(--neu-radius-sm)',
              color: 'var(--neu-text-secondary)',
              transition: 'color 0.2s',
            }}
          >
            {themeIcon}
          </span>
        </Dropdown>,
      ]}
      menuFooterRender={(props) =>
        props?.collapsed ? null : (
          <div
            style={{
              padding: '12px 16px',
              margin: '0 12px 12px',
              borderRadius: 'var(--neu-radius-sm)',
              background: 'var(--neu-bg-sunken)',
              boxShadow: 'var(--neu-shadow-in-1)',
              color: 'var(--neu-text-tertiary)',
              fontSize: 12,
            }}
          >
            <Avatar
              size="small"
              icon={<UserOutlined />}
              style={{
                marginRight: 6,
                background: 'var(--neu-accent)',
              }}
            />
            {user?.name}（{user?.role}）
          </div>
        )
      }
    >
      <div style={{ background: 'var(--neu-bg)', minHeight: 'calc(100vh - 56px)' }}>
        <Outlet />
      </div>
    </ProLayout>
  );
}
