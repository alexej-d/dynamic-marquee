export class SizeWatcher {
  constructor($el) {
    this._$el = $el;
    this._width = null;
    this._height = null;
    let hack = false;
    this._observer =
      'ResizeObserver' in window
        ? new ResizeObserver((entries) => {
            const entry = entries[entries.length - 1];
            const size = entry.borderBoxSize[0] || entry.borderBoxSize;
            if (hack)
              // console.log(
              //   'ah',
              //   this._width,
              //   size.inlineSize,
              //   this._$el.offsetWidth
              // );
              // this._width = size.inlineSize;
              this._width = this._$el.offsetWidth;
            // this._height = size.blockSize;
            this._height = this._$el.offsetHeight;
          })
        : null;
    this._observer?.observe($el);
    // TODO how get actual size before this
    // https://drafts.csswg.org/resize-observer/#resize-observer-interface
    // let ro = new ResizeObserver((entries) => {
    //   for (let entry of entries) {
    //     let cs = window.getComputedStyle(entry.target);
    //     console.log('watching element:', entry.target);
    //     console.log(entry.contentRect.top, ' is ', cs.paddingTop);
    //     console.log(entry.contentRect.left, ' is ', cs.paddingLeft);
    //     console.log(entry.borderBoxSize[0].inlineSize, ' is ', cs.width);
    //     console.log(entry.borderBoxSize[0].blockSize, ' is ', cs.height);
    //     if (entry.target.handleResize) entry.target.handleResize(entry);
    //   }
    // });
    hack = true;
  }
  getWidth() {
    return this._width ?? this._$el.offsetWidth;
  }
  getHeight() {
    return this._height ?? this._$el.offsetHeight;
  }
  tearDown() {
    this._observer?.disconnect();
  }
}
