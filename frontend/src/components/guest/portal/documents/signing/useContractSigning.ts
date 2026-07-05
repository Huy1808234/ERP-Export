import { useState, useCallback, useEffect } from 'react';
import { App, Form } from 'antd';
import { useTranslations } from 'next-intl';
import { SIGNING_STEP, type SigningStep } from '../document.constants';
import type { SigningModalSession, SignFormValues } from './signing.types';
import {
  fetchSigningSessionData,
  requestSigningOtp,
  verifySigningOtp,
  submitContractSignature,
} from './signing.service';
import type { CustomerCommercialDocument } from '@/types/customer-portal';

type UseContractSigningProps = {
  document: CustomerCommercialDocument | null;
  onRequestSigning?: (recordId: string, signerEmail?: string) => Promise<{ success: boolean; signingToken?: string; signingUrl?: string; message?: string }>;
};

export const useContractSigning = ({ document, onRequestSigning }: UseContractSigningProps) => {
  const { message } = App.useApp();
  const t = useTranslations('CustomerPortal');

  const [signing, setSigning] = useState(false);
  const [signingNotice, setSigningNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const [signingModalOpen, setSigningModalOpen] = useState(false);
  const [signingSession, setSigningSession] = useState<SigningModalSession | null>(null);
  const [signingToken, setSigningToken] = useState<string | null>(null);
  const [signingLoading, setSigningLoading] = useState(false);

  const [missingEmailOpen, setMissingEmailOpen] = useState(false);

  const [otp, setOtp] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpResending, setOtpResending] = useState(false);
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const [isOtpExpired, setIsOtpExpired] = useState(false);
  const [signingStep, setSigningStep] = useState<SigningStep>(SIGNING_STEP.VERIFY_OTP);
  const [signingForm] = Form.useForm<SignFormValues>();
  const [emailForm] = Form.useForm<{ email: string }>();

  // Cooldown timer
  useEffect(() => {
    if (otpResendCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpResendCooldown]);

  const handleRequestSigning = async (providedEmail?: string) => {
    if (!document || !onRequestSigning) return;

    setSigning(true);
    setSigningNotice(null);
    try {
      const result = await onRequestSigning(document._id, providedEmail);

      if (!result.success) {
        if (result.message?.toLowerCase().includes('email is required')) {
          setMissingEmailOpen(true);
          return;
        }
        setSigningNotice({ type: 'error', text: result.message || t('documentDetail.signing.unableOpenPortal') });
        return;
      }

      setMissingEmailOpen(false);
      emailForm.resetFields();

      // Extract token securely
      const token = result.signingToken || (result.signingUrl && result.signingUrl.match(/\/portal\/sign\/([^/?#]+)/)?.[1]);

      if (!token) {
        setSigningNotice({ type: 'error', text: t('documentDetail.signing.unableOpenPortal') });
        return;
      }

      setSigningToken(token);
      setSigningModalOpen(true);
      setOtp('');
      setSigningStep(SIGNING_STEP.VERIFY_OTP);
      
      const sessionResult = await fetchSigningSessionData(token);
      if (!sessionResult.success || !sessionResult.data) {
        message.error(sessionResult.message || t('documentDetail.signing.unableOpenPortal'));
        setSigningModalOpen(false);
        return;
      }
      setSigningSession(sessionResult.data);
      setIsOtpExpired(false);

      // Auto request OTP
      setOtpSending(true);
      const otpResult = await requestSigningOtp(token);
      if (otpResult.success && otpResult.data) {
        setSigningSession((prev) => prev ? { ...prev, invitation: { ...prev.invitation, otpExpiresAt: otpResult.data!.expiresAt } } : prev);
        setOtpResendCooldown(60);
        message.success(t('documentDetail.signing.otpSent'));
      } else {
        message.error(otpResult.message || t('documentDetail.signing.otpSendFailedTryAgain'));
      }
      setOtpSending(false);

    } finally {
      setSigning(false);
    }
  };

  const handleMissingEmailSubmit = async (values: { email: string }) => {
    await handleRequestSigning(values.email);
  };

  const handleRequestOtp = async () => {
    if (!signingToken) return;

    setOtpResending(true);
    const res = await requestSigningOtp(signingToken);
    
    if (res.success && res.data) {
      setSigningSession((prev) => prev ? { ...prev, invitation: { ...prev.invitation, otpExpiresAt: res.data!.expiresAt } } : prev);
      setOtpResendCooldown(60);
      setIsOtpExpired(false);
      message.success(t('documentDetail.signing.otpSent'));
    } else {
      message.error(res.message || t('documentDetail.signing.otpSendFailed'));
    }
    setOtpResending(false);
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.length !== 6) {
      message.error(t('documentDetail.signing.otpSixDigits'));
      return;
    }
    if (!signingToken) return;

    setSigningLoading(true);
    const res = await verifySigningOtp(signingToken, otp.trim());
    
    if (res.success && res.data) {
      setSigningSession(res.data);
      setSigningStep(SIGNING_STEP.SIGN);
      
      if (res.data.invitation.signerName) {
        signingForm.setFieldsValue({ signerName: res.data.invitation.signerName });
      }

      message.success(t('documentDetail.signing.otpVerified'));
    } else {
      message.error(res.message || t('documentDetail.signing.invalidOtp'));
    }
    setSigningLoading(false);
  };

  const handleSignSubmit = async (values: SignFormValues) => {
    if (!signingToken) return;
    
    setSigning(true);
    const payload = {
      signerName: values.signerName,
      signerTitle: values.signerTitle || null,
      signerEmail: values.signerEmail || null,
      // consent text is no longer sent from frontend since it's an agreement checkbox,
      // but API might still expect something or rely on backend to log standard text.
    };

    const res = await submitContractSignature(signingToken, payload);

    if (res.success) {
      message.success(t('documentDetail.signing.contractSigned'));
      setSigningStep(SIGNING_STEP.COMPLETE);
    } else {
      message.error(res.message || t('documentDetail.signing.signingFailed'));
    }
    setSigning(false);
  };

  const handleSigningModalClose = useCallback(() => {
    setSigningModalOpen(false);
    setSigningSession(null);
    setSigningToken(null);
    setSigningStep(SIGNING_STEP.VERIFY_OTP);
    setOtp('');
    setOtpResendCooldown(0);
    setOtpSending(false);
    setIsOtpExpired(false);
  }, []);

  return {
    state: {
      signing,
      signingNotice,
      signingModalOpen,
      signingSession,
      signingLoading,
      missingEmailOpen,
      missingEmailForm: emailForm,
      otp,
      otpSending,
      otpResending,
      otpResendCooldown,
      isOtpExpired,
      signingStep,
      signingForm,
    },
    actions: {
      setOtp,
      setIsOtpExpired,
      setMissingEmailOpen,
      handleRequestSigning,
      handleMissingEmailSubmit,
      handleRequestOtp,
      handleVerifyOtp,
      handleSignSubmit,
      handleSigningModalClose,
    },
  };
};
