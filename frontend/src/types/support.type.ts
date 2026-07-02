export type TicketStatus =
    | 'OPEN'
    | 'IN_PROGRESS'
    | 'WAITING_INTERNAL'
    | 'WAITING_BUYER'
    | 'RESOLVED'
    | 'CLOSED';

export type TicketCategory =
    | 'QUALITY'
    | 'LOGISTICS'
    | 'FINANCE'
    | 'DOCUMENT'
    | 'OTHER';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type SupportAttachment = {
    fileAsset_id: string;
    fileName: string;
    url?: string | null;
};

export type SupportMessage = {
    _id: string;
    authorUsername: string;
    authorType: 'BUYER' | 'STAFF';
    visibility?: 'PUBLIC' | 'INTERNAL';
    message: string;
    attachments?: SupportAttachment[] | null;
    createdAt: string;
};

export type SupportTicket = {
    _id: string;
    ticketNumber: string;
    shipmentId?: string | null;
    subject: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    assignedToUsername?: string | null;
    lastMessageAt?: string | null;
    closedAt?: string | null;
    sla?: {
        targetHours: number;
        dueAt: string;
        status: 'ON_TRACK' | 'DUE_SOON' | 'BREACHED' | 'MET';
        remainingHours: number;
        breached: boolean;
    };
    aging?: {
        ageHours: number;
        ageDays: number;
        lastActivityAgeHours: number;
    };
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
    category?: TicketCategory;
    priority?: TicketPriority;
    shipmentId?: string;
    message: string;
    attachments?: SupportAttachment[];
};
