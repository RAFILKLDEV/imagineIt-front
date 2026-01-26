import { useToastContext } from '../components/ToastProvider';

export function useToast() {
  return useToastContext();
}
