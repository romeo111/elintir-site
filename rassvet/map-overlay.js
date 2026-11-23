(() => {
  // node_modules/pbf/index.js
  var SHIFT_LEFT_32 = (1 << 16) * (1 << 16);
  var SHIFT_RIGHT_32 = 1 / SHIFT_LEFT_32;
  var TEXT_DECODER_MIN_LENGTH = 12;
  var TEXT_DECODER_MIN_LENGTH_NON_ASCII = 32;
  var utf8TextDecoder = new TextDecoder();
  var PBF_VARINT = 0;
  var PBF_FIXED64 = 1;
  var PBF_BYTES = 2;
  var PBF_FIXED32 = 5;
  var PbfReader = class {
    /**
     * @param {Uint8Array | ArrayBuffer} buf
     */
    constructor(buf) {
      this.buf = ArrayBuffer.isView(buf) ? buf : new Uint8Array(buf);
      this.dataView = new DataView(this.buf.buffer, this.buf.byteOffset, this.buf.byteLength);
      this.pos = 0;
      this.type = 0;
      this._valueStart = -1;
      this.length = this.buf.length;
    }
    /**
     * @template T
     * @param {(tag: number, result: T, pbf: PbfReader) => void} readField
     * @param {T} result
     * @param {number} [end]
     */
    readFields(readField, result, end = this.length) {
      let field;
      while (field = this.nextField(end)) {
        readField(field, result, this);
      }
      return result;
    }
    /**
     * @template T
     * @param {(tag: number, result: T, pbf: PbfReader) => void} readField
     * @param {T} result
     */
    readMessage(readField, result) {
      return this.readFields(readField, result, this.readVarint() + this.pos);
    }
    readFixed32() {
      const val = this.dataView.getUint32(this.pos, true);
      this.pos += 4;
      return val;
    }
    readSFixed32() {
      const val = this.dataView.getInt32(this.pos, true);
      this.pos += 4;
      return val;
    }
    // 64-bit int handling is based on github.com/dpw/node-buffer-more-ints (MIT-licensed)
    readFixed64() {
      const val = this.dataView.getUint32(this.pos, true) + this.dataView.getUint32(this.pos + 4, true) * SHIFT_LEFT_32;
      this.pos += 8;
      return val;
    }
    readSFixed64() {
      const val = this.dataView.getUint32(this.pos, true) + this.dataView.getInt32(this.pos + 4, true) * SHIFT_LEFT_32;
      this.pos += 8;
      return val;
    }
    readFloat() {
      const val = this.dataView.getFloat32(this.pos, true);
      this.pos += 4;
      return val;
    }
    readDouble() {
      const val = this.dataView.getFloat64(this.pos, true);
      this.pos += 8;
      return val;
    }
    /**
     * @param {boolean} [isSigned]
     */
    readVarint(isSigned) {
      const buf = this.buf;
      const b0 = buf[this.pos++];
      if (b0 < 128) return b0;
      let val = b0 & 127, b;
      b = buf[this.pos++];
      val |= (b & 127) << 7;
      if (b < 128) return val;
      b = buf[this.pos++];
      val |= (b & 127) << 14;
      if (b < 128) return val;
      b = buf[this.pos++];
      val |= (b & 127) << 21;
      if (b < 128) return val;
      b = buf[this.pos];
      val |= (b & 15) << 28;
      return readVarintRemainder(val, isSigned, this);
    }
    readSVarint() {
      const num = this.readVarint();
      return num % 2 === 1 ? (num + 1) / -2 : num / 2;
    }
    readBoolean() {
      return Boolean(this.readVarint());
    }
    readString() {
      const end = this.readVarint() + this.pos;
      const pos = this.pos;
      this.pos = end;
      const len = end - pos;
      if (len >= (this.buf[pos] < 128 ? TEXT_DECODER_MIN_LENGTH : TEXT_DECODER_MIN_LENGTH_NON_ASCII)) {
        return utf8TextDecoder.decode(this.buf.subarray(pos, end));
      }
      return readUtf8(this.buf, pos, end);
    }
    readBytes() {
      const end = this.readVarint() + this.pos, buffer = this.buf.subarray(this.pos, end);
      this.pos = end;
      return buffer;
    }
    // verbose for performance reasons; doesn't affect gzipped size
    /**
     * @param {number[]} [arr]
     * @param {boolean} [isSigned]
     */
    readPackedVarint(arr = [], isSigned) {
      const end = this.readPackedEnd();
      const buf = this.buf;
      let pos = this.pos;
      while (pos < end) {
        const b0 = buf[pos];
        if (b0 < 128) {
          arr.push(b0);
          pos++;
          continue;
        }
        const b1 = buf[pos + 1];
        if (b1 < 128) {
          arr.push(b0 & 127 | b1 << 7);
          pos += 2;
          continue;
        }
        this.pos = pos;
        arr.push(this.readVarint(isSigned));
        pos = this.pos;
      }
      this.pos = pos;
      return arr;
    }
    /** @param {number[]} [arr] */
    readPackedSVarint(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readSVarint());
      return arr;
    }
    /** @param {boolean[]} [arr] */
    readPackedBoolean(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readBoolean());
      return arr;
    }
    /** @param {number[]} [arr] */
    readPackedFloat(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readFloat());
      return arr;
    }
    /** @param {number[]} [arr] */
    readPackedDouble(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readDouble());
      return arr;
    }
    /** @param {number[]} [arr] */
    readPackedFixed32(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readFixed32());
      return arr;
    }
    /** @param {number[]} [arr] */
    readPackedSFixed32(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readSFixed32());
      return arr;
    }
    /** @param {number[]} [arr] */
    readPackedFixed64(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readFixed64());
      return arr;
    }
    /** @param {number[]} [arr] */
    readPackedSFixed64(arr = []) {
      const end = this.readPackedEnd();
      while (this.pos < end) arr.push(this.readSFixed64());
      return arr;
    }
    readPackedEnd() {
      return this.type === PBF_BYTES ? this.readVarint() + this.pos : this.pos + 1;
    }
    /**
     * Advance to the next field. Returns the field number, or 0 at end-of-message.
     * @param {number} [end]
     */
    nextField(end = this.length) {
      if (this.pos === this._valueStart) this.skip(this.type);
      if (this.pos >= end) return 0;
      const tag = this.readVarint();
      this.type = tag & 7;
      this._valueStart = this.pos;
      return tag >>> 3;
    }
    /** @param {number} val */
    skip(val) {
      const type = val & 7;
      if (type === PBF_VARINT) while (this.buf[this.pos++] > 127) {
      }
      else if (type === PBF_BYTES) this.pos = this.readVarint() + this.pos;
      else if (type === PBF_FIXED32) this.pos += 4;
      else if (type === PBF_FIXED64) this.pos += 8;
      else throw new Error(`Unimplemented type: ${type}`);
    }
  };
  function readVarintRemainder(l, s, p) {
    const buf = p.buf;
    let h, b;
    b = buf[p.pos++];
    h = (b & 112) >> 4;
    if (b < 128) return toNum(l, h, s);
    b = buf[p.pos++];
    h |= (b & 127) << 3;
    if (b < 128) return toNum(l, h, s);
    b = buf[p.pos++];
    h |= (b & 127) << 10;
    if (b < 128) return toNum(l, h, s);
    b = buf[p.pos++];
    h |= (b & 127) << 17;
    if (b < 128) return toNum(l, h, s);
    b = buf[p.pos++];
    h |= (b & 127) << 24;
    if (b < 128) return toNum(l, h, s);
    b = buf[p.pos++];
    h |= (b & 1) << 31;
    if (b < 128) return toNum(l, h, s);
    throw new Error("Expected varint not more than 10 bytes");
  }
  function toNum(low, high, isSigned) {
    return isSigned ? high * 4294967296 + (low >>> 0) : (high >>> 0) * 4294967296 + (low >>> 0);
  }
  function readUtf8(buf, pos, end) {
    let str = "";
    for (let i = pos; i < end; i++) {
      let c = buf[i];
      if (c > 127) {
        const b1 = buf[i + 1] ^ 128;
        const b2 = buf[i + 2] ^ 128;
        if (c >= 194 && c < 224 && b1 < 64 && i + 1 < end) {
          c = (c & 31) << 6 | b1;
          i++;
        } else if ((c & 240) === 224 && b1 < 64 && b2 < 64 && i + 2 < end && (c = (c & 15) << 12 | b1 << 6 | b2) >= 2048 && (c < 55296 || c > 57343)) {
          i += 2;
        } else {
          return utf8TextDecoder.decode(buf.subarray(pos, end));
        }
      }
      str += String.fromCharCode(c);
    }
    return str;
  }

  // node_modules/@mapbox/point-geometry/index.js
  function Point(x, y) {
    this.x = x;
    this.y = y;
  }
  Point.prototype = {
    /**
     * Clone this point, returning a new point that can be modified
     * without affecting the old one.
     * @return {Point} the clone
     */
    clone() {
      return new Point(this.x, this.y);
    },
    /**
     * Add this point's x & y coordinates to another point,
     * yielding a new point.
     * @param {Point} p the other point
     * @return {Point} output point
     */
    add(p) {
      return this.clone()._add(p);
    },
    /**
     * Subtract this point's x & y coordinates to from point,
     * yielding a new point.
     * @param {Point} p the other point
     * @return {Point} output point
     */
    sub(p) {
      return this.clone()._sub(p);
    },
    /**
     * Multiply this point's x & y coordinates by point,
     * yielding a new point.
     * @param {Point} p the other point
     * @return {Point} output point
     */
    multByPoint(p) {
      return this.clone()._multByPoint(p);
    },
    /**
     * Divide this point's x & y coordinates by point,
     * yielding a new point.
     * @param {Point} p the other point
     * @return {Point} output point
     */
    divByPoint(p) {
      return this.clone()._divByPoint(p);
    },
    /**
     * Multiply this point's x & y coordinates by a factor,
     * yielding a new point.
     * @param {number} k factor
     * @return {Point} output point
     */
    mult(k) {
      return this.clone()._mult(k);
    },
    /**
     * Divide this point's x & y coordinates by a factor,
     * yielding a new point.
     * @param {number} k factor
     * @return {Point} output point
     */
    div(k) {
      return this.clone()._div(k);
    },
    /**
     * Rotate this point around the 0, 0 origin by an angle a,
     * given in radians
     * @param {number} a angle to rotate around, in radians
     * @return {Point} output point
     */
    rotate(a) {
      return this.clone()._rotate(a);
    },
    /**
     * Rotate this point around p point by an angle a,
     * given in radians
     * @param {number} a angle to rotate around, in radians
     * @param {Point} p Point to rotate around
     * @return {Point} output point
     */
    rotateAround(a, p) {
      return this.clone()._rotateAround(a, p);
    },
    /**
     * Multiply this point by a 4x1 transformation matrix
     * @param {[number, number, number, number]} m transformation matrix
     * @return {Point} output point
     */
    matMult(m) {
      return this.clone()._matMult(m);
    },
    /**
     * Calculate this point but as a unit vector from 0, 0, meaning
     * that the distance from the resulting point to the 0, 0
     * coordinate will be equal to 1 and the angle from the resulting
     * point to the 0, 0 coordinate will be the same as before.
     * @return {Point} unit vector point
     */
    unit() {
      return this.clone()._unit();
    },
    /**
     * Compute a perpendicular point, where the new y coordinate
     * is the old x coordinate and the new x coordinate is the old y
     * coordinate multiplied by -1
     * @return {Point} perpendicular point
     */
    perp() {
      return this.clone()._perp();
    },
    /**
     * Return a version of this point with the x & y coordinates
     * rounded to integers.
     * @return {Point} rounded point
     */
    round() {
      return this.clone()._round();
    },
    /**
     * Return the magnitude of this point: this is the Euclidean
     * distance from the 0, 0 coordinate to this point's x and y
     * coordinates.
     * @return {number} magnitude
     */
    mag() {
      return Math.sqrt(this.x * this.x + this.y * this.y);
    },
    /**
     * Judge whether this point is equal to another point, returning
     * true or false.
     * @param {Point} other the other point
     * @return {boolean} whether the points are equal
     */
    equals(other) {
      return this.x === other.x && this.y === other.y;
    },
    /**
     * Calculate the distance from this point to another point
     * @param {Point} p the other point
     * @return {number} distance
     */
    dist(p) {
      return Math.sqrt(this.distSqr(p));
    },
    /**
     * Calculate the distance from this point to another point,
     * without the square root step. Useful if you're comparing
     * relative distances.
     * @param {Point} p the other point
     * @return {number} distance
     */
    distSqr(p) {
      const dx = p.x - this.x, dy = p.y - this.y;
      return dx * dx + dy * dy;
    },
    /**
     * Get the angle from the 0, 0 coordinate to this point, in radians
     * coordinates.
     * @return {number} angle
     */
    angle() {
      return Math.atan2(this.y, this.x);
    },
    /**
     * Get the angle from this point to another point, in radians
     * @param {Point} b the other point
     * @return {number} angle
     */
    angleTo(b) {
      return Math.atan2(this.y - b.y, this.x - b.x);
    },
    /**
     * Get the angle between this point and another point, in radians
     * @param {Point} b the other point
     * @return {number} angle
     */
    angleWith(b) {
      return this.angleWithSep(b.x, b.y);
    },
    /**
     * Find the angle of the two vectors, solving the formula for
     * the cross product a x b = |a||b|sin(θ) for θ.
     * @param {number} x the x-coordinate
     * @param {number} y the y-coordinate
     * @return {number} the angle in radians
     */
    angleWithSep(x, y) {
      return Math.atan2(
        this.x * y - this.y * x,
        this.x * x + this.y * y
      );
    },
    /** @param {[number, number, number, number]} m */
    _matMult(m) {
      const x = m[0] * this.x + m[1] * this.y, y = m[2] * this.x + m[3] * this.y;
      this.x = x;
      this.y = y;
      return this;
    },
    /** @param {Point} p */
    _add(p) {
      this.x += p.x;
      this.y += p.y;
      return this;
    },
    /** @param {Point} p */
    _sub(p) {
      this.x -= p.x;
      this.y -= p.y;
      return this;
    },
    /** @param {number} k */
    _mult(k) {
      this.x *= k;
      this.y *= k;
      return this;
    },
    /** @param {number} k */
    _div(k) {
      this.x /= k;
      this.y /= k;
      return this;
    },
    /** @param {Point} p */
    _multByPoint(p) {
      this.x *= p.x;
      this.y *= p.y;
      return this;
    },
    /** @param {Point} p */
    _divByPoint(p) {
      this.x /= p.x;
      this.y /= p.y;
      return this;
    },
    _unit() {
      this._div(this.mag());
      return this;
    },
    _perp() {
      const y = this.y;
      this.y = this.x;
      this.x = -y;
      return this;
    },
    /** @param {number} angle */
    _rotate(angle) {
      const cos = Math.cos(angle), sin = Math.sin(angle), x = cos * this.x - sin * this.y, y = sin * this.x + cos * this.y;
      this.x = x;
      this.y = y;
      return this;
    },
    /**
     * @param {number} angle
     * @param {Point} p
     */
    _rotateAround(angle, p) {
      const cos = Math.cos(angle), sin = Math.sin(angle), x = p.x + cos * (this.x - p.x) - sin * (this.y - p.y), y = p.y + sin * (this.x - p.x) + cos * (this.y - p.y);
      this.x = x;
      this.y = y;
      return this;
    },
    _round() {
      this.x = Math.round(this.x);
      this.y = Math.round(this.y);
      return this;
    },
    constructor: Point
  };
  Point.convert = function(p) {
    if (p instanceof Point) {
      return (
        /** @type {Point} */
        p
      );
    }
    if (Array.isArray(p)) {
      return new Point(+p[0], +p[1]);
    }
    if (p.x !== void 0 && p.y !== void 0) {
      return new Point(+p.x, +p.y);
    }
    throw new Error("Expected [x, y] or {x, y} point format");
  };

  // node_modules/@mapbox/vector-tile/index.js
  var VectorTileFeature = class {
    /**
     * @param {PbfReader} pbf
     * @param {number} end
     * @param {number} extent
     * @param {string[]} keys
     * @param {(number | string | boolean)[]} values
     */
    constructor(pbf, end, extent, keys, values) {
      this.properties = /* @__PURE__ */ Object.create(null);
      this.extent = extent;
      this.type = 0;
      this.id = void 0;
      this._pbf = pbf;
      this._geometry = -1;
      this._keys = keys;
      this._values = values;
      while (pbf.pos < end) {
        const tag = pbf.readVarint();
        if (tag === 8) this.id = pbf.readVarint();
        else if (tag === 18) {
          const tagsEnd = pbf.readVarint() + pbf.pos;
          while (pbf.pos < tagsEnd) {
            const key = keys[pbf.readVarint()];
            const value = values[pbf.readVarint()];
            this.properties[key] = value;
          }
        } else if (tag === 24) this.type = /** @type {0 | 1 | 2 | 3} */
        pbf.readVarint();
        else if (tag === 34) {
          this._geometry = pbf.pos;
          pbf.skip(tag);
        } else pbf.skip(tag);
      }
    }
    loadGeometry() {
      if (this._geometry < 0) throw new Error("feature has no geometry");
      const pbf = this._pbf;
      pbf.pos = this._geometry;
      const end = pbf.readVarint() + pbf.pos;
      const lines = [];
      let line;
      let cmd = 1;
      let length = 0;
      let x = 0;
      let y = 0;
      while (pbf.pos < end) {
        if (length <= 0) {
          const cmdLen = pbf.readVarint();
          cmd = cmdLen & 7;
          length = cmdLen >> 3;
          if (length === 0) continue;
        }
        length--;
        if (cmd === 1) {
          x += pbf.readSVarint();
          y += pbf.readSVarint();
          if (line) lines.push(line);
          line = [new Point(x, y)];
        } else if (cmd === 2) {
          x += pbf.readSVarint();
          y += pbf.readSVarint();
          if (line) line.push(new Point(x, y));
        } else if (cmd === 7) {
          if (line) {
            line.push(line[0].clone());
          }
        } else {
          throw new Error(`unknown command ${cmd}`);
        }
      }
      if (line) lines.push(line);
      return lines;
    }
    bbox() {
      if (this._geometry < 0) throw new Error("feature has no geometry");
      const pbf = this._pbf;
      pbf.pos = this._geometry;
      const end = pbf.readVarint() + pbf.pos;
      let cmd = 1, length = 0, x = 0, y = 0, x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
      while (pbf.pos < end) {
        if (length <= 0) {
          const cmdLen = pbf.readVarint();
          cmd = cmdLen & 7;
          length = cmdLen >> 3;
          if (length === 0) continue;
        }
        length--;
        if (cmd === 1 || cmd === 2) {
          x += pbf.readSVarint();
          y += pbf.readSVarint();
          if (x < x1) x1 = x;
          if (x > x2) x2 = x;
          if (y < y1) y1 = y;
          if (y > y2) y2 = y;
        } else if (cmd !== 7) {
          throw new Error(`unknown command ${cmd}`);
        }
      }
      return [x1, y1, x2, y2];
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @return {Feature}
     */
    toGeoJSON(x, y, z) {
      const size = this.extent * Math.pow(2, z), x0 = this.extent * x, y0 = this.extent * y, vtCoords = this.loadGeometry();
      function projectPoint(p) {
        return [
          (p.x + x0) * 360 / size - 180,
          360 / Math.PI * Math.atan(Math.exp((1 - (p.y + y0) * 2 / size) * Math.PI)) - 90
        ];
      }
      function projectLine(line) {
        return line.map(projectPoint);
      }
      let geometry;
      if (this.type === 1) {
        const points = [];
        for (const line of vtCoords) {
          points.push(line[0]);
        }
        const coordinates = projectLine(points);
        geometry = points.length === 1 ? { type: "Point", coordinates: coordinates[0] } : { type: "MultiPoint", coordinates };
      } else if (this.type === 2) {
        const coordinates = vtCoords.map(projectLine);
        geometry = coordinates.length === 1 ? { type: "LineString", coordinates: coordinates[0] } : { type: "MultiLineString", coordinates };
      } else if (this.type === 3) {
        const polygons = classifyRings(vtCoords);
        const coordinates = [];
        for (const polygon of polygons) {
          coordinates.push(polygon.map(projectLine));
        }
        geometry = coordinates.length === 1 ? { type: "Polygon", coordinates: coordinates[0] } : { type: "MultiPolygon", coordinates };
      } else {
        throw new Error("unknown feature type");
      }
      const result = {
        type: "Feature",
        geometry,
        properties: this.properties
      };
      if (this.id != null) {
        result.id = this.id;
      }
      return result;
    }
  };
  VectorTileFeature.types = ["Unknown", "Point", "LineString", "Polygon"];
  function classifyRings(rings) {
    const len = rings.length;
    if (len <= 1) return [rings];
    const polygons = [];
    let polygon, ccw;
    for (let i = 0; i < len; i++) {
      const area = signedArea(rings[i]);
      if (area === 0) continue;
      if (ccw === void 0) ccw = area < 0;
      if (ccw === area < 0) {
        if (polygon) polygons.push(polygon);
        polygon = [rings[i]];
      } else if (polygon) {
        polygon.push(rings[i]);
      }
    }
    if (polygon) polygons.push(polygon);
    return polygons;
  }
  function signedArea(ring) {
    let sum = 0;
    for (let i = 0, len = ring.length, j = len - 1, p1, p2; i < len; j = i++) {
      p1 = ring[i];
      p2 = ring[j];
      sum += (p2.x - p1.x) * (p1.y + p2.y);
    }
    return sum;
  }
  var VectorTileLayer = class {
    /**
     * @param {PbfReader} pbf
     * @param {number} [end]
     */
    constructor(pbf, end) {
      this.version = 1;
      this.name = "";
      this.extent = 4096;
      this.length = 0;
      this._pbf = pbf;
      this._keys = [];
      this._values = [];
      this._features = [];
      if (end === void 0) end = pbf.length;
      while (pbf.pos < end) {
        const tag = pbf.readVarint();
        if (tag === 10) this.name = pbf.readString();
        else if (tag === 18) {
          this._features.push(pbf.pos);
          pbf.skip(tag);
        } else if (tag === 26) this._keys.push(pbf.readString());
        else if (tag === 34) this._values.push(readValueMessage(pbf));
        else if (tag === 40) this.extent = pbf.readVarint();
        else if (tag === 120) this.version = pbf.readVarint();
        else pbf.skip(tag);
      }
      this.length = this._features.length;
    }
    /** return feature `i` from this layer as a `VectorTileFeature`
     * @param {number} i
     */
    feature(i) {
      if (i < 0 || i >= this._features.length) throw new Error("feature index out of bounds");
      this._pbf.pos = this._features[i];
      const end = this._pbf.readVarint() + this._pbf.pos;
      return new VectorTileFeature(this._pbf, end, this.extent, this._keys, this._values);
    }
  };
  function readValueMessage(pbf) {
    let value = null;
    const end = pbf.readVarint() + pbf.pos;
    while (pbf.pos < end) {
      const tag = pbf.readVarint();
      value = tag === 10 ? pbf.readString() : tag === 21 ? pbf.readFloat() : tag === 25 ? pbf.readDouble() : tag === 32 ? pbf.readVarint(true) : tag === 40 ? pbf.readVarint() : tag === 48 ? pbf.readSVarint() : tag === 56 ? pbf.readBoolean() : (pbf.skip(tag), null);
    }
    if (value == null) {
      throw new Error("unknown feature value");
    }
    return value;
  }
  var VectorTile = class {
    /**
     * @param {PbfReader} pbf
     * @param {number} [end]
     */
    constructor(pbf, end = pbf.length) {
      const layers = /* @__PURE__ */ Object.create(null);
      while (pbf.pos < end) {
        const tag = pbf.readVarint();
        if (tag === 26) {
          const layer = new VectorTileLayer(pbf, pbf.readVarint() + pbf.pos);
          if (layer.length) layers[layer.name] = layer;
        } else pbf.skip(tag);
      }
      this.layers = layers;
    }
  };

  // tools/map-overlay-source.mjs
  var templatePromise;
  var tileCache = /* @__PURE__ */ new Map();
  var ROAD_CLASSES = /* @__PURE__ */ new Set(["motorway", "trunk", "primary", "secondary"]);
  var PLACE_CLASSES = /* @__PURE__ */ new Set(["city", "town", "village", "suburb"]);
  async function tileTemplate() {
    if (!templatePromise) {
      templatePromise = fetch("https://tiles.openfreemap.org/planet").then((response) => {
        if (!response.ok) throw Error(`\u041A\u0430\u0440\u0442\u0430: HTTP ${response.status}`);
        return response.json();
      }).then((tilejson) => {
        const template = tilejson.tiles?.[0];
        if (!template?.startsWith("https://tiles.openfreemap.org/"))
          throw Error("\u041D\u0435\u0432\u0456\u0434\u043E\u043C\u0435 \u0434\u0436\u0435\u0440\u0435\u043B\u043E \u0442\u0430\u0439\u043B\u0456\u0432 \u043A\u0430\u0440\u0442\u0438");
        return template;
      }).catch((error) => {
        templatePromise = null;
        throw error;
      });
    }
    return templatePromise;
  }
  async function loadTile(tile, template, signal) {
    const key = `${tile.z}/${tile.x}/${tile.y}`;
    if (tileCache.has(key)) return tileCache.get(key);
    const url = template.replace("{z}", tile.z).replace("{x}", tile.x).replace("{y}", tile.y);
    const response = await fetch(url, { signal, mode: "cors" });
    if (!response.ok) throw Error(`\u041A\u0430\u0440\u0442\u0430: HTTP ${response.status}`);
    const vector = new VectorTile(new PbfReader(new Uint8Array(await response.arrayBuffer())));
    const roads = [], places = [];
    const roadLayer = vector.layers.transportation;
    if (roadLayer) for (let i = 0; i < roadLayer.length; i++) {
      const feature = roadLayer.feature(i);
      if (!ROAD_CLASSES.has(feature.properties.class)) continue;
      const geometry = feature.toGeoJSON(tile.x, tile.y, tile.z).geometry;
      if (geometry.type === "LineString")
        roads.push({ class: feature.properties.class, paths: [geometry.coordinates] });
      else if (geometry.type === "MultiLineString")
        roads.push({ class: feature.properties.class, paths: geometry.coordinates });
    }
    const placeLayer = vector.layers.place;
    if (placeLayer) for (let i = 0; i < placeLayer.length; i++) {
      const feature = placeLayer.feature(i), props = feature.properties;
      if (!PLACE_CLASSES.has(props.class)) continue;
      const name = props["name:uk"] || props.name;
      if (!name) continue;
      const geometry = feature.toGeoJSON(tile.x, tile.y, tile.z).geometry;
      if (geometry.type === "Point") places.push({ name, class: props.class, rank: Number(props.rank) || 99, coord: geometry.coordinates });
    }
    const value = { roads, places };
    tileCache.set(key, value);
    if (tileCache.size > 32) tileCache.delete(tileCache.keys().next().value);
    return value;
  }
  async function load(plan, signal) {
    const template = await tileTemplate();
    const result = [], queue = [...plan.tiles];
    async function worker() {
      while (queue.length) {
        const tile = queue.shift();
        result.push(await loadTile(tile, template, signal));
      }
    }
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
    return {
      roads: result.flatMap((tile) => tile.roads),
      places: result.flatMap((tile) => tile.places)
    };
  }
  window.RassvetMapData = { load };
})();
