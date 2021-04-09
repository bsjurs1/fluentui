import { makeStyles } from '@fluentui/react-make-styles';
import { colorGreen } from './vars';

const colorRed = 'red';

export const useStyles = makeStyles({
  root: { color: colorRed, padding: '4px' },
  icon: { background: colorGreen, marginLeft: '4px' },
});
