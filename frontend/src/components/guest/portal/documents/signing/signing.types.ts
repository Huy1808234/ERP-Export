export type SigningItem = {
  _id: string;
  productName: string | null;
  sku: string | null;
  quantity: number | string;
  unitPrice: number | string;
  totalPrice: number | string;
};

export type SigningModalSession = {
  invitation: {
    _id: string;
    signerName: string;
    signerTitle: string | null;
    signerEmailMasked: string | null;
    status: string;
    expiresAt: string;
    otpExpiresAt: string | null;
    otpVerified: boolean;
    sentAt: string | null;
    verifiedAt: string | null;
    signedAt: string | null;
    certificateNumber: string | null;
  };
  contract: {
    _id: string;
    contractNumber: string;
    status: string;
    signatureStatus: string;
    buyerName: string | null;
    buyerCountry: string | null;
    incoterm: string;
    currencyCode: string;
    totalAmount: number | string;
    totalAmountVnd: number | string;
    deliveryDate: string | null;
    paymentTerms: string | null;
    notes: string | null;
    items: SigningItem[];
  };
};

export type SignFormValues = {
  signerName: string;
  signerTitle?: string | null;
  signerEmail?: string | null;
  acceptedConsent: boolean; // Changed from consentText to boolean based on review point #9
};
