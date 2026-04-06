declare module "*.css";

interface Window {
  google: {
    accounts: {
      id: {
        initialize: (config: {
          client_id: string;
          callback: (response: any) => void;
          [key: string]: any;
        }) => void;
        prompt: (callback?: (notification: any) => void) => void;
        renderButton: (parent: HTMLElement, options: any) => void;
        disableAutoSelect: () => void;
        storeCredential: (credential: any, callback: () => void) => void;
      };
    };
  };
}