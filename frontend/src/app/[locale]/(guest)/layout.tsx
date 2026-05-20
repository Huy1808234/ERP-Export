import React from "react";
import GuestHeader from "@/components/guest/Header";
import GuestFooter from "@/components/guest/Footer";
import { auth } from "@/auth";
import { headers } from 'next/headers';

export default async function GuestLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || ''; 
  // Lưu ý: Cần middleware để inject x-pathname nếu muốn dùng ở server component
  // Hoặc dùng một giải pháp đơn giản hơn là check xem có children hay không hoặc route

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      background: '#f8fafc' 
    }}>
      <GuestHeader session={session} />
      
      <main style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        width: '100%',
        position: 'relative',
        // Chúng ta sẽ để padding/margin cho từng page con tự quyết định hoặc dùng class
      }}>
        {children}
      </main>

      <GuestFooter />
    </div>
  );
}
