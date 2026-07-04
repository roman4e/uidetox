import { defineBehaviorTrait } from '../traits/define.js';
import { attachDraggable, type DraggableParams } from './draggable.js';
import { attachDroppable, type DroppableParams } from './droppable.js';
import { attachSortable, attachSortableItem } from './sortable.js';

/**
 * Registers the drag & drop traits: `draggable`, `droppable`, `sortable`,
 * `sortable-item`. Call once at app startup. Idempotent.
 */
export function registerDnd(): void {
  defineBehaviorTrait('draggable', ['*'], (el, params) =>
    attachDraggable(el, params as DraggableParams));
  defineBehaviorTrait('droppable', ['*'], (el, params) =>
    attachDroppable(el, params as DroppableParams));
  defineBehaviorTrait('sortable', ['*'], (el, params) =>
    attachSortable(el, params));
  defineBehaviorTrait('sortable-item', ['*'], (el) =>
    attachSortableItem(el));
}
