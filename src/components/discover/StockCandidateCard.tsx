import React from 'react';
import { View } from 'react-native';
import { StockCandidate } from '../../types';

type Props = {
  candidate?: StockCandidate;
  isAdded?: boolean;
  onAdd?: () => Promise<void> | void;
};

export function StockCandidateCard(_props: Props) { return <View />; }
