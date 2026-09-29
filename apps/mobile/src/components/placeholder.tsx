import { Screen } from './screen';
import { Text } from './text';

export function Placeholder({ title, hint }: { title: string; hint: string }) {
  return (
    <Screen>
      <Text variant="screen-title" accessibilityRole="header">
        {title}
      </Text>
      <Text tone="muted">{hint}</Text>
    </Screen>
  );
}
