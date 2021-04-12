import { makeStyles } from '@fluentui/react-make-styles';

export const useStyles = makeStyles({
  root: {
    display: 'flex',

    ':hover': { color: 'red' },
    ':focus': { ':hover': { color: 'red' } },

    '& .foo': { ':hover': { color: 'red' } },
  },
});
