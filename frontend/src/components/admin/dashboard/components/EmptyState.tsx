import { Empty, Typography } from 'antd';
import { makeSoftPanelStyle } from '../styles';

const { Text } = Typography;

interface EmptyStateProps {
    title: string;
    description: string;
    isDark: boolean;
    variant?: 'chart' | 'card';
}

export const EmptyState = ({ title, description, isDark, variant = 'card' }: EmptyStateProps) => {
    const isChart = variant === 'chart';
    
    return (
        <div 
            style={{ 
                ...makeSoftPanelStyle(isDark), 
                minHeight: isChart ? 240 : 120, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: isChart ? 32 : 16,
                position: 'relative',
                overflow: 'hidden',
                ...(isChart && {
                    backgroundImage: isDark 
                        ? 'linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px)'
                        : 'linear-gradient(rgba(15, 23, 42, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 23, 42, 0.03) 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                    border: isDark ? '1px dashed rgba(148, 163, 184, 0.2)' : '1px dashed #cbd5e1',
                    backgroundPosition: 'center center'
                })
            }}
        >
            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.6)', padding: '16px 32px', borderRadius: 16, backdropFilter: 'blur(4px)' }}>
                <Empty 
                    image={isChart ? Empty.PRESENTED_IMAGE_DEFAULT : Empty.PRESENTED_IMAGE_SIMPLE} 
                    styles={{ image: { height: isChart ? 60 : 40, marginBottom: 12, opacity: 0.6 } }}
                    description={<span style={{ color: isDark ? '#f8fafc' : '#0f172a', fontWeight: 600, fontSize: 14 }}>{title}</span>} 
                    style={{ margin: 0 }}
                >
                    {description ? <Text style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#64748b', display: 'block', marginTop: 6 }}>{description}</Text> : null}
                </Empty>
            </div>
        </div>
    );
};
