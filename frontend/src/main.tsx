import React from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntdApp } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { ThemeProvider } from './theme/ThemeProvider';
import App from './App';
import './index.css';

dayjs.locale('zh-cn');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AntdApp>
        <App />
      </AntdApp>
    </ThemeProvider>
  </React.StrictMode>,
);
