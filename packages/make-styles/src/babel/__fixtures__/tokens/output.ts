import { makeStyles } from '@fluentui/make-styles';
type Tokens = {
  colorGreen: string;
  colorRed: string;
};
export const styles = makeStyles<never, Tokens>([
  [
    null,
    (tokens) => ({
      backgroundColor: tokens.colorGreen,
      color: tokens.colorRed,
      display: 'flex',
    }),
    {
      color: 'var(--theme-colorRed)',
      padding: 'var(--theme-padding)',
    },
  ],
]);
