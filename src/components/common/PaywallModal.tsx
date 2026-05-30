import { View } from 'react-native';

export type PaywallReason = 'watchlist' | 'ai' | 'watchlist_limit' | 'ai_limit';

export function PaywallModal(_props: {
  visible?: boolean;
  reason?: PaywallReason;
  onClose?: () => void;
}) {
  return <View />;
}
