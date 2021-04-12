import { makeStyles } from '@fluentui/react-make-styles';
import { colorBlue } from '../object-nesting/consts';

export const useStyles = makeStyles({
  root: theme => ({
    display: 'flex',

    ':hover': { color: 'red' },
    ':focus': { ':hover': { color: colorBlue } },

    '& .foo': { ':hover': { color: theme.alias.color.green.foreground1 } },
  }),
});
