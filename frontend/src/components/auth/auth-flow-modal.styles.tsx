const AuthFlowModalStyles = () => (
  <style jsx global>{`
    .auth-flow-root .ant-modal,
    .auth-flow-wrap .ant-modal,
    .auth-flow-modal.ant-modal {
      max-width: calc(100vw - 32px);
    }

    .auth-flow-root .ant-modal-content,
    .auth-flow-wrap .ant-modal-content,
    .auth-flow-modal.ant-modal .ant-modal-content,
    .auth-flow-container {
      padding: 0 !important;
      border-radius: 20px !important;
      border: 1px solid rgba(148, 163, 184, 0.22) !important;
      background: transparent !important;
      box-shadow: 0 30px 90px rgba(2, 6, 23, 0.62) !important;
      overflow: hidden !important;
    }

    .auth-flow-root .ant-modal-body,
    .auth-flow-wrap .ant-modal-body,
    .auth-flow-modal.ant-modal .ant-modal-body,
    .auth-flow-body {
      padding: 0 !important;
      background: transparent !important;
    }

    .auth-flow-mask {
      backdrop-filter: blur(14px);
      background: rgba(2, 6, 23, 0.72) !important;
    }

    .auth-flow-root .ant-modal-close,
    .auth-flow-wrap .ant-modal-close,
    .auth-flow-modal.ant-modal .ant-modal-close {
      top: 16px;
      right: 16px;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      color: #94a3b8;
      background: rgba(15, 23, 42, 0.72);
      border: 1px solid rgba(148, 163, 184, 0.18);
    }

    .auth-flow-root .ant-modal-close:hover,
    .auth-flow-wrap .ant-modal-close:hover,
    .auth-flow-modal.ant-modal .ant-modal-close:hover {
      color: #f8fafc;
      background: rgba(30, 41, 59, 0.92);
    }

    .auth-flow-root .ant-modal-close:focus-visible,
    .auth-flow-wrap .ant-modal-close:focus-visible,
    .auth-flow-modal.ant-modal .ant-modal-close:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.22);
    }

    .auth-flow-panel {
      position: relative;
      border-radius: 20px;
      background:
        radial-gradient(circle at 0% 0%, rgba(45, 212, 191, 0.2), transparent 32%),
        linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(17, 24, 39, 0.98));
      padding: 34px 36px 32px;
      overflow: hidden;
    }

    .auth-flow-panel::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      background: linear-gradient(90deg, rgba(52, 211, 153, 0.16), transparent 34%, rgba(6, 182, 212, 0.12));
      opacity: 0.9;
    }

    .auth-flow-panel > * {
      position: relative;
      z-index: 1;
    }

    .auth-flow-kicker {
      color: #2dd4bf !important;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .auth-flow-title {
      margin: 8px 0 6px !important;
      color: #f8fafc !important;
      font-size: 28px !important;
      line-height: 1.12 !important;
      letter-spacing: 0 !important;
    }

    .auth-flow-subtitle {
      color: #94a3b8 !important;
      font-size: 14px;
      line-height: 1.6;
    }

    .auth-flow-steps {
      padding: 6px 0 4px;
    }

    .auth-flow-steps .ant-steps-item-title {
      color: #cbd5e1 !important;
      font-size: 13px;
      font-weight: 700;
    }

    .auth-flow-steps .ant-steps-item-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px !important;
      height: 30px !important;
      margin-inline-end: 10px !important;
      border-radius: 10px !important;
      background: rgba(15, 23, 42, 0.9) !important;
      border: 1px solid rgba(148, 163, 184, 0.22) !important;
    }

    .auth-flow-steps .ant-steps-item-process .ant-steps-item-icon,
    .auth-flow-steps .ant-steps-item-finish .ant-steps-item-icon {
      border-color: rgba(45, 212, 191, 0.72) !important;
      background: rgba(13, 148, 136, 0.16) !important;
    }

    .auth-flow-steps .ant-steps-item-icon .ant-steps-icon,
    .auth-flow-steps .ant-steps-item-process .ant-steps-item-icon .anticon,
    .auth-flow-steps .ant-steps-item-finish .ant-steps-item-icon .anticon {
      color: #2dd4bf !important;
      font-size: 15px;
      line-height: 1;
    }

    .auth-flow-steps .ant-steps-item-wait .ant-steps-item-icon .anticon {
      color: #64748b !important;
    }

    .auth-flow-steps .ant-steps-item-tail {
      top: 15px !important;
      margin-inline-start: 40px !important;
      padding-inline-end: 22px !important;
    }

    .auth-flow-steps .ant-steps-item-tail::after {
      height: 1px !important;
      background: rgba(148, 163, 184, 0.16) !important;
    }

    .auth-flow-form {
      margin-top: 2px;
    }

    .auth-flow-form .ant-form-item {
      margin-bottom: 20px;
    }

    .auth-flow-form .ant-form-item-label {
      padding-bottom: 8px;
    }

    .auth-flow-form .ant-form-item-label > label {
      color: #dbeafe !important;
      font-size: 13px;
      font-weight: 700;
    }

    .auth-flow-form .ant-input-affix-wrapper,
    .auth-flow-form .ant-input,
    .auth-flow-form .ant-input-password {
      min-height: 50px;
      border-radius: 14px !important;
      border-color: rgba(148, 163, 184, 0.28) !important;
      background: rgba(2, 6, 23, 0.5) !important;
      color: #f8fafc !important;
      box-shadow: none !important;
    }

    .auth-flow-form .ant-input-affix-wrapper {
      padding: 0 14px;
    }

    .auth-flow-form .ant-input-affix-wrapper > input.ant-input,
    .auth-flow-form .ant-input-password input.ant-input {
      min-height: 48px;
      background: transparent !important;
      border: none !important;
      color: #f8fafc !important;
      box-shadow: none !important;
    }

    .auth-flow-form .ant-input::placeholder,
    .auth-flow-form .ant-input-affix-wrapper input::placeholder {
      color: #64748b !important;
    }

    .auth-flow-form .ant-input-prefix,
    .auth-flow-form .ant-input-password-icon {
      color: #2dd4bf !important;
      margin-inline-end: 8px;
    }

    .auth-flow-form .ant-input-affix-wrapper-disabled,
    .auth-flow-form .ant-input:disabled {
      background: rgba(15, 23, 42, 0.72) !important;
      color: #94a3b8 !important;
      cursor: default;
    }

    .auth-flow-form .ant-input-affix-wrapper-focused,
    .auth-flow-form .ant-input:focus,
    .auth-flow-form .ant-input-focused,
    .auth-flow-form .ant-input-password:focus-within {
      border-color: #2dd4bf !important;
      box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.13) !important;
    }

    .auth-flow-actions {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(132px, auto);
      gap: 12px;
    }

    .auth-flow-primary {
      height: 50px;
      border-radius: 14px;
      border: none;
      font-weight: 800;
      background: linear-gradient(135deg, #10b981 0%, #0891b2 100%) !important;
      box-shadow: 0 16px 32px rgba(8, 145, 178, 0.22);
    }

    .auth-flow-primary:hover {
      filter: brightness(1.04);
    }

    .auth-flow-secondary {
      height: 50px;
      border-radius: 14px;
      border-color: rgba(148, 163, 184, 0.28);
      background: rgba(15, 23, 42, 0.5);
      color: #cbd5e1;
      font-weight: 800;
    }

    .auth-flow-secondary:hover {
      border-color: rgba(45, 212, 191, 0.55) !important;
      color: #f8fafc !important;
      background: rgba(15, 23, 42, 0.72) !important;
    }

    .auth-flow-result {
      display: grid;
      gap: 12px;
      justify-items: center;
      text-align: center;
      padding: 8px 0 2px;
    }

    .auth-flow-result > .anticon {
      color: #2dd4bf;
      font-size: 42px;
    }

    .auth-flow-result h4 {
      color: #f8fafc !important;
      margin: 0 !important;
    }

    .auth-flow-result .ant-typography {
      color: #94a3b8 !important;
    }

    @media (max-width: 575px) {
      .auth-flow-panel {
        padding: 28px 22px 24px;
      }

      .auth-flow-title {
        font-size: 24px !important;
      }

      .auth-flow-actions {
        grid-template-columns: 1fr;
      }

      .auth-flow-steps .ant-steps-item-title {
        display: none;
      }
    }
  `}</style>
);

export default AuthFlowModalStyles;
