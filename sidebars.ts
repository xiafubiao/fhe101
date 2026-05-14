import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'doc',
      id: 'intro',
      label: '欢迎',
    },
    {
      type: 'category',
      label: 'Part 1: 认识 FHE (What is FHE?)',
      collapsed: false,
      items: [
        'part1-understand/intro',
        'part1-understand/scheme-selection',
        'part1-understand/fhe-vs-others',
        'part1-understand/fhe-usecases',
      ],
    },
    {
      type: 'category',
      label: 'Part 2: FHE开发入门 (FHE Basic Development)',
      collapsed: false,
      items: [
        'part2-dev-start/concepts',
        'part2-dev-start/web3-architecture',
        'part2-dev-start/setup',
        'part2-dev-start/tutorial-1',
        'part2-dev-start/tutorial-2',
        'part2-dev-start/tutorial-3',
        'part2-dev-start/fhevm-tutorial',
      ],
    },
    {
      type: 'category',
      label: 'Part 3: FHE进阶 (Advanced Topics of FHE)',
      collapsed: false,
      items: [
        'part3-advanced/optimization',
        'part3-advanced/bootstrapping',
        'part3-advanced/advanced-topics',
      ],
    },
    {
      type: 'category',
      label: 'Part 4: 资源与社区 (Resources and Communities)',
      collapsed: false,
      items: [
        'part4-resources/learning-path',
        'part4-resources/tools',
        'part4-resources/faq',
      ],
    },
  ],
};

export default sidebars;