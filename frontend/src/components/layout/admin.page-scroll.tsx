'use client'

import AdminScrollArea from './admin.scroll-area';
import type { CSSProperties, ReactNode } from 'react';

type AdminPageScrollProps = {
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
    contentStyle?: CSSProperties;
    offset?: number;
    height?: CSSProperties['height'];
    padding?: CSSProperties['padding'];
};

const AdminPageScroll = ({
    children,
    className,
    style,
    contentStyle,
    offset,
    height,
    padding = 24,
}: AdminPageScrollProps) => {
    return (
        <AdminScrollArea
            className={`admin-page-scroll ${className ?? ''}`.trim()}
            overflowY="auto"
            padding={padding}
            contentStyle={{
                minHeight: '100%',
                ...contentStyle,
            }}
            style={{
                height: height ?? (offset ? `calc(100vh - ${offset}px)` : '100%'),
                minHeight: 0,
                maxHeight: '100%',
                ...style,
            }}
        >
            {children}
        </AdminScrollArea>
    );
};

export default AdminPageScroll;
