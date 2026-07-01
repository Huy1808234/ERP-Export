'use client'

import { useTheme } from '@/context/theme.context';
import type { CSSProperties, ReactNode } from 'react';

type AdminScrollAreaProps = {
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
    contentStyle?: CSSProperties;
    padding?: CSSProperties['padding'];
    overflowY?: CSSProperties['overflowY'];
};

type ScrollAreaStyle = CSSProperties & {
    '--admin-scroll-thumb': string;
    '--admin-scroll-thumb-hover': string;
};

const AdminScrollArea = ({
    children,
    className,
    style,
    contentStyle,
    padding = 0,
    overflowY = 'auto',
}: AdminScrollAreaProps) => {
    const { isDark } = useTheme();

    const scrollStyle: ScrollAreaStyle = {
        '--admin-scroll-thumb': isDark ? 'rgba(148, 163, 184, 0.24)' : 'rgba(100, 116, 139, 0.22)',
        '--admin-scroll-thumb-hover': isDark ? 'rgba(203, 213, 225, 0.38)' : 'rgba(71, 85, 105, 0.34)',
        minHeight: 0,
        maxWidth: '100%',
        position: 'relative',
        overflowY,
        overflowX: 'hidden',
        scrollbarGutter: 'stable',
        ...style,
    };

    return (
        <div className={`admin-scroll-area ${className ?? ''}`.trim()} style={scrollStyle}>
            <div
                style={{
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    padding,
                    ...contentStyle,
                }}
            >
                {children}
            </div>
            <style jsx global>{`
                .admin-scroll-area,
                .admin-scroll-area * {
                    scrollbar-width: thin;
                    scrollbar-color: var(--admin-scroll-thumb) transparent;
                }

                .admin-scroll-area::-webkit-scrollbar,
                .admin-scroll-area *::-webkit-scrollbar {
                    width: 2px;
                    height: 2px;
                }

                .admin-scroll-area::-webkit-scrollbar-track,
                .admin-scroll-area *::-webkit-scrollbar-track {
                    background: transparent;
                }

                .admin-scroll-area::-webkit-scrollbar-thumb,
                .admin-scroll-area *::-webkit-scrollbar-thumb {
                    background: var(--admin-scroll-thumb);
                    border-radius: 999px;
                }

                .admin-scroll-area::-webkit-scrollbar-thumb:hover,
                .admin-scroll-area *::-webkit-scrollbar-thumb:hover {
                    background: var(--admin-scroll-thumb-hover);
                }

                .admin-scroll-area::-webkit-scrollbar-corner,
                .admin-scroll-area *::-webkit-scrollbar-corner {
                    background: transparent;
                }
            `}</style>
        </div>
    );
};

export default AdminScrollArea;
