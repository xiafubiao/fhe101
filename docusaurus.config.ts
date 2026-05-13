import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'FHE101',
  tagline: '全同态加密开发者入门指南',
  favicon: 'img/favicon.png',
  future: {
    v4: true,
  },

  url: 'https://fhe101.dev',
  baseUrl: '/',

  organizationName: 'fhe101',
  projectName: 'fhe101',

  onBrokenLinks: 'warn',

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          editUrl:
            'https://github.com/fhe101/fhe101/edit/main/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans', 'en'],
    localeConfigs: {
      'en': {
        label: 'English',
        direction: 'ltr',
      },
      'zh-Hans': {
        label: '中文',
        direction: 'ltr',
      },
    },
  },

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'FHE101',
      logo: {
        alt: 'FHE101 Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: '文档',
        },
        {
          type: 'localeDropdown',
          position: 'right',
        },
        {
          href: 'https://github.com/xiafubiao/fhe101',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: '资源',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/fhe101',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} FHE101. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
