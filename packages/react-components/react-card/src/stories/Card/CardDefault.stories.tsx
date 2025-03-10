import * as React from 'react';

import { Body1, Caption1, Button } from '@fluentui/react-components';
import { ArrowReplyRegular, ShareRegular } from '@fluentui/react-icons';
import { Card, CardFooter, CardHeader, CardPreview } from '@fluentui/react-card';
import { ASSET_URL } from './SampleCard.stories';

const avatarElviaURL = ASSET_URL + '/assets/avatar_elvia.svg';
const wordLogoURL = ASSET_URL + '/assets/word_logo.svg';
const docTemplateURL = ASSET_URL + '/assets/doc_template.png';

export const Default = () => {
  return (
    <Card>
      <CardHeader
        image={{ as: 'img', src: avatarElviaURL, alt: 'Face of a person' }}
        header={
          <Body1>
            <b>Elvia Atkins</b> mentioned you
          </Body1>
        }
        description={<Caption1>5h ago · About us - Overview</Caption1>}
      />

      <CardPreview logo={<img src={wordLogoURL} alt="Microsoft Word logo" />}>
        <img src={docTemplateURL} alt="Preview of a Word document " />
      </CardPreview>
      <CardFooter>
        <Button icon={<ArrowReplyRegular fontSize={16} />}>Reply</Button>
        <Button icon={<ShareRegular fontSize={16} />}>Share</Button>
      </CardFooter>
    </Card>
  );
};
