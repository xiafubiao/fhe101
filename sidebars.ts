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
      label: '第一部分：认识 FHE',
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
      label: '第二部分：FHE 开发入门',
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
      label: '第三部分：进阶开发',
      collapsed: true,
      items: [
        'part3-advanced/optimization',
        'part3-advanced/bootstrapping',
        'part3-advanced/advanced-topics',
      ],
    },
    {
      type: 'category',
      label: '第四部分：资源与社区',
      collapsed: true,
      items: [
        'part4-resources/learning-path',
        'part4-resources/tools',
        'part4-resources/faq',
      ],
    },
  ],
};

export default sidebars;