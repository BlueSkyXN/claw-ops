/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 清新渐变风 - 马卡龙色系
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d6fe',
          300: '#a4b8fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        surface: {
          bg: '#f8fafc',        // 页面背景
          card: '#ffffff',       // 卡片背景
          sidebar: '#ffffff',    // 侧边栏背景
          border: '#e2e8f0',     // 边框
          hover: '#f1f5f9',      // 悬停态
          divider: '#f1f5f9',    // 分隔线
        },
        text: {
          primary: '#1e293b',    // 主要文字
          secondary: '#64748b',  // 次要文字
          muted: '#94a3b8',      // 弱化文字
          inverse: '#ffffff',    // 反色文字
        },
        // 马卡龙功能色
        pastel: {
          blue: '#93c5fd',       // 信息
          purple: '#c4b5fd',     // 规划
          green: '#86efac',      // 成功
          yellow: '#fde68a',     // 警告
          red: '#fca5a5',        // 错误
          pink: '#f9a8d4',       // 特殊
          cyan: '#67e8f9',       // 监控
          orange: '#fdba74',     // 审核
        },
        // 深色功能色（用于文字/图标）
        accent: {
          blue: '#3b82f6',
          purple: '#8b5cf6',
          green: '#22c55e',
          yellow: '#f59e0b',
          red: '#ef4444',
          pink: '#ec4899',
          cyan: '#06b6d4',
          orange: '#f97316',
        },
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08)',
        'sidebar': '2px 0 8px rgba(0,0,0,0.04)',
        'topbar': '0 1px 4px rgba(0,0,0,0.06)',
      },
      backgroundImage: {
        'gradient-blue': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'gradient-green': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        'gradient-orange': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'gradient-cyan': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'gradient-purple': 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
        'gradient-warm': 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
        'gradient-header': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
    }
  },
  plugins: [],
}
