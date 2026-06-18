import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = () => {
    if (!socket) {
        const url = process.env.NEXT_PUBLIC_BACKEND_URL;
        if (!url) {
            if (process.env.NODE_ENV !== "production") {
                console.warn("[Socket] NEXT_PUBLIC_BACKEND_URL is not configured.");
            }
            return null;
        }

        socket = io(url, {
            withCredentials: true,
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socket.on("connect_error", (err) => {
            if (process.env.NODE_ENV !== "production") {
                console.warn(`[Socket] Connection unavailable: ${err.message}`);
            }
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
