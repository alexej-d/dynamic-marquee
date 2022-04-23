import { DIRECTION } from './direction.js';
import { SizeWatcher } from './size-watcher.js';

// const transitionDuration = 12000; // TODO
// const transitionDuration = 60000; // TODO
const transitionDuration = 3000; // TODO

export class Item {
  constructor($el, direction) {
    const $container = document.createElement('div');
    $container.style.display = 'block';
    $container.style.position = 'absolute';
    $container.style.margin = '0';
    $container.style.padding = '0';
    if (direction === DIRECTION.RIGHT) {
      $container.style.whiteSpace = 'nowrap';
    }
    $container.style.willChange = 'auto';
    this._sizeWatcher = new SizeWatcher($container);
    $container.appendChild($el);

    this._$container = $container;
    this._$el = $el;
    this._direction = direction;
    this._transitionState = null;
  }
  getSize({ inverse = false } = {}) {
    let dir = this._direction;
    if (inverse) {
      dir = dir === DIRECTION.RIGHT ? DIRECTION.DOWN : DIRECTION.RIGHT;
    }
    return dir === DIRECTION.RIGHT
      ? this._sizeWatcher.getWidth()
      : this._sizeWatcher.getHeight();
  }
  setOffset(getOffset, rate, force) {
    // TODO try `left` instead to see if it's gpu optimisation breaking  it
    // TODO try using get computed styles to see if drifted and force then to fix
    // force = true; // TODO remove
    const transitionState = this._transitionState;
    const rateChanged = !transitionState || transitionState.rate !== rate;
    if (transitionState && !force) {
      const timePassed = performance.now() - transitionState.time;
      // if (timePassed < transitionDuration - 10000 && !rateChanged) {
      if (timePassed < transitionDuration - 1000 && !rateChanged) {
        return;
      }
    }

    force = true; // TODO

    let offset = null;

    if (force || rateChanged) {
      const hack = getOffset();

      // TODO explain this might force element to be appended
      this._$container.offsetLeft;

      // for (let i = 0; i < 2; i++) {
      offset = getOffset();
      if (this._direction === DIRECTION.RIGHT) {
        // console.log('!!', hack - offset);

        this._$container.style.left = `${offset}px`;
        // this._$container.style.transform = `translateX(${offset}px)`;
      } else {
        this._$container.style.transform = `translateY(${offset}px)`;
      }

      this._$container.style.transition = `left 1ms linear`;
      // this._$container.style.transition = '';
      // console.time('reflow1');
      this._$container.offsetLeft;
      // console.timeEnd('reflow1');
      // console.time('reflow2');
      // this._$container.offsetLeft;
      // console.timeEnd('reflow2');
      // }
    }

    if (rate) {
      // this._$container.style.transition = `transform ${transitionDuration}ms linear`;
      // this._$container.style.transition = `left ${transitionDuration}ms linear`;`;
      this._$container.style.transition = `left ${transitionDuration}ms linear`;
      // this._$container.style.transitionDelay = `1s`;
    }

    if (offset === null) offset = getOffset();

    const futureOffset = offset + (rate / 1000) * transitionDuration;
    if (this._direction === DIRECTION.RIGHT) {
      // this._$container.style.transform = `translateX(${futureOffset}px)`;
      this._$container.style.left = `${futureOffset}px`;
    } else {
      this._$container.style.transform = `translateY(${futureOffset}px)`;
    }

    // this._$container.offsetLeft;

    this._transitionState = {
      time: performance.now(),
      rate,
    };
  }
  enableAnimationHint(enable) {
    // this._$container.style.willChange = enable ? 'transform' : 'auto';
  }
  remove() {
    this._sizeWatcher.tearDown();
    this._$container.parentNode.removeChild(this._$container);
  }
  getContainer() {
    return this._$container;
  }
  getOriginalEl() {
    return this._$el;
  }
}

export class VirtualItem {
  constructor(size) {
    this._size = size;
  }
  getSize({ inverse = false } = {}) {
    if (inverse) {
      throw new Error('Inverse not supported on virtual item.');
    }
    return this._size;
  }
  setOffset() {}
  enableAnimationHint() {}
  remove() {}
}
