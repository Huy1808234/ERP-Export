'use client';

import { App } from 'antd';

// Extract types from App.useApp() return type
type StaticFunctions = ReturnType<typeof App.useApp>;

let message: StaticFunctions['message'];
let notification: StaticFunctions['notification'];
let modal: StaticFunctions['modal'];

/**
 * This component is used to extract static-like but context-aware functions 
 * from Ant Design's App component.
 * It must be rendered inside <App> provider.
 */
const AntdStatic = () => {
  const staticFunctions = App.useApp();
  message = staticFunctions.message;
  
  // Wrap notification to support legacy 'title' property by mapping it to 'message'
  const originalNotification = staticFunctions.notification;
  notification = new Proxy(originalNotification, {
    get(target, prop) {
      const originalMethod = target[prop as keyof typeof originalNotification];
      if (typeof originalMethod === 'function') {
        return (config: any) => {
          const newConfig = { ...config };
          if (newConfig.message && !newConfig.title) {
            newConfig.title = newConfig.message;
            delete newConfig.message;
          }
          return (originalMethod as Function)(newConfig);
        };
      }
      return originalMethod;
    }
  }) as any;

  modal = staticFunctions.modal;
  return null;
};

export { message, notification, modal };
export default AntdStatic;
