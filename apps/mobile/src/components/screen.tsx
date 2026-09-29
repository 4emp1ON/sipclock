import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';

// Uniwind styles React Native core components only; third-party ones need wrapping to accept className.
const SafeAreaView = withUniwind(RNSafeAreaView);

/** Themed full-screen container: safe-area aware (top; the tab bar handles the bottom), 20px side padding, scrollable. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-5 pt-4 pb-8"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
