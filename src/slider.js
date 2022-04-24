import { DIRECTION } from './direction';

// const transitionDuration = 30000; // TODO increase
const transitionDuration = 2000; // TODO increase

export class Slider {
  // TODO add will-change here? still need will-change?

  constructor($el, direction) {
    this._$el = $el;
    this._direction = direction;
    this._transitionState = null;
  }

  setOffset(offset, rate, force) {
    const transitionState = this._transitionState;
    const rateChanged = !transitionState || transitionState.rate !== rate;
    if (transitionState && !force) {
      const timePassed = performance.now() - transitionState.time;
      // TODO
      // if (timePassed < transitionDuration - 10000 && !rateChanged) {
      if (timePassed < transitionDuration - 1000 && !rateChanged) {
        return;
      }
    }

    if (force || rateChanged) {
      if (this._direction === DIRECTION.RIGHT) {
        this._$el.style.transform = `translateX(${offset}px)`;
      } else {
        this._$el.style.transform = `translateY(${offset}px)`;
      }

      this._$el.style.transition = '';
      this._$el.offsetLeft;
    }

    if (rate && rateChanged) {
      this._$el.style.transition = `transform ${transitionDuration}ms linear`;
    }

    const futureOffset = offset + (rate / 1000) * transitionDuration;
    if (this._direction === DIRECTION.RIGHT) {
      this._$el.style.transform = `translateX(${futureOffset}px)`;
    } else {
      this._$el.style.transform = `translateY(${futureOffset}px)`;
    }

    this._transitionState = {
      time: performance.now(),
      rate,
    };
  }
}
