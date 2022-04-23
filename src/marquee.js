import { Item, VirtualItem } from './item.js';
import { DIRECTION } from './direction.js';
import { defer, deferException, toDomEl } from './helpers.js';
import { SizeWatcher } from './size-watcher.js';

// TODO check
// - what happens when empty
// - what happens when change direction
// - when resize
// - when tab frozen

// TODO change so that there is a correlation that is fixed, and offsets of items are based off that and also fixed. Resync if hitting max int

// TODO if container size is 0 pretend rate is 0?
export class Marquee {
  constructor(
    $container,
    {
      // pixels/s
      rate = -25,
      // make the direction down instead of right
      upDown = false,
      // start on screen
      startOnScreen = false,
    } = {}
  ) {
    this._waitingForItem = true;
    this._nextItemImmediatelyFollowsPrevious = startOnScreen;
    this._rate = rate;
    this._lastRate = 0;
    this._lastEffectiveRate = rate;
    this._justReversedRate = false;
    this._correlation = null;
    // TODO needed? also check other props
    this._lastUpdateTime = null;
    this._direction = upDown ? DIRECTION.DOWN : DIRECTION.RIGHT;
    this._onItemRequired = [];
    this._onItemRemoved = [];
    this._onAllItemsRemoved = [];
    this._windowOffset = 0;
    this._containerSize = 0;
    this._previousContainerSize = null;
    this._containerSizeWatcher = null;
    this._items = [];
    this._pendingItem = null;
    const $innerContainer = document.createElement('div');
    $innerContainer.style.position = 'relative';
    $innerContainer.style.display = 'inline-block';
    this._$container = $innerContainer;
    this._containerInverseSize = null;
    $innerContainer.style.width = '100%';
    if (this._direction === DIRECTION.DOWN) {
      $innerContainer.style.height = '100%';
    }
    this._updateContainerInverseSize();
    $container.appendChild($innerContainer);
  }

  // called when there's room for a new item.
  // You can return the item to append next
  onItemRequired(cb) {
    this._onItemRequired.push(cb);
  }

  // Called when an item is removed
  onItemRemoved(cb) {
    this._onItemRemoved.push(cb);
  }

  // Called when the last item is removed
  onAllItemsRemoved(cb) {
    this._onAllItemsRemoved.push(cb);
  }

  getNumItems() {
    return this._items.filter(({ item }) => item instanceof Item).length;
  }

  setRate(rate) {
    if (rate === this._rate) {
      return;
    }

    if (!rate !== !this._rate) {
      this._enableAnimationHint(!!rate);
    }

    if (rate * this._lastEffectiveRate < 0) {
      this._justReversedRate = !this._justReversedRate;

      if (this._items) {
        const firstItem = this._items[0];
        const lastItem = this._items[this._items.length - 1];
        // TODO extract common logic
        this._waitingForItem =
          (this._rate <= 0 &&
            this._windowOffset + lastItem.offset + lastItem.item.getSize() <=
              containerSize) ||
          (this._rate > 0 && this._windowOffset - firstItem.offset > 0);
        this._nextItemImmediatelyFollowsPrevious = false;
      }
    }

    this._rate = rate;
    if (rate) {
      this._lastEffectiveRate = rate;
    }

    this._tick();
  }

  getRate() {
    return this._rate;
  }

  clear() {
    this._items.forEach(({ item }) => this._removeItem(item));
    this._items = [];
    this._waitingForItem = true;
    this._nextItemImmediatelyFollowsPrevious = false;
    this._updateContainerInverseSize();
  }

  isWaitingForItem() {
    return this._waitingForItem;
  }

  appendItem($el) {
    if (!this._waitingForItem) {
      throw new Error('No room for item.');
    }
    // convert to div if $el is a string
    $el = toDomEl($el);
    const itemAlreadyExists = this._items.some(({ item }) => {
      return item instanceof Item && item.getOriginalEl() === $el;
    });
    if (itemAlreadyExists) {
      throw new Error('Item already exists.');
    }
    this._waitingForItem = false;
    this._pendingItem = new Item($el, this._direction);
    this._pendingItem.enableAnimationHint(!!this._rate);
    this._tick();
  }

  _removeItem(item) {
    defer(() => {
      item.remove();
      if (item instanceof Item) {
        this._onItemRemoved.forEach((cb) => {
          deferException(() => cb(item.getOriginalEl()));
        });
      }
    });
  }

  // update size of container so that the marquee items fit inside it.
  // This is needed because the items are posisitioned absolutely, so not in normal flow.
  // Without this, for DIRECTION.RIGHT, the height of the container would always be 0px, which is not useful
  _updateContainerInverseSize() {
    if (this._direction === DIRECTION.DOWN) {
      return;
    }

    const maxSize = this._items.reduce((size, { item }) => {
      if (item instanceof VirtualItem) {
        return size;
      }
      const a = item.getSize({ inverse: true });
      if (a > size) {
        return a;
      }
      return size;
    }, 0);

    if (this._containerInverseSize !== maxSize) {
      this._containerInverseSize = maxSize;
      this._$container.style.height = `${maxSize}px`;
    }
  }

  _enableAnimationHint(enable) {
    this._items.forEach(({ item }) => item.enableAnimationHint(enable));
  }

  _scheduleRender() {
    if (!this._renderTimer) {
      // ideally we'd use requestAnimationFrame here but there's a bug in
      // chrome which means when the callback is called it triggers a style
      // recalculation even when nothing changes, which is not efficient
      // see https://bugs.chromium.org/p/chromium/issues/detail?id=1252311
      // and https://stackoverflow.com/q/69293778/1048589
      this._renderTimer = window.setTimeout(() => this._tick(), 100);
    }
  }

  _cleanup() {
    this._containerSizeWatcher.tearDown();
    this._containerSizeWatcher = null;
    this._lastUpdateTime = null;
  }

  // TODO move this into _render?
  _tick() {
    this._renderTimer && clearTimeout(this._renderTimer);
    this._renderTimer = null;

    if (!this._items.length && !this._pendingItem) {
      this._cleanup();
      return;
    }

    if (!this._containerSizeWatcher) {
      this._containerSizeWatcher = new SizeWatcher(this._$container);
    }

    const now = performance.now();

    if (this._correlation) {
      const timePassed = now - this._correlation.time;
      this._windowOffset =
        this._correlation.offset + this._lastRate * -1 * (timePassed / 1000);
    }

    if (!this._correlation || this._rate !== this._lastRate) {
      this._correlation = {
        time: now,
        offset: this._windowOffset,
      };
    }

    this._lastRate = this._rate;
    this._containerSize =
      this._direction === DIRECTION.RIGHT
        ? this._containerSizeWatcher.getWidth()
        : this._containerSizeWatcher.getHeight();

    // TODO
    // if (this._containerSize > 0) {
    deferException(() => this._render());
    // }

    this._scheduleRender();
  }

  _render() {
    const containerSize = this._containerSize;
    const containerSizeChanged = containerSize !== this._previousContainerSize;
    this._previousContainerSize = containerSize;

    this._items = this._items.filter(({ item, offset }) => {
      const keep =
        this._rate < 0
          ? offset + item.getSize() - this._windowOffset > 0
          : offset - this._windowOffset < containerSize;
      if (!keep) this._removeItem(item); // TODO defer callback out with my other lib
      return keep;
    });

    const justReversedRate = this._justReversedRate;
    this._justReversedRate = false;
    if (justReversedRate) {
      this._nextItemImmediatelyFollowsPrevious = false;
    }

    if (this._pendingItem) {
      this._$container.appendChild(this._pendingItem.getContainer());
      if (this._rate <= 0) {
        // TODO scrap virtual item
        // console.log('!!', containerSize);
        this._items = [
          ...this._items,
          {
            item: this._pendingItem,
            offset: this._windowOffset + containerSize,
          },
        ];
      } else {
        this._items = [
          {
            item: this._pendingItem,
            offset: this._windowOffset - this._pendingItem.getSize(),
          },
          ...this._items,
        ];
      }
      this._pendingItem = null;
    }

    if (!this._items.length) {
      defer(() => {
        this._onAllItemsRemoved.forEach((cb) => {
          deferException(() => cb());
        });
      });
    }

    this._items.reduce((newOffset, item) => {
      let changed = false;
      // console.log('!!', item.offset);
      if (newOffset !== null && item.offset < newOffset) {
        // the size of the item before has increased and would now be overlapping
        // this one, so shuffle this one along
        // TODO
        // changed = true;
        // item.offset = newOffset;
      }
      const jumped = containerSizeChanged || changed;
      // setTimeout(() => {
      // const liveWindowOffset =
      //   this._correlation.offset +
      //   this._rate * ((performance.now() - this._correlation.time) / 1000);
      // item.item.setOffset(liveWindowOffset + item.offset, this._rate, jumped);

      item.item.setOffset(
        () =>
          item.offset -
          (this._correlation.offset +
            this._rate *
              -1 *
              ((performance.now() - this._correlation.time) / 1000)),
        // () => item.offset - this._windowOffset,
        this._rate,
        jumped
      );
      // }, 0);
      return item.offset + item.item.getSize();
    }, null);

    this._updateContainerInverseSize();

    this._nextItemImmediatelyFollowsPrevious = false;

    if (!this._waitingForItem) {
      if (this._items.length) {
        const firstItem = this._items[0];
        const lastItem = this._items[this._items.length - 1];
        if (
          (this._rate <= 0 &&
            lastItem.offset + lastItem.item.getSize() - this._windowOffset <=
              containerSize) ||
          (this._rate > 0 && firstItem.offset - this._windowOffset > 0)
        ) {
          this._waitingForItem = true;
          // if an item is appended immediately below, it would be considered immediately following
          // the previous if we haven't just changed direction.
          // This is useful when deciding whether to add a separator on the side that enters the
          // screen first or not
          this._nextItemImmediatelyFollowsPrevious = !justReversedRate;
        }
      } else {
        this._waitingForItem = true;
        this._nextItemImmediatelyFollowsPrevious = false;
      }

      if (this._waitingForItem) {
        let nextItem;
        this._onItemRequired.some((cb) => {
          return deferException(() => {
            nextItem = cb({
              immediatelyFollowsPrevious:
                this._nextItemImmediatelyFollowsPrevious,
            });
            return !!nextItem;
          });
        });
        if (nextItem) {
          // TODO
          // Note appendItem() will call _render() synchronously again
          this.appendItem(nextItem);
        }
        this._nextItemImmediatelyFollowsPrevious = false;
      }
    }
  }
}
