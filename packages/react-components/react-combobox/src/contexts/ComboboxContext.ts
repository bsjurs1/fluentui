import { createContext } from '@fluentui/react-context-selector';
import { ComboboxState } from '../components/Combobox/Combobox.types';

/**
 * Context shared with Combobox, Listbox, & Options
 */
export type ComboboxContextValue = Pick<
  ComboboxState,
  | 'activeOption'
  | 'appearance'
  | 'open'
  | 'registerOption'
  | 'selectedOptions'
  | 'selectOption'
  | 'setActiveOption'
  | 'setOpen'
  | 'size'
>;

// eslint-disable-next-line @fluentui/no-context-default-value
export const ComboboxContext = createContext<ComboboxContextValue>({
  activeOption: undefined,
  appearance: 'outline',
  open: false,
  registerOption() {
    return () => undefined;
  },
  selectedOptions: [],
  selectOption() {
    // noop
  },
  setActiveOption() {
    // noop
  },
  setOpen() {
    // noop
  },
  size: 'medium',
});
