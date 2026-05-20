'use client';

import { App } from 'antd';
import { useEffect } from 'react';

// Extract types from App.useApp() return type
type StaticFunctions = ReturnType<typeof App.useApp>;
type NotificationConfig = Record<string, unknown>;
type NotificationMethod = (config: NotificationConfig) => unknown;

let message: StaticFunctions['message'];
let notification: StaticFunctions['notification'];
let modal: StaticFunctions['modal'];

/**
 * This component is used to extract static-like but context-aware functions 
 * from Ant Design's App component.
 * It must be rendered inside <App> provider.
 */
const AntdStatic = () => {
  const {
    message: appMessage,
    notification: appNotification,
    modal: appModal,
  } = App.useApp();

  useEffect(() => {
    message = appMessage;

    // Wrap notification to support legacy 'title' property by mapping it to 'message'.
    notification = new Proxy(appNotification, {
      get(target, prop) {
        const originalMethod = target[prop as keyof typeof appNotification];
        if (typeof originalMethod === 'function') {
          return (config: NotificationConfig) => {
            const newConfig = { ...config };
            if (newConfig.message && !newConfig.title) {
              newConfig.title = newConfig.message;
              delete newConfig.message;
            }
            return (originalMethod as NotificationMethod)(newConfig);
          };
        }
        return originalMethod;
      },
    }) as StaticFunctions['notification'];

    modal = appModal;
  }, [appMessage, appNotification, appModal]);

  return null;
};

export { message, notification, modal };
export default AntdStatic;
