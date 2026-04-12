/**
 * 应用根组件 —— 批次 3 起切换为 React Router 入口。
 *
 * 真正的路由表与权限守卫位于 src/router/index.tsx 与 src/router/RequireAuth.tsx。
 * 全局 ConfigProvider / antd App / dayjs locale 由 src/main.tsx 提供。
 */
import { RouterProvider } from 'react-router-dom';
import { router } from '@/router';

function App() {
  return <RouterProvider router={router} />;
}

export default App;
