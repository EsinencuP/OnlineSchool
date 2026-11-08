import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Dialog, Drawer, ConfirmDialog, Popover, DropdownMenu } from '../dist/index.js';
for (const Component of [Dialog, Drawer, ConfirmDialog, Popover, DropdownMenu])
  test(`${Component.render.name}: closed SSR does not emit private subtree or execute callbacks`, () => {
    let calls = 0;
    const html = renderToStaticMarkup(
      h(
        Component,
        {
          open: false,
          onOpenChange: () => calls++,
          onConfirm: () => calls++,
          title: 'Title',
          description: 'Description',
          confirmLabel: 'Confirm',
          cancelLabel: 'Cancel',
          label: 'Actions',
          items: [],
          trigger: h('button', null, 'Open'),
        },
        h('input', { defaultValue: 'SYNTHETIC_PRIVATE_CONTENT' }),
      ),
    );
    assert.doesNotMatch(
      html,
      /SYNTHETIC_PRIVATE_CONTENT|<input|role="(?:dialog|alertdialog|menu)"/,
    );
    assert.match(html, /aria-expanded="false"/);
    assert.equal(calls, 0);
  });
