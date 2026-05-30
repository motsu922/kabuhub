import { Link } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>KabuHub</Text>
        <Text style={styles.subtitle}>起動確認用の最小画面です</Text>
        <Link href="/dev-status" style={styles.link}>開発ステータスを見る</Link>
        <Link href="/(legacy)/tabs" style={styles.link}>復元した旧UIを開く</Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#06090F', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#111827', borderRadius: 12, padding: 20, gap: 10 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700' },
  subtitle: { color: '#9CA3AF', fontSize: 14 },
  link: { color: '#60A5FA', fontSize: 16, marginTop: 8 }
});
