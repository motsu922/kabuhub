import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function DevStatusScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.box}>
        <Text style={styles.title}>現在の状態</Text>
        <Text style={styles.item}>- Expo Router の最小構成で起動可能</Text>
        <Text style={styles.item}>- 既存のKabuHub実装ファイルは /root/legacy-kabuhub-src に退避予定</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#06090F', justifyContent: 'center', padding: 20 },
  box: { backgroundColor: '#111827', borderRadius: 12, padding: 20, gap: 10 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  item: { color: '#D1D5DB', fontSize: 14 }
});
