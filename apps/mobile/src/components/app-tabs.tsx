import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';

const TABS = [
  { name: 'index', label: 'Today', sf: 'clock', md: 'schedule' },
  { name: 'my-bar', label: 'My bar', sf: 'wineglass', md: 'local_bar' },
  { name: 'favorites', label: 'Favorites', sf: 'heart', md: 'favorite' },
  { name: 'search', label: 'Search', sf: 'magnifyingglass', md: 'search' },
] as const;

export default function AppTabs() {
  const { colors } = useTheme();

  return (
    <NativeTabs
      backgroundColor={colors.surface}
      indicatorColor={colors['surface-raised']}
      iconColor={{ default: colors['ink-muted'], selected: colors.primary }}
      labelStyle={{
        default: { color: colors['ink-muted'] },
        selected: { color: colors.ink },
      }}
    >
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.md} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
