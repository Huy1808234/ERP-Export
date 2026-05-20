import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = () => {
    if (!socket) {
        const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}`;
        
        socket = io(url, {
            withCredentials: true,
            transports: ['websocket', 'polling']
        });

        socket.on("connect_error", (err) => {
            console.error("❌ WebSocket Connection Error:", err.message);
        });
    }
    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
