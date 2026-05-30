import React from 'react';
import { View } from 'react-native';
import { OHLCBar } from '../../types';

type Props = { data?: OHLCBar[]; width?: number; height?: number };
export function CandlestickChart(_props: Props) { return <View style={{height:220}} />; }
