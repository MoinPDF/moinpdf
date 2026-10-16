import { Extension, Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import Placeholder from '@tiptap/extension-placeholder';
import { localWriterImage } from './writer-model';

const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: 'div[data-writer-page-break]' }],
  renderHTML: () => [
    'div',
    { 'data-writer-page-break': '', class: 'writer-page-break', contenteditable: 'false' },
  ],
});
const ParagraphSpacing = Extension.create({
  name: 'paragraphSpacing',
  addGlobalAttributes: () => [
    {
      types: ['paragraph', 'heading'],
      attributes: {
        lineHeight: {
          default: 1.4,
          parseHTML: (el) => Math.min(2.5, Math.max(1, parseFloat(el.style.lineHeight) || 1.4)),
          renderHTML: (attrs) => ({ style: `line-height:${attrs.lineHeight}` }),
        },
      },
    },
  ],
});
const LocalImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      widthPercent: {
        default: 100,
        parseHTML: (el) =>
          Math.min(100, Math.max(10, Number(el.getAttribute('data-width-percent')) || 100)),
        renderHTML: (attrs) => ({
          'data-width-percent': attrs.widthPercent,
          style: `width:${attrs.widthPercent}%;height:auto`,
        }),
      },
    };
  },
  parseHTML: () => [
    {
      tag: 'img[src]',
      getAttrs: (el) => (localWriterImage((el as HTMLElement).getAttribute('src')) ? {} : false),
    },
  ],
  renderHTML({ HTMLAttributes }) {
    return [
      'img',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { draggable: 'false' }),
    ];
  },
}).configure({ allowBase64: true });

export function writerExtensions(placeholder = '') {
  return [
    StarterKit.configure({
      code: false,
      codeBlock: false,
      link: false,
      heading: { levels: [1, 2, 3] },
    }),
    TextStyleKit.configure({ lineHeight: false }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    LocalImage,
    TableKit.configure({ table: { resizable: false } }),
    ParagraphSpacing,
    PageBreak,
    Placeholder.configure({ placeholder }),
  ];
}
