export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_BUYER' | 'RESOLVED' | 'CLOSED';

export type SupportAttachment = {
    fileAsset_id: string;
    fileName: string;
    url?: string | null;
};

export type SupportMessage = {
    _id: string;
    authorUsername: string;
    authorType: 'BUYER' | 'STAFF';
    message: string;
    attachments?: SupportAttachment[] | null;
    createdAt: string;
};

export type SupportTicket = {
    _id: string;
    ticketNumber: string;
    shipmentId?: string | null;
    subject: string;
    category: string;
    priority: string;
    status: TicketStatus;
    assignedToUsername?: string | null;
    lastMessageAt?: string | null;
    closedAt?: string | null;
    attachments?: SupportAttachment[] | null;
    createdAt: string;
    updatedAt: string;
    buyer?: {
        _id?: string;
        name?: string | null;
        code?: string | null;
    } | null;
    messages?: SupportMessage[];
    shipment?: {
        _id?: string;
        shipmentNumber?: string | null;
        blNumber?: string | null;
        bookingNumber?: string | null;
        pol?: string | null;
        pod?: string | null;
        eta?: string | null;
    } | null;
};

export type TicketFormValues = {
    subject: string;
    category?: string;
    priority?: string;
    shipmentId?: string;
    message: string;
    attachments?: SupportAttachment[];
};
