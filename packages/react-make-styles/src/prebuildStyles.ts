import { prebuildStyles as vanillaPrebuildStyles, MakeStylesStyleRule } from '@fluentui/make-styles';
import { useFluent } from '@fluentui/react-provider';
import { Theme } from '@fluentui/react-theme';

import { useRenderer } from './useRenderer';

export function makeStyles<Slots extends string>(stylesBySlots: Record<Slots, MakeStylesStyleRule<Theme>>) {
  const getStyles = vanillaPrebuildStyles(stylesBySlots);

  if (process.env.NODE_ENV === 'test') {
    return () => ({} as Record<Slots, string>);
  }

  return function useClasses(): Record<Slots, string> {
    const { dir, document } = useFluent();
    const renderer = useRenderer(document);

    return getStyles({ dir, renderer });
  };
}
