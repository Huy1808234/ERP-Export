export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_BUYER' | 'RESOLVED' | 'CLOSED';

export type SupportMessage = {
    _id: string;
    authorUsername: string;
    authorType: 'BUYER' | 'STAFF';
    message: string;
    createdAt: string;
};

export type SupportTicket = {
    _id: string;
    ticketNumber: string;
    subject: string;
    category: string;
    priority: string;
    status: TicketStatus;
    createdAt: string;
    updatedAt: string;
    messages?: SupportMessage[];
    shipment?: {
        shipmentNumber?: string | null;
    } | null;
};

export type TicketFormValues = {
    subject: string;
    category?: string;
    priority?: string;
    message: string;
};
