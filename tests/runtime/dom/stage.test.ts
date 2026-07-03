import { describe, expect, it } from 'vitest';
import {
  commitStage,
  mutate,
  mutateStructural,
  readStaged,
} from '../../../src/runtime/dom/stage.js';

describe('stage buffer', () => {
  it('stages a text write, not applied until commit', () => {
    const t = document.createTextNode('old');
    mutate(t, 'text', '', 'new');
    expect(t.data).toBe('old');
    commitStage();
    expect(t.data).toBe('new');
  });

  it('dedups by node+kind+name (last wins)', () => {
    const el = document.createElement('div');
    mutate(el, 'attr', 'class', 'a');
    mutate(el, 'attr', 'class', 'b');
    mutate(el, 'attr', 'class', 'c');
    commitStage();
    expect(el.getAttribute('class')).toBe('c');
  });

  it('readStaged returns pending value before commit', () => {
    const el = document.createElement('div');
    mutate(el, 'attr', 'id', 'x');
    expect(readStaged(el, 'attr', 'id')).toBe('x');
    commitStage();
    expect(readStaged(el, 'attr', 'id')).toBeUndefined();
  });

  it('applies boolean and property kinds', () => {
    const el = document.createElement('input') as HTMLInputElement;
    mutate(el, 'boolean', 'disabled', true);
    mutate(el, 'prop', 'value', 'hi');
    commitStage();
    expect(el.hasAttribute('disabled')).toBe(true);
    expect(el.value).toBe('hi');
  });

  it('applies structural insert in order after props', () => {
    const parent = document.createElement('ul');
    const li = document.createElement('li');
    li.textContent = 'item';
    mutateStructural({ kind: 'insert', parent, node: li, before: null });
    expect(parent.children.length).toBe(0);
    commitStage();
    expect(parent.children.length).toBe(1);
    expect(parent.firstElementChild?.textContent).toBe('item');
  });

  it('applies structural remove', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);
    mutateStructural({ kind: 'remove', node: child });
    commitStage();
    expect(parent.children.length).toBe(0);
  });
});
