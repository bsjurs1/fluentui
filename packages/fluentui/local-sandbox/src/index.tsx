import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { FluentProvider, webLightTheme, Button } from '@fluentui/react-components';
import { Text } from '@fluentui/react-text';

const App = () => (
  <FluentProvider theme={webLightTheme}>
    <Button>A button</Button>
    <Button primary>A button</Button>
    <Button size="large">A button</Button>
    <Text variant="display">Click here</Text>
  </FluentProvider>
);

ReactDOM.render(<App />, document.querySelector('#root'));
