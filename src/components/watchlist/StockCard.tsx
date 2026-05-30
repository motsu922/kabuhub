import { Text, TouchableOpacity, View } from 'react-native';
import { Stock } from '../../types';
export function StockCard({ stock, onPress }: { stock: Stock; intention?: string; onPress?: () => void }) {
  return <TouchableOpacity onPress={onPress}><View style={{padding:12, backgroundColor:'#111827', borderRadius:12, marginBottom:8}}><Text style={{color:'#fff'}}>{stock.name || stock.code}</Text></View></TouchableOpacity>;
}
