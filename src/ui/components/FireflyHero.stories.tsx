import type { Meta, StoryObj } from '@storybook/react';
import { FireflyHero } from './FireflyHero';

const meta: Meta<typeof FireflyHero> = {
  title: 'Narrative/Brand/FireflyHero',
  component: FireflyHero,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0b111e' },
      ],
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof FireflyHero>;

export const Default: Story = {
  args: {
    onExitComplete: () => console.log('Firefly transition complete'),
  },
};

export const MobileView: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};
