var breakable = (function() {
    "use strict";

    function Val(val) {
        this.val = val;
    }

    function brk(val) {
        throw new Val(val);
    }

    function breakable(fn) {
        try {
            return fn(brk);
        } catch (e) {
            if (e instanceof Val) {
                return e.val;
            }
            throw e;
        }
    }

    return breakable;
})();

module.exports = breakable;
