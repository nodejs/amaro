var _call_x, _initProto;
const dec = () => { };
class Foo extends Bar {
  static {
    [_call_x, _initProto] = _applyDecs2203R(this, [[dec, 2, "x", function () {
      return Bar.prototype.foo.call(this);
    }]], []).e;
  }
  constructor(...args) {
    super(...args);
    _initProto(this);
  }
  #x = _call_x;
}