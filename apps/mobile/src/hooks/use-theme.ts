import { useColorScheme } from 'react-native';

import { colorsForTheme, themeNameForScheme } from '@/lib/theme';

/** Current design theme and its raw color values, for APIs that cannot take className (native tabs, status bar). */
export function useTheme() {
  const name = themeNameForScheme(useColorScheme());
  return { name, colors: colorsForTheme(name) };
}
