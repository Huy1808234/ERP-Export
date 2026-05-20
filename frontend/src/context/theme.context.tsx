'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ConfigProvider, theme, App } from 'antd';
import enUS from 'antd/locale/en_US';
import viVN from 'antd/locale/vi_VN';
import { useLocale } from 'next-intl';
import AntdStatic from '@/providers/antd-static';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const locale = useLocale();
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-mode') as ThemeMode || 'system';
    setThemeMode(savedTheme);
    setMounted(true);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateTheme = () => {
      localStorage.setItem('theme-mode', themeMode);
      if (themeMode === 'system') {
        setIsDark(mediaQuery.matches);
      } else {
        setIsDark(themeMode === 'dark');
      }
    };

    updateTheme();
    mediaQuery.addEventListener('change', updateTheme);
    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, [themeMode]);

  const appShellStyle = {
    minHeight: '100vh',
    backgroundColor: isDark ? '#020617' : '#f8fafc',
    color: isDark ? '#f1f5f9' : '#0f172a',
    opacity: mounted ? 1 : 0,
    transition: mounted ? 'opacity 0.3s ease-in-out, background-color 0.5s ease-in-out' : 'none',
  } as React.CSSProperties;

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, isDark }}>
      <ConfigProvider
        locale={locale === 'vi' ? viVN : enUS}
        theme={{
          algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            colorPrimary: '#3b82f6',
            borderRadius: 12,
            colorBgBase: isDark ? '#020617' : '#ffffff',
            colorBgContainer: isDark ? '#0f172a' : '#ffffff',
            colorBgLayout: isDark ? '#020617' : '#f8fafc',
            colorBorderSecondary: isDark ? '#1e293b' : '#f1f5f9',
            fontFamily: 'var(--font-body)',
          },
          components: {
            Layout: {
              headerBg: isDark ? '#020617' : '#ffffff',
              siderBg: isDark ? '#020617' : '#001529',
              bodyBg: isDark ? '#020617' : '#f8fafc',
            },
            Card: {
              colorBgContainer: isDark ? '#0f172a' : '#ffffff',
            },
          }
        }}
      >
        <App>
          <AntdStatic />
          <div 
            className={`${isDark ? 'dark' : 'light'} ${mounted ? 'theme-ready' : ''}`}
            id="theme-wrapper"
            style={appShellStyle}
          >
            {children}
          </div>
        </App>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
