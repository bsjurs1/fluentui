import * as React from 'react';
import { makeStyles, CompoundButton } from '@fluentui/react-components';

const useStyles = makeStyles({
  maxWidth: {
    maxWidth: '280px',
  },
});

export const WithLongText = () => {
  const styles = useStyles();

  return (
    <>
      <CompoundButton className={styles.maxWidth} secondaryContent="Secondary content">
        Short text
      </CompoundButton>
      <CompoundButton className={styles.maxWidth} secondaryContent="Secondary content">
        Long text wraps after it hits the max width of the component
      </CompoundButton>
    </>
  );
};
WithLongText.parameters = {
  docs: {
    description: {
      story: 'Text wraps after it hits the max width of the component.',
    },
  },
};
