#!/usr/bin/env bun
// @bun
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/core/core.js
function $constructor(name, initializer, params) {
  function init(inst, def) {
    var _a;
    Object.defineProperty(inst, "_zod", {
      value: inst._zod ?? {},
      enumerable: false
    });
    (_a = inst._zod).traits ?? (_a.traits = new Set);
    inst._zod.traits.add(name);
    initializer(inst, def);
    for (const k in _.prototype) {
      if (!(k in inst))
        Object.defineProperty(inst, k, { value: _.prototype[k].bind(inst) });
    }
    inst._zod.constr = _;
    inst._zod.def = def;
  }
  const Parent = params?.Parent ?? Object;

  class Definition extends Parent {
  }
  Object.defineProperty(Definition, "name", { value: name });
  function _(def) {
    var _a;
    const inst = params?.Parent ? new Definition : this;
    init(inst, def);
    (_a = inst._zod).deferred ?? (_a.deferred = []);
    for (const fn of inst._zod.deferred) {
      fn();
    }
    return inst;
  }
  Object.defineProperty(_, "init", { value: init });
  Object.defineProperty(_, Symbol.hasInstance, {
    value: (inst) => {
      if (params?.Parent && inst instanceof params.Parent)
        return true;
      return inst?._zod?.traits?.has(name);
    }
  });
  Object.defineProperty(_, "name", { value: name });
  return _;
}
function config(newConfig) {
  if (newConfig)
    Object.assign(globalConfig, newConfig);
  return globalConfig;
}
var NEVER, $brand, $ZodAsyncError, $ZodEncodeError, globalConfig;
var init_core = __esm(() => {
  NEVER = Object.freeze({
    status: "aborted"
  });
  $brand = Symbol("zod_brand");
  $ZodAsyncError = class $ZodAsyncError extends Error {
    constructor() {
      super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
    }
  };
  $ZodEncodeError = class $ZodEncodeError extends Error {
    constructor(name) {
      super(`Encountered unidirectional transform during encode: ${name}`);
      this.name = "ZodEncodeError";
    }
  };
  globalConfig = {};
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/core/util.js
var exports_util = {};
__export(exports_util, {
  unwrapMessage: () => unwrapMessage,
  uint8ArrayToHex: () => uint8ArrayToHex,
  uint8ArrayToBase64url: () => uint8ArrayToBase64url,
  uint8ArrayToBase64: () => uint8ArrayToBase64,
  stringifyPrimitive: () => stringifyPrimitive,
  shallowClone: () => shallowClone,
  safeExtend: () => safeExtend,
  required: () => required,
  randomString: () => randomString,
  propertyKeyTypes: () => propertyKeyTypes,
  promiseAllObject: () => promiseAllObject,
  primitiveTypes: () => primitiveTypes,
  prefixIssues: () => prefixIssues,
  pick: () => pick,
  partial: () => partial,
  optionalKeys: () => optionalKeys,
  omit: () => omit,
  objectClone: () => objectClone,
  numKeys: () => numKeys,
  nullish: () => nullish,
  normalizeParams: () => normalizeParams,
  mergeDefs: () => mergeDefs,
  merge: () => merge,
  jsonStringifyReplacer: () => jsonStringifyReplacer,
  joinValues: () => joinValues,
  issue: () => issue,
  isPlainObject: () => isPlainObject,
  isObject: () => isObject,
  hexToUint8Array: () => hexToUint8Array,
  getSizableOrigin: () => getSizableOrigin,
  getParsedType: () => getParsedType,
  getLengthableOrigin: () => getLengthableOrigin,
  getEnumValues: () => getEnumValues,
  getElementAtPath: () => getElementAtPath,
  floatSafeRemainder: () => floatSafeRemainder,
  finalizeIssue: () => finalizeIssue,
  extend: () => extend,
  escapeRegex: () => escapeRegex,
  esc: () => esc,
  defineLazy: () => defineLazy,
  createTransparentProxy: () => createTransparentProxy,
  cloneDef: () => cloneDef,
  clone: () => clone,
  cleanRegex: () => cleanRegex,
  cleanEnum: () => cleanEnum,
  captureStackTrace: () => captureStackTrace,
  cached: () => cached,
  base64urlToUint8Array: () => base64urlToUint8Array,
  base64ToUint8Array: () => base64ToUint8Array,
  assignProp: () => assignProp,
  assertNotEqual: () => assertNotEqual,
  assertNever: () => assertNever,
  assertIs: () => assertIs,
  assertEqual: () => assertEqual,
  assert: () => assert,
  allowsEval: () => allowsEval,
  aborted: () => aborted,
  NUMBER_FORMAT_RANGES: () => NUMBER_FORMAT_RANGES,
  Class: () => Class,
  BIGINT_FORMAT_RANGES: () => BIGINT_FORMAT_RANGES
});
function assertEqual(val) {
  return val;
}
function assertNotEqual(val) {
  return val;
}
function assertIs(_arg) {}
function assertNever(_x) {
  throw new Error;
}
function assert(_) {}
function getEnumValues(entries) {
  const numericValues = Object.values(entries).filter((v) => typeof v === "number");
  const values = Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
  return values;
}
function joinValues(array, separator = "|") {
  return array.map((val) => stringifyPrimitive(val)).join(separator);
}
function jsonStringifyReplacer(_, value) {
  if (typeof value === "bigint")
    return value.toString();
  return value;
}
function cached(getter) {
  const set = false;
  return {
    get value() {
      if (!set) {
        const value = getter();
        Object.defineProperty(this, "value", { value });
        return value;
      }
      throw new Error("cached value already set");
    }
  };
}
function nullish(input) {
  return input === null || input === undefined;
}
function cleanRegex(source) {
  const start = source.startsWith("^") ? 1 : 0;
  const end = source.endsWith("$") ? source.length - 1 : source.length;
  return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepString = step.toString();
  let stepDecCount = (stepString.split(".")[1] || "").length;
  if (stepDecCount === 0 && /\d?e-\d?/.test(stepString)) {
    const match = stepString.match(/\d?e-(\d?)/);
    if (match?.[1]) {
      stepDecCount = Number.parseInt(match[1]);
    }
  }
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
function defineLazy(object, key, getter) {
  let value = undefined;
  Object.defineProperty(object, key, {
    get() {
      if (value === EVALUATING) {
        return;
      }
      if (value === undefined) {
        value = EVALUATING;
        value = getter();
      }
      return value;
    },
    set(v) {
      Object.defineProperty(object, key, {
        value: v
      });
    },
    configurable: true
  });
}
function objectClone(obj) {
  return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyDescriptors(obj));
}
function assignProp(target, prop, value) {
  Object.defineProperty(target, prop, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
}
function mergeDefs(...defs) {
  const mergedDescriptors = {};
  for (const def of defs) {
    const descriptors = Object.getOwnPropertyDescriptors(def);
    Object.assign(mergedDescriptors, descriptors);
  }
  return Object.defineProperties({}, mergedDescriptors);
}
function cloneDef(schema) {
  return mergeDefs(schema._zod.def);
}
function getElementAtPath(obj, path) {
  if (!path)
    return obj;
  return path.reduce((acc, key) => acc?.[key], obj);
}
function promiseAllObject(promisesObj) {
  const keys = Object.keys(promisesObj);
  const promises = keys.map((key) => promisesObj[key]);
  return Promise.all(promises).then((results) => {
    const resolvedObj = {};
    for (let i = 0;i < keys.length; i++) {
      resolvedObj[keys[i]] = results[i];
    }
    return resolvedObj;
  });
}
function randomString(length = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let str = "";
  for (let i = 0;i < length; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str;
}
function esc(str) {
  return JSON.stringify(str);
}
function isObject(data) {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}
function isPlainObject(o) {
  if (isObject(o) === false)
    return false;
  const ctor = o.constructor;
  if (ctor === undefined)
    return true;
  const prot = ctor.prototype;
  if (isObject(prot) === false)
    return false;
  if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
    return false;
  }
  return true;
}
function shallowClone(o) {
  if (isPlainObject(o))
    return { ...o };
  if (Array.isArray(o))
    return [...o];
  return o;
}
function numKeys(data) {
  let keyCount = 0;
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      keyCount++;
    }
  }
  return keyCount;
}
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
  const cl = new inst._zod.constr(def ?? inst._zod.def);
  if (!def || params?.parent)
    cl._zod.parent = inst;
  return cl;
}
function normalizeParams(_params) {
  const params = _params;
  if (!params)
    return {};
  if (typeof params === "string")
    return { error: () => params };
  if (params?.message !== undefined) {
    if (params?.error !== undefined)
      throw new Error("Cannot specify both `message` and `error` params");
    params.error = params.message;
  }
  delete params.message;
  if (typeof params.error === "string")
    return { ...params, error: () => params.error };
  return params;
}
function createTransparentProxy(getter) {
  let target;
  return new Proxy({}, {
    get(_, prop, receiver) {
      target ?? (target = getter());
      return Reflect.get(target, prop, receiver);
    },
    set(_, prop, value, receiver) {
      target ?? (target = getter());
      return Reflect.set(target, prop, value, receiver);
    },
    has(_, prop) {
      target ?? (target = getter());
      return Reflect.has(target, prop);
    },
    deleteProperty(_, prop) {
      target ?? (target = getter());
      return Reflect.deleteProperty(target, prop);
    },
    ownKeys(_) {
      target ?? (target = getter());
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(_, prop) {
      target ?? (target = getter());
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    defineProperty(_, prop, descriptor) {
      target ?? (target = getter());
      return Reflect.defineProperty(target, prop, descriptor);
    }
  });
}
function stringifyPrimitive(value) {
  if (typeof value === "bigint")
    return value.toString() + "n";
  if (typeof value === "string")
    return `"${value}"`;
  return `${value}`;
}
function optionalKeys(shape) {
  return Object.keys(shape).filter((k) => {
    return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
  });
}
function pick(schema, mask) {
  const currDef = schema._zod.def;
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const newShape = {};
      for (const key in mask) {
        if (!(key in currDef.shape)) {
          throw new Error(`Unrecognized key: "${key}"`);
        }
        if (!mask[key])
          continue;
        newShape[key] = currDef.shape[key];
      }
      assignProp(this, "shape", newShape);
      return newShape;
    },
    checks: []
  });
  return clone(schema, def);
}
function omit(schema, mask) {
  const currDef = schema._zod.def;
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const newShape = { ...schema._zod.def.shape };
      for (const key in mask) {
        if (!(key in currDef.shape)) {
          throw new Error(`Unrecognized key: "${key}"`);
        }
        if (!mask[key])
          continue;
        delete newShape[key];
      }
      assignProp(this, "shape", newShape);
      return newShape;
    },
    checks: []
  });
  return clone(schema, def);
}
function extend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to extend: expected a plain object");
  }
  const checks = schema._zod.def.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error("Object schemas containing refinements cannot be extended. Use `.safeExtend()` instead.");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const _shape = { ...schema._zod.def.shape, ...shape };
      assignProp(this, "shape", _shape);
      return _shape;
    },
    checks: []
  });
  return clone(schema, def);
}
function safeExtend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to safeExtend: expected a plain object");
  }
  const def = {
    ...schema._zod.def,
    get shape() {
      const _shape = { ...schema._zod.def.shape, ...shape };
      assignProp(this, "shape", _shape);
      return _shape;
    },
    checks: schema._zod.def.checks
  };
  return clone(schema, def);
}
function merge(a, b) {
  const def = mergeDefs(a._zod.def, {
    get shape() {
      const _shape = { ...a._zod.def.shape, ...b._zod.def.shape };
      assignProp(this, "shape", _shape);
      return _shape;
    },
    get catchall() {
      return b._zod.def.catchall;
    },
    checks: []
  });
  return clone(a, def);
}
function partial(Class, schema, mask) {
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const oldShape = schema._zod.def.shape;
      const shape = { ...oldShape };
      if (mask) {
        for (const key in mask) {
          if (!(key in oldShape)) {
            throw new Error(`Unrecognized key: "${key}"`);
          }
          if (!mask[key])
            continue;
          shape[key] = Class ? new Class({
            type: "optional",
            innerType: oldShape[key]
          }) : oldShape[key];
        }
      } else {
        for (const key in oldShape) {
          shape[key] = Class ? new Class({
            type: "optional",
            innerType: oldShape[key]
          }) : oldShape[key];
        }
      }
      assignProp(this, "shape", shape);
      return shape;
    },
    checks: []
  });
  return clone(schema, def);
}
function required(Class, schema, mask) {
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const oldShape = schema._zod.def.shape;
      const shape = { ...oldShape };
      if (mask) {
        for (const key in mask) {
          if (!(key in shape)) {
            throw new Error(`Unrecognized key: "${key}"`);
          }
          if (!mask[key])
            continue;
          shape[key] = new Class({
            type: "nonoptional",
            innerType: oldShape[key]
          });
        }
      } else {
        for (const key in oldShape) {
          shape[key] = new Class({
            type: "nonoptional",
            innerType: oldShape[key]
          });
        }
      }
      assignProp(this, "shape", shape);
      return shape;
    },
    checks: []
  });
  return clone(schema, def);
}
function aborted(x, startIndex = 0) {
  if (x.aborted === true)
    return true;
  for (let i = startIndex;i < x.issues.length; i++) {
    if (x.issues[i]?.continue !== true) {
      return true;
    }
  }
  return false;
}
function prefixIssues(path, issues) {
  return issues.map((iss) => {
    var _a;
    (_a = iss).path ?? (_a.path = []);
    iss.path.unshift(path);
    return iss;
  });
}
function unwrapMessage(message) {
  return typeof message === "string" ? message : message?.message;
}
function finalizeIssue(iss, ctx, config2) {
  const full = { ...iss, path: iss.path ?? [] };
  if (!iss.message) {
    const message = unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config2.customError?.(iss)) ?? unwrapMessage(config2.localeError?.(iss)) ?? "Invalid input";
    full.message = message;
  }
  delete full.inst;
  delete full.continue;
  if (!ctx?.reportInput) {
    delete full.input;
  }
  return full;
}
function getSizableOrigin(input) {
  if (input instanceof Set)
    return "set";
  if (input instanceof Map)
    return "map";
  if (input instanceof File)
    return "file";
  return "unknown";
}
function getLengthableOrigin(input) {
  if (Array.isArray(input))
    return "array";
  if (typeof input === "string")
    return "string";
  return "unknown";
}
function issue(...args) {
  const [iss, input, inst] = args;
  if (typeof iss === "string") {
    return {
      message: iss,
      code: "custom",
      input,
      inst
    };
  }
  return { ...iss };
}
function cleanEnum(obj) {
  return Object.entries(obj).filter(([k, _]) => {
    return Number.isNaN(Number.parseInt(k, 10));
  }).map((el) => el[1]);
}
function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0;i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
function uint8ArrayToBase64(bytes) {
  let binaryString = "";
  for (let i = 0;i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  return btoa(binaryString);
}
function base64urlToUint8Array(base64url) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - base64.length % 4) % 4);
  return base64ToUint8Array(base64 + padding);
}
function uint8ArrayToBase64url(bytes) {
  return uint8ArrayToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function hexToUint8Array(hex) {
  const cleanHex = hex.replace(/^0x/, "");
  if (cleanHex.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0;i < cleanHex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}
function uint8ArrayToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

class Class {
  constructor(..._args) {}
}
var EVALUATING, captureStackTrace, allowsEval, getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return "undefined";
    case "string":
      return "string";
    case "number":
      return Number.isNaN(data) ? "nan" : "number";
    case "boolean":
      return "boolean";
    case "function":
      return "function";
    case "bigint":
      return "bigint";
    case "symbol":
      return "symbol";
    case "object":
      if (Array.isArray(data)) {
        return "array";
      }
      if (data === null) {
        return "null";
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return "promise";
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return "map";
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return "set";
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return "date";
      }
      if (typeof File !== "undefined" && data instanceof File) {
        return "file";
      }
      return "object";
    default:
      throw new Error(`Unknown data type: ${t}`);
  }
}, propertyKeyTypes, primitiveTypes, NUMBER_FORMAT_RANGES, BIGINT_FORMAT_RANGES;
var init_util = __esm(() => {
  EVALUATING = Symbol("evaluating");
  captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {};
  allowsEval = cached(() => {
    if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) {
      return false;
    }
    try {
      const F = Function;
      new F("");
      return true;
    } catch (_) {
      return false;
    }
  });
  propertyKeyTypes = new Set(["string", "number", "symbol"]);
  primitiveTypes = new Set(["string", "number", "bigint", "boolean", "symbol", "undefined"]);
  NUMBER_FORMAT_RANGES = {
    safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
    int32: [-2147483648, 2147483647],
    uint32: [0, 4294967295],
    float32: [-340282346638528860000000000000000000000, 340282346638528860000000000000000000000],
    float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
  };
  BIGINT_FORMAT_RANGES = {
    int64: [/* @__PURE__ */ BigInt("-9223372036854775808"), /* @__PURE__ */ BigInt("9223372036854775807")],
    uint64: [/* @__PURE__ */ BigInt(0), /* @__PURE__ */ BigInt("18446744073709551615")]
  };
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/core/errors.js
function flattenError(error, mapper = (issue2) => issue2.message) {
  const fieldErrors = {};
  const formErrors = [];
  for (const sub of error.issues) {
    if (sub.path.length > 0) {
      fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
      fieldErrors[sub.path[0]].push(mapper(sub));
    } else {
      formErrors.push(mapper(sub));
    }
  }
  return { formErrors, fieldErrors };
}
function formatError(error, mapper = (issue2) => issue2.message) {
  const fieldErrors = { _errors: [] };
  const processError = (error2) => {
    for (const issue2 of error2.issues) {
      if (issue2.code === "invalid_union" && issue2.errors.length) {
        issue2.errors.map((issues) => processError({ issues }));
      } else if (issue2.code === "invalid_key") {
        processError({ issues: issue2.issues });
      } else if (issue2.code === "invalid_element") {
        processError({ issues: issue2.issues });
      } else if (issue2.path.length === 0) {
        fieldErrors._errors.push(mapper(issue2));
      } else {
        let curr = fieldErrors;
        let i = 0;
        while (i < issue2.path.length) {
          const el = issue2.path[i];
          const terminal = i === issue2.path.length - 1;
          if (!terminal) {
            curr[el] = curr[el] || { _errors: [] };
          } else {
            curr[el] = curr[el] || { _errors: [] };
            curr[el]._errors.push(mapper(issue2));
          }
          curr = curr[el];
          i++;
        }
      }
    }
  };
  processError(error);
  return fieldErrors;
}
function treeifyError(error, mapper = (issue2) => issue2.message) {
  const result = { errors: [] };
  const processError = (error2, path = []) => {
    var _a, _b;
    for (const issue2 of error2.issues) {
      if (issue2.code === "invalid_union" && issue2.errors.length) {
        issue2.errors.map((issues) => processError({ issues }, issue2.path));
      } else if (issue2.code === "invalid_key") {
        processError({ issues: issue2.issues }, issue2.path);
      } else if (issue2.code === "invalid_element") {
        processError({ issues: issue2.issues }, issue2.path);
      } else {
        const fullpath = [...path, ...issue2.path];
        if (fullpath.length === 0) {
          result.errors.push(mapper(issue2));
          continue;
        }
        let curr = result;
        let i = 0;
        while (i < fullpath.length) {
          const el = fullpath[i];
          const terminal = i === fullpath.length - 1;
          if (typeof el === "string") {
            curr.properties ?? (curr.properties = {});
            (_a = curr.properties)[el] ?? (_a[el] = { errors: [] });
            curr = curr.properties[el];
          } else {
            curr.items ?? (curr.items = []);
            (_b = curr.items)[el] ?? (_b[el] = { errors: [] });
            curr = curr.items[el];
          }
          if (terminal) {
            curr.errors.push(mapper(issue2));
          }
          i++;
        }
      }
    }
  };
  processError(error);
  return result;
}
function toDotPath(_path) {
  const segs = [];
  const path = _path.map((seg) => typeof seg === "object" ? seg.key : seg);
  for (const seg of path) {
    if (typeof seg === "number")
      segs.push(`[${seg}]`);
    else if (typeof seg === "symbol")
      segs.push(`[${JSON.stringify(String(seg))}]`);
    else if (/[^\w$]/.test(seg))
      segs.push(`[${JSON.stringify(seg)}]`);
    else {
      if (segs.length)
        segs.push(".");
      segs.push(seg);
    }
  }
  return segs.join("");
}
function prettifyError(error) {
  const lines = [];
  const issues = [...error.issues].sort((a, b) => (a.path ?? []).length - (b.path ?? []).length);
  for (const issue2 of issues) {
    lines.push(`✖ ${issue2.message}`);
    if (issue2.path?.length)
      lines.push(`  → at ${toDotPath(issue2.path)}`);
  }
  return lines.join(`
`);
}
var initializer = (inst, def) => {
  inst.name = "$ZodError";
  Object.defineProperty(inst, "_zod", {
    value: inst._zod,
    enumerable: false
  });
  Object.defineProperty(inst, "issues", {
    value: def,
    enumerable: false
  });
  inst.message = JSON.stringify(def, jsonStringifyReplacer, 2);
  Object.defineProperty(inst, "toString", {
    value: () => inst.message,
    enumerable: false
  });
}, $ZodError, $ZodRealError;
var init_errors = __esm(() => {
  init_core();
  init_util();
  $ZodError = $constructor("$ZodError", initializer);
  $ZodRealError = $constructor("$ZodError", initializer, { Parent: Error });
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/core/parse.js
var _parse = (_Err) => (schema, value, _ctx, _params) => {
  const ctx = _ctx ? Object.assign(_ctx, { async: false }) : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError;
  }
  if (result.issues.length) {
    const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
    captureStackTrace(e, _params?.callee);
    throw e;
  }
  return result.value;
}, parse, _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
  const ctx = _ctx ? Object.assign(_ctx, { async: true }) : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  if (result.issues.length) {
    const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
    captureStackTrace(e, params?.callee);
    throw e;
  }
  return result.value;
}, parseAsync, _safeParse = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError;
  }
  return result.issues.length ? {
    success: false,
    error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
}, safeParse, _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? Object.assign(_ctx, { async: true }) : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  return result.issues.length ? {
    success: false,
    error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
}, safeParseAsync, _encode = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
  return _parse(_Err)(schema, value, ctx);
}, encode, _decode = (_Err) => (schema, value, _ctx) => {
  return _parse(_Err)(schema, value, _ctx);
}, decode, _encodeAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
  return _parseAsync(_Err)(schema, value, ctx);
}, encodeAsync, _decodeAsync = (_Err) => async (schema, value, _ctx) => {
  return _parseAsync(_Err)(schema, value, _ctx);
}, decodeAsync, _safeEncode = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
  return _safeParse(_Err)(schema, value, ctx);
}, safeEncode, _safeDecode = (_Err) => (schema, value, _ctx) => {
  return _safeParse(_Err)(schema, value, _ctx);
}, safeDecode, _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
  return _safeParseAsync(_Err)(schema, value, ctx);
}, safeEncodeAsync, _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
  return _safeParseAsync(_Err)(schema, value, _ctx);
}, safeDecodeAsync;
var init_parse = __esm(() => {
  init_core();
  init_errors();
  init_util();
  parse = /* @__PURE__ */ _parse($ZodRealError);
  parseAsync = /* @__PURE__ */ _parseAsync($ZodRealError);
  safeParse = /* @__PURE__ */ _safeParse($ZodRealError);
  safeParseAsync = /* @__PURE__ */ _safeParseAsync($ZodRealError);
  encode = /* @__PURE__ */ _encode($ZodRealError);
  decode = /* @__PURE__ */ _decode($ZodRealError);
  encodeAsync = /* @__PURE__ */ _encodeAsync($ZodRealError);
  decodeAsync = /* @__PURE__ */ _decodeAsync($ZodRealError);
  safeEncode = /* @__PURE__ */ _safeEncode($ZodRealError);
  safeDecode = /* @__PURE__ */ _safeDecode($ZodRealError);
  safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync($ZodRealError);
  safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync($ZodRealError);
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/core/regexes.js
var exports_regexes = {};
__export(exports_regexes, {
  xid: () => xid,
  uuid7: () => uuid7,
  uuid6: () => uuid6,
  uuid4: () => uuid4,
  uuid: () => uuid,
  uppercase: () => uppercase,
  unicodeEmail: () => unicodeEmail,
  undefined: () => _undefined,
  ulid: () => ulid,
  time: () => time,
  string: () => string,
  sha512_hex: () => sha512_hex,
  sha512_base64url: () => sha512_base64url,
  sha512_base64: () => sha512_base64,
  sha384_hex: () => sha384_hex,
  sha384_base64url: () => sha384_base64url,
  sha384_base64: () => sha384_base64,
  sha256_hex: () => sha256_hex,
  sha256_base64url: () => sha256_base64url,
  sha256_base64: () => sha256_base64,
  sha1_hex: () => sha1_hex,
  sha1_base64url: () => sha1_base64url,
  sha1_base64: () => sha1_base64,
  rfc5322Email: () => rfc5322Email,
  number: () => number,
  null: () => _null,
  nanoid: () => nanoid,
  md5_hex: () => md5_hex,
  md5_base64url: () => md5_base64url,
  md5_base64: () => md5_base64,
  lowercase: () => lowercase,
  ksuid: () => ksuid,
  ipv6: () => ipv6,
  ipv4: () => ipv4,
  integer: () => integer,
  idnEmail: () => idnEmail,
  html5Email: () => html5Email,
  hostname: () => hostname,
  hex: () => hex,
  guid: () => guid,
  extendedDuration: () => extendedDuration,
  emoji: () => emoji,
  email: () => email,
  e164: () => e164,
  duration: () => duration,
  domain: () => domain,
  datetime: () => datetime,
  date: () => date,
  cuid2: () => cuid2,
  cuid: () => cuid,
  cidrv6: () => cidrv6,
  cidrv4: () => cidrv4,
  browserEmail: () => browserEmail,
  boolean: () => boolean,
  bigint: () => bigint,
  base64url: () => base64url,
  base64: () => base64
});
function emoji() {
  return new RegExp(_emoji, "u");
}
function timeSource(args) {
  const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
  const regex = typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
  return regex;
}
function time(args) {
  return new RegExp(`^${timeSource(args)}$`);
}
function datetime(args) {
  const time2 = timeSource({ precision: args.precision });
  const opts = ["Z"];
  if (args.local)
    opts.push("");
  if (args.offset)
    opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
  const timeRegex = `${time2}(?:${opts.join("|")})`;
  return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
function fixedBase64(bodyLength, padding) {
  return new RegExp(`^[A-Za-z0-9+/]{${bodyLength}}${padding}$`);
}
function fixedBase64url(length) {
  return new RegExp(`^[A-Za-z0-9_-]{${length}}$`);
}
var cuid, cuid2, ulid, xid, ksuid, nanoid, duration, extendedDuration, guid, uuid = (version) => {
  if (!version)
    return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
  return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
}, uuid4, uuid6, uuid7, email, html5Email, rfc5322Email, unicodeEmail, idnEmail, browserEmail, _emoji = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`, ipv4, ipv6, cidrv4, cidrv6, base64, base64url, hostname, domain, e164, dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`, date, string = (params) => {
  const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
  return new RegExp(`^${regex}$`);
}, bigint, integer, number, boolean, _null, _undefined, lowercase, uppercase, hex, md5_hex, md5_base64, md5_base64url, sha1_hex, sha1_base64, sha1_base64url, sha256_hex, sha256_base64, sha256_base64url, sha384_hex, sha384_base64, sha384_base64url, sha512_hex, sha512_base64, sha512_base64url;
var init_regexes = __esm(() => {
  cuid = /^[cC][^\s-]{8,}$/;
  cuid2 = /^[0-9a-z]+$/;
  ulid = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
  xid = /^[0-9a-vA-V]{20}$/;
  ksuid = /^[A-Za-z0-9]{27}$/;
  nanoid = /^[a-zA-Z0-9_-]{21}$/;
  duration = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
  extendedDuration = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
  guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
  uuid4 = /* @__PURE__ */ uuid(4);
  uuid6 = /* @__PURE__ */ uuid(6);
  uuid7 = /* @__PURE__ */ uuid(7);
  email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
  html5Email = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  rfc5322Email = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  unicodeEmail = /^[^\s@"]{1,64}@[^\s@]{1,255}$/u;
  idnEmail = unicodeEmail;
  browserEmail = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
  ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
  cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
  cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
  base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
  base64url = /^[A-Za-z0-9_-]*$/;
  hostname = /^(?=.{1,253}\.?$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[-0-9a-zA-Z]{0,61}[0-9a-zA-Z])?)*\.?$/;
  domain = /^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  e164 = /^\+(?:[0-9]){6,14}[0-9]$/;
  date = /* @__PURE__ */ new RegExp(`^${dateSource}$`);
  bigint = /^-?\d+n?$/;
  integer = /^-?\d+$/;
  number = /^-?\d+(?:\.\d+)?/;
  boolean = /^(?:true|false)$/i;
  _null = /^null$/i;
  _undefined = /^undefined$/i;
  lowercase = /^[^A-Z]*$/;
  uppercase = /^[^a-z]*$/;
  hex = /^[0-9a-fA-F]*$/;
  md5_hex = /^[0-9a-fA-F]{32}$/;
  md5_base64 = /* @__PURE__ */ fixedBase64(22, "==");
  md5_base64url = /* @__PURE__ */ fixedBase64url(22);
  sha1_hex = /^[0-9a-fA-F]{40}$/;
  sha1_base64 = /* @__PURE__ */ fixedBase64(27, "=");
  sha1_base64url = /* @__PURE__ */ fixedBase64url(27);
  sha256_hex = /^[0-9a-fA-F]{64}$/;
  sha256_base64 = /* @__PURE__ */ fixedBase64(43, "=");
  sha256_base64url = /* @__PURE__ */ fixedBase64url(43);
  sha384_hex = /^[0-9a-fA-F]{96}$/;
  sha384_base64 = /* @__PURE__ */ fixedBase64(64, "");
  sha384_base64url = /* @__PURE__ */ fixedBase64url(64);
  sha512_hex = /^[0-9a-fA-F]{128}$/;
  sha512_base64 = /* @__PURE__ */ fixedBase64(86, "==");
  sha512_base64url = /* @__PURE__ */ fixedBase64url(86);
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/core/checks.js
function handleCheckPropertyResult(result, payload, property) {
  if (result.issues.length) {
    payload.issues.push(...prefixIssues(property, result.issues));
  }
}
var $ZodCheck, numericOriginMap, $ZodCheckLessThan, $ZodCheckGreaterThan, $ZodCheckMultipleOf, $ZodCheckNumberFormat, $ZodCheckBigIntFormat, $ZodCheckMaxSize, $ZodCheckMinSize, $ZodCheckSizeEquals, $ZodCheckMaxLength, $ZodCheckMinLength, $ZodCheckLengthEquals, $ZodCheckStringFormat, $ZodCheckRegex, $ZodCheckLowerCase, $ZodCheckUpperCase, $ZodCheckIncludes, $ZodCheckStartsWith, $ZodCheckEndsWith, $ZodCheckProperty, $ZodCheckMimeType, $ZodCheckOverwrite;
var init_checks = __esm(() => {
  init_core();
  init_regexes();
  init_util();
  $ZodCheck = /* @__PURE__ */ $constructor("$ZodCheck", (inst, def) => {
    var _a;
    inst._zod ?? (inst._zod = {});
    inst._zod.def = def;
    (_a = inst._zod).onattach ?? (_a.onattach = []);
  });
  numericOriginMap = {
    number: "number",
    bigint: "bigint",
    object: "date"
  };
  $ZodCheckLessThan = /* @__PURE__ */ $constructor("$ZodCheckLessThan", (inst, def) => {
    $ZodCheck.init(inst, def);
    const origin = numericOriginMap[typeof def.value];
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
      if (def.value < curr) {
        if (def.inclusive)
          bag.maximum = def.value;
        else
          bag.exclusiveMaximum = def.value;
      }
    });
    inst._zod.check = (payload) => {
      if (def.inclusive ? payload.value <= def.value : payload.value < def.value) {
        return;
      }
      payload.issues.push({
        origin,
        code: "too_big",
        maximum: def.value,
        input: payload.value,
        inclusive: def.inclusive,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckGreaterThan = /* @__PURE__ */ $constructor("$ZodCheckGreaterThan", (inst, def) => {
    $ZodCheck.init(inst, def);
    const origin = numericOriginMap[typeof def.value];
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
      if (def.value > curr) {
        if (def.inclusive)
          bag.minimum = def.value;
        else
          bag.exclusiveMinimum = def.value;
      }
    });
    inst._zod.check = (payload) => {
      if (def.inclusive ? payload.value >= def.value : payload.value > def.value) {
        return;
      }
      payload.issues.push({
        origin,
        code: "too_small",
        minimum: def.value,
        input: payload.value,
        inclusive: def.inclusive,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckMultipleOf = /* @__PURE__ */ $constructor("$ZodCheckMultipleOf", (inst, def) => {
    $ZodCheck.init(inst, def);
    inst._zod.onattach.push((inst2) => {
      var _a;
      (_a = inst2._zod.bag).multipleOf ?? (_a.multipleOf = def.value);
    });
    inst._zod.check = (payload) => {
      if (typeof payload.value !== typeof def.value)
        throw new Error("Cannot mix number and bigint in multiple_of check.");
      const isMultiple = typeof payload.value === "bigint" ? payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0;
      if (isMultiple)
        return;
      payload.issues.push({
        origin: typeof payload.value,
        code: "not_multiple_of",
        divisor: def.value,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckNumberFormat = /* @__PURE__ */ $constructor("$ZodCheckNumberFormat", (inst, def) => {
    $ZodCheck.init(inst, def);
    def.format = def.format || "float64";
    const isInt = def.format?.includes("int");
    const origin = isInt ? "int" : "number";
    const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      bag.format = def.format;
      bag.minimum = minimum;
      bag.maximum = maximum;
      if (isInt)
        bag.pattern = integer;
    });
    inst._zod.check = (payload) => {
      const input = payload.value;
      if (isInt) {
        if (!Number.isInteger(input)) {
          payload.issues.push({
            expected: origin,
            format: def.format,
            code: "invalid_type",
            continue: false,
            input,
            inst
          });
          return;
        }
        if (!Number.isSafeInteger(input)) {
          if (input > 0) {
            payload.issues.push({
              input,
              code: "too_big",
              maximum: Number.MAX_SAFE_INTEGER,
              note: "Integers must be within the safe integer range.",
              inst,
              origin,
              continue: !def.abort
            });
          } else {
            payload.issues.push({
              input,
              code: "too_small",
              minimum: Number.MIN_SAFE_INTEGER,
              note: "Integers must be within the safe integer range.",
              inst,
              origin,
              continue: !def.abort
            });
          }
          return;
        }
      }
      if (input < minimum) {
        payload.issues.push({
          origin: "number",
          input,
          code: "too_small",
          minimum,
          inclusive: true,
          inst,
          continue: !def.abort
        });
      }
      if (input > maximum) {
        payload.issues.push({
          origin: "number",
          input,
          code: "too_big",
          maximum,
          inst
        });
      }
    };
  });
  $ZodCheckBigIntFormat = /* @__PURE__ */ $constructor("$ZodCheckBigIntFormat", (inst, def) => {
    $ZodCheck.init(inst, def);
    const [minimum, maximum] = BIGINT_FORMAT_RANGES[def.format];
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      bag.format = def.format;
      bag.minimum = minimum;
      bag.maximum = maximum;
    });
    inst._zod.check = (payload) => {
      const input = payload.value;
      if (input < minimum) {
        payload.issues.push({
          origin: "bigint",
          input,
          code: "too_small",
          minimum,
          inclusive: true,
          inst,
          continue: !def.abort
        });
      }
      if (input > maximum) {
        payload.issues.push({
          origin: "bigint",
          input,
          code: "too_big",
          maximum,
          inst
        });
      }
    };
  });
  $ZodCheckMaxSize = /* @__PURE__ */ $constructor("$ZodCheckMaxSize", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
      const val = payload.value;
      return !nullish(val) && val.size !== undefined;
    });
    inst._zod.onattach.push((inst2) => {
      const curr = inst2._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
      if (def.maximum < curr)
        inst2._zod.bag.maximum = def.maximum;
    });
    inst._zod.check = (payload) => {
      const input = payload.value;
      const size = input.size;
      if (size <= def.maximum)
        return;
      payload.issues.push({
        origin: getSizableOrigin(input),
        code: "too_big",
        maximum: def.maximum,
        inclusive: true,
        input,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckMinSize = /* @__PURE__ */ $constructor("$ZodCheckMinSize", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
      const val = payload.value;
      return !nullish(val) && val.size !== undefined;
    });
    inst._zod.onattach.push((inst2) => {
      const curr = inst2._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
      if (def.minimum > curr)
        inst2._zod.bag.minimum = def.minimum;
    });
    inst._zod.check = (payload) => {
      const input = payload.value;
      const size = input.size;
      if (size >= def.minimum)
        return;
      payload.issues.push({
        origin: getSizableOrigin(input),
        code: "too_small",
        minimum: def.minimum,
        inclusive: true,
        input,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckSizeEquals = /* @__PURE__ */ $constructor("$ZodCheckSizeEquals", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
      const val = payload.value;
      return !nullish(val) && val.size !== undefined;
    });
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      bag.minimum = def.size;
      bag.maximum = def.size;
      bag.size = def.size;
    });
    inst._zod.check = (payload) => {
      const input = payload.value;
      const size = input.size;
      if (size === def.size)
        return;
      const tooBig = size > def.size;
      payload.issues.push({
        origin: getSizableOrigin(input),
        ...tooBig ? { code: "too_big", maximum: def.size } : { code: "too_small", minimum: def.size },
        inclusive: true,
        exact: true,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckMaxLength = /* @__PURE__ */ $constructor("$ZodCheckMaxLength", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
      const val = payload.value;
      return !nullish(val) && val.length !== undefined;
    });
    inst._zod.onattach.push((inst2) => {
      const curr = inst2._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
      if (def.maximum < curr)
        inst2._zod.bag.maximum = def.maximum;
    });
    inst._zod.check = (payload) => {
      const input = payload.value;
      const length = input.length;
      if (length <= def.maximum)
        return;
      const origin = getLengthableOrigin(input);
      payload.issues.push({
        origin,
        code: "too_big",
        maximum: def.maximum,
        inclusive: true,
        input,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckMinLength = /* @__PURE__ */ $constructor("$ZodCheckMinLength", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
      const val = payload.value;
      return !nullish(val) && val.length !== undefined;
    });
    inst._zod.onattach.push((inst2) => {
      const curr = inst2._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
      if (def.minimum > curr)
        inst2._zod.bag.minimum = def.minimum;
    });
    inst._zod.check = (payload) => {
      const input = payload.value;
      const length = input.length;
      if (length >= def.minimum)
        return;
      const origin = getLengthableOrigin(input);
      payload.issues.push({
        origin,
        code: "too_small",
        minimum: def.minimum,
        inclusive: true,
        input,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckLengthEquals = /* @__PURE__ */ $constructor("$ZodCheckLengthEquals", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
      const val = payload.value;
      return !nullish(val) && val.length !== undefined;
    });
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      bag.minimum = def.length;
      bag.maximum = def.length;
      bag.length = def.length;
    });
    inst._zod.check = (payload) => {
      const input = payload.value;
      const length = input.length;
      if (length === def.length)
        return;
      const origin = getLengthableOrigin(input);
      const tooBig = length > def.length;
      payload.issues.push({
        origin,
        ...tooBig ? { code: "too_big", maximum: def.length } : { code: "too_small", minimum: def.length },
        inclusive: true,
        exact: true,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckStringFormat = /* @__PURE__ */ $constructor("$ZodCheckStringFormat", (inst, def) => {
    var _a, _b;
    $ZodCheck.init(inst, def);
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      bag.format = def.format;
      if (def.pattern) {
        bag.patterns ?? (bag.patterns = new Set);
        bag.patterns.add(def.pattern);
      }
    });
    if (def.pattern)
      (_a = inst._zod).check ?? (_a.check = (payload) => {
        def.pattern.lastIndex = 0;
        if (def.pattern.test(payload.value))
          return;
        payload.issues.push({
          origin: "string",
          code: "invalid_format",
          format: def.format,
          input: payload.value,
          ...def.pattern ? { pattern: def.pattern.toString() } : {},
          inst,
          continue: !def.abort
        });
      });
    else
      (_b = inst._zod).check ?? (_b.check = () => {});
  });
  $ZodCheckRegex = /* @__PURE__ */ $constructor("$ZodCheckRegex", (inst, def) => {
    $ZodCheckStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      def.pattern.lastIndex = 0;
      if (def.pattern.test(payload.value))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: "regex",
        input: payload.value,
        pattern: def.pattern.toString(),
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckLowerCase = /* @__PURE__ */ $constructor("$ZodCheckLowerCase", (inst, def) => {
    def.pattern ?? (def.pattern = lowercase);
    $ZodCheckStringFormat.init(inst, def);
  });
  $ZodCheckUpperCase = /* @__PURE__ */ $constructor("$ZodCheckUpperCase", (inst, def) => {
    def.pattern ?? (def.pattern = uppercase);
    $ZodCheckStringFormat.init(inst, def);
  });
  $ZodCheckIncludes = /* @__PURE__ */ $constructor("$ZodCheckIncludes", (inst, def) => {
    $ZodCheck.init(inst, def);
    const escapedRegex = escapeRegex(def.includes);
    const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position}}${escapedRegex}` : escapedRegex);
    def.pattern = pattern;
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      bag.patterns ?? (bag.patterns = new Set);
      bag.patterns.add(pattern);
    });
    inst._zod.check = (payload) => {
      if (payload.value.includes(def.includes, def.position))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: "includes",
        includes: def.includes,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckStartsWith = /* @__PURE__ */ $constructor("$ZodCheckStartsWith", (inst, def) => {
    $ZodCheck.init(inst, def);
    const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
    def.pattern ?? (def.pattern = pattern);
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      bag.patterns ?? (bag.patterns = new Set);
      bag.patterns.add(pattern);
    });
    inst._zod.check = (payload) => {
      if (payload.value.startsWith(def.prefix))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: "starts_with",
        prefix: def.prefix,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckEndsWith = /* @__PURE__ */ $constructor("$ZodCheckEndsWith", (inst, def) => {
    $ZodCheck.init(inst, def);
    const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
    def.pattern ?? (def.pattern = pattern);
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      bag.patterns ?? (bag.patterns = new Set);
      bag.patterns.add(pattern);
    });
    inst._zod.check = (payload) => {
      if (payload.value.endsWith(def.suffix))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: "ends_with",
        suffix: def.suffix,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckProperty = /* @__PURE__ */ $constructor("$ZodCheckProperty", (inst, def) => {
    $ZodCheck.init(inst, def);
    inst._zod.check = (payload) => {
      const result = def.schema._zod.run({
        value: payload.value[def.property],
        issues: []
      }, {});
      if (result instanceof Promise) {
        return result.then((result2) => handleCheckPropertyResult(result2, payload, def.property));
      }
      handleCheckPropertyResult(result, payload, def.property);
      return;
    };
  });
  $ZodCheckMimeType = /* @__PURE__ */ $constructor("$ZodCheckMimeType", (inst, def) => {
    $ZodCheck.init(inst, def);
    const mimeSet = new Set(def.mime);
    inst._zod.onattach.push((inst2) => {
      inst2._zod.bag.mime = def.mime;
    });
    inst._zod.check = (payload) => {
      if (mimeSet.has(payload.value.type))
        return;
      payload.issues.push({
        code: "invalid_value",
        values: def.mime,
        input: payload.value.type,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckOverwrite = /* @__PURE__ */ $constructor("$ZodCheckOverwrite", (inst, def) => {
    $ZodCheck.init(inst, def);
    inst._zod.check = (payload) => {
      payload.value = def.tx(payload.value);
    };
  });
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/core/doc.js
class Doc {
  constructor(args = []) {
    this.content = [];
    this.indent = 0;
    if (this)
      this.args = args;
  }
  indented(fn) {
    this.indent += 1;
    fn(this);
    this.indent -= 1;
  }
  write(arg) {
    if (typeof arg === "function") {
      arg(this, { execution: "sync" });
      arg(this, { execution: "async" });
      return;
    }
    const content = arg;
    const lines = content.split(`
`).filter((x) => x);
    const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
    const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
    for (const line of dedented) {
      this.content.push(line);
    }
  }
  compile() {
    const F = Function;
    const args = this?.args;
    const content = this?.content ?? [``];
    const lines = [...content.map((x) => `  ${x}`)];
    return new F(...args, lines.join(`
`));
  }
}

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/core/versions.js
var version;
var init_versions = __esm(() => {
  version = {
    major: 4,
    minor: 1,
    patch: 12
  };
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/core/schemas.js
function isValidBase64(data) {
  if (data === "")
    return true;
  if (data.length % 4 !== 0)
    return false;
  try {
    atob(data);
    return true;
  } catch {
    return false;
  }
}
function isValidBase64URL(data) {
  if (!base64url.test(data))
    return false;
  const base642 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
  const padded = base642.padEnd(Math.ceil(base642.length / 4) * 4, "=");
  return isValidBase64(padded);
}
function isValidJWT(token, algorithm = null) {
  try {
    const tokensParts = token.split(".");
    if (tokensParts.length !== 3)
      return false;
    const [header] = tokensParts;
    if (!header)
      return false;
    const parsedHeader = JSON.parse(atob(header));
    if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT")
      return false;
    if (!parsedHeader.alg)
      return false;
    if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm))
      return false;
    return true;
  } catch {
    return false;
  }
}
function handleArrayResult(result, final, index) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(index, result.issues));
  }
  final.value[index] = result.value;
}
function handlePropertyResult(result, final, key, input) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(key, result.issues));
  }
  if (result.value === undefined) {
    if (key in input) {
      final.value[key] = undefined;
    }
  } else {
    final.value[key] = result.value;
  }
}
function normalizeDef(def) {
  const keys = Object.keys(def.shape);
  for (const k of keys) {
    if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) {
      throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
    }
  }
  const okeys = optionalKeys(def.shape);
  return {
    ...def,
    keys,
    keySet: new Set(keys),
    numKeys: keys.length,
    optionalKeys: new Set(okeys)
  };
}
function handleCatchall(proms, input, payload, ctx, def, inst) {
  const unrecognized = [];
  const keySet = def.keySet;
  const _catchall = def.catchall._zod;
  const t = _catchall.def.type;
  for (const key of Object.keys(input)) {
    if (keySet.has(key))
      continue;
    if (t === "never") {
      unrecognized.push(key);
      continue;
    }
    const r = _catchall.run({ value: input[key], issues: [] }, ctx);
    if (r instanceof Promise) {
      proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input)));
    } else {
      handlePropertyResult(r, payload, key, input);
    }
  }
  if (unrecognized.length) {
    payload.issues.push({
      code: "unrecognized_keys",
      keys: unrecognized,
      input,
      inst
    });
  }
  if (!proms.length)
    return payload;
  return Promise.all(proms).then(() => {
    return payload;
  });
}
function handleUnionResults(results, final, inst, ctx) {
  for (const result of results) {
    if (result.issues.length === 0) {
      final.value = result.value;
      return final;
    }
  }
  const nonaborted = results.filter((r) => !aborted(r));
  if (nonaborted.length === 1) {
    final.value = nonaborted[0].value;
    return nonaborted[0];
  }
  final.issues.push({
    code: "invalid_union",
    input: final.value,
    inst,
    errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  });
  return final;
}
function mergeValues(a, b) {
  if (a === b) {
    return { valid: true, data: a };
  }
  if (a instanceof Date && b instanceof Date && +a === +b) {
    return { valid: true, data: a };
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const bKeys = Object.keys(b);
    const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
        };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return { valid: false, mergeErrorPath: [] };
    }
    const newArray = [];
    for (let index = 0;index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
        };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  }
  return { valid: false, mergeErrorPath: [] };
}
function handleIntersectionResults(result, left, right) {
  if (left.issues.length) {
    result.issues.push(...left.issues);
  }
  if (right.issues.length) {
    result.issues.push(...right.issues);
  }
  if (aborted(result))
    return result;
  const merged = mergeValues(left.value, right.value);
  if (!merged.valid) {
    throw new Error(`Unmergable intersection. Error path: ` + `${JSON.stringify(merged.mergeErrorPath)}`);
  }
  result.value = merged.data;
  return result;
}
function handleTupleResult(result, final, index) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(index, result.issues));
  }
  final.value[index] = result.value;
}
function handleMapResult(keyResult, valueResult, final, key, input, inst, ctx) {
  if (keyResult.issues.length) {
    if (propertyKeyTypes.has(typeof key)) {
      final.issues.push(...prefixIssues(key, keyResult.issues));
    } else {
      final.issues.push({
        code: "invalid_key",
        origin: "map",
        input,
        inst,
        issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config()))
      });
    }
  }
  if (valueResult.issues.length) {
    if (propertyKeyTypes.has(typeof key)) {
      final.issues.push(...prefixIssues(key, valueResult.issues));
    } else {
      final.issues.push({
        origin: "map",
        code: "invalid_element",
        input,
        inst,
        key,
        issues: valueResult.issues.map((iss) => finalizeIssue(iss, ctx, config()))
      });
    }
  }
  final.value.set(keyResult.value, valueResult.value);
}
function handleSetResult(result, final) {
  if (result.issues.length) {
    final.issues.push(...result.issues);
  }
  final.value.add(result.value);
}
function handleOptionalResult(result, input) {
  if (result.issues.length && input === undefined) {
    return { issues: [], value: undefined };
  }
  return result;
}
function handleDefaultResult(payload, def) {
  if (payload.value === undefined) {
    payload.value = def.defaultValue;
  }
  return payload;
}
function handleNonOptionalResult(payload, inst) {
  if (!payload.issues.length && payload.value === undefined) {
    payload.issues.push({
      code: "invalid_type",
      expected: "nonoptional",
      input: payload.value,
      inst
    });
  }
  return payload;
}
function handlePipeResult(left, next, ctx) {
  if (left.issues.length) {
    left.aborted = true;
    return left;
  }
  return next._zod.run({ value: left.value, issues: left.issues }, ctx);
}
function handleCodecAResult(result, def, ctx) {
  if (result.issues.length) {
    result.aborted = true;
    return result;
  }
  const direction = ctx.direction || "forward";
  if (direction === "forward") {
    const transformed = def.transform(result.value, result);
    if (transformed instanceof Promise) {
      return transformed.then((value) => handleCodecTxResult(result, value, def.out, ctx));
    }
    return handleCodecTxResult(result, transformed, def.out, ctx);
  } else {
    const transformed = def.reverseTransform(result.value, result);
    if (transformed instanceof Promise) {
      return transformed.then((value) => handleCodecTxResult(result, value, def.in, ctx));
    }
    return handleCodecTxResult(result, transformed, def.in, ctx);
  }
}
function handleCodecTxResult(left, value, nextSchema, ctx) {
  if (left.issues.length) {
    left.aborted = true;
    return left;
  }
  return nextSchema._zod.run({ value, issues: left.issues }, ctx);
}
function handleReadonlyResult(payload) {
  payload.value = Object.freeze(payload.value);
  return payload;
}
function handleRefineResult(result, payload, input, inst) {
  if (!result) {
    const _iss = {
      code: "custom",
      input,
      inst,
      path: [...inst._zod.def.path ?? []],
      continue: !inst._zod.def.abort
    };
    if (inst._zod.def.params)
      _iss.params = inst._zod.def.params;
    payload.issues.push(issue(_iss));
  }
}
var $ZodType, $ZodString, $ZodStringFormat, $ZodGUID, $ZodUUID, $ZodEmail, $ZodURL, $ZodEmoji, $ZodNanoID, $ZodCUID, $ZodCUID2, $ZodULID, $ZodXID, $ZodKSUID, $ZodISODateTime, $ZodISODate, $ZodISOTime, $ZodISODuration, $ZodIPv4, $ZodIPv6, $ZodCIDRv4, $ZodCIDRv6, $ZodBase64, $ZodBase64URL, $ZodE164, $ZodJWT, $ZodCustomStringFormat, $ZodNumber, $ZodNumberFormat, $ZodBoolean, $ZodBigInt, $ZodBigIntFormat, $ZodSymbol, $ZodUndefined, $ZodNull, $ZodAny, $ZodUnknown, $ZodNever, $ZodVoid, $ZodDate, $ZodArray, $ZodObject, $ZodObjectJIT, $ZodUnion, $ZodDiscriminatedUnion, $ZodIntersection, $ZodTuple, $ZodRecord, $ZodMap, $ZodSet, $ZodEnum, $ZodLiteral, $ZodFile, $ZodTransform, $ZodOptional, $ZodNullable, $ZodDefault, $ZodPrefault, $ZodNonOptional, $ZodSuccess, $ZodCatch, $ZodNaN, $ZodPipe, $ZodCodec, $ZodReadonly, $ZodTemplateLiteral, $ZodFunction, $ZodPromise, $ZodLazy, $ZodCustom;
var init_schemas = __esm(() => {
  init_checks();
  init_core();
  init_parse();
  init_regexes();
  init_util();
  init_versions();
  init_util();
  $ZodType = /* @__PURE__ */ $constructor("$ZodType", (inst, def) => {
    var _a;
    inst ?? (inst = {});
    inst._zod.def = def;
    inst._zod.bag = inst._zod.bag || {};
    inst._zod.version = version;
    const checks = [...inst._zod.def.checks ?? []];
    if (inst._zod.traits.has("$ZodCheck")) {
      checks.unshift(inst);
    }
    for (const ch of checks) {
      for (const fn of ch._zod.onattach) {
        fn(inst);
      }
    }
    if (checks.length === 0) {
      (_a = inst._zod).deferred ?? (_a.deferred = []);
      inst._zod.deferred?.push(() => {
        inst._zod.run = inst._zod.parse;
      });
    } else {
      const runChecks = (payload, checks2, ctx) => {
        let isAborted = aborted(payload);
        let asyncResult;
        for (const ch of checks2) {
          if (ch._zod.def.when) {
            const shouldRun = ch._zod.def.when(payload);
            if (!shouldRun)
              continue;
          } else if (isAborted) {
            continue;
          }
          const currLen = payload.issues.length;
          const _ = ch._zod.check(payload);
          if (_ instanceof Promise && ctx?.async === false) {
            throw new $ZodAsyncError;
          }
          if (asyncResult || _ instanceof Promise) {
            asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
              await _;
              const nextLen = payload.issues.length;
              if (nextLen === currLen)
                return;
              if (!isAborted)
                isAborted = aborted(payload, currLen);
            });
          } else {
            const nextLen = payload.issues.length;
            if (nextLen === currLen)
              continue;
            if (!isAborted)
              isAborted = aborted(payload, currLen);
          }
        }
        if (asyncResult) {
          return asyncResult.then(() => {
            return payload;
          });
        }
        return payload;
      };
      const handleCanaryResult = (canary, payload, ctx) => {
        if (aborted(canary)) {
          canary.aborted = true;
          return canary;
        }
        const checkResult = runChecks(payload, checks, ctx);
        if (checkResult instanceof Promise) {
          if (ctx.async === false)
            throw new $ZodAsyncError;
          return checkResult.then((checkResult2) => inst._zod.parse(checkResult2, ctx));
        }
        return inst._zod.parse(checkResult, ctx);
      };
      inst._zod.run = (payload, ctx) => {
        if (ctx.skipChecks) {
          return inst._zod.parse(payload, ctx);
        }
        if (ctx.direction === "backward") {
          const canary = inst._zod.parse({ value: payload.value, issues: [] }, { ...ctx, skipChecks: true });
          if (canary instanceof Promise) {
            return canary.then((canary2) => {
              return handleCanaryResult(canary2, payload, ctx);
            });
          }
          return handleCanaryResult(canary, payload, ctx);
        }
        const result = inst._zod.parse(payload, ctx);
        if (result instanceof Promise) {
          if (ctx.async === false)
            throw new $ZodAsyncError;
          return result.then((result2) => runChecks(result2, checks, ctx));
        }
        return runChecks(result, checks, ctx);
      };
    }
    inst["~standard"] = {
      validate: (value) => {
        try {
          const r = safeParse(inst, value);
          return r.success ? { value: r.data } : { issues: r.error?.issues };
        } catch (_) {
          return safeParseAsync(inst, value).then((r) => r.success ? { value: r.data } : { issues: r.error?.issues });
        }
      },
      vendor: "zod",
      version: 1
    };
  });
  $ZodString = /* @__PURE__ */ $constructor("$ZodString", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = [...inst?._zod.bag?.patterns ?? []].pop() ?? string(inst._zod.bag);
    inst._zod.parse = (payload, _) => {
      if (def.coerce)
        try {
          payload.value = String(payload.value);
        } catch (_2) {}
      if (typeof payload.value === "string")
        return payload;
      payload.issues.push({
        expected: "string",
        code: "invalid_type",
        input: payload.value,
        inst
      });
      return payload;
    };
  });
  $ZodStringFormat = /* @__PURE__ */ $constructor("$ZodStringFormat", (inst, def) => {
    $ZodCheckStringFormat.init(inst, def);
    $ZodString.init(inst, def);
  });
  $ZodGUID = /* @__PURE__ */ $constructor("$ZodGUID", (inst, def) => {
    def.pattern ?? (def.pattern = guid);
    $ZodStringFormat.init(inst, def);
  });
  $ZodUUID = /* @__PURE__ */ $constructor("$ZodUUID", (inst, def) => {
    if (def.version) {
      const versionMap = {
        v1: 1,
        v2: 2,
        v3: 3,
        v4: 4,
        v5: 5,
        v6: 6,
        v7: 7,
        v8: 8
      };
      const v = versionMap[def.version];
      if (v === undefined)
        throw new Error(`Invalid UUID version: "${def.version}"`);
      def.pattern ?? (def.pattern = uuid(v));
    } else
      def.pattern ?? (def.pattern = uuid());
    $ZodStringFormat.init(inst, def);
  });
  $ZodEmail = /* @__PURE__ */ $constructor("$ZodEmail", (inst, def) => {
    def.pattern ?? (def.pattern = email);
    $ZodStringFormat.init(inst, def);
  });
  $ZodURL = /* @__PURE__ */ $constructor("$ZodURL", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      try {
        const trimmed = payload.value.trim();
        const url = new URL(trimmed);
        if (def.hostname) {
          def.hostname.lastIndex = 0;
          if (!def.hostname.test(url.hostname)) {
            payload.issues.push({
              code: "invalid_format",
              format: "url",
              note: "Invalid hostname",
              pattern: hostname.source,
              input: payload.value,
              inst,
              continue: !def.abort
            });
          }
        }
        if (def.protocol) {
          def.protocol.lastIndex = 0;
          if (!def.protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol)) {
            payload.issues.push({
              code: "invalid_format",
              format: "url",
              note: "Invalid protocol",
              pattern: def.protocol.source,
              input: payload.value,
              inst,
              continue: !def.abort
            });
          }
        }
        if (def.normalize) {
          payload.value = url.href;
        } else {
          payload.value = trimmed;
        }
        return;
      } catch (_) {
        payload.issues.push({
          code: "invalid_format",
          format: "url",
          input: payload.value,
          inst,
          continue: !def.abort
        });
      }
    };
  });
  $ZodEmoji = /* @__PURE__ */ $constructor("$ZodEmoji", (inst, def) => {
    def.pattern ?? (def.pattern = emoji());
    $ZodStringFormat.init(inst, def);
  });
  $ZodNanoID = /* @__PURE__ */ $constructor("$ZodNanoID", (inst, def) => {
    def.pattern ?? (def.pattern = nanoid);
    $ZodStringFormat.init(inst, def);
  });
  $ZodCUID = /* @__PURE__ */ $constructor("$ZodCUID", (inst, def) => {
    def.pattern ?? (def.pattern = cuid);
    $ZodStringFormat.init(inst, def);
  });
  $ZodCUID2 = /* @__PURE__ */ $constructor("$ZodCUID2", (inst, def) => {
    def.pattern ?? (def.pattern = cuid2);
    $ZodStringFormat.init(inst, def);
  });
  $ZodULID = /* @__PURE__ */ $constructor("$ZodULID", (inst, def) => {
    def.pattern ?? (def.pattern = ulid);
    $ZodStringFormat.init(inst, def);
  });
  $ZodXID = /* @__PURE__ */ $constructor("$ZodXID", (inst, def) => {
    def.pattern ?? (def.pattern = xid);
    $ZodStringFormat.init(inst, def);
  });
  $ZodKSUID = /* @__PURE__ */ $constructor("$ZodKSUID", (inst, def) => {
    def.pattern ?? (def.pattern = ksuid);
    $ZodStringFormat.init(inst, def);
  });
  $ZodISODateTime = /* @__PURE__ */ $constructor("$ZodISODateTime", (inst, def) => {
    def.pattern ?? (def.pattern = datetime(def));
    $ZodStringFormat.init(inst, def);
  });
  $ZodISODate = /* @__PURE__ */ $constructor("$ZodISODate", (inst, def) => {
    def.pattern ?? (def.pattern = date);
    $ZodStringFormat.init(inst, def);
  });
  $ZodISOTime = /* @__PURE__ */ $constructor("$ZodISOTime", (inst, def) => {
    def.pattern ?? (def.pattern = time(def));
    $ZodStringFormat.init(inst, def);
  });
  $ZodISODuration = /* @__PURE__ */ $constructor("$ZodISODuration", (inst, def) => {
    def.pattern ?? (def.pattern = duration);
    $ZodStringFormat.init(inst, def);
  });
  $ZodIPv4 = /* @__PURE__ */ $constructor("$ZodIPv4", (inst, def) => {
    def.pattern ?? (def.pattern = ipv4);
    $ZodStringFormat.init(inst, def);
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      bag.format = `ipv4`;
    });
  });
  $ZodIPv6 = /* @__PURE__ */ $constructor("$ZodIPv6", (inst, def) => {
    def.pattern ?? (def.pattern = ipv6);
    $ZodStringFormat.init(inst, def);
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      bag.format = `ipv6`;
    });
    inst._zod.check = (payload) => {
      try {
        new URL(`http://[${payload.value}]`);
      } catch {
        payload.issues.push({
          code: "invalid_format",
          format: "ipv6",
          input: payload.value,
          inst,
          continue: !def.abort
        });
      }
    };
  });
  $ZodCIDRv4 = /* @__PURE__ */ $constructor("$ZodCIDRv4", (inst, def) => {
    def.pattern ?? (def.pattern = cidrv4);
    $ZodStringFormat.init(inst, def);
  });
  $ZodCIDRv6 = /* @__PURE__ */ $constructor("$ZodCIDRv6", (inst, def) => {
    def.pattern ?? (def.pattern = cidrv6);
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      const parts = payload.value.split("/");
      try {
        if (parts.length !== 2)
          throw new Error;
        const [address, prefix] = parts;
        if (!prefix)
          throw new Error;
        const prefixNum = Number(prefix);
        if (`${prefixNum}` !== prefix)
          throw new Error;
        if (prefixNum < 0 || prefixNum > 128)
          throw new Error;
        new URL(`http://[${address}]`);
      } catch {
        payload.issues.push({
          code: "invalid_format",
          format: "cidrv6",
          input: payload.value,
          inst,
          continue: !def.abort
        });
      }
    };
  });
  $ZodBase64 = /* @__PURE__ */ $constructor("$ZodBase64", (inst, def) => {
    def.pattern ?? (def.pattern = base64);
    $ZodStringFormat.init(inst, def);
    inst._zod.onattach.push((inst2) => {
      inst2._zod.bag.contentEncoding = "base64";
    });
    inst._zod.check = (payload) => {
      if (isValidBase64(payload.value))
        return;
      payload.issues.push({
        code: "invalid_format",
        format: "base64",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodBase64URL = /* @__PURE__ */ $constructor("$ZodBase64URL", (inst, def) => {
    def.pattern ?? (def.pattern = base64url);
    $ZodStringFormat.init(inst, def);
    inst._zod.onattach.push((inst2) => {
      inst2._zod.bag.contentEncoding = "base64url";
    });
    inst._zod.check = (payload) => {
      if (isValidBase64URL(payload.value))
        return;
      payload.issues.push({
        code: "invalid_format",
        format: "base64url",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodE164 = /* @__PURE__ */ $constructor("$ZodE164", (inst, def) => {
    def.pattern ?? (def.pattern = e164);
    $ZodStringFormat.init(inst, def);
  });
  $ZodJWT = /* @__PURE__ */ $constructor("$ZodJWT", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      if (isValidJWT(payload.value, def.alg))
        return;
      payload.issues.push({
        code: "invalid_format",
        format: "jwt",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCustomStringFormat = /* @__PURE__ */ $constructor("$ZodCustomStringFormat", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      if (def.fn(payload.value))
        return;
      payload.issues.push({
        code: "invalid_format",
        format: def.format,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodNumber = /* @__PURE__ */ $constructor("$ZodNumber", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = inst._zod.bag.pattern ?? number;
    inst._zod.parse = (payload, _ctx) => {
      if (def.coerce)
        try {
          payload.value = Number(payload.value);
        } catch (_) {}
      const input = payload.value;
      if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
        return payload;
      }
      const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? "Infinity" : undefined : undefined;
      payload.issues.push({
        expected: "number",
        code: "invalid_type",
        input,
        inst,
        ...received ? { received } : {}
      });
      return payload;
    };
  });
  $ZodNumberFormat = /* @__PURE__ */ $constructor("$ZodNumber", (inst, def) => {
    $ZodCheckNumberFormat.init(inst, def);
    $ZodNumber.init(inst, def);
  });
  $ZodBoolean = /* @__PURE__ */ $constructor("$ZodBoolean", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = boolean;
    inst._zod.parse = (payload, _ctx) => {
      if (def.coerce)
        try {
          payload.value = Boolean(payload.value);
        } catch (_) {}
      const input = payload.value;
      if (typeof input === "boolean")
        return payload;
      payload.issues.push({
        expected: "boolean",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    };
  });
  $ZodBigInt = /* @__PURE__ */ $constructor("$ZodBigInt", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = bigint;
    inst._zod.parse = (payload, _ctx) => {
      if (def.coerce)
        try {
          payload.value = BigInt(payload.value);
        } catch (_) {}
      if (typeof payload.value === "bigint")
        return payload;
      payload.issues.push({
        expected: "bigint",
        code: "invalid_type",
        input: payload.value,
        inst
      });
      return payload;
    };
  });
  $ZodBigIntFormat = /* @__PURE__ */ $constructor("$ZodBigInt", (inst, def) => {
    $ZodCheckBigIntFormat.init(inst, def);
    $ZodBigInt.init(inst, def);
  });
  $ZodSymbol = /* @__PURE__ */ $constructor("$ZodSymbol", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
      const input = payload.value;
      if (typeof input === "symbol")
        return payload;
      payload.issues.push({
        expected: "symbol",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    };
  });
  $ZodUndefined = /* @__PURE__ */ $constructor("$ZodUndefined", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = _undefined;
    inst._zod.values = new Set([undefined]);
    inst._zod.optin = "optional";
    inst._zod.optout = "optional";
    inst._zod.parse = (payload, _ctx) => {
      const input = payload.value;
      if (typeof input === "undefined")
        return payload;
      payload.issues.push({
        expected: "undefined",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    };
  });
  $ZodNull = /* @__PURE__ */ $constructor("$ZodNull", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = _null;
    inst._zod.values = new Set([null]);
    inst._zod.parse = (payload, _ctx) => {
      const input = payload.value;
      if (input === null)
        return payload;
      payload.issues.push({
        expected: "null",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    };
  });
  $ZodAny = /* @__PURE__ */ $constructor("$ZodAny", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload) => payload;
  });
  $ZodUnknown = /* @__PURE__ */ $constructor("$ZodUnknown", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload) => payload;
  });
  $ZodNever = /* @__PURE__ */ $constructor("$ZodNever", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
      payload.issues.push({
        expected: "never",
        code: "invalid_type",
        input: payload.value,
        inst
      });
      return payload;
    };
  });
  $ZodVoid = /* @__PURE__ */ $constructor("$ZodVoid", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
      const input = payload.value;
      if (typeof input === "undefined")
        return payload;
      payload.issues.push({
        expected: "void",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    };
  });
  $ZodDate = /* @__PURE__ */ $constructor("$ZodDate", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
      if (def.coerce) {
        try {
          payload.value = new Date(payload.value);
        } catch (_err) {}
      }
      const input = payload.value;
      const isDate = input instanceof Date;
      const isValidDate = isDate && !Number.isNaN(input.getTime());
      if (isValidDate)
        return payload;
      payload.issues.push({
        expected: "date",
        code: "invalid_type",
        input,
        ...isDate ? { received: "Invalid Date" } : {},
        inst
      });
      return payload;
    };
  });
  $ZodArray = /* @__PURE__ */ $constructor("$ZodArray", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
      const input = payload.value;
      if (!Array.isArray(input)) {
        payload.issues.push({
          expected: "array",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      }
      payload.value = Array(input.length);
      const proms = [];
      for (let i = 0;i < input.length; i++) {
        const item = input[i];
        const result = def.element._zod.run({
          value: item,
          issues: []
        }, ctx);
        if (result instanceof Promise) {
          proms.push(result.then((result2) => handleArrayResult(result2, payload, i)));
        } else {
          handleArrayResult(result, payload, i);
        }
      }
      if (proms.length) {
        return Promise.all(proms).then(() => payload);
      }
      return payload;
    };
  });
  $ZodObject = /* @__PURE__ */ $constructor("$ZodObject", (inst, def) => {
    $ZodType.init(inst, def);
    const desc = Object.getOwnPropertyDescriptor(def, "shape");
    if (!desc?.get) {
      const sh = def.shape;
      Object.defineProperty(def, "shape", {
        get: () => {
          const newSh = { ...sh };
          Object.defineProperty(def, "shape", {
            value: newSh
          });
          return newSh;
        }
      });
    }
    const _normalized = cached(() => normalizeDef(def));
    defineLazy(inst._zod, "propValues", () => {
      const shape = def.shape;
      const propValues = {};
      for (const key in shape) {
        const field = shape[key]._zod;
        if (field.values) {
          propValues[key] ?? (propValues[key] = new Set);
          for (const v of field.values)
            propValues[key].add(v);
        }
      }
      return propValues;
    });
    const isObject2 = isObject;
    const catchall = def.catchall;
    let value;
    inst._zod.parse = (payload, ctx) => {
      value ?? (value = _normalized.value);
      const input = payload.value;
      if (!isObject2(input)) {
        payload.issues.push({
          expected: "object",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      }
      payload.value = {};
      const proms = [];
      const shape = value.shape;
      for (const key of value.keys) {
        const el = shape[key];
        const r = el._zod.run({ value: input[key], issues: [] }, ctx);
        if (r instanceof Promise) {
          proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input)));
        } else {
          handlePropertyResult(r, payload, key, input);
        }
      }
      if (!catchall) {
        return proms.length ? Promise.all(proms).then(() => payload) : payload;
      }
      return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
    };
  });
  $ZodObjectJIT = /* @__PURE__ */ $constructor("$ZodObjectJIT", (inst, def) => {
    $ZodObject.init(inst, def);
    const superParse = inst._zod.parse;
    const _normalized = cached(() => normalizeDef(def));
    const generateFastpass = (shape) => {
      const doc = new Doc(["shape", "payload", "ctx"]);
      const normalized = _normalized.value;
      const parseStr = (key) => {
        const k = esc(key);
        return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
      };
      doc.write(`const input = payload.value;`);
      const ids = Object.create(null);
      let counter = 0;
      for (const key of normalized.keys) {
        ids[key] = `key_${counter++}`;
      }
      doc.write(`const newResult = {};`);
      for (const key of normalized.keys) {
        const id = ids[key];
        const k = esc(key);
        doc.write(`const ${id} = ${parseStr(key)};`);
        doc.write(`
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
      }
      doc.write(`payload.value = newResult;`);
      doc.write(`return payload;`);
      const fn = doc.compile();
      return (payload, ctx) => fn(shape, payload, ctx);
    };
    let fastpass;
    const isObject2 = isObject;
    const jit = !globalConfig.jitless;
    const allowsEval2 = allowsEval;
    const fastEnabled = jit && allowsEval2.value;
    const catchall = def.catchall;
    let value;
    inst._zod.parse = (payload, ctx) => {
      value ?? (value = _normalized.value);
      const input = payload.value;
      if (!isObject2(input)) {
        payload.issues.push({
          expected: "object",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      }
      if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
        if (!fastpass)
          fastpass = generateFastpass(def.shape);
        payload = fastpass(payload, ctx);
        if (!catchall)
          return payload;
        return handleCatchall([], input, payload, ctx, value, inst);
      }
      return superParse(payload, ctx);
    };
  });
  $ZodUnion = /* @__PURE__ */ $constructor("$ZodUnion", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : undefined);
    defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : undefined);
    defineLazy(inst._zod, "values", () => {
      if (def.options.every((o) => o._zod.values)) {
        return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
      }
      return;
    });
    defineLazy(inst._zod, "pattern", () => {
      if (def.options.every((o) => o._zod.pattern)) {
        const patterns = def.options.map((o) => o._zod.pattern);
        return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
      }
      return;
    });
    const single = def.options.length === 1;
    const first = def.options[0]._zod.run;
    inst._zod.parse = (payload, ctx) => {
      if (single) {
        return first(payload, ctx);
      }
      let async = false;
      const results = [];
      for (const option of def.options) {
        const result = option._zod.run({
          value: payload.value,
          issues: []
        }, ctx);
        if (result instanceof Promise) {
          results.push(result);
          async = true;
        } else {
          if (result.issues.length === 0)
            return result;
          results.push(result);
        }
      }
      if (!async)
        return handleUnionResults(results, payload, inst, ctx);
      return Promise.all(results).then((results2) => {
        return handleUnionResults(results2, payload, inst, ctx);
      });
    };
  });
  $ZodDiscriminatedUnion = /* @__PURE__ */ $constructor("$ZodDiscriminatedUnion", (inst, def) => {
    $ZodUnion.init(inst, def);
    const _super = inst._zod.parse;
    defineLazy(inst._zod, "propValues", () => {
      const propValues = {};
      for (const option of def.options) {
        const pv = option._zod.propValues;
        if (!pv || Object.keys(pv).length === 0)
          throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(option)}"`);
        for (const [k, v] of Object.entries(pv)) {
          if (!propValues[k])
            propValues[k] = new Set;
          for (const val of v) {
            propValues[k].add(val);
          }
        }
      }
      return propValues;
    });
    const disc = cached(() => {
      const opts = def.options;
      const map = new Map;
      for (const o of opts) {
        const values = o._zod.propValues?.[def.discriminator];
        if (!values || values.size === 0)
          throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(o)}"`);
        for (const v of values) {
          if (map.has(v)) {
            throw new Error(`Duplicate discriminator value "${String(v)}"`);
          }
          map.set(v, o);
        }
      }
      return map;
    });
    inst._zod.parse = (payload, ctx) => {
      const input = payload.value;
      if (!isObject(input)) {
        payload.issues.push({
          code: "invalid_type",
          expected: "object",
          input,
          inst
        });
        return payload;
      }
      const opt = disc.value.get(input?.[def.discriminator]);
      if (opt) {
        return opt._zod.run(payload, ctx);
      }
      if (def.unionFallback) {
        return _super(payload, ctx);
      }
      payload.issues.push({
        code: "invalid_union",
        errors: [],
        note: "No matching discriminator",
        discriminator: def.discriminator,
        input,
        path: [def.discriminator],
        inst
      });
      return payload;
    };
  });
  $ZodIntersection = /* @__PURE__ */ $constructor("$ZodIntersection", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
      const input = payload.value;
      const left = def.left._zod.run({ value: input, issues: [] }, ctx);
      const right = def.right._zod.run({ value: input, issues: [] }, ctx);
      const async = left instanceof Promise || right instanceof Promise;
      if (async) {
        return Promise.all([left, right]).then(([left2, right2]) => {
          return handleIntersectionResults(payload, left2, right2);
        });
      }
      return handleIntersectionResults(payload, left, right);
    };
  });
  $ZodTuple = /* @__PURE__ */ $constructor("$ZodTuple", (inst, def) => {
    $ZodType.init(inst, def);
    const items = def.items;
    const optStart = items.length - [...items].reverse().findIndex((item) => item._zod.optin !== "optional");
    inst._zod.parse = (payload, ctx) => {
      const input = payload.value;
      if (!Array.isArray(input)) {
        payload.issues.push({
          input,
          inst,
          expected: "tuple",
          code: "invalid_type"
        });
        return payload;
      }
      payload.value = [];
      const proms = [];
      if (!def.rest) {
        const tooBig = input.length > items.length;
        const tooSmall = input.length < optStart - 1;
        if (tooBig || tooSmall) {
          payload.issues.push({
            ...tooBig ? { code: "too_big", maximum: items.length } : { code: "too_small", minimum: items.length },
            input,
            inst,
            origin: "array"
          });
          return payload;
        }
      }
      let i = -1;
      for (const item of items) {
        i++;
        if (i >= input.length) {
          if (i >= optStart)
            continue;
        }
        const result = item._zod.run({
          value: input[i],
          issues: []
        }, ctx);
        if (result instanceof Promise) {
          proms.push(result.then((result2) => handleTupleResult(result2, payload, i)));
        } else {
          handleTupleResult(result, payload, i);
        }
      }
      if (def.rest) {
        const rest = input.slice(items.length);
        for (const el of rest) {
          i++;
          const result = def.rest._zod.run({
            value: el,
            issues: []
          }, ctx);
          if (result instanceof Promise) {
            proms.push(result.then((result2) => handleTupleResult(result2, payload, i)));
          } else {
            handleTupleResult(result, payload, i);
          }
        }
      }
      if (proms.length)
        return Promise.all(proms).then(() => payload);
      return payload;
    };
  });
  $ZodRecord = /* @__PURE__ */ $constructor("$ZodRecord", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
      const input = payload.value;
      if (!isPlainObject(input)) {
        payload.issues.push({
          expected: "record",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      }
      const proms = [];
      if (def.keyType._zod.values) {
        const values = def.keyType._zod.values;
        payload.value = {};
        for (const key of values) {
          if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
            const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
            if (result instanceof Promise) {
              proms.push(result.then((result2) => {
                if (result2.issues.length) {
                  payload.issues.push(...prefixIssues(key, result2.issues));
                }
                payload.value[key] = result2.value;
              }));
            } else {
              if (result.issues.length) {
                payload.issues.push(...prefixIssues(key, result.issues));
              }
              payload.value[key] = result.value;
            }
          }
        }
        let unrecognized;
        for (const key in input) {
          if (!values.has(key)) {
            unrecognized = unrecognized ?? [];
            unrecognized.push(key);
          }
        }
        if (unrecognized && unrecognized.length > 0) {
          payload.issues.push({
            code: "unrecognized_keys",
            input,
            inst,
            keys: unrecognized
          });
        }
      } else {
        payload.value = {};
        for (const key of Reflect.ownKeys(input)) {
          if (key === "__proto__")
            continue;
          const keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
          if (keyResult instanceof Promise) {
            throw new Error("Async schemas not supported in object keys currently");
          }
          if (keyResult.issues.length) {
            payload.issues.push({
              code: "invalid_key",
              origin: "record",
              issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
              input: key,
              path: [key],
              inst
            });
            payload.value[keyResult.value] = keyResult.value;
            continue;
          }
          const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
          if (result instanceof Promise) {
            proms.push(result.then((result2) => {
              if (result2.issues.length) {
                payload.issues.push(...prefixIssues(key, result2.issues));
              }
              payload.value[keyResult.value] = result2.value;
            }));
          } else {
            if (result.issues.length) {
              payload.issues.push(...prefixIssues(key, result.issues));
            }
            payload.value[keyResult.value] = result.value;
          }
        }
      }
      if (proms.length) {
        return Promise.all(proms).then(() => payload);
      }
      return payload;
    };
  });
  $ZodMap = /* @__PURE__ */ $constructor("$ZodMap", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
      const input = payload.value;
      if (!(input instanceof Map)) {
        payload.issues.push({
          expected: "map",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      }
      const proms = [];
      payload.value = new Map;
      for (const [key, value] of input) {
        const keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
        const valueResult = def.valueType._zod.run({ value, issues: [] }, ctx);
        if (keyResult instanceof Promise || valueResult instanceof Promise) {
          proms.push(Promise.all([keyResult, valueResult]).then(([keyResult2, valueResult2]) => {
            handleMapResult(keyResult2, valueResult2, payload, key, input, inst, ctx);
          }));
        } else {
          handleMapResult(keyResult, valueResult, payload, key, input, inst, ctx);
        }
      }
      if (proms.length)
        return Promise.all(proms).then(() => payload);
      return payload;
    };
  });
  $ZodSet = /* @__PURE__ */ $constructor("$ZodSet", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
      const input = payload.value;
      if (!(input instanceof Set)) {
        payload.issues.push({
          input,
          inst,
          expected: "set",
          code: "invalid_type"
        });
        return payload;
      }
      const proms = [];
      payload.value = new Set;
      for (const item of input) {
        const result = def.valueType._zod.run({ value: item, issues: [] }, ctx);
        if (result instanceof Promise) {
          proms.push(result.then((result2) => handleSetResult(result2, payload)));
        } else
          handleSetResult(result, payload);
      }
      if (proms.length)
        return Promise.all(proms).then(() => payload);
      return payload;
    };
  });
  $ZodEnum = /* @__PURE__ */ $constructor("$ZodEnum", (inst, def) => {
    $ZodType.init(inst, def);
    const values = getEnumValues(def.entries);
    const valuesSet = new Set(values);
    inst._zod.values = valuesSet;
    inst._zod.pattern = new RegExp(`^(${values.filter((k) => propertyKeyTypes.has(typeof k)).map((o) => typeof o === "string" ? escapeRegex(o) : o.toString()).join("|")})$`);
    inst._zod.parse = (payload, _ctx) => {
      const input = payload.value;
      if (valuesSet.has(input)) {
        return payload;
      }
      payload.issues.push({
        code: "invalid_value",
        values,
        input,
        inst
      });
      return payload;
    };
  });
  $ZodLiteral = /* @__PURE__ */ $constructor("$ZodLiteral", (inst, def) => {
    $ZodType.init(inst, def);
    if (def.values.length === 0) {
      throw new Error("Cannot create literal schema with no valid values");
    }
    inst._zod.values = new Set(def.values);
    inst._zod.pattern = new RegExp(`^(${def.values.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$`);
    inst._zod.parse = (payload, _ctx) => {
      const input = payload.value;
      if (inst._zod.values.has(input)) {
        return payload;
      }
      payload.issues.push({
        code: "invalid_value",
        values: def.values,
        input,
        inst
      });
      return payload;
    };
  });
  $ZodFile = /* @__PURE__ */ $constructor("$ZodFile", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
      const input = payload.value;
      if (input instanceof File)
        return payload;
      payload.issues.push({
        expected: "file",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    };
  });
  $ZodTransform = /* @__PURE__ */ $constructor("$ZodTransform", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
      if (ctx.direction === "backward") {
        throw new $ZodEncodeError(inst.constructor.name);
      }
      const _out = def.transform(payload.value, payload);
      if (ctx.async) {
        const output = _out instanceof Promise ? _out : Promise.resolve(_out);
        return output.then((output2) => {
          payload.value = output2;
          return payload;
        });
      }
      if (_out instanceof Promise) {
        throw new $ZodAsyncError;
      }
      payload.value = _out;
      return payload;
    };
  });
  $ZodOptional = /* @__PURE__ */ $constructor("$ZodOptional", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.optin = "optional";
    inst._zod.optout = "optional";
    defineLazy(inst._zod, "values", () => {
      return def.innerType._zod.values ? new Set([...def.innerType._zod.values, undefined]) : undefined;
    });
    defineLazy(inst._zod, "pattern", () => {
      const pattern = def.innerType._zod.pattern;
      return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : undefined;
    });
    inst._zod.parse = (payload, ctx) => {
      if (def.innerType._zod.optin === "optional") {
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise)
          return result.then((r) => handleOptionalResult(r, payload.value));
        return handleOptionalResult(result, payload.value);
      }
      if (payload.value === undefined) {
        return payload;
      }
      return def.innerType._zod.run(payload, ctx);
    };
  });
  $ZodNullable = /* @__PURE__ */ $constructor("$ZodNullable", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
    defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
    defineLazy(inst._zod, "pattern", () => {
      const pattern = def.innerType._zod.pattern;
      return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : undefined;
    });
    defineLazy(inst._zod, "values", () => {
      return def.innerType._zod.values ? new Set([...def.innerType._zod.values, null]) : undefined;
    });
    inst._zod.parse = (payload, ctx) => {
      if (payload.value === null)
        return payload;
      return def.innerType._zod.run(payload, ctx);
    };
  });
  $ZodDefault = /* @__PURE__ */ $constructor("$ZodDefault", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.optin = "optional";
    defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    inst._zod.parse = (payload, ctx) => {
      if (ctx.direction === "backward") {
        return def.innerType._zod.run(payload, ctx);
      }
      if (payload.value === undefined) {
        payload.value = def.defaultValue;
        return payload;
      }
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise) {
        return result.then((result2) => handleDefaultResult(result2, def));
      }
      return handleDefaultResult(result, def);
    };
  });
  $ZodPrefault = /* @__PURE__ */ $constructor("$ZodPrefault", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.optin = "optional";
    defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    inst._zod.parse = (payload, ctx) => {
      if (ctx.direction === "backward") {
        return def.innerType._zod.run(payload, ctx);
      }
      if (payload.value === undefined) {
        payload.value = def.defaultValue;
      }
      return def.innerType._zod.run(payload, ctx);
    };
  });
  $ZodNonOptional = /* @__PURE__ */ $constructor("$ZodNonOptional", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "values", () => {
      const v = def.innerType._zod.values;
      return v ? new Set([...v].filter((x) => x !== undefined)) : undefined;
    });
    inst._zod.parse = (payload, ctx) => {
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise) {
        return result.then((result2) => handleNonOptionalResult(result2, inst));
      }
      return handleNonOptionalResult(result, inst);
    };
  });
  $ZodSuccess = /* @__PURE__ */ $constructor("$ZodSuccess", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
      if (ctx.direction === "backward") {
        throw new $ZodEncodeError("ZodSuccess");
      }
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise) {
        return result.then((result2) => {
          payload.value = result2.issues.length === 0;
          return payload;
        });
      }
      payload.value = result.issues.length === 0;
      return payload;
    };
  });
  $ZodCatch = /* @__PURE__ */ $constructor("$ZodCatch", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
    defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
    defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    inst._zod.parse = (payload, ctx) => {
      if (ctx.direction === "backward") {
        return def.innerType._zod.run(payload, ctx);
      }
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise) {
        return result.then((result2) => {
          payload.value = result2.value;
          if (result2.issues.length) {
            payload.value = def.catchValue({
              ...payload,
              error: {
                issues: result2.issues.map((iss) => finalizeIssue(iss, ctx, config()))
              },
              input: payload.value
            });
            payload.issues = [];
          }
          return payload;
        });
      }
      payload.value = result.value;
      if (result.issues.length) {
        payload.value = def.catchValue({
          ...payload,
          error: {
            issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config()))
          },
          input: payload.value
        });
        payload.issues = [];
      }
      return payload;
    };
  });
  $ZodNaN = /* @__PURE__ */ $constructor("$ZodNaN", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
      if (typeof payload.value !== "number" || !Number.isNaN(payload.value)) {
        payload.issues.push({
          input: payload.value,
          inst,
          expected: "nan",
          code: "invalid_type"
        });
        return payload;
      }
      return payload;
    };
  });
  $ZodPipe = /* @__PURE__ */ $constructor("$ZodPipe", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "values", () => def.in._zod.values);
    defineLazy(inst._zod, "optin", () => def.in._zod.optin);
    defineLazy(inst._zod, "optout", () => def.out._zod.optout);
    defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
    inst._zod.parse = (payload, ctx) => {
      if (ctx.direction === "backward") {
        const right = def.out._zod.run(payload, ctx);
        if (right instanceof Promise) {
          return right.then((right2) => handlePipeResult(right2, def.in, ctx));
        }
        return handlePipeResult(right, def.in, ctx);
      }
      const left = def.in._zod.run(payload, ctx);
      if (left instanceof Promise) {
        return left.then((left2) => handlePipeResult(left2, def.out, ctx));
      }
      return handlePipeResult(left, def.out, ctx);
    };
  });
  $ZodCodec = /* @__PURE__ */ $constructor("$ZodCodec", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "values", () => def.in._zod.values);
    defineLazy(inst._zod, "optin", () => def.in._zod.optin);
    defineLazy(inst._zod, "optout", () => def.out._zod.optout);
    defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
    inst._zod.parse = (payload, ctx) => {
      const direction = ctx.direction || "forward";
      if (direction === "forward") {
        const left = def.in._zod.run(payload, ctx);
        if (left instanceof Promise) {
          return left.then((left2) => handleCodecAResult(left2, def, ctx));
        }
        return handleCodecAResult(left, def, ctx);
      } else {
        const right = def.out._zod.run(payload, ctx);
        if (right instanceof Promise) {
          return right.then((right2) => handleCodecAResult(right2, def, ctx));
        }
        return handleCodecAResult(right, def, ctx);
      }
    };
  });
  $ZodReadonly = /* @__PURE__ */ $constructor("$ZodReadonly", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "propValues", () => def.innerType._zod.propValues);
    defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
    defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
    inst._zod.parse = (payload, ctx) => {
      if (ctx.direction === "backward") {
        return def.innerType._zod.run(payload, ctx);
      }
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise) {
        return result.then(handleReadonlyResult);
      }
      return handleReadonlyResult(result);
    };
  });
  $ZodTemplateLiteral = /* @__PURE__ */ $constructor("$ZodTemplateLiteral", (inst, def) => {
    $ZodType.init(inst, def);
    const regexParts = [];
    for (const part of def.parts) {
      if (typeof part === "object" && part !== null) {
        if (!part._zod.pattern) {
          throw new Error(`Invalid template literal part, no pattern found: ${[...part._zod.traits].shift()}`);
        }
        const source = part._zod.pattern instanceof RegExp ? part._zod.pattern.source : part._zod.pattern;
        if (!source)
          throw new Error(`Invalid template literal part: ${part._zod.traits}`);
        const start = source.startsWith("^") ? 1 : 0;
        const end = source.endsWith("$") ? source.length - 1 : source.length;
        regexParts.push(source.slice(start, end));
      } else if (part === null || primitiveTypes.has(typeof part)) {
        regexParts.push(escapeRegex(`${part}`));
      } else {
        throw new Error(`Invalid template literal part: ${part}`);
      }
    }
    inst._zod.pattern = new RegExp(`^${regexParts.join("")}$`);
    inst._zod.parse = (payload, _ctx) => {
      if (typeof payload.value !== "string") {
        payload.issues.push({
          input: payload.value,
          inst,
          expected: "template_literal",
          code: "invalid_type"
        });
        return payload;
      }
      inst._zod.pattern.lastIndex = 0;
      if (!inst._zod.pattern.test(payload.value)) {
        payload.issues.push({
          input: payload.value,
          inst,
          code: "invalid_format",
          format: def.format ?? "template_literal",
          pattern: inst._zod.pattern.source
        });
        return payload;
      }
      return payload;
    };
  });
  $ZodFunction = /* @__PURE__ */ $constructor("$ZodFunction", (inst, def) => {
    $ZodType.init(inst, def);
    inst._def = def;
    inst._zod.def = def;
    inst.implement = (func) => {
      if (typeof func !== "function") {
        throw new Error("implement() must be called with a function");
      }
      return function(...args) {
        const parsedArgs = inst._def.input ? parse(inst._def.input, args) : args;
        const result = Reflect.apply(func, this, parsedArgs);
        if (inst._def.output) {
          return parse(inst._def.output, result);
        }
        return result;
      };
    };
    inst.implementAsync = (func) => {
      if (typeof func !== "function") {
        throw new Error("implementAsync() must be called with a function");
      }
      return async function(...args) {
        const parsedArgs = inst._def.input ? await parseAsync(inst._def.input, args) : args;
        const result = await Reflect.apply(func, this, parsedArgs);
        if (inst._def.output) {
          return await parseAsync(inst._def.output, result);
        }
        return result;
      };
    };
    inst._zod.parse = (payload, _ctx) => {
      if (typeof payload.value !== "function") {
        payload.issues.push({
          code: "invalid_type",
          expected: "function",
          input: payload.value,
          inst
        });
        return payload;
      }
      const hasPromiseOutput = inst._def.output && inst._def.output._zod.def.type === "promise";
      if (hasPromiseOutput) {
        payload.value = inst.implementAsync(payload.value);
      } else {
        payload.value = inst.implement(payload.value);
      }
      return payload;
    };
    inst.input = (...args) => {
      const F = inst.constructor;
      if (Array.isArray(args[0])) {
        return new F({
          type: "function",
          input: new $ZodTuple({
            type: "tuple",
            items: args[0],
            rest: args[1]
          }),
          output: inst._def.output
        });
      }
      return new F({
        type: "function",
        input: args[0],
        output: inst._def.output
      });
    };
    inst.output = (output) => {
      const F = inst.constructor;
      return new F({
        type: "function",
        input: inst._def.input,
        output
      });
    };
    return inst;
  });
  $ZodPromise = /* @__PURE__ */ $constructor("$ZodPromise", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
      return Promise.resolve(payload.value).then((inner) => def.innerType._zod.run({ value: inner, issues: [] }, ctx));
    };
  });
  $ZodLazy = /* @__PURE__ */ $constructor("$ZodLazy", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "innerType", () => def.getter());
    defineLazy(inst._zod, "pattern", () => inst._zod.innerType._zod.pattern);
    defineLazy(inst._zod, "propValues", () => inst._zod.innerType._zod.propValues);
    defineLazy(inst._zod, "optin", () => inst._zod.innerType._zod.optin ?? undefined);
    defineLazy(inst._zod, "optout", () => inst._zod.innerType._zod.optout ?? undefined);
    inst._zod.parse = (payload, ctx) => {
      const inner = inst._zod.innerType;
      return inner._zod.run(payload, ctx);
    };
  });
  $ZodCustom = /* @__PURE__ */ $constructor("$ZodCustom", (inst, def) => {
    $ZodCheck.init(inst, def);
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _) => {
      return payload;
    };
    inst._zod.check = (payload) => {
      const input = payload.value;
      const r = def.fn(input);
      if (r instanceof Promise) {
        return r.then((r2) => handleRefineResult(r2, payload, input, inst));
      }
      handleRefineResult(r, payload, input, inst);
      return;
    };
  });
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/ar.js
function ar_default() {
  return {
    localeError: error()
  };
}
var error = () => {
  const Sizable = {
    string: { unit: "حرف", verb: "أن يحوي" },
    file: { unit: "بايت", verb: "أن يحوي" },
    array: { unit: "عنصر", verb: "أن يحوي" },
    set: { unit: "عنصر", verb: "أن يحوي" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "number";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "array";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "مدخل",
    email: "بريد إلكتروني",
    url: "رابط",
    emoji: "إيموجي",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "تاريخ ووقت بمعيار ISO",
    date: "تاريخ بمعيار ISO",
    time: "وقت بمعيار ISO",
    duration: "مدة بمعيار ISO",
    ipv4: "عنوان IPv4",
    ipv6: "عنوان IPv6",
    cidrv4: "مدى عناوين بصيغة IPv4",
    cidrv6: "مدى عناوين بصيغة IPv6",
    base64: "نَص بترميز base64-encoded",
    base64url: "نَص بترميز base64url-encoded",
    json_string: "نَص على هيئة JSON",
    e164: "رقم هاتف بمعيار E.164",
    jwt: "JWT",
    template_literal: "مدخل"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `مدخلات غير مقبولة: يفترض إدخال ${issue2.expected}، ولكن تم إدخال ${parsedType(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `مدخلات غير مقبولة: يفترض إدخال ${stringifyPrimitive(issue2.values[0])}`;
        return `اختيار غير مقبول: يتوقع انتقاء أحد هذه الخيارات: ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return ` أكبر من اللازم: يفترض أن تكون ${issue2.origin ?? "القيمة"} ${adj} ${issue2.maximum.toString()} ${sizing.unit ?? "عنصر"}`;
        return `أكبر من اللازم: يفترض أن تكون ${issue2.origin ?? "القيمة"} ${adj} ${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `أصغر من اللازم: يفترض لـ ${issue2.origin} أن يكون ${adj} ${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `أصغر من اللازم: يفترض لـ ${issue2.origin} أن يكون ${adj} ${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `نَص غير مقبول: يجب أن يبدأ بـ "${issue2.prefix}"`;
        if (_issue.format === "ends_with")
          return `نَص غير مقبول: يجب أن ينتهي بـ "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `نَص غير مقبول: يجب أن يتضمَّن "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `نَص غير مقبول: يجب أن يطابق النمط ${_issue.pattern}`;
        return `${Nouns[_issue.format] ?? issue2.format} غير مقبول`;
      }
      case "not_multiple_of":
        return `رقم غير مقبول: يجب أن يكون من مضاعفات ${issue2.divisor}`;
      case "unrecognized_keys":
        return `معرف${issue2.keys.length > 1 ? "ات" : ""} غريب${issue2.keys.length > 1 ? "ة" : ""}: ${joinValues(issue2.keys, "، ")}`;
      case "invalid_key":
        return `معرف غير مقبول في ${issue2.origin}`;
      case "invalid_union":
        return "مدخل غير مقبول";
      case "invalid_element":
        return `مدخل غير مقبول في ${issue2.origin}`;
      default:
        return "مدخل غير مقبول";
    }
  };
};
var init_ar = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/az.js
function az_default() {
  return {
    localeError: error2()
  };
}
var error2 = () => {
  const Sizable = {
    string: { unit: "simvol", verb: "olmalıdır" },
    file: { unit: "bayt", verb: "olmalıdır" },
    array: { unit: "element", verb: "olmalıdır" },
    set: { unit: "element", verb: "olmalıdır" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "number";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "array";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "input",
    email: "email address",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO datetime",
    date: "ISO date",
    time: "ISO time",
    duration: "ISO duration",
    ipv4: "IPv4 address",
    ipv6: "IPv6 address",
    cidrv4: "IPv4 range",
    cidrv6: "IPv6 range",
    base64: "base64-encoded string",
    base64url: "base64url-encoded string",
    json_string: "JSON string",
    e164: "E.164 number",
    jwt: "JWT",
    template_literal: "input"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Yanlış dəyər: gözlənilən ${issue2.expected}, daxil olan ${parsedType(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Yanlış dəyər: gözlənilən ${stringifyPrimitive(issue2.values[0])}`;
        return `Yanlış seçim: aşağıdakılardan biri olmalıdır: ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Çox böyük: gözlənilən ${issue2.origin ?? "dəyər"} ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "element"}`;
        return `Çox böyük: gözlənilən ${issue2.origin ?? "dəyər"} ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Çox kiçik: gözlənilən ${issue2.origin} ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        return `Çox kiçik: gözlənilən ${issue2.origin} ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Yanlış mətn: "${_issue.prefix}" ilə başlamalıdır`;
        if (_issue.format === "ends_with")
          return `Yanlış mətn: "${_issue.suffix}" ilə bitməlidir`;
        if (_issue.format === "includes")
          return `Yanlış mətn: "${_issue.includes}" daxil olmalıdır`;
        if (_issue.format === "regex")
          return `Yanlış mətn: ${_issue.pattern} şablonuna uyğun olmalıdır`;
        return `Yanlış ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Yanlış ədəd: ${issue2.divisor} ilə bölünə bilən olmalıdır`;
      case "unrecognized_keys":
        return `Tanınmayan açar${issue2.keys.length > 1 ? "lar" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `${issue2.origin} daxilində yanlış açar`;
      case "invalid_union":
        return "Yanlış dəyər";
      case "invalid_element":
        return `${issue2.origin} daxilində yanlış dəyər`;
      default:
        return `Yanlış dəyər`;
    }
  };
};
var init_az = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/be.js
function getBelarusianPlural(count, one, few, many) {
  const absCount = Math.abs(count);
  const lastDigit = absCount % 10;
  const lastTwoDigits = absCount % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return many;
  }
  if (lastDigit === 1) {
    return one;
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return few;
  }
  return many;
}
function be_default() {
  return {
    localeError: error3()
  };
}
var error3 = () => {
  const Sizable = {
    string: {
      unit: {
        one: "сімвал",
        few: "сімвалы",
        many: "сімвалаў"
      },
      verb: "мець"
    },
    array: {
      unit: {
        one: "элемент",
        few: "элементы",
        many: "элементаў"
      },
      verb: "мець"
    },
    set: {
      unit: {
        one: "элемент",
        few: "элементы",
        many: "элементаў"
      },
      verb: "мець"
    },
    file: {
      unit: {
        one: "байт",
        few: "байты",
        many: "байтаў"
      },
      verb: "мець"
    }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "лік";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "масіў";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "увод",
    email: "email адрас",
    url: "URL",
    emoji: "эмодзі",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO дата і час",
    date: "ISO дата",
    time: "ISO час",
    duration: "ISO працягласць",
    ipv4: "IPv4 адрас",
    ipv6: "IPv6 адрас",
    cidrv4: "IPv4 дыяпазон",
    cidrv6: "IPv6 дыяпазон",
    base64: "радок у фармаце base64",
    base64url: "радок у фармаце base64url",
    json_string: "JSON радок",
    e164: "нумар E.164",
    jwt: "JWT",
    template_literal: "увод"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Няправільны ўвод: чакаўся ${issue2.expected}, атрымана ${parsedType(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Няправільны ўвод: чакалася ${stringifyPrimitive(issue2.values[0])}`;
        return `Няправільны варыянт: чакаўся адзін з ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          const maxValue = Number(issue2.maximum);
          const unit = getBelarusianPlural(maxValue, sizing.unit.one, sizing.unit.few, sizing.unit.many);
          return `Занадта вялікі: чакалася, што ${issue2.origin ?? "значэнне"} павінна ${sizing.verb} ${adj}${issue2.maximum.toString()} ${unit}`;
        }
        return `Занадта вялікі: чакалася, што ${issue2.origin ?? "значэнне"} павінна быць ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          const minValue = Number(issue2.minimum);
          const unit = getBelarusianPlural(minValue, sizing.unit.one, sizing.unit.few, sizing.unit.many);
          return `Занадта малы: чакалася, што ${issue2.origin} павінна ${sizing.verb} ${adj}${issue2.minimum.toString()} ${unit}`;
        }
        return `Занадта малы: чакалася, што ${issue2.origin} павінна быць ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Няправільны радок: павінен пачынацца з "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Няправільны радок: павінен заканчвацца на "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Няправільны радок: павінен змяшчаць "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Няправільны радок: павінен адпавядаць шаблону ${_issue.pattern}`;
        return `Няправільны ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Няправільны лік: павінен быць кратным ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Нераспазнаны ${issue2.keys.length > 1 ? "ключы" : "ключ"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Няправільны ключ у ${issue2.origin}`;
      case "invalid_union":
        return "Няправільны ўвод";
      case "invalid_element":
        return `Няправільнае значэнне ў ${issue2.origin}`;
      default:
        return `Няправільны ўвод`;
    }
  };
};
var init_be = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/bg.js
function bg_default() {
  return {
    localeError: error4()
  };
}
var parsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "number": {
      return Number.isNaN(data) ? "NaN" : "число";
    }
    case "object": {
      if (Array.isArray(data)) {
        return "масив";
      }
      if (data === null) {
        return "null";
      }
      if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
        return data.constructor.name;
      }
    }
  }
  return t;
}, error4 = () => {
  const Sizable = {
    string: { unit: "символа", verb: "да съдържа" },
    file: { unit: "байта", verb: "да съдържа" },
    array: { unit: "елемента", verb: "да съдържа" },
    set: { unit: "елемента", verb: "да съдържа" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const Nouns = {
    regex: "вход",
    email: "имейл адрес",
    url: "URL",
    emoji: "емоджи",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO време",
    date: "ISO дата",
    time: "ISO време",
    duration: "ISO продължителност",
    ipv4: "IPv4 адрес",
    ipv6: "IPv6 адрес",
    cidrv4: "IPv4 диапазон",
    cidrv6: "IPv6 диапазон",
    base64: "base64-кодиран низ",
    base64url: "base64url-кодиран низ",
    json_string: "JSON низ",
    e164: "E.164 номер",
    jwt: "JWT",
    template_literal: "вход"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Невалиден вход: очакван ${issue2.expected}, получен ${parsedType(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Невалиден вход: очакван ${stringifyPrimitive(issue2.values[0])}`;
        return `Невалидна опция: очаквано едно от ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Твърде голямо: очаква се ${issue2.origin ?? "стойност"} да съдържа ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "елемента"}`;
        return `Твърде голямо: очаква се ${issue2.origin ?? "стойност"} да бъде ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Твърде малко: очаква се ${issue2.origin} да съдържа ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Твърде малко: очаква се ${issue2.origin} да бъде ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `Невалиден низ: трябва да започва с "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `Невалиден низ: трябва да завършва с "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Невалиден низ: трябва да включва "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Невалиден низ: трябва да съвпада с ${_issue.pattern}`;
        let invalid_adj = "Невалиден";
        if (_issue.format === "emoji")
          invalid_adj = "Невалидно";
        if (_issue.format === "datetime")
          invalid_adj = "Невалидно";
        if (_issue.format === "date")
          invalid_adj = "Невалидна";
        if (_issue.format === "time")
          invalid_adj = "Невалидно";
        if (_issue.format === "duration")
          invalid_adj = "Невалидна";
        return `${invalid_adj} ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Невалидно число: трябва да бъде кратно на ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Неразпознат${issue2.keys.length > 1 ? "и" : ""} ключ${issue2.keys.length > 1 ? "ове" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Невалиден ключ в ${issue2.origin}`;
      case "invalid_union":
        return "Невалиден вход";
      case "invalid_element":
        return `Невалидна стойност в ${issue2.origin}`;
      default:
        return `Невалиден вход`;
    }
  };
};
var init_bg = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/ca.js
function ca_default() {
  return {
    localeError: error5()
  };
}
var error5 = () => {
  const Sizable = {
    string: { unit: "caràcters", verb: "contenir" },
    file: { unit: "bytes", verb: "contenir" },
    array: { unit: "elements", verb: "contenir" },
    set: { unit: "elements", verb: "contenir" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType2 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "number";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "array";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "entrada",
    email: "adreça electrònica",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "data i hora ISO",
    date: "data ISO",
    time: "hora ISO",
    duration: "durada ISO",
    ipv4: "adreça IPv4",
    ipv6: "adreça IPv6",
    cidrv4: "rang IPv4",
    cidrv6: "rang IPv6",
    base64: "cadena codificada en base64",
    base64url: "cadena codificada en base64url",
    json_string: "cadena JSON",
    e164: "número E.164",
    jwt: "JWT",
    template_literal: "entrada"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Tipus invàlid: s'esperava ${issue2.expected}, s'ha rebut ${parsedType2(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Valor invàlid: s'esperava ${stringifyPrimitive(issue2.values[0])}`;
        return `Opció invàlida: s'esperava una de ${joinValues(issue2.values, " o ")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "com a màxim" : "menys de";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Massa gran: s'esperava que ${issue2.origin ?? "el valor"} contingués ${adj} ${issue2.maximum.toString()} ${sizing.unit ?? "elements"}`;
        return `Massa gran: s'esperava que ${issue2.origin ?? "el valor"} fos ${adj} ${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? "com a mínim" : "més de";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Massa petit: s'esperava que ${issue2.origin} contingués ${adj} ${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Massa petit: s'esperava que ${issue2.origin} fos ${adj} ${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `Format invàlid: ha de començar amb "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `Format invàlid: ha d'acabar amb "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Format invàlid: ha d'incloure "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Format invàlid: ha de coincidir amb el patró ${_issue.pattern}`;
        return `Format invàlid per a ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Número invàlid: ha de ser múltiple de ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Clau${issue2.keys.length > 1 ? "s" : ""} no reconeguda${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Clau invàlida a ${issue2.origin}`;
      case "invalid_union":
        return "Entrada invàlida";
      case "invalid_element":
        return `Element invàlid a ${issue2.origin}`;
      default:
        return `Entrada invàlida`;
    }
  };
};
var init_ca = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/cs.js
function cs_default() {
  return {
    localeError: error6()
  };
}
var error6 = () => {
  const Sizable = {
    string: { unit: "znaků", verb: "mít" },
    file: { unit: "bajtů", verb: "mít" },
    array: { unit: "prvků", verb: "mít" },
    set: { unit: "prvků", verb: "mít" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType2 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "číslo";
      }
      case "string": {
        return "řetězec";
      }
      case "boolean": {
        return "boolean";
      }
      case "bigint": {
        return "bigint";
      }
      case "function": {
        return "funkce";
      }
      case "symbol": {
        return "symbol";
      }
      case "undefined": {
        return "undefined";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "pole";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "regulární výraz",
    email: "e-mailová adresa",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "datum a čas ve formátu ISO",
    date: "datum ve formátu ISO",
    time: "čas ve formátu ISO",
    duration: "doba trvání ISO",
    ipv4: "IPv4 adresa",
    ipv6: "IPv6 adresa",
    cidrv4: "rozsah IPv4",
    cidrv6: "rozsah IPv6",
    base64: "řetězec zakódovaný ve formátu base64",
    base64url: "řetězec zakódovaný ve formátu base64url",
    json_string: "řetězec ve formátu JSON",
    e164: "číslo E.164",
    jwt: "JWT",
    template_literal: "vstup"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Neplatný vstup: očekáváno ${issue2.expected}, obdrženo ${parsedType2(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Neplatný vstup: očekáváno ${stringifyPrimitive(issue2.values[0])}`;
        return `Neplatná možnost: očekávána jedna z hodnot ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Hodnota je příliš velká: ${issue2.origin ?? "hodnota"} musí mít ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "prvků"}`;
        }
        return `Hodnota je příliš velká: ${issue2.origin ?? "hodnota"} musí být ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Hodnota je příliš malá: ${issue2.origin ?? "hodnota"} musí mít ${adj}${issue2.minimum.toString()} ${sizing.unit ?? "prvků"}`;
        }
        return `Hodnota je příliš malá: ${issue2.origin ?? "hodnota"} musí být ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Neplatný řetězec: musí začínat na "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Neplatný řetězec: musí končit na "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Neplatný řetězec: musí obsahovat "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Neplatný řetězec: musí odpovídat vzoru ${_issue.pattern}`;
        return `Neplatný formát ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Neplatné číslo: musí být násobkem ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Neznámé klíče: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Neplatný klíč v ${issue2.origin}`;
      case "invalid_union":
        return "Neplatný vstup";
      case "invalid_element":
        return `Neplatná hodnota v ${issue2.origin}`;
      default:
        return `Neplatný vstup`;
    }
  };
};
var init_cs = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/da.js
function da_default() {
  return {
    localeError: error7()
  };
}
var error7 = () => {
  const Sizable = {
    string: { unit: "tegn", verb: "havde" },
    file: { unit: "bytes", verb: "havde" },
    array: { unit: "elementer", verb: "indeholdt" },
    set: { unit: "elementer", verb: "indeholdt" }
  };
  const TypeNames = {
    string: "streng",
    number: "tal",
    boolean: "boolean",
    array: "liste",
    object: "objekt",
    set: "sæt",
    file: "fil"
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  function getTypeName(type) {
    return TypeNames[type] ?? type;
  }
  const parsedType2 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "tal";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "liste";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
        return "objekt";
      }
    }
    return t;
  };
  const Nouns = {
    regex: "input",
    email: "e-mailadresse",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO dato- og klokkeslæt",
    date: "ISO-dato",
    time: "ISO-klokkeslæt",
    duration: "ISO-varighed",
    ipv4: "IPv4-område",
    ipv6: "IPv6-område",
    cidrv4: "IPv4-spektrum",
    cidrv6: "IPv6-spektrum",
    base64: "base64-kodet streng",
    base64url: "base64url-kodet streng",
    json_string: "JSON-streng",
    e164: "E.164-nummer",
    jwt: "JWT",
    template_literal: "input"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Ugyldigt input: forventede ${getTypeName(issue2.expected)}, fik ${getTypeName(parsedType2(issue2.input))}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Ugyldig værdi: forventede ${stringifyPrimitive(issue2.values[0])}`;
        return `Ugyldigt valg: forventede en af følgende ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        const origin = getTypeName(issue2.origin);
        if (sizing)
          return `For stor: forventede ${origin ?? "value"} ${sizing.verb} ${adj} ${issue2.maximum.toString()} ${sizing.unit ?? "elementer"}`;
        return `For stor: forventede ${origin ?? "value"} havde ${adj} ${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        const origin = getTypeName(issue2.origin);
        if (sizing) {
          return `For lille: forventede ${origin} ${sizing.verb} ${adj} ${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `For lille: forventede ${origin} havde ${adj} ${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Ugyldig streng: skal starte med "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Ugyldig streng: skal ende med "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Ugyldig streng: skal indeholde "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Ugyldig streng: skal matche mønsteret ${_issue.pattern}`;
        return `Ugyldig ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Ugyldigt tal: skal være deleligt med ${issue2.divisor}`;
      case "unrecognized_keys":
        return `${issue2.keys.length > 1 ? "Ukendte nøgler" : "Ukendt nøgle"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Ugyldig nøgle i ${issue2.origin}`;
      case "invalid_union":
        return "Ugyldigt input: matcher ingen af de tilladte typer";
      case "invalid_element":
        return `Ugyldig værdi i ${issue2.origin}`;
      default:
        return `Ugyldigt input`;
    }
  };
};
var init_da = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/de.js
function de_default() {
  return {
    localeError: error8()
  };
}
var error8 = () => {
  const Sizable = {
    string: { unit: "Zeichen", verb: "zu haben" },
    file: { unit: "Bytes", verb: "zu haben" },
    array: { unit: "Elemente", verb: "zu haben" },
    set: { unit: "Elemente", verb: "zu haben" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType2 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "Zahl";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "Array";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "Eingabe",
    email: "E-Mail-Adresse",
    url: "URL",
    emoji: "Emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO-Datum und -Uhrzeit",
    date: "ISO-Datum",
    time: "ISO-Uhrzeit",
    duration: "ISO-Dauer",
    ipv4: "IPv4-Adresse",
    ipv6: "IPv6-Adresse",
    cidrv4: "IPv4-Bereich",
    cidrv6: "IPv6-Bereich",
    base64: "Base64-codierter String",
    base64url: "Base64-URL-codierter String",
    json_string: "JSON-String",
    e164: "E.164-Nummer",
    jwt: "JWT",
    template_literal: "Eingabe"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Ungültige Eingabe: erwartet ${issue2.expected}, erhalten ${parsedType2(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Ungültige Eingabe: erwartet ${stringifyPrimitive(issue2.values[0])}`;
        return `Ungültige Option: erwartet eine von ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Zu groß: erwartet, dass ${issue2.origin ?? "Wert"} ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "Elemente"} hat`;
        return `Zu groß: erwartet, dass ${issue2.origin ?? "Wert"} ${adj}${issue2.maximum.toString()} ist`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Zu klein: erwartet, dass ${issue2.origin} ${adj}${issue2.minimum.toString()} ${sizing.unit} hat`;
        }
        return `Zu klein: erwartet, dass ${issue2.origin} ${adj}${issue2.minimum.toString()} ist`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Ungültiger String: muss mit "${_issue.prefix}" beginnen`;
        if (_issue.format === "ends_with")
          return `Ungültiger String: muss mit "${_issue.suffix}" enden`;
        if (_issue.format === "includes")
          return `Ungültiger String: muss "${_issue.includes}" enthalten`;
        if (_issue.format === "regex")
          return `Ungültiger String: muss dem Muster ${_issue.pattern} entsprechen`;
        return `Ungültig: ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Ungültige Zahl: muss ein Vielfaches von ${issue2.divisor} sein`;
      case "unrecognized_keys":
        return `${issue2.keys.length > 1 ? "Unbekannte Schlüssel" : "Unbekannter Schlüssel"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Ungültiger Schlüssel in ${issue2.origin}`;
      case "invalid_union":
        return "Ungültige Eingabe";
      case "invalid_element":
        return `Ungültiger Wert in ${issue2.origin}`;
      default:
        return `Ungültige Eingabe`;
    }
  };
};
var init_de = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/en.js
function en_default() {
  return {
    localeError: error9()
  };
}
var parsedType2 = (data) => {
  const t = typeof data;
  switch (t) {
    case "number": {
      return Number.isNaN(data) ? "NaN" : "number";
    }
    case "object": {
      if (Array.isArray(data)) {
        return "array";
      }
      if (data === null) {
        return "null";
      }
      if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
        return data.constructor.name;
      }
    }
  }
  return t;
}, error9 = () => {
  const Sizable = {
    string: { unit: "characters", verb: "to have" },
    file: { unit: "bytes", verb: "to have" },
    array: { unit: "items", verb: "to have" },
    set: { unit: "items", verb: "to have" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const Nouns = {
    regex: "input",
    email: "email address",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO datetime",
    date: "ISO date",
    time: "ISO time",
    duration: "ISO duration",
    ipv4: "IPv4 address",
    ipv6: "IPv6 address",
    cidrv4: "IPv4 range",
    cidrv6: "IPv6 range",
    base64: "base64-encoded string",
    base64url: "base64url-encoded string",
    json_string: "JSON string",
    e164: "E.164 number",
    jwt: "JWT",
    template_literal: "input"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Invalid input: expected ${issue2.expected}, received ${parsedType2(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Invalid input: expected ${stringifyPrimitive(issue2.values[0])}`;
        return `Invalid option: expected one of ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Too big: expected ${issue2.origin ?? "value"} to have ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elements"}`;
        return `Too big: expected ${issue2.origin ?? "value"} to be ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Too small: expected ${issue2.origin} to have ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Too small: expected ${issue2.origin} to be ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `Invalid string: must start with "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `Invalid string: must end with "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Invalid string: must include "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Invalid string: must match pattern ${_issue.pattern}`;
        return `Invalid ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Invalid number: must be a multiple of ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Unrecognized key${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Invalid key in ${issue2.origin}`;
      case "invalid_union":
        return "Invalid input";
      case "invalid_element":
        return `Invalid value in ${issue2.origin}`;
      default:
        return `Invalid input`;
    }
  };
};
var init_en = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/eo.js
function eo_default() {
  return {
    localeError: error10()
  };
}
var parsedType3 = (data) => {
  const t = typeof data;
  switch (t) {
    case "number": {
      return Number.isNaN(data) ? "NaN" : "nombro";
    }
    case "object": {
      if (Array.isArray(data)) {
        return "tabelo";
      }
      if (data === null) {
        return "senvalora";
      }
      if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
        return data.constructor.name;
      }
    }
  }
  return t;
}, error10 = () => {
  const Sizable = {
    string: { unit: "karaktrojn", verb: "havi" },
    file: { unit: "bajtojn", verb: "havi" },
    array: { unit: "elementojn", verb: "havi" },
    set: { unit: "elementojn", verb: "havi" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const Nouns = {
    regex: "enigo",
    email: "retadreso",
    url: "URL",
    emoji: "emoĝio",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO-datotempo",
    date: "ISO-dato",
    time: "ISO-tempo",
    duration: "ISO-daŭro",
    ipv4: "IPv4-adreso",
    ipv6: "IPv6-adreso",
    cidrv4: "IPv4-rango",
    cidrv6: "IPv6-rango",
    base64: "64-ume kodita karaktraro",
    base64url: "URL-64-ume kodita karaktraro",
    json_string: "JSON-karaktraro",
    e164: "E.164-nombro",
    jwt: "JWT",
    template_literal: "enigo"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Nevalida enigo: atendiĝis ${issue2.expected}, riceviĝis ${parsedType3(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Nevalida enigo: atendiĝis ${stringifyPrimitive(issue2.values[0])}`;
        return `Nevalida opcio: atendiĝis unu el ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Tro granda: atendiĝis ke ${issue2.origin ?? "valoro"} havu ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elementojn"}`;
        return `Tro granda: atendiĝis ke ${issue2.origin ?? "valoro"} havu ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Tro malgranda: atendiĝis ke ${issue2.origin} havu ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Tro malgranda: atendiĝis ke ${issue2.origin} estu ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Nevalida karaktraro: devas komenciĝi per "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Nevalida karaktraro: devas finiĝi per "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Nevalida karaktraro: devas inkluzivi "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Nevalida karaktraro: devas kongrui kun la modelo ${_issue.pattern}`;
        return `Nevalida ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Nevalida nombro: devas esti oblo de ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Nekonata${issue2.keys.length > 1 ? "j" : ""} ŝlosilo${issue2.keys.length > 1 ? "j" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Nevalida ŝlosilo en ${issue2.origin}`;
      case "invalid_union":
        return "Nevalida enigo";
      case "invalid_element":
        return `Nevalida valoro en ${issue2.origin}`;
      default:
        return `Nevalida enigo`;
    }
  };
};
var init_eo = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/es.js
function es_default() {
  return {
    localeError: error11()
  };
}
var error11 = () => {
  const Sizable = {
    string: { unit: "caracteres", verb: "tener" },
    file: { unit: "bytes", verb: "tener" },
    array: { unit: "elementos", verb: "tener" },
    set: { unit: "elementos", verb: "tener" }
  };
  const TypeNames = {
    string: "texto",
    number: "número",
    boolean: "booleano",
    array: "arreglo",
    object: "objeto",
    set: "conjunto",
    file: "archivo",
    date: "fecha",
    bigint: "número grande",
    symbol: "símbolo",
    undefined: "indefinido",
    null: "nulo",
    function: "función",
    map: "mapa",
    record: "registro",
    tuple: "tupla",
    enum: "enumeración",
    union: "unión",
    literal: "literal",
    promise: "promesa",
    void: "vacío",
    never: "nunca",
    unknown: "desconocido",
    any: "cualquiera"
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  function getTypeName(type) {
    return TypeNames[type] ?? type;
  }
  const parsedType4 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "number";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "array";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype) {
          return data.constructor.name;
        }
        return "object";
      }
    }
    return t;
  };
  const Nouns = {
    regex: "entrada",
    email: "dirección de correo electrónico",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "fecha y hora ISO",
    date: "fecha ISO",
    time: "hora ISO",
    duration: "duración ISO",
    ipv4: "dirección IPv4",
    ipv6: "dirección IPv6",
    cidrv4: "rango IPv4",
    cidrv6: "rango IPv6",
    base64: "cadena codificada en base64",
    base64url: "URL codificada en base64",
    json_string: "cadena JSON",
    e164: "número E.164",
    jwt: "JWT",
    template_literal: "entrada"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Entrada inválida: se esperaba ${getTypeName(issue2.expected)}, recibido ${getTypeName(parsedType4(issue2.input))}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Entrada inválida: se esperaba ${stringifyPrimitive(issue2.values[0])}`;
        return `Opción inválida: se esperaba una de ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        const origin = getTypeName(issue2.origin);
        if (sizing)
          return `Demasiado grande: se esperaba que ${origin ?? "valor"} tuviera ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elementos"}`;
        return `Demasiado grande: se esperaba que ${origin ?? "valor"} fuera ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        const origin = getTypeName(issue2.origin);
        if (sizing) {
          return `Demasiado pequeño: se esperaba que ${origin} tuviera ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Demasiado pequeño: se esperaba que ${origin} fuera ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Cadena inválida: debe comenzar con "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Cadena inválida: debe terminar en "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Cadena inválida: debe incluir "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Cadena inválida: debe coincidir con el patrón ${_issue.pattern}`;
        return `Inválido ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Número inválido: debe ser múltiplo de ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Llave${issue2.keys.length > 1 ? "s" : ""} desconocida${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Llave inválida en ${getTypeName(issue2.origin)}`;
      case "invalid_union":
        return "Entrada inválida";
      case "invalid_element":
        return `Valor inválido en ${getTypeName(issue2.origin)}`;
      default:
        return `Entrada inválida`;
    }
  };
};
var init_es = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/fa.js
function fa_default() {
  return {
    localeError: error12()
  };
}
var error12 = () => {
  const Sizable = {
    string: { unit: "کاراکتر", verb: "داشته باشد" },
    file: { unit: "بایت", verb: "داشته باشد" },
    array: { unit: "آیتم", verb: "داشته باشد" },
    set: { unit: "آیتم", verb: "داشته باشد" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType4 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "عدد";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "آرایه";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "ورودی",
    email: "آدرس ایمیل",
    url: "URL",
    emoji: "ایموجی",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "تاریخ و زمان ایزو",
    date: "تاریخ ایزو",
    time: "زمان ایزو",
    duration: "مدت زمان ایزو",
    ipv4: "IPv4 آدرس",
    ipv6: "IPv6 آدرس",
    cidrv4: "IPv4 دامنه",
    cidrv6: "IPv6 دامنه",
    base64: "base64-encoded رشته",
    base64url: "base64url-encoded رشته",
    json_string: "JSON رشته",
    e164: "E.164 عدد",
    jwt: "JWT",
    template_literal: "ورودی"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `ورودی نامعتبر: می‌بایست ${issue2.expected} می‌بود، ${parsedType4(issue2.input)} دریافت شد`;
      case "invalid_value":
        if (issue2.values.length === 1) {
          return `ورودی نامعتبر: می‌بایست ${stringifyPrimitive(issue2.values[0])} می‌بود`;
        }
        return `گزینه نامعتبر: می‌بایست یکی از ${joinValues(issue2.values, "|")} می‌بود`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `خیلی بزرگ: ${issue2.origin ?? "مقدار"} باید ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "عنصر"} باشد`;
        }
        return `خیلی بزرگ: ${issue2.origin ?? "مقدار"} باید ${adj}${issue2.maximum.toString()} باشد`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `خیلی کوچک: ${issue2.origin} باید ${adj}${issue2.minimum.toString()} ${sizing.unit} باشد`;
        }
        return `خیلی کوچک: ${issue2.origin} باید ${adj}${issue2.minimum.toString()} باشد`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `رشته نامعتبر: باید با "${_issue.prefix}" شروع شود`;
        }
        if (_issue.format === "ends_with") {
          return `رشته نامعتبر: باید با "${_issue.suffix}" تمام شود`;
        }
        if (_issue.format === "includes") {
          return `رشته نامعتبر: باید شامل "${_issue.includes}" باشد`;
        }
        if (_issue.format === "regex") {
          return `رشته نامعتبر: باید با الگوی ${_issue.pattern} مطابقت داشته باشد`;
        }
        return `${Nouns[_issue.format] ?? issue2.format} نامعتبر`;
      }
      case "not_multiple_of":
        return `عدد نامعتبر: باید مضرب ${issue2.divisor} باشد`;
      case "unrecognized_keys":
        return `کلید${issue2.keys.length > 1 ? "های" : ""} ناشناس: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `کلید ناشناس در ${issue2.origin}`;
      case "invalid_union":
        return `ورودی نامعتبر`;
      case "invalid_element":
        return `مقدار نامعتبر در ${issue2.origin}`;
      default:
        return `ورودی نامعتبر`;
    }
  };
};
var init_fa = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/fi.js
function fi_default() {
  return {
    localeError: error13()
  };
}
var error13 = () => {
  const Sizable = {
    string: { unit: "merkkiä", subject: "merkkijonon" },
    file: { unit: "tavua", subject: "tiedoston" },
    array: { unit: "alkiota", subject: "listan" },
    set: { unit: "alkiota", subject: "joukon" },
    number: { unit: "", subject: "luvun" },
    bigint: { unit: "", subject: "suuren kokonaisluvun" },
    int: { unit: "", subject: "kokonaisluvun" },
    date: { unit: "", subject: "päivämäärän" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType4 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "number";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "array";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "säännöllinen lauseke",
    email: "sähköpostiosoite",
    url: "URL-osoite",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO-aikaleima",
    date: "ISO-päivämäärä",
    time: "ISO-aika",
    duration: "ISO-kesto",
    ipv4: "IPv4-osoite",
    ipv6: "IPv6-osoite",
    cidrv4: "IPv4-alue",
    cidrv6: "IPv6-alue",
    base64: "base64-koodattu merkkijono",
    base64url: "base64url-koodattu merkkijono",
    json_string: "JSON-merkkijono",
    e164: "E.164-luku",
    jwt: "JWT",
    template_literal: "templaattimerkkijono"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Virheellinen tyyppi: odotettiin ${issue2.expected}, oli ${parsedType4(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Virheellinen syöte: täytyy olla ${stringifyPrimitive(issue2.values[0])}`;
        return `Virheellinen valinta: täytyy olla yksi seuraavista: ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Liian suuri: ${sizing.subject} täytyy olla ${adj}${issue2.maximum.toString()} ${sizing.unit}`.trim();
        }
        return `Liian suuri: arvon täytyy olla ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Liian pieni: ${sizing.subject} täytyy olla ${adj}${issue2.minimum.toString()} ${sizing.unit}`.trim();
        }
        return `Liian pieni: arvon täytyy olla ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Virheellinen syöte: täytyy alkaa "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Virheellinen syöte: täytyy loppua "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Virheellinen syöte: täytyy sisältää "${_issue.includes}"`;
        if (_issue.format === "regex") {
          return `Virheellinen syöte: täytyy vastata säännöllistä lauseketta ${_issue.pattern}`;
        }
        return `Virheellinen ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Virheellinen luku: täytyy olla luvun ${issue2.divisor} monikerta`;
      case "unrecognized_keys":
        return `${issue2.keys.length > 1 ? "Tuntemattomat avaimet" : "Tuntematon avain"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return "Virheellinen avain tietueessa";
      case "invalid_union":
        return "Virheellinen unioni";
      case "invalid_element":
        return "Virheellinen arvo joukossa";
      default:
        return `Virheellinen syöte`;
    }
  };
};
var init_fi = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/fr.js
function fr_default() {
  return {
    localeError: error14()
  };
}
var error14 = () => {
  const Sizable = {
    string: { unit: "caractères", verb: "avoir" },
    file: { unit: "octets", verb: "avoir" },
    array: { unit: "éléments", verb: "avoir" },
    set: { unit: "éléments", verb: "avoir" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType4 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "nombre";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "tableau";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "entrée",
    email: "adresse e-mail",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "date et heure ISO",
    date: "date ISO",
    time: "heure ISO",
    duration: "durée ISO",
    ipv4: "adresse IPv4",
    ipv6: "adresse IPv6",
    cidrv4: "plage IPv4",
    cidrv6: "plage IPv6",
    base64: "chaîne encodée en base64",
    base64url: "chaîne encodée en base64url",
    json_string: "chaîne JSON",
    e164: "numéro E.164",
    jwt: "JWT",
    template_literal: "entrée"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Entrée invalide : ${issue2.expected} attendu, ${parsedType4(issue2.input)} reçu`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Entrée invalide : ${stringifyPrimitive(issue2.values[0])} attendu`;
        return `Option invalide : une valeur parmi ${joinValues(issue2.values, "|")} attendue`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Trop grand : ${issue2.origin ?? "valeur"} doit ${sizing.verb} ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "élément(s)"}`;
        return `Trop grand : ${issue2.origin ?? "valeur"} doit être ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Trop petit : ${issue2.origin} doit ${sizing.verb} ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Trop petit : ${issue2.origin} doit être ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Chaîne invalide : doit commencer par "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Chaîne invalide : doit se terminer par "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Chaîne invalide : doit inclure "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Chaîne invalide : doit correspondre au modèle ${_issue.pattern}`;
        return `${Nouns[_issue.format] ?? issue2.format} invalide`;
      }
      case "not_multiple_of":
        return `Nombre invalide : doit être un multiple de ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Clé${issue2.keys.length > 1 ? "s" : ""} non reconnue${issue2.keys.length > 1 ? "s" : ""} : ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Clé invalide dans ${issue2.origin}`;
      case "invalid_union":
        return "Entrée invalide";
      case "invalid_element":
        return `Valeur invalide dans ${issue2.origin}`;
      default:
        return `Entrée invalide`;
    }
  };
};
var init_fr = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/fr-CA.js
function fr_CA_default() {
  return {
    localeError: error15()
  };
}
var error15 = () => {
  const Sizable = {
    string: { unit: "caractères", verb: "avoir" },
    file: { unit: "octets", verb: "avoir" },
    array: { unit: "éléments", verb: "avoir" },
    set: { unit: "éléments", verb: "avoir" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType4 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "number";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "array";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "entrée",
    email: "adresse courriel",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "date-heure ISO",
    date: "date ISO",
    time: "heure ISO",
    duration: "durée ISO",
    ipv4: "adresse IPv4",
    ipv6: "adresse IPv6",
    cidrv4: "plage IPv4",
    cidrv6: "plage IPv6",
    base64: "chaîne encodée en base64",
    base64url: "chaîne encodée en base64url",
    json_string: "chaîne JSON",
    e164: "numéro E.164",
    jwt: "JWT",
    template_literal: "entrée"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Entrée invalide : attendu ${issue2.expected}, reçu ${parsedType4(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Entrée invalide : attendu ${stringifyPrimitive(issue2.values[0])}`;
        return `Option invalide : attendu l'une des valeurs suivantes ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "≤" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Trop grand : attendu que ${issue2.origin ?? "la valeur"} ait ${adj}${issue2.maximum.toString()} ${sizing.unit}`;
        return `Trop grand : attendu que ${issue2.origin ?? "la valeur"} soit ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? "≥" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Trop petit : attendu que ${issue2.origin} ait ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Trop petit : attendu que ${issue2.origin} soit ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `Chaîne invalide : doit commencer par "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `Chaîne invalide : doit se terminer par "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Chaîne invalide : doit inclure "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Chaîne invalide : doit correspondre au motif ${_issue.pattern}`;
        return `${Nouns[_issue.format] ?? issue2.format} invalide`;
      }
      case "not_multiple_of":
        return `Nombre invalide : doit être un multiple de ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Clé${issue2.keys.length > 1 ? "s" : ""} non reconnue${issue2.keys.length > 1 ? "s" : ""} : ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Clé invalide dans ${issue2.origin}`;
      case "invalid_union":
        return "Entrée invalide";
      case "invalid_element":
        return `Valeur invalide dans ${issue2.origin}`;
      default:
        return `Entrée invalide`;
    }
  };
};
var init_fr_CA = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/he.js
function he_default() {
  return {
    localeError: error16()
  };
}
var error16 = () => {
  const Sizable = {
    string: { unit: "אותיות", verb: "לכלול" },
    file: { unit: "בייטים", verb: "לכלול" },
    array: { unit: "פריטים", verb: "לכלול" },
    set: { unit: "פריטים", verb: "לכלול" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType4 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "number";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "array";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "קלט",
    email: "כתובת אימייל",
    url: "כתובת רשת",
    emoji: "אימוג'י",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "תאריך וזמן ISO",
    date: "תאריך ISO",
    time: "זמן ISO",
    duration: "משך זמן ISO",
    ipv4: "כתובת IPv4",
    ipv6: "כתובת IPv6",
    cidrv4: "טווח IPv4",
    cidrv6: "טווח IPv6",
    base64: "מחרוזת בבסיס 64",
    base64url: "מחרוזת בבסיס 64 לכתובות רשת",
    json_string: "מחרוזת JSON",
    e164: "מספר E.164",
    jwt: "JWT",
    template_literal: "קלט"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `קלט לא תקין: צריך ${issue2.expected}, התקבל ${parsedType4(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `קלט לא תקין: צריך ${stringifyPrimitive(issue2.values[0])}`;
        return `קלט לא תקין: צריך אחת מהאפשרויות  ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `גדול מדי: ${issue2.origin ?? "value"} צריך להיות ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elements"}`;
        return `גדול מדי: ${issue2.origin ?? "value"} צריך להיות ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `קטן מדי: ${issue2.origin} צריך להיות ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `קטן מדי: ${issue2.origin} צריך להיות ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `מחרוזת לא תקינה: חייבת להתחיל ב"${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `מחרוזת לא תקינה: חייבת להסתיים ב "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `מחרוזת לא תקינה: חייבת לכלול "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `מחרוזת לא תקינה: חייבת להתאים לתבנית ${_issue.pattern}`;
        return `${Nouns[_issue.format] ?? issue2.format} לא תקין`;
      }
      case "not_multiple_of":
        return `מספר לא תקין: חייב להיות מכפלה של ${issue2.divisor}`;
      case "unrecognized_keys":
        return `מפתח${issue2.keys.length > 1 ? "ות" : ""} לא מזוה${issue2.keys.length > 1 ? "ים" : "ה"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `מפתח לא תקין ב${issue2.origin}`;
      case "invalid_union":
        return "קלט לא תקין";
      case "invalid_element":
        return `ערך לא תקין ב${issue2.origin}`;
      default:
        return `קלט לא תקין`;
    }
  };
};
var init_he = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/hu.js
function hu_default() {
  return {
    localeError: error17()
  };
}
var error17 = () => {
  const Sizable = {
    string: { unit: "karakter", verb: "legyen" },
    file: { unit: "byte", verb: "legyen" },
    array: { unit: "elem", verb: "legyen" },
    set: { unit: "elem", verb: "legyen" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType4 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "szám";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "tömb";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "bemenet",
    email: "email cím",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO időbélyeg",
    date: "ISO dátum",
    time: "ISO idő",
    duration: "ISO időintervallum",
    ipv4: "IPv4 cím",
    ipv6: "IPv6 cím",
    cidrv4: "IPv4 tartomány",
    cidrv6: "IPv6 tartomány",
    base64: "base64-kódolt string",
    base64url: "base64url-kódolt string",
    json_string: "JSON string",
    e164: "E.164 szám",
    jwt: "JWT",
    template_literal: "bemenet"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Érvénytelen bemenet: a várt érték ${issue2.expected}, a kapott érték ${parsedType4(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Érvénytelen bemenet: a várt érték ${stringifyPrimitive(issue2.values[0])}`;
        return `Érvénytelen opció: valamelyik érték várt ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Túl nagy: ${issue2.origin ?? "érték"} mérete túl nagy ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elem"}`;
        return `Túl nagy: a bemeneti érték ${issue2.origin ?? "érték"} túl nagy: ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Túl kicsi: a bemeneti érték ${issue2.origin} mérete túl kicsi ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Túl kicsi: a bemeneti érték ${issue2.origin} túl kicsi ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Érvénytelen string: "${_issue.prefix}" értékkel kell kezdődnie`;
        if (_issue.format === "ends_with")
          return `Érvénytelen string: "${_issue.suffix}" értékkel kell végződnie`;
        if (_issue.format === "includes")
          return `Érvénytelen string: "${_issue.includes}" értéket kell tartalmaznia`;
        if (_issue.format === "regex")
          return `Érvénytelen string: ${_issue.pattern} mintának kell megfelelnie`;
        return `Érvénytelen ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Érvénytelen szám: ${issue2.divisor} többszörösének kell lennie`;
      case "unrecognized_keys":
        return `Ismeretlen kulcs${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Érvénytelen kulcs ${issue2.origin}`;
      case "invalid_union":
        return "Érvénytelen bemenet";
      case "invalid_element":
        return `Érvénytelen érték: ${issue2.origin}`;
      default:
        return `Érvénytelen bemenet`;
    }
  };
};
var init_hu = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/id.js
function id_default() {
  return {
    localeError: error18()
  };
}
var error18 = () => {
  const Sizable = {
    string: { unit: "karakter", verb: "memiliki" },
    file: { unit: "byte", verb: "memiliki" },
    array: { unit: "item", verb: "memiliki" },
    set: { unit: "item", verb: "memiliki" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType4 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "number";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "array";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "input",
    email: "alamat email",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "tanggal dan waktu format ISO",
    date: "tanggal format ISO",
    time: "jam format ISO",
    duration: "durasi format ISO",
    ipv4: "alamat IPv4",
    ipv6: "alamat IPv6",
    cidrv4: "rentang alamat IPv4",
    cidrv6: "rentang alamat IPv6",
    base64: "string dengan enkode base64",
    base64url: "string dengan enkode base64url",
    json_string: "string JSON",
    e164: "angka E.164",
    jwt: "JWT",
    template_literal: "input"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Input tidak valid: diharapkan ${issue2.expected}, diterima ${parsedType4(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Input tidak valid: diharapkan ${stringifyPrimitive(issue2.values[0])}`;
        return `Pilihan tidak valid: diharapkan salah satu dari ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Terlalu besar: diharapkan ${issue2.origin ?? "value"} memiliki ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elemen"}`;
        return `Terlalu besar: diharapkan ${issue2.origin ?? "value"} menjadi ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Terlalu kecil: diharapkan ${issue2.origin} memiliki ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Terlalu kecil: diharapkan ${issue2.origin} menjadi ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `String tidak valid: harus dimulai dengan "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `String tidak valid: harus berakhir dengan "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `String tidak valid: harus menyertakan "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `String tidak valid: harus sesuai pola ${_issue.pattern}`;
        return `${Nouns[_issue.format] ?? issue2.format} tidak valid`;
      }
      case "not_multiple_of":
        return `Angka tidak valid: harus kelipatan dari ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Kunci tidak dikenali ${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Kunci tidak valid di ${issue2.origin}`;
      case "invalid_union":
        return "Input tidak valid";
      case "invalid_element":
        return `Nilai tidak valid di ${issue2.origin}`;
      default:
        return `Input tidak valid`;
    }
  };
};
var init_id = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/is.js
function is_default() {
  return {
    localeError: error19()
  };
}
var parsedType4 = (data) => {
  const t = typeof data;
  switch (t) {
    case "number": {
      return Number.isNaN(data) ? "NaN" : "númer";
    }
    case "object": {
      if (Array.isArray(data)) {
        return "fylki";
      }
      if (data === null) {
        return "null";
      }
      if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
        return data.constructor.name;
      }
    }
  }
  return t;
}, error19 = () => {
  const Sizable = {
    string: { unit: "stafi", verb: "að hafa" },
    file: { unit: "bæti", verb: "að hafa" },
    array: { unit: "hluti", verb: "að hafa" },
    set: { unit: "hluti", verb: "að hafa" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const Nouns = {
    regex: "gildi",
    email: "netfang",
    url: "vefslóð",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO dagsetning og tími",
    date: "ISO dagsetning",
    time: "ISO tími",
    duration: "ISO tímalengd",
    ipv4: "IPv4 address",
    ipv6: "IPv6 address",
    cidrv4: "IPv4 range",
    cidrv6: "IPv6 range",
    base64: "base64-encoded strengur",
    base64url: "base64url-encoded strengur",
    json_string: "JSON strengur",
    e164: "E.164 tölugildi",
    jwt: "JWT",
    template_literal: "gildi"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Rangt gildi: Þú slóst inn ${parsedType4(issue2.input)} þar sem á að vera ${issue2.expected}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Rangt gildi: gert ráð fyrir ${stringifyPrimitive(issue2.values[0])}`;
        return `Ógilt val: má vera eitt af eftirfarandi ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Of stórt: gert er ráð fyrir að ${issue2.origin ?? "gildi"} hafi ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "hluti"}`;
        return `Of stórt: gert er ráð fyrir að ${issue2.origin ?? "gildi"} sé ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Of lítið: gert er ráð fyrir að ${issue2.origin} hafi ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Of lítið: gert er ráð fyrir að ${issue2.origin} sé ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `Ógildur strengur: verður að byrja á "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `Ógildur strengur: verður að enda á "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Ógildur strengur: verður að innihalda "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Ógildur strengur: verður að fylgja mynstri ${_issue.pattern}`;
        return `Rangt ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Röng tala: verður að vera margfeldi af ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Óþekkt ${issue2.keys.length > 1 ? "ir lyklar" : "ur lykill"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Rangur lykill í ${issue2.origin}`;
      case "invalid_union":
        return "Rangt gildi";
      case "invalid_element":
        return `Rangt gildi í ${issue2.origin}`;
      default:
        return `Rangt gildi`;
    }
  };
};
var init_is = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/it.js
function it_default() {
  return {
    localeError: error20()
  };
}
var error20 = () => {
  const Sizable = {
    string: { unit: "caratteri", verb: "avere" },
    file: { unit: "byte", verb: "avere" },
    array: { unit: "elementi", verb: "avere" },
    set: { unit: "elementi", verb: "avere" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType5 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "numero";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "vettore";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "input",
    email: "indirizzo email",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "data e ora ISO",
    date: "data ISO",
    time: "ora ISO",
    duration: "durata ISO",
    ipv4: "indirizzo IPv4",
    ipv6: "indirizzo IPv6",
    cidrv4: "intervallo IPv4",
    cidrv6: "intervallo IPv6",
    base64: "stringa codificata in base64",
    base64url: "URL codificata in base64",
    json_string: "stringa JSON",
    e164: "numero E.164",
    jwt: "JWT",
    template_literal: "input"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Input non valido: atteso ${issue2.expected}, ricevuto ${parsedType5(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Input non valido: atteso ${stringifyPrimitive(issue2.values[0])}`;
        return `Opzione non valida: atteso uno tra ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Troppo grande: ${issue2.origin ?? "valore"} deve avere ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elementi"}`;
        return `Troppo grande: ${issue2.origin ?? "valore"} deve essere ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Troppo piccolo: ${issue2.origin} deve avere ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Troppo piccolo: ${issue2.origin} deve essere ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Stringa non valida: deve iniziare con "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Stringa non valida: deve terminare con "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Stringa non valida: deve includere "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Stringa non valida: deve corrispondere al pattern ${_issue.pattern}`;
        return `Invalid ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Numero non valido: deve essere un multiplo di ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Chiav${issue2.keys.length > 1 ? "i" : "e"} non riconosciut${issue2.keys.length > 1 ? "e" : "a"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Chiave non valida in ${issue2.origin}`;
      case "invalid_union":
        return "Input non valido";
      case "invalid_element":
        return `Valore non valido in ${issue2.origin}`;
      default:
        return `Input non valido`;
    }
  };
};
var init_it = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/ja.js
function ja_default() {
  return {
    localeError: error21()
  };
}
var error21 = () => {
  const Sizable = {
    string: { unit: "文字", verb: "である" },
    file: { unit: "バイト", verb: "である" },
    array: { unit: "要素", verb: "である" },
    set: { unit: "要素", verb: "である" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType5 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "数値";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "配列";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "入力値",
    email: "メールアドレス",
    url: "URL",
    emoji: "絵文字",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO日時",
    date: "ISO日付",
    time: "ISO時刻",
    duration: "ISO期間",
    ipv4: "IPv4アドレス",
    ipv6: "IPv6アドレス",
    cidrv4: "IPv4範囲",
    cidrv6: "IPv6範囲",
    base64: "base64エンコード文字列",
    base64url: "base64urlエンコード文字列",
    json_string: "JSON文字列",
    e164: "E.164番号",
    jwt: "JWT",
    template_literal: "入力値"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `無効な入力: ${issue2.expected}が期待されましたが、${parsedType5(issue2.input)}が入力されました`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `無効な入力: ${stringifyPrimitive(issue2.values[0])}が期待されました`;
        return `無効な選択: ${joinValues(issue2.values, "、")}のいずれかである必要があります`;
      case "too_big": {
        const adj = issue2.inclusive ? "以下である" : "より小さい";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `大きすぎる値: ${issue2.origin ?? "値"}は${issue2.maximum.toString()}${sizing.unit ?? "要素"}${adj}必要があります`;
        return `大きすぎる値: ${issue2.origin ?? "値"}は${issue2.maximum.toString()}${adj}必要があります`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? "以上である" : "より大きい";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `小さすぎる値: ${issue2.origin}は${issue2.minimum.toString()}${sizing.unit}${adj}必要があります`;
        return `小さすぎる値: ${issue2.origin}は${issue2.minimum.toString()}${adj}必要があります`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `無効な文字列: "${_issue.prefix}"で始まる必要があります`;
        if (_issue.format === "ends_with")
          return `無効な文字列: "${_issue.suffix}"で終わる必要があります`;
        if (_issue.format === "includes")
          return `無効な文字列: "${_issue.includes}"を含む必要があります`;
        if (_issue.format === "regex")
          return `無効な文字列: パターン${_issue.pattern}に一致する必要があります`;
        return `無効な${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `無効な数値: ${issue2.divisor}の倍数である必要があります`;
      case "unrecognized_keys":
        return `認識されていないキー${issue2.keys.length > 1 ? "群" : ""}: ${joinValues(issue2.keys, "、")}`;
      case "invalid_key":
        return `${issue2.origin}内の無効なキー`;
      case "invalid_union":
        return "無効な入力";
      case "invalid_element":
        return `${issue2.origin}内の無効な値`;
      default:
        return `無効な入力`;
    }
  };
};
var init_ja = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/ka.js
function ka_default() {
  return {
    localeError: error22()
  };
}
var parsedType5 = (data) => {
  const t = typeof data;
  switch (t) {
    case "number": {
      return Number.isNaN(data) ? "NaN" : "რიცხვი";
    }
    case "object": {
      if (Array.isArray(data)) {
        return "მასივი";
      }
      if (data === null) {
        return "null";
      }
      if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
        return data.constructor.name;
      }
    }
  }
  const typeMap = {
    string: "სტრინგი",
    boolean: "ბულეანი",
    undefined: "undefined",
    bigint: "bigint",
    symbol: "symbol",
    function: "ფუნქცია"
  };
  return typeMap[t] ?? t;
}, error22 = () => {
  const Sizable = {
    string: { unit: "სიმბოლო", verb: "უნდა შეიცავდეს" },
    file: { unit: "ბაიტი", verb: "უნდა შეიცავდეს" },
    array: { unit: "ელემენტი", verb: "უნდა შეიცავდეს" },
    set: { unit: "ელემენტი", verb: "უნდა შეიცავდეს" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const Nouns = {
    regex: "შეყვანა",
    email: "ელ-ფოსტის მისამართი",
    url: "URL",
    emoji: "ემოჯი",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "თარიღი-დრო",
    date: "თარიღი",
    time: "დრო",
    duration: "ხანგრძლივობა",
    ipv4: "IPv4 მისამართი",
    ipv6: "IPv6 მისამართი",
    cidrv4: "IPv4 დიაპაზონი",
    cidrv6: "IPv6 დიაპაზონი",
    base64: "base64-კოდირებული სტრინგი",
    base64url: "base64url-კოდირებული სტრინგი",
    json_string: "JSON სტრინგი",
    e164: "E.164 ნომერი",
    jwt: "JWT",
    template_literal: "შეყვანა"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `არასწორი შეყვანა: მოსალოდნელი ${issue2.expected}, მიღებული ${parsedType5(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `არასწორი შეყვანა: მოსალოდნელი ${stringifyPrimitive(issue2.values[0])}`;
        return `არასწორი ვარიანტი: მოსალოდნელია ერთ-ერთი ${joinValues(issue2.values, "|")}-დან`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `ზედმეტად დიდი: მოსალოდნელი ${issue2.origin ?? "მნიშვნელობა"} ${sizing.verb} ${adj}${issue2.maximum.toString()} ${sizing.unit}`;
        return `ზედმეტად დიდი: მოსალოდნელი ${issue2.origin ?? "მნიშვნელობა"} იყოს ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `ზედმეტად პატარა: მოსალოდნელი ${issue2.origin} ${sizing.verb} ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `ზედმეტად პატარა: მოსალოდნელი ${issue2.origin} იყოს ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `არასწორი სტრინგი: უნდა იწყებოდეს "${_issue.prefix}"-ით`;
        }
        if (_issue.format === "ends_with")
          return `არასწორი სტრინგი: უნდა მთავრდებოდეს "${_issue.suffix}"-ით`;
        if (_issue.format === "includes")
          return `არასწორი სტრინგი: უნდა შეიცავდეს "${_issue.includes}"-ს`;
        if (_issue.format === "regex")
          return `არასწორი სტრინგი: უნდა შეესაბამებოდეს შაბლონს ${_issue.pattern}`;
        return `არასწორი ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `არასწორი რიცხვი: უნდა იყოს ${issue2.divisor}-ის ჯერადი`;
      case "unrecognized_keys":
        return `უცნობი გასაღებ${issue2.keys.length > 1 ? "ები" : "ი"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `არასწორი გასაღები ${issue2.origin}-ში`;
      case "invalid_union":
        return "არასწორი შეყვანა";
      case "invalid_element":
        return `არასწორი მნიშვნელობა ${issue2.origin}-ში`;
      default:
        return `არასწორი შეყვანა`;
    }
  };
};
var init_ka = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/km.js
function km_default() {
  return {
    localeError: error23()
  };
}
var error23 = () => {
  const Sizable = {
    string: { unit: "តួអក្សរ", verb: "គួរមាន" },
    file: { unit: "បៃ", verb: "គួរមាន" },
    array: { unit: "ធាតុ", verb: "គួរមាន" },
    set: { unit: "ធាតុ", verb: "គួរមាន" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType6 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "មិនមែនជាលេខ (NaN)" : "លេខ";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "អារេ (Array)";
        }
        if (data === null) {
          return "គ្មានតម្លៃ (null)";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "ទិន្នន័យបញ្ចូល",
    email: "អាសយដ្ឋានអ៊ីមែល",
    url: "URL",
    emoji: "សញ្ញាអារម្មណ៍",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "កាលបរិច្ឆេទ និងម៉ោង ISO",
    date: "កាលបរិច្ឆេទ ISO",
    time: "ម៉ោង ISO",
    duration: "រយៈពេល ISO",
    ipv4: "អាសយដ្ឋាន IPv4",
    ipv6: "អាសយដ្ឋាន IPv6",
    cidrv4: "ដែនអាសយដ្ឋាន IPv4",
    cidrv6: "ដែនអាសយដ្ឋាន IPv6",
    base64: "ខ្សែអក្សរអ៊ិកូដ base64",
    base64url: "ខ្សែអក្សរអ៊ិកូដ base64url",
    json_string: "ខ្សែអក្សរ JSON",
    e164: "លេខ E.164",
    jwt: "JWT",
    template_literal: "ទិន្នន័យបញ្ចូល"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `ទិន្នន័យបញ្ចូលមិនត្រឹមត្រូវ៖ ត្រូវការ ${issue2.expected} ប៉ុន្តែទទួលបាន ${parsedType6(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `ទិន្នន័យបញ្ចូលមិនត្រឹមត្រូវ៖ ត្រូវការ ${stringifyPrimitive(issue2.values[0])}`;
        return `ជម្រើសមិនត្រឹមត្រូវ៖ ត្រូវជាមួយក្នុងចំណោម ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `ធំពេក៖ ត្រូវការ ${issue2.origin ?? "តម្លៃ"} ${adj} ${issue2.maximum.toString()} ${sizing.unit ?? "ធាតុ"}`;
        return `ធំពេក៖ ត្រូវការ ${issue2.origin ?? "តម្លៃ"} ${adj} ${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `តូចពេក៖ ត្រូវការ ${issue2.origin} ${adj} ${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `តូចពេក៖ ត្រូវការ ${issue2.origin} ${adj} ${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `ខ្សែអក្សរមិនត្រឹមត្រូវ៖ ត្រូវចាប់ផ្តើមដោយ "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `ខ្សែអក្សរមិនត្រឹមត្រូវ៖ ត្រូវបញ្ចប់ដោយ "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `ខ្សែអក្សរមិនត្រឹមត្រូវ៖ ត្រូវមាន "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `ខ្សែអក្សរមិនត្រឹមត្រូវ៖ ត្រូវតែផ្គូផ្គងនឹងទម្រង់ដែលបានកំណត់ ${_issue.pattern}`;
        return `មិនត្រឹមត្រូវ៖ ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `លេខមិនត្រឹមត្រូវ៖ ត្រូវតែជាពហុគុណនៃ ${issue2.divisor}`;
      case "unrecognized_keys":
        return `រកឃើញសោមិនស្គាល់៖ ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `សោមិនត្រឹមត្រូវនៅក្នុង ${issue2.origin}`;
      case "invalid_union":
        return `ទិន្នន័យមិនត្រឹមត្រូវ`;
      case "invalid_element":
        return `ទិន្នន័យមិនត្រឹមត្រូវនៅក្នុង ${issue2.origin}`;
      default:
        return `ទិន្នន័យមិនត្រឹមត្រូវ`;
    }
  };
};
var init_km = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/kh.js
function kh_default() {
  return km_default();
}
var init_kh = __esm(() => {
  init_km();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/ko.js
function ko_default() {
  return {
    localeError: error24()
  };
}
var error24 = () => {
  const Sizable = {
    string: { unit: "문자", verb: "to have" },
    file: { unit: "바이트", verb: "to have" },
    array: { unit: "개", verb: "to have" },
    set: { unit: "개", verb: "to have" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType6 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "number";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "array";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "입력",
    email: "이메일 주소",
    url: "URL",
    emoji: "이모지",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO 날짜시간",
    date: "ISO 날짜",
    time: "ISO 시간",
    duration: "ISO 기간",
    ipv4: "IPv4 주소",
    ipv6: "IPv6 주소",
    cidrv4: "IPv4 범위",
    cidrv6: "IPv6 범위",
    base64: "base64 인코딩 문자열",
    base64url: "base64url 인코딩 문자열",
    json_string: "JSON 문자열",
    e164: "E.164 번호",
    jwt: "JWT",
    template_literal: "입력"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `잘못된 입력: 예상 타입은 ${issue2.expected}, 받은 타입은 ${parsedType6(issue2.input)}입니다`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `잘못된 입력: 값은 ${stringifyPrimitive(issue2.values[0])} 이어야 합니다`;
        return `잘못된 옵션: ${joinValues(issue2.values, "또는 ")} 중 하나여야 합니다`;
      case "too_big": {
        const adj = issue2.inclusive ? "이하" : "미만";
        const suffix = adj === "미만" ? "이어야 합니다" : "여야 합니다";
        const sizing = getSizing(issue2.origin);
        const unit = sizing?.unit ?? "요소";
        if (sizing)
          return `${issue2.origin ?? "값"}이 너무 큽니다: ${issue2.maximum.toString()}${unit} ${adj}${suffix}`;
        return `${issue2.origin ?? "값"}이 너무 큽니다: ${issue2.maximum.toString()} ${adj}${suffix}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? "이상" : "초과";
        const suffix = adj === "이상" ? "이어야 합니다" : "여야 합니다";
        const sizing = getSizing(issue2.origin);
        const unit = sizing?.unit ?? "요소";
        if (sizing) {
          return `${issue2.origin ?? "값"}이 너무 작습니다: ${issue2.minimum.toString()}${unit} ${adj}${suffix}`;
        }
        return `${issue2.origin ?? "값"}이 너무 작습니다: ${issue2.minimum.toString()} ${adj}${suffix}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `잘못된 문자열: "${_issue.prefix}"(으)로 시작해야 합니다`;
        }
        if (_issue.format === "ends_with")
          return `잘못된 문자열: "${_issue.suffix}"(으)로 끝나야 합니다`;
        if (_issue.format === "includes")
          return `잘못된 문자열: "${_issue.includes}"을(를) 포함해야 합니다`;
        if (_issue.format === "regex")
          return `잘못된 문자열: 정규식 ${_issue.pattern} 패턴과 일치해야 합니다`;
        return `잘못된 ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `잘못된 숫자: ${issue2.divisor}의 배수여야 합니다`;
      case "unrecognized_keys":
        return `인식할 수 없는 키: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `잘못된 키: ${issue2.origin}`;
      case "invalid_union":
        return `잘못된 입력`;
      case "invalid_element":
        return `잘못된 값: ${issue2.origin}`;
      default:
        return `잘못된 입력`;
    }
  };
};
var init_ko = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/lt.js
function getUnitTypeFromNumber(number2) {
  const abs = Math.abs(number2);
  const last = abs % 10;
  const last2 = abs % 100;
  if (last2 >= 11 && last2 <= 19 || last === 0)
    return "many";
  if (last === 1)
    return "one";
  return "few";
}
function lt_default() {
  return {
    localeError: error25()
  };
}
var parsedType6 = (data) => {
  const t = typeof data;
  return parsedTypeFromType(t, data);
}, parsedTypeFromType = (t, data = undefined) => {
  switch (t) {
    case "number": {
      return Number.isNaN(data) ? "NaN" : "skaičius";
    }
    case "bigint": {
      return "sveikasis skaičius";
    }
    case "string": {
      return "eilutė";
    }
    case "boolean": {
      return "loginė reikšmė";
    }
    case "undefined":
    case "void": {
      return "neapibrėžta reikšmė";
    }
    case "function": {
      return "funkcija";
    }
    case "symbol": {
      return "simbolis";
    }
    case "object": {
      if (data === undefined)
        return "nežinomas objektas";
      if (data === null)
        return "nulinė reikšmė";
      if (Array.isArray(data))
        return "masyvas";
      if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
        return data.constructor.name;
      }
      return "objektas";
    }
    case "null": {
      return "nulinė reikšmė";
    }
  }
  return t;
}, capitalizeFirstCharacter = (text) => {
  return text.charAt(0).toUpperCase() + text.slice(1);
}, error25 = () => {
  const Sizable = {
    string: {
      unit: {
        one: "simbolis",
        few: "simboliai",
        many: "simbolių"
      },
      verb: {
        smaller: {
          inclusive: "turi būti ne ilgesnė kaip",
          notInclusive: "turi būti trumpesnė kaip"
        },
        bigger: {
          inclusive: "turi būti ne trumpesnė kaip",
          notInclusive: "turi būti ilgesnė kaip"
        }
      }
    },
    file: {
      unit: {
        one: "baitas",
        few: "baitai",
        many: "baitų"
      },
      verb: {
        smaller: {
          inclusive: "turi būti ne didesnis kaip",
          notInclusive: "turi būti mažesnis kaip"
        },
        bigger: {
          inclusive: "turi būti ne mažesnis kaip",
          notInclusive: "turi būti didesnis kaip"
        }
      }
    },
    array: {
      unit: {
        one: "elementą",
        few: "elementus",
        many: "elementų"
      },
      verb: {
        smaller: {
          inclusive: "turi turėti ne daugiau kaip",
          notInclusive: "turi turėti mažiau kaip"
        },
        bigger: {
          inclusive: "turi turėti ne mažiau kaip",
          notInclusive: "turi turėti daugiau kaip"
        }
      }
    },
    set: {
      unit: {
        one: "elementą",
        few: "elementus",
        many: "elementų"
      },
      verb: {
        smaller: {
          inclusive: "turi turėti ne daugiau kaip",
          notInclusive: "turi turėti mažiau kaip"
        },
        bigger: {
          inclusive: "turi turėti ne mažiau kaip",
          notInclusive: "turi turėti daugiau kaip"
        }
      }
    }
  };
  function getSizing(origin, unitType, inclusive, targetShouldBe) {
    const result = Sizable[origin] ?? null;
    if (result === null)
      return result;
    return {
      unit: result.unit[unitType],
      verb: result.verb[targetShouldBe][inclusive ? "inclusive" : "notInclusive"]
    };
  }
  const Nouns = {
    regex: "įvestis",
    email: "el. pašto adresas",
    url: "URL",
    emoji: "jaustukas",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO data ir laikas",
    date: "ISO data",
    time: "ISO laikas",
    duration: "ISO trukmė",
    ipv4: "IPv4 adresas",
    ipv6: "IPv6 adresas",
    cidrv4: "IPv4 tinklo prefiksas (CIDR)",
    cidrv6: "IPv6 tinklo prefiksas (CIDR)",
    base64: "base64 užkoduota eilutė",
    base64url: "base64url užkoduota eilutė",
    json_string: "JSON eilutė",
    e164: "E.164 numeris",
    jwt: "JWT",
    template_literal: "įvestis"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Gautas tipas ${parsedType6(issue2.input)}, o tikėtasi - ${parsedTypeFromType(issue2.expected)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Privalo būti ${stringifyPrimitive(issue2.values[0])}`;
        return `Privalo būti vienas iš ${joinValues(issue2.values, "|")} pasirinkimų`;
      case "too_big": {
        const origin = parsedTypeFromType(issue2.origin);
        const sizing = getSizing(issue2.origin, getUnitTypeFromNumber(Number(issue2.maximum)), issue2.inclusive ?? false, "smaller");
        if (sizing?.verb)
          return `${capitalizeFirstCharacter(origin ?? issue2.origin ?? "reikšmė")} ${sizing.verb} ${issue2.maximum.toString()} ${sizing.unit ?? "elementų"}`;
        const adj = issue2.inclusive ? "ne didesnis kaip" : "mažesnis kaip";
        return `${capitalizeFirstCharacter(origin ?? issue2.origin ?? "reikšmė")} turi būti ${adj} ${issue2.maximum.toString()} ${sizing?.unit}`;
      }
      case "too_small": {
        const origin = parsedTypeFromType(issue2.origin);
        const sizing = getSizing(issue2.origin, getUnitTypeFromNumber(Number(issue2.minimum)), issue2.inclusive ?? false, "bigger");
        if (sizing?.verb)
          return `${capitalizeFirstCharacter(origin ?? issue2.origin ?? "reikšmė")} ${sizing.verb} ${issue2.minimum.toString()} ${sizing.unit ?? "elementų"}`;
        const adj = issue2.inclusive ? "ne mažesnis kaip" : "didesnis kaip";
        return `${capitalizeFirstCharacter(origin ?? issue2.origin ?? "reikšmė")} turi būti ${adj} ${issue2.minimum.toString()} ${sizing?.unit}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `Eilutė privalo prasidėti "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `Eilutė privalo pasibaigti "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Eilutė privalo įtraukti "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Eilutė privalo atitikti ${_issue.pattern}`;
        return `Neteisingas ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Skaičius privalo būti ${issue2.divisor} kartotinis.`;
      case "unrecognized_keys":
        return `Neatpažint${issue2.keys.length > 1 ? "i" : "as"} rakt${issue2.keys.length > 1 ? "ai" : "as"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return "Rastas klaidingas raktas";
      case "invalid_union":
        return "Klaidinga įvestis";
      case "invalid_element": {
        const origin = parsedTypeFromType(issue2.origin);
        return `${capitalizeFirstCharacter(origin ?? issue2.origin ?? "reikšmė")} turi klaidingą įvestį`;
      }
      default:
        return "Klaidinga įvestis";
    }
  };
};
var init_lt = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/mk.js
function mk_default() {
  return {
    localeError: error26()
  };
}
var error26 = () => {
  const Sizable = {
    string: { unit: "знаци", verb: "да имаат" },
    file: { unit: "бајти", verb: "да имаат" },
    array: { unit: "ставки", verb: "да имаат" },
    set: { unit: "ставки", verb: "да имаат" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType7 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "број";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "низа";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "внес",
    email: "адреса на е-пошта",
    url: "URL",
    emoji: "емоџи",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO датум и време",
    date: "ISO датум",
    time: "ISO време",
    duration: "ISO времетраење",
    ipv4: "IPv4 адреса",
    ipv6: "IPv6 адреса",
    cidrv4: "IPv4 опсег",
    cidrv6: "IPv6 опсег",
    base64: "base64-енкодирана низа",
    base64url: "base64url-енкодирана низа",
    json_string: "JSON низа",
    e164: "E.164 број",
    jwt: "JWT",
    template_literal: "внес"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Грешен внес: се очекува ${issue2.expected}, примено ${parsedType7(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Invalid input: expected ${stringifyPrimitive(issue2.values[0])}`;
        return `Грешана опција: се очекува една ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Премногу голем: се очекува ${issue2.origin ?? "вредноста"} да има ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "елементи"}`;
        return `Премногу голем: се очекува ${issue2.origin ?? "вредноста"} да биде ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Премногу мал: се очекува ${issue2.origin} да има ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Премногу мал: се очекува ${issue2.origin} да биде ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `Неважечка низа: мора да започнува со "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `Неважечка низа: мора да завршува со "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Неважечка низа: мора да вклучува "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Неважечка низа: мора да одгоара на патернот ${_issue.pattern}`;
        return `Invalid ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Грешен број: мора да биде делив со ${issue2.divisor}`;
      case "unrecognized_keys":
        return `${issue2.keys.length > 1 ? "Непрепознаени клучеви" : "Непрепознаен клуч"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Грешен клуч во ${issue2.origin}`;
      case "invalid_union":
        return "Грешен внес";
      case "invalid_element":
        return `Грешна вредност во ${issue2.origin}`;
      default:
        return `Грешен внес`;
    }
  };
};
var init_mk = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/ms.js
function ms_default() {
  return {
    localeError: error27()
  };
}
var error27 = () => {
  const Sizable = {
    string: { unit: "aksara", verb: "mempunyai" },
    file: { unit: "bait", verb: "mempunyai" },
    array: { unit: "elemen", verb: "mempunyai" },
    set: { unit: "elemen", verb: "mempunyai" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType7 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "nombor";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "array";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "input",
    email: "alamat e-mel",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "tarikh masa ISO",
    date: "tarikh ISO",
    time: "masa ISO",
    duration: "tempoh ISO",
    ipv4: "alamat IPv4",
    ipv6: "alamat IPv6",
    cidrv4: "julat IPv4",
    cidrv6: "julat IPv6",
    base64: "string dikodkan base64",
    base64url: "string dikodkan base64url",
    json_string: "string JSON",
    e164: "nombor E.164",
    jwt: "JWT",
    template_literal: "input"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Input tidak sah: dijangka ${issue2.expected}, diterima ${parsedType7(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Input tidak sah: dijangka ${stringifyPrimitive(issue2.values[0])}`;
        return `Pilihan tidak sah: dijangka salah satu daripada ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Terlalu besar: dijangka ${issue2.origin ?? "nilai"} ${sizing.verb} ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elemen"}`;
        return `Terlalu besar: dijangka ${issue2.origin ?? "nilai"} adalah ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Terlalu kecil: dijangka ${issue2.origin} ${sizing.verb} ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Terlalu kecil: dijangka ${issue2.origin} adalah ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `String tidak sah: mesti bermula dengan "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `String tidak sah: mesti berakhir dengan "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `String tidak sah: mesti mengandungi "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `String tidak sah: mesti sepadan dengan corak ${_issue.pattern}`;
        return `${Nouns[_issue.format] ?? issue2.format} tidak sah`;
      }
      case "not_multiple_of":
        return `Nombor tidak sah: perlu gandaan ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Kunci tidak dikenali: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Kunci tidak sah dalam ${issue2.origin}`;
      case "invalid_union":
        return "Input tidak sah";
      case "invalid_element":
        return `Nilai tidak sah dalam ${issue2.origin}`;
      default:
        return `Input tidak sah`;
    }
  };
};
var init_ms = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/nl.js
function nl_default() {
  return {
    localeError: error28()
  };
}
var error28 = () => {
  const Sizable = {
    string: { unit: "tekens" },
    file: { unit: "bytes" },
    array: { unit: "elementen" },
    set: { unit: "elementen" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType7 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "getal";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "array";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "invoer",
    email: "emailadres",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO datum en tijd",
    date: "ISO datum",
    time: "ISO tijd",
    duration: "ISO duur",
    ipv4: "IPv4-adres",
    ipv6: "IPv6-adres",
    cidrv4: "IPv4-bereik",
    cidrv6: "IPv6-bereik",
    base64: "base64-gecodeerde tekst",
    base64url: "base64 URL-gecodeerde tekst",
    json_string: "JSON string",
    e164: "E.164-nummer",
    jwt: "JWT",
    template_literal: "invoer"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Ongeldige invoer: verwacht ${issue2.expected}, ontving ${parsedType7(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Ongeldige invoer: verwacht ${stringifyPrimitive(issue2.values[0])}`;
        return `Ongeldige optie: verwacht één van ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Te lang: verwacht dat ${issue2.origin ?? "waarde"} ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elementen"} bevat`;
        return `Te lang: verwacht dat ${issue2.origin ?? "waarde"} ${adj}${issue2.maximum.toString()} is`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Te kort: verwacht dat ${issue2.origin} ${adj}${issue2.minimum.toString()} ${sizing.unit} bevat`;
        }
        return `Te kort: verwacht dat ${issue2.origin} ${adj}${issue2.minimum.toString()} is`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `Ongeldige tekst: moet met "${_issue.prefix}" beginnen`;
        }
        if (_issue.format === "ends_with")
          return `Ongeldige tekst: moet op "${_issue.suffix}" eindigen`;
        if (_issue.format === "includes")
          return `Ongeldige tekst: moet "${_issue.includes}" bevatten`;
        if (_issue.format === "regex")
          return `Ongeldige tekst: moet overeenkomen met patroon ${_issue.pattern}`;
        return `Ongeldig: ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Ongeldig getal: moet een veelvoud van ${issue2.divisor} zijn`;
      case "unrecognized_keys":
        return `Onbekende key${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Ongeldige key in ${issue2.origin}`;
      case "invalid_union":
        return "Ongeldige invoer";
      case "invalid_element":
        return `Ongeldige waarde in ${issue2.origin}`;
      default:
        return `Ongeldige invoer`;
    }
  };
};
var init_nl = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/no.js
function no_default() {
  return {
    localeError: error29()
  };
}
var error29 = () => {
  const Sizable = {
    string: { unit: "tegn", verb: "å ha" },
    file: { unit: "bytes", verb: "å ha" },
    array: { unit: "elementer", verb: "å inneholde" },
    set: { unit: "elementer", verb: "å inneholde" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType7 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "tall";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "liste";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "input",
    email: "e-postadresse",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO dato- og klokkeslett",
    date: "ISO-dato",
    time: "ISO-klokkeslett",
    duration: "ISO-varighet",
    ipv4: "IPv4-område",
    ipv6: "IPv6-område",
    cidrv4: "IPv4-spekter",
    cidrv6: "IPv6-spekter",
    base64: "base64-enkodet streng",
    base64url: "base64url-enkodet streng",
    json_string: "JSON-streng",
    e164: "E.164-nummer",
    jwt: "JWT",
    template_literal: "input"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Ugyldig input: forventet ${issue2.expected}, fikk ${parsedType7(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Ugyldig verdi: forventet ${stringifyPrimitive(issue2.values[0])}`;
        return `Ugyldig valg: forventet en av ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `For stor(t): forventet ${issue2.origin ?? "value"} til å ha ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elementer"}`;
        return `For stor(t): forventet ${issue2.origin ?? "value"} til å ha ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `For lite(n): forventet ${issue2.origin} til å ha ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `For lite(n): forventet ${issue2.origin} til å ha ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Ugyldig streng: må starte med "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Ugyldig streng: må ende med "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Ugyldig streng: må inneholde "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Ugyldig streng: må matche mønsteret ${_issue.pattern}`;
        return `Ugyldig ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Ugyldig tall: må være et multiplum av ${issue2.divisor}`;
      case "unrecognized_keys":
        return `${issue2.keys.length > 1 ? "Ukjente nøkler" : "Ukjent nøkkel"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Ugyldig nøkkel i ${issue2.origin}`;
      case "invalid_union":
        return "Ugyldig input";
      case "invalid_element":
        return `Ugyldig verdi i ${issue2.origin}`;
      default:
        return `Ugyldig input`;
    }
  };
};
var init_no = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/ota.js
function ota_default() {
  return {
    localeError: error30()
  };
}
var error30 = () => {
  const Sizable = {
    string: { unit: "harf", verb: "olmalıdır" },
    file: { unit: "bayt", verb: "olmalıdır" },
    array: { unit: "unsur", verb: "olmalıdır" },
    set: { unit: "unsur", verb: "olmalıdır" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType7 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "numara";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "saf";
        }
        if (data === null) {
          return "gayb";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "giren",
    email: "epostagâh",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO hengâmı",
    date: "ISO tarihi",
    time: "ISO zamanı",
    duration: "ISO müddeti",
    ipv4: "IPv4 nişânı",
    ipv6: "IPv6 nişânı",
    cidrv4: "IPv4 menzili",
    cidrv6: "IPv6 menzili",
    base64: "base64-şifreli metin",
    base64url: "base64url-şifreli metin",
    json_string: "JSON metin",
    e164: "E.164 sayısı",
    jwt: "JWT",
    template_literal: "giren"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Fâsit giren: umulan ${issue2.expected}, alınan ${parsedType7(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Fâsit giren: umulan ${stringifyPrimitive(issue2.values[0])}`;
        return `Fâsit tercih: mûteberler ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Fazla büyük: ${issue2.origin ?? "value"}, ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elements"} sahip olmalıydı.`;
        return `Fazla büyük: ${issue2.origin ?? "value"}, ${adj}${issue2.maximum.toString()} olmalıydı.`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Fazla küçük: ${issue2.origin}, ${adj}${issue2.minimum.toString()} ${sizing.unit} sahip olmalıydı.`;
        }
        return `Fazla küçük: ${issue2.origin}, ${adj}${issue2.minimum.toString()} olmalıydı.`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Fâsit metin: "${_issue.prefix}" ile başlamalı.`;
        if (_issue.format === "ends_with")
          return `Fâsit metin: "${_issue.suffix}" ile bitmeli.`;
        if (_issue.format === "includes")
          return `Fâsit metin: "${_issue.includes}" ihtivâ etmeli.`;
        if (_issue.format === "regex")
          return `Fâsit metin: ${_issue.pattern} nakşına uymalı.`;
        return `Fâsit ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Fâsit sayı: ${issue2.divisor} katı olmalıydı.`;
      case "unrecognized_keys":
        return `Tanınmayan anahtar ${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `${issue2.origin} için tanınmayan anahtar var.`;
      case "invalid_union":
        return "Giren tanınamadı.";
      case "invalid_element":
        return `${issue2.origin} için tanınmayan kıymet var.`;
      default:
        return `Kıymet tanınamadı.`;
    }
  };
};
var init_ota = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/ps.js
function ps_default() {
  return {
    localeError: error31()
  };
}
var error31 = () => {
  const Sizable = {
    string: { unit: "توکي", verb: "ولري" },
    file: { unit: "بایټس", verb: "ولري" },
    array: { unit: "توکي", verb: "ولري" },
    set: { unit: "توکي", verb: "ولري" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType7 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "عدد";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "ارې";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "ورودي",
    email: "بریښنالیک",
    url: "یو آر ال",
    emoji: "ایموجي",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "نیټه او وخت",
    date: "نېټه",
    time: "وخت",
    duration: "موده",
    ipv4: "د IPv4 پته",
    ipv6: "د IPv6 پته",
    cidrv4: "د IPv4 ساحه",
    cidrv6: "د IPv6 ساحه",
    base64: "base64-encoded متن",
    base64url: "base64url-encoded متن",
    json_string: "JSON متن",
    e164: "د E.164 شمېره",
    jwt: "JWT",
    template_literal: "ورودي"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `ناسم ورودي: باید ${issue2.expected} وای, مګر ${parsedType7(issue2.input)} ترلاسه شو`;
      case "invalid_value":
        if (issue2.values.length === 1) {
          return `ناسم ورودي: باید ${stringifyPrimitive(issue2.values[0])} وای`;
        }
        return `ناسم انتخاب: باید یو له ${joinValues(issue2.values, "|")} څخه وای`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `ډیر لوی: ${issue2.origin ?? "ارزښت"} باید ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "عنصرونه"} ولري`;
        }
        return `ډیر لوی: ${issue2.origin ?? "ارزښت"} باید ${adj}${issue2.maximum.toString()} وي`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `ډیر کوچنی: ${issue2.origin} باید ${adj}${issue2.minimum.toString()} ${sizing.unit} ولري`;
        }
        return `ډیر کوچنی: ${issue2.origin} باید ${adj}${issue2.minimum.toString()} وي`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `ناسم متن: باید د "${_issue.prefix}" سره پیل شي`;
        }
        if (_issue.format === "ends_with") {
          return `ناسم متن: باید د "${_issue.suffix}" سره پای ته ورسيږي`;
        }
        if (_issue.format === "includes") {
          return `ناسم متن: باید "${_issue.includes}" ولري`;
        }
        if (_issue.format === "regex") {
          return `ناسم متن: باید د ${_issue.pattern} سره مطابقت ولري`;
        }
        return `${Nouns[_issue.format] ?? issue2.format} ناسم دی`;
      }
      case "not_multiple_of":
        return `ناسم عدد: باید د ${issue2.divisor} مضرب وي`;
      case "unrecognized_keys":
        return `ناسم ${issue2.keys.length > 1 ? "کلیډونه" : "کلیډ"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `ناسم کلیډ په ${issue2.origin} کې`;
      case "invalid_union":
        return `ناسمه ورودي`;
      case "invalid_element":
        return `ناسم عنصر په ${issue2.origin} کې`;
      default:
        return `ناسمه ورودي`;
    }
  };
};
var init_ps = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/pl.js
function pl_default() {
  return {
    localeError: error32()
  };
}
var error32 = () => {
  const Sizable = {
    string: { unit: "znaków", verb: "mieć" },
    file: { unit: "bajtów", verb: "mieć" },
    array: { unit: "elementów", verb: "mieć" },
    set: { unit: "elementów", verb: "mieć" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType7 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "liczba";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "tablica";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "wyrażenie",
    email: "adres email",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "data i godzina w formacie ISO",
    date: "data w formacie ISO",
    time: "godzina w formacie ISO",
    duration: "czas trwania ISO",
    ipv4: "adres IPv4",
    ipv6: "adres IPv6",
    cidrv4: "zakres IPv4",
    cidrv6: "zakres IPv6",
    base64: "ciąg znaków zakodowany w formacie base64",
    base64url: "ciąg znaków zakodowany w formacie base64url",
    json_string: "ciąg znaków w formacie JSON",
    e164: "liczba E.164",
    jwt: "JWT",
    template_literal: "wejście"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Nieprawidłowe dane wejściowe: oczekiwano ${issue2.expected}, otrzymano ${parsedType7(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Nieprawidłowe dane wejściowe: oczekiwano ${stringifyPrimitive(issue2.values[0])}`;
        return `Nieprawidłowa opcja: oczekiwano jednej z wartości ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Za duża wartość: oczekiwano, że ${issue2.origin ?? "wartość"} będzie mieć ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elementów"}`;
        }
        return `Zbyt duż(y/a/e): oczekiwano, że ${issue2.origin ?? "wartość"} będzie wynosić ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Za mała wartość: oczekiwano, że ${issue2.origin ?? "wartość"} będzie mieć ${adj}${issue2.minimum.toString()} ${sizing.unit ?? "elementów"}`;
        }
        return `Zbyt mał(y/a/e): oczekiwano, że ${issue2.origin ?? "wartość"} będzie wynosić ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Nieprawidłowy ciąg znaków: musi zaczynać się od "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Nieprawidłowy ciąg znaków: musi kończyć się na "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Nieprawidłowy ciąg znaków: musi zawierać "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Nieprawidłowy ciąg znaków: musi odpowiadać wzorcowi ${_issue.pattern}`;
        return `Nieprawidłow(y/a/e) ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Nieprawidłowa liczba: musi być wielokrotnością ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Nierozpoznane klucze${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Nieprawidłowy klucz w ${issue2.origin}`;
      case "invalid_union":
        return "Nieprawidłowe dane wejściowe";
      case "invalid_element":
        return `Nieprawidłowa wartość w ${issue2.origin}`;
      default:
        return `Nieprawidłowe dane wejściowe`;
    }
  };
};
var init_pl = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/pt.js
function pt_default() {
  return {
    localeError: error33()
  };
}
var error33 = () => {
  const Sizable = {
    string: { unit: "caracteres", verb: "ter" },
    file: { unit: "bytes", verb: "ter" },
    array: { unit: "itens", verb: "ter" },
    set: { unit: "itens", verb: "ter" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType7 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "número";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "array";
        }
        if (data === null) {
          return "nulo";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "padrão",
    email: "endereço de e-mail",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "data e hora ISO",
    date: "data ISO",
    time: "hora ISO",
    duration: "duração ISO",
    ipv4: "endereço IPv4",
    ipv6: "endereço IPv6",
    cidrv4: "faixa de IPv4",
    cidrv6: "faixa de IPv6",
    base64: "texto codificado em base64",
    base64url: "URL codificada em base64",
    json_string: "texto JSON",
    e164: "número E.164",
    jwt: "JWT",
    template_literal: "entrada"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Tipo inválido: esperado ${issue2.expected}, recebido ${parsedType7(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Entrada inválida: esperado ${stringifyPrimitive(issue2.values[0])}`;
        return `Opção inválida: esperada uma das ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Muito grande: esperado que ${issue2.origin ?? "valor"} tivesse ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elementos"}`;
        return `Muito grande: esperado que ${issue2.origin ?? "valor"} fosse ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Muito pequeno: esperado que ${issue2.origin} tivesse ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Muito pequeno: esperado que ${issue2.origin} fosse ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Texto inválido: deve começar com "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Texto inválido: deve terminar com "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Texto inválido: deve incluir "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Texto inválido: deve corresponder ao padrão ${_issue.pattern}`;
        return `${Nouns[_issue.format] ?? issue2.format} inválido`;
      }
      case "not_multiple_of":
        return `Número inválido: deve ser múltiplo de ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Chave${issue2.keys.length > 1 ? "s" : ""} desconhecida${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Chave inválida em ${issue2.origin}`;
      case "invalid_union":
        return "Entrada inválida";
      case "invalid_element":
        return `Valor inválido em ${issue2.origin}`;
      default:
        return `Campo inválido`;
    }
  };
};
var init_pt = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/ru.js
function getRussianPlural(count, one, few, many) {
  const absCount = Math.abs(count);
  const lastDigit = absCount % 10;
  const lastTwoDigits = absCount % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return many;
  }
  if (lastDigit === 1) {
    return one;
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return few;
  }
  return many;
}
function ru_default() {
  return {
    localeError: error34()
  };
}
var error34 = () => {
  const Sizable = {
    string: {
      unit: {
        one: "символ",
        few: "символа",
        many: "символов"
      },
      verb: "иметь"
    },
    file: {
      unit: {
        one: "байт",
        few: "байта",
        many: "байт"
      },
      verb: "иметь"
    },
    array: {
      unit: {
        one: "элемент",
        few: "элемента",
        many: "элементов"
      },
      verb: "иметь"
    },
    set: {
      unit: {
        one: "элемент",
        few: "элемента",
        many: "элементов"
      },
      verb: "иметь"
    }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType7 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "число";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "массив";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "ввод",
    email: "email адрес",
    url: "URL",
    emoji: "эмодзи",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO дата и время",
    date: "ISO дата",
    time: "ISO время",
    duration: "ISO длительность",
    ipv4: "IPv4 адрес",
    ipv6: "IPv6 адрес",
    cidrv4: "IPv4 диапазон",
    cidrv6: "IPv6 диапазон",
    base64: "строка в формате base64",
    base64url: "строка в формате base64url",
    json_string: "JSON строка",
    e164: "номер E.164",
    jwt: "JWT",
    template_literal: "ввод"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Неверный ввод: ожидалось ${issue2.expected}, получено ${parsedType7(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Неверный ввод: ожидалось ${stringifyPrimitive(issue2.values[0])}`;
        return `Неверный вариант: ожидалось одно из ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          const maxValue = Number(issue2.maximum);
          const unit = getRussianPlural(maxValue, sizing.unit.one, sizing.unit.few, sizing.unit.many);
          return `Слишком большое значение: ожидалось, что ${issue2.origin ?? "значение"} будет иметь ${adj}${issue2.maximum.toString()} ${unit}`;
        }
        return `Слишком большое значение: ожидалось, что ${issue2.origin ?? "значение"} будет ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          const minValue = Number(issue2.minimum);
          const unit = getRussianPlural(minValue, sizing.unit.one, sizing.unit.few, sizing.unit.many);
          return `Слишком маленькое значение: ожидалось, что ${issue2.origin} будет иметь ${adj}${issue2.minimum.toString()} ${unit}`;
        }
        return `Слишком маленькое значение: ожидалось, что ${issue2.origin} будет ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Неверная строка: должна начинаться с "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Неверная строка: должна заканчиваться на "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Неверная строка: должна содержать "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Неверная строка: должна соответствовать шаблону ${_issue.pattern}`;
        return `Неверный ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Неверное число: должно быть кратным ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Нераспознанн${issue2.keys.length > 1 ? "ые" : "ый"} ключ${issue2.keys.length > 1 ? "и" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Неверный ключ в ${issue2.origin}`;
      case "invalid_union":
        return "Неверные входные данные";
      case "invalid_element":
        return `Неверное значение в ${issue2.origin}`;
      default:
        return `Неверные входные данные`;
    }
  };
};
var init_ru = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/sl.js
function sl_default() {
  return {
    localeError: error35()
  };
}
var error35 = () => {
  const Sizable = {
    string: { unit: "znakov", verb: "imeti" },
    file: { unit: "bajtov", verb: "imeti" },
    array: { unit: "elementov", verb: "imeti" },
    set: { unit: "elementov", verb: "imeti" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType7 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "število";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "tabela";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "vnos",
    email: "e-poštni naslov",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO datum in čas",
    date: "ISO datum",
    time: "ISO čas",
    duration: "ISO trajanje",
    ipv4: "IPv4 naslov",
    ipv6: "IPv6 naslov",
    cidrv4: "obseg IPv4",
    cidrv6: "obseg IPv6",
    base64: "base64 kodiran niz",
    base64url: "base64url kodiran niz",
    json_string: "JSON niz",
    e164: "E.164 številka",
    jwt: "JWT",
    template_literal: "vnos"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Neveljaven vnos: pričakovano ${issue2.expected}, prejeto ${parsedType7(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Neveljaven vnos: pričakovano ${stringifyPrimitive(issue2.values[0])}`;
        return `Neveljavna možnost: pričakovano eno izmed ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Preveliko: pričakovano, da bo ${issue2.origin ?? "vrednost"} imelo ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elementov"}`;
        return `Preveliko: pričakovano, da bo ${issue2.origin ?? "vrednost"} ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Premajhno: pričakovano, da bo ${issue2.origin} imelo ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Premajhno: pričakovano, da bo ${issue2.origin} ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `Neveljaven niz: mora se začeti z "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `Neveljaven niz: mora se končati z "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Neveljaven niz: mora vsebovati "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Neveljaven niz: mora ustrezati vzorcu ${_issue.pattern}`;
        return `Neveljaven ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Neveljavno število: mora biti večkratnik ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Neprepoznan${issue2.keys.length > 1 ? "i ključi" : " ključ"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Neveljaven ključ v ${issue2.origin}`;
      case "invalid_union":
        return "Neveljaven vnos";
      case "invalid_element":
        return `Neveljavna vrednost v ${issue2.origin}`;
      default:
        return "Neveljaven vnos";
    }
  };
};
var init_sl = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/sv.js
function sv_default() {
  return {
    localeError: error36()
  };
}
var error36 = () => {
  const Sizable = {
    string: { unit: "tecken", verb: "att ha" },
    file: { unit: "bytes", verb: "att ha" },
    array: { unit: "objekt", verb: "att innehålla" },
    set: { unit: "objekt", verb: "att innehålla" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType7 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "antal";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "lista";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "reguljärt uttryck",
    email: "e-postadress",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO-datum och tid",
    date: "ISO-datum",
    time: "ISO-tid",
    duration: "ISO-varaktighet",
    ipv4: "IPv4-intervall",
    ipv6: "IPv6-intervall",
    cidrv4: "IPv4-spektrum",
    cidrv6: "IPv6-spektrum",
    base64: "base64-kodad sträng",
    base64url: "base64url-kodad sträng",
    json_string: "JSON-sträng",
    e164: "E.164-nummer",
    jwt: "JWT",
    template_literal: "mall-literal"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Ogiltig inmatning: förväntat ${issue2.expected}, fick ${parsedType7(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Ogiltig inmatning: förväntat ${stringifyPrimitive(issue2.values[0])}`;
        return `Ogiltigt val: förväntade en av ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `För stor(t): förväntade ${issue2.origin ?? "värdet"} att ha ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "element"}`;
        }
        return `För stor(t): förväntat ${issue2.origin ?? "värdet"} att ha ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `För lite(t): förväntade ${issue2.origin ?? "värdet"} att ha ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `För lite(t): förväntade ${issue2.origin ?? "värdet"} att ha ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `Ogiltig sträng: måste börja med "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `Ogiltig sträng: måste sluta med "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Ogiltig sträng: måste innehålla "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Ogiltig sträng: måste matcha mönstret "${_issue.pattern}"`;
        return `Ogiltig(t) ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Ogiltigt tal: måste vara en multipel av ${issue2.divisor}`;
      case "unrecognized_keys":
        return `${issue2.keys.length > 1 ? "Okända nycklar" : "Okänd nyckel"}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Ogiltig nyckel i ${issue2.origin ?? "värdet"}`;
      case "invalid_union":
        return "Ogiltig input";
      case "invalid_element":
        return `Ogiltigt värde i ${issue2.origin ?? "värdet"}`;
      default:
        return `Ogiltig input`;
    }
  };
};
var init_sv = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/ta.js
function ta_default() {
  return {
    localeError: error37()
  };
}
var error37 = () => {
  const Sizable = {
    string: { unit: "எழுத்துக்கள்", verb: "கொண்டிருக்க வேண்டும்" },
    file: { unit: "பைட்டுகள்", verb: "கொண்டிருக்க வேண்டும்" },
    array: { unit: "உறுப்புகள்", verb: "கொண்டிருக்க வேண்டும்" },
    set: { unit: "உறுப்புகள்", verb: "கொண்டிருக்க வேண்டும்" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType7 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "எண் அல்லாதது" : "எண்";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "அணி";
        }
        if (data === null) {
          return "வெறுமை";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "உள்ளீடு",
    email: "மின்னஞ்சல் முகவரி",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO தேதி நேரம்",
    date: "ISO தேதி",
    time: "ISO நேரம்",
    duration: "ISO கால அளவு",
    ipv4: "IPv4 முகவரி",
    ipv6: "IPv6 முகவரி",
    cidrv4: "IPv4 வரம்பு",
    cidrv6: "IPv6 வரம்பு",
    base64: "base64-encoded சரம்",
    base64url: "base64url-encoded சரம்",
    json_string: "JSON சரம்",
    e164: "E.164 எண்",
    jwt: "JWT",
    template_literal: "input"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `தவறான உள்ளீடு: எதிர்பார்க்கப்பட்டது ${issue2.expected}, பெறப்பட்டது ${parsedType7(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `தவறான உள்ளீடு: எதிர்பார்க்கப்பட்டது ${stringifyPrimitive(issue2.values[0])}`;
        return `தவறான விருப்பம்: எதிர்பார்க்கப்பட்டது ${joinValues(issue2.values, "|")} இல் ஒன்று`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `மிக பெரியது: எதிர்பார்க்கப்பட்டது ${issue2.origin ?? "மதிப்பு"} ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "உறுப்புகள்"} ஆக இருக்க வேண்டும்`;
        }
        return `மிக பெரியது: எதிர்பார்க்கப்பட்டது ${issue2.origin ?? "மதிப்பு"} ${adj}${issue2.maximum.toString()} ஆக இருக்க வேண்டும்`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `மிகச் சிறியது: எதிர்பார்க்கப்பட்டது ${issue2.origin} ${adj}${issue2.minimum.toString()} ${sizing.unit} ஆக இருக்க வேண்டும்`;
        }
        return `மிகச் சிறியது: எதிர்பார்க்கப்பட்டது ${issue2.origin} ${adj}${issue2.minimum.toString()} ஆக இருக்க வேண்டும்`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `தவறான சரம்: "${_issue.prefix}" இல் தொடங்க வேண்டும்`;
        if (_issue.format === "ends_with")
          return `தவறான சரம்: "${_issue.suffix}" இல் முடிவடைய வேண்டும்`;
        if (_issue.format === "includes")
          return `தவறான சரம்: "${_issue.includes}" ஐ உள்ளடக்க வேண்டும்`;
        if (_issue.format === "regex")
          return `தவறான சரம்: ${_issue.pattern} முறைபாட்டுடன் பொருந்த வேண்டும்`;
        return `தவறான ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `தவறான எண்: ${issue2.divisor} இன் பலமாக இருக்க வேண்டும்`;
      case "unrecognized_keys":
        return `அடையாளம் தெரியாத விசை${issue2.keys.length > 1 ? "கள்" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `${issue2.origin} இல் தவறான விசை`;
      case "invalid_union":
        return "தவறான உள்ளீடு";
      case "invalid_element":
        return `${issue2.origin} இல் தவறான மதிப்பு`;
      default:
        return `தவறான உள்ளீடு`;
    }
  };
};
var init_ta = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/th.js
function th_default() {
  return {
    localeError: error38()
  };
}
var error38 = () => {
  const Sizable = {
    string: { unit: "ตัวอักษร", verb: "ควรมี" },
    file: { unit: "ไบต์", verb: "ควรมี" },
    array: { unit: "รายการ", verb: "ควรมี" },
    set: { unit: "รายการ", verb: "ควรมี" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType7 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "ไม่ใช่ตัวเลข (NaN)" : "ตัวเลข";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "อาร์เรย์ (Array)";
        }
        if (data === null) {
          return "ไม่มีค่า (null)";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "ข้อมูลที่ป้อน",
    email: "ที่อยู่อีเมล",
    url: "URL",
    emoji: "อิโมจิ",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "วันที่เวลาแบบ ISO",
    date: "วันที่แบบ ISO",
    time: "เวลาแบบ ISO",
    duration: "ช่วงเวลาแบบ ISO",
    ipv4: "ที่อยู่ IPv4",
    ipv6: "ที่อยู่ IPv6",
    cidrv4: "ช่วง IP แบบ IPv4",
    cidrv6: "ช่วง IP แบบ IPv6",
    base64: "ข้อความแบบ Base64",
    base64url: "ข้อความแบบ Base64 สำหรับ URL",
    json_string: "ข้อความแบบ JSON",
    e164: "เบอร์โทรศัพท์ระหว่างประเทศ (E.164)",
    jwt: "โทเคน JWT",
    template_literal: "ข้อมูลที่ป้อน"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `ประเภทข้อมูลไม่ถูกต้อง: ควรเป็น ${issue2.expected} แต่ได้รับ ${parsedType7(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `ค่าไม่ถูกต้อง: ควรเป็น ${stringifyPrimitive(issue2.values[0])}`;
        return `ตัวเลือกไม่ถูกต้อง: ควรเป็นหนึ่งใน ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "ไม่เกิน" : "น้อยกว่า";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `เกินกำหนด: ${issue2.origin ?? "ค่า"} ควรมี${adj} ${issue2.maximum.toString()} ${sizing.unit ?? "รายการ"}`;
        return `เกินกำหนด: ${issue2.origin ?? "ค่า"} ควรมี${adj} ${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? "อย่างน้อย" : "มากกว่า";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `น้อยกว่ากำหนด: ${issue2.origin} ควรมี${adj} ${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `น้อยกว่ากำหนด: ${issue2.origin} ควรมี${adj} ${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `รูปแบบไม่ถูกต้อง: ข้อความต้องขึ้นต้นด้วย "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `รูปแบบไม่ถูกต้อง: ข้อความต้องลงท้ายด้วย "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `รูปแบบไม่ถูกต้อง: ข้อความต้องมี "${_issue.includes}" อยู่ในข้อความ`;
        if (_issue.format === "regex")
          return `รูปแบบไม่ถูกต้อง: ต้องตรงกับรูปแบบที่กำหนด ${_issue.pattern}`;
        return `รูปแบบไม่ถูกต้อง: ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `ตัวเลขไม่ถูกต้อง: ต้องเป็นจำนวนที่หารด้วย ${issue2.divisor} ได้ลงตัว`;
      case "unrecognized_keys":
        return `พบคีย์ที่ไม่รู้จัก: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `คีย์ไม่ถูกต้องใน ${issue2.origin}`;
      case "invalid_union":
        return "ข้อมูลไม่ถูกต้อง: ไม่ตรงกับรูปแบบยูเนียนที่กำหนดไว้";
      case "invalid_element":
        return `ข้อมูลไม่ถูกต้องใน ${issue2.origin}`;
      default:
        return `ข้อมูลไม่ถูกต้อง`;
    }
  };
};
var init_th = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/tr.js
function tr_default() {
  return {
    localeError: error39()
  };
}
var parsedType7 = (data) => {
  const t = typeof data;
  switch (t) {
    case "number": {
      return Number.isNaN(data) ? "NaN" : "number";
    }
    case "object": {
      if (Array.isArray(data)) {
        return "array";
      }
      if (data === null) {
        return "null";
      }
      if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
        return data.constructor.name;
      }
    }
  }
  return t;
}, error39 = () => {
  const Sizable = {
    string: { unit: "karakter", verb: "olmalı" },
    file: { unit: "bayt", verb: "olmalı" },
    array: { unit: "öğe", verb: "olmalı" },
    set: { unit: "öğe", verb: "olmalı" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const Nouns = {
    regex: "girdi",
    email: "e-posta adresi",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO tarih ve saat",
    date: "ISO tarih",
    time: "ISO saat",
    duration: "ISO süre",
    ipv4: "IPv4 adresi",
    ipv6: "IPv6 adresi",
    cidrv4: "IPv4 aralığı",
    cidrv6: "IPv6 aralığı",
    base64: "base64 ile şifrelenmiş metin",
    base64url: "base64url ile şifrelenmiş metin",
    json_string: "JSON dizesi",
    e164: "E.164 sayısı",
    jwt: "JWT",
    template_literal: "Şablon dizesi"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Geçersiz değer: beklenen ${issue2.expected}, alınan ${parsedType7(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Geçersiz değer: beklenen ${stringifyPrimitive(issue2.values[0])}`;
        return `Geçersiz seçenek: aşağıdakilerden biri olmalı: ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Çok büyük: beklenen ${issue2.origin ?? "değer"} ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "öğe"}`;
        return `Çok büyük: beklenen ${issue2.origin ?? "değer"} ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Çok küçük: beklenen ${issue2.origin} ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        return `Çok küçük: beklenen ${issue2.origin} ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Geçersiz metin: "${_issue.prefix}" ile başlamalı`;
        if (_issue.format === "ends_with")
          return `Geçersiz metin: "${_issue.suffix}" ile bitmeli`;
        if (_issue.format === "includes")
          return `Geçersiz metin: "${_issue.includes}" içermeli`;
        if (_issue.format === "regex")
          return `Geçersiz metin: ${_issue.pattern} desenine uymalı`;
        return `Geçersiz ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Geçersiz sayı: ${issue2.divisor} ile tam bölünebilmeli`;
      case "unrecognized_keys":
        return `Tanınmayan anahtar${issue2.keys.length > 1 ? "lar" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `${issue2.origin} içinde geçersiz anahtar`;
      case "invalid_union":
        return "Geçersiz değer";
      case "invalid_element":
        return `${issue2.origin} içinde geçersiz değer`;
      default:
        return `Geçersiz değer`;
    }
  };
};
var init_tr = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/uk.js
function uk_default() {
  return {
    localeError: error40()
  };
}
var error40 = () => {
  const Sizable = {
    string: { unit: "символів", verb: "матиме" },
    file: { unit: "байтів", verb: "матиме" },
    array: { unit: "елементів", verb: "матиме" },
    set: { unit: "елементів", verb: "матиме" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType8 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "число";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "масив";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "вхідні дані",
    email: "адреса електронної пошти",
    url: "URL",
    emoji: "емодзі",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "дата та час ISO",
    date: "дата ISO",
    time: "час ISO",
    duration: "тривалість ISO",
    ipv4: "адреса IPv4",
    ipv6: "адреса IPv6",
    cidrv4: "діапазон IPv4",
    cidrv6: "діапазон IPv6",
    base64: "рядок у кодуванні base64",
    base64url: "рядок у кодуванні base64url",
    json_string: "рядок JSON",
    e164: "номер E.164",
    jwt: "JWT",
    template_literal: "вхідні дані"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Неправильні вхідні дані: очікується ${issue2.expected}, отримано ${parsedType8(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Неправильні вхідні дані: очікується ${stringifyPrimitive(issue2.values[0])}`;
        return `Неправильна опція: очікується одне з ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Занадто велике: очікується, що ${issue2.origin ?? "значення"} ${sizing.verb} ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "елементів"}`;
        return `Занадто велике: очікується, що ${issue2.origin ?? "значення"} буде ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Занадто мале: очікується, що ${issue2.origin} ${sizing.verb} ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Занадто мале: очікується, що ${issue2.origin} буде ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Неправильний рядок: повинен починатися з "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Неправильний рядок: повинен закінчуватися на "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Неправильний рядок: повинен містити "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Неправильний рядок: повинен відповідати шаблону ${_issue.pattern}`;
        return `Неправильний ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Неправильне число: повинно бути кратним ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Нерозпізнаний ключ${issue2.keys.length > 1 ? "і" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Неправильний ключ у ${issue2.origin}`;
      case "invalid_union":
        return "Неправильні вхідні дані";
      case "invalid_element":
        return `Неправильне значення у ${issue2.origin}`;
      default:
        return `Неправильні вхідні дані`;
    }
  };
};
var init_uk = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/ua.js
function ua_default() {
  return uk_default();
}
var init_ua = __esm(() => {
  init_uk();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/ur.js
function ur_default() {
  return {
    localeError: error41()
  };
}
var error41 = () => {
  const Sizable = {
    string: { unit: "حروف", verb: "ہونا" },
    file: { unit: "بائٹس", verb: "ہونا" },
    array: { unit: "آئٹمز", verb: "ہونا" },
    set: { unit: "آئٹمز", verb: "ہونا" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType8 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "نمبر";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "آرے";
        }
        if (data === null) {
          return "نل";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "ان پٹ",
    email: "ای میل ایڈریس",
    url: "یو آر ایل",
    emoji: "ایموجی",
    uuid: "یو یو آئی ڈی",
    uuidv4: "یو یو آئی ڈی وی 4",
    uuidv6: "یو یو آئی ڈی وی 6",
    nanoid: "نینو آئی ڈی",
    guid: "جی یو آئی ڈی",
    cuid: "سی یو آئی ڈی",
    cuid2: "سی یو آئی ڈی 2",
    ulid: "یو ایل آئی ڈی",
    xid: "ایکس آئی ڈی",
    ksuid: "کے ایس یو آئی ڈی",
    datetime: "آئی ایس او ڈیٹ ٹائم",
    date: "آئی ایس او تاریخ",
    time: "آئی ایس او وقت",
    duration: "آئی ایس او مدت",
    ipv4: "آئی پی وی 4 ایڈریس",
    ipv6: "آئی پی وی 6 ایڈریس",
    cidrv4: "آئی پی وی 4 رینج",
    cidrv6: "آئی پی وی 6 رینج",
    base64: "بیس 64 ان کوڈڈ سٹرنگ",
    base64url: "بیس 64 یو آر ایل ان کوڈڈ سٹرنگ",
    json_string: "جے ایس او این سٹرنگ",
    e164: "ای 164 نمبر",
    jwt: "جے ڈبلیو ٹی",
    template_literal: "ان پٹ"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `غلط ان پٹ: ${issue2.expected} متوقع تھا، ${parsedType8(issue2.input)} موصول ہوا`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `غلط ان پٹ: ${stringifyPrimitive(issue2.values[0])} متوقع تھا`;
        return `غلط آپشن: ${joinValues(issue2.values, "|")} میں سے ایک متوقع تھا`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `بہت بڑا: ${issue2.origin ?? "ویلیو"} کے ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "عناصر"} ہونے متوقع تھے`;
        return `بہت بڑا: ${issue2.origin ?? "ویلیو"} کا ${adj}${issue2.maximum.toString()} ہونا متوقع تھا`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `بہت چھوٹا: ${issue2.origin} کے ${adj}${issue2.minimum.toString()} ${sizing.unit} ہونے متوقع تھے`;
        }
        return `بہت چھوٹا: ${issue2.origin} کا ${adj}${issue2.minimum.toString()} ہونا متوقع تھا`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `غلط سٹرنگ: "${_issue.prefix}" سے شروع ہونا چاہیے`;
        }
        if (_issue.format === "ends_with")
          return `غلط سٹرنگ: "${_issue.suffix}" پر ختم ہونا چاہیے`;
        if (_issue.format === "includes")
          return `غلط سٹرنگ: "${_issue.includes}" شامل ہونا چاہیے`;
        if (_issue.format === "regex")
          return `غلط سٹرنگ: پیٹرن ${_issue.pattern} سے میچ ہونا چاہیے`;
        return `غلط ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `غلط نمبر: ${issue2.divisor} کا مضاعف ہونا چاہیے`;
      case "unrecognized_keys":
        return `غیر تسلیم شدہ کی${issue2.keys.length > 1 ? "ز" : ""}: ${joinValues(issue2.keys, "، ")}`;
      case "invalid_key":
        return `${issue2.origin} میں غلط کی`;
      case "invalid_union":
        return "غلط ان پٹ";
      case "invalid_element":
        return `${issue2.origin} میں غلط ویلیو`;
      default:
        return `غلط ان پٹ`;
    }
  };
};
var init_ur = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/vi.js
function vi_default() {
  return {
    localeError: error42()
  };
}
var error42 = () => {
  const Sizable = {
    string: { unit: "ký tự", verb: "có" },
    file: { unit: "byte", verb: "có" },
    array: { unit: "phần tử", verb: "có" },
    set: { unit: "phần tử", verb: "có" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType8 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "số";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "mảng";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "đầu vào",
    email: "địa chỉ email",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ngày giờ ISO",
    date: "ngày ISO",
    time: "giờ ISO",
    duration: "khoảng thời gian ISO",
    ipv4: "địa chỉ IPv4",
    ipv6: "địa chỉ IPv6",
    cidrv4: "dải IPv4",
    cidrv6: "dải IPv6",
    base64: "chuỗi mã hóa base64",
    base64url: "chuỗi mã hóa base64url",
    json_string: "chuỗi JSON",
    e164: "số E.164",
    jwt: "JWT",
    template_literal: "đầu vào"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Đầu vào không hợp lệ: mong đợi ${issue2.expected}, nhận được ${parsedType8(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Đầu vào không hợp lệ: mong đợi ${stringifyPrimitive(issue2.values[0])}`;
        return `Tùy chọn không hợp lệ: mong đợi một trong các giá trị ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Quá lớn: mong đợi ${issue2.origin ?? "giá trị"} ${sizing.verb} ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "phần tử"}`;
        return `Quá lớn: mong đợi ${issue2.origin ?? "giá trị"} ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Quá nhỏ: mong đợi ${issue2.origin} ${sizing.verb} ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Quá nhỏ: mong đợi ${issue2.origin} ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Chuỗi không hợp lệ: phải bắt đầu bằng "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Chuỗi không hợp lệ: phải kết thúc bằng "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Chuỗi không hợp lệ: phải bao gồm "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Chuỗi không hợp lệ: phải khớp với mẫu ${_issue.pattern}`;
        return `${Nouns[_issue.format] ?? issue2.format} không hợp lệ`;
      }
      case "not_multiple_of":
        return `Số không hợp lệ: phải là bội số của ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Khóa không được nhận dạng: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Khóa không hợp lệ trong ${issue2.origin}`;
      case "invalid_union":
        return "Đầu vào không hợp lệ";
      case "invalid_element":
        return `Giá trị không hợp lệ trong ${issue2.origin}`;
      default:
        return `Đầu vào không hợp lệ`;
    }
  };
};
var init_vi = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/zh-CN.js
function zh_CN_default() {
  return {
    localeError: error43()
  };
}
var error43 = () => {
  const Sizable = {
    string: { unit: "字符", verb: "包含" },
    file: { unit: "字节", verb: "包含" },
    array: { unit: "项", verb: "包含" },
    set: { unit: "项", verb: "包含" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType8 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "非数字(NaN)" : "数字";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "数组";
        }
        if (data === null) {
          return "空值(null)";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "输入",
    email: "电子邮件",
    url: "URL",
    emoji: "表情符号",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO日期时间",
    date: "ISO日期",
    time: "ISO时间",
    duration: "ISO时长",
    ipv4: "IPv4地址",
    ipv6: "IPv6地址",
    cidrv4: "IPv4网段",
    cidrv6: "IPv6网段",
    base64: "base64编码字符串",
    base64url: "base64url编码字符串",
    json_string: "JSON字符串",
    e164: "E.164号码",
    jwt: "JWT",
    template_literal: "输入"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `无效输入：期望 ${issue2.expected}，实际接收 ${parsedType8(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `无效输入：期望 ${stringifyPrimitive(issue2.values[0])}`;
        return `无效选项：期望以下之一 ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `数值过大：期望 ${issue2.origin ?? "值"} ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "个元素"}`;
        return `数值过大：期望 ${issue2.origin ?? "值"} ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `数值过小：期望 ${issue2.origin} ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `数值过小：期望 ${issue2.origin} ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `无效字符串：必须以 "${_issue.prefix}" 开头`;
        if (_issue.format === "ends_with")
          return `无效字符串：必须以 "${_issue.suffix}" 结尾`;
        if (_issue.format === "includes")
          return `无效字符串：必须包含 "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `无效字符串：必须满足正则表达式 ${_issue.pattern}`;
        return `无效${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `无效数字：必须是 ${issue2.divisor} 的倍数`;
      case "unrecognized_keys":
        return `出现未知的键(key): ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `${issue2.origin} 中的键(key)无效`;
      case "invalid_union":
        return "无效输入";
      case "invalid_element":
        return `${issue2.origin} 中包含无效值(value)`;
      default:
        return `无效输入`;
    }
  };
};
var init_zh_CN = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/zh-TW.js
function zh_TW_default() {
  return {
    localeError: error44()
  };
}
var error44 = () => {
  const Sizable = {
    string: { unit: "字元", verb: "擁有" },
    file: { unit: "位元組", verb: "擁有" },
    array: { unit: "項目", verb: "擁有" },
    set: { unit: "項目", verb: "擁有" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType8 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "number";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "array";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "輸入",
    email: "郵件地址",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO 日期時間",
    date: "ISO 日期",
    time: "ISO 時間",
    duration: "ISO 期間",
    ipv4: "IPv4 位址",
    ipv6: "IPv6 位址",
    cidrv4: "IPv4 範圍",
    cidrv6: "IPv6 範圍",
    base64: "base64 編碼字串",
    base64url: "base64url 編碼字串",
    json_string: "JSON 字串",
    e164: "E.164 數值",
    jwt: "JWT",
    template_literal: "輸入"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `無效的輸入值：預期為 ${issue2.expected}，但收到 ${parsedType8(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `無效的輸入值：預期為 ${stringifyPrimitive(issue2.values[0])}`;
        return `無效的選項：預期為以下其中之一 ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `數值過大：預期 ${issue2.origin ?? "值"} 應為 ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "個元素"}`;
        return `數值過大：預期 ${issue2.origin ?? "值"} 應為 ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `數值過小：預期 ${issue2.origin} 應為 ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `數值過小：預期 ${issue2.origin} 應為 ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `無效的字串：必須以 "${_issue.prefix}" 開頭`;
        }
        if (_issue.format === "ends_with")
          return `無效的字串：必須以 "${_issue.suffix}" 結尾`;
        if (_issue.format === "includes")
          return `無效的字串：必須包含 "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `無效的字串：必須符合格式 ${_issue.pattern}`;
        return `無效的 ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `無效的數字：必須為 ${issue2.divisor} 的倍數`;
      case "unrecognized_keys":
        return `無法識別的鍵值${issue2.keys.length > 1 ? "們" : ""}：${joinValues(issue2.keys, "、")}`;
      case "invalid_key":
        return `${issue2.origin} 中有無效的鍵值`;
      case "invalid_union":
        return "無效的輸入值";
      case "invalid_element":
        return `${issue2.origin} 中有無效的值`;
      default:
        return `無效的輸入值`;
    }
  };
};
var init_zh_TW = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/yo.js
function yo_default() {
  return {
    localeError: error45()
  };
}
var error45 = () => {
  const Sizable = {
    string: { unit: "àmi", verb: "ní" },
    file: { unit: "bytes", verb: "ní" },
    array: { unit: "nkan", verb: "ní" },
    set: { unit: "nkan", verb: "ní" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const parsedType8 = (data) => {
    const t = typeof data;
    switch (t) {
      case "number": {
        return Number.isNaN(data) ? "NaN" : "nọ́mbà";
      }
      case "object": {
        if (Array.isArray(data)) {
          return "akopọ";
        }
        if (data === null) {
          return "null";
        }
        if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
          return data.constructor.name;
        }
      }
    }
    return t;
  };
  const Nouns = {
    regex: "ẹ̀rọ ìbáwọlé",
    email: "àdírẹ́sì ìmẹ́lì",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "àkókò ISO",
    date: "ọjọ́ ISO",
    time: "àkókò ISO",
    duration: "àkókò tó pé ISO",
    ipv4: "àdírẹ́sì IPv4",
    ipv6: "àdírẹ́sì IPv6",
    cidrv4: "àgbègbè IPv4",
    cidrv6: "àgbègbè IPv6",
    base64: "ọ̀rọ̀ tí a kọ́ ní base64",
    base64url: "ọ̀rọ̀ base64url",
    json_string: "ọ̀rọ̀ JSON",
    e164: "nọ́mbà E.164",
    jwt: "JWT",
    template_literal: "ẹ̀rọ ìbáwọlé"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Ìbáwọlé aṣìṣe: a ní láti fi ${issue2.expected}, àmọ̀ a rí ${parsedType8(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Ìbáwọlé aṣìṣe: a ní láti fi ${stringifyPrimitive(issue2.values[0])}`;
        return `Àṣàyàn aṣìṣe: yan ọ̀kan lára ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Tó pọ̀ jù: a ní láti jẹ́ pé ${issue2.origin ?? "iye"} ${sizing.verb} ${adj}${issue2.maximum} ${sizing.unit}`;
        return `Tó pọ̀ jù: a ní láti jẹ́ ${adj}${issue2.maximum}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Kéré ju: a ní láti jẹ́ pé ${issue2.origin} ${sizing.verb} ${adj}${issue2.minimum} ${sizing.unit}`;
        return `Kéré ju: a ní láti jẹ́ ${adj}${issue2.minimum}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with")
          return `Ọ̀rọ̀ aṣìṣe: gbọ́dọ̀ bẹ̀rẹ̀ pẹ̀lú "${_issue.prefix}"`;
        if (_issue.format === "ends_with")
          return `Ọ̀rọ̀ aṣìṣe: gbọ́dọ̀ parí pẹ̀lú "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Ọ̀rọ̀ aṣìṣe: gbọ́dọ̀ ní "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Ọ̀rọ̀ aṣìṣe: gbọ́dọ̀ bá àpẹẹrẹ mu ${_issue.pattern}`;
        return `Aṣìṣe: ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Nọ́mbà aṣìṣe: gbọ́dọ̀ jẹ́ èyà pípín ti ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Bọtìnì àìmọ̀: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Bọtìnì aṣìṣe nínú ${issue2.origin}`;
      case "invalid_union":
        return "Ìbáwọlé aṣìṣe";
      case "invalid_element":
        return `Iye aṣìṣe nínú ${issue2.origin}`;
      default:
        return "Ìbáwọlé aṣìṣe";
    }
  };
};
var init_yo = __esm(() => {
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/locales/index.js
var exports_locales = {};
__export(exports_locales, {
  zhTW: () => zh_TW_default,
  zhCN: () => zh_CN_default,
  yo: () => yo_default,
  vi: () => vi_default,
  ur: () => ur_default,
  uk: () => uk_default,
  ua: () => ua_default,
  tr: () => tr_default,
  th: () => th_default,
  ta: () => ta_default,
  sv: () => sv_default,
  sl: () => sl_default,
  ru: () => ru_default,
  pt: () => pt_default,
  ps: () => ps_default,
  pl: () => pl_default,
  ota: () => ota_default,
  no: () => no_default,
  nl: () => nl_default,
  ms: () => ms_default,
  mk: () => mk_default,
  lt: () => lt_default,
  ko: () => ko_default,
  km: () => km_default,
  kh: () => kh_default,
  ka: () => ka_default,
  ja: () => ja_default,
  it: () => it_default,
  is: () => is_default,
  id: () => id_default,
  hu: () => hu_default,
  he: () => he_default,
  frCA: () => fr_CA_default,
  fr: () => fr_default,
  fi: () => fi_default,
  fa: () => fa_default,
  es: () => es_default,
  eo: () => eo_default,
  en: () => en_default,
  de: () => de_default,
  da: () => da_default,
  cs: () => cs_default,
  ca: () => ca_default,
  bg: () => bg_default,
  be: () => be_default,
  az: () => az_default,
  ar: () => ar_default
});
var init_locales = __esm(() => {
  init_ar();
  init_az();
  init_be();
  init_bg();
  init_ca();
  init_cs();
  init_da();
  init_de();
  init_en();
  init_eo();
  init_es();
  init_fa();
  init_fi();
  init_fr();
  init_fr_CA();
  init_he();
  init_hu();
  init_id();
  init_is();
  init_it();
  init_ja();
  init_ka();
  init_kh();
  init_km();
  init_ko();
  init_lt();
  init_mk();
  init_ms();
  init_nl();
  init_no();
  init_ota();
  init_ps();
  init_pl();
  init_pt();
  init_ru();
  init_sl();
  init_sv();
  init_ta();
  init_th();
  init_tr();
  init_ua();
  init_uk();
  init_ur();
  init_vi();
  init_zh_CN();
  init_zh_TW();
  init_yo();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/core/registries.js
class $ZodRegistry {
  constructor() {
    this._map = new WeakMap;
    this._idmap = new Map;
  }
  add(schema, ..._meta) {
    const meta = _meta[0];
    this._map.set(schema, meta);
    if (meta && typeof meta === "object" && "id" in meta) {
      if (this._idmap.has(meta.id)) {
        throw new Error(`ID ${meta.id} already exists in the registry`);
      }
      this._idmap.set(meta.id, schema);
    }
    return this;
  }
  clear() {
    this._map = new WeakMap;
    this._idmap = new Map;
    return this;
  }
  remove(schema) {
    const meta = this._map.get(schema);
    if (meta && typeof meta === "object" && "id" in meta) {
      this._idmap.delete(meta.id);
    }
    this._map.delete(schema);
    return this;
  }
  get(schema) {
    const p = schema._zod.parent;
    if (p) {
      const pm = { ...this.get(p) ?? {} };
      delete pm.id;
      const f = { ...pm, ...this._map.get(schema) };
      return Object.keys(f).length ? f : undefined;
    }
    return this._map.get(schema);
  }
  has(schema) {
    return this._map.has(schema);
  }
}
function registry() {
  return new $ZodRegistry;
}
var $output, $input, globalRegistry;
var init_registries = __esm(() => {
  $output = Symbol("ZodOutput");
  $input = Symbol("ZodInput");
  globalRegistry = /* @__PURE__ */ registry();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/core/api.js
function _string(Class2, params) {
  return new Class2({
    type: "string",
    ...normalizeParams(params)
  });
}
function _coercedString(Class2, params) {
  return new Class2({
    type: "string",
    coerce: true,
    ...normalizeParams(params)
  });
}
function _email(Class2, params) {
  return new Class2({
    type: "string",
    format: "email",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _guid(Class2, params) {
  return new Class2({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _uuid(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _uuidv4(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v4",
    ...normalizeParams(params)
  });
}
function _uuidv6(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v6",
    ...normalizeParams(params)
  });
}
function _uuidv7(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v7",
    ...normalizeParams(params)
  });
}
function _url(Class2, params) {
  return new Class2({
    type: "string",
    format: "url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _emoji2(Class2, params) {
  return new Class2({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _nanoid(Class2, params) {
  return new Class2({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _cuid(Class2, params) {
  return new Class2({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _cuid2(Class2, params) {
  return new Class2({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _ulid(Class2, params) {
  return new Class2({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _xid(Class2, params) {
  return new Class2({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _ksuid(Class2, params) {
  return new Class2({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _ipv4(Class2, params) {
  return new Class2({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _ipv6(Class2, params) {
  return new Class2({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _cidrv4(Class2, params) {
  return new Class2({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _cidrv6(Class2, params) {
  return new Class2({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _base64(Class2, params) {
  return new Class2({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _base64url(Class2, params) {
  return new Class2({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _e164(Class2, params) {
  return new Class2({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _jwt(Class2, params) {
  return new Class2({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _isoDateTime(Class2, params) {
  return new Class2({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: false,
    local: false,
    precision: null,
    ...normalizeParams(params)
  });
}
function _isoDate(Class2, params) {
  return new Class2({
    type: "string",
    format: "date",
    check: "string_format",
    ...normalizeParams(params)
  });
}
function _isoTime(Class2, params) {
  return new Class2({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ...normalizeParams(params)
  });
}
function _isoDuration(Class2, params) {
  return new Class2({
    type: "string",
    format: "duration",
    check: "string_format",
    ...normalizeParams(params)
  });
}
function _number(Class2, params) {
  return new Class2({
    type: "number",
    checks: [],
    ...normalizeParams(params)
  });
}
function _coercedNumber(Class2, params) {
  return new Class2({
    type: "number",
    coerce: true,
    checks: [],
    ...normalizeParams(params)
  });
}
function _int(Class2, params) {
  return new Class2({
    type: "number",
    check: "number_format",
    abort: false,
    format: "safeint",
    ...normalizeParams(params)
  });
}
function _float32(Class2, params) {
  return new Class2({
    type: "number",
    check: "number_format",
    abort: false,
    format: "float32",
    ...normalizeParams(params)
  });
}
function _float64(Class2, params) {
  return new Class2({
    type: "number",
    check: "number_format",
    abort: false,
    format: "float64",
    ...normalizeParams(params)
  });
}
function _int32(Class2, params) {
  return new Class2({
    type: "number",
    check: "number_format",
    abort: false,
    format: "int32",
    ...normalizeParams(params)
  });
}
function _uint32(Class2, params) {
  return new Class2({
    type: "number",
    check: "number_format",
    abort: false,
    format: "uint32",
    ...normalizeParams(params)
  });
}
function _boolean(Class2, params) {
  return new Class2({
    type: "boolean",
    ...normalizeParams(params)
  });
}
function _coercedBoolean(Class2, params) {
  return new Class2({
    type: "boolean",
    coerce: true,
    ...normalizeParams(params)
  });
}
function _bigint(Class2, params) {
  return new Class2({
    type: "bigint",
    ...normalizeParams(params)
  });
}
function _coercedBigint(Class2, params) {
  return new Class2({
    type: "bigint",
    coerce: true,
    ...normalizeParams(params)
  });
}
function _int64(Class2, params) {
  return new Class2({
    type: "bigint",
    check: "bigint_format",
    abort: false,
    format: "int64",
    ...normalizeParams(params)
  });
}
function _uint64(Class2, params) {
  return new Class2({
    type: "bigint",
    check: "bigint_format",
    abort: false,
    format: "uint64",
    ...normalizeParams(params)
  });
}
function _symbol(Class2, params) {
  return new Class2({
    type: "symbol",
    ...normalizeParams(params)
  });
}
function _undefined2(Class2, params) {
  return new Class2({
    type: "undefined",
    ...normalizeParams(params)
  });
}
function _null2(Class2, params) {
  return new Class2({
    type: "null",
    ...normalizeParams(params)
  });
}
function _any(Class2) {
  return new Class2({
    type: "any"
  });
}
function _unknown(Class2) {
  return new Class2({
    type: "unknown"
  });
}
function _never(Class2, params) {
  return new Class2({
    type: "never",
    ...normalizeParams(params)
  });
}
function _void(Class2, params) {
  return new Class2({
    type: "void",
    ...normalizeParams(params)
  });
}
function _date(Class2, params) {
  return new Class2({
    type: "date",
    ...normalizeParams(params)
  });
}
function _coercedDate(Class2, params) {
  return new Class2({
    type: "date",
    coerce: true,
    ...normalizeParams(params)
  });
}
function _nan(Class2, params) {
  return new Class2({
    type: "nan",
    ...normalizeParams(params)
  });
}
function _lt(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
function _lte(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
function _gt(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
function _gte(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
function _positive(params) {
  return _gt(0, params);
}
function _negative(params) {
  return _lt(0, params);
}
function _nonpositive(params) {
  return _lte(0, params);
}
function _nonnegative(params) {
  return _gte(0, params);
}
function _multipleOf(value, params) {
  return new $ZodCheckMultipleOf({
    check: "multiple_of",
    ...normalizeParams(params),
    value
  });
}
function _maxSize(maximum, params) {
  return new $ZodCheckMaxSize({
    check: "max_size",
    ...normalizeParams(params),
    maximum
  });
}
function _minSize(minimum, params) {
  return new $ZodCheckMinSize({
    check: "min_size",
    ...normalizeParams(params),
    minimum
  });
}
function _size(size, params) {
  return new $ZodCheckSizeEquals({
    check: "size_equals",
    ...normalizeParams(params),
    size
  });
}
function _maxLength(maximum, params) {
  const ch = new $ZodCheckMaxLength({
    check: "max_length",
    ...normalizeParams(params),
    maximum
  });
  return ch;
}
function _minLength(minimum, params) {
  return new $ZodCheckMinLength({
    check: "min_length",
    ...normalizeParams(params),
    minimum
  });
}
function _length(length, params) {
  return new $ZodCheckLengthEquals({
    check: "length_equals",
    ...normalizeParams(params),
    length
  });
}
function _regex(pattern, params) {
  return new $ZodCheckRegex({
    check: "string_format",
    format: "regex",
    ...normalizeParams(params),
    pattern
  });
}
function _lowercase(params) {
  return new $ZodCheckLowerCase({
    check: "string_format",
    format: "lowercase",
    ...normalizeParams(params)
  });
}
function _uppercase(params) {
  return new $ZodCheckUpperCase({
    check: "string_format",
    format: "uppercase",
    ...normalizeParams(params)
  });
}
function _includes(includes, params) {
  return new $ZodCheckIncludes({
    check: "string_format",
    format: "includes",
    ...normalizeParams(params),
    includes
  });
}
function _startsWith(prefix, params) {
  return new $ZodCheckStartsWith({
    check: "string_format",
    format: "starts_with",
    ...normalizeParams(params),
    prefix
  });
}
function _endsWith(suffix, params) {
  return new $ZodCheckEndsWith({
    check: "string_format",
    format: "ends_with",
    ...normalizeParams(params),
    suffix
  });
}
function _property(property, schema, params) {
  return new $ZodCheckProperty({
    check: "property",
    property,
    schema,
    ...normalizeParams(params)
  });
}
function _mime(types, params) {
  return new $ZodCheckMimeType({
    check: "mime_type",
    mime: types,
    ...normalizeParams(params)
  });
}
function _overwrite(tx) {
  return new $ZodCheckOverwrite({
    check: "overwrite",
    tx
  });
}
function _normalize(form) {
  return _overwrite((input) => input.normalize(form));
}
function _trim() {
  return _overwrite((input) => input.trim());
}
function _toLowerCase() {
  return _overwrite((input) => input.toLowerCase());
}
function _toUpperCase() {
  return _overwrite((input) => input.toUpperCase());
}
function _array(Class2, element, params) {
  return new Class2({
    type: "array",
    element,
    ...normalizeParams(params)
  });
}
function _union(Class2, options, params) {
  return new Class2({
    type: "union",
    options,
    ...normalizeParams(params)
  });
}
function _discriminatedUnion(Class2, discriminator, options, params) {
  return new Class2({
    type: "union",
    options,
    discriminator,
    ...normalizeParams(params)
  });
}
function _intersection(Class2, left, right) {
  return new Class2({
    type: "intersection",
    left,
    right
  });
}
function _tuple(Class2, items, _paramsOrRest, _params) {
  const hasRest = _paramsOrRest instanceof $ZodType;
  const params = hasRest ? _params : _paramsOrRest;
  const rest = hasRest ? _paramsOrRest : null;
  return new Class2({
    type: "tuple",
    items,
    rest,
    ...normalizeParams(params)
  });
}
function _record(Class2, keyType, valueType, params) {
  return new Class2({
    type: "record",
    keyType,
    valueType,
    ...normalizeParams(params)
  });
}
function _map(Class2, keyType, valueType, params) {
  return new Class2({
    type: "map",
    keyType,
    valueType,
    ...normalizeParams(params)
  });
}
function _set(Class2, valueType, params) {
  return new Class2({
    type: "set",
    valueType,
    ...normalizeParams(params)
  });
}
function _enum(Class2, values, params) {
  const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
  return new Class2({
    type: "enum",
    entries,
    ...normalizeParams(params)
  });
}
function _nativeEnum(Class2, entries, params) {
  return new Class2({
    type: "enum",
    entries,
    ...normalizeParams(params)
  });
}
function _literal(Class2, value, params) {
  return new Class2({
    type: "literal",
    values: Array.isArray(value) ? value : [value],
    ...normalizeParams(params)
  });
}
function _file(Class2, params) {
  return new Class2({
    type: "file",
    ...normalizeParams(params)
  });
}
function _transform(Class2, fn) {
  return new Class2({
    type: "transform",
    transform: fn
  });
}
function _optional(Class2, innerType) {
  return new Class2({
    type: "optional",
    innerType
  });
}
function _nullable(Class2, innerType) {
  return new Class2({
    type: "nullable",
    innerType
  });
}
function _default(Class2, innerType, defaultValue) {
  return new Class2({
    type: "default",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
    }
  });
}
function _nonoptional(Class2, innerType, params) {
  return new Class2({
    type: "nonoptional",
    innerType,
    ...normalizeParams(params)
  });
}
function _success(Class2, innerType) {
  return new Class2({
    type: "success",
    innerType
  });
}
function _catch(Class2, innerType, catchValue) {
  return new Class2({
    type: "catch",
    innerType,
    catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
  });
}
function _pipe(Class2, in_, out) {
  return new Class2({
    type: "pipe",
    in: in_,
    out
  });
}
function _readonly(Class2, innerType) {
  return new Class2({
    type: "readonly",
    innerType
  });
}
function _templateLiteral(Class2, parts, params) {
  return new Class2({
    type: "template_literal",
    parts,
    ...normalizeParams(params)
  });
}
function _lazy(Class2, getter) {
  return new Class2({
    type: "lazy",
    getter
  });
}
function _promise(Class2, innerType) {
  return new Class2({
    type: "promise",
    innerType
  });
}
function _custom(Class2, fn, _params) {
  const norm = normalizeParams(_params);
  norm.abort ?? (norm.abort = true);
  const schema = new Class2({
    type: "custom",
    check: "custom",
    fn,
    ...norm
  });
  return schema;
}
function _refine(Class2, fn, _params) {
  const schema = new Class2({
    type: "custom",
    check: "custom",
    fn,
    ...normalizeParams(_params)
  });
  return schema;
}
function _superRefine(fn) {
  const ch = _check((payload) => {
    payload.addIssue = (issue2) => {
      if (typeof issue2 === "string") {
        payload.issues.push(issue(issue2, payload.value, ch._zod.def));
      } else {
        const _issue = issue2;
        if (_issue.fatal)
          _issue.continue = false;
        _issue.code ?? (_issue.code = "custom");
        _issue.input ?? (_issue.input = payload.value);
        _issue.inst ?? (_issue.inst = ch);
        _issue.continue ?? (_issue.continue = !ch._zod.def.abort);
        payload.issues.push(issue(_issue));
      }
    };
    return fn(payload.value, payload);
  });
  return ch;
}
function _check(fn, params) {
  const ch = new $ZodCheck({
    check: "custom",
    ...normalizeParams(params)
  });
  ch._zod.check = fn;
  return ch;
}
function _stringbool(Classes, _params) {
  const params = normalizeParams(_params);
  let truthyArray = params.truthy ?? ["true", "1", "yes", "on", "y", "enabled"];
  let falsyArray = params.falsy ?? ["false", "0", "no", "off", "n", "disabled"];
  if (params.case !== "sensitive") {
    truthyArray = truthyArray.map((v) => typeof v === "string" ? v.toLowerCase() : v);
    falsyArray = falsyArray.map((v) => typeof v === "string" ? v.toLowerCase() : v);
  }
  const truthySet = new Set(truthyArray);
  const falsySet = new Set(falsyArray);
  const _Codec = Classes.Codec ?? $ZodCodec;
  const _Boolean = Classes.Boolean ?? $ZodBoolean;
  const _String = Classes.String ?? $ZodString;
  const stringSchema = new _String({ type: "string", error: params.error });
  const booleanSchema = new _Boolean({ type: "boolean", error: params.error });
  const codec = new _Codec({
    type: "pipe",
    in: stringSchema,
    out: booleanSchema,
    transform: (input, payload) => {
      let data = input;
      if (params.case !== "sensitive")
        data = data.toLowerCase();
      if (truthySet.has(data)) {
        return true;
      } else if (falsySet.has(data)) {
        return false;
      } else {
        payload.issues.push({
          code: "invalid_value",
          expected: "stringbool",
          values: [...truthySet, ...falsySet],
          input: payload.value,
          inst: codec,
          continue: false
        });
        return {};
      }
    },
    reverseTransform: (input, _payload) => {
      if (input === true) {
        return truthyArray[0] || "true";
      } else {
        return falsyArray[0] || "false";
      }
    },
    error: params.error
  });
  return codec;
}
function _stringFormat(Class2, format, fnOrRegex, _params = {}) {
  const params = normalizeParams(_params);
  const def = {
    ...normalizeParams(_params),
    check: "string_format",
    type: "string",
    format,
    fn: typeof fnOrRegex === "function" ? fnOrRegex : (val) => fnOrRegex.test(val),
    ...params
  };
  if (fnOrRegex instanceof RegExp) {
    def.pattern = fnOrRegex;
  }
  const inst = new Class2(def);
  return inst;
}
var TimePrecision;
var init_api = __esm(() => {
  init_checks();
  init_schemas();
  init_util();
  TimePrecision = {
    Any: null,
    Minute: -1,
    Second: 0,
    Millisecond: 3,
    Microsecond: 6
  };
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/core/to-json-schema.js
class JSONSchemaGenerator {
  constructor(params) {
    this.counter = 0;
    this.metadataRegistry = params?.metadata ?? globalRegistry;
    this.target = params?.target ?? "draft-2020-12";
    this.unrepresentable = params?.unrepresentable ?? "throw";
    this.override = params?.override ?? (() => {});
    this.io = params?.io ?? "output";
    this.seen = new Map;
  }
  process(schema, _params = { path: [], schemaPath: [] }) {
    var _a;
    const def = schema._zod.def;
    const formatMap = {
      guid: "uuid",
      url: "uri",
      datetime: "date-time",
      json_string: "json-string",
      regex: ""
    };
    const seen = this.seen.get(schema);
    if (seen) {
      seen.count++;
      const isCycle = _params.schemaPath.includes(schema);
      if (isCycle) {
        seen.cycle = _params.path;
      }
      return seen.schema;
    }
    const result = { schema: {}, count: 1, cycle: undefined, path: _params.path };
    this.seen.set(schema, result);
    const overrideSchema = schema._zod.toJSONSchema?.();
    if (overrideSchema) {
      result.schema = overrideSchema;
    } else {
      const params = {
        ..._params,
        schemaPath: [..._params.schemaPath, schema],
        path: _params.path
      };
      const parent = schema._zod.parent;
      if (parent) {
        result.ref = parent;
        this.process(parent, params);
        this.seen.get(parent).isParent = true;
      } else {
        const _json = result.schema;
        switch (def.type) {
          case "string": {
            const json = _json;
            json.type = "string";
            const { minimum, maximum, format, patterns, contentEncoding } = schema._zod.bag;
            if (typeof minimum === "number")
              json.minLength = minimum;
            if (typeof maximum === "number")
              json.maxLength = maximum;
            if (format) {
              json.format = formatMap[format] ?? format;
              if (json.format === "")
                delete json.format;
            }
            if (contentEncoding)
              json.contentEncoding = contentEncoding;
            if (patterns && patterns.size > 0) {
              const regexes = [...patterns];
              if (regexes.length === 1)
                json.pattern = regexes[0].source;
              else if (regexes.length > 1) {
                result.schema.allOf = [
                  ...regexes.map((regex) => ({
                    ...this.target === "draft-7" || this.target === "draft-4" || this.target === "openapi-3.0" ? { type: "string" } : {},
                    pattern: regex.source
                  }))
                ];
              }
            }
            break;
          }
          case "number": {
            const json = _json;
            const { minimum, maximum, format, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
            if (typeof format === "string" && format.includes("int"))
              json.type = "integer";
            else
              json.type = "number";
            if (typeof exclusiveMinimum === "number") {
              if (this.target === "draft-4" || this.target === "openapi-3.0") {
                json.minimum = exclusiveMinimum;
                json.exclusiveMinimum = true;
              } else {
                json.exclusiveMinimum = exclusiveMinimum;
              }
            }
            if (typeof minimum === "number") {
              json.minimum = minimum;
              if (typeof exclusiveMinimum === "number" && this.target !== "draft-4") {
                if (exclusiveMinimum >= minimum)
                  delete json.minimum;
                else
                  delete json.exclusiveMinimum;
              }
            }
            if (typeof exclusiveMaximum === "number") {
              if (this.target === "draft-4" || this.target === "openapi-3.0") {
                json.maximum = exclusiveMaximum;
                json.exclusiveMaximum = true;
              } else {
                json.exclusiveMaximum = exclusiveMaximum;
              }
            }
            if (typeof maximum === "number") {
              json.maximum = maximum;
              if (typeof exclusiveMaximum === "number" && this.target !== "draft-4") {
                if (exclusiveMaximum <= maximum)
                  delete json.maximum;
                else
                  delete json.exclusiveMaximum;
              }
            }
            if (typeof multipleOf === "number")
              json.multipleOf = multipleOf;
            break;
          }
          case "boolean": {
            const json = _json;
            json.type = "boolean";
            break;
          }
          case "bigint": {
            if (this.unrepresentable === "throw") {
              throw new Error("BigInt cannot be represented in JSON Schema");
            }
            break;
          }
          case "symbol": {
            if (this.unrepresentable === "throw") {
              throw new Error("Symbols cannot be represented in JSON Schema");
            }
            break;
          }
          case "null": {
            if (this.target === "openapi-3.0") {
              _json.type = "string";
              _json.nullable = true;
              _json.enum = [null];
            } else
              _json.type = "null";
            break;
          }
          case "any": {
            break;
          }
          case "unknown": {
            break;
          }
          case "undefined": {
            if (this.unrepresentable === "throw") {
              throw new Error("Undefined cannot be represented in JSON Schema");
            }
            break;
          }
          case "void": {
            if (this.unrepresentable === "throw") {
              throw new Error("Void cannot be represented in JSON Schema");
            }
            break;
          }
          case "never": {
            _json.not = {};
            break;
          }
          case "date": {
            if (this.unrepresentable === "throw") {
              throw new Error("Date cannot be represented in JSON Schema");
            }
            break;
          }
          case "array": {
            const json = _json;
            const { minimum, maximum } = schema._zod.bag;
            if (typeof minimum === "number")
              json.minItems = minimum;
            if (typeof maximum === "number")
              json.maxItems = maximum;
            json.type = "array";
            json.items = this.process(def.element, { ...params, path: [...params.path, "items"] });
            break;
          }
          case "object": {
            const json = _json;
            json.type = "object";
            json.properties = {};
            const shape = def.shape;
            for (const key in shape) {
              json.properties[key] = this.process(shape[key], {
                ...params,
                path: [...params.path, "properties", key]
              });
            }
            const allKeys = new Set(Object.keys(shape));
            const requiredKeys = new Set([...allKeys].filter((key) => {
              const v = def.shape[key]._zod;
              if (this.io === "input") {
                return v.optin === undefined;
              } else {
                return v.optout === undefined;
              }
            }));
            if (requiredKeys.size > 0) {
              json.required = Array.from(requiredKeys);
            }
            if (def.catchall?._zod.def.type === "never") {
              json.additionalProperties = false;
            } else if (!def.catchall) {
              if (this.io === "output")
                json.additionalProperties = false;
            } else if (def.catchall) {
              json.additionalProperties = this.process(def.catchall, {
                ...params,
                path: [...params.path, "additionalProperties"]
              });
            }
            break;
          }
          case "union": {
            const json = _json;
            const options = def.options.map((x, i) => this.process(x, {
              ...params,
              path: [...params.path, "anyOf", i]
            }));
            json.anyOf = options;
            break;
          }
          case "intersection": {
            const json = _json;
            const a = this.process(def.left, {
              ...params,
              path: [...params.path, "allOf", 0]
            });
            const b = this.process(def.right, {
              ...params,
              path: [...params.path, "allOf", 1]
            });
            const isSimpleIntersection = (val) => ("allOf" in val) && Object.keys(val).length === 1;
            const allOf = [
              ...isSimpleIntersection(a) ? a.allOf : [a],
              ...isSimpleIntersection(b) ? b.allOf : [b]
            ];
            json.allOf = allOf;
            break;
          }
          case "tuple": {
            const json = _json;
            json.type = "array";
            const prefixPath = this.target === "draft-2020-12" ? "prefixItems" : "items";
            const restPath = this.target === "draft-2020-12" ? "items" : this.target === "openapi-3.0" ? "items" : "additionalItems";
            const prefixItems = def.items.map((x, i) => this.process(x, {
              ...params,
              path: [...params.path, prefixPath, i]
            }));
            const rest = def.rest ? this.process(def.rest, {
              ...params,
              path: [...params.path, restPath, ...this.target === "openapi-3.0" ? [def.items.length] : []]
            }) : null;
            if (this.target === "draft-2020-12") {
              json.prefixItems = prefixItems;
              if (rest) {
                json.items = rest;
              }
            } else if (this.target === "openapi-3.0") {
              json.items = {
                anyOf: prefixItems
              };
              if (rest) {
                json.items.anyOf.push(rest);
              }
              json.minItems = prefixItems.length;
              if (!rest) {
                json.maxItems = prefixItems.length;
              }
            } else {
              json.items = prefixItems;
              if (rest) {
                json.additionalItems = rest;
              }
            }
            const { minimum, maximum } = schema._zod.bag;
            if (typeof minimum === "number")
              json.minItems = minimum;
            if (typeof maximum === "number")
              json.maxItems = maximum;
            break;
          }
          case "record": {
            const json = _json;
            json.type = "object";
            if (this.target === "draft-7" || this.target === "draft-2020-12") {
              json.propertyNames = this.process(def.keyType, {
                ...params,
                path: [...params.path, "propertyNames"]
              });
            }
            json.additionalProperties = this.process(def.valueType, {
              ...params,
              path: [...params.path, "additionalProperties"]
            });
            break;
          }
          case "map": {
            if (this.unrepresentable === "throw") {
              throw new Error("Map cannot be represented in JSON Schema");
            }
            break;
          }
          case "set": {
            if (this.unrepresentable === "throw") {
              throw new Error("Set cannot be represented in JSON Schema");
            }
            break;
          }
          case "enum": {
            const json = _json;
            const values = getEnumValues(def.entries);
            if (values.every((v) => typeof v === "number"))
              json.type = "number";
            if (values.every((v) => typeof v === "string"))
              json.type = "string";
            json.enum = values;
            break;
          }
          case "literal": {
            const json = _json;
            const vals = [];
            for (const val of def.values) {
              if (val === undefined) {
                if (this.unrepresentable === "throw") {
                  throw new Error("Literal `undefined` cannot be represented in JSON Schema");
                } else {}
              } else if (typeof val === "bigint") {
                if (this.unrepresentable === "throw") {
                  throw new Error("BigInt literals cannot be represented in JSON Schema");
                } else {
                  vals.push(Number(val));
                }
              } else {
                vals.push(val);
              }
            }
            if (vals.length === 0) {} else if (vals.length === 1) {
              const val = vals[0];
              json.type = val === null ? "null" : typeof val;
              if (this.target === "draft-4" || this.target === "openapi-3.0") {
                json.enum = [val];
              } else {
                json.const = val;
              }
            } else {
              if (vals.every((v) => typeof v === "number"))
                json.type = "number";
              if (vals.every((v) => typeof v === "string"))
                json.type = "string";
              if (vals.every((v) => typeof v === "boolean"))
                json.type = "string";
              if (vals.every((v) => v === null))
                json.type = "null";
              json.enum = vals;
            }
            break;
          }
          case "file": {
            const json = _json;
            const file = {
              type: "string",
              format: "binary",
              contentEncoding: "binary"
            };
            const { minimum, maximum, mime } = schema._zod.bag;
            if (minimum !== undefined)
              file.minLength = minimum;
            if (maximum !== undefined)
              file.maxLength = maximum;
            if (mime) {
              if (mime.length === 1) {
                file.contentMediaType = mime[0];
                Object.assign(json, file);
              } else {
                json.anyOf = mime.map((m) => {
                  const mFile = { ...file, contentMediaType: m };
                  return mFile;
                });
              }
            } else {
              Object.assign(json, file);
            }
            break;
          }
          case "transform": {
            if (this.unrepresentable === "throw") {
              throw new Error("Transforms cannot be represented in JSON Schema");
            }
            break;
          }
          case "nullable": {
            const inner = this.process(def.innerType, params);
            if (this.target === "openapi-3.0") {
              result.ref = def.innerType;
              _json.nullable = true;
            } else {
              _json.anyOf = [inner, { type: "null" }];
            }
            break;
          }
          case "nonoptional": {
            this.process(def.innerType, params);
            result.ref = def.innerType;
            break;
          }
          case "success": {
            const json = _json;
            json.type = "boolean";
            break;
          }
          case "default": {
            this.process(def.innerType, params);
            result.ref = def.innerType;
            _json.default = JSON.parse(JSON.stringify(def.defaultValue));
            break;
          }
          case "prefault": {
            this.process(def.innerType, params);
            result.ref = def.innerType;
            if (this.io === "input")
              _json._prefault = JSON.parse(JSON.stringify(def.defaultValue));
            break;
          }
          case "catch": {
            this.process(def.innerType, params);
            result.ref = def.innerType;
            let catchValue;
            try {
              catchValue = def.catchValue(undefined);
            } catch {
              throw new Error("Dynamic catch values are not supported in JSON Schema");
            }
            _json.default = catchValue;
            break;
          }
          case "nan": {
            if (this.unrepresentable === "throw") {
              throw new Error("NaN cannot be represented in JSON Schema");
            }
            break;
          }
          case "template_literal": {
            const json = _json;
            const pattern = schema._zod.pattern;
            if (!pattern)
              throw new Error("Pattern not found in template literal");
            json.type = "string";
            json.pattern = pattern.source;
            break;
          }
          case "pipe": {
            const innerType = this.io === "input" ? def.in._zod.def.type === "transform" ? def.out : def.in : def.out;
            this.process(innerType, params);
            result.ref = innerType;
            break;
          }
          case "readonly": {
            this.process(def.innerType, params);
            result.ref = def.innerType;
            _json.readOnly = true;
            break;
          }
          case "promise": {
            this.process(def.innerType, params);
            result.ref = def.innerType;
            break;
          }
          case "optional": {
            this.process(def.innerType, params);
            result.ref = def.innerType;
            break;
          }
          case "lazy": {
            const innerType = schema._zod.innerType;
            this.process(innerType, params);
            result.ref = innerType;
            break;
          }
          case "custom": {
            if (this.unrepresentable === "throw") {
              throw new Error("Custom types cannot be represented in JSON Schema");
            }
            break;
          }
          case "function": {
            if (this.unrepresentable === "throw") {
              throw new Error("Function types cannot be represented in JSON Schema");
            }
            break;
          }
          default: {}
        }
      }
    }
    const meta = this.metadataRegistry.get(schema);
    if (meta)
      Object.assign(result.schema, meta);
    if (this.io === "input" && isTransforming(schema)) {
      delete result.schema.examples;
      delete result.schema.default;
    }
    if (this.io === "input" && result.schema._prefault)
      (_a = result.schema).default ?? (_a.default = result.schema._prefault);
    delete result.schema._prefault;
    const _result = this.seen.get(schema);
    return _result.schema;
  }
  emit(schema, _params) {
    const params = {
      cycles: _params?.cycles ?? "ref",
      reused: _params?.reused ?? "inline",
      external: _params?.external ?? undefined
    };
    const root = this.seen.get(schema);
    if (!root)
      throw new Error("Unprocessed schema. This is a bug in Zod.");
    const makeURI = (entry) => {
      const defsSegment = this.target === "draft-2020-12" ? "$defs" : "definitions";
      if (params.external) {
        const externalId = params.external.registry.get(entry[0])?.id;
        const uriGenerator = params.external.uri ?? ((id2) => id2);
        if (externalId) {
          return { ref: uriGenerator(externalId) };
        }
        const id = entry[1].defId ?? entry[1].schema.id ?? `schema${this.counter++}`;
        entry[1].defId = id;
        return { defId: id, ref: `${uriGenerator("__shared")}#/${defsSegment}/${id}` };
      }
      if (entry[1] === root) {
        return { ref: "#" };
      }
      const uriPrefix = `#`;
      const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
      const defId = entry[1].schema.id ?? `__schema${this.counter++}`;
      return { defId, ref: defUriPrefix + defId };
    };
    const extractToDef = (entry) => {
      if (entry[1].schema.$ref) {
        return;
      }
      const seen = entry[1];
      const { ref, defId } = makeURI(entry);
      seen.def = { ...seen.schema };
      if (defId)
        seen.defId = defId;
      const schema2 = seen.schema;
      for (const key in schema2) {
        delete schema2[key];
      }
      schema2.$ref = ref;
    };
    if (params.cycles === "throw") {
      for (const entry of this.seen.entries()) {
        const seen = entry[1];
        if (seen.cycle) {
          throw new Error("Cycle detected: " + `#/${seen.cycle?.join("/")}/<root>` + '\n\nSet the `cycles` parameter to `"ref"` to resolve cyclical schemas with defs.');
        }
      }
    }
    for (const entry of this.seen.entries()) {
      const seen = entry[1];
      if (schema === entry[0]) {
        extractToDef(entry);
        continue;
      }
      if (params.external) {
        const ext = params.external.registry.get(entry[0])?.id;
        if (schema !== entry[0] && ext) {
          extractToDef(entry);
          continue;
        }
      }
      const id = this.metadataRegistry.get(entry[0])?.id;
      if (id) {
        extractToDef(entry);
        continue;
      }
      if (seen.cycle) {
        extractToDef(entry);
        continue;
      }
      if (seen.count > 1) {
        if (params.reused === "ref") {
          extractToDef(entry);
          continue;
        }
      }
    }
    const flattenRef = (zodSchema, params2) => {
      const seen = this.seen.get(zodSchema);
      const schema2 = seen.def ?? seen.schema;
      const _cached = { ...schema2 };
      if (seen.ref === null) {
        return;
      }
      const ref = seen.ref;
      seen.ref = null;
      if (ref) {
        flattenRef(ref, params2);
        const refSchema = this.seen.get(ref).schema;
        if (refSchema.$ref && (params2.target === "draft-7" || params2.target === "draft-4" || params2.target === "openapi-3.0")) {
          schema2.allOf = schema2.allOf ?? [];
          schema2.allOf.push(refSchema);
        } else {
          Object.assign(schema2, refSchema);
          Object.assign(schema2, _cached);
        }
      }
      if (!seen.isParent)
        this.override({
          zodSchema,
          jsonSchema: schema2,
          path: seen.path ?? []
        });
    };
    for (const entry of [...this.seen.entries()].reverse()) {
      flattenRef(entry[0], { target: this.target });
    }
    const result = {};
    if (this.target === "draft-2020-12") {
      result.$schema = "https://json-schema.org/draft/2020-12/schema";
    } else if (this.target === "draft-7") {
      result.$schema = "http://json-schema.org/draft-07/schema#";
    } else if (this.target === "draft-4") {
      result.$schema = "http://json-schema.org/draft-04/schema#";
    } else if (this.target === "openapi-3.0") {} else {
      console.warn(`Invalid target: ${this.target}`);
    }
    if (params.external?.uri) {
      const id = params.external.registry.get(schema)?.id;
      if (!id)
        throw new Error("Schema is missing an `id` property");
      result.$id = params.external.uri(id);
    }
    Object.assign(result, root.def);
    const defs = params.external?.defs ?? {};
    for (const entry of this.seen.entries()) {
      const seen = entry[1];
      if (seen.def && seen.defId) {
        defs[seen.defId] = seen.def;
      }
    }
    if (params.external) {} else {
      if (Object.keys(defs).length > 0) {
        if (this.target === "draft-2020-12") {
          result.$defs = defs;
        } else {
          result.definitions = defs;
        }
      }
    }
    try {
      return JSON.parse(JSON.stringify(result));
    } catch (_err) {
      throw new Error("Error converting schema to JSON.");
    }
  }
}
function toJSONSchema(input, _params) {
  if (input instanceof $ZodRegistry) {
    const gen2 = new JSONSchemaGenerator(_params);
    const defs = {};
    for (const entry of input._idmap.entries()) {
      const [_, schema] = entry;
      gen2.process(schema);
    }
    const schemas = {};
    const external = {
      registry: input,
      uri: _params?.uri,
      defs
    };
    for (const entry of input._idmap.entries()) {
      const [key, schema] = entry;
      schemas[key] = gen2.emit(schema, {
        ..._params,
        external
      });
    }
    if (Object.keys(defs).length > 0) {
      const defsSegment = gen2.target === "draft-2020-12" ? "$defs" : "definitions";
      schemas.__shared = {
        [defsSegment]: defs
      };
    }
    return { schemas };
  }
  const gen = new JSONSchemaGenerator(_params);
  gen.process(input);
  return gen.emit(input, _params);
}
function isTransforming(_schema, _ctx) {
  const ctx = _ctx ?? { seen: new Set };
  if (ctx.seen.has(_schema))
    return false;
  ctx.seen.add(_schema);
  const schema = _schema;
  const def = schema._zod.def;
  switch (def.type) {
    case "string":
    case "number":
    case "bigint":
    case "boolean":
    case "date":
    case "symbol":
    case "undefined":
    case "null":
    case "any":
    case "unknown":
    case "never":
    case "void":
    case "literal":
    case "enum":
    case "nan":
    case "file":
    case "template_literal":
      return false;
    case "array": {
      return isTransforming(def.element, ctx);
    }
    case "object": {
      for (const key in def.shape) {
        if (isTransforming(def.shape[key], ctx))
          return true;
      }
      return false;
    }
    case "union": {
      for (const option of def.options) {
        if (isTransforming(option, ctx))
          return true;
      }
      return false;
    }
    case "intersection": {
      return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
    }
    case "tuple": {
      for (const item of def.items) {
        if (isTransforming(item, ctx))
          return true;
      }
      if (def.rest && isTransforming(def.rest, ctx))
        return true;
      return false;
    }
    case "record": {
      return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
    }
    case "map": {
      return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
    }
    case "set": {
      return isTransforming(def.valueType, ctx);
    }
    case "promise":
    case "optional":
    case "nonoptional":
    case "nullable":
    case "readonly":
      return isTransforming(def.innerType, ctx);
    case "lazy":
      return isTransforming(def.getter(), ctx);
    case "default": {
      return isTransforming(def.innerType, ctx);
    }
    case "prefault": {
      return isTransforming(def.innerType, ctx);
    }
    case "custom": {
      return false;
    }
    case "transform": {
      return true;
    }
    case "pipe": {
      return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
    }
    case "success": {
      return false;
    }
    case "catch": {
      return false;
    }
    case "function": {
      return false;
    }
    default:
  }
  throw new Error(`Unknown schema type: ${def.type}`);
}
var init_to_json_schema = __esm(() => {
  init_registries();
  init_util();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/core/json-schema.js
var exports_json_schema = {};
var init_json_schema = () => {};

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/core/index.js
var exports_core2 = {};
__export(exports_core2, {
  version: () => version,
  util: () => exports_util,
  treeifyError: () => treeifyError,
  toJSONSchema: () => toJSONSchema,
  toDotPath: () => toDotPath,
  safeParseAsync: () => safeParseAsync,
  safeParse: () => safeParse,
  safeEncodeAsync: () => safeEncodeAsync,
  safeEncode: () => safeEncode,
  safeDecodeAsync: () => safeDecodeAsync,
  safeDecode: () => safeDecode,
  registry: () => registry,
  regexes: () => exports_regexes,
  prettifyError: () => prettifyError,
  parseAsync: () => parseAsync,
  parse: () => parse,
  locales: () => exports_locales,
  isValidJWT: () => isValidJWT,
  isValidBase64URL: () => isValidBase64URL,
  isValidBase64: () => isValidBase64,
  globalRegistry: () => globalRegistry,
  globalConfig: () => globalConfig,
  formatError: () => formatError,
  flattenError: () => flattenError,
  encodeAsync: () => encodeAsync,
  encode: () => encode,
  decodeAsync: () => decodeAsync,
  decode: () => decode,
  config: () => config,
  clone: () => clone,
  _xid: () => _xid,
  _void: () => _void,
  _uuidv7: () => _uuidv7,
  _uuidv6: () => _uuidv6,
  _uuidv4: () => _uuidv4,
  _uuid: () => _uuid,
  _url: () => _url,
  _uppercase: () => _uppercase,
  _unknown: () => _unknown,
  _union: () => _union,
  _undefined: () => _undefined2,
  _ulid: () => _ulid,
  _uint64: () => _uint64,
  _uint32: () => _uint32,
  _tuple: () => _tuple,
  _trim: () => _trim,
  _transform: () => _transform,
  _toUpperCase: () => _toUpperCase,
  _toLowerCase: () => _toLowerCase,
  _templateLiteral: () => _templateLiteral,
  _symbol: () => _symbol,
  _superRefine: () => _superRefine,
  _success: () => _success,
  _stringbool: () => _stringbool,
  _stringFormat: () => _stringFormat,
  _string: () => _string,
  _startsWith: () => _startsWith,
  _size: () => _size,
  _set: () => _set,
  _safeParseAsync: () => _safeParseAsync,
  _safeParse: () => _safeParse,
  _safeEncodeAsync: () => _safeEncodeAsync,
  _safeEncode: () => _safeEncode,
  _safeDecodeAsync: () => _safeDecodeAsync,
  _safeDecode: () => _safeDecode,
  _regex: () => _regex,
  _refine: () => _refine,
  _record: () => _record,
  _readonly: () => _readonly,
  _property: () => _property,
  _promise: () => _promise,
  _positive: () => _positive,
  _pipe: () => _pipe,
  _parseAsync: () => _parseAsync,
  _parse: () => _parse,
  _overwrite: () => _overwrite,
  _optional: () => _optional,
  _number: () => _number,
  _nullable: () => _nullable,
  _null: () => _null2,
  _normalize: () => _normalize,
  _nonpositive: () => _nonpositive,
  _nonoptional: () => _nonoptional,
  _nonnegative: () => _nonnegative,
  _never: () => _never,
  _negative: () => _negative,
  _nativeEnum: () => _nativeEnum,
  _nanoid: () => _nanoid,
  _nan: () => _nan,
  _multipleOf: () => _multipleOf,
  _minSize: () => _minSize,
  _minLength: () => _minLength,
  _min: () => _gte,
  _mime: () => _mime,
  _maxSize: () => _maxSize,
  _maxLength: () => _maxLength,
  _max: () => _lte,
  _map: () => _map,
  _lte: () => _lte,
  _lt: () => _lt,
  _lowercase: () => _lowercase,
  _literal: () => _literal,
  _length: () => _length,
  _lazy: () => _lazy,
  _ksuid: () => _ksuid,
  _jwt: () => _jwt,
  _isoTime: () => _isoTime,
  _isoDuration: () => _isoDuration,
  _isoDateTime: () => _isoDateTime,
  _isoDate: () => _isoDate,
  _ipv6: () => _ipv6,
  _ipv4: () => _ipv4,
  _intersection: () => _intersection,
  _int64: () => _int64,
  _int32: () => _int32,
  _int: () => _int,
  _includes: () => _includes,
  _guid: () => _guid,
  _gte: () => _gte,
  _gt: () => _gt,
  _float64: () => _float64,
  _float32: () => _float32,
  _file: () => _file,
  _enum: () => _enum,
  _endsWith: () => _endsWith,
  _encodeAsync: () => _encodeAsync,
  _encode: () => _encode,
  _emoji: () => _emoji2,
  _email: () => _email,
  _e164: () => _e164,
  _discriminatedUnion: () => _discriminatedUnion,
  _default: () => _default,
  _decodeAsync: () => _decodeAsync,
  _decode: () => _decode,
  _date: () => _date,
  _custom: () => _custom,
  _cuid2: () => _cuid2,
  _cuid: () => _cuid,
  _coercedString: () => _coercedString,
  _coercedNumber: () => _coercedNumber,
  _coercedDate: () => _coercedDate,
  _coercedBoolean: () => _coercedBoolean,
  _coercedBigint: () => _coercedBigint,
  _cidrv6: () => _cidrv6,
  _cidrv4: () => _cidrv4,
  _check: () => _check,
  _catch: () => _catch,
  _boolean: () => _boolean,
  _bigint: () => _bigint,
  _base64url: () => _base64url,
  _base64: () => _base64,
  _array: () => _array,
  _any: () => _any,
  TimePrecision: () => TimePrecision,
  NEVER: () => NEVER,
  JSONSchemaGenerator: () => JSONSchemaGenerator,
  JSONSchema: () => exports_json_schema,
  Doc: () => Doc,
  $output: () => $output,
  $input: () => $input,
  $constructor: () => $constructor,
  $brand: () => $brand,
  $ZodXID: () => $ZodXID,
  $ZodVoid: () => $ZodVoid,
  $ZodUnknown: () => $ZodUnknown,
  $ZodUnion: () => $ZodUnion,
  $ZodUndefined: () => $ZodUndefined,
  $ZodUUID: () => $ZodUUID,
  $ZodURL: () => $ZodURL,
  $ZodULID: () => $ZodULID,
  $ZodType: () => $ZodType,
  $ZodTuple: () => $ZodTuple,
  $ZodTransform: () => $ZodTransform,
  $ZodTemplateLiteral: () => $ZodTemplateLiteral,
  $ZodSymbol: () => $ZodSymbol,
  $ZodSuccess: () => $ZodSuccess,
  $ZodStringFormat: () => $ZodStringFormat,
  $ZodString: () => $ZodString,
  $ZodSet: () => $ZodSet,
  $ZodRegistry: () => $ZodRegistry,
  $ZodRecord: () => $ZodRecord,
  $ZodRealError: () => $ZodRealError,
  $ZodReadonly: () => $ZodReadonly,
  $ZodPromise: () => $ZodPromise,
  $ZodPrefault: () => $ZodPrefault,
  $ZodPipe: () => $ZodPipe,
  $ZodOptional: () => $ZodOptional,
  $ZodObjectJIT: () => $ZodObjectJIT,
  $ZodObject: () => $ZodObject,
  $ZodNumberFormat: () => $ZodNumberFormat,
  $ZodNumber: () => $ZodNumber,
  $ZodNullable: () => $ZodNullable,
  $ZodNull: () => $ZodNull,
  $ZodNonOptional: () => $ZodNonOptional,
  $ZodNever: () => $ZodNever,
  $ZodNanoID: () => $ZodNanoID,
  $ZodNaN: () => $ZodNaN,
  $ZodMap: () => $ZodMap,
  $ZodLiteral: () => $ZodLiteral,
  $ZodLazy: () => $ZodLazy,
  $ZodKSUID: () => $ZodKSUID,
  $ZodJWT: () => $ZodJWT,
  $ZodIntersection: () => $ZodIntersection,
  $ZodISOTime: () => $ZodISOTime,
  $ZodISODuration: () => $ZodISODuration,
  $ZodISODateTime: () => $ZodISODateTime,
  $ZodISODate: () => $ZodISODate,
  $ZodIPv6: () => $ZodIPv6,
  $ZodIPv4: () => $ZodIPv4,
  $ZodGUID: () => $ZodGUID,
  $ZodFunction: () => $ZodFunction,
  $ZodFile: () => $ZodFile,
  $ZodError: () => $ZodError,
  $ZodEnum: () => $ZodEnum,
  $ZodEncodeError: () => $ZodEncodeError,
  $ZodEmoji: () => $ZodEmoji,
  $ZodEmail: () => $ZodEmail,
  $ZodE164: () => $ZodE164,
  $ZodDiscriminatedUnion: () => $ZodDiscriminatedUnion,
  $ZodDefault: () => $ZodDefault,
  $ZodDate: () => $ZodDate,
  $ZodCustomStringFormat: () => $ZodCustomStringFormat,
  $ZodCustom: () => $ZodCustom,
  $ZodCodec: () => $ZodCodec,
  $ZodCheckUpperCase: () => $ZodCheckUpperCase,
  $ZodCheckStringFormat: () => $ZodCheckStringFormat,
  $ZodCheckStartsWith: () => $ZodCheckStartsWith,
  $ZodCheckSizeEquals: () => $ZodCheckSizeEquals,
  $ZodCheckRegex: () => $ZodCheckRegex,
  $ZodCheckProperty: () => $ZodCheckProperty,
  $ZodCheckOverwrite: () => $ZodCheckOverwrite,
  $ZodCheckNumberFormat: () => $ZodCheckNumberFormat,
  $ZodCheckMultipleOf: () => $ZodCheckMultipleOf,
  $ZodCheckMinSize: () => $ZodCheckMinSize,
  $ZodCheckMinLength: () => $ZodCheckMinLength,
  $ZodCheckMimeType: () => $ZodCheckMimeType,
  $ZodCheckMaxSize: () => $ZodCheckMaxSize,
  $ZodCheckMaxLength: () => $ZodCheckMaxLength,
  $ZodCheckLowerCase: () => $ZodCheckLowerCase,
  $ZodCheckLessThan: () => $ZodCheckLessThan,
  $ZodCheckLengthEquals: () => $ZodCheckLengthEquals,
  $ZodCheckIncludes: () => $ZodCheckIncludes,
  $ZodCheckGreaterThan: () => $ZodCheckGreaterThan,
  $ZodCheckEndsWith: () => $ZodCheckEndsWith,
  $ZodCheckBigIntFormat: () => $ZodCheckBigIntFormat,
  $ZodCheck: () => $ZodCheck,
  $ZodCatch: () => $ZodCatch,
  $ZodCUID2: () => $ZodCUID2,
  $ZodCUID: () => $ZodCUID,
  $ZodCIDRv6: () => $ZodCIDRv6,
  $ZodCIDRv4: () => $ZodCIDRv4,
  $ZodBoolean: () => $ZodBoolean,
  $ZodBigIntFormat: () => $ZodBigIntFormat,
  $ZodBigInt: () => $ZodBigInt,
  $ZodBase64URL: () => $ZodBase64URL,
  $ZodBase64: () => $ZodBase64,
  $ZodAsyncError: () => $ZodAsyncError,
  $ZodArray: () => $ZodArray,
  $ZodAny: () => $ZodAny
});
var init_core2 = __esm(() => {
  init_util();
  init_regexes();
  init_locales();
  init_json_schema();
  init_core();
  init_parse();
  init_errors();
  init_schemas();
  init_checks();
  init_versions();
  init_registries();
  init_api();
  init_to_json_schema();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/classic/checks.js
var init_checks2 = __esm(() => {
  init_core2();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/classic/iso.js
var exports_iso = {};
__export(exports_iso, {
  time: () => time2,
  duration: () => duration2,
  datetime: () => datetime2,
  date: () => date2,
  ZodISOTime: () => ZodISOTime,
  ZodISODuration: () => ZodISODuration,
  ZodISODateTime: () => ZodISODateTime,
  ZodISODate: () => ZodISODate
});
function datetime2(params) {
  return _isoDateTime(ZodISODateTime, params);
}
function date2(params) {
  return _isoDate(ZodISODate, params);
}
function time2(params) {
  return _isoTime(ZodISOTime, params);
}
function duration2(params) {
  return _isoDuration(ZodISODuration, params);
}
var ZodISODateTime, ZodISODate, ZodISOTime, ZodISODuration;
var init_iso = __esm(() => {
  init_core2();
  init_schemas2();
  ZodISODateTime = /* @__PURE__ */ $constructor("ZodISODateTime", (inst, def) => {
    $ZodISODateTime.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodISODate = /* @__PURE__ */ $constructor("ZodISODate", (inst, def) => {
    $ZodISODate.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodISOTime = /* @__PURE__ */ $constructor("ZodISOTime", (inst, def) => {
    $ZodISOTime.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodISODuration = /* @__PURE__ */ $constructor("ZodISODuration", (inst, def) => {
    $ZodISODuration.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/classic/errors.js
var initializer2 = (inst, issues) => {
  $ZodError.init(inst, issues);
  inst.name = "ZodError";
  Object.defineProperties(inst, {
    format: {
      value: (mapper) => formatError(inst, mapper)
    },
    flatten: {
      value: (mapper) => flattenError(inst, mapper)
    },
    addIssue: {
      value: (issue2) => {
        inst.issues.push(issue2);
        inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
      }
    },
    addIssues: {
      value: (issues2) => {
        inst.issues.push(...issues2);
        inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
      }
    },
    isEmpty: {
      get() {
        return inst.issues.length === 0;
      }
    }
  });
}, ZodError, ZodRealError;
var init_errors2 = __esm(() => {
  init_core2();
  init_core2();
  init_util();
  ZodError = $constructor("ZodError", initializer2);
  ZodRealError = $constructor("ZodError", initializer2, {
    Parent: Error
  });
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/classic/parse.js
var parse3, parseAsync2, safeParse2, safeParseAsync2, encode2, decode2, encodeAsync2, decodeAsync2, safeEncode2, safeDecode2, safeEncodeAsync2, safeDecodeAsync2;
var init_parse2 = __esm(() => {
  init_core2();
  init_errors2();
  parse3 = /* @__PURE__ */ _parse(ZodRealError);
  parseAsync2 = /* @__PURE__ */ _parseAsync(ZodRealError);
  safeParse2 = /* @__PURE__ */ _safeParse(ZodRealError);
  safeParseAsync2 = /* @__PURE__ */ _safeParseAsync(ZodRealError);
  encode2 = /* @__PURE__ */ _encode(ZodRealError);
  decode2 = /* @__PURE__ */ _decode(ZodRealError);
  encodeAsync2 = /* @__PURE__ */ _encodeAsync(ZodRealError);
  decodeAsync2 = /* @__PURE__ */ _decodeAsync(ZodRealError);
  safeEncode2 = /* @__PURE__ */ _safeEncode(ZodRealError);
  safeDecode2 = /* @__PURE__ */ _safeDecode(ZodRealError);
  safeEncodeAsync2 = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
  safeDecodeAsync2 = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/classic/schemas.js
function string2(params) {
  return _string(ZodString, params);
}
function email2(params) {
  return _email(ZodEmail, params);
}
function guid2(params) {
  return _guid(ZodGUID, params);
}
function uuid2(params) {
  return _uuid(ZodUUID, params);
}
function uuidv4(params) {
  return _uuidv4(ZodUUID, params);
}
function uuidv6(params) {
  return _uuidv6(ZodUUID, params);
}
function uuidv7(params) {
  return _uuidv7(ZodUUID, params);
}
function url(params) {
  return _url(ZodURL, params);
}
function httpUrl(params) {
  return _url(ZodURL, {
    protocol: /^https?$/,
    hostname: exports_regexes.domain,
    ...exports_util.normalizeParams(params)
  });
}
function emoji2(params) {
  return _emoji2(ZodEmoji, params);
}
function nanoid2(params) {
  return _nanoid(ZodNanoID, params);
}
function cuid3(params) {
  return _cuid(ZodCUID, params);
}
function cuid22(params) {
  return _cuid2(ZodCUID2, params);
}
function ulid2(params) {
  return _ulid(ZodULID, params);
}
function xid2(params) {
  return _xid(ZodXID, params);
}
function ksuid2(params) {
  return _ksuid(ZodKSUID, params);
}
function ipv42(params) {
  return _ipv4(ZodIPv4, params);
}
function ipv62(params) {
  return _ipv6(ZodIPv6, params);
}
function cidrv42(params) {
  return _cidrv4(ZodCIDRv4, params);
}
function cidrv62(params) {
  return _cidrv6(ZodCIDRv6, params);
}
function base642(params) {
  return _base64(ZodBase64, params);
}
function base64url2(params) {
  return _base64url(ZodBase64URL, params);
}
function e1642(params) {
  return _e164(ZodE164, params);
}
function jwt(params) {
  return _jwt(ZodJWT, params);
}
function stringFormat(format, fnOrRegex, _params = {}) {
  return _stringFormat(ZodCustomStringFormat, format, fnOrRegex, _params);
}
function hostname2(_params) {
  return _stringFormat(ZodCustomStringFormat, "hostname", exports_regexes.hostname, _params);
}
function hex2(_params) {
  return _stringFormat(ZodCustomStringFormat, "hex", exports_regexes.hex, _params);
}
function hash(alg, params) {
  const enc = params?.enc ?? "hex";
  const format = `${alg}_${enc}`;
  const regex = exports_regexes[format];
  if (!regex)
    throw new Error(`Unrecognized hash format: ${format}`);
  return _stringFormat(ZodCustomStringFormat, format, regex, params);
}
function number2(params) {
  return _number(ZodNumber, params);
}
function int(params) {
  return _int(ZodNumberFormat, params);
}
function float32(params) {
  return _float32(ZodNumberFormat, params);
}
function float64(params) {
  return _float64(ZodNumberFormat, params);
}
function int32(params) {
  return _int32(ZodNumberFormat, params);
}
function uint32(params) {
  return _uint32(ZodNumberFormat, params);
}
function boolean2(params) {
  return _boolean(ZodBoolean, params);
}
function bigint2(params) {
  return _bigint(ZodBigInt, params);
}
function int64(params) {
  return _int64(ZodBigIntFormat, params);
}
function uint64(params) {
  return _uint64(ZodBigIntFormat, params);
}
function symbol(params) {
  return _symbol(ZodSymbol, params);
}
function _undefined3(params) {
  return _undefined2(ZodUndefined, params);
}
function _null3(params) {
  return _null2(ZodNull, params);
}
function any() {
  return _any(ZodAny);
}
function unknown() {
  return _unknown(ZodUnknown);
}
function never(params) {
  return _never(ZodNever, params);
}
function _void2(params) {
  return _void(ZodVoid, params);
}
function date3(params) {
  return _date(ZodDate, params);
}
function array(element, params) {
  return _array(ZodArray, element, params);
}
function keyof(schema) {
  const shape = schema._zod.def.shape;
  return _enum2(Object.keys(shape));
}
function object(shape, params) {
  const def = {
    type: "object",
    shape: shape ?? {},
    ...exports_util.normalizeParams(params)
  };
  return new ZodObject(def);
}
function strictObject(shape, params) {
  return new ZodObject({
    type: "object",
    shape,
    catchall: never(),
    ...exports_util.normalizeParams(params)
  });
}
function looseObject(shape, params) {
  return new ZodObject({
    type: "object",
    shape,
    catchall: unknown(),
    ...exports_util.normalizeParams(params)
  });
}
function union(options, params) {
  return new ZodUnion({
    type: "union",
    options,
    ...exports_util.normalizeParams(params)
  });
}
function discriminatedUnion(discriminator, options, params) {
  return new ZodDiscriminatedUnion({
    type: "union",
    options,
    discriminator,
    ...exports_util.normalizeParams(params)
  });
}
function intersection(left, right) {
  return new ZodIntersection({
    type: "intersection",
    left,
    right
  });
}
function tuple(items, _paramsOrRest, _params) {
  const hasRest = _paramsOrRest instanceof $ZodType;
  const params = hasRest ? _params : _paramsOrRest;
  const rest = hasRest ? _paramsOrRest : null;
  return new ZodTuple({
    type: "tuple",
    items,
    rest,
    ...exports_util.normalizeParams(params)
  });
}
function record(keyType, valueType, params) {
  return new ZodRecord({
    type: "record",
    keyType,
    valueType,
    ...exports_util.normalizeParams(params)
  });
}
function partialRecord(keyType, valueType, params) {
  const k = clone(keyType);
  k._zod.values = undefined;
  return new ZodRecord({
    type: "record",
    keyType: k,
    valueType,
    ...exports_util.normalizeParams(params)
  });
}
function map(keyType, valueType, params) {
  return new ZodMap({
    type: "map",
    keyType,
    valueType,
    ...exports_util.normalizeParams(params)
  });
}
function set(valueType, params) {
  return new ZodSet({
    type: "set",
    valueType,
    ...exports_util.normalizeParams(params)
  });
}
function _enum2(values, params) {
  const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
  return new ZodEnum({
    type: "enum",
    entries,
    ...exports_util.normalizeParams(params)
  });
}
function nativeEnum(entries, params) {
  return new ZodEnum({
    type: "enum",
    entries,
    ...exports_util.normalizeParams(params)
  });
}
function literal(value, params) {
  return new ZodLiteral({
    type: "literal",
    values: Array.isArray(value) ? value : [value],
    ...exports_util.normalizeParams(params)
  });
}
function file(params) {
  return _file(ZodFile, params);
}
function transform(fn) {
  return new ZodTransform({
    type: "transform",
    transform: fn
  });
}
function optional(innerType) {
  return new ZodOptional({
    type: "optional",
    innerType
  });
}
function nullable(innerType) {
  return new ZodNullable({
    type: "nullable",
    innerType
  });
}
function nullish2(innerType) {
  return optional(nullable(innerType));
}
function _default2(innerType, defaultValue) {
  return new ZodDefault({
    type: "default",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : exports_util.shallowClone(defaultValue);
    }
  });
}
function prefault(innerType, defaultValue) {
  return new ZodPrefault({
    type: "prefault",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : exports_util.shallowClone(defaultValue);
    }
  });
}
function nonoptional(innerType, params) {
  return new ZodNonOptional({
    type: "nonoptional",
    innerType,
    ...exports_util.normalizeParams(params)
  });
}
function success(innerType) {
  return new ZodSuccess({
    type: "success",
    innerType
  });
}
function _catch2(innerType, catchValue) {
  return new ZodCatch({
    type: "catch",
    innerType,
    catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
  });
}
function nan(params) {
  return _nan(ZodNaN, params);
}
function pipe(in_, out) {
  return new ZodPipe({
    type: "pipe",
    in: in_,
    out
  });
}
function codec(in_, out, params) {
  return new ZodCodec({
    type: "pipe",
    in: in_,
    out,
    transform: params.decode,
    reverseTransform: params.encode
  });
}
function readonly(innerType) {
  return new ZodReadonly({
    type: "readonly",
    innerType
  });
}
function templateLiteral(parts, params) {
  return new ZodTemplateLiteral({
    type: "template_literal",
    parts,
    ...exports_util.normalizeParams(params)
  });
}
function lazy(getter) {
  return new ZodLazy({
    type: "lazy",
    getter
  });
}
function promise(innerType) {
  return new ZodPromise({
    type: "promise",
    innerType
  });
}
function _function(params) {
  return new ZodFunction({
    type: "function",
    input: Array.isArray(params?.input) ? tuple(params?.input) : params?.input ?? array(unknown()),
    output: params?.output ?? unknown()
  });
}
function check(fn) {
  const ch = new $ZodCheck({
    check: "custom"
  });
  ch._zod.check = fn;
  return ch;
}
function custom(fn, _params) {
  return _custom(ZodCustom, fn ?? (() => true), _params);
}
function refine(fn, _params = {}) {
  return _refine(ZodCustom, fn, _params);
}
function superRefine(fn) {
  return _superRefine(fn);
}
function _instanceof(cls, params = {
  error: `Input not instance of ${cls.name}`
}) {
  const inst = new ZodCustom({
    type: "custom",
    check: "custom",
    fn: (data) => data instanceof cls,
    abort: true,
    ...exports_util.normalizeParams(params)
  });
  inst._zod.bag.Class = cls;
  return inst;
}
function json(params) {
  const jsonSchema = lazy(() => {
    return union([string2(params), number2(), boolean2(), _null3(), array(jsonSchema), record(string2(), jsonSchema)]);
  });
  return jsonSchema;
}
function preprocess(fn, schema) {
  return pipe(transform(fn), schema);
}
var ZodType, _ZodString, ZodString, ZodStringFormat, ZodEmail, ZodGUID, ZodUUID, ZodURL, ZodEmoji, ZodNanoID, ZodCUID, ZodCUID2, ZodULID, ZodXID, ZodKSUID, ZodIPv4, ZodIPv6, ZodCIDRv4, ZodCIDRv6, ZodBase64, ZodBase64URL, ZodE164, ZodJWT, ZodCustomStringFormat, ZodNumber, ZodNumberFormat, ZodBoolean, ZodBigInt, ZodBigIntFormat, ZodSymbol, ZodUndefined, ZodNull, ZodAny, ZodUnknown, ZodNever, ZodVoid, ZodDate, ZodArray, ZodObject, ZodUnion, ZodDiscriminatedUnion, ZodIntersection, ZodTuple, ZodRecord, ZodMap, ZodSet, ZodEnum, ZodLiteral, ZodFile, ZodTransform, ZodOptional, ZodNullable, ZodDefault, ZodPrefault, ZodNonOptional, ZodSuccess, ZodCatch, ZodNaN, ZodPipe, ZodCodec, ZodReadonly, ZodTemplateLiteral, ZodLazy, ZodPromise, ZodFunction, ZodCustom, stringbool = (...args) => _stringbool({
  Codec: ZodCodec,
  Boolean: ZodBoolean,
  String: ZodString
}, ...args);
var init_schemas2 = __esm(() => {
  init_core2();
  init_core2();
  init_checks2();
  init_iso();
  init_parse2();
  ZodType = /* @__PURE__ */ $constructor("ZodType", (inst, def) => {
    $ZodType.init(inst, def);
    inst.def = def;
    inst.type = def.type;
    Object.defineProperty(inst, "_def", { value: def });
    inst.check = (...checks2) => {
      return inst.clone(exports_util.mergeDefs(def, {
        checks: [
          ...def.checks ?? [],
          ...checks2.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch)
        ]
      }));
    };
    inst.clone = (def2, params) => clone(inst, def2, params);
    inst.brand = () => inst;
    inst.register = (reg, meta) => {
      reg.add(inst, meta);
      return inst;
    };
    inst.parse = (data, params) => parse3(inst, data, params, { callee: inst.parse });
    inst.safeParse = (data, params) => safeParse2(inst, data, params);
    inst.parseAsync = async (data, params) => parseAsync2(inst, data, params, { callee: inst.parseAsync });
    inst.safeParseAsync = async (data, params) => safeParseAsync2(inst, data, params);
    inst.spa = inst.safeParseAsync;
    inst.encode = (data, params) => encode2(inst, data, params);
    inst.decode = (data, params) => decode2(inst, data, params);
    inst.encodeAsync = async (data, params) => encodeAsync2(inst, data, params);
    inst.decodeAsync = async (data, params) => decodeAsync2(inst, data, params);
    inst.safeEncode = (data, params) => safeEncode2(inst, data, params);
    inst.safeDecode = (data, params) => safeDecode2(inst, data, params);
    inst.safeEncodeAsync = async (data, params) => safeEncodeAsync2(inst, data, params);
    inst.safeDecodeAsync = async (data, params) => safeDecodeAsync2(inst, data, params);
    inst.refine = (check, params) => inst.check(refine(check, params));
    inst.superRefine = (refinement) => inst.check(superRefine(refinement));
    inst.overwrite = (fn) => inst.check(_overwrite(fn));
    inst.optional = () => optional(inst);
    inst.nullable = () => nullable(inst);
    inst.nullish = () => optional(nullable(inst));
    inst.nonoptional = (params) => nonoptional(inst, params);
    inst.array = () => array(inst);
    inst.or = (arg) => union([inst, arg]);
    inst.and = (arg) => intersection(inst, arg);
    inst.transform = (tx) => pipe(inst, transform(tx));
    inst.default = (def2) => _default2(inst, def2);
    inst.prefault = (def2) => prefault(inst, def2);
    inst.catch = (params) => _catch2(inst, params);
    inst.pipe = (target) => pipe(inst, target);
    inst.readonly = () => readonly(inst);
    inst.describe = (description) => {
      const cl = inst.clone();
      globalRegistry.add(cl, { description });
      return cl;
    };
    Object.defineProperty(inst, "description", {
      get() {
        return globalRegistry.get(inst)?.description;
      },
      configurable: true
    });
    inst.meta = (...args) => {
      if (args.length === 0) {
        return globalRegistry.get(inst);
      }
      const cl = inst.clone();
      globalRegistry.add(cl, args[0]);
      return cl;
    };
    inst.isOptional = () => inst.safeParse(undefined).success;
    inst.isNullable = () => inst.safeParse(null).success;
    return inst;
  });
  _ZodString = /* @__PURE__ */ $constructor("_ZodString", (inst, def) => {
    $ZodString.init(inst, def);
    ZodType.init(inst, def);
    const bag = inst._zod.bag;
    inst.format = bag.format ?? null;
    inst.minLength = bag.minimum ?? null;
    inst.maxLength = bag.maximum ?? null;
    inst.regex = (...args) => inst.check(_regex(...args));
    inst.includes = (...args) => inst.check(_includes(...args));
    inst.startsWith = (...args) => inst.check(_startsWith(...args));
    inst.endsWith = (...args) => inst.check(_endsWith(...args));
    inst.min = (...args) => inst.check(_minLength(...args));
    inst.max = (...args) => inst.check(_maxLength(...args));
    inst.length = (...args) => inst.check(_length(...args));
    inst.nonempty = (...args) => inst.check(_minLength(1, ...args));
    inst.lowercase = (params) => inst.check(_lowercase(params));
    inst.uppercase = (params) => inst.check(_uppercase(params));
    inst.trim = () => inst.check(_trim());
    inst.normalize = (...args) => inst.check(_normalize(...args));
    inst.toLowerCase = () => inst.check(_toLowerCase());
    inst.toUpperCase = () => inst.check(_toUpperCase());
  });
  ZodString = /* @__PURE__ */ $constructor("ZodString", (inst, def) => {
    $ZodString.init(inst, def);
    _ZodString.init(inst, def);
    inst.email = (params) => inst.check(_email(ZodEmail, params));
    inst.url = (params) => inst.check(_url(ZodURL, params));
    inst.jwt = (params) => inst.check(_jwt(ZodJWT, params));
    inst.emoji = (params) => inst.check(_emoji2(ZodEmoji, params));
    inst.guid = (params) => inst.check(_guid(ZodGUID, params));
    inst.uuid = (params) => inst.check(_uuid(ZodUUID, params));
    inst.uuidv4 = (params) => inst.check(_uuidv4(ZodUUID, params));
    inst.uuidv6 = (params) => inst.check(_uuidv6(ZodUUID, params));
    inst.uuidv7 = (params) => inst.check(_uuidv7(ZodUUID, params));
    inst.nanoid = (params) => inst.check(_nanoid(ZodNanoID, params));
    inst.guid = (params) => inst.check(_guid(ZodGUID, params));
    inst.cuid = (params) => inst.check(_cuid(ZodCUID, params));
    inst.cuid2 = (params) => inst.check(_cuid2(ZodCUID2, params));
    inst.ulid = (params) => inst.check(_ulid(ZodULID, params));
    inst.base64 = (params) => inst.check(_base64(ZodBase64, params));
    inst.base64url = (params) => inst.check(_base64url(ZodBase64URL, params));
    inst.xid = (params) => inst.check(_xid(ZodXID, params));
    inst.ksuid = (params) => inst.check(_ksuid(ZodKSUID, params));
    inst.ipv4 = (params) => inst.check(_ipv4(ZodIPv4, params));
    inst.ipv6 = (params) => inst.check(_ipv6(ZodIPv6, params));
    inst.cidrv4 = (params) => inst.check(_cidrv4(ZodCIDRv4, params));
    inst.cidrv6 = (params) => inst.check(_cidrv6(ZodCIDRv6, params));
    inst.e164 = (params) => inst.check(_e164(ZodE164, params));
    inst.datetime = (params) => inst.check(datetime2(params));
    inst.date = (params) => inst.check(date2(params));
    inst.time = (params) => inst.check(time2(params));
    inst.duration = (params) => inst.check(duration2(params));
  });
  ZodStringFormat = /* @__PURE__ */ $constructor("ZodStringFormat", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    _ZodString.init(inst, def);
  });
  ZodEmail = /* @__PURE__ */ $constructor("ZodEmail", (inst, def) => {
    $ZodEmail.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodGUID = /* @__PURE__ */ $constructor("ZodGUID", (inst, def) => {
    $ZodGUID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodUUID = /* @__PURE__ */ $constructor("ZodUUID", (inst, def) => {
    $ZodUUID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodURL = /* @__PURE__ */ $constructor("ZodURL", (inst, def) => {
    $ZodURL.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodEmoji = /* @__PURE__ */ $constructor("ZodEmoji", (inst, def) => {
    $ZodEmoji.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodNanoID = /* @__PURE__ */ $constructor("ZodNanoID", (inst, def) => {
    $ZodNanoID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodCUID = /* @__PURE__ */ $constructor("ZodCUID", (inst, def) => {
    $ZodCUID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodCUID2 = /* @__PURE__ */ $constructor("ZodCUID2", (inst, def) => {
    $ZodCUID2.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodULID = /* @__PURE__ */ $constructor("ZodULID", (inst, def) => {
    $ZodULID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodXID = /* @__PURE__ */ $constructor("ZodXID", (inst, def) => {
    $ZodXID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodKSUID = /* @__PURE__ */ $constructor("ZodKSUID", (inst, def) => {
    $ZodKSUID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodIPv4 = /* @__PURE__ */ $constructor("ZodIPv4", (inst, def) => {
    $ZodIPv4.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodIPv6 = /* @__PURE__ */ $constructor("ZodIPv6", (inst, def) => {
    $ZodIPv6.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodCIDRv4 = /* @__PURE__ */ $constructor("ZodCIDRv4", (inst, def) => {
    $ZodCIDRv4.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodCIDRv6 = /* @__PURE__ */ $constructor("ZodCIDRv6", (inst, def) => {
    $ZodCIDRv6.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodBase64 = /* @__PURE__ */ $constructor("ZodBase64", (inst, def) => {
    $ZodBase64.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodBase64URL = /* @__PURE__ */ $constructor("ZodBase64URL", (inst, def) => {
    $ZodBase64URL.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodE164 = /* @__PURE__ */ $constructor("ZodE164", (inst, def) => {
    $ZodE164.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodJWT = /* @__PURE__ */ $constructor("ZodJWT", (inst, def) => {
    $ZodJWT.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodCustomStringFormat = /* @__PURE__ */ $constructor("ZodCustomStringFormat", (inst, def) => {
    $ZodCustomStringFormat.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodNumber = /* @__PURE__ */ $constructor("ZodNumber", (inst, def) => {
    $ZodNumber.init(inst, def);
    ZodType.init(inst, def);
    inst.gt = (value, params) => inst.check(_gt(value, params));
    inst.gte = (value, params) => inst.check(_gte(value, params));
    inst.min = (value, params) => inst.check(_gte(value, params));
    inst.lt = (value, params) => inst.check(_lt(value, params));
    inst.lte = (value, params) => inst.check(_lte(value, params));
    inst.max = (value, params) => inst.check(_lte(value, params));
    inst.int = (params) => inst.check(int(params));
    inst.safe = (params) => inst.check(int(params));
    inst.positive = (params) => inst.check(_gt(0, params));
    inst.nonnegative = (params) => inst.check(_gte(0, params));
    inst.negative = (params) => inst.check(_lt(0, params));
    inst.nonpositive = (params) => inst.check(_lte(0, params));
    inst.multipleOf = (value, params) => inst.check(_multipleOf(value, params));
    inst.step = (value, params) => inst.check(_multipleOf(value, params));
    inst.finite = () => inst;
    const bag = inst._zod.bag;
    inst.minValue = Math.max(bag.minimum ?? Number.NEGATIVE_INFINITY, bag.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null;
    inst.maxValue = Math.min(bag.maximum ?? Number.POSITIVE_INFINITY, bag.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null;
    inst.isInt = (bag.format ?? "").includes("int") || Number.isSafeInteger(bag.multipleOf ?? 0.5);
    inst.isFinite = true;
    inst.format = bag.format ?? null;
  });
  ZodNumberFormat = /* @__PURE__ */ $constructor("ZodNumberFormat", (inst, def) => {
    $ZodNumberFormat.init(inst, def);
    ZodNumber.init(inst, def);
  });
  ZodBoolean = /* @__PURE__ */ $constructor("ZodBoolean", (inst, def) => {
    $ZodBoolean.init(inst, def);
    ZodType.init(inst, def);
  });
  ZodBigInt = /* @__PURE__ */ $constructor("ZodBigInt", (inst, def) => {
    $ZodBigInt.init(inst, def);
    ZodType.init(inst, def);
    inst.gte = (value, params) => inst.check(_gte(value, params));
    inst.min = (value, params) => inst.check(_gte(value, params));
    inst.gt = (value, params) => inst.check(_gt(value, params));
    inst.gte = (value, params) => inst.check(_gte(value, params));
    inst.min = (value, params) => inst.check(_gte(value, params));
    inst.lt = (value, params) => inst.check(_lt(value, params));
    inst.lte = (value, params) => inst.check(_lte(value, params));
    inst.max = (value, params) => inst.check(_lte(value, params));
    inst.positive = (params) => inst.check(_gt(BigInt(0), params));
    inst.negative = (params) => inst.check(_lt(BigInt(0), params));
    inst.nonpositive = (params) => inst.check(_lte(BigInt(0), params));
    inst.nonnegative = (params) => inst.check(_gte(BigInt(0), params));
    inst.multipleOf = (value, params) => inst.check(_multipleOf(value, params));
    const bag = inst._zod.bag;
    inst.minValue = bag.minimum ?? null;
    inst.maxValue = bag.maximum ?? null;
    inst.format = bag.format ?? null;
  });
  ZodBigIntFormat = /* @__PURE__ */ $constructor("ZodBigIntFormat", (inst, def) => {
    $ZodBigIntFormat.init(inst, def);
    ZodBigInt.init(inst, def);
  });
  ZodSymbol = /* @__PURE__ */ $constructor("ZodSymbol", (inst, def) => {
    $ZodSymbol.init(inst, def);
    ZodType.init(inst, def);
  });
  ZodUndefined = /* @__PURE__ */ $constructor("ZodUndefined", (inst, def) => {
    $ZodUndefined.init(inst, def);
    ZodType.init(inst, def);
  });
  ZodNull = /* @__PURE__ */ $constructor("ZodNull", (inst, def) => {
    $ZodNull.init(inst, def);
    ZodType.init(inst, def);
  });
  ZodAny = /* @__PURE__ */ $constructor("ZodAny", (inst, def) => {
    $ZodAny.init(inst, def);
    ZodType.init(inst, def);
  });
  ZodUnknown = /* @__PURE__ */ $constructor("ZodUnknown", (inst, def) => {
    $ZodUnknown.init(inst, def);
    ZodType.init(inst, def);
  });
  ZodNever = /* @__PURE__ */ $constructor("ZodNever", (inst, def) => {
    $ZodNever.init(inst, def);
    ZodType.init(inst, def);
  });
  ZodVoid = /* @__PURE__ */ $constructor("ZodVoid", (inst, def) => {
    $ZodVoid.init(inst, def);
    ZodType.init(inst, def);
  });
  ZodDate = /* @__PURE__ */ $constructor("ZodDate", (inst, def) => {
    $ZodDate.init(inst, def);
    ZodType.init(inst, def);
    inst.min = (value, params) => inst.check(_gte(value, params));
    inst.max = (value, params) => inst.check(_lte(value, params));
    const c = inst._zod.bag;
    inst.minDate = c.minimum ? new Date(c.minimum) : null;
    inst.maxDate = c.maximum ? new Date(c.maximum) : null;
  });
  ZodArray = /* @__PURE__ */ $constructor("ZodArray", (inst, def) => {
    $ZodArray.init(inst, def);
    ZodType.init(inst, def);
    inst.element = def.element;
    inst.min = (minLength, params) => inst.check(_minLength(minLength, params));
    inst.nonempty = (params) => inst.check(_minLength(1, params));
    inst.max = (maxLength, params) => inst.check(_maxLength(maxLength, params));
    inst.length = (len, params) => inst.check(_length(len, params));
    inst.unwrap = () => inst.element;
  });
  ZodObject = /* @__PURE__ */ $constructor("ZodObject", (inst, def) => {
    $ZodObjectJIT.init(inst, def);
    ZodType.init(inst, def);
    exports_util.defineLazy(inst, "shape", () => {
      return def.shape;
    });
    inst.keyof = () => _enum2(Object.keys(inst._zod.def.shape));
    inst.catchall = (catchall) => inst.clone({ ...inst._zod.def, catchall });
    inst.passthrough = () => inst.clone({ ...inst._zod.def, catchall: unknown() });
    inst.loose = () => inst.clone({ ...inst._zod.def, catchall: unknown() });
    inst.strict = () => inst.clone({ ...inst._zod.def, catchall: never() });
    inst.strip = () => inst.clone({ ...inst._zod.def, catchall: undefined });
    inst.extend = (incoming) => {
      return exports_util.extend(inst, incoming);
    };
    inst.safeExtend = (incoming) => {
      return exports_util.safeExtend(inst, incoming);
    };
    inst.merge = (other) => exports_util.merge(inst, other);
    inst.pick = (mask) => exports_util.pick(inst, mask);
    inst.omit = (mask) => exports_util.omit(inst, mask);
    inst.partial = (...args) => exports_util.partial(ZodOptional, inst, args[0]);
    inst.required = (...args) => exports_util.required(ZodNonOptional, inst, args[0]);
  });
  ZodUnion = /* @__PURE__ */ $constructor("ZodUnion", (inst, def) => {
    $ZodUnion.init(inst, def);
    ZodType.init(inst, def);
    inst.options = def.options;
  });
  ZodDiscriminatedUnion = /* @__PURE__ */ $constructor("ZodDiscriminatedUnion", (inst, def) => {
    ZodUnion.init(inst, def);
    $ZodDiscriminatedUnion.init(inst, def);
  });
  ZodIntersection = /* @__PURE__ */ $constructor("ZodIntersection", (inst, def) => {
    $ZodIntersection.init(inst, def);
    ZodType.init(inst, def);
  });
  ZodTuple = /* @__PURE__ */ $constructor("ZodTuple", (inst, def) => {
    $ZodTuple.init(inst, def);
    ZodType.init(inst, def);
    inst.rest = (rest) => inst.clone({
      ...inst._zod.def,
      rest
    });
  });
  ZodRecord = /* @__PURE__ */ $constructor("ZodRecord", (inst, def) => {
    $ZodRecord.init(inst, def);
    ZodType.init(inst, def);
    inst.keyType = def.keyType;
    inst.valueType = def.valueType;
  });
  ZodMap = /* @__PURE__ */ $constructor("ZodMap", (inst, def) => {
    $ZodMap.init(inst, def);
    ZodType.init(inst, def);
    inst.keyType = def.keyType;
    inst.valueType = def.valueType;
  });
  ZodSet = /* @__PURE__ */ $constructor("ZodSet", (inst, def) => {
    $ZodSet.init(inst, def);
    ZodType.init(inst, def);
    inst.min = (...args) => inst.check(_minSize(...args));
    inst.nonempty = (params) => inst.check(_minSize(1, params));
    inst.max = (...args) => inst.check(_maxSize(...args));
    inst.size = (...args) => inst.check(_size(...args));
  });
  ZodEnum = /* @__PURE__ */ $constructor("ZodEnum", (inst, def) => {
    $ZodEnum.init(inst, def);
    ZodType.init(inst, def);
    inst.enum = def.entries;
    inst.options = Object.values(def.entries);
    const keys = new Set(Object.keys(def.entries));
    inst.extract = (values, params) => {
      const newEntries = {};
      for (const value of values) {
        if (keys.has(value)) {
          newEntries[value] = def.entries[value];
        } else
          throw new Error(`Key ${value} not found in enum`);
      }
      return new ZodEnum({
        ...def,
        checks: [],
        ...exports_util.normalizeParams(params),
        entries: newEntries
      });
    };
    inst.exclude = (values, params) => {
      const newEntries = { ...def.entries };
      for (const value of values) {
        if (keys.has(value)) {
          delete newEntries[value];
        } else
          throw new Error(`Key ${value} not found in enum`);
      }
      return new ZodEnum({
        ...def,
        checks: [],
        ...exports_util.normalizeParams(params),
        entries: newEntries
      });
    };
  });
  ZodLiteral = /* @__PURE__ */ $constructor("ZodLiteral", (inst, def) => {
    $ZodLiteral.init(inst, def);
    ZodType.init(inst, def);
    inst.values = new Set(def.values);
    Object.defineProperty(inst, "value", {
      get() {
        if (def.values.length > 1) {
          throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
        }
        return def.values[0];
      }
    });
  });
  ZodFile = /* @__PURE__ */ $constructor("ZodFile", (inst, def) => {
    $ZodFile.init(inst, def);
    ZodType.init(inst, def);
    inst.min = (size, params) => inst.check(_minSize(size, params));
    inst.max = (size, params) => inst.check(_maxSize(size, params));
    inst.mime = (types, params) => inst.check(_mime(Array.isArray(types) ? types : [types], params));
  });
  ZodTransform = /* @__PURE__ */ $constructor("ZodTransform", (inst, def) => {
    $ZodTransform.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
      if (_ctx.direction === "backward") {
        throw new $ZodEncodeError(inst.constructor.name);
      }
      payload.addIssue = (issue2) => {
        if (typeof issue2 === "string") {
          payload.issues.push(exports_util.issue(issue2, payload.value, def));
        } else {
          const _issue = issue2;
          if (_issue.fatal)
            _issue.continue = false;
          _issue.code ?? (_issue.code = "custom");
          _issue.input ?? (_issue.input = payload.value);
          _issue.inst ?? (_issue.inst = inst);
          payload.issues.push(exports_util.issue(_issue));
        }
      };
      const output = def.transform(payload.value, payload);
      if (output instanceof Promise) {
        return output.then((output2) => {
          payload.value = output2;
          return payload;
        });
      }
      payload.value = output;
      return payload;
    };
  });
  ZodOptional = /* @__PURE__ */ $constructor("ZodOptional", (inst, def) => {
    $ZodOptional.init(inst, def);
    ZodType.init(inst, def);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  ZodNullable = /* @__PURE__ */ $constructor("ZodNullable", (inst, def) => {
    $ZodNullable.init(inst, def);
    ZodType.init(inst, def);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  ZodDefault = /* @__PURE__ */ $constructor("ZodDefault", (inst, def) => {
    $ZodDefault.init(inst, def);
    ZodType.init(inst, def);
    inst.unwrap = () => inst._zod.def.innerType;
    inst.removeDefault = inst.unwrap;
  });
  ZodPrefault = /* @__PURE__ */ $constructor("ZodPrefault", (inst, def) => {
    $ZodPrefault.init(inst, def);
    ZodType.init(inst, def);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  ZodNonOptional = /* @__PURE__ */ $constructor("ZodNonOptional", (inst, def) => {
    $ZodNonOptional.init(inst, def);
    ZodType.init(inst, def);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  ZodSuccess = /* @__PURE__ */ $constructor("ZodSuccess", (inst, def) => {
    $ZodSuccess.init(inst, def);
    ZodType.init(inst, def);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  ZodCatch = /* @__PURE__ */ $constructor("ZodCatch", (inst, def) => {
    $ZodCatch.init(inst, def);
    ZodType.init(inst, def);
    inst.unwrap = () => inst._zod.def.innerType;
    inst.removeCatch = inst.unwrap;
  });
  ZodNaN = /* @__PURE__ */ $constructor("ZodNaN", (inst, def) => {
    $ZodNaN.init(inst, def);
    ZodType.init(inst, def);
  });
  ZodPipe = /* @__PURE__ */ $constructor("ZodPipe", (inst, def) => {
    $ZodPipe.init(inst, def);
    ZodType.init(inst, def);
    inst.in = def.in;
    inst.out = def.out;
  });
  ZodCodec = /* @__PURE__ */ $constructor("ZodCodec", (inst, def) => {
    ZodPipe.init(inst, def);
    $ZodCodec.init(inst, def);
  });
  ZodReadonly = /* @__PURE__ */ $constructor("ZodReadonly", (inst, def) => {
    $ZodReadonly.init(inst, def);
    ZodType.init(inst, def);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  ZodTemplateLiteral = /* @__PURE__ */ $constructor("ZodTemplateLiteral", (inst, def) => {
    $ZodTemplateLiteral.init(inst, def);
    ZodType.init(inst, def);
  });
  ZodLazy = /* @__PURE__ */ $constructor("ZodLazy", (inst, def) => {
    $ZodLazy.init(inst, def);
    ZodType.init(inst, def);
    inst.unwrap = () => inst._zod.def.getter();
  });
  ZodPromise = /* @__PURE__ */ $constructor("ZodPromise", (inst, def) => {
    $ZodPromise.init(inst, def);
    ZodType.init(inst, def);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  ZodFunction = /* @__PURE__ */ $constructor("ZodFunction", (inst, def) => {
    $ZodFunction.init(inst, def);
    ZodType.init(inst, def);
  });
  ZodCustom = /* @__PURE__ */ $constructor("ZodCustom", (inst, def) => {
    $ZodCustom.init(inst, def);
    ZodType.init(inst, def);
  });
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/classic/compat.js
function setErrorMap(map2) {
  config({
    customError: map2
  });
}
function getErrorMap() {
  return config().customError;
}
var ZodIssueCode, ZodFirstPartyTypeKind;
var init_compat = __esm(() => {
  init_core2();
  ZodIssueCode = {
    invalid_type: "invalid_type",
    too_big: "too_big",
    too_small: "too_small",
    invalid_format: "invalid_format",
    not_multiple_of: "not_multiple_of",
    unrecognized_keys: "unrecognized_keys",
    invalid_union: "invalid_union",
    invalid_key: "invalid_key",
    invalid_element: "invalid_element",
    invalid_value: "invalid_value",
    custom: "custom"
  };
  (function(ZodFirstPartyTypeKind2) {})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/classic/coerce.js
var exports_coerce = {};
__export(exports_coerce, {
  string: () => string3,
  number: () => number3,
  date: () => date4,
  boolean: () => boolean3,
  bigint: () => bigint3
});
function string3(params) {
  return _coercedString(ZodString, params);
}
function number3(params) {
  return _coercedNumber(ZodNumber, params);
}
function boolean3(params) {
  return _coercedBoolean(ZodBoolean, params);
}
function bigint3(params) {
  return _coercedBigint(ZodBigInt, params);
}
function date4(params) {
  return _coercedDate(ZodDate, params);
}
var init_coerce = __esm(() => {
  init_core2();
  init_schemas2();
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/v4/classic/external.js
var exports_external = {};
__export(exports_external, {
  xid: () => xid2,
  void: () => _void2,
  uuidv7: () => uuidv7,
  uuidv6: () => uuidv6,
  uuidv4: () => uuidv4,
  uuid: () => uuid2,
  util: () => exports_util,
  url: () => url,
  uppercase: () => _uppercase,
  unknown: () => unknown,
  union: () => union,
  undefined: () => _undefined3,
  ulid: () => ulid2,
  uint64: () => uint64,
  uint32: () => uint32,
  tuple: () => tuple,
  trim: () => _trim,
  treeifyError: () => treeifyError,
  transform: () => transform,
  toUpperCase: () => _toUpperCase,
  toLowerCase: () => _toLowerCase,
  toJSONSchema: () => toJSONSchema,
  templateLiteral: () => templateLiteral,
  symbol: () => symbol,
  superRefine: () => superRefine,
  success: () => success,
  stringbool: () => stringbool,
  stringFormat: () => stringFormat,
  string: () => string2,
  strictObject: () => strictObject,
  startsWith: () => _startsWith,
  size: () => _size,
  setErrorMap: () => setErrorMap,
  set: () => set,
  safeParseAsync: () => safeParseAsync2,
  safeParse: () => safeParse2,
  safeEncodeAsync: () => safeEncodeAsync2,
  safeEncode: () => safeEncode2,
  safeDecodeAsync: () => safeDecodeAsync2,
  safeDecode: () => safeDecode2,
  registry: () => registry,
  regexes: () => exports_regexes,
  regex: () => _regex,
  refine: () => refine,
  record: () => record,
  readonly: () => readonly,
  property: () => _property,
  promise: () => promise,
  prettifyError: () => prettifyError,
  preprocess: () => preprocess,
  prefault: () => prefault,
  positive: () => _positive,
  pipe: () => pipe,
  partialRecord: () => partialRecord,
  parseAsync: () => parseAsync2,
  parse: () => parse3,
  overwrite: () => _overwrite,
  optional: () => optional,
  object: () => object,
  number: () => number2,
  nullish: () => nullish2,
  nullable: () => nullable,
  null: () => _null3,
  normalize: () => _normalize,
  nonpositive: () => _nonpositive,
  nonoptional: () => nonoptional,
  nonnegative: () => _nonnegative,
  never: () => never,
  negative: () => _negative,
  nativeEnum: () => nativeEnum,
  nanoid: () => nanoid2,
  nan: () => nan,
  multipleOf: () => _multipleOf,
  minSize: () => _minSize,
  minLength: () => _minLength,
  mime: () => _mime,
  maxSize: () => _maxSize,
  maxLength: () => _maxLength,
  map: () => map,
  lte: () => _lte,
  lt: () => _lt,
  lowercase: () => _lowercase,
  looseObject: () => looseObject,
  locales: () => exports_locales,
  literal: () => literal,
  length: () => _length,
  lazy: () => lazy,
  ksuid: () => ksuid2,
  keyof: () => keyof,
  jwt: () => jwt,
  json: () => json,
  iso: () => exports_iso,
  ipv6: () => ipv62,
  ipv4: () => ipv42,
  intersection: () => intersection,
  int64: () => int64,
  int32: () => int32,
  int: () => int,
  instanceof: () => _instanceof,
  includes: () => _includes,
  httpUrl: () => httpUrl,
  hostname: () => hostname2,
  hex: () => hex2,
  hash: () => hash,
  guid: () => guid2,
  gte: () => _gte,
  gt: () => _gt,
  globalRegistry: () => globalRegistry,
  getErrorMap: () => getErrorMap,
  function: () => _function,
  formatError: () => formatError,
  float64: () => float64,
  float32: () => float32,
  flattenError: () => flattenError,
  file: () => file,
  enum: () => _enum2,
  endsWith: () => _endsWith,
  encodeAsync: () => encodeAsync2,
  encode: () => encode2,
  emoji: () => emoji2,
  email: () => email2,
  e164: () => e1642,
  discriminatedUnion: () => discriminatedUnion,
  decodeAsync: () => decodeAsync2,
  decode: () => decode2,
  date: () => date3,
  custom: () => custom,
  cuid2: () => cuid22,
  cuid: () => cuid3,
  core: () => exports_core2,
  config: () => config,
  coerce: () => exports_coerce,
  codec: () => codec,
  clone: () => clone,
  cidrv6: () => cidrv62,
  cidrv4: () => cidrv42,
  check: () => check,
  catch: () => _catch2,
  boolean: () => boolean2,
  bigint: () => bigint2,
  base64url: () => base64url2,
  base64: () => base642,
  array: () => array,
  any: () => any,
  _function: () => _function,
  _default: () => _default2,
  _ZodString: () => _ZodString,
  ZodXID: () => ZodXID,
  ZodVoid: () => ZodVoid,
  ZodUnknown: () => ZodUnknown,
  ZodUnion: () => ZodUnion,
  ZodUndefined: () => ZodUndefined,
  ZodUUID: () => ZodUUID,
  ZodURL: () => ZodURL,
  ZodULID: () => ZodULID,
  ZodType: () => ZodType,
  ZodTuple: () => ZodTuple,
  ZodTransform: () => ZodTransform,
  ZodTemplateLiteral: () => ZodTemplateLiteral,
  ZodSymbol: () => ZodSymbol,
  ZodSuccess: () => ZodSuccess,
  ZodStringFormat: () => ZodStringFormat,
  ZodString: () => ZodString,
  ZodSet: () => ZodSet,
  ZodRecord: () => ZodRecord,
  ZodRealError: () => ZodRealError,
  ZodReadonly: () => ZodReadonly,
  ZodPromise: () => ZodPromise,
  ZodPrefault: () => ZodPrefault,
  ZodPipe: () => ZodPipe,
  ZodOptional: () => ZodOptional,
  ZodObject: () => ZodObject,
  ZodNumberFormat: () => ZodNumberFormat,
  ZodNumber: () => ZodNumber,
  ZodNullable: () => ZodNullable,
  ZodNull: () => ZodNull,
  ZodNonOptional: () => ZodNonOptional,
  ZodNever: () => ZodNever,
  ZodNanoID: () => ZodNanoID,
  ZodNaN: () => ZodNaN,
  ZodMap: () => ZodMap,
  ZodLiteral: () => ZodLiteral,
  ZodLazy: () => ZodLazy,
  ZodKSUID: () => ZodKSUID,
  ZodJWT: () => ZodJWT,
  ZodIssueCode: () => ZodIssueCode,
  ZodIntersection: () => ZodIntersection,
  ZodISOTime: () => ZodISOTime,
  ZodISODuration: () => ZodISODuration,
  ZodISODateTime: () => ZodISODateTime,
  ZodISODate: () => ZodISODate,
  ZodIPv6: () => ZodIPv6,
  ZodIPv4: () => ZodIPv4,
  ZodGUID: () => ZodGUID,
  ZodFunction: () => ZodFunction,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFile: () => ZodFile,
  ZodError: () => ZodError,
  ZodEnum: () => ZodEnum,
  ZodEmoji: () => ZodEmoji,
  ZodEmail: () => ZodEmail,
  ZodE164: () => ZodE164,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodDefault: () => ZodDefault,
  ZodDate: () => ZodDate,
  ZodCustomStringFormat: () => ZodCustomStringFormat,
  ZodCustom: () => ZodCustom,
  ZodCodec: () => ZodCodec,
  ZodCatch: () => ZodCatch,
  ZodCUID2: () => ZodCUID2,
  ZodCUID: () => ZodCUID,
  ZodCIDRv6: () => ZodCIDRv6,
  ZodCIDRv4: () => ZodCIDRv4,
  ZodBoolean: () => ZodBoolean,
  ZodBigIntFormat: () => ZodBigIntFormat,
  ZodBigInt: () => ZodBigInt,
  ZodBase64URL: () => ZodBase64URL,
  ZodBase64: () => ZodBase64,
  ZodArray: () => ZodArray,
  ZodAny: () => ZodAny,
  TimePrecision: () => TimePrecision,
  NEVER: () => NEVER,
  $output: () => $output,
  $input: () => $input,
  $brand: () => $brand
});
var init_external = __esm(() => {
  init_core2();
  init_core2();
  init_en();
  init_core2();
  init_locales();
  init_iso();
  init_iso();
  init_coerce();
  init_schemas2();
  init_checks2();
  init_errors2();
  init_parse2();
  init_compat();
  config(en_default());
});

// ../node_modules/.pnpm/zod@4.1.12/node_modules/zod/index.js
var init_zod = __esm(() => {
  init_external();
  init_external();
});

// ../packages/binschema/src/schema/protocol-schema.ts
function normalizeMessageCode(code) {
  const ensureEvenLength = (hex3) => hex3.length % 2 === 1 ? `0${hex3}` : hex3;
  if (typeof code === "number") {
    if (!Number.isFinite(code) || !Number.isInteger(code)) {
      throw new Error(`Message code numeric value must be a finite integer (received ${code}).`);
    }
    if (code < 0) {
      throw new Error(`Message code numeric value must be non-negative (received ${code}).`);
    }
    if (code > Number.MAX_SAFE_INTEGER) {
      throw new Error(`Message code ${code} exceeds MAX_SAFE_INTEGER and cannot be represented safely.`);
    }
    const hexDigits2 = ensureEvenLength(code.toString(16).toUpperCase());
    return `0x${hexDigits2}`;
  }
  const trimmed = code.trim();
  const match = trimmed.match(/^0x([0-9a-fA-F]+)$/);
  if (!match) {
    throw new Error(`Message code '${code}' must be a hex value like 0x01 or an integer.`);
  }
  const hexDigits = ensureEvenLength(match[1].toUpperCase());
  return `0x${hexDigits}`;
}

// ../packages/binschema/src/schema/binary-schema.ts
function getDiscriminatedUnionVariants(typeDef) {
  if (typeDef && typeDef.type === "discriminated_union" && typeDef.variants) {
    return typeDef.variants.map((v) => v.type);
  }
  return [];
}
function validateTerminalVariants(schema) {
  for (const [typeName, typeDef] of Object.entries(schema.types)) {
    const checkArray = (arrayDef, path) => {
      if (!arrayDef || arrayDef.type !== "array" || !arrayDef.terminal_variants) {
        return { valid: true };
      }
      if (arrayDef.kind !== "null_terminated" && arrayDef.kind !== "variant_terminated") {
        return {
          valid: false,
          error: `${path}: terminal_variants can only be used with null_terminated or variant_terminated arrays (current kind: ${arrayDef.kind})`
        };
      }
      const itemsType = arrayDef.items;
      if (!itemsType) {
        return {
          valid: false,
          error: `${path}: Array has terminal_variants but no items type defined`
        };
      }
      let itemsTypeDef = itemsType;
      if (typeof itemsType === "string" || itemsType.type && typeof itemsType.type === "string" && !["array", "discriminated_union", "back_reference"].includes(itemsType.type)) {
        const refTypeName = typeof itemsType === "string" ? itemsType : itemsType.type;
        itemsTypeDef = schema.types[refTypeName];
        if (!itemsTypeDef) {
          return {
            valid: false,
            error: `${path}: Array items type '${refTypeName}' not found in schema`
          };
        }
      }
      if (itemsTypeDef.type !== "discriminated_union") {
        return {
          valid: false,
          error: `${path}: terminal_variants requires items to be a discriminated_union (current type: ${itemsTypeDef.type || "type reference"})`
        };
      }
      const availableVariants = getDiscriminatedUnionVariants(itemsTypeDef);
      if (availableVariants.length === 0) {
        return {
          valid: false,
          error: `${path}: Items discriminated union has no variants defined`
        };
      }
      for (const terminalVariant of arrayDef.terminal_variants) {
        if (!availableVariants.includes(terminalVariant)) {
          return {
            valid: false,
            error: `${path}: terminal_variant '${terminalVariant}' is not a valid variant of items type (available variants: ${availableVariants.join(", ")})`
          };
        }
      }
      return { valid: true };
    };
    const result = checkArray(typeDef, `Type '${typeName}'`);
    if (!result.valid) {
      return result;
    }
    const fields = typeDef.sequence;
    if (Array.isArray(fields)) {
      for (const field of fields) {
        if (field.type === "array") {
          const result2 = checkArray(field, `Type '${typeName}', field '${field.name}'`);
          if (!result2.valid) {
            return result2;
          }
        }
      }
    }
  }
  return { valid: true };
}
var EndiannessSchema, BitOrderSchema, ConfigSchema, StringEncodingSchema, ComputedFieldSchema, BitFieldSchema, SignedIntFieldSchema, Uint8FieldSchema, Uint16FieldSchema, Uint32FieldSchema, Uint64FieldSchema, Int8FieldSchema, Int16FieldSchema, Int32FieldSchema, Int64FieldSchema, VarlengthEncodingSchema, VarlengthFieldSchema, Float32FieldSchema, Float64FieldSchema, ArrayKindSchema, BitElementSchema, SignedIntElementSchema, Uint8ElementSchema, Uint16ElementSchema, Uint32ElementSchema, Uint64ElementSchema, Int8ElementSchema, Int16ElementSchema, Int32ElementSchema, Int64ElementSchema, Float32ElementSchema, Float64ElementSchema, OptionalElementSchema, OptionalFieldSchema, TypeRefElementSchema, DiscriminatedUnionVariantSchema, DiscriminatorSchema, DiscriminatedUnionElementSchema, ChoiceElementSchema, BackReferenceElementSchema, BackReferenceFieldSchema, PaddingFieldSchema, ArrayElementSchema, StringElementSchema, ElementTypeSchema, ArrayFieldSchema, StringFieldBaseSchema, StringFieldSchema, DiscriminatedUnionFieldSchema, BitfieldFieldSchema, TypeRefFieldSchema, ConditionalFieldSchema, FieldTypeRefSchema, FieldSchema, InlineDiscriminatedUnionSchema, PositionFieldSchema, CompositeTypeSchema, TypeDefSchema, MessageGroupSchema, ProtocolConstantSchema, ProtocolMessageSchema, ProtocolDefinitionSchema, MetaSchema, BinarySchemaSchema;
var init_binary_schema = __esm(() => {
  init_zod();
  EndiannessSchema = exports_external.enum(["big_endian", "little_endian"]);
  BitOrderSchema = exports_external.enum(["msb_first", "lsb_first"]);
  ConfigSchema = exports_external.object({
    endianness: EndiannessSchema.optional().meta({
      description: "Byte order for multi-byte values (big_endian or little_endian). Overrides global config if specified."
    }),
    bit_order: BitOrderSchema.optional()
  }).optional();
  StringEncodingSchema = exports_external.enum([
    "ascii",
    "utf8",
    "latin1"
  ]);
  ComputedFieldSchema = exports_external.object({
    type: exports_external.enum(["length_of", "crc32_of", "position_of", "sum_of_sizes", "sum_of_type_sizes"]).meta({
      description: "Type of computation to perform"
    }),
    target: exports_external.string().optional().meta({
      description: "Name of the field or type to compute from (supports dot notation like 'header.data'). Used by length_of, crc32_of, position_of, sum_of_type_sizes"
    }),
    from_after_field: exports_external.string().optional().meta({
      description: "For length_of: compute byte length of all fields after the specified field. Used in ASN.1/DER for SEQUENCE/APPLICATION tag lengths. Mutually exclusive with 'target'."
    }),
    targets: exports_external.array(exports_external.string()).optional().meta({
      description: "Array of field paths to sum sizes of. Used by sum_of_sizes"
    }),
    element_type: exports_external.string().optional().meta({
      description: "Type name of array elements to sum sizes of. Used by sum_of_type_sizes"
    }),
    encoding: StringEncodingSchema.optional().meta({
      description: "For length_of with string targets: encoding to use for byte length calculation (defaults to field's encoding)"
    }),
    offset: exports_external.number().optional().meta({
      description: "For length_of: add this value to the computed length. Used for ASN.1 BIT STRING where length includes unused_bits byte (offset: 1)"
    })
  });
  BitFieldSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.literal("bit").meta({
      description: "Field type (always 'bit')"
    }),
    size: exports_external.number().int().min(1).max(64),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  });
  SignedIntFieldSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.literal("int").meta({
      description: "Field type (always 'int')"
    }),
    size: exports_external.number().int().min(1).max(64),
    signed: exports_external.literal(true),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  });
  Uint8FieldSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.literal("uint8").meta({
      description: "Field type (always 'uint8')"
    }),
    const: exports_external.number().int().min(0).max(255).optional().meta({
      description: "Constant value for this field (used as discriminator in choice types). Mutually exclusive with 'computed'."
    }),
    computed: ComputedFieldSchema.optional().meta({
      description: "Marks this field as automatically computed (e.g., length_of, crc32_of). Mutually exclusive with 'const'."
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  }).meta({
    title: "8-bit Unsigned Integer",
    description: "Fixed-width 8-bit unsigned integer (0-255). Single byte, no endianness concerns.",
    use_for: "Message type codes, flags, single-byte counters, status codes",
    wire_format: "1 byte (0x00-0xFF)",
    code_generation: {
      typescript: {
        type: "number",
        notes: ["JavaScript Number type", "Safe for all uint8 values"]
      },
      go: {
        type: "uint8",
        notes: ["Native Go uint8 type", "Also known as byte"]
      },
      rust: {
        type: "u8",
        notes: ["Native Rust u8 type"]
      }
    },
    examples: [
      { name: "version", type: "uint8" },
      { name: "flags", type: "uint8", description: "Feature flags" },
      { name: "message_type", type: "uint8" }
    ],
    examples_values: {
      typescript: `{
  version: 1,
  flags: 0x01,
  message_type: 0x20
}`,
      go: `Message{
  Version:     1,
  Flags:       0x01,
  MessageType: 0x20,
}`,
      rust: `Message {
  version: 1,
  flags: 0x01,
  message_type: 0x20,
}`
    }
  });
  Uint16FieldSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.literal("uint16").meta({
      description: "Field type (always 'uint16')"
    }),
    const: exports_external.number().int().min(0).max(65535).optional().meta({
      description: "Constant value for this field (used as discriminator in choice types). Mutually exclusive with 'computed'."
    }),
    computed: ComputedFieldSchema.optional().meta({
      description: "Marks this field as automatically computed (e.g., length_of, crc32_of). Mutually exclusive with 'const'."
    }),
    endianness: EndiannessSchema.optional().meta({
      description: "Byte order for multi-byte values (big_endian or little_endian). Overrides global config if specified."
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  }).meta({
    title: "16-bit Unsigned Integer",
    description: "Fixed-width 16-bit unsigned integer (0-65535). Respects endianness configuration (big-endian or little-endian).",
    use_for: "Port numbers, message lengths, medium-range counters, message IDs",
    wire_format: "2 bytes, byte order depends on endianness setting",
    code_generation: {
      typescript: {
        type: "number",
        notes: ["JavaScript Number type", "Safe for all uint16 values"]
      },
      go: {
        type: "uint16",
        notes: ["Native Go uint16 type"]
      },
      rust: {
        type: "u16",
        notes: ["Native Rust u16 type"]
      }
    },
    notes: [
      "Default endianness is inherited from global config",
      "Can override with field-level `endianness` property",
      "Network protocols typically use big-endian"
    ],
    examples: [
      { name: "port", type: "uint16", endianness: "big_endian" },
      { name: "content_length", type: "uint16" },
      { name: "message_id", type: "uint16", endianness: "little_endian" }
    ]
  });
  Uint32FieldSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.literal("uint32").meta({
      description: "Field type (always 'uint32')"
    }),
    const: exports_external.number().int().min(0).max(4294967295).optional().meta({
      description: "Constant value for this field (used as discriminator in choice types). Mutually exclusive with 'computed'."
    }),
    computed: ComputedFieldSchema.optional().meta({
      description: "Marks this field as automatically computed (e.g., length_of, crc32_of). Mutually exclusive with 'const'."
    }),
    endianness: EndiannessSchema.optional().meta({
      description: "Byte order for multi-byte values (big_endian or little_endian). Overrides global config if specified."
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  }).meta({
    title: "32-bit Unsigned Integer",
    description: "Fixed-width 32-bit unsigned integer (0-4294967295). Respects endianness configuration.",
    use_for: "Timestamps, large counters, IP addresses, file sizes, CRCs",
    wire_format: "4 bytes, byte order depends on endianness setting",
    code_generation: {
      typescript: {
        type: "number",
        notes: ["JavaScript Number type", "Safe for all uint32 values"]
      },
      go: {
        type: "uint32",
        notes: ["Native Go uint32 type"]
      },
      rust: {
        type: "u32",
        notes: ["Native Rust u32 type"]
      }
    },
    notes: [
      "Common choice for Unix timestamps (seconds since epoch)",
      "IPv4 addresses are typically stored as uint32"
    ],
    examples: [
      { name: "timestamp", type: "uint32", endianness: "big_endian" },
      { name: "file_size", type: "uint32" },
      { name: "crc32", type: "uint32", endianness: "little_endian" }
    ],
    examples_values: {
      typescript: `{
  timestamp: 1704067200,
  file_size: 1048576,
  crc32: 0xDEADBEEF
}`,
      go: `Message{
  Timestamp: 1704067200,
  FileSize:  1048576,
  Crc32:     0xDEADBEEF,
}`,
      rust: `Message {
  timestamp: 1704067200,
  file_size: 1048576,
  crc32: 0xDEADBEEF,
}`
    }
  });
  Uint64FieldSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.literal("uint64").meta({
      description: "Field type (always 'uint64')"
    }),
    endianness: EndiannessSchema.optional().meta({
      description: "Byte order for multi-byte values (big_endian or little_endian). Overrides global config if specified."
    }),
    computed: ComputedFieldSchema.optional().meta({
      description: "Marks this field as automatically computed (e.g., length_of, crc32_of)"
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  }).meta({
    title: "64-bit Unsigned Integer",
    description: "Fixed-width 64-bit unsigned integer (0-18446744073709551615). Respects endianness configuration.",
    use_for: "High-precision timestamps, very large counters, database IDs, file offsets",
    wire_format: "8 bytes, byte order depends on endianness setting",
    code_generation: {
      typescript: {
        type: "bigint",
        notes: [
          "JavaScript BigInt type (not Number!)",
          "Number can only safely represent up to 2^53-1",
          "Literal syntax: 123n"
        ]
      },
      go: {
        type: "uint64",
        notes: ["Native Go uint64 type"]
      },
      rust: {
        type: "u64",
        notes: ["Native Rust u64 type"]
      }
    },
    notes: [
      "Use for millisecond/microsecond timestamps",
      "Exceeds JavaScript Number's safe integer range"
    ],
    examples: [
      { name: "user_id", type: "uint64" },
      { name: "timestamp_ms", type: "uint64", endianness: "big_endian", description: "Milliseconds since epoch" },
      { name: "byte_offset", type: "uint64" }
    ],
    examples_values: {
      typescript: `{
  user_id: 123456789012345n,  // BigInt literal!
  timestamp_ms: 1704067200000n,
  byte_offset: 0n
}`,
      go: `Message{
  UserId:      123456789012345,
  TimestampMs: 1704067200000,
  ByteOffset:  0,
}`,
      rust: `Message {
  user_id: 123456789012345,
  timestamp_ms: 1704067200000,
  byte_offset: 0,
}`
    }
  });
  Int8FieldSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.literal("int8").meta({
      description: "Field type (always 'int8')"
    }),
    computed: ComputedFieldSchema.optional().meta({
      description: "Marks this field as automatically computed (e.g., length_of, crc32_of)"
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  }).meta({
    title: "8-bit Signed Integer",
    description: "Fixed-width 8-bit signed integer (-128 to 127). Single byte, no endianness concerns.",
    use_for: "Small signed values, temperature readings, coordinate offsets",
    wire_format: "1 byte, two's complement encoding",
    code_generation: {
      typescript: {
        type: "number",
        notes: ["JavaScript Number type", "Safe for all int8 values"]
      },
      go: {
        type: "int8",
        notes: ["Native Go int8 type"]
      },
      rust: {
        type: "i8",
        notes: ["Native Rust i8 type"]
      }
    },
    examples: [
      { name: "temperature", type: "int8", description: "Temperature in Celsius" },
      { name: "offset", type: "int8" }
    ]
  });
  Int16FieldSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.literal("int16").meta({
      description: "Field type (always 'int16')"
    }),
    endianness: EndiannessSchema.optional().meta({
      description: "Byte order for multi-byte values (big_endian or little_endian). Overrides global config if specified."
    }),
    computed: ComputedFieldSchema.optional().meta({
      description: "Marks this field as automatically computed (e.g., length_of, crc32_of)"
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  }).meta({
    title: "16-bit Signed Integer",
    description: "Fixed-width 16-bit signed integer (-32768 to 32767). Respects endianness configuration.",
    use_for: "Signed coordinates, altitude values, timezone offsets",
    wire_format: "2 bytes, two's complement encoding, byte order depends on endianness",
    code_generation: {
      typescript: {
        type: "number",
        notes: ["JavaScript Number type", "Safe for all int16 values"]
      },
      go: {
        type: "int16",
        notes: ["Native Go int16 type"]
      },
      rust: {
        type: "i16",
        notes: ["Native Rust i16 type"]
      }
    },
    examples: [
      { name: "altitude", type: "int16", endianness: "big_endian" },
      { name: "x_coord", type: "int16" }
    ]
  });
  Int32FieldSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.literal("int32").meta({
      description: "Field type (always 'int32')"
    }),
    endianness: EndiannessSchema.optional().meta({
      description: "Byte order for multi-byte values (big_endian or little_endian). Overrides global config if specified."
    }),
    computed: ComputedFieldSchema.optional().meta({
      description: "Marks this field as automatically computed (e.g., length_of, crc32_of)"
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  }).meta({
    title: "32-bit Signed Integer",
    description: "Fixed-width 32-bit signed integer (-2147483648 to 2147483647). Respects endianness configuration.",
    use_for: "Large signed values, geographic coordinates, time differences",
    wire_format: "4 bytes, two's complement encoding, byte order depends on endianness",
    code_generation: {
      typescript: {
        type: "number",
        notes: ["JavaScript Number type", "Safe for all int32 values"]
      },
      go: {
        type: "int32",
        notes: ["Native Go int32 type", "Also known as rune"]
      },
      rust: {
        type: "i32",
        notes: ["Native Rust i32 type"]
      }
    },
    examples: [
      { name: "latitude", type: "int32", endianness: "big_endian" },
      { name: "time_delta", type: "int32" }
    ]
  });
  Int64FieldSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.literal("int64").meta({
      description: "Field type (always 'int64')"
    }),
    endianness: EndiannessSchema.optional().meta({
      description: "Byte order for multi-byte values (big_endian or little_endian). Overrides global config if specified."
    }),
    computed: ComputedFieldSchema.optional().meta({
      description: "Marks this field as automatically computed (e.g., length_of, crc32_of)"
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  }).meta({
    title: "64-bit Signed Integer",
    description: "Fixed-width 64-bit signed integer (-9223372036854775808 to 9223372036854775807). Respects endianness configuration.",
    use_for: "High-precision signed timestamps, large signed offsets, financial calculations",
    wire_format: "8 bytes, two's complement encoding, byte order depends on endianness",
    code_generation: {
      typescript: {
        type: "bigint",
        notes: [
          "JavaScript BigInt type (not Number!)",
          "Number can only safely represent -(2^53-1) to (2^53-1)",
          "Literal syntax: -123n"
        ]
      },
      go: {
        type: "int64",
        notes: ["Native Go int64 type"]
      },
      rust: {
        type: "i64",
        notes: ["Native Rust i64 type"]
      }
    },
    notes: [
      "Exceeds JavaScript Number's safe integer range"
    ],
    examples: [
      { name: "account_balance", type: "int64", description: "Balance in cents" },
      { name: "time_offset_us", type: "int64", description: "Microsecond offset" }
    ]
  });
  VarlengthEncodingSchema = exports_external.enum(["der", "leb128", "ebml", "vlq"]);
  VarlengthFieldSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.literal("varlength").meta({
      description: "Field type (always 'varlength')"
    }),
    encoding: VarlengthEncodingSchema.meta({
      description: "Variable-length encoding scheme: 'der' (ASN.1 length), 'leb128' (protobuf-style), or 'ebml' (Matroska-style)"
    }),
    max_bytes: exports_external.number().int().min(1).max(8).optional().meta({
      description: "Maximum number of bytes for the encoded value (default: 4 for der, 5 for leb128, 8 for ebml)"
    }),
    computed: ComputedFieldSchema.optional().meta({
      description: "Marks this field as automatically computed (e.g., length_of)"
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  }).meta({
    title: "Variable-Length Integer",
    description: "Variable-length integer encoding that uses 1-N bytes depending on the value magnitude. Supports three encoding schemes: DER (ASN.1), LEB128 (protobuf), and EBML (Matroska/WebM).",
    use_for: "Length fields in TLV protocols, space-efficient integer encoding, protocol buffer varints, EBML element IDs",
    wire_format: "1-N bytes depending on value and encoding scheme",
    code_generation: {
      typescript: {
        type: "number | bigint",
        notes: [
          "number for values up to 2^53-1",
          "bigint for larger values",
          "Encoding/decoding handled by runtime library"
        ]
      },
      go: {
        type: "uint64",
        notes: [
          "Native Go uint64 type",
          "Encoding/decoding methods provided by runtime"
        ]
      },
      rust: {
        type: "u64",
        notes: [
          "Native Rust u64 type",
          "Encoding/decoding traits provided by runtime"
        ]
      }
    },
    notes: [
      "DER encoding: 0x00-0x7F = short form (1 byte), 0x80+N = long form (1+N bytes)",
      "LEB128 encoding: MSB continuation bit, little-endian, 7 bits per byte",
      "EBML encoding: Leading zeros indicate width, self-synchronizing",
      "Choose encoding based on protocol requirements, not personal preference",
      "max_bytes limits maximum encoded size (default depends on encoding)"
    ],
    examples: [
      { name: "content_length", type: "varlength", encoding: "der", description: "ASN.1 DER length field" },
      { name: "field_number", type: "varlength", encoding: "leb128", description: "Protocol buffer field number" },
      { name: "element_size", type: "varlength", encoding: "ebml", description: "EBML element data size" }
    ],
    examples_values: {
      typescript: `{
  content_length: 500,      // DER: 0x81 0xC8 (2 bytes)
  field_number: 150,        // LEB128: 0x96 0x01 (2 bytes)
  element_size: 1024        // EBML: varies by width marker
}`,
      go: `Message{
  ContentLength: 500,       // DER encoded
  FieldNumber:   150,       // LEB128 encoded
  ElementSize:   1024,      // EBML encoded
}`,
      rust: `Message {
  content_length: 500,      // DER encoded
  field_number: 150,        // LEB128 encoded
  element_size: 1024,       // EBML encoded
}`
    }
  });
  Float32FieldSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.literal("float32").meta({
      description: "Field type (always 'float32')"
    }),
    endianness: EndiannessSchema.optional().meta({
      description: "Byte order for multi-byte values (big_endian or little_endian). Overrides global config if specified."
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  }).meta({
    title: "32-bit Floating Point",
    description: "IEEE 754 single-precision floating point (32-bit). Provides ~7 decimal digits of precision.",
    use_for: "Measurements, sensor data, graphics coordinates, scientific values",
    wire_format: "4 bytes, IEEE 754 format, byte order depends on endianness",
    code_generation: {
      typescript: {
        type: "number",
        notes: [
          "JavaScript Number type",
          "Stored internally as float64, but represents float32 wire value"
        ]
      },
      go: {
        type: "float32",
        notes: ["Native Go float32 type"]
      },
      rust: {
        type: "f32",
        notes: ["Native Rust f32 type"]
      }
    },
    notes: [
      "Range: ±1.4E-45 to ±3.4E38",
      "Special values: NaN, +Infinity, -Infinity, -0",
      "Not all decimal values can be represented exactly"
    ],
    examples: [
      { name: "temperature", type: "float32", endianness: "big_endian" },
      { name: "sensor_value", type: "float32" }
    ]
  });
  Float64FieldSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.literal("float64").meta({
      description: "Field type (always 'float64')"
    }),
    endianness: EndiannessSchema.optional().meta({
      description: "Byte order for multi-byte values (big_endian or little_endian). Overrides global config if specified."
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  }).meta({
    title: "64-bit Floating Point",
    description: "IEEE 754 double-precision floating point (64-bit). Provides ~15 decimal digits of precision.",
    use_for: "High-precision measurements, geographic coordinates, scientific calculations",
    wire_format: "8 bytes, IEEE 754 format, byte order depends on endianness",
    code_generation: {
      typescript: {
        type: "number",
        notes: [
          "JavaScript Number type (native representation)",
          "This is the default numeric type in JavaScript"
        ]
      },
      go: {
        type: "float64",
        notes: ["Native Go float64 type"]
      },
      rust: {
        type: "f64",
        notes: ["Native Rust f64 type"]
      }
    },
    notes: [
      "Range: ±5.0E-324 to ±1.7E308",
      "Special values: NaN, +Infinity, -Infinity, -0"
    ],
    examples: [
      { name: "latitude", type: "float64", endianness: "big_endian" },
      { name: "precise_measurement", type: "float64" }
    ]
  });
  ArrayKindSchema = exports_external.enum([
    "fixed",
    "length_prefixed",
    "length_prefixed_items",
    "byte_length_prefixed",
    "null_terminated",
    "signature_terminated",
    "eof_terminated",
    "field_referenced",
    "variant_terminated",
    "computed_count"
  ]);
  BitElementSchema = exports_external.object({
    type: exports_external.literal("bit").meta({
      description: "Field type (always 'bit')"
    }),
    size: exports_external.number().int().min(1).max(64),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  });
  SignedIntElementSchema = exports_external.object({
    type: exports_external.literal("int").meta({
      description: "Field type (always 'int')"
    }),
    size: exports_external.number().int().min(1).max(64),
    signed: exports_external.literal(true),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  });
  Uint8ElementSchema = exports_external.object({
    type: exports_external.literal("uint8").meta({
      description: "Field type (always 'uint8')"
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  });
  Uint16ElementSchema = exports_external.object({
    type: exports_external.literal("uint16").meta({
      description: "Field type (always 'uint16')"
    }),
    endianness: EndiannessSchema.optional().meta({
      description: "Byte order for multi-byte values (big_endian or little_endian). Overrides global config if specified."
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  });
  Uint32ElementSchema = exports_external.object({
    type: exports_external.literal("uint32").meta({
      description: "Field type (always 'uint32')"
    }),
    endianness: EndiannessSchema.optional().meta({
      description: "Byte order for multi-byte values (big_endian or little_endian). Overrides global config if specified."
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  });
  Uint64ElementSchema = exports_external.object({
    type: exports_external.literal("uint64").meta({
      description: "Field type (always 'uint64')"
    }),
    endianness: EndiannessSchema.optional().meta({
      description: "Byte order for multi-byte values (big_endian or little_endian). Overrides global config if specified."
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  });
  Int8ElementSchema = exports_external.object({
    type: exports_external.literal("int8").meta({
      description: "Field type (always 'int8')"
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  });
  Int16ElementSchema = exports_external.object({
    type: exports_external.literal("int16").meta({
      description: "Field type (always 'int16')"
    }),
    endianness: EndiannessSchema.optional().meta({
      description: "Byte order for multi-byte values (big_endian or little_endian). Overrides global config if specified."
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  });
  Int32ElementSchema = exports_external.object({
    type: exports_external.literal("int32").meta({
      description: "Field type (always 'int32')"
    }),
    endianness: EndiannessSchema.optional().meta({
      description: "Byte order for multi-byte values (big_endian or little_endian). Overrides global config if specified."
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  });
  Int64ElementSchema = exports_external.object({
    type: exports_external.literal("int64").meta({
      description: "Field type (always 'int64')"
    }),
    endianness: EndiannessSchema.optional().meta({
      description: "Byte order for multi-byte values (big_endian or little_endian). Overrides global config if specified."
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  });
  Float32ElementSchema = exports_external.object({
    type: exports_external.literal("float32").meta({
      description: "Field type (always 'float32')"
    }),
    endianness: EndiannessSchema.optional().meta({
      description: "Byte order for multi-byte values (big_endian or little_endian). Overrides global config if specified."
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  });
  Float64ElementSchema = exports_external.object({
    type: exports_external.literal("float64").meta({
      description: "Field type (always 'float64')"
    }),
    endianness: EndiannessSchema.optional().meta({
      description: "Byte order for multi-byte values (big_endian or little_endian). Overrides global config if specified."
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  });
  OptionalElementSchema = exports_external.object({
    type: exports_external.literal("optional").meta({
      description: "Field type (always 'optional')"
    }),
    value_type: exports_external.string(),
    presence_type: exports_external.enum(["uint8", "bit"]).optional().default("uint8"),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  });
  OptionalFieldSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.literal("optional").meta({
      description: "Field type (always 'optional')"
    }),
    value_type: exports_external.string(),
    presence_type: exports_external.enum(["uint8", "bit"]).optional().default("uint8"),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  }).meta({
    title: "Optional",
    description: "Field that may or may not be present. Uses a presence indicator (byte or bit) followed by the value if present.",
    use_for: "Optional data fields, nullable values, feature flags with associated data",
    wire_format: "Presence indicator (1 byte or 1 bit) + value (if present=1)",
    code_generation: {
      typescript: {
        type: "T | undefined",
        notes: ["TypeScript union with undefined", "Clean optional types", "Type T depends on value_type field"]
      },
      go: {
        type: "*T",
        notes: ["Go pointer type (nil for absent)", "Type T depends on value_type field"]
      },
      rust: {
        type: "Option<T>",
        notes: ["Rust Option enum", "Type T depends on value_type field"]
      }
    },
    notes: [
      "presence_type=uint8 uses 1 full byte (0=absent, 1=present)",
      "presence_type=bit uses 1 bit (more compact for multiple optional fields)",
      "Value is only encoded/decoded if presence indicator is 1"
    ],
    examples: [
      { name: "user_id", type: "optional", value_type: "uint64" },
      { name: "nickname", type: "optional", value_type: "String", presence_type: "uint8" },
      { name: "flags", type: "optional", value_type: "uint8", presence_type: "bit" }
    ]
  });
  TypeRefElementSchema = exports_external.object({
    type: exports_external.string(),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  });
  DiscriminatedUnionVariantSchema = exports_external.object({
    when: exports_external.string().optional(),
    type: exports_external.string(),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  });
  DiscriminatorSchema = exports_external.union([
    exports_external.object({
      peek: exports_external.enum(["uint8", "uint16", "uint32"]).meta({
        description: "Type of integer to peek (read without consuming bytes)"
      }),
      endianness: EndiannessSchema.optional().meta({
        description: "Byte order for uint16/uint32 (required for multi-byte types)"
      })
    }),
    exports_external.object({
      field: exports_external.string().meta({
        description: "Name of earlier field to use as discriminator (supports dot notation like 'flags.type')"
      })
    })
  ]);
  DiscriminatedUnionElementSchema = exports_external.object({
    type: exports_external.literal("discriminated_union").meta({
      description: "Field type (always 'discriminated_union')"
    }),
    discriminator: DiscriminatorSchema,
    variants: exports_external.array(DiscriminatedUnionVariantSchema).min(1),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  });
  ChoiceElementSchema = exports_external.object({
    type: exports_external.literal("choice").meta({
      description: "Element type (always 'choice')"
    }),
    choices: exports_external.array(exports_external.object({
      type: exports_external.string().meta({
        description: "Name of the variant type"
      })
    })).min(2).meta({
      description: "List of possible types (must be at least 2)"
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this choice"
    })
  });
  BackReferenceElementSchema = exports_external.object({
    type: exports_external.literal("back_reference").meta({
      description: "Type identifier (always 'back_reference')"
    }),
    storage: exports_external.enum(["uint8", "uint16", "uint32"]).meta({
      description: "Integer type used to store the offset on the wire (uint8 = 1 byte, uint16 = 2 bytes, uint32 = 4 bytes)"
    }),
    offset_mask: exports_external.string().regex(/^0x[0-9A-Fa-f]+$/, "Must be a valid hex mask (e.g., '0x3FFF')").meta({
      description: "Hex bitmask to extract offset bits from the storage integer (e.g., '0x3FFF' extracts lower 14 bits). Allows packing flags or type tags in unused bits."
    }),
    offset_from: exports_external.enum(["message_start", "current_position"]).meta({
      description: "Reference point for offset calculation. 'message_start' = offset from beginning of message (byte 0), 'current_position' = relative offset from current read position"
    }),
    target_type: exports_external.string().meta({
      description: "Name of the type to parse at the referenced offset location. When decoder jumps to the offset, it will decode this type."
    }),
    endianness: EndiannessSchema.optional().meta({
      description: "Byte order for multi-byte storage types (required for uint16/uint32, meaningless for uint8)"
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this back reference field"
    })
  });
  BackReferenceFieldSchema = BackReferenceElementSchema.extend({
    name: exports_external.string().meta({
      description: "Field name"
    })
  }).meta({
    title: "Back Reference",
    description: "Backward reference to data at an earlier position in the message. Used for compression via backwards references (like DNS name compression). Offset is always from message start.",
    use_for: "Message compression, duplicate data elimination, backwards references, deduplication",
    wire_format: "Storage integer with offset bits (extracted via mask). Offset points backwards to earlier data in message (measured from message start).",
    code_generation: {
      typescript: {
        type: "T (resolved value)",
        notes: ["TypeScript uses resolved value, not pointer", "Encoder handles deduplication", "Type T depends on target_type field"]
      },
      go: {
        type: "T (resolved value)",
        notes: ["Go uses resolved value, not pointer", "Encoder handles deduplication", "Type T depends on target_type field"]
      },
      rust: {
        type: "T (resolved value)",
        notes: ["Rust uses resolved value, not pointer", "Encoder handles deduplication", "Type T depends on target_type field"]
      }
    },
    notes: [
      "offset_mask extracts offset bits (allows packing flags in unused bits)",
      "Offset is always measured from message start (backwards only)",
      "Cannot reference data that comes later (no forward references)",
      "Common in DNS (name compression) and other protocols with repeated data"
    ],
    examples: [
      {
        name: "domain_name_ref",
        type: "back_reference",
        storage: "uint16",
        offset_mask: "0x3FFF",
        target_type: "DomainName",
        endianness: "big_endian",
        description: "Compressed domain name (DNS-style)"
      }
    ]
  });
  PaddingFieldSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.literal("padding").meta({
      description: "Field type (always 'padding')"
    }),
    align_to: exports_external.number().int().min(1).meta({
      description: "Byte boundary to align to (must be power of 2: 2, 4, 8, etc.)"
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  }).refine((data) => {
    return (data.align_to & data.align_to - 1) === 0;
  }, {
    message: "align_to must be a power of 2 (1, 2, 4, 8, 16, ...)"
  }).meta({
    title: "Alignment Padding",
    description: "Inserts zero bytes to align the current stream position to a byte boundary. Commonly used in binary formats like ELF, PE, PCF fonts, etc.",
    use_for: "Structure alignment, section padding, word-aligned access",
    wire_format: "0 to (align_to - 1) zero bytes, depending on current position",
    code_generation: {
      typescript: {
        type: "void (not represented in value)",
        notes: ["Padding is not stored in decoded value", "Automatically calculated during encoding"]
      },
      go: {
        type: "// not represented",
        notes: ["Padding is handled internally", "Not part of struct definition"]
      },
      rust: {
        type: "// not represented",
        notes: ["Padding is handled internally", "Not part of struct definition"]
      }
    },
    notes: [
      "Padding bytes are always zeros (0x00)",
      "Number of padding bytes = (align_to - (position % align_to)) % align_to",
      "If already aligned, zero bytes are inserted",
      "Common values: 2 (word), 4 (dword), 8 (qword), 16 (paragraph)"
    ],
    examples: [
      { name: "padding", type: "padding", align_to: 4, description: "Align to 4-byte boundary" },
      { name: "section_padding", type: "padding", align_to: 8, description: "Align to 8-byte boundary" }
    ]
  });
  ArrayElementSchema = exports_external.object({
    type: exports_external.literal("array").meta({
      description: "Field type (always 'array')"
    }),
    kind: ArrayKindSchema,
    get items() {
      return ElementTypeSchema;
    },
    length: exports_external.number().int().min(1).optional(),
    length_type: exports_external.enum(["uint8", "uint16", "uint32", "uint64"]).optional(),
    item_length_type: exports_external.enum(["uint8", "uint16", "uint32", "uint64"]).optional(),
    length_field: exports_external.string().optional(),
    count_expr: exports_external.string().optional(),
    terminator_value: exports_external.number().optional(),
    terminator_type: exports_external.enum(["uint8", "uint16", "uint32", "uint64"]).optional(),
    terminator_endianness: EndiannessSchema.optional(),
    variants: exports_external.array(exports_external.string()).optional(),
    notes: exports_external.array(exports_external.string()).optional(),
    terminal_variants: exports_external.array(exports_external.string()).optional(),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  }).refine((data) => {
    if (data.kind === "fixed")
      return data.length !== undefined;
    if (data.kind === "length_prefixed")
      return data.length_type !== undefined;
    if (data.kind === "length_prefixed_items")
      return data.length_type !== undefined && data.item_length_type !== undefined;
    if (data.kind === "field_referenced")
      return data.length_field !== undefined;
    if (data.kind === "signature_terminated")
      return data.terminator_value !== undefined && data.terminator_type !== undefined;
    if (data.kind === "variant_terminated")
      return data.terminal_variants !== undefined && data.terminal_variants.length > 0;
    if (data.kind === "computed_count")
      return data.count_expr !== undefined;
    return true;
  }, {
    message: "Fixed arrays require 'length', length_prefixed arrays require 'length_type', length_prefixed_items arrays require 'length_type' and 'item_length_type', field_referenced arrays require 'length_field', signature_terminated arrays require 'terminator_value' and 'terminator_type', variant_terminated arrays require 'terminal_variants', computed_count arrays require 'count_expr'"
  });
  StringElementSchema = exports_external.object({
    type: exports_external.literal("string").meta({
      description: "Field type (always 'string')"
    }),
    kind: ArrayKindSchema,
    encoding: StringEncodingSchema.optional().default("utf8"),
    length: exports_external.number().int().min(1).optional(),
    length_type: exports_external.enum(["uint8", "uint16", "uint32", "uint64"]).optional(),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  }).refine((data) => {
    if (data.kind === "fixed")
      return data.length !== undefined;
    if (data.kind === "length_prefixed")
      return data.length_type !== undefined;
    return true;
  }, {
    message: "Fixed strings require 'length', length_prefixed strings require 'length_type'"
  });
  ElementTypeSchema = exports_external.union([
    exports_external.discriminatedUnion("type", [
      BitElementSchema,
      SignedIntElementSchema,
      Uint8ElementSchema,
      Uint16ElementSchema,
      Uint32ElementSchema,
      Uint64ElementSchema,
      Int8ElementSchema,
      Int16ElementSchema,
      Int32ElementSchema,
      Int64ElementSchema,
      Float32ElementSchema,
      Float64ElementSchema,
      OptionalElementSchema,
      ArrayElementSchema,
      StringElementSchema,
      DiscriminatedUnionElementSchema,
      ChoiceElementSchema,
      BackReferenceElementSchema
    ]),
    TypeRefElementSchema
  ]);
  ArrayFieldSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.literal("array").meta({
      description: "Field type (always 'array')"
    }),
    kind: ArrayKindSchema,
    get items() {
      return ElementTypeSchema;
    },
    length: exports_external.number().int().min(0).optional(),
    length_type: exports_external.enum(["uint8", "uint16", "uint32", "uint64", "varlength"]).optional(),
    length_encoding: exports_external.enum(["der", "leb128", "ebml"]).optional(),
    item_length_type: exports_external.enum(["uint8", "uint16", "uint32", "uint64"]).optional(),
    length_field: exports_external.string().optional(),
    count_expr: exports_external.string().optional(),
    terminator_value: exports_external.number().optional(),
    terminator_type: exports_external.enum(["uint8", "uint16", "uint32", "uint64"]).optional(),
    terminator_endianness: EndiannessSchema.optional(),
    variants: exports_external.array(exports_external.string()).optional(),
    notes: exports_external.array(exports_external.string()).optional(),
    terminal_variants: exports_external.array(exports_external.string()).optional(),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  }).refine((data) => {
    if (data.kind === "fixed")
      return data.length !== undefined;
    if (data.kind === "length_prefixed")
      return data.length_type !== undefined;
    if (data.kind === "length_prefixed_items")
      return data.length_type !== undefined && data.item_length_type !== undefined;
    if (data.kind === "field_referenced")
      return data.length_field !== undefined;
    if (data.kind === "byte_length_prefixed")
      return data.length_type !== undefined;
    if (data.kind === "signature_terminated")
      return data.terminator_value !== undefined && data.terminator_type !== undefined;
    if (data.kind === "variant_terminated")
      return data.terminal_variants !== undefined && data.terminal_variants.length > 0;
    if (data.kind === "computed_count")
      return data.count_expr !== undefined;
    return true;
  }, {
    message: "Fixed arrays require 'length', length_prefixed arrays require 'length_type', length_prefixed_items arrays require 'length_type' and 'item_length_type', field_referenced arrays require 'length_field', byte_length_prefixed arrays require 'length_type', signature_terminated arrays require 'terminator_value' and 'terminator_type', variant_terminated arrays require 'terminal_variants', computed_count arrays require 'count_expr'"
  }).meta({
    title: "Array",
    description: "Collection of elements of the same type. Supports fixed-length, length-prefixed, byte-length-prefixed, field-referenced, and null-terminated arrays.",
    use_for: "Lists of items, message batches, repeated structures, variable-length data",
    wire_format: "Depends on kind: fixed (N items), length_prefixed (count + items), length_prefixed_items (count + per-item lengths + items), null_terminated (items + terminator), field_referenced (length from earlier field)",
    code_generation: {
      typescript: {
        type: "Array<T>",
        notes: ["JavaScript array", "Elements type T depends on items field"]
      },
      go: {
        type: "[]T",
        notes: ["Go slice", "Elements type T depends on items field"]
      },
      rust: {
        type: "Vec<T>",
        notes: ["Rust vector (heap-allocated)", "Elements type T depends on items field"]
      }
    },
    notes: [
      "length_prefixed is most common for variable-length arrays",
      "field_referenced allows dynamic sizing based on earlier fields",
      "null_terminated useful for variable-length lists with terminator value",
      "length_prefixed_items used when each item has individual length prefix (e.g., array of strings)"
    ],
    examples: [
      { name: "values", type: "array", kind: "fixed", items: { type: "uint32" }, length: 4 },
      { name: "items", type: "array", kind: "length_prefixed", items: { type: "uint64" }, length_type: "uint16" },
      { name: "data", type: "array", kind: "field_referenced", items: { type: "uint8" }, length_field: "data_length" }
    ]
  });
  StringFieldBaseSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.literal("string").meta({
      description: "Field type (always 'string')"
    }),
    encoding: StringEncodingSchema.optional().default("utf8"),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  });
  StringFieldSchema = exports_external.discriminatedUnion("kind", [
    StringFieldBaseSchema.extend({
      kind: exports_external.literal("fixed"),
      length: exports_external.number().int().min(1)
    }).strict(),
    StringFieldBaseSchema.extend({
      kind: exports_external.literal("length_prefixed"),
      length_type: exports_external.enum(["uint8", "uint16", "uint32", "uint64"])
    }).strict(),
    StringFieldBaseSchema.extend({
      kind: exports_external.literal("field_referenced"),
      length_field: exports_external.string()
    }).strict(),
    StringFieldBaseSchema.extend({
      kind: exports_external.literal("null_terminated")
    }).strict()
  ]).meta({
    title: "String",
    description: "Variable or fixed-length text field with UTF-8 or ASCII encoding. Can be length-prefixed, fixed-length, or null-terminated.",
    use_for: "Usernames, messages, labels, text data, identifiers",
    wire_format: "Depends on kind: length-prefixed (length prefix + bytes), fixed (N bytes), or null-terminated (bytes + 0x00)",
    code_generation: {
      typescript: {
        type: "string",
        notes: ["JavaScript string type", "Automatically handles UTF-8 encoding"]
      },
      go: {
        type: "string",
        notes: ["Native Go string type", "UTF-8 by default"]
      },
      rust: {
        type: "String",
        notes: ["Rust String type (heap-allocated)", "Always UTF-8"]
      }
    },
    notes: [
      "Length-prefixed is most common for variable-length strings",
      "Fixed-length strings are padded/truncated to exact size",
      "Null-terminated strings read until 0x00 byte"
    ],
    examples: [
      { name: "nickname", type: "string", kind: "length_prefixed", length_type: "uint8" },
      { name: "username", type: "string", kind: "length_prefixed", length_type: "uint16", encoding: "utf8" },
      { name: "code", type: "string", kind: "fixed", length: 8, encoding: "ascii" }
    ]
  });
  DiscriminatedUnionFieldSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.literal("discriminated_union").meta({
      description: "Field type (always 'discriminated_union')"
    }),
    discriminator: DiscriminatorSchema,
    variants: exports_external.array(DiscriminatedUnionVariantSchema).min(1),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  }).meta({
    title: "Discriminated Union",
    description: "Type that can be one of several variants, chosen based on a discriminator value. Supports peek-based (read ahead) or field-based (reference earlier field) discrimination.",
    use_for: "Protocol messages, polymorphic data, variant types, message envelopes",
    wire_format: "Discriminator determines which variant type to parse. No additional type tag on wire (discriminator serves this purpose).",
    code_generation: {
      typescript: {
        type: "V1 | V2 | ...",
        notes: ["TypeScript union of variant types", "Requires type guards for access", "Variant types depend on variants array"]
      },
      go: {
        type: "interface{} (with type assertion)",
        notes: ["Go interface with concrete variant types", "Type assertion required for access", "Variant types depend on variants array"]
      },
      rust: {
        type: "enum { V1(...), V2(...), ... }",
        notes: ["Rust enum with named variants", "Pattern matching for access", "Variant types depend on variants array"]
      }
    },
    notes: [
      "Peek-based: Reads discriminator without consuming bytes (useful for tag-first protocols)",
      "Field-based: Uses value from earlier field (useful for header-based protocols)",
      "Each variant has a 'when' condition (e.g., 'value == 0x01') that determines if it matches"
    ],
    examples: [
      {
        name: "message",
        type: "discriminated_union",
        discriminator: { peek: "uint8" },
        variants: [
          { when: "value == 0x01", type: "QueryMessage" },
          { when: "value == 0x02", type: "ResponseMessage" }
        ]
      }
    ]
  });
  BitfieldFieldSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.literal("bitfield").meta({
      description: "Field type (always 'bitfield')"
    }),
    size: exports_external.number().int().min(1),
    bit_order: BitOrderSchema.optional(),
    fields: exports_external.array(exports_external.object({
      name: exports_external.string().meta({
        description: "Field name"
      }),
      offset: exports_external.number().int().min(0),
      size: exports_external.number().int().min(1),
      description: exports_external.string().optional().meta({
        description: "Human-readable description of this field"
      })
    })),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  }).meta({
    title: "Bitfield",
    description: "Container for packing multiple bit-level fields into a compact byte-aligned structure. Allows precise bit-level control.",
    use_for: "Flags, compact headers, protocol opcodes, bit-packed data",
    wire_format: "Packed bits stored in bytes (size determines total bytes). Bit order (MSB/LSB first) determined by config.",
    code_generation: {
      typescript: {
        type: "object with number fields",
        notes: ["TypeScript object with numeric properties", "Each field is a number", "Bit manipulation handled by encoder/decoder"]
      },
      go: {
        type: "struct with uintN fields",
        notes: ["Go struct with appropriate uint types", "Bit manipulation handled by encoder/decoder"]
      },
      rust: {
        type: "struct with uN fields",
        notes: ["Rust struct with appropriate uint types", "Bit manipulation handled by encoder/decoder"]
      }
    },
    notes: [
      "Size must be multiple of 8 for byte alignment",
      "Field offsets specify bit position within the bitfield",
      "Bit order (MSB first vs LSB first) affects how bits are numbered"
    ],
    examples: [
      {
        name: "flags",
        type: "bitfield",
        size: 8
      }
    ]
  });
  TypeRefFieldSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.string().refine((t) => {
      const baseName = t.split("<")[0];
      return /^[A-Z]/.test(baseName);
    }, {
      message: "Type references must start with uppercase letter (built-in types use specific field schemas)"
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  });
  ConditionalFieldSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.string(),
    conditional: exports_external.string(),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  }).meta({
    title: "Conditional Field",
    description: "Field that is only present on the wire if a condition evaluates to true. Condition references earlier fields.",
    use_for: "Protocol extensions, optional sections, feature-flagged data",
    wire_format: "Field is only encoded/decoded if condition is true. No presence indicator on wire.",
    code_generation: {
      typescript: {
        type: "T | undefined",
        notes: ["TypeScript union with undefined", "Undefined if condition false", "Type T depends on type field"]
      },
      go: {
        type: "*T or separate bool",
        notes: ["Go pointer (nil if absent) or separate present flag", "Type T depends on type field"]
      },
      rust: {
        type: "Option<T>",
        notes: ["Rust Option enum", "None if condition false", "Type T depends on type field"]
      }
    },
    notes: [
      "Condition is evaluated during encoding/decoding",
      "Supports dot notation for nested field access (e.g., 'header.flags.extended')",
      "Unlike optional type, no presence indicator is stored on wire"
    ],
    examples: [
      {
        name: "extended_data",
        type: "uint32",
        conditional: "flags.has_extended == 1"
      },
      {
        name: "metadata",
        type: "Metadata",
        conditional: "version >= 2"
      }
    ]
  });
  FieldTypeRefSchema = exports_external.union([
    ConditionalFieldSchema,
    exports_external.union([
      BitFieldSchema,
      SignedIntFieldSchema,
      Uint8FieldSchema,
      Uint16FieldSchema,
      Uint32FieldSchema,
      Uint64FieldSchema,
      Int8FieldSchema,
      Int16FieldSchema,
      Int32FieldSchema,
      Int64FieldSchema,
      VarlengthFieldSchema,
      Float32FieldSchema,
      Float64FieldSchema,
      OptionalFieldSchema,
      ArrayFieldSchema,
      StringFieldSchema,
      BitfieldFieldSchema,
      DiscriminatedUnionFieldSchema,
      BackReferenceFieldSchema,
      PaddingFieldSchema
    ]),
    TypeRefFieldSchema
  ]);
  FieldSchema = FieldTypeRefSchema;
  InlineDiscriminatedUnionSchema = exports_external.object({
    discriminator: DiscriminatorSchema.meta({
      description: "How to determine which variant to use (peek at data or reference earlier field)"
    }),
    variants: exports_external.array(DiscriminatedUnionVariantSchema).min(1).meta({
      description: "List of possible types with conditions"
    })
  });
  PositionFieldSchema = exports_external.object({
    name: exports_external.string().meta({
      description: "Field name"
    }),
    type: exports_external.union([
      exports_external.string(),
      InlineDiscriminatedUnionSchema
    ]).meta({
      description: "Type to decode at position. Can be a type name (string) or an inline discriminated union with discriminator and variants."
    }),
    position: exports_external.union([
      exports_external.number(),
      exports_external.string()
    ]).meta({
      description: "Position to seek to before decoding. Number (positive=absolute offset, negative=from EOF), or field reference (e.g., 'header.data_offset')"
    }),
    size: exports_external.union([
      exports_external.number(),
      exports_external.string()
    ]).optional().meta({
      description: "Optional size hint for the data at this position"
    }),
    alignment: exports_external.number().int().positive().optional().meta({
      description: "Required alignment in bytes (must be power of 2). Position will be validated: position % alignment == 0"
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  }).refine((data) => {
    if (data.alignment !== undefined) {
      const isPowerOfTwo = (data.alignment & data.alignment - 1) === 0;
      return isPowerOfTwo;
    }
    return true;
  }, {
    message: "Alignment must be a power of 2 (1, 2, 4, 8, 16, ...)"
  }).meta({
    title: "Position Field (Instance)",
    description: "Lazy-evaluated field at an absolute or relative position in the file. Used for random-access formats like ZIP, ELF, databases. Only evaluated when accessed.",
    use_for: "ZIP central directory, ELF section headers, database indexes, table-of-contents structures",
    wire_format: "No bytes on wire for the field itself - position indicates where to seek and parse the target type",
    code_generation: {
      typescript: {
        type: "get accessor returning T",
        notes: [
          "TypeScript getter that parses on first access",
          "Cached after first read",
          "Type T depends on type field"
        ]
      },
      go: {
        type: "method returning (*T, error)",
        notes: [
          "Go method with sync.Once for thread-safe lazy init",
          "Cached after first call",
          "Type T depends on type field"
        ]
      }
    },
    notes: [
      "Position can be negative (from EOF): -22 means last 22 bytes",
      "Position can reference earlier field: 'header.offset'",
      "Alignment is validated at runtime: position % alignment == 0",
      "Size is optional hint for memory allocation"
    ],
    examples: [
      {
        name: "footer",
        type: "Footer",
        position: -22,
        size: 22,
        description: "Footer at end of file"
      },
      {
        name: "data",
        type: "DataBlock",
        position: "header.data_offset",
        alignment: 4,
        description: "Data block at offset from header"
      }
    ]
  });
  CompositeTypeSchema = exports_external.object({
    sequence: exports_external.array(FieldSchema),
    instances: exports_external.array(PositionFieldSchema).optional().meta({
      description: "Position-based fields (lazy-evaluated when accessed). Requires seekable input."
    }),
    description: exports_external.string().optional()
  });
  TypeDefSchema = exports_external.union([
    CompositeTypeSchema,
    ElementTypeSchema.and(exports_external.object({
      description: exports_external.string().optional()
    }))
  ]);
  MessageGroupSchema = exports_external.object({
    name: exports_external.string(),
    messages: exports_external.array(exports_external.union([exports_external.string(), exports_external.number()])).transform((values, ctx) => {
      const normalized = [];
      values.forEach((value, index) => {
        try {
          normalized.push(normalizeMessageCode(value));
        } catch (err) {
          ctx.addIssue({
            code: exports_external.ZodIssueCode.custom,
            path: [index],
            message: err instanceof Error ? err.message : "Invalid message code value"
          });
        }
      });
      return normalized;
    }),
    description: exports_external.string().optional().meta({
      description: "Human-readable description of this field"
    })
  });
  ProtocolConstantSchema = exports_external.object({
    value: exports_external.union([exports_external.number(), exports_external.string()]),
    description: exports_external.string(),
    type: exports_external.string().optional()
  });
  ProtocolMessageSchema = exports_external.object({
    code: exports_external.union([exports_external.string(), exports_external.number()]).transform((value, ctx) => {
      try {
        return normalizeMessageCode(value);
      } catch (err) {
        ctx.addIssue({
          code: exports_external.ZodIssueCode.custom,
          message: err instanceof Error ? err.message : "Invalid message code value"
        });
        return exports_external.NEVER;
      }
    }),
    name: exports_external.string(),
    direction: exports_external.enum(["client_to_server", "server_to_client", "bidirectional"]).optional(),
    payload_type: exports_external.string(),
    description: exports_external.string().optional(),
    notes: exports_external.union([exports_external.string(), exports_external.array(exports_external.string())]).optional(),
    example: exports_external.object({
      description: exports_external.string(),
      bytes: exports_external.array(exports_external.number()),
      decoded: exports_external.any().optional()
    }).optional(),
    since: exports_external.string().optional(),
    deprecated: exports_external.string().optional()
  });
  ProtocolDefinitionSchema = exports_external.object({
    name: exports_external.string(),
    version: exports_external.string(),
    description: exports_external.string().optional(),
    header: exports_external.string(),
    header_size_field: exports_external.string().optional(),
    header_example: exports_external.object({
      decoded: exports_external.any()
    }).optional(),
    discriminator: exports_external.string(),
    field_descriptions: exports_external.record(exports_external.string(), exports_external.string()).optional(),
    messages: exports_external.array(ProtocolMessageSchema).min(1),
    message_groups: exports_external.array(MessageGroupSchema).optional(),
    constants: exports_external.record(exports_external.string(), ProtocolConstantSchema).optional(),
    notes: exports_external.array(exports_external.string()).optional()
  });
  MetaSchema = exports_external.object({
    title: exports_external.string().optional().meta({
      description: "Human-readable title for the schema (e.g., 'PNG Image Format')"
    }),
    description: exports_external.string().optional().meta({
      description: "Brief description of what this schema defines"
    }),
    version: exports_external.string().optional().meta({
      description: "Version string (e.g., '1.0', 'RFC 2083')"
    })
  });
  BinarySchemaSchema = exports_external.object({
    meta: MetaSchema.optional(),
    config: ConfigSchema,
    types: exports_external.record(exports_external.string(), TypeDefSchema),
    protocol: ProtocolDefinitionSchema.optional()
  }).refine((schema) => {
    for (const typeName of Object.keys(schema.types)) {
      if (!/^[A-Z]/.test(typeName)) {
        return false;
      }
    }
    return true;
  }, {
    message: "User-defined types must start with an uppercase letter (e.g., 'String', 'MyType'). This prevents conflicts with built-in types like 'string', 'uint8', 'array', etc."
  }).refine((schema) => {
    const result = validateTerminalVariants(schema);
    return result.valid;
  }, {
    message: "Invalid terminal_variants configuration (check terminal_variant references)"
  });
});

// profile-binschema.ts
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve, dirname } from "path";
import { pathToFileURL, fileURLToPath } from "url";

// ../packages/binschema/src/generators/typescript/shared.ts
init_binary_schema();

// ../packages/zod-metadata-extractor/dist/extract.js
function extractMetadata(schema) {
  try {
    const metadata = schema.meta();
    return metadata || undefined;
  } catch (error46) {
    return;
  }
}
function extractFields(schema, options = {}) {
  const { extractUnions = true, extractFieldMeta = true } = options;
  const def = schema.def || schema._def;
  if (def?.type !== "object" || !def?.shape) {
    return;
  }
  const fields = [];
  for (const [fieldName, fieldSchema] of Object.entries(def.shape)) {
    const field = extractFieldInfo(fieldName, fieldSchema, { extractUnions, extractFieldMeta });
    fields.push(field);
  }
  return fields.length > 0 ? fields : undefined;
}
function extractFieldInfo(name, schema, options) {
  const { extractUnions, extractFieldMeta } = options;
  let unwrappedSchema = schema;
  let fieldDef = schema.def || schema._def;
  const required2 = fieldDef?.type !== "optional";
  while (fieldDef?.type === "optional" && fieldDef?.innerType) {
    unwrappedSchema = fieldDef.innerType;
    fieldDef = unwrappedSchema.def || unwrappedSchema._def;
  }
  let typeName = getTypeName(fieldDef);
  let description;
  if (extractFieldMeta) {
    try {
      const fieldMeta = schema.meta?.();
      if (fieldMeta?.description) {
        description = fieldMeta.description;
      }
    } catch (e) {}
  }
  let unionOptions;
  if (extractUnions && fieldDef?.type === "union") {
    unionOptions = extractUnionOptions(unwrappedSchema);
  }
  const constraints = extractConstraints(fieldDef);
  let arrayElement;
  if (fieldDef?.type === "array") {
    arrayElement = extractArrayElement(fieldDef);
  }
  return {
    name,
    type: typeName,
    required: required2,
    description,
    constraints,
    unionOptions,
    arrayElement
  };
}
function getTypeName(fieldDef) {
  const type = fieldDef?.type;
  if (!type) {
    return "unknown";
  }
  if (type === "literal") {
    if (fieldDef?.values && Array.isArray(fieldDef.values) && fieldDef.values.length > 0) {
      return `literal "${fieldDef.values[0]}"`;
    } else if (fieldDef?.value !== undefined) {
      return `literal "${fieldDef.value}"`;
    }
  }
  if (type === "enum") {
    if (fieldDef?.entries) {
      const entries = fieldDef.entries;
      const keys = Object.keys(entries);
      const hasNumericKeys = keys.some((k) => !isNaN(Number(k)));
      if (hasNumericKeys) {
        return "nativeEnum";
      }
      const enumValues = keys;
      return `enum (${enumValues.map((v) => `"${v}"`).join(" | ")})`;
    } else if (fieldDef?.values) {
      return `enum (${Array.from(fieldDef.values).map((v) => `"${v}"`).join(" | ")})`;
    }
  }
  if (type === "union") {
    if (fieldDef?.discriminator) {
      return "discriminatedUnion";
    }
    return "union";
  }
  if (type === "pipe") {
    return "pipe";
  }
  if (type === "array") {
    return "array";
  }
  return type;
}
function extractArrayElement(arrayDef) {
  const element = arrayDef?.element;
  if (!element) {
    return;
  }
  const elementDef = element._def || element.def;
  const elementType = getTypeName(elementDef);
  if (elementDef?.type === "object" && elementDef?.shape) {
    const fields = [];
    for (const [fieldName, fieldSchema] of Object.entries(elementDef.shape)) {
      const fieldInfo = extractFieldInfo(fieldName, fieldSchema, { extractUnions: false, extractFieldMeta: true });
      fields.push({
        name: fieldInfo.name,
        type: fieldInfo.type,
        required: fieldInfo.required,
        description: fieldInfo.description
      });
    }
    return {
      type: elementType,
      fields
    };
  }
  return {
    type: elementType
  };
}
function extractConstraints(fieldDef) {
  const checks3 = fieldDef?.checks;
  if (!checks3 || !Array.isArray(checks3) || checks3.length === 0) {
    return;
  }
  const constraints = [];
  for (const check2 of checks3) {
    const checkDef = check2._zod?.def;
    if (!checkDef)
      continue;
    switch (checkDef.check) {
      case "min_length":
        constraints.push({ type: "min_length", value: checkDef.minimum });
        break;
      case "max_length":
        constraints.push({ type: "max_length", value: checkDef.maximum });
        break;
      case "length_equals":
        constraints.push({ type: "exact_length", value: checkDef.length });
        break;
      case "greater_than":
        constraints.push({
          type: checkDef.inclusive ? "min" : "greater_than",
          value: checkDef.value,
          inclusive: checkDef.inclusive
        });
        break;
      case "less_than":
        constraints.push({
          type: checkDef.inclusive ? "max" : "less_than",
          value: checkDef.value,
          inclusive: checkDef.inclusive
        });
        break;
      case "string_format":
        if (checkDef.format === "regex") {
          constraints.push({
            type: "pattern",
            pattern: checkDef.pattern
          });
        } else {
          constraints.push({
            type: "format",
            format: checkDef.format,
            pattern: checkDef.pattern
          });
        }
        break;
      case "multiple_of":
        constraints.push({
          type: "multiple_of",
          value: checkDef.value
        });
        break;
    }
  }
  return constraints.length > 0 ? constraints : undefined;
}
function extractUnionOptions(schema) {
  const def = schema.def || schema._def;
  if (def?.type !== "union" || !def?.options) {
    return;
  }
  const options = [];
  for (const option of def.options) {
    const optDef = option.def || option._def;
    if (optDef?.type === "object" && optDef?.shape) {
      const fields = [];
      for (const [fieldName, fieldSchema] of Object.entries(optDef.shape)) {
        const fieldInfo = extractFieldInfo(fieldName, fieldSchema, { extractUnions: false, extractFieldMeta: true });
        fields.push({
          name: fieldInfo.name,
          type: fieldInfo.type,
          required: fieldInfo.required,
          description: fieldInfo.description
        });
      }
      if (fields.length > 0) {
        options.push({ fields });
      }
    }
  }
  return options.length > 0 ? options : undefined;
}
function walkUnion(schema, options = {}) {
  const { mergeFields = true, extractUnions = true, extractFieldMeta = true } = options;
  const results = new Map;
  const def = schema.def || schema._def;
  if (!def?.options) {
    return { metadata: results, hasMetadata: false };
  }
  for (const optionSchema of def.options) {
    const optDef = optionSchema.def || optionSchema._def;
    const isNestedUnion = optDef?.type === "union" || optDef?.discriminator;
    if (isNestedUnion && optDef?.options) {
      const nestedResult = walkUnion(optionSchema, options);
      for (const [key, value] of nestedResult.metadata) {
        results.set(key, value);
      }
    } else {
      const discriminatorValue = extractDiscriminatorValue(optionSchema);
      const meta = extractMetadata(optionSchema);
      if (meta) {
        let key = discriminatorValue;
        if (!key && meta.title) {
          key = meta.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
        }
        if (key) {
          const enriched = enrichMetadata(meta, optionSchema, { mergeFields, extractUnions, extractFieldMeta });
          results.set(key, enriched);
        }
      }
    }
  }
  return {
    metadata: results,
    hasMetadata: results.size > 0
  };
}
function extractDiscriminatorValue(schema) {
  const def = schema.def || schema._def;
  const typeLiteral = def?.shape?.type;
  if (!typeLiteral) {
    return;
  }
  const typeLiteralDef = typeLiteral.def || typeLiteral._def;
  if (typeLiteralDef?.values && Array.isArray(typeLiteralDef.values) && typeLiteralDef.values.length > 0) {
    const typeValue = typeLiteralDef.values[0];
    return typeof typeValue === "string" ? typeValue : undefined;
  }
  if (typeLiteralDef?.value !== undefined) {
    return typeof typeLiteralDef.value === "string" ? typeLiteralDef.value : undefined;
  }
  return;
}
function enrichMetadata(metadata, schema, options) {
  const { mergeFields } = options;
  if (!mergeFields) {
    return metadata;
  }
  const schemaFields = extractFields(schema, options);
  if (!schemaFields) {
    return metadata;
  }
  if (metadata.fields) {
    const descriptionMap = new Map;
    for (const field of metadata.fields) {
      if (field.description) {
        descriptionMap.set(field.name, field.description);
      }
    }
    for (const field of schemaFields) {
      const description = descriptionMap.get(field.name);
      if (description) {
        field.description = description;
      }
    }
  }
  return {
    ...metadata,
    fields: schemaFields
  };
}
// ../packages/binschema/src/schema/extract-metadata.ts
function walkUnion2(schema) {
  const result = walkUnion(schema, {
    mergeFields: true,
    extractUnions: true,
    extractFieldMeta: true
  });
  return result.metadata;
}

// ../packages/binschema/src/generators/typescript/shared.ts
var TS_RESERVED_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "object",
  "symbol",
  "bigint",
  "undefined",
  "null",
  "any",
  "void",
  "never",
  "unknown",
  "Array",
  "Promise",
  "Map",
  "Set",
  "Date",
  "RegExp",
  "Error"
]);
var JS_RESERVED_KEYWORDS = new Set([
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "null",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "let",
  "static",
  "implements",
  "interface",
  "package",
  "private",
  "protected",
  "public",
  "await",
  "async"
]);
var BACK_REFERENCE_TYPE_NAMES = new Set(["back_reference"]);
var ARRAY_ITER_SUFFIX = "__iter";
var FIELD_TYPE_METADATA = (() => {
  try {
    return walkUnion2(FieldSchema);
  } catch {
    return new Map;
  }
})();

// ../packages/binschema/src/generators/typescript/type-utils.ts
function isTypeAlias(typeDef) {
  const typeDefAny = typeDef;
  if ("sequence" in typeDef) {
    return false;
  }
  if (typeDefAny.type === "array" || typeDefAny.type === "string") {
    return false;
  }
  return true;
}
function getTypeFields(typeDef) {
  if ("sequence" in typeDef && typeDef.sequence) {
    return typeDef.sequence;
  }
  return [];
}
function sanitizeTypeName(typeName) {
  if (typeName.includes("<")) {
    return typeName;
  }
  if (TS_RESERVED_TYPES.has(typeName)) {
    return `${typeName}_`;
  }
  return typeName;
}
function sanitizeEnumMemberName(name) {
  let sanitized = name.replace(/[^a-zA-Z0-9_]/g, "_");
  if (/^[0-9]/.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }
  if (JS_RESERVED_KEYWORDS.has(sanitized)) {
    return `${sanitized}_`;
  }
  return sanitized;
}

// ../packages/binschema/src/generators/typescript/documentation.ts
function normalizeDocInput(doc2) {
  if (!doc2)
    return [];
  const entries = Array.isArray(doc2) ? doc2 : doc2.split(/\r?\n/);
  return entries.map((line) => line.trim()).filter((line) => line.length > 0);
}
function createSummaryDoc(description) {
  const lines = normalizeDocInput(description);
  if (lines.length === 0)
    return;
  return { summary: lines };
}
function pushSummary(summary, doc2, seen) {
  const lines = normalizeDocInput(doc2);
  for (const line of lines) {
    if (seen.has(line))
      continue;
    seen.add(line);
    summary.push(line);
  }
}
function pushRemarksParagraph(remarks, doc2, seen) {
  const lines = normalizeDocInput(doc2).filter((line) => {
    if (seen.has(line))
      return false;
    seen.add(line);
    return true;
  });
  if (lines.length === 0)
    return;
  if (remarks.length > 0 && remarks[remarks.length - 1] !== "") {
    remarks.push("");
  }
  remarks.push(...lines);
}
function trimBlankEdges(lines) {
  while (lines.length > 0 && lines[0] === "") {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  for (let i = 1;i < lines.length; i++) {
    if (lines[i] === "" && lines[i - 1] === "") {
      lines.splice(i, 1);
      i--;
    }
  }
}
function metadataToDoc(metadata) {
  if (!metadata)
    return;
  const lines = [];
  if (metadata.title) {
    lines.push(metadata.title);
  }
  if (metadata.description) {
    lines.push(metadata.description);
  }
  return lines.length > 0 ? lines : undefined;
}
function getMetadataDocForType(typeName) {
  if (!typeName)
    return;
  const candidates = new Set;
  candidates.add(typeName);
  candidates.add(typeName.toLowerCase());
  const genericMatch = typeName.match(/^([^<]+)</);
  if (genericMatch) {
    const base = genericMatch[1];
    candidates.add(base);
    candidates.add(base.toLowerCase());
  }
  for (const key of candidates) {
    if (!key)
      continue;
    const metadata = FIELD_TYPE_METADATA.get(key);
    const doc2 = metadataToDoc(metadata);
    if (doc2 && doc2.length > 0) {
      return doc2;
    }
  }
  return;
}
function getSchemaTypeDescription(typeName, schema) {
  if (!typeName)
    return;
  if (!schema?.types)
    return;
  const direct = schema.types[typeName];
  if (direct && typeof direct === "object" && "description" in direct) {
    const description = direct.description;
    if (typeof description === "string" && description.trim()) {
      return description.trim();
    }
  }
  const genericMatch = typeName.match(/^([^<]+)<.+>$/);
  if (genericMatch) {
    const templateName = `${genericMatch[1]}<T>`;
    const template = schema.types[templateName];
    if (template && typeof template === "object" && "description" in template) {
      const description = template.description;
      if (typeof description === "string" && description.trim()) {
        return description.trim();
      }
    }
  }
  return;
}
function describeArrayField(field) {
  if (!field || typeof field !== "object")
    return;
  const lines = [];
  if (field.kind) {
    let detail = `Array kind: ${field.kind}`;
    if (field.kind === "field_referenced" && field.length_field) {
      detail += ` (length from '${field.length_field}')`;
    }
    lines.push(detail);
  }
  if (typeof field.length === "number") {
    lines.push(`Fixed length: ${field.length}`);
  }
  if (field.length_type) {
    lines.push(`Length prefix type: ${field.length_type}`);
  }
  if (field.item_length_type) {
    lines.push(`Item length type: ${field.item_length_type}`);
  }
  if (field.length_field && field.kind !== "field_referenced") {
    lines.push(`Length field: ${field.length_field}`);
  }
  return lines.length > 0 ? lines : undefined;
}
function describeStringField(field) {
  if (!field || typeof field !== "object")
    return;
  const lines = [];
  if (field.kind) {
    lines.push(`String kind: ${field.kind}`);
  }
  if (field.encoding) {
    lines.push(`Encoding: ${field.encoding}`);
  }
  if (typeof field.length === "number") {
    lines.push(`Fixed length: ${field.length}`);
  }
  if (field.length_type) {
    lines.push(`Length prefix type: ${field.length_type}`);
  }
  return lines.length > 0 ? lines : undefined;
}
function describeDiscriminatedUnion(field) {
  if (!field || typeof field !== "object")
    return;
  const lines = [];
  const discriminator = field.discriminator;
  if (discriminator?.field) {
    lines.push(`Discriminator: field '${discriminator.field}'`);
  } else if (discriminator?.peek) {
    const endianness = discriminator.endianness ? `, ${discriminator.endianness}` : "";
    lines.push(`Discriminator: peek ${discriminator.peek}${endianness}`);
  }
  if (Array.isArray(field.variants)) {
    lines.push(`Variants: ${field.variants.length}`);
    for (const variant of field.variants) {
      if (!variant)
        continue;
      let entry = `- ${variant.type ?? "unknown"}`;
      if (variant.when) {
        entry += ` (when ${variant.when})`;
      }
      if (variant.description) {
        entry += ` - ${variant.description}`;
      }
      lines.push(entry);
    }
  }
  return lines.length > 0 ? lines : undefined;
}
function describeBackReference(field) {
  if (!field || typeof field !== "object")
    return;
  const lines = [];
  if (field.storage) {
    lines.push(`Storage type: ${field.storage}`);
  }
  if (field.offset_mask) {
    lines.push(`Offset mask: ${field.offset_mask}`);
  }
  if (field.offset_from) {
    lines.push(`Offset from: ${field.offset_from}`);
  }
  if (field.target_type) {
    lines.push(`Target type: ${field.target_type}`);
  }
  return lines.length > 0 ? lines : undefined;
}
function describeBitfield(field) {
  if (!field || typeof field !== "object")
    return;
  const lines = [];
  if (typeof field.size === "number") {
    lines.push(`Total size: ${field.size} bits`);
  }
  if (Array.isArray(field.fields)) {
    const names = field.fields.map((f) => f?.name).filter(Boolean);
    if (names.length > 0) {
      lines.push(`Bitfield entries: ${names.join(", ")}`);
    }
  }
  return lines.length > 0 ? lines : undefined;
}
function describeElementTypeDef(typeDef) {
  if (!typeDef || typeof typeDef !== "object" || !("type" in typeDef))
    return;
  switch (typeDef.type) {
    case "array":
      return describeArrayField(typeDef);
    case "string":
      return describeStringField(typeDef);
    case "discriminated_union":
      return describeDiscriminatedUnion(typeDef);
    case "back_reference":
      return describeBackReference(typeDef);
    case "bitfield":
      return describeBitfield(typeDef);
    default:
      return;
  }
}
function getFieldDocumentation(field, schema) {
  const summary = [];
  const remarks = [];
  const seen = new Set;
  const fieldAny = field;
  pushSummary(summary, fieldAny?.description, seen);
  if ("type" in field) {
    const typeValue = field.type;
    if (typeof typeValue === "string") {
      pushRemarksParagraph(remarks, getSchemaTypeDescription(typeValue, schema), seen);
      pushRemarksParagraph(remarks, getMetadataDocForType(typeValue), seen);
      switch (typeValue) {
        case "array":
          pushRemarksParagraph(remarks, describeArrayField(fieldAny), seen);
          break;
        case "string":
          pushRemarksParagraph(remarks, describeStringField(fieldAny), seen);
          break;
        case "discriminated_union":
          pushRemarksParagraph(remarks, describeDiscriminatedUnion(fieldAny), seen);
          break;
        case "back_reference":
          pushRemarksParagraph(remarks, describeBackReference(fieldAny), seen);
          break;
        case "bitfield":
          pushRemarksParagraph(remarks, describeBitfield(fieldAny), seen);
          break;
        default:
          break;
      }
      const referencedType = schema.types?.[typeValue];
      if (referencedType && typeof referencedType === "object" && !("sequence" in referencedType)) {
        pushRemarksParagraph(remarks, describeElementTypeDef(referencedType), seen);
      }
      const genericMatch = typeValue.match(/^([^<]+)<.+>$/);
      if (genericMatch) {
        const baseName = genericMatch[1];
        pushRemarksParagraph(remarks, getSchemaTypeDescription(`${baseName}<T>`, schema), seen);
        pushRemarksParagraph(remarks, getSchemaTypeDescription(baseName, schema), seen);
        const template = schema.types?.[`${baseName}<T>`];
        if (template && typeof template === "object" && !("sequence" in template)) {
          pushRemarksParagraph(remarks, describeElementTypeDef(template), seen);
        }
        const baseTypeDef = schema.types?.[baseName];
        if (baseTypeDef && typeof baseTypeDef === "object" && !("sequence" in baseTypeDef)) {
          pushRemarksParagraph(remarks, describeElementTypeDef(baseTypeDef), seen);
        }
        pushRemarksParagraph(remarks, getMetadataDocForType(baseName), seen);
      } else if (typeValue !== typeValue.toLowerCase()) {
        pushRemarksParagraph(remarks, getMetadataDocForType(typeValue.toLowerCase()), seen);
      }
    }
  }
  if (summary.length === 0 && remarks.length > 0) {
    const promoted = [];
    while (remarks.length > 0) {
      const line = remarks.shift();
      if (line === "")
        break;
      promoted.push(line);
    }
    trimBlankEdges(remarks);
    summary.push(...promoted);
  }
  trimBlankEdges(summary);
  trimBlankEdges(remarks);
  if (summary.length === 0 && remarks.length === 0) {
    return;
  }
  return {
    summary: summary.length > 0 ? summary : undefined,
    remarks: remarks.length > 0 ? remarks : undefined
  };
}
function isDocBlock(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function generateJSDoc(doc2, indent = "") {
  let block;
  if (doc2 === undefined) {
    return "";
  } else if (isDocBlock(doc2)) {
    block = doc2;
  } else {
    block = createSummaryDoc(doc2);
  }
  if (!block)
    return "";
  const summary = block.summary ? [...block.summary] : [];
  const remarks = block.remarks ? [...block.remarks] : [];
  trimBlankEdges(summary);
  trimBlankEdges(remarks);
  if (summary.length === 0 && remarks.length === 0) {
    return "";
  }
  const lines = [];
  lines.push(...summary);
  if (remarks.length > 0) {
    if (lines.length > 0 && lines[lines.length - 1] !== "") {
      lines.push("");
    }
    lines.push("@remarks");
    lines.push("");
    lines.push(...remarks);
  }
  trimBlankEdges(lines);
  if (lines.length === 0)
    return "";
  const formatted = lines.map((line) => line.length > 0 ? `${indent} * ${line}` : `${indent} *`).join(`
`);
  return `${indent}/**
${formatted}
${indent} */
`;
}

// ../packages/binschema/src/generators/typescript/runtime-helpers.ts
function generateRuntimeHelpers() {
  let code = "";
  code += `function __bs_get<T>(expr: () => T): T | undefined {
`;
  code += `  try {
`;
  code += `    return expr();
`;
  code += `  } catch {
`;
  code += `    return undefined;
`;
  code += `  }
`;
  code += `}

`;
  code += `function __bs_numeric(value: any): any {
`;
  code += `  if (typeof value === "bigint") {
`;
  code += `    return value;
`;
  code += `  }
`;
  code += `  if (typeof value === "number" && Number.isInteger(value)) {
`;
  code += `    return BigInt(value);
`;
  code += `  }
`;
  code += `  return value;
`;
  code += `}

`;
  code += `function __bs_literal(value: number): number | bigint {
`;
  code += `  if (Number.isInteger(value)) {
`;
  code += `    return BigInt(value);
`;
  code += `  }
`;
  code += `  return value;
`;
  code += `}

`;
  code += `function __bs_checkCondition(expr: () => any): boolean {
`;
  code += `  try {
`;
  code += `    const result = expr();
`;
  code += `    if (typeof result === "bigint") {
`;
  code += `      return result !== 0n;
`;
  code += `    }
`;
  code += `    return !!result;
`;
  code += `  } catch {
`;
  code += `    return false;
`;
  code += `  }
`;
  code += `}

`;
  return code;
}

// ../packages/binschema/src/generators/typescript/bitfield-support.ts
function generateEncodeBitfield(field, valuePath, indent) {
  let code = "";
  for (const subField of field.fields) {
    code += `${indent}this.writeBits(${valuePath}.${subField.name}, ${subField.size});
`;
  }
  return code;
}
function generateDecodeBitfield(field, fieldName, indent, getTargetPath) {
  const target = getTargetPath(fieldName);
  let code = `${indent}${target} = {};
`;
  for (const subField of field.fields) {
    if (subField.size > 53) {
      code += `${indent}${target}.${subField.name} = this.readBits(${subField.size});
`;
    } else {
      code += `${indent}${target}.${subField.name} = Number(this.readBits(${subField.size}));
`;
    }
  }
  return code;
}

// ../packages/binschema/src/generators/typescript/computed-fields.ts
function makeUniqueComputedVar(fieldName) {
  const suffix = `_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  return `${fieldName}_computed${suffix}`;
}
function getVarlengthWriteMethod(encoding) {
  const methodMap = {
    der: "writeVarlengthDER",
    leb128: "writeVarlengthLEB128",
    ebml: "writeVarlengthEBML",
    vlq: "writeVarlengthVLQ"
  };
  return methodMap[encoding] || "writeVarlengthDER";
}
function convertConditionalToTypeScript(condition, basePath) {
  if (typeof condition === "string") {
    return `${basePath}.${condition}`;
  } else if (typeof condition === "object" && condition !== null) {
    return JSON.stringify(condition);
  }
  return String(condition);
}
function generateFieldEncodingToBytes(field, schema, globalEndianness, indent, baseObjectPath, lengthFieldName, computedVar, containingFields) {
  const fieldAny = field;
  const fieldName = fieldAny.name;
  const valuePath = `${baseObjectPath}.${fieldName}`;
  const tempEncoderVar = `${fieldName}_temp`;
  const bytesVar = `${fieldName}_bytes`;
  let code = "";
  const isCompositeType = schema.types && schema.types[fieldAny.type];
  if (fieldAny.conditional) {
    const condition = fieldAny.conditional;
    const tsCondition = convertConditionalToTypeScript(condition, baseObjectPath);
    code += `${indent}if (${tsCondition} && ${valuePath} !== undefined) {
`;
    const innerCode = generateFieldEncodingToBytesCore(field, schema, globalEndianness, indent + "  ", baseObjectPath, lengthFieldName, containingFields, tempEncoderVar, bytesVar, computedVar, valuePath, isCompositeType);
    code += innerCode;
    code += `${indent}}

`;
  } else {
    code += generateFieldEncodingToBytesCore(field, schema, globalEndianness, indent, baseObjectPath, lengthFieldName, containingFields, tempEncoderVar, bytesVar, computedVar, valuePath, isCompositeType);
  }
  return code;
}
function generateFieldEncodingToBytesCore(field, schema, globalEndianness, indent, baseObjectPath, lengthFieldName, containingFields, tempEncoderVar, bytesVar, computedVar, valuePath, isCompositeType) {
  const fieldAny = field;
  const fieldName = fieldAny.name;
  let code = "";
  if (isCompositeType) {
    const typeName = fieldAny.type;
    code += `${indent}// Encode ${fieldName} (composite type: ${typeName})
`;
    code += `${indent}{
`;
    code += `${indent}  const ${tempEncoderVar} = new ${typeName}Encoder();
`;
    code += `${indent}  const ${bytesVar} = ${tempEncoderVar}.encode(${valuePath});
`;
    code += `${indent}  ${lengthFieldName}_contentPieces.push(${bytesVar});
`;
    code += `${indent}  ${computedVar} += ${bytesVar}.length;
`;
    code += `${indent}}

`;
    return code;
  }
  if (fieldAny.type === "array") {
    code += `${indent}// Encode ${fieldName} (array)
`;
    code += `${indent}{
`;
    code += `${indent}  const ${tempEncoderVar} = new BitStreamEncoder();
`;
    const items = fieldAny.items;
    const itemType = items?.type;
    if (fieldAny.kind === "byte_length_prefixed") {
      code += `${indent}  const arrayTemp = new BitStreamEncoder();
`;
      code += `${indent}  for (const item of ${valuePath}) {
`;
      const isItemComposite = schema.types && schema.types[itemType];
      const isItemChoice = itemType === "choice";
      if (isItemComposite) {
        code += `${indent}    const itemEncoder = new ${itemType}Encoder();
`;
        code += `${indent}    const itemBytes = itemEncoder.encode(item);
`;
        code += `${indent}    arrayTemp.writeBytes(itemBytes);
`;
      } else if (isItemChoice) {
        const choices = items.choices || [];
        code += `${indent}    // Choice item - check type and encode
`;
        for (let i = 0;i < choices.length; i++) {
          const choice = choices[i];
          const ifKeyword = i === 0 ? "if" : "} else if";
          code += `${indent}    ${ifKeyword} (item.type === '${choice.type}') {
`;
          code += `${indent}      const itemEncoder = new ${choice.type}Encoder();
`;
          code += `${indent}      const itemBytes = itemEncoder.encode(item);
`;
          code += `${indent}      arrayTemp.writeBytes(itemBytes);
`;
        }
        if (choices.length > 0) {
          code += `${indent}    } else {
`;
          code += `${indent}      throw new Error(\`Unknown choice type: \${(item as any).type}\`);
`;
          code += `${indent}    }
`;
        }
      } else {
        code += `${indent}    // Primitive item type ${itemType} - not yet implemented for arrays in from_after_field
`;
        code += `${indent}    throw new Error("Primitive array items in from_after_field not yet supported");
`;
      }
      code += `${indent}  }
`;
      code += `${indent}  const arrayBytes = arrayTemp.finish();
`;
      code += `${indent}  const arrayLength = arrayBytes.length;

`;
      const lengthType = fieldAny.length_type || "varlength";
      const lengthEncoding = fieldAny.length_encoding || "der";
      if (lengthType === "varlength") {
        const lengthMethod = getVarlengthWriteMethod(lengthEncoding);
        code += `${indent}  ${tempEncoderVar}.${lengthMethod}(arrayLength);
`;
      } else {
        code += `${indent}  // Fixed-size length type ${lengthType}
`;
        code += `${indent}  throw new Error("Fixed-size length types in arrays not yet supported in from_after_field");
`;
      }
      code += `${indent}  ${tempEncoderVar}.writeBytes(arrayBytes);
`;
    } else {
      code += `${indent}  throw new Error("Array kind '${fieldAny.kind}' not yet supported in from_after_field");
`;
    }
    code += `${indent}  const ${bytesVar} = ${tempEncoderVar}.finish();
`;
    code += `${indent}  ${lengthFieldName}_contentPieces.push(${bytesVar});
`;
    code += `${indent}  ${computedVar} += ${bytesVar}.length;
`;
    code += `${indent}}

`;
    return code;
  }
  code += `${indent}// Encode ${fieldName}
`;
  code += `${indent}{
`;
  code += `${indent}  const ${tempEncoderVar} = new BitStreamEncoder();
`;
  if (fieldAny.computed) {
    code += generateComputedFieldToTempEncoder(field, schema, globalEndianness, indent + "  ", baseObjectPath, tempEncoderVar, containingFields);
  } else if (fieldAny.const !== undefined) {
    code += generatePrimitiveEncoding(field, globalEndianness, indent + "  ", tempEncoderVar, fieldAny.const.toString());
  } else {
    code += generatePrimitiveEncoding(field, globalEndianness, indent + "  ", tempEncoderVar, valuePath);
  }
  code += `${indent}  const ${bytesVar} = ${tempEncoderVar}.finish();
`;
  code += `${indent}  ${lengthFieldName}_contentPieces.push(${bytesVar});
`;
  code += `${indent}  ${computedVar} += ${bytesVar}.length;
`;
  code += `${indent}}

`;
  return code;
}
function generatePrimitiveEncoding(field, globalEndianness, indent, encoderVar, valuePath) {
  const fieldAny = field;
  const endianness = fieldAny.endianness || globalEndianness;
  let code = "";
  switch (fieldAny.type) {
    case "bit":
      code += `${indent}${encoderVar}.writeBits(${valuePath}, ${fieldAny.size});
`;
      break;
    case "uint8":
      code += `${indent}${encoderVar}.writeUint8(${valuePath});
`;
      break;
    case "uint16":
      code += `${indent}${encoderVar}.writeUint16(${valuePath}, "${endianness}");
`;
      break;
    case "uint32":
      code += `${indent}${encoderVar}.writeUint32(${valuePath}, "${endianness}");
`;
      break;
    case "uint64":
      code += `${indent}${encoderVar}.writeUint64(BigInt(${valuePath}), "${endianness}");
`;
      break;
    case "int8":
      code += `${indent}${encoderVar}.writeInt8(${valuePath});
`;
      break;
    case "int16":
      code += `${indent}${encoderVar}.writeInt16(${valuePath}, "${endianness}");
`;
      break;
    case "int32":
      code += `${indent}${encoderVar}.writeInt32(${valuePath}, "${endianness}");
`;
      break;
    case "int64":
      code += `${indent}${encoderVar}.writeInt64(BigInt(${valuePath}), "${endianness}");
`;
      break;
    case "float32":
      code += `${indent}${encoderVar}.writeFloat32(${valuePath}, "${endianness}");
`;
      break;
    case "float64":
      code += `${indent}${encoderVar}.writeFloat64(${valuePath}, "${endianness}");
`;
      break;
    case "string":
      code += `${indent}{
`;
      code += `${indent}  const encoder = new TextEncoder();
`;
      code += `${indent}  const bytes = encoder.encode(${valuePath});
`;
      code += `${indent}  for (const byte of bytes) {
`;
      code += `${indent}    ${encoderVar}.writeUint8(byte);
`;
      code += `${indent}  }
`;
      code += `${indent}}
`;
      break;
    case "varlength": {
      const encoding = fieldAny.encoding || "der";
      const method = getVarlengthWriteMethod(encoding);
      code += `${indent}${encoderVar}.${method}(${valuePath});
`;
      break;
    }
    case "array":
      throw new Error(`Array field '${field.name}' within from_after_field requires composite type encoding. This is a known limitation - arrays should be wrapped in a separate type.`);
    default:
      throw new Error(`Unknown primitive type for field encoding to bytes: ${fieldAny.type}`);
  }
  return code;
}
function generateComputedFieldToTempEncoder(field, schema, globalEndianness, indent, baseObjectPath, encoderVar, containingFields) {
  const fieldAny = field;
  const computed = fieldAny.computed;
  const normalCode = generateEncodeComputedField(field, schema, globalEndianness, indent, baseObjectPath, undefined, containingFields);
  const redirectedCode = normalCode.replace(/\bthis\./g, `${encoderVar}.`);
  return redirectedCode;
}
function getVarlengthReadMethod(encoding) {
  const methodMap = {
    der: "readVarlengthDER",
    leb128: "readVarlengthLEB128",
    ebml: "readVarlengthEBML",
    vlq: "readVarlengthVLQ"
  };
  return methodMap[encoding] || "readVarlengthDER";
}
function resolveComputedFieldPath(target, baseObjectPath = "value") {
  if (!target.startsWith("../")) {
    return `${baseObjectPath}.${target}`;
  }
  let levelsUp = 0;
  let remainingPath = target;
  while (remainingPath.startsWith("../")) {
    levelsUp++;
    remainingPath = remainingPath.slice(3);
  }
  let currentPath = baseObjectPath;
  let parentsNeeded = 0;
  for (let i = 0;i < levelsUp; i++) {
    const lastDot = currentPath.lastIndexOf(".");
    if (lastDot > 0) {
      currentPath = currentPath.substring(0, lastDot);
    } else {
      parentsNeeded++;
    }
  }
  if (parentsNeeded > 0) {
    return `context.parents[context.parents.length - ${parentsNeeded}].${remainingPath}`;
  }
  return `${currentPath}.${remainingPath}`;
}
function parseCorrespondingTarget(target) {
  const match = target.match(/(?:\.\.\/)*([^[]+)\[corresponding<(\w+)>\]/);
  if (!match)
    return null;
  return {
    arrayPath: match[1],
    filterType: match[2]
  };
}
function parseFirstLastTarget(target) {
  const match = target.match(/(?:\.\.\/)*([^[]+)\[(first|last)<(\w+)>\]/);
  if (!match)
    return null;
  return {
    arrayPath: match[1],
    filterType: match[3],
    selector: match[2]
  };
}
function detectCorrespondingTracking(field, schema) {
  const itemsType = field.items?.type;
  if (itemsType !== "choice")
    return null;
  const choices = field.items?.choices || [];
  const typesNeedingTracking = new Set;
  for (const choice of choices) {
    const choiceTypeDef = schema.types[choice.type];
    if (!choiceTypeDef)
      continue;
    const fields = getTypeFields(choiceTypeDef);
    for (const f of fields) {
      const fAny = f;
      if (fAny.computed?.type === "position_of") {
        const sameIndexInfo = parseCorrespondingTarget(fAny.computed.target);
        if (sameIndexInfo) {
          typesNeedingTracking.add(sameIndexInfo.filterType);
        }
      }
    }
  }
  return typesNeedingTracking.size > 0 ? typesNeedingTracking : null;
}
function detectFirstLastTracking(arrayFieldName, schema) {
  const typesNeedingTracking = new Set;
  for (const typeName in schema.types) {
    const typeDef = schema.types[typeName];
    const fields = getTypeFields(typeDef);
    for (const field of fields) {
      const fAny = field;
      if (fAny.computed?.type === "position_of") {
        const firstLastInfo = parseFirstLastTarget(fAny.computed.target);
        if (firstLastInfo && firstLastInfo.arrayPath === arrayFieldName) {
          typesNeedingTracking.add(firstLastInfo.filterType);
        }
      }
    }
  }
  return typesNeedingTracking;
}
function generateRuntimeSizeComputation(targetPath, globalEndianness, indent) {
  const sizeVar = `${targetPath.replace(/[^a-zA-Z0-9_]/g, "_")}_size`;
  let code = "";
  code += `${indent}// Compute encoded size of ${targetPath}
`;
  code += `${indent}const ${sizeVar}_temp = new BitStreamEncoder("${globalEndianness === "big_endian" ? "msb_first" : "lsb_first"}");
`;
  code += `${indent}const ${sizeVar}_val = ${targetPath};
`;
  code += `${indent}if (Array.isArray(${sizeVar}_val)) {
`;
  code += `${indent}  // Encode array elements
`;
  code += `${indent}  for (const item of ${sizeVar}_val) {
`;
  code += `${indent}    if (typeof item === 'number') {
`;
  code += `${indent}      if (Number.isInteger(item)) {
`;
  code += `${indent}        if (item >= 0 && item <= 255) {
`;
  code += `${indent}          ${sizeVar}_temp.writeUint8(item);
`;
  code += `${indent}        } else if (item >= 0 && item <= 65535) {
`;
  code += `${indent}          ${sizeVar}_temp.writeUint16(item, "${globalEndianness}");
`;
  code += `${indent}        } else {
`;
  code += `${indent}          ${sizeVar}_temp.writeUint32(item, "${globalEndianness}");
`;
  code += `${indent}        }
`;
  code += `${indent}      } else {
`;
  code += `${indent}        ${sizeVar}_temp.writeFloat64(item, "${globalEndianness}");
`;
  code += `${indent}      }
`;
  code += `${indent}    } else if (typeof item === 'bigint') {
`;
  code += `${indent}      ${sizeVar}_temp.writeUint64(item, "${globalEndianness}");
`;
  code += `${indent}    } else if (typeof item === 'object') {
`;
  code += `${indent}      // TODO: Handle array of objects/structs
`;
  code += `${indent}    }
`;
  code += `${indent}  }
`;
  code += `${indent}} else if (typeof ${sizeVar}_val === 'string') {
`;
  code += `${indent}  // Encode string
`;
  code += `${indent}  const encoder = new TextEncoder();
`;
  code += `${indent}  const bytes = encoder.encode(${sizeVar}_val);
`;
  code += `${indent}  for (const byte of bytes) {
`;
  code += `${indent}    ${sizeVar}_temp.writeUint8(byte);
`;
  code += `${indent}  }
`;
  code += `${indent}} else if (typeof ${sizeVar}_val === 'object' && ${sizeVar}_val !== null) {
`;
  code += `${indent}  // TODO: Handle struct encoding
`;
  code += `${indent}}
`;
  code += `${indent}const ${sizeVar} = ${sizeVar}_temp.byteOffset;
`;
  return { code, sizeVar };
}
function getFieldSize(field, schema) {
  const fieldSizeMap = {
    uint8: 1,
    int8: 1,
    uint16: 2,
    int16: 2,
    uint32: 4,
    int32: 4,
    float32: 4,
    uint64: 8,
    int64: 8,
    float64: 8
  };
  if (fieldSizeMap[field.type]) {
    return fieldSizeMap[field.type];
  }
  if (schema && field.type && schema.types[field.type]) {
    const typeDef = schema.types[field.type];
    const typeFields = getTypeFields(typeDef);
    let totalSize = 0;
    for (const f of typeFields) {
      totalSize += getFieldSize(f, schema);
    }
    return totalSize;
  }
  return 0;
}
function generateEncodeComputedField(field, schema, globalEndianness, indent, currentItemVar, containingTypeName, containingFields) {
  if (!("type" in field))
    return "";
  const fieldAny = field;
  const computed = fieldAny.computed;
  const fieldName = field.name;
  const baseObjectPath = currentItemVar || "value";
  const endianness = "endianness" in field && field.endianness ? field.endianness : globalEndianness;
  let code = "";
  if (computed.type === "sum_of_type_sizes") {
    const target = computed.target || "";
    const elementType = computed.element_type || "";
    const computedVar = makeUniqueComputedVar(fieldName);
    code += `${indent}// Computed field '${fieldName}': auto-compute sum of sizes for elements of type '${elementType}'
`;
    code += `${indent}let ${computedVar} = 0;
`;
    const targetPath = resolveComputedFieldPath(target, baseObjectPath);
    code += `${indent}if (Array.isArray(${targetPath})) {
`;
    code += `${indent}  for (const item of ${targetPath}) {
`;
    code += `${indent}    // Check if this item matches the target type
`;
    code += `${indent}    if (!item.type || item.type === '${elementType}') {
`;
    code += `${indent}      // Encode item using ${elementType}Encoder to measure size (pass context for computed fields)
`;
    code += `${indent}      const encoder_${fieldName} = new ${elementType}Encoder();
`;
    code += `${indent}      const encoded_${fieldName} = encoder_${fieldName}.encode(item as ${elementType}, context);
`;
    code += `${indent}      ${computedVar} += encoded_${fieldName}.length;
`;
    code += `${indent}    }
`;
    code += `${indent}  }
`;
    code += `${indent}}
`;
    switch (field.type) {
      case "uint8":
        code += `${indent}this.writeUint8(${computedVar});
`;
        break;
      case "uint16":
        code += `${indent}this.writeUint16(${computedVar}, "${endianness}");
`;
        break;
      case "uint32":
        code += `${indent}this.writeUint32(${computedVar}, "${endianness}");
`;
        break;
      case "uint64":
        code += `${indent}this.writeUint64(BigInt(${computedVar}), "${endianness}");
`;
        break;
      case "varlength": {
        const encoding = fieldAny.encoding || "der";
        const methodName = getVarlengthWriteMethod(encoding);
        code += `${indent}this.${methodName}(${computedVar});
`;
        break;
      }
      default:
        throw new Error(`Computed field '${fieldName}' (sum_of_type_sizes) has unsupported type '${field.type}'. Supported types: uint8, uint16, uint32, uint64, varlength`);
    }
  } else if (computed.type === "sum_of_sizes") {
    const targets = computed.targets || [];
    const computedVar = makeUniqueComputedVar(fieldName);
    code += `${indent}// Computed field '${fieldName}': auto-compute sum of sizes for ${targets.length} target(s)
`;
    code += `${indent}let ${computedVar} = 0;
`;
    for (const target of targets) {
      const targetPath = resolveComputedFieldPath(target, baseObjectPath);
      const { code: sizeCode, sizeVar } = generateRuntimeSizeComputation(targetPath, globalEndianness, indent);
      code += sizeCode;
      code += `${indent}${computedVar} += ${sizeVar};
`;
    }
    switch (field.type) {
      case "uint8":
        code += `${indent}this.writeUint8(${computedVar});
`;
        break;
      case "uint16":
        code += `${indent}this.writeUint16(${computedVar}, "${endianness}");
`;
        break;
      case "uint32":
        code += `${indent}this.writeUint32(${computedVar}, "${endianness}");
`;
        break;
      case "uint64":
        code += `${indent}this.writeUint64(BigInt(${computedVar}), "${endianness}");
`;
        break;
      case "varlength": {
        const encoding = fieldAny.encoding || "der";
        const methodName = getVarlengthWriteMethod(encoding);
        code += `${indent}this.${methodName}(${computedVar});
`;
        break;
      }
      default:
        throw new Error(`Computed field '${fieldName}' (sum_of_sizes) has unsupported type '${field.type}'. Supported types: uint8, uint16, uint32, uint64, varlength`);
    }
  } else if (computed.type === "length_of") {
    const fromAfterField = computed.from_after_field;
    const computedVar = makeUniqueComputedVar(fieldName);
    if (fromAfterField) {
      if (!containingFields) {
        throw new Error(`Computed field '${fieldName}' uses from_after_field but containingFields not provided to code generator`);
      }
      const fromAfterIndex = containingFields.findIndex((f) => f.name === fromAfterField);
      if (fromAfterIndex === -1) {
        throw new Error(`Computed field '${fieldName}' references from_after_field '${fromAfterField}' which doesn't exist in type`);
      }
      const currentFieldIndex = containingFields.findIndex((f) => f.name === fieldName);
      const fieldsAfter = containingFields.slice(fromAfterIndex + 1);
      code += `${indent}// Computed field '${fieldName}': content-first encoding for all fields after '${fromAfterField}'
`;
      code += `${indent}// Step 1: Encode all content fields FIRST to get actual byte lengths
`;
      code += `${indent}const ${fieldName}_contentPieces: Uint8Array[] = [];
`;
      code += `${indent}let ${computedVar} = 0;

`;
      let skipUntilIndex = -1;
      for (let i = 0;i < fieldsAfter.length; i++) {
        const afterField = fieldsAfter[i];
        const afterFieldAny = afterField;
        if (afterFieldAny.name === fieldName) {
          continue;
        }
        if (i <= skipUntilIndex) {
          continue;
        }
        if (afterFieldAny.computed?.type === "length_of" && afterFieldAny.computed.from_after_field) {
          skipUntilIndex = fieldsAfter.length - 1;
        }
        code += generateFieldEncodingToBytes(afterFieldAny, schema, globalEndianness, indent, baseObjectPath, fieldName, computedVar, containingFields);
      }
      code += `${indent}// Step 2: Write the length based on actual encoded content size
`;
      switch (field.type) {
        case "varlength": {
          const encoding = fieldAny.encoding || "der";
          const methodName = getVarlengthWriteMethod(encoding);
          code += `${indent}this.${methodName}(${computedVar});

`;
          break;
        }
        default:
          throw new Error(`Computed field '${fieldName}' with from_after_field has unsupported type '${field.type}'. Only varlength is currently supported for from_after_field.`);
      }
      code += `${indent}// Step 3: Write the actual content
`;
      code += `${indent}for (const piece of ${fieldName}_contentPieces) {
`;
      code += `${indent}  this.writeBytes(piece);
`;
      code += `${indent}}
`;
      return code;
    }
    const targetField = computed.target;
    const sameIndexInfo = targetField ? parseCorrespondingTarget(targetField) : null;
    const firstLastInfo = targetField ? parseFirstLastTarget(targetField) : null;
    code += `${indent}// Computed field '${fieldName}': auto-compute length_of '${targetField}'
`;
    code += `${indent}let ${computedVar}: number;
`;
    if (sameIndexInfo) {
      const { arrayPath, filterType } = sameIndexInfo;
      const remainingPath = targetField.substring(targetField.indexOf("]") + 1);
      code += `${indent}// Check if array iteration context is available
`;
      code += `${indent}if (!context.arrayIterations.${arrayPath}) {
`;
      code += `${indent}  throw new Error("Field '${fieldName}' uses corresponding correlation which requires encoding within an array context for '${arrayPath}'");
`;
      code += `${indent}}
`;
      code += `${indent}// Check if this is same-array type correlation or cross-array index correlation
`;
      code += `${indent}const ${fieldName}_currentItemType = ${baseObjectPath}.type;
`;
      code += `${indent}if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} currentItemType:', ${fieldName}_currentItemType, 'has in typeIndices:', context.arrayIterations.${arrayPath}.typeIndices.has(${fieldName}_currentItemType));
`;
      code += `${indent}const ${fieldName}_isSameArrayCorrelation = ${fieldName}_currentItemType !== undefined && ` + `context.arrayIterations.${arrayPath}.typeIndices.has(${fieldName}_currentItemType);
`;
      code += `${indent}if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} isSameArrayCorrelation:', ${fieldName}_isSameArrayCorrelation);
`;
      code += `${indent}let ${fieldName}_correlationIndex: number;
`;
      code += `${indent}if (${fieldName}_isSameArrayCorrelation) {
`;
      code += `${indent}  // Same-array correlation: use type-occurrence index
`;
      code += `${indent}  const ${fieldName}_typeOccurrenceIndex = context.arrayIterations.${arrayPath}.typeIndices.get(${fieldName}_currentItemType) ?? 0;
`;
      code += `${indent}  if (${fieldName}_typeOccurrenceIndex === 0) {
`;
      code += `${indent}    throw new Error(\`Field '${fieldName}' uses corresponding correlation but current type '\${${fieldName}_currentItemType}' has not been seen yet in '${arrayPath}'\`);
`;
      code += `${indent}  }
`;
      code += `${indent}  // Subtract 1 because counter was incremented after we started encoding this item
`;
      code += `${indent}  ${fieldName}_correlationIndex = ${fieldName}_typeOccurrenceIndex - 1;
`;
      code += `${indent}  if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} same-array correlationIndex:', ${fieldName}_correlationIndex);
`;
      code += `${indent}} else {
`;
      code += `${indent}  // Cross-array correlation: use current array index
`;
      code += `${indent}  // Find which array we're currently in
`;
      code += `${indent}  let ${fieldName}_currentArrayIndex = -1;
`;
      code += `${indent}  for (const [arrayName, arrayInfo] of Object.entries(context.arrayIterations)) {
`;
      code += `${indent}    if (arrayName !== '${arrayPath}' && arrayInfo.items.includes(${baseObjectPath})) {
`;
      code += `${indent}      ${fieldName}_currentArrayIndex = arrayInfo.index;
`;
      code += `${indent}      break;
`;
      code += `${indent}    }
`;
      code += `${indent}  }
`;
      code += `${indent}  if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} cross-array currentArrayIndex:', ${fieldName}_currentArrayIndex);
`;
      code += `${indent}  if (${fieldName}_currentArrayIndex === -1) {
`;
      code += `${indent}    throw new Error(\`Could not determine current array index for corresponding correlation\`);
`;
      code += `${indent}  }
`;
      code += `${indent}  ${fieldName}_correlationIndex = ${fieldName}_currentArrayIndex;
`;
      code += `${indent}}
`;
      code += `${indent}// Find the target array in parent context (search from outermost to innermost)
`;
      code += `${indent}let ${fieldName}_array: any;
`;
      code += `${indent}for (const parent of context.parents) {
`;
      code += `${indent}  if (parent.${arrayPath}) {
`;
      code += `${indent}    ${fieldName}_array = parent.${arrayPath};
`;
      code += `${indent}    break;
`;
      code += `${indent}  }
`;
      code += `${indent}}
`;
      code += `${indent}if (!${fieldName}_array) {
`;
      code += `${indent}  throw new Error(\`Array '${arrayPath}' not found in parent context\`);
`;
      code += `${indent}}
`;
      code += `${indent}let ${fieldName}_occurrenceCount = 0;
`;
      code += `${indent}let ${fieldName}_targetItem: any;
`;
      code += `${indent}if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} searching for ${filterType} at correlationIndex:', ${fieldName}_correlationIndex, 'in array of length:', ${fieldName}_array.length);
`;
      code += `${indent}for (const item of ${fieldName}_array) {
`;
      code += `${indent}  if (item.type === '${filterType}') {
`;
      code += `${indent}    if (${fieldName}_occurrenceCount === ${fieldName}_correlationIndex) {
`;
      code += `${indent}      ${fieldName}_targetItem = item;
`;
      code += `${indent}      if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} found target item at occurrence:', ${fieldName}_occurrenceCount);
`;
      code += `${indent}      break;
`;
      code += `${indent}    }
`;
      code += `${indent}    ${fieldName}_occurrenceCount++;
`;
      code += `${indent}  }
`;
      code += `${indent}}
`;
      code += `${indent}if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} targetItem:', ${fieldName}_targetItem, 'finalOccurrenceCount:', ${fieldName}_occurrenceCount);
`;
      code += `${indent}if (!${fieldName}_targetItem) {
`;
      code += `${indent}  if (${fieldName}_isSameArrayCorrelation) {
`;
      code += `${indent}    // Same-array type-occurrence correlation: looking for Nth occurrence of type
`;
      code += `${indent}    throw new Error(\`Could not find ${filterType} at occurrence index \${${fieldName}_correlationIndex} (index out of bounds: only \${${fieldName}_occurrenceCount} ${filterType} items found)\`);
`;
      code += `${indent}  } else {
`;
      code += `${indent}    // Cross-array index correlation: check if item exists at that array index
`;
      code += `${indent}    if (${fieldName}_array[${fieldName}_correlationIndex]) {
`;
      code += `${indent}      // Item exists but wrong type
`;
      code += `${indent}      const actualType = ${fieldName}_array[${fieldName}_correlationIndex].type;
`;
      code += `${indent}      throw new Error(\`Expected ${filterType} at ${arrayPath}[\${${fieldName}_correlationIndex}] but found \${actualType}\`);
`;
      code += `${indent}    } else {
`;
      code += `${indent}      // Array index out of bounds
`;
      code += `${indent}      throw new Error(\`Could not find ${filterType} at index \${${fieldName}_correlationIndex} (index out of bounds: array has \${${fieldName}_array.length} elements)\`);
`;
      code += `${indent}    }
`;
      code += `${indent}  }
`;
      code += `${indent}}
`;
      const targetPath = `${fieldName}_targetItem${remainingPath}`;
      if (computed.encoding) {
        code += `${indent}{
`;
        code += `${indent}  const encoder = new TextEncoder();
`;
        code += `${indent}  ${computedVar} = encoder.encode(${targetPath}).length;
`;
        code += `${indent}}
`;
      } else {
        let targetFieldDef = null;
        const targetFieldName = targetField.split("/")[0];
        if (containingFields) {
          targetFieldDef = containingFields.find((f) => f.name === targetFieldName);
        }
        const isCompositeType = targetFieldDef && targetFieldDef.type && schema.types[targetFieldDef.type] !== undefined && targetFieldDef.type !== "array";
        if (isCompositeType) {
          const typeName = targetFieldDef.type;
          code += `${indent}{
`;
          code += `${indent}  const ${fieldName}_encoder = new ${typeName}Encoder();
`;
          code += `${indent}  ${computedVar} = ${fieldName}_encoder.calculateSize(${targetPath});
`;
          code += `${indent}}
`;
        } else {
          code += `${indent}${computedVar} = (typeof ${targetPath} === 'number' || typeof ${targetPath} === 'bigint') ? ${targetPath} : ${targetPath}.length;
`;
        }
        const offset = computed.offset;
        if (offset !== undefined && offset !== 0) {
          code += `${indent}${computedVar} += ${offset}; // Apply offset
`;
        }
      }
    } else if (firstLastInfo) {
      const { arrayPath, filterType, selector } = firstLastInfo;
      const remainingPath = targetField.substring(targetField.indexOf("]") + 1);
      code += `${indent}// Look up ${selector} item from position tracking
`;
      code += `${indent}const ${fieldName}_positions_len = context.positions.get('${arrayPath}_${filterType}') || [];
`;
      code += `${indent}const targetIndex = ${fieldName}_positions_len.length > 0 ? ${selector === "first" ? "0" : `${fieldName}_positions_len.length - 1`} : undefined;
`;
      code += `${indent}if (targetIndex === undefined) throw new Error('${selector} ${filterType} not found in ${arrayPath}');
`;
      code += `${indent}const targetItem = ${baseObjectPath}.${arrayPath}[targetIndex];
`;
      const targetPath = `targetItem${remainingPath}`;
      if (computed.encoding) {
        code += `${indent}{
`;
        code += `${indent}  const encoder = new TextEncoder();
`;
        code += `${indent}  ${computedVar} = encoder.encode(${targetPath}).length;
`;
        code += `${indent}}
`;
      } else {
        let targetFieldDef = null;
        const targetFieldName = targetField.split("/")[0];
        if (containingFields) {
          targetFieldDef = containingFields.find((f) => f.name === targetFieldName);
        }
        const isCompositeType = targetFieldDef && targetFieldDef.type && schema.types[targetFieldDef.type] !== undefined && targetFieldDef.type !== "array";
        if (isCompositeType) {
          const typeName = targetFieldDef.type;
          code += `${indent}{
`;
          code += `${indent}  const ${fieldName}_encoder = new ${typeName}Encoder();
`;
          code += `${indent}  ${computedVar} = ${fieldName}_encoder.calculateSize(${targetPath});
`;
          code += `${indent}}
`;
        } else {
          code += `${computedVar} = (typeof ${targetPath} === 'number' || typeof ${targetPath} === 'bigint') ? ${targetPath} : ${targetPath}.length;
`;
        }
        const offset = computed.offset;
        if (offset !== undefined && offset !== 0) {
          code += `${indent}${computedVar} += ${offset}; // Apply offset
`;
        }
      }
    } else {
      const targetPath = resolveComputedFieldPath(targetField, baseObjectPath);
      if (targetPath.includes("context.parents")) {
        const parentAccessMatch = targetPath.match(/context\.parents\[context\.parents\.length - (\d+)\]\.(\w+)/);
        if (parentAccessMatch) {
          const levelsUp = parentAccessMatch[1];
          const parentFieldName = parentAccessMatch[2];
          code += `${indent}if (context.parents.length < ${levelsUp}) {
`;
          code += `${indent}  throw new Error(\`Cannot access parent field '${parentFieldName}': parent navigation exceeds available levels (need ${levelsUp}, have \${context.parents.length})\`);
`;
          code += `${indent}}
`;
          code += `${indent}if (!${targetPath.split(".").slice(0, -1).join(".")}) {
`;
          code += `${indent}  throw new Error(\`Cannot access parent field '${parentFieldName}': parent not found in context\`);
`;
          code += `${indent}}
`;
        }
      }
      if (computed.encoding) {
        code += `${indent}{
`;
        code += `${indent}  const encoder = new TextEncoder();
`;
        code += `${indent}  ${computedVar} = encoder.encode(${targetPath}).length;
`;
        code += `${indent}}
`;
      } else {
        let targetFieldDef = null;
        const targetFieldName = targetField.split("/")[0];
        if (containingFields) {
          targetFieldDef = containingFields.find((f) => f.name === targetFieldName);
        }
        const isCompositeType = targetFieldDef && targetFieldDef.type && schema.types[targetFieldDef.type] !== undefined && targetFieldDef.type !== "array";
        if (isCompositeType) {
          const typeName = targetFieldDef.type;
          code += `${indent}{
`;
          code += `${indent}  const ${fieldName}_encoder = new ${typeName}Encoder();
`;
          code += `${indent}  ${computedVar} = ${fieldName}_encoder.calculateSize(${targetPath});
`;
          code += `${indent}}
`;
        } else {
          code += `${indent}${computedVar} = (typeof ${targetPath} === 'number' || typeof ${targetPath} === 'bigint') ? ${targetPath} : ${targetPath}.length;
`;
        }
        const offset = computed.offset;
        if (offset !== undefined && offset !== 0) {
          code += `${indent}${computedVar} += ${offset}; // Apply offset
`;
        }
      }
    }
    switch (field.type) {
      case "uint8":
        code += `${indent}this.writeUint8(${computedVar});
`;
        break;
      case "uint16":
        code += `${indent}this.writeUint16(${computedVar}, "${endianness}");
`;
        break;
      case "uint32":
        code += `${indent}this.writeUint32(${computedVar}, "${endianness}");
`;
        break;
      case "uint64":
        code += `${indent}this.writeUint64(BigInt(${computedVar}), "${endianness}");
`;
        break;
      case "varlength":
        const encoding = fieldAny.encoding || "der";
        const methodName = getVarlengthWriteMethod(encoding);
        code += `${indent}this.${methodName}(${computedVar});
`;
        break;
      default:
        throw new Error(`Computed field '${fieldName}' has unsupported type '${field.type}'. Supported types: uint8, uint16, uint32, uint64, varlength`);
    }
  } else if (computed.type === "crc32_of") {
    const targetField = computed.target;
    const computedVar = makeUniqueComputedVar(fieldName);
    const sameIndexInfo = parseCorrespondingTarget(targetField);
    const firstLastInfo = parseFirstLastTarget(targetField);
    code += `${indent}// Computed field '${fieldName}': auto-compute CRC32 of '${targetField}'
`;
    if (sameIndexInfo) {
      const { arrayPath, filterType } = sameIndexInfo;
      const remainingPath = targetField.substring(targetField.indexOf("]") + 1);
      code += `${indent}// Check if array iteration context is available
`;
      code += `${indent}if (!context.arrayIterations.${arrayPath}) {
`;
      code += `${indent}  throw new Error("Field '${fieldName}' uses corresponding correlation which requires encoding within an array context for '${arrayPath}'");
`;
      code += `${indent}}
`;
      code += `${indent}// Check if this is same-array type correlation or cross-array index correlation
`;
      code += `${indent}const ${fieldName}_currentItemType = ${baseObjectPath}.type;
`;
      code += `${indent}if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} currentItemType:', ${fieldName}_currentItemType, 'has in typeIndices:', context.arrayIterations.${arrayPath}.typeIndices.has(${fieldName}_currentItemType));
`;
      code += `${indent}const ${fieldName}_isSameArrayCorrelation = ${fieldName}_currentItemType !== undefined && ` + `context.arrayIterations.${arrayPath}.typeIndices.has(${fieldName}_currentItemType);
`;
      code += `${indent}if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} isSameArrayCorrelation:', ${fieldName}_isSameArrayCorrelation);
`;
      code += `${indent}let ${fieldName}_correlationIndex: number;
`;
      code += `${indent}if (${fieldName}_isSameArrayCorrelation) {
`;
      code += `${indent}  // Same-array correlation: use type-occurrence index
`;
      code += `${indent}  const ${fieldName}_typeOccurrenceIndex = context.arrayIterations.${arrayPath}.typeIndices.get(${fieldName}_currentItemType) ?? 0;
`;
      code += `${indent}  if (${fieldName}_typeOccurrenceIndex === 0) {
`;
      code += `${indent}    throw new Error(\`Field '${fieldName}' uses corresponding correlation but current type '\${${fieldName}_currentItemType}' has not been seen yet in '${arrayPath}'\`);
`;
      code += `${indent}  }
`;
      code += `${indent}  // Subtract 1 because counter was incremented after we started encoding this item
`;
      code += `${indent}  ${fieldName}_correlationIndex = ${fieldName}_typeOccurrenceIndex - 1;
`;
      code += `${indent}  if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} same-array correlationIndex:', ${fieldName}_correlationIndex);
`;
      code += `${indent}} else {
`;
      code += `${indent}  // Cross-array correlation: use current array index
`;
      code += `${indent}  // Find which array we're currently in
`;
      code += `${indent}  let ${fieldName}_currentArrayIndex = -1;
`;
      code += `${indent}  for (const [arrayName, arrayInfo] of Object.entries(context.arrayIterations)) {
`;
      code += `${indent}    if (arrayName !== '${arrayPath}' && arrayInfo.items.includes(${baseObjectPath})) {
`;
      code += `${indent}      ${fieldName}_currentArrayIndex = arrayInfo.index;
`;
      code += `${indent}      break;
`;
      code += `${indent}    }
`;
      code += `${indent}  }
`;
      code += `${indent}  if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} cross-array currentArrayIndex:', ${fieldName}_currentArrayIndex);
`;
      code += `${indent}  if (${fieldName}_currentArrayIndex === -1) {
`;
      code += `${indent}    throw new Error(\`Could not determine current array index for corresponding correlation\`);
`;
      code += `${indent}  }
`;
      code += `${indent}  ${fieldName}_correlationIndex = ${fieldName}_currentArrayIndex;
`;
      code += `${indent}}
`;
      code += `${indent}// Find the target array in parent context (search from outermost to innermost)
`;
      code += `${indent}let ${fieldName}_array: any;
`;
      code += `${indent}for (const parent of context.parents) {
`;
      code += `${indent}  if (parent.${arrayPath}) {
`;
      code += `${indent}    ${fieldName}_array = parent.${arrayPath};
`;
      code += `${indent}    break;
`;
      code += `${indent}  }
`;
      code += `${indent}}
`;
      code += `${indent}if (!${fieldName}_array) {
`;
      code += `${indent}  throw new Error(\`Array '${arrayPath}' not found in parent context\`);
`;
      code += `${indent}}
`;
      code += `${indent}let ${fieldName}_occurrenceCount = 0;
`;
      code += `${indent}let ${fieldName}_targetItem: any;
`;
      code += `${indent}if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} searching for ${filterType} at correlationIndex:', ${fieldName}_correlationIndex, 'in array of length:', ${fieldName}_array.length);
`;
      code += `${indent}for (const item of ${fieldName}_array) {
`;
      code += `${indent}  if (item.type === '${filterType}') {
`;
      code += `${indent}    if (${fieldName}_occurrenceCount === ${fieldName}_correlationIndex) {
`;
      code += `${indent}      ${fieldName}_targetItem = item;
`;
      code += `${indent}      if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} found target item at occurrence:', ${fieldName}_occurrenceCount);
`;
      code += `${indent}      break;
`;
      code += `${indent}    }
`;
      code += `${indent}    ${fieldName}_occurrenceCount++;
`;
      code += `${indent}  }
`;
      code += `${indent}}
`;
      code += `${indent}if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} targetItem:', ${fieldName}_targetItem, 'finalOccurrenceCount:', ${fieldName}_occurrenceCount);
`;
      code += `${indent}if (!${fieldName}_targetItem) {
`;
      code += `${indent}  if (${fieldName}_isSameArrayCorrelation) {
`;
      code += `${indent}    // Same-array type-occurrence correlation: looking for Nth occurrence of type
`;
      code += `${indent}    throw new Error(\`Could not find ${filterType} at occurrence index \${${fieldName}_correlationIndex} (index out of bounds: only \${${fieldName}_occurrenceCount} ${filterType} items found)\`);
`;
      code += `${indent}  } else {
`;
      code += `${indent}    // Cross-array index correlation: check if item exists at that array index
`;
      code += `${indent}    if (${fieldName}_array[${fieldName}_correlationIndex]) {
`;
      code += `${indent}      // Item exists but wrong type
`;
      code += `${indent}      const actualType = ${fieldName}_array[${fieldName}_correlationIndex].type;
`;
      code += `${indent}      throw new Error(\`Expected ${filterType} at ${arrayPath}[\${${fieldName}_correlationIndex}] but found \${actualType}\`);
`;
      code += `${indent}    } else {
`;
      code += `${indent}      // Array index out of bounds
`;
      code += `${indent}      throw new Error(\`Could not find ${filterType} at index \${${fieldName}_correlationIndex} (index out of bounds: array has \${${fieldName}_array.length} elements)\`);
`;
      code += `${indent}    }
`;
      code += `${indent}  }
`;
      code += `${indent}}
`;
      const targetPath = `${fieldName}_targetItem${remainingPath}`;
      code += `${indent}const ${computedVar} = crc32(${targetPath});
`;
    } else if (firstLastInfo) {
      const { arrayPath, filterType, selector } = firstLastInfo;
      const remainingPath = targetField.substring(targetField.indexOf("]") + 1);
      code += `${indent}// Look up ${selector} item from position tracking
`;
      code += `${indent}const ${fieldName}_positions_crc = context.positions.get('${arrayPath}_${filterType}') || [];
`;
      code += `${indent}const targetIndex = ${fieldName}_positions_crc.length > 0 ? ${selector === "first" ? "0" : `${fieldName}_positions_crc.length - 1`} : undefined;
`;
      code += `${indent}if (targetIndex === undefined) throw new Error('${selector} ${filterType} not found in ${arrayPath}');
`;
      code += `${indent}const targetItem = ${baseObjectPath}.${arrayPath}[targetIndex];
`;
      const targetPath = `targetItem${remainingPath}`;
      code += `${indent}const ${computedVar} = crc32(${targetPath});
`;
    } else {
      const targetPath = resolveComputedFieldPath(targetField, baseObjectPath);
      if (targetPath.includes("context.parents")) {
        const parentAccessMatch = targetPath.match(/context\.parents\[context\.parents\.length - (\d+)\]\.(\w+)/);
        if (parentAccessMatch) {
          const levelsUp = parentAccessMatch[1];
          const parentFieldName = parentAccessMatch[2];
          code += `${indent}if (context.parents.length < ${levelsUp}) {
`;
          code += `${indent}  throw new Error(\`Cannot access parent field '${parentFieldName}': parent navigation exceeds available levels (need ${levelsUp}, have \${context.parents.length})\`);
`;
          code += `${indent}}
`;
          code += `${indent}if (!${targetPath.split(".").slice(0, -1).join(".")}) {
`;
          code += `${indent}  throw new Error(\`Cannot access parent field '${parentFieldName}': parent not found in context\`);
`;
          code += `${indent}}
`;
        }
      }
      code += `${indent}const ${computedVar} = crc32(${targetPath});
`;
    }
    code += `${indent}this.writeUint32(${computedVar}, "${endianness}");
`;
  } else if (computed.type === "position_of") {
    const computedVar = makeUniqueComputedVar(fieldName);
    const targetField = computed.target;
    const sameIndexInfo = parseCorrespondingTarget(targetField);
    const firstLastInfo = parseFirstLastTarget(targetField);
    if (sameIndexInfo) {
      const { arrayPath, filterType } = sameIndexInfo;
      code += `${indent}// Computed field '${fieldName}': auto-compute position of '${targetField}'
`;
      code += `${indent}// Look up position using corresponding correlation
`;
      code += `${indent}if (!context.arrayIterations?.${arrayPath}) {
`;
      code += `${indent}  throw new Error("Field '${fieldName}' uses corresponding correlation which requires encoding within an array context");
`;
      code += `${indent}}
`;
      const iterSuffixPos = baseObjectPath.indexOf(ARRAY_ITER_SUFFIX);
      const itemVarPattern = iterSuffixPos >= 0 ? baseObjectPath.substring(0, iterSuffixPos + ARRAY_ITER_SUFFIX.length) : baseObjectPath;
      code += `${indent}// Determine correlation index based on current item type
`;
      code += `${indent}const currentType = ${itemVarPattern}.type;
`;
      code += `${indent}// Check if this is same-array type correlation (target in same array) or cross-array index correlation
`;
      code += `${indent}const isSameArrayCorrelation = currentType !== undefined && context.arrayIterations.${arrayPath}?.typeIndices.has(currentType);
`;
      code += `${indent}let correlationIndex: number;
`;
      code += `${indent}if (isSameArrayCorrelation) {
`;
      code += `${indent}  // Same-array: use current type's occurrence index
`;
      code += `${indent}  const typeOccurrenceIndex = context.arrayIterations.${arrayPath}.typeIndices.get(currentType) ?? 0;
`;
      code += `${indent}  if (typeOccurrenceIndex === 0) {
`;
      code += `${indent}    throw new Error(\`Field '${fieldName}' uses corresponding correlation but current type '\${currentType}' has not been seen yet in '${arrayPath}'\`);
`;
      code += `${indent}  }
`;
      code += `${indent}  // Subtract 1 because counter was incremented after we started encoding this item
`;
      code += `${indent}  correlationIndex = typeOccurrenceIndex - 1;
`;
      code += `${indent}} else {
`;
      code += `${indent}  // Cross-array: use current array index
`;
      code += `${indent}  let currentArrayIndex = -1;
`;
      code += `${indent}  for (const [arrayName, arrayInfo] of Object.entries(context.arrayIterations)) {
`;
      code += `${indent}    if (arrayName !== '${arrayPath}' && arrayInfo.items.includes(${itemVarPattern})) {
`;
      code += `${indent}      currentArrayIndex = arrayInfo.index;
`;
      code += `${indent}      break;
`;
      code += `${indent}    }
`;
      code += `${indent}  }
`;
      code += `${indent}  if (currentArrayIndex === -1) {
`;
      code += `${indent}    throw new Error(\`Could not determine current array index for corresponding correlation\`);
`;
      code += `${indent}  }
`;
      code += `${indent}  correlationIndex = currentArrayIndex;
`;
      code += `${indent}}
`;
      code += `${indent}// Look up the position of the Nth ${filterType}
`;
      code += `${indent}const ${fieldName}_positions_array = context.positions.get('${arrayPath}_${filterType}') || [];
`;
      code += `${indent}if (process.env.DEBUG_TEST) console.log('[DEBUG] position_of ${fieldName}: positions array for ${arrayPath}_${filterType}:', ${fieldName}_positions_array, 'correlationIndex:', correlationIndex);
`;
      code += `${indent}const ${computedVar} = ${fieldName}_positions_array[correlationIndex];
`;
      code += `${indent}if (${computedVar} === undefined) {
`;
      code += `${indent}  throw new Error(\`corresponding correlation failed: no ${filterType} at occurrence index \${correlationIndex}\`);
`;
      code += `${indent}}
`;
    } else if (firstLastInfo) {
      const { arrayPath, filterType, selector } = firstLastInfo;
      code += `${indent}// Computed field '${fieldName}': auto-compute position of '${targetField}'
`;
      code += `${indent}// Look up ${selector} ${filterType} in ${arrayPath}
`;
      code += `${indent}const ${fieldName}_positions = context.positions.get('${arrayPath}_${filterType}') || [];
`;
      if (selector === "first") {
        code += `${indent}const ${computedVar} = ${fieldName}_positions.length > 0 ? ${fieldName}_positions[0] : 0xFFFFFFFF;
`;
      } else {
        code += `${indent}const ${computedVar} = ${fieldName}_positions.length > 0 ? ${fieldName}_positions[${fieldName}_positions.length - 1] : 0xFFFFFFFF;
`;
      }
    } else {
      code += `${indent}// Computed field '${fieldName}': auto-compute position of '${targetField}'
`;
      let sizeToTarget = 0;
      if (containingFields) {
        const currentFieldIndex = containingFields.findIndex((f) => f.name === fieldName);
        const targetFieldIndex = containingFields.findIndex((f) => f.name === targetField);
        if (currentFieldIndex >= 0 && targetFieldIndex >= 0) {
          for (let i = currentFieldIndex;i < targetFieldIndex; i++) {
            const f = containingFields[i];
            sizeToTarget += getFieldSize(f, schema);
          }
        } else {
          sizeToTarget = getFieldSize(field, schema);
        }
      } else {
        sizeToTarget = getFieldSize(field, schema);
      }
      code += `${indent}const ${computedVar} = this.byteOffset`;
      if (sizeToTarget > 0) {
        code += ` + ${sizeToTarget}`;
      }
      code += `;
`;
    }
    switch (field.type) {
      case "uint8":
        code += `${indent}this.writeUint8(${computedVar});
`;
        break;
      case "uint16":
        code += `${indent}this.writeUint16(${computedVar}, "${endianness}");
`;
        break;
      case "uint32":
        code += `${indent}this.writeUint32(${computedVar}, "${endianness}");
`;
        break;
      case "uint64":
        code += `${indent}this.writeUint64(BigInt(${computedVar}), "${endianness}");
`;
        break;
      case "varlength": {
        const encoding = fieldAny.encoding || "der";
        const methodName = getVarlengthWriteMethod(encoding);
        code += `${indent}this.${methodName}(${computedVar});
`;
        break;
      }
      default:
        throw new Error(`Computed field '${fieldName}' (position_of) has unsupported type '${field.type}'. Supported types: uint8, uint16, uint32, uint64, varlength`);
    }
  }
  return code;
}

// ../packages/binschema/src/generators/typescript/size-calculation.ts
function generateDERLengthSizeCalculation(valueExpr) {
  return `((${valueExpr}) < 128 ? 1 : 1 + Math.ceil(Math.log2(Math.max(1, ${valueExpr})) / 8))`;
}
function generateVLQLengthSizeCalculation(valueExpr) {
  return `((${valueExpr}) < 0x80 ? 1 : (${valueExpr}) < 0x4000 ? 2 : (${valueExpr}) < 0x200000 ? 3 : 4)`;
}
function generateFieldSizeCalculation(field, schema, globalEndianness, indent = "    ", valuePrefix = "value.", containingFields) {
  const fieldAny = field;
  const fieldName = fieldAny.name;
  let code = "";
  if (fieldAny.computed) {
    const computedType = fieldAny.computed.type;
    if (computedType === "length_of" || computedType === "position_of" || computedType === "count_of" || computedType === "crc32_of" || computedType === "sum_of_sizes" || computedType === "sum_of_type_sizes") {
      const fieldType2 = fieldAny.type;
      if (fieldType2 === "uint8" || fieldType2 === "int8") {
        code += `${indent}size += 1; // ${fieldName} (computed)
`;
      } else if (fieldType2 === "uint16" || fieldType2 === "int16") {
        code += `${indent}size += 2; // ${fieldName} (computed)
`;
      } else if (fieldType2 === "uint32" || fieldType2 === "int32" || fieldType2 === "float32") {
        code += `${indent}size += 4; // ${fieldName} (computed)
`;
      } else if (fieldType2 === "uint64" || fieldType2 === "int64" || fieldType2 === "float64") {
        code += `${indent}size += 8; // ${fieldName} (computed)
`;
      } else if (fieldType2 === "varlength") {
        const encoding = fieldAny.encoding || "der";
        if (encoding === "der") {
          if (fieldAny.computed.from_after_field) {
            code += `${indent}// ${fieldName} (from_after_field): handled by type-level encode()
`;
          } else if (computedType === "length_of") {
            const target = fieldAny.computed.target;
            const offset = fieldAny.computed.offset || 0;
            code += `${indent}// ${fieldName} (computed length_of ${target}${offset !== 0 ? `, offset ${offset}` : ""})
`;
            code += `${indent}{
`;
            code += `${indent}  // Calculate encoded size of target field to determine length field size
`;
            let targetFieldDef = null;
            if (containingFields) {
              targetFieldDef = containingFields.find((f) => f.name === target);
            }
            const isCompositeType = targetFieldDef && targetFieldDef.type && schema.types[targetFieldDef.type] !== undefined && targetFieldDef.type !== "array";
            if (isCompositeType) {
              const typeName = targetFieldDef.type;
              code += `${indent}  const ${fieldName}_encoder = new ${typeName}Encoder();
`;
              code += `${indent}  let ${fieldName}_targetSize = ${fieldName}_encoder.calculateSize(${valuePrefix}${target});
`;
              if (offset !== 0) {
                code += `${indent}  ${fieldName}_targetSize += ${offset}; // Apply offset
`;
              }
              code += `${indent}  size += ${generateDERLengthSizeCalculation(`${fieldName}_targetSize`)};
`;
            } else {
              code += `${indent}  let ${fieldName}_targetSize: number;
`;
              code += `${indent}  if (typeof ${valuePrefix}${target} === 'number' || typeof ${valuePrefix}${target} === 'bigint') {
`;
              code += `${indent}    ${fieldName}_targetSize = ${valuePrefix}${target} as number;
`;
              code += `${indent}  } else if (Array.isArray(${valuePrefix}${target})) {
`;
              code += `${indent}    ${fieldName}_targetSize = ${valuePrefix}${target}.length;
`;
              code += `${indent}  } else if (typeof ${valuePrefix}${target} === 'string') {
`;
              code += `${indent}    ${fieldName}_targetSize = new TextEncoder().encode(${valuePrefix}${target}).length;
`;
              code += `${indent}  } else {
`;
              code += `${indent}    throw new Error("Unknown target type for length_of computation");
`;
              code += `${indent}  }
`;
              if (offset !== 0) {
                code += `${indent}  ${fieldName}_targetSize += ${offset}; // Apply offset
`;
              }
              code += `${indent}  size += ${generateDERLengthSizeCalculation(`${fieldName}_targetSize`)};
`;
            }
            code += `${indent}}
`;
          } else if (computedType === "count_of") {
            code += `${indent}size += 1; // ${fieldName} (computed count_of) - assume short form DER
`;
          } else {
            code += `${indent}size += 1; // ${fieldName} (computed ${computedType}) - assume short form DER
`;
          }
        } else {
          code += `${indent}// TODO: Size calculation for ${encoding} varlength not yet implemented
`;
          code += `${indent}size += 1; // ${fieldName} (estimated)
`;
        }
      }
      return code;
    }
    return "";
  }
  const fieldType = fieldAny.type;
  if (fieldAny.const !== undefined) {
    switch (fieldType) {
      case "uint8":
      case "int8":
        code += `${indent}size += 1; // ${fieldName} (const)
`;
        return code;
      case "uint16":
      case "int16":
        code += `${indent}size += 2; // ${fieldName} (const)
`;
        return code;
      case "uint32":
      case "int32":
      case "float32":
        code += `${indent}size += 4; // ${fieldName} (const)
`;
        return code;
      case "uint64":
      case "int64":
      case "float64":
        code += `${indent}size += 8; // ${fieldName} (const)
`;
        return code;
      default:
        code += `${indent}size += 1; // ${fieldName} (const, assuming 1 byte)
`;
        return code;
    }
  }
  if (fieldAny.if) {
    code += `${indent}if (${fieldAny.if}) {
`;
    indent += "  ";
  }
  const isOptional = fieldType === "optional";
  if (isOptional) {
    code += `${indent}if (${valuePrefix}${fieldName} !== undefined) {
`;
    indent += "  ";
  }
  switch (fieldType) {
    case "uint8":
    case "int8":
      code += `${indent}size += 1; // ${fieldName}
`;
      break;
    case "uint16":
    case "int16":
      code += `${indent}size += 2; // ${fieldName}
`;
      break;
    case "uint32":
    case "int32":
    case "float32":
      code += `${indent}size += 4; // ${fieldName}
`;
      break;
    case "uint64":
    case "int64":
    case "float64":
      code += `${indent}size += 8; // ${fieldName}
`;
      break;
    case "varlength": {
      const encoding = fieldAny.encoding || "der";
      code += `${indent}// ${fieldName}: varlength (${encoding})
`;
      if (encoding === "der") {
        code += `${indent}size += ${generateDERLengthSizeCalculation(`${valuePrefix}${fieldName}`)};
`;
      } else if (encoding === "vlq") {
        code += `${indent}size += ${generateVLQLengthSizeCalculation(`${valuePrefix}${fieldName}`)};
`;
      } else {
        code += `${indent}// TODO: Implement size calculation for ${encoding} encoding
`;
        code += `${indent}throw new Error("Size calculation for ${encoding} varlength not yet implemented");
`;
      }
      break;
    }
    case "string": {
      const encoding = fieldAny.encoding || "utf8";
      code += `${indent}// ${fieldName}: string (${encoding})
`;
      if (encoding === "utf8") {
        code += `${indent}size += new TextEncoder().encode(${valuePrefix}${fieldName}).length;
`;
      } else if (encoding === "ascii" || encoding === "latin1") {
        code += `${indent}size += ${valuePrefix}${fieldName}.length;
`;
      } else {
        code += `${indent}throw new Error("Size calculation for ${encoding} string encoding not yet implemented");
`;
      }
      break;
    }
    case "array": {
      const arrayKind = fieldAny.kind;
      const items = fieldAny.items;
      code += `${indent}// ${fieldName}: array (kind: ${arrayKind})
`;
      if (arrayKind === "byte_length_prefixed") {
        const lengthType = fieldAny.length_type;
        const lengthEncoding = fieldAny.length_encoding;
        const uniqueSuffix = `_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        const itemsSizeVar = `${fieldName}_items_size${uniqueSuffix}`;
        code += `${indent}let ${itemsSizeVar} = 0;
`;
        if (items) {
          if (items.type === "uint8") {
            code += `${indent}${itemsSizeVar} += ${valuePrefix}${fieldName}.length;
`;
          } else if (items.type === "choice") {
            const choices = items.choices || [];
            code += `${indent}for (const item of ${valuePrefix}${fieldName}) {
`;
            for (let i = 0;i < choices.length; i++) {
              const choice = choices[i];
              const ifKeyword = i === 0 ? "if" : "} else if";
              code += `${indent}  ${ifKeyword} (item.type === '${choice.type}') {
`;
              code += `${indent}    const itemEncoder = new ${choice.type}Encoder();
`;
              code += `${indent}    ${itemsSizeVar} += itemEncoder.calculateSize(item as ${choice.type});
`;
            }
            if (choices.length > 0) {
              code += `${indent}  } else {
`;
              code += `${indent}    throw new Error(\`Unknown choice type: \${(item as any).type}\`);
`;
              code += `${indent}  }
`;
            }
            code += `${indent}}
`;
          } else {
            const itemTypeName = items.type;
            code += `${indent}for (const item of ${valuePrefix}${fieldName}) {
`;
            if (isBuiltInType(itemTypeName)) {
              code += `${indent}  ${itemsSizeVar} += ${getBuiltInTypeSize(itemTypeName)};
`;
            } else {
              code += `${indent}  const ${fieldName}_itemEncoder = new ${itemTypeName}Encoder();
`;
              code += `${indent}  ${itemsSizeVar} += ${fieldName}_itemEncoder.calculateSize(item);
`;
            }
            code += `${indent}}
`;
          }
        }
        if (lengthType === "uint8") {
          code += `${indent}size += 1; // length prefix (uint8)
`;
        } else if (lengthType === "uint16") {
          code += `${indent}size += 2; // length prefix (uint16)
`;
        } else if (lengthType === "uint32") {
          code += `${indent}size += 4; // length prefix (uint32)
`;
        } else if (lengthType === "uint64") {
          code += `${indent}size += 8; // length prefix (uint64)
`;
        } else if (lengthType === "varlength") {
          const encoding = lengthEncoding || "der";
          if (encoding === "der") {
            code += `${indent}size += ${generateDERLengthSizeCalculation(itemsSizeVar)}; // length prefix (DER)
`;
          } else {
            code += `${indent}throw new Error("Size calculation for ${encoding} varlength not yet implemented");
`;
          }
        }
        code += `${indent}size += ${itemsSizeVar}; // array items
`;
      } else {
        if (items) {
          if (items.type === "uint8") {
            code += `${indent}size += ${valuePrefix}${fieldName}.length;
`;
          } else if (items.type === "choice") {
            const choices = items.choices || [];
            code += `${indent}for (const item of ${valuePrefix}${fieldName}) {
`;
            for (let i = 0;i < choices.length; i++) {
              const choice = choices[i];
              const ifKeyword = i === 0 ? "if" : "} else if";
              code += `${indent}  ${ifKeyword} (item.type === '${choice.type}') {
`;
              code += `${indent}    const itemEncoder = new ${choice.type}Encoder();
`;
              code += `${indent}    size += itemEncoder.calculateSize(item as ${choice.type});
`;
            }
            if (choices.length > 0) {
              code += `${indent}  } else {
`;
              code += `${indent}    throw new Error(\`Unknown choice type: \${(item as any).type}\`);
`;
              code += `${indent}  }
`;
            }
            code += `${indent}}
`;
          } else {
            const itemTypeName = items.type;
            code += `${indent}for (const item of ${valuePrefix}${fieldName}) {
`;
            if (isBuiltInType(itemTypeName)) {
              code += `${indent}  size += ${getBuiltInTypeSize(itemTypeName)};
`;
            } else {
              code += `${indent}  const ${fieldName}_itemEncoder = new ${itemTypeName}Encoder();
`;
              code += `${indent}  size += ${fieldName}_itemEncoder.calculateSize(item);
`;
            }
            code += `${indent}}
`;
          }
        } else {
          code += `${indent}throw new Error("Array items not defined for ${fieldName}");
`;
        }
      }
      break;
    }
    default: {
      code += `${indent}// ${fieldName}: custom type (${fieldType})
`;
      code += `${indent}const ${fieldName}_encoder = new ${fieldType}Encoder();
`;
      code += `${indent}size += ${fieldName}_encoder.calculateSize(${valuePrefix}${fieldName});
`;
      break;
    }
  }
  if (isOptional) {
    indent = indent.substring(2);
    code += `${indent}}
`;
  }
  if (fieldAny.if) {
    indent = indent.substring(2);
    code += `${indent}}
`;
  }
  return code;
}
function isBuiltInType(typeName) {
  const builtIns = [
    "uint8",
    "uint16",
    "uint32",
    "uint64",
    "int8",
    "int16",
    "int32",
    "int64",
    "float32",
    "float64",
    "string",
    "varlength"
  ];
  return builtIns.includes(typeName);
}
function getBuiltInTypeSize(typeName) {
  switch (typeName) {
    case "uint8":
    case "int8":
      return 1;
    case "uint16":
    case "int16":
      return 2;
    case "uint32":
    case "int32":
    case "float32":
      return 4;
    case "uint64":
    case "int64":
    case "float64":
      return 8;
    default:
      return 0;
  }
}
function generateCalculateSizeMethod(typeName, fields, schema, globalEndianness, hasContext) {
  const contextParam = hasContext ? ", context?: EncodingContext" : "";
  const hasFromAfterField = fields.some((f) => {
    const fieldAny = f;
    return fieldAny.computed?.type === "length_of" && fieldAny.computed.from_after_field;
  });
  let code = `
  /**
`;
  code += `   * Calculate the encoded size of a ${typeName} value.
`;
  if (hasFromAfterField) {
    code += `   * This type uses from_after_field, so we encode to determine size.
`;
  } else {
    code += `   * Used for from_after_field computed lengths and buffer pre-allocation.
`;
  }
  code += `   */
`;
  code += `  calculateSize(value: ${typeName}${contextParam}): number {
`;
  if (hasFromAfterField) {
    code += `    // This type uses from_after_field - encode to get exact size
`;
    code += `    return this.encode(value${contextParam ? ", context" : ""}).length;
`;
  } else {
    code += `    let size = 0;
`;
    const isTypeAlias2 = fields.length === 1 && fields[0].name === "value";
    const valuePrefix = isTypeAlias2 ? "" : "value.";
    for (const field of fields) {
      code += generateFieldSizeCalculation(field, schema, globalEndianness, "    ", valuePrefix, fields);
    }
    code += `    return size;
`;
  }
  code += `  }
`;
  return code;
}

// ../packages/binschema/src/generators/typescript/back-references.ts
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function generateEncodeBackReference(field, schema, globalEndianness, valuePath, indent, generateEncodeTypeReference) {
  const storage = field.storage || "uint16";
  const offsetMask = field.offset_mask || "0x3FFF";
  const targetType = field.target_type;
  const endianness = field.endianness || globalEndianness;
  if (typeof targetType !== "string" || targetType.length === 0) {
    throw new Error([
      "Back-reference field is missing a valid 'target_type'.",
      `field: ${field?.name ?? "<unnamed>"}`,
      `valuePath: ${valuePath}`,
      `storage: ${storage}`
    ].join(" "));
  }
  let code = "";
  code += `${indent}const valueKey = JSON.stringify(${valuePath});
`;
  code += `${indent}// Use shared compression dict from context (if available) for cross-encoder compression
`;
  code += `${indent}const compressionDict = context?.compressionDict || this.compressionDict;
`;
  code += `${indent}const existingOffset = compressionDict.get(valueKey);

`;
  code += `${indent}if (existingOffset !== undefined) {
`;
  code += `${indent}  // Encode compression pointer: set top bits (0xC0 for uint16) and mask offset
`;
  if (storage === "uint8") {
    code += `${indent}  const referenceValue = 0xC0 | (existingOffset & ${offsetMask});
`;
    code += `${indent}  this.writeUint8(referenceValue);
`;
  } else if (storage === "uint16") {
    code += `${indent}  const referenceValue = 0xC000 | (existingOffset & ${offsetMask});
`;
    code += `${indent}  this.writeUint16(referenceValue, "${endianness}");
`;
  } else if (storage === "uint32") {
    code += `${indent}  const referenceValue = 0xC0000000 | (existingOffset & ${offsetMask});
`;
    code += `${indent}  this.writeUint32(referenceValue, "${endianness}");
`;
  }
  code += `${indent}} else {
`;
  code += `${indent}  // First occurrence - record absolute offset and encode target value
`;
  code += `${indent}  const currentOffset = (context?.byteOffset || 0) + this.byteOffset;
`;
  code += `${indent}  compressionDict.set(valueKey, currentOffset);
`;
  code += generateEncodeTypeReference(targetType, schema, globalEndianness, valuePath, indent + "  ");
  code += `${indent}}
`;
  return code;
}
function generateDecodeBackReference(field, schema, globalEndianness, fieldName, indent, getTargetPath, generateDecodeTypeReference) {
  const target = getTargetPath(fieldName);
  const storage = field.storage;
  const offsetMask = field.offset_mask;
  const offsetFrom = field.offset_from;
  const targetType = field.target_type;
  const endianness = field.endianness || globalEndianness;
  const endiannessArg = storage !== "uint8" ? `'${endianness}'` : "";
  let code = "";
  code += `${indent}if (!this.visitedOffsets) {
`;
  code += `${indent}  this.visitedOffsets = new Set<number>();
`;
  code += `${indent}}

`;
  if (storage === "uint8") {
    code += `${indent}const referenceValue = this.read${capitalize(storage)}();
`;
  } else {
    code += `${indent}const referenceValue = this.read${capitalize(storage)}(${endiannessArg});
`;
  }
  code += `${indent}const offset = referenceValue & ${offsetMask};

`;
  code += `${indent}if (this.visitedOffsets.has(offset)) {
`;
  code += `${indent}  throw new Error(\`Circular back_reference detected at offset \${offset}\`);
`;
  code += `${indent}}
`;
  code += `${indent}this.visitedOffsets.add(offset);

`;
  if (offsetFrom === "current_position") {
    code += `${indent}const currentPos = this.position;
`;
    code += `${indent}this.pushPosition();
`;
    code += `${indent}this.seek(currentPos + offset);
`;
  } else {
    code += `${indent}this.pushPosition();
`;
    code += `${indent}this.seek(offset);
`;
  }
  code += generateDecodeTypeReference(targetType, schema, globalEndianness, fieldName, indent);
  code += `${indent}this.popPosition();

`;
  code += `${indent}this.visitedOffsets.delete(offset);
`;
  return code;
}

// ../packages/binschema/src/generators/typescript/string-support.ts
function generateEncodeString(field, globalEndianness, valuePath, indent) {
  const encoding = field.encoding || "utf8";
  let kind = field.kind;
  let code = "";
  if (kind === "fixed" && field.length_field && !field.length) {
    kind = "field_referenced";
  }
  const bytesVarName = valuePath.replace(/\./g, "_") + "_bytes";
  if (encoding === "utf8") {
    code += `${indent}const ${bytesVarName} = new TextEncoder().encode(${valuePath});
`;
  } else if (encoding === "ascii" || encoding === "latin1") {
    code += `${indent}const ${bytesVarName} = Array.from(${valuePath}, c => c.charCodeAt(0));
`;
  }
  if (kind === "length_prefixed") {
    const lengthType = field.length_type || "uint8";
    switch (lengthType) {
      case "uint8":
        code += `${indent}this.writeUint8(${bytesVarName}.length);
`;
        break;
      case "uint16":
        code += `${indent}this.writeUint16(${bytesVarName}.length, "${globalEndianness}");
`;
        break;
      case "uint32":
        code += `${indent}this.writeUint32(${bytesVarName}.length, "${globalEndianness}");
`;
        break;
      case "uint64":
        code += `${indent}this.writeUint64(BigInt(${bytesVarName}.length), "${globalEndianness}");
`;
        break;
    }
    code += `${indent}for (const byte of ${bytesVarName}) {
`;
    code += `${indent}  this.writeUint8(byte);
`;
    code += `${indent}}
`;
  } else if (kind === "null_terminated") {
    code += `${indent}for (const byte of ${bytesVarName}) {
`;
    code += `${indent}  this.writeUint8(byte);
`;
    code += `${indent}}
`;
    code += `${indent}this.writeUint8(0);
`;
  } else if (kind === "fixed") {
    const fixedLength = field.length || 0;
    code += `${indent}for (let i = 0; i < ${fixedLength}; i++) {
`;
    code += `${indent}  this.writeUint8(i < ${bytesVarName}.length ? ${bytesVarName}[i] : 0);
`;
    code += `${indent}}
`;
  } else if (kind === "field_referenced") {
    code += `${indent}for (const byte of ${bytesVarName}) {
`;
    code += `${indent}  this.writeUint8(byte);
`;
    code += `${indent}}
`;
  }
  return code;
}
function generateDecodeString(field, globalEndianness, fieldName, indent, addTraceLogs, getTargetPath) {
  const encoding = field.encoding || "utf8";
  let kind = field.kind;
  const target = getTargetPath(fieldName);
  let code = "";
  if (addTraceLogs) {
    code += `${indent}console.log('[TRACE] Decoding string field ${fieldName}, kind: ${kind}, length_field: ${field.length_field}, length: ${field.length}');
`;
  }
  if (kind === "fixed" && field.length_field && !field.length) {
    kind = "field_referenced";
    if (addTraceLogs) {
      code += `${indent}console.log('[TRACE] Auto-detected field_referenced string for ${fieldName}');
`;
    }
  }
  if (kind === "length_prefixed") {
    const lengthType = field.length_type || "uint8";
    let lengthRead = "";
    switch (lengthType) {
      case "uint8":
        lengthRead = "this.readUint8()";
        break;
      case "uint16":
        lengthRead = `this.readUint16("${globalEndianness}")`;
        break;
      case "uint32":
        lengthRead = `this.readUint32("${globalEndianness}")`;
        break;
      case "uint64":
        lengthRead = `Number(this.readUint64("${globalEndianness}"))`;
        break;
    }
    const lengthVarName = fieldName.replace(/\./g, "_") + "_length";
    code += `${indent}const ${lengthVarName} = ${lengthRead};
`;
    const bytesVarName = fieldName.replace(/\./g, "_") + "_bytes";
    code += `${indent}const ${bytesVarName}: number[] = [];
`;
    code += `${indent}for (let i = 0; i < ${lengthVarName}; i++) {
`;
    code += `${indent}  ${bytesVarName}.push(this.readUint8());
`;
    code += `${indent}}
`;
    if (encoding === "utf8") {
      code += `${indent}${target} = new TextDecoder().decode(new Uint8Array(${bytesVarName}));
`;
    } else if (encoding === "ascii" || encoding === "latin1") {
      code += `${indent}${target} = String.fromCharCode(...${bytesVarName});
`;
    }
  } else if (kind === "null_terminated") {
    const bytesVarName = fieldName.replace(/\./g, "_") + "_bytes";
    code += `${indent}const ${bytesVarName}: number[] = [];
`;
    code += `${indent}while (true) {
`;
    code += `${indent}  const byte = this.readUint8();
`;
    code += `${indent}  if (byte === 0) break;
`;
    code += `${indent}  ${bytesVarName}.push(byte);
`;
    code += `${indent}}
`;
    if (encoding === "utf8") {
      code += `${indent}${target} = new TextDecoder().decode(new Uint8Array(${bytesVarName}));
`;
    } else if (encoding === "ascii" || encoding === "latin1") {
      code += `${indent}${target} = String.fromCharCode(...${bytesVarName});
`;
    }
  } else if (kind === "fixed") {
    const fixedLength = field.length || 0;
    const bytesVarName = fieldName.replace(/\./g, "_") + "_bytes";
    code += `${indent}const ${bytesVarName}: number[] = [];
`;
    code += `${indent}for (let i = 0; i < ${fixedLength}; i++) {
`;
    code += `${indent}  ${bytesVarName}.push(this.readUint8());
`;
    code += `${indent}}
`;
    code += `${indent}let actualLength = ${bytesVarName}.indexOf(0);
`;
    code += `${indent}if (actualLength === -1) actualLength = ${bytesVarName}.length;
`;
    if (encoding === "utf8") {
      code += `${indent}${target} = new TextDecoder().decode(new Uint8Array(${bytesVarName}.slice(0, actualLength)));
`;
    } else if (encoding === "ascii" || encoding === "latin1") {
      code += `${indent}${target} = String.fromCharCode(...${bytesVarName}.slice(0, actualLength));
`;
    }
  } else if (kind === "field_referenced") {
    const lengthField = field.length_field;
    const lengthVarName = fieldName.replace(/\./g, "_") + "_length";
    if (lengthField.startsWith("_root.")) {
      const rootPath = lengthField.substring(6);
      code += `${indent}const ${lengthVarName} = this.context?._root?.${rootPath};
`;
      code += `${indent}if (${lengthVarName} === undefined) {
`;
      code += `${indent}  throw new Error('Field-referenced string length field "${lengthField}" not found in context._root');
`;
      code += `${indent}}
`;
    } else {
      const isArrayItem = fieldName.endsWith(ARRAY_ITER_SUFFIX) || fieldName.includes(ARRAY_ITER_SUFFIX + ".");
      const parentPath = fieldName.includes(".") ? fieldName.substring(0, fieldName.lastIndexOf(".")) + "." : "";
      const fullLengthPath = parentPath + lengthField;
      if (isArrayItem) {
        code += `${indent}const ${lengthVarName} = ${fullLengthPath} ?? this.context?.${lengthField};
`;
      } else {
        code += `${indent}const ${lengthVarName} = value.${fullLengthPath} ?? this.context?.${lengthField};
`;
      }
      code += `${indent}if (${lengthVarName} === undefined) {
`;
      code += `${indent}  throw new Error('Field-referenced string length field "${lengthField}" not found in value or context');
`;
      code += `${indent}}
`;
    }
    const bytesVarName = fieldName.replace(/\./g, "_") + "_bytes";
    code += `${indent}const ${bytesVarName}: number[] = [];
`;
    code += `${indent}for (let i = 0; i < ${lengthVarName}; i++) {
`;
    code += `${indent}  ${bytesVarName}.push(this.readUint8());
`;
    code += `${indent}}
`;
    if (encoding === "utf8") {
      code += `${indent}${target} = new TextDecoder().decode(new Uint8Array(${bytesVarName}));
`;
    } else if (encoding === "ascii" || encoding === "latin1") {
      code += `${indent}${target} = String.fromCharCode(...${bytesVarName});
`;
    }
  }
  return code;
}

// ../packages/binschema/src/generators/typescript/context-analysis.ts
function analyzeContextRequirements(typeDef, schema, visitedTypes = new Set) {
  const requirements = {
    needsParentFields: new Set,
    needsArrayIterations: new Set,
    usesParentNavigation: false,
    usesBackReferences: false
  };
  const typeName = findTypeNameForDef(typeDef, schema);
  if (typeName && visitedTypes.has(typeName)) {
    return requirements;
  }
  if (typeName) {
    visitedTypes.add(typeName);
  }
  const typeDefAny = typeDef;
  if (typeDefAny.type === "back_reference") {
    requirements.usesBackReferences = true;
  }
  const fields = getTypeFields(typeDef);
  for (const field of fields) {
    const fieldAny = field;
    if (fieldAny.computed?.target) {
      analyzeComputedPath(fieldAny.computed.target, requirements);
    }
    if (fieldAny.computed?.targets && Array.isArray(fieldAny.computed.targets)) {
      for (const target of fieldAny.computed.targets) {
        analyzeComputedPath(target, requirements);
      }
    }
    if (fieldAny.type === "back_reference") {
      requirements.usesBackReferences = true;
    }
    if (fieldAny.type && typeof fieldAny.type === "string" && schema.types[fieldAny.type]) {
      const referencedType = schema.types[fieldAny.type];
      if (referencedType.type === "back_reference") {
        requirements.usesBackReferences = true;
      }
    }
    if (fieldAny.type && typeof fieldAny.type === "string" && schema.types[fieldAny.type]) {
      const nestedReqs = analyzeContextRequirements(schema.types[fieldAny.type], schema, visitedTypes);
      mergeRequirements(requirements, nestedReqs);
    }
    if (fieldAny.type === "array" && fieldAny.items) {
      if (fieldAny.items.type && typeof fieldAny.items.type === "string" && schema.types[fieldAny.items.type]) {
        const nestedReqs = analyzeContextRequirements(schema.types[fieldAny.items.type], schema, visitedTypes);
        mergeRequirements(requirements, nestedReqs);
      }
      if (fieldAny.items.type === "choice" && fieldAny.items.choices) {
        for (const choice of fieldAny.items.choices) {
          if (choice.type && schema.types[choice.type]) {
            const nestedReqs = analyzeContextRequirements(schema.types[choice.type], schema, visitedTypes);
            mergeRequirements(requirements, nestedReqs);
          }
        }
      }
    }
    if (fieldAny.type === "choice" && fieldAny.choices) {
      for (const choice of fieldAny.choices) {
        if (choice.type && schema.types[choice.type]) {
          const nestedReqs = analyzeContextRequirements(schema.types[choice.type], schema, visitedTypes);
          mergeRequirements(requirements, nestedReqs);
        }
      }
    }
  }
  return requirements;
}
function analyzeComputedPath(path, requirements) {
  if (path.includes("../")) {
    requirements.usesParentNavigation = true;
    const parentFieldMatches = path.matchAll(/\.\.\/([a-zA-Z_][a-zA-Z0-9_]*)/g);
    for (const match of parentFieldMatches) {
      requirements.needsParentFields.add(match[1]);
    }
  }
  if (path.includes("[corresponding<") || path.includes("[first<") || path.includes("[last<")) {
    const arrayMatches = path.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\[(?:corresponding|first|last)</g);
    for (const match of arrayMatches) {
      requirements.needsArrayIterations.add(match[1]);
    }
  }
}
function mergeRequirements(target, source) {
  source.needsParentFields.forEach((f) => target.needsParentFields.add(f));
  source.needsArrayIterations.forEach((a) => target.needsArrayIterations.add(a));
  target.usesParentNavigation ||= source.usesParentNavigation;
  target.usesBackReferences ||= source.usesBackReferences;
}
function findTypeNameForDef(typeDef, schema) {
  for (const [name, def] of Object.entries(schema.types)) {
    if (def === typeDef) {
      return name;
    }
  }
  return null;
}
function schemaRequiresContext(schema) {
  return Object.values(schema.types).some((typeDef) => {
    const reqs = analyzeContextRequirements(typeDef, schema);
    return reqs.usesParentNavigation || reqs.needsArrayIterations.size > 0 || reqs.usesBackReferences;
  });
}
function analyzeSchemaContextRequirements(schema) {
  const globalRequirements = {
    needsParentFields: new Set,
    needsArrayIterations: new Set,
    usesParentNavigation: false,
    usesBackReferences: false
  };
  for (const typeDef of Object.values(schema.types)) {
    const typeReqs = analyzeContextRequirements(typeDef, schema);
    mergeRequirements(globalRequirements, typeReqs);
  }
  return globalRequirements;
}
function findFieldTypeInSchema(fieldName, schema) {
  for (const [typeName, typeDef] of Object.entries(schema.types)) {
    const fields = getTypeFields(typeDef);
    for (const field of fields) {
      const fieldAny = field;
      if (fieldAny.name === fieldName) {
        return inferTypeScriptType(fieldAny, schema);
      }
    }
  }
  return "any";
}
function inferTypeScriptType(field, schema) {
  if (field.type === "array") {
    if (field.items?.type === "choice") {
      const choiceTypes = field.items.choices?.map((c) => c.type).filter(Boolean) || [];
      if (choiceTypes.length > 0) {
        return `(${choiceTypes.join(" | ")})[]`;
      }
      return "any[]";
    } else if (field.items?.type && schema.types[field.items.type]) {
      return `${field.items.type}[]`;
    } else if (field.items?.type) {
      return mapPrimitiveToTS(field.items.type) + "[]";
    }
    return "any[]";
  } else if (field.type === "choice") {
    const choiceTypes = field.choices?.map((c) => c.type).filter(Boolean) || [];
    if (choiceTypes.length > 0) {
      return choiceTypes.join(" | ");
    }
    return "any";
  } else if (schema.types[field.type]) {
    return field.type;
  } else {
    return mapPrimitiveToTS(field.type);
  }
}
function mapPrimitiveToTS(type) {
  switch (type) {
    case "uint8":
    case "uint16":
    case "uint32":
    case "int8":
    case "int16":
    case "int32":
    case "bit":
      return "number";
    case "uint64":
    case "int64":
      return "bigint";
    case "string":
      return "string";
    case "bytes":
      return "Uint8Array";
    default:
      return "any";
  }
}
function generateContextInterface(schema) {
  const requirements = analyzeSchemaContextRequirements(schema);
  if (!requirements.usesParentNavigation && requirements.needsArrayIterations.size === 0 && !requirements.usesBackReferences) {
    return "";
  }
  let code = `interface EncodingContext {
`;
  if (requirements.needsParentFields.size > 0) {
    code += `  parents: Array<{
`;
    for (const fieldName of Array.from(requirements.needsParentFields).sort()) {
      const fieldType = findFieldTypeInSchema(fieldName, schema);
      code += `    ${fieldName}?: ${fieldType};
`;
    }
    code += `  }>;
`;
  }
  if (requirements.needsArrayIterations.size > 0) {
    code += `  arrayIterations: {
`;
    for (const arrayName of Array.from(requirements.needsArrayIterations).sort()) {
      const arrayType = findFieldTypeInSchema(arrayName, schema);
      code += `    ${arrayName}?: {
`;
      code += `      items: ${arrayType};
`;
      code += `      index: number;
`;
      code += `      fieldName: string;
`;
      code += `      typeIndices: Map<string, number>;
`;
      code += `    };
`;
    }
    code += `  };
`;
  }
  code += `  // Position tracking for corresponding/first/last array selectors
`;
  code += `  positions: Map<string, number[]>;
`;
  if (requirements.usesBackReferences) {
    code += `  // Compression dictionary for back_reference fields (shared across encoder boundaries)
`;
    code += `  compressionDict: Map<string, number>;
`;
    code += `  // Absolute byte offset (parent offset + current encoder offset)
`;
    code += `  byteOffset: number;
`;
  }
  code += `}

`;
  code += `const EMPTY_CONTEXT: EncodingContext = {
`;
  if (requirements.needsParentFields.size > 0) {
    code += `  parents: [],
`;
  }
  if (requirements.needsArrayIterations.size > 0) {
    code += `  arrayIterations: {},
`;
  }
  code += `  positions: new Map(),
`;
  if (requirements.usesBackReferences) {
    code += `  compressionDict: new Map(),
`;
    code += `  byteOffset: 0,
`;
  }
  code += `};

`;
  return code;
}

// ../packages/binschema/src/generators/typescript/context-extension.ts
function generateArrayContextExtension(fieldName, valuePath, itemVar, indexVar, indent, schema, isChoiceArray = false, choiceTypes = [], baseContextVar = "context") {
  if (!schemaRequiresContext(schema)) {
    return "";
  }
  const requirements = analyzeSchemaContextRequirements(schema);
  const needsByteOffset = requirements.usesBackReferences;
  const contextVarName = `extendedContext_${fieldName}`;
  const lastDot = valuePath.lastIndexOf(".");
  const parentPath = lastDot >= 0 ? valuePath.substring(0, lastDot) : valuePath;
  let code = `${indent}// Extend context for array iteration
`;
  code += `${indent}const ${contextVarName}: EncodingContext = {
`;
  code += `${indent}  ...${baseContextVar},
`;
  code += `${indent}  parents: [
`;
  code += `${indent}    ...(${baseContextVar}.parents || []),
`;
  code += `${indent}    ${parentPath}
`;
  code += `${indent}  ],
`;
  code += `${indent}  arrayIterations: {
`;
  code += `${indent}    ...(${baseContextVar}.arrayIterations || {}),
`;
  code += `${indent}    ${fieldName}: {
`;
  code += `${indent}      items: ${valuePath},
`;
  code += `${indent}      index: ${indexVar},
`;
  code += `${indent}      fieldName: '${fieldName}',
`;
  if (isChoiceArray && choiceTypes.length > 0) {
    code += `${indent}      typeIndices: ${valuePath.replace(/\./g, "_")}_typeIndices
`;
  } else {
    code += `${indent}      typeIndices: new Map<string, number>()
`;
  }
  code += `${indent}    }
`;
  code += `${indent}  },
`;
  code += `${indent}  // Positions map is shared (not copied) so updates are visible to all
`;
  code += `${indent}  positions: ${baseContextVar}.positions`;
  if (needsByteOffset) {
    code += `,
`;
    code += `${indent}  // Update absolute byte offset for nested encoder (parent offset + current position)
`;
    code += `${indent}  byteOffset: (${baseContextVar}.byteOffset || 0) + this.byteOffset,
`;
    code += `${indent}  // Share compression dict across encoder boundaries
`;
    code += `${indent}  compressionDict: ${baseContextVar}.compressionDict || this.compressionDict`;
  }
  code += `
${indent}};
`;
  return code;
}
function generateNestedTypeContextExtension(parentFieldName, parentValue, indent, schema, baseContextVarName = "context") {
  if (!schemaRequiresContext(schema)) {
    return "";
  }
  const requirements = analyzeSchemaContextRequirements(schema);
  const needsByteOffset = requirements.usesBackReferences;
  const contextVarName = `extendedContext_${parentFieldName}`;
  let code = `${indent}// Extend context with parent field reference
`;
  code += `${indent}const ${contextVarName}: EncodingContext = {
`;
  code += `${indent}  ...${baseContextVarName},
`;
  code += `${indent}  parents: [
`;
  code += `${indent}    ...(${baseContextVarName}.parents || []),
`;
  code += `${indent}    ${parentValue}
`;
  code += `${indent}  ],
`;
  code += `${indent}  arrayIterations: ${baseContextVarName}.arrayIterations || {},
`;
  code += `${indent}  positions: ${baseContextVarName}.positions`;
  if (needsByteOffset) {
    code += `,
`;
    code += `${indent}  // Update absolute byte offset for nested encoder (parent offset + current position)
`;
    code += `${indent}  byteOffset: (${baseContextVarName}.byteOffset || 0) + this.byteOffset,
`;
    code += `${indent}  // Share compression dict across encoder boundaries
`;
    code += `${indent}  compressionDict: ${baseContextVarName}.compressionDict || this.compressionDict`;
  }
  code += `
${indent}};
`;
  return code;
}
function getContextVarName(fieldName) {
  return `extendedContext_${fieldName}`;
}
function getContextParam(schema, useExtended = true, fieldName) {
  if (!schemaRequiresContext(schema)) {
    return "";
  }
  if (fieldName) {
    return `, extendedContext_${fieldName}`;
  }
  return useExtended ? ", extendedContext" : ", context";
}

// ../packages/binschema/src/generators/typescript/array-support.ts
function getItemSize(itemDef, schema, globalEndianness) {
  const itemType = itemDef.type;
  switch (itemType) {
    case "uint8":
    case "int8":
      return 1;
    case "uint16":
    case "int16":
      return 2;
    case "uint32":
    case "int32":
    case "float32":
      return 4;
    case "uint64":
    case "int64":
    case "float64":
      return 8;
    default:
      throw new Error(`length_prefixed_items: Cannot determine size for item type "${itemType}". Only fixed-size primitive types are supported.`);
  }
}
function getWriteMethodForType(itemType, endianness, valuePath) {
  switch (itemType) {
    case "uint8":
      return `writeUint8(${valuePath})`;
    case "int8":
      return `writeInt8(${valuePath})`;
    case "uint16":
      return `writeUint16(${valuePath}, "${endianness}")`;
    case "int16":
      return `writeInt16(${valuePath}, "${endianness}")`;
    case "uint32":
      return `writeUint32(${valuePath}, "${endianness}")`;
    case "int32":
      return `writeInt32(${valuePath}, "${endianness}")`;
    case "float32":
      return `writeFloat32(${valuePath}, "${endianness}")`;
    case "uint64":
      return `writeUint64(BigInt(${valuePath}), "${endianness}")`;
    case "int64":
      return `writeInt64(BigInt(${valuePath}), "${endianness}")`;
    case "float64":
      return `writeFloat64(${valuePath}, "${endianness}")`;
    default:
      throw new Error(`Unknown primitive type: ${itemType}`);
  }
}
function generateEncodeArray(field, schema, globalEndianness, valuePath, indent, generateEncodeFieldCoreImpl, baseContextVar = "context") {
  let code = "";
  if (field.kind === "length_prefixed" || field.kind === "length_prefixed_items") {
    const lengthType = field.length_type;
    switch (lengthType) {
      case "uint8":
        code += `${indent}this.writeUint8(${valuePath}.length);
`;
        break;
      case "uint16":
        code += `${indent}this.writeUint16(${valuePath}.length, "${globalEndianness}");
`;
        break;
      case "uint32":
        code += `${indent}this.writeUint32(${valuePath}.length, "${globalEndianness}");
`;
        break;
      case "uint64":
        code += `${indent}this.writeUint64(BigInt(${valuePath}.length), "${globalEndianness}");
`;
        break;
    }
  }
  if (field.kind === "byte_length_prefixed") {
    const byteLengthVarName = valuePath.replace(/\./g, "_") + "_byteLength";
    const tempEncoderVar = valuePath.replace(/[.\[\]]/g, "_") + "_tempEncoder";
    code += `${indent}// First pass: encode items to temporary encoder to measure total byte length
`;
    code += `${indent}const ${tempEncoderVar} = new (this.constructor as any)();
`;
    const itemVar2 = valuePath.replace(/[.\[\]]/g, "_") + "_measure_item";
    code += `${indent}for (const ${itemVar2} of ${valuePath}) {
`;
    const itemType = field.items?.type;
    const isPrimitive = ["uint8", "int8", "uint16", "int16", "uint32", "int32", "float32", "uint64", "int64", "float64"].includes(itemType || "");
    if (itemType === "choice") {
      const choices = field.items?.choices || [];
      code += `${indent}  // Determine item type and encode to measure size
`;
      for (const choice of choices) {
        code += `${indent}  if (${itemVar2}.type === '${choice.type}') {
`;
        code += `${indent}    const itemEncoder = new ${choice.type}Encoder();
`;
        code += `${indent}    const itemBytes = itemEncoder.encode(${itemVar2} as ${choice.type});
`;
        code += `${indent}    ${tempEncoderVar}.writeBytes(itemBytes);
`;
        code += `${indent}  }
`;
      }
    } else if (isPrimitive) {
      const writeMethod = getWriteMethodForType(itemType || "", globalEndianness, itemVar2);
      code += `${indent}  ${tempEncoderVar}.${writeMethod};
`;
    } else {
      code += `${indent}  const itemEncoder = new ${itemType}Encoder();
`;
      code += `${indent}  const itemBytes = itemEncoder.encode(${itemVar2});
`;
      code += `${indent}  ${tempEncoderVar}.writeBytes(itemBytes);
`;
    }
    code += `${indent}}
`;
    code += `${indent}const ${byteLengthVarName} = ${tempEncoderVar}.byteOffset;

`;
    code += `${indent}// Write computed byte length prefix
`;
    const lengthType = field.length_type;
    if (lengthType === "uint8") {
      code += `${indent}this.writeUint8(${byteLengthVarName});
`;
    } else if (lengthType === "uint16") {
      code += `${indent}this.writeUint16(${byteLengthVarName}, "${globalEndianness}");
`;
    } else if (lengthType === "uint32") {
      code += `${indent}this.writeUint32(${byteLengthVarName}, "${globalEndianness}");
`;
    } else if (lengthType === "uint64") {
      code += `${indent}this.writeUint64(BigInt(${byteLengthVarName}), "${globalEndianness}");
`;
    } else if (lengthType === "varlength") {
      const encoding = field.length_encoding || "der";
      const methodName = getVarlengthWriteMethod(encoding);
      code += `${indent}this.${methodName}(${byteLengthVarName});
`;
    } else {
      throw new Error(`Unsupported length_type for byte_length_prefixed array: ${lengthType}`);
    }
  }
  if (!field.items || typeof field.items !== "object" || !("type" in field.items)) {
    return `${indent}// ERROR: Array field '${valuePath}' has undefined or invalid items
`;
  }
  const fieldName = field.name || valuePath.split(".").pop() || "array";
  const correspondingTypes = detectCorrespondingTracking(field, schema) || new Set;
  const firstLastTypes = detectFirstLastTracking(fieldName, schema);
  const trackingTypes = new Set([...correspondingTypes, ...firstLastTypes]);
  if (trackingTypes.size > 0 && schemaRequiresContext(schema)) {
    code += `${indent}// Initialize position tracking (corresponding, first/last) in context
`;
    for (const typeName of trackingTypes) {
      code += `${indent}context.positions.set('${fieldName}_${typeName}', []);
`;
    }
  }
  if (field.kind === "fixed" && field.length !== undefined) {
    code += `${indent}// Validate fixed-length array
`;
    code += `${indent}if (${valuePath}.length !== ${field.length}) {
`;
    code += `${indent}  throw new Error(\`Array '${fieldName}' must have exactly ${field.length} elements, got \${${valuePath}.length}\`);
`;
    code += `${indent}}
`;
  }
  const isChoiceArray = field.items?.type === "choice";
  const choiceTypes = isChoiceArray ? (field.items?.choices || []).map((c) => c.type) : [];
  if (isChoiceArray && choiceTypes.length > 0 && schema) {
    code += `${indent}// Initialize type indices for corresponding correlation
`;
    code += `${indent}const ${valuePath.replace(/\./g, "_")}_typeIndices = new Map<string, number>();
`;
    for (const typeName of choiceTypes) {
      code += `${indent}${valuePath.replace(/\./g, "_")}_typeIndices.set('${typeName}', 0);
`;
    }
  }
  const itemVar = valuePath.replace(/[.\[\]]/g, "_") + ARRAY_ITER_SUFFIX;
  if (trackingTypes.size > 0) {
    code += `${indent}// Pre-pass: compute item positions for first/last selectors
`;
    code += `${indent}let ${itemVar}_offset = this.byteOffset;
`;
    code += `${indent}for (let ${itemVar}_prepass_index = 0; ${itemVar}_prepass_index < ${valuePath}.length; ${itemVar}_prepass_index++) {
`;
    code += `${indent}  const ${itemVar} = ${valuePath}[${itemVar}_prepass_index];
`;
    const isChoiceArray2 = field.items?.type === "choice";
    const choiceTypes2 = isChoiceArray2 ? (field.items?.choices || []).map((c) => c.type) : [];
    code += generateArrayContextExtension(fieldName, valuePath, itemVar, `${itemVar}_prepass_index`, indent + "  ", schema, isChoiceArray2, choiceTypes2, baseContextVar);
    if (isChoiceArray2 && choiceTypes2.length > 0) {
      code += `${indent}  // Increment type-specific occurrence counter
`;
      code += `${indent}  const currentItemType_prepass = ${itemVar}.type;
`;
      const typeIndicesVar = `${valuePath.replace(/\./g, "_")}_typeIndices`;
      const contextVar = getContextVarName(fieldName);
      if (schemaRequiresContext(schema)) {
        code += `${indent}  const currentTypeIndex_prepass = ${contextVar}.arrayIterations.${fieldName}.typeIndices.get(currentItemType_prepass) ?? 0;
`;
        code += `${indent}  ${contextVar}.arrayIterations.${fieldName}.typeIndices.set(currentItemType_prepass, currentTypeIndex_prepass + 1);
`;
      } else {
        code += `${indent}  const currentTypeIndex_prepass = ${typeIndicesVar}.get(currentItemType_prepass) ?? 0;
`;
        code += `${indent}  ${typeIndicesVar}.set(currentItemType_prepass, currentTypeIndex_prepass + 1);
`;
      }
    }
    if (field.items?.type === "choice") {
      const contextVar = getContextVarName(fieldName);
      for (const typeName of trackingTypes) {
        code += `${indent}  if (${itemVar}.type === '${typeName}') {
`;
        if (schemaRequiresContext(schema)) {
          code += `${indent}    ${contextVar}.positions.get('${fieldName}_${typeName}')!.push(${itemVar}_offset);
`;
        } else {
          code += `${indent}    this._positions_${fieldName}_${typeName}.push(${itemVar}_offset);
`;
        }
        code += `${indent}  }
`;
      }
      code += `${indent}  // Advance offset by item size
`;
      const choices = field.items.choices || [];
      for (let i = 0;i < choices.length; i++) {
        const choice = choices[i];
        const ifOrElseIf = i === 0 ? "if" : "else if";
        code += `${indent}  ${ifOrElseIf} (${itemVar}.type === '${choice.type}') {
`;
        code += `${indent}    // Encode to temporary encoder to measure size
`;
        code += `${indent}    const temp_encoder = new ${choice.type}Encoder();
`;
        code += `${indent}    const temp_bytes = temp_encoder.encode(${itemVar} as ${choice.type}${getContextParam(schema, true, fieldName)});
`;
        code += `${indent}    ${itemVar}_offset += temp_bytes.length;
`;
        code += `${indent}  }
`;
      }
    } else {
      const itemType = field.items?.type;
      const contextVar = getContextVarName(fieldName);
      if (itemType && trackingTypes.has(itemType)) {
        if (schemaRequiresContext(schema)) {
          code += `${indent}  ${contextVar}.positions.get('${fieldName}_${itemType}')!.push(${itemVar}_offset);
`;
        } else {
          code += `${indent}  this._positions_${fieldName}_${itemType}.push(${itemVar}_offset);
`;
        }
        code += `${indent}  // Encode to temporary encoder to measure size
`;
        code += `${indent}  const temp_encoder = new ${itemType}Encoder();
`;
        code += `${indent}  const temp_bytes = temp_encoder.encode(${itemVar}${getContextParam(schema, true, fieldName)});
`;
        code += `${indent}  ${itemVar}_offset += temp_bytes.length;
`;
      }
    }
    code += `${indent}}

`;
  }
  if (isChoiceArray && choiceTypes.length > 0 && trackingTypes.size > 0) {
    const typeIndicesVar = `${valuePath.replace(/\./g, "_")}_typeIndices`;
    code += `${indent}// Reset type indices for main encoding loop
`;
    for (const typeName of choiceTypes) {
      code += `${indent}${typeIndicesVar}.set('${typeName}', 0);
`;
    }
  }
  const hasTerminalVariants = (field.kind === "null_terminated" || field.kind === "variant_terminated") && field.terminal_variants && Array.isArray(field.terminal_variants) && field.terminal_variants.length > 0;
  if (hasTerminalVariants) {
    const terminatedVar = valuePath.replace(/[.\[\]]/g, "_") + "_terminated";
    code += `${indent}let ${terminatedVar} = false;
`;
  }
  code += `${indent}for (let ${itemVar}_index = 0; ${itemVar}_index < ${valuePath}.length; ${itemVar}_index++) {
`;
  code += `${indent}  const ${itemVar} = ${valuePath}[${itemVar}_index];
`;
  code += generateArrayContextExtension(fieldName, valuePath, itemVar, `${itemVar}_index`, indent + "  ", schema, isChoiceArray, choiceTypes, baseContextVar);
  if (isChoiceArray && choiceTypes.length > 0) {
    code += `${indent}  // Increment type-specific occurrence counter
`;
    code += `${indent}  const currentItemType = ${itemVar}.type;
`;
    const typeIndicesVar = `${valuePath.replace(/\./g, "_")}_typeIndices`;
    const contextVar = getContextVarName(fieldName);
    if (schemaRequiresContext(schema)) {
      code += `${indent}  const currentTypeIndex = ${contextVar}.arrayIterations.${fieldName}.typeIndices.get(currentItemType) ?? 0;
`;
      code += `${indent}  ${contextVar}.arrayIterations.${fieldName}.typeIndices.set(currentItemType, currentTypeIndex + 1);
`;
    } else {
      code += `${indent}  const currentTypeIndex = ${typeIndicesVar}.get(currentItemType) ?? 0;
`;
      code += `${indent}  ${typeIndicesVar}.set(currentItemType, currentTypeIndex + 1);
`;
    }
  }
  const correspondingTypesNotInPrePass = new Set([...correspondingTypes].filter((t) => !trackingTypes.has(t)));
  if (correspondingTypesNotInPrePass.size > 0) {
    const contextVar = getContextVarName(fieldName);
    if (field.items?.type === "choice") {
      code += `${indent}  // Track position for corresponding correlation
`;
      for (const typeName of correspondingTypesNotInPrePass) {
        code += `${indent}  if (${itemVar}.type === '${typeName}') {
`;
        if (schemaRequiresContext(schema)) {
          code += `${indent}    ${contextVar}.positions.get('${fieldName}_${typeName}')!.push(this.byteOffset);
`;
        } else {
          code += `${indent}    this._positions_${fieldName}_${typeName}.push(this.byteOffset);
`;
        }
        code += `${indent}  }
`;
      }
    } else {
      const itemType = field.items?.type;
      if (itemType && correspondingTypesNotInPrePass.has(itemType)) {
        code += `${indent}  // Track position for corresponding correlation
`;
        if (schemaRequiresContext(schema)) {
          code += `${indent}  ${contextVar}.positions.get('${fieldName}_${itemType}')!.push(this.byteOffset);
`;
        } else {
          code += `${indent}  this._positions_${fieldName}_${itemType}.push(this.byteOffset);
`;
        }
      }
    }
  }
  if (field.kind === "length_prefixed_items" && field.item_length_type) {
    const itemLengthType = field.item_length_type;
    const itemType = field.items?.type;
    const isFixedSizePrimitive = ["uint8", "int8", "uint16", "int16", "uint32", "int32", "float32", "uint64", "int64", "float64"].includes(itemType);
    if (isFixedSizePrimitive) {
      const itemSize = getItemSize(field.items, schema, globalEndianness);
      switch (itemLengthType) {
        case "uint8":
          code += `${indent}  this.writeUint8(${itemSize});
`;
          break;
        case "uint16":
          code += `${indent}  this.writeUint16(${itemSize}, "${globalEndianness}");
`;
          break;
        case "uint32":
          code += `${indent}  this.writeUint32(${itemSize}, "${globalEndianness}");
`;
          break;
        case "uint64":
          code += `${indent}  this.writeUint64(BigInt(${itemSize}), "${globalEndianness}");
`;
          break;
      }
    } else {
      code += `${indent}  // Encode item to temporary encoder to measure size
`;
      code += `${indent}  const ${itemVar}_temp = new BitStreamEncoder("${globalEndianness === "big_endian" ? "msb_first" : "lsb_first"}");
`;
      const tempEncoding = generateEncodeFieldCoreImpl(field.items, schema, globalEndianness, itemVar, indent + "  ");
      const modifiedEncoding = tempEncoding.replace(/\bthis\./g, `${itemVar}_temp.`);
      code += modifiedEncoding;
      code += `${indent}  const ${itemVar}_bytes = ${itemVar}_temp.finish();
`;
      code += `${indent}  const ${itemVar}_length = ${itemVar}_bytes.length;
`;
      const maxSizes = {
        uint8: 255,
        uint16: 65535,
        uint32: 4294967295,
        uint64: Number.MAX_SAFE_INTEGER
      };
      const maxSize = maxSizes[itemLengthType];
      code += `${indent}  if (${itemVar}_length > ${maxSize}) {
`;
      code += `${indent}    throw new Error(\`Item size \${${itemVar}_length} exceeds maximum ${maxSize} bytes for ${itemLengthType}\`);
`;
      code += `${indent}  }
`;
      switch (itemLengthType) {
        case "uint8":
          code += `${indent}  this.writeUint8(${itemVar}_length);
`;
          break;
        case "uint16":
          code += `${indent}  this.writeUint16(${itemVar}_length, "${globalEndianness}");
`;
          break;
        case "uint32":
          code += `${indent}  this.writeUint32(${itemVar}_length, "${globalEndianness}");
`;
          break;
        case "uint64":
          code += `${indent}  this.writeUint64(BigInt(${itemVar}_length), "${globalEndianness}");
`;
          break;
      }
      code += `${indent}  for (const byte of ${itemVar}_bytes) {
`;
      code += `${indent}    this.writeUint8(byte);
`;
      code += `${indent}  }
`;
      code += `${indent}  continue;
`;
    }
  }
  if (!(field.kind === "length_prefixed_items" && field.item_length_type && !["uint8", "int8", "uint16", "int16", "uint32", "int32", "float32", "uint64", "int64", "float64"].includes(field.items?.type))) {
    const contextVarForItem = schemaRequiresContext(schema) ? getContextVarName(fieldName) : undefined;
    code += generateEncodeFieldCoreImpl(field.items, schema, globalEndianness, itemVar, indent + "  ", contextVarForItem);
  }
  if (hasTerminalVariants) {
    const terminatedVar = valuePath.replace(/[.\[\]]/g, "_") + "_terminated";
    code += `${indent}  // Check if item is a terminal variant
`;
    const conditions = field.terminal_variants.map((v) => `${itemVar}.type === '${v}'`).join(" || ");
    code += `${indent}  if (${conditions}) {
`;
    code += `${indent}    ${terminatedVar} = true;
`;
    code += `${indent}    break;
`;
    code += `${indent}  }
`;
  }
  if (correspondingTypes.size > 0 && field.items?.type === "choice") {
    code += `${indent}  // Increment correlation index for this choice type
`;
    const choices = field.items.choices || [];
    for (const choice of choices) {
      code += `${indent}  if (${itemVar}.type === '${choice.type}') {
`;
      code += `${indent}    this._index_${fieldName}_${choice.type}++;
`;
      code += `${indent}  }
`;
    }
  }
  code += `${indent}}
`;
  if (field.kind === "null_terminated") {
    if (hasTerminalVariants) {
      const terminatedVar = valuePath.replace(/[.\[\]]/g, "_") + "_terminated";
      code += `${indent}if (!${terminatedVar}) {
`;
      code += `${indent}  this.writeUint8(0);
`;
      code += `${indent}}
`;
    } else {
      code += `${indent}this.writeUint8(0);
`;
    }
  }
  return code;
}
function generateDecodeArray(field, schema, globalEndianness, fieldName, indent, addTraceLogs, getTargetPath, generateDecodeFieldCore) {
  const target = getTargetPath(fieldName);
  let code = "";
  if (addTraceLogs) {
    code += `${indent}console.log('[TRACE] Decoding array field ${fieldName}');
`;
  }
  code += `${indent}${target} = [];
`;
  if (field.kind === "length_prefixed" || field.kind === "length_prefixed_items") {
    const lengthType = field.length_type;
    let lengthRead = "";
    switch (lengthType) {
      case "uint8":
        lengthRead = "this.readUint8()";
        break;
      case "uint16":
        lengthRead = `this.readUint16("${globalEndianness}")`;
        break;
      case "uint32":
        lengthRead = `this.readUint32("${globalEndianness}")`;
        break;
      case "uint64":
        lengthRead = `Number(this.readUint64("${globalEndianness}"))`;
        break;
    }
    const lengthVarName = fieldName.replace(/\./g, "_") + "_length";
    code += `${indent}const ${lengthVarName} = ${lengthRead};
`;
    code += `${indent}for (let i = 0; i < ${lengthVarName}; i++) {
`;
    if (field.kind === "length_prefixed_items" && field.item_length_type) {
      const itemLengthType = field.item_length_type;
      const itemLengthVarName = fieldName.replace(/\./g, "_") + "_item_length";
      let itemLengthRead = "";
      switch (itemLengthType) {
        case "uint8":
          itemLengthRead = "this.readUint8()";
          break;
        case "uint16":
          itemLengthRead = `this.readUint16("${globalEndianness}")`;
          break;
        case "uint32":
          itemLengthRead = `this.readUint32("${globalEndianness}")`;
          break;
        case "uint64":
          itemLengthRead = `Number(this.readUint64("${globalEndianness}"))`;
          break;
      }
      code += `${indent}  const ${itemLengthVarName} = ${itemLengthRead};
`;
    }
  } else if (field.kind === "fixed") {
    code += `${indent}for (let i = 0; i < ${field.length}; i++) {
`;
  } else if (field.kind === "field_referenced") {
    const lengthField = field.length_field;
    const lengthVarName = fieldName.replace(/\./g, "_") + "_length";
    if (lengthField.startsWith("_root.")) {
      const rootPath = lengthField.substring(6);
      code += `${indent}const ${lengthVarName} = this.context?._root?.${rootPath};
`;
      code += `${indent}if (${lengthVarName} === undefined) {
`;
      code += `${indent}  throw new Error('Field-referenced array length field "${lengthField}" not found in context._root');
`;
      code += `${indent}}
`;
    } else {
      const isArrayItem = fieldName.endsWith(ARRAY_ITER_SUFFIX) || fieldName.includes(ARRAY_ITER_SUFFIX + ".");
      const parentPath = fieldName.includes(".") ? fieldName.substring(0, fieldName.lastIndexOf(".")) + "." : "";
      const fullLengthPath = parentPath + lengthField;
      if (isArrayItem) {
        code += `${indent}const ${lengthVarName} = ${fullLengthPath} ?? this.context?.${lengthField};
`;
      } else {
        code += `${indent}const ${lengthVarName} = value.${fullLengthPath} ?? this.context?.${lengthField};
`;
      }
      code += `${indent}if (${lengthVarName} === undefined) {
`;
      code += `${indent}  throw new Error('Field-referenced array length field "${lengthField}" not found in value or context');
`;
      code += `${indent}}
`;
    }
    code += `${indent}for (let i = 0; i < ${lengthVarName}; i++) {
`;
  } else if (field.kind === "computed_count") {
    const countExpr = field.count_expr;
    const lengthVarName = fieldName.replace(/\./g, "_") + "_length";
    code += `${indent}// Evaluate computed count expression: ${countExpr}
`;
    code += `${indent}const ${lengthVarName}_context: Record<string, number> = {};
`;
    const fieldRefs = countExpr.match(/[a-zA-Z_][a-zA-Z0-9_.]*(?![a-zA-Z0-9_(])/g) || [];
    const uniqueFieldRefs = [...new Set(fieldRefs)];
    const isArrayItem = fieldName.endsWith(ARRAY_ITER_SUFFIX) || fieldName.includes(ARRAY_ITER_SUFFIX + ".");
    const parentPath = fieldName.includes(".") ? fieldName.substring(0, fieldName.lastIndexOf(".")) + "." : "";
    for (const fieldRef of uniqueFieldRefs) {
      const fullPath = parentPath + fieldRef;
      if (isArrayItem) {
        code += `${indent}${lengthVarName}_context['${fieldRef}'] = ${fullPath};
`;
      } else {
        code += `${indent}${lengthVarName}_context['${fieldRef}'] = value.${fullPath};
`;
      }
    }
    code += `${indent}const ${lengthVarName}_result = evaluateExpression('${countExpr}', ${lengthVarName}_context);
`;
    code += `${indent}if (!${lengthVarName}_result.success) {
`;
    code += `${indent}  throw new Error(\`Failed to evaluate count expression '${countExpr}': \${${lengthVarName}_result.error}\${${lengthVarName}_result.details ? ' (' + ${lengthVarName}_result.details + ')' : ''}\`);
`;
    code += `${indent}}
`;
    code += `${indent}const ${lengthVarName} = ${lengthVarName}_result.value;
`;
    code += `${indent}for (let i = 0; i < ${lengthVarName}; i++) {
`;
  } else if (field.kind === "byte_length_prefixed") {
    const lengthVarName = fieldName.replace(/\./g, "_") + "_length";
    const lengthType = field.length_type;
    code += `${indent}// Read byte length prefix
`;
    if (lengthType === "uint8") {
      code += `${indent}const ${lengthVarName} = this.readUint8();
`;
    } else if (lengthType === "uint16") {
      code += `${indent}const ${lengthVarName} = this.readUint16("${globalEndianness}");
`;
    } else if (lengthType === "uint32") {
      code += `${indent}const ${lengthVarName} = this.readUint32("${globalEndianness}");
`;
    } else if (lengthType === "uint64") {
      code += `${indent}const ${lengthVarName} = Number(this.readUint64("${globalEndianness}"));
`;
    } else if (lengthType === "varlength") {
      const encoding = field.length_encoding || "der";
      const methodName = getVarlengthReadMethod(encoding);
      code += `${indent}const ${lengthVarName} = this.${methodName}();
`;
    } else {
      throw new Error(`Unsupported length_type for byte_length_prefixed array: ${lengthType}`);
    }
    const startOffsetVar = fieldName.replace(/\./g, "_") + "_startOffset";
    const endOffsetVar = fieldName.replace(/\./g, "_") + "_endOffset";
    code += `${indent}const ${startOffsetVar} = this.byteOffset;
`;
    code += `${indent}const ${endOffsetVar} = ${startOffsetVar} + ${lengthVarName};
`;
    code += `${indent}while (this.byteOffset < ${endOffsetVar}) {
`;
  } else if (field.kind === "null_terminated") {
    const itemType = field.items?.type;
    if (itemType === "uint8") {
      code += `${indent}while (true) {
`;
      code += `${indent}  const byte = this.readUint8();
`;
      code += `${indent}  if (byte === 0) break;
`;
      code += `${indent}  ${target}.push(byte);
`;
      code += `${indent}}
`;
      return code;
    } else {
      code += `${indent}while (true) {
`;
      code += `${indent}  const firstByte = this.readUint8();
`;
      code += `${indent}  if (firstByte === 0) break;
`;
      code += `${indent}  // Rewind one byte since we peeked ahead
`;
      code += `${indent}  this.byteOffset--;
`;
    }
  } else if (field.kind === "signature_terminated") {
    const terminatorValue = field.terminator_value;
    const terminatorType = field.terminator_type;
    const terminatorEndianness = field.terminator_endianness || globalEndianness;
    if (terminatorValue === undefined || terminatorType === undefined) {
      throw new Error(`signature_terminated array '${field.name}' requires terminator_value and terminator_type`);
    }
    const peekMethod = `peek${terminatorType.charAt(0).toUpperCase() + terminatorType.slice(1)}`;
    const endiannessArg = terminatorType !== "uint8" ? `"${terminatorEndianness}"` : "";
    code += `${indent}while (true) {
`;
    code += `${indent}  // Peek ahead to check for terminator signature
`;
    code += `${indent}  const signature = this.${peekMethod}(${endiannessArg});
`;
    code += `${indent}  if (signature === ${terminatorValue}) break;
`;
  } else if (field.kind === "eof_terminated") {
    code += `${indent}while (this.byteOffset < this.bytes.length) {
`;
    code += `${indent}  try {
`;
  } else if (field.kind === "variant_terminated") {
    code += `${indent}while (true) {
`;
  }
  if (!field.items || typeof field.items !== "object" || !("type" in field.items)) {
    code += `${indent}  // ERROR: Array items undefined
`;
    if (field.kind === "null_terminated" || field.kind === "signature_terminated" || field.kind === "eof_terminated" || field.kind === "variant_terminated") {
      code += `${indent}}
`;
    } else {
      code += `${indent}}
`;
    }
    return code;
  }
  const itemVar = fieldName.replace(/[.\[\]]/g, "_") + ARRAY_ITER_SUFFIX;
  const itemDecodeCode = generateDecodeFieldCore(field.items, schema, globalEndianness, itemVar, indent + "  ", addTraceLogs);
  if (itemDecodeCode.includes(`${itemVar} =`)) {
    code += `${indent}  let ${itemVar}: any;
`;
    code += itemDecodeCode;
    code += `${indent}  ${target}.push(${itemVar});
`;
    if ((field.kind === "null_terminated" || field.kind === "variant_terminated") && field.terminal_variants && Array.isArray(field.terminal_variants)) {
      code += `${indent}  // Check if item is a terminal variant
`;
      const conditions = field.terminal_variants.map((v) => `${itemVar}.type === '${v}'`).join(" || ");
      code += `${indent}  if (${conditions}) {
`;
      code += `${indent}    break;
`;
      code += `${indent}  }
`;
    }
  }
  if (field.kind === "eof_terminated") {
    code += `${indent}  } catch (error) {
`;
    code += `${indent}    // EOF reached - stop reading items
`;
    code += `${indent}    if (error instanceof Error && error.message.includes('Unexpected end of stream')) {
`;
    code += `${indent}      break;
`;
    code += `${indent}    }
`;
    code += `${indent}    throw error; // Re-throw other errors
`;
    code += `${indent}  }
`;
  }
  code += `${indent}}
`;
  return code;
}

// ../packages/binschema/src/generators/typescript/interface-generation.ts
function isFieldConditional(field) {
  return "conditional" in field && field.conditional !== undefined;
}
function isInlineDiscriminatedUnion(instanceType) {
  return typeof instanceType === "object" && instanceType !== null && "discriminator" in instanceType && "variants" in instanceType;
}
function generateInlineDiscriminatedUnionType(unionDef, schema, useInputTypes) {
  const variants = [];
  for (const variant of unionDef.variants) {
    const suffix = useInputTypes ? "Input" : "Output";
    const variantType = schema.types[variant.type] ? `${variant.type}${suffix}` : variant.type;
    variants.push(`{ type: '${variant.type}'; value: ${variantType} }`);
  }
  return variants.join(" | ");
}
function isInputField(field) {
  const fieldAny = field;
  if (fieldAny.computed) {
    return false;
  }
  if (fieldAny.const !== undefined) {
    return false;
  }
  return true;
}
function isOutputField(field) {
  return true;
}
function getFieldTypeScriptType(field, schema, useInputTypes = false) {
  if (!field || typeof field !== "object") {
    return "any";
  }
  if ("type" in field) {
    switch (field.type) {
      case "bit":
      case "uint8":
      case "uint16":
      case "uint32":
      case "int8":
      case "int16":
      case "int32":
      case "varlength":
      case "float32":
      case "float64":
        return "number";
      case "uint64":
      case "int64":
        return "bigint";
      case "array":
        const itemType = getFieldTypeScriptType(field.items, schema, useInputTypes);
        return `${itemType}[]`;
      case "string":
        return "string";
      case "bitfield":
        return `{ ${field.fields.map((f) => `${f.name}: number`).join(", ")} }`;
      case "discriminated_union":
        return generateDiscriminatedUnionType(field, schema, useInputTypes);
      case "back_reference":
        return resolveTypeReference(field.target_type, schema, useInputTypes);
      case "optional":
        const valueType = resolveTypeReference(field.value_type, schema, useInputTypes);
        return `${valueType} | undefined`;
      default:
        return resolveTypeReference(field.type, schema, useInputTypes);
    }
  }
  return "any";
}
function resolveTypeReference(typeRef, schema, useInputTypes) {
  if (!typeRef) {
    throw new Error("resolveTypeReference called with undefined typeRef");
  }
  const genericMatch = typeRef.match(/^(\w+)<(.+)>$/);
  if (genericMatch) {
    const [, genericType, typeArg] = genericMatch;
    const templateDef = schema.types[`${genericType}<T>`];
    if (templateDef) {
      const templateFields = getTypeFields(templateDef);
      const fields = [];
      for (const field of templateFields) {
        let fieldType;
        if ("type" in field && field.type === "T") {
          fieldType = resolveTypeReference(typeArg, schema, useInputTypes);
        } else {
          fieldType = getFieldTypeScriptType(field, schema, useInputTypes);
        }
        const optional2 = isFieldConditional(field) ? "?" : "";
        fields.push(`${field.name}${optional2}: ${fieldType}`);
      }
      return `{ ${fields.join(", ")} }`;
    }
  }
  if (schema.types[typeRef]) {
    const suffix = useInputTypes ? "Input" : "Output";
    return `${typeRef}${suffix}`;
  }
  return typeRef;
}
function generateDiscriminatedUnionType(field, schema, useInputTypes) {
  if (!field.variants || !Array.isArray(field.variants)) {
    return "any";
  }
  const variantTypes = [];
  for (const variant of field.variants) {
    if (variant.type) {
      const resolvedType = resolveTypeReference(variant.type, schema, useInputTypes);
      variantTypes.push(resolvedType);
    }
  }
  return variantTypes.length > 0 ? variantTypes.join(" | ") : "any";
}
function generateInputInterface(typeName, typeDef, schema) {
  const fields = getTypeFields(typeDef);
  const typeDefAny = typeDef;
  let code = generateJSDoc(typeDefAny.description);
  code += `export interface ${typeName}Input {
`;
  for (const field of fields) {
    if (!isInputField(field)) {
      continue;
    }
    const fieldType = getFieldTypeScriptType(field, schema, true);
    const optional2 = isFieldConditional(field) ? "?" : "";
    const fieldDocString = generateJSDoc(getFieldDocumentation(field, schema), "  ");
    if (fieldDocString) {
      code += fieldDocString;
    }
    code += `  ${field.name}${optional2}: ${fieldType};
`;
  }
  code += `}`;
  return code;
}
function generateOutputInterface(typeName, typeDef, schema) {
  const fields = getTypeFields(typeDef);
  const typeDefAny = typeDef;
  let code = generateJSDoc(typeDefAny.description);
  code += `export interface ${typeName}Output {
`;
  for (const field of fields) {
    if (!isOutputField(field)) {
      continue;
    }
    const fieldType = getFieldTypeScriptType(field, schema, false);
    const optional2 = isFieldConditional(field) ? "?" : "";
    const fieldDocString = generateJSDoc(getFieldDocumentation(field, schema), "  ");
    if (fieldDocString) {
      code += fieldDocString;
    }
    code += `  ${field.name}${optional2}: ${fieldType};
`;
  }
  if (typeDefAny.instances && Array.isArray(typeDefAny.instances)) {
    for (const instance of typeDefAny.instances) {
      const instanceType = isInlineDiscriminatedUnion(instance.type) ? generateInlineDiscriminatedUnionType(instance.type, schema, false) : resolveTypeReference(instance.type, schema, false);
      const instanceDoc = {
        summary: instance.description || `Position-based field at ${typeof instance.position === "number" ? instance.position : instance.position}`
      };
      const instanceDocString = generateJSDoc(instanceDoc, "  ");
      if (instanceDocString) {
        code += instanceDocString;
      }
      code += `  readonly ${instance.name}: ${instanceType};
`;
    }
  }
  code += `}`;
  return code;
}
function generateInterfaces(typeName, typeDef, schema) {
  const inputInterface = generateInputInterface(typeName, typeDef, schema);
  const outputInterface = generateOutputInterface(typeName, typeDef, schema);
  const typeAlias = `export type ${typeName} = ${typeName}Output;`;
  return `${inputInterface}

${outputInterface}

${typeAlias}`;
}

// ../packages/binschema/src/generators/typescript.ts
function generateTypeScript(schema, options) {
  const globalEndianness = schema.config?.endianness || "big_endian";
  const globalBitOrder = schema.config?.bit_order || "msb_first";
  const addTraceLogs = options?.addTraceLogs || false;
  let code = `import { BitStreamEncoder, Endianness } from "./bit-stream.js";
`;
  code += `import { SeekableBitStreamDecoder } from "./seekable-bit-stream.js";
`;
  code += `import { createReader } from "./binary-reader.js";
`;
  code += `import { crc32 } from "./crc32.js";
`;
  code += `import { evaluateExpression } from "./expression-evaluator.js";

`;
  code += generateRuntimeHelpers();
  const contextInterface = generateContextInterface(schema);
  if (contextInterface) {
    code += contextInterface;
  }
  for (const [typeName, typeDef] of Object.entries(schema.types)) {
    if (typeName.includes("<")) {
      continue;
    }
    const sanitizedName = sanitizeTypeName(typeName);
    code += generateTypeCode(sanitizedName, typeDef, schema, globalEndianness, globalBitOrder, addTraceLogs);
    code += `

`;
  }
  return code;
}
function generateTypeCode(typeName, typeDef, schema, globalEndianness, globalBitOrder, addTraceLogs = false) {
  const typeDefAny = typeDef;
  const fields = getTypeFields(typeDef);
  if (typeDefAny.type === "string") {
    const docLines = getFieldDocumentation({ ...typeDefAny, name: typeName }, schema);
    let code = generateJSDoc(docLines);
    code += `export type ${typeName} = string;

`;
    code += generateTypeAliasEncoder(typeName, typeDefAny, schema, globalEndianness, globalBitOrder);
    code += `

`;
    code += generateTypeAliasDecoder(typeName, typeDefAny, schema, globalEndianness, globalBitOrder);
    return code;
  }
  if (typeDefAny.type === "array") {
    const itemType = getElementTypeScriptType(typeDefAny.items, schema);
    const docLines = getFieldDocumentation({ ...typeDefAny, name: typeName }, schema);
    let code = generateJSDoc(docLines);
    code += `export type ${typeName} = ${itemType}[];

`;
    code += generateTypeAliasEncoder(typeName, typeDefAny, schema, globalEndianness, globalBitOrder);
    code += `

`;
    code += generateTypeAliasDecoder(typeName, typeDefAny, schema, globalEndianness, globalBitOrder);
    return code;
  }
  if (isTypeAlias(typeDef)) {
    return generateTypeAliasCode(typeName, typeDef, schema, globalEndianness, globalBitOrder);
  }
  const interfaceCode = generateInterfaces(typeName, typeDef, schema);
  const encoderCode = generateEncoder(typeName, typeDef, schema, globalEndianness, globalBitOrder);
  const decoderCode = generateDecoder(typeName, typeDef, schema, globalEndianness, globalBitOrder, addTraceLogs);
  const sections = [interfaceCode];
  const enumCode = generateDiscriminatedUnionEnumsForFields(typeName, fields);
  if (enumCode) {
    sections.push(enumCode);
  }
  const typeDefWithInstances = typeDef;
  if (typeDefWithInstances.instances && Array.isArray(typeDefWithInstances.instances) && typeDefWithInstances.instances.length > 0) {
    const instanceClassCode = generateInstanceClass(typeName, typeDef, schema, globalEndianness, globalBitOrder);
    sections.push(instanceClassCode);
  }
  sections.push(encoderCode, decoderCode);
  return sections.filter(Boolean).join(`

`);
}
function generateFieldAccessPath(path) {
  const parts = path.split(".");
  if (parts[0] === "_root") {
    return "this._root." + parts.slice(1).join(".");
  } else {
    return "this." + parts.join(".");
  }
}
function generateInstanceClass(typeName, typeDef, schema, globalEndianness, globalBitOrder) {
  const typeDefAny = typeDef;
  const instances = typeDefAny.instances || [];
  const fields = getTypeFields(typeDef);
  let code = `class ${typeName}Instance implements ${typeName} {
`;
  code += `  private _decoder!: BitStreamDecoder;
`;
  code += `  private _lazyCache!: Map<string, any>;
`;
  code += `  private _evaluating!: Set<string>;
`;
  code += `  private _root!: any;

`;
  for (const field of fields) {
    const fieldType = getFieldTypeScriptType2(field, schema);
    code += `  ${field.name}: ${fieldType};
`;
  }
  code += `
`;
  code += `  constructor(decoder: BitStreamDecoder, sequenceData: any, root?: any) {
`;
  code += `    // Make internal properties non-enumerable to avoid cyclic JSON issues
`;
  code += `    Object.defineProperty(this, '_decoder', { value: decoder, enumerable: false });
`;
  code += `    Object.defineProperty(this, '_lazyCache', { value: new Map(), enumerable: false });
`;
  code += `    Object.defineProperty(this, '_evaluating', { value: new Set(), enumerable: false });
`;
  code += `    Object.defineProperty(this, '_root', { value: root || this, enumerable: false });

`;
  for (const field of fields) {
    code += `    this.${field.name} = sequenceData.${field.name};
`;
  }
  code += `  }

`;
  code = code.replace(`  }

`, "");
  for (const instance of instances) {
    const instanceType = resolveInstanceType(instance.type, schema);
    code += `
    // Define enumerable getter for lazy field '${instance.name}'
`;
    code += `    Object.defineProperty(this, '${instance.name}', {
`;
    code += `      enumerable: true,
`;
    code += `      get: () => {
`;
    code += `        // Check for circular reference
`;
    code += `        if (this._evaluating.has('${instance.name}')) {
`;
    code += `          throw new Error(\`Circular reference detected: field '${instance.name}' references itself during evaluation\`);
`;
    code += `        }

`;
    code += `        if (!this._lazyCache.has('${instance.name}')) {
`;
    code += `          this._evaluating.add('${instance.name}');
`;
    code += `          try {
`;
    const position = instance.position;
    if (typeof position === "number") {
      if (position < 0) {
        code += `          const position = this._decoder['bytes'].length + (${position});
`;
      } else {
        code += `          const position = ${position};
`;
      }
    } else {
      const accessPath = generateFieldAccessPath(position);
      code += `          const position = ${accessPath};
`;
      code += `          if (typeof position !== 'number' && typeof position !== 'bigint') {
`;
      code += `            throw new Error(\`Field reference '${position}' does not resolve to a numeric value (got \${typeof position})\`);
`;
      code += `          }
`;
    }
    if (instance.alignment) {
      code += `
          // Validate alignment
`;
      code += `          if (position % ${instance.alignment} !== 0) {
`;
      code += `            throw new Error(\`Position \${position} is not aligned to ${instance.alignment} bytes (\${position} % ${instance.alignment} = \${position % ${instance.alignment}})\`);
`;
      code += `          }
`;
    }
    code += `
          this._decoder.seek(position);

`;
    if (isInlineDiscriminatedUnion2(instance.type)) {
      const union2 = instance.type;
      if (union2.discriminator.field) {
        const fieldAccessPath = generateFieldAccessPath(union2.discriminator.field);
        code += `            const discriminatorValue = ${fieldAccessPath};
`;
      } else if (union2.discriminator.peek) {
        const peekType = union2.discriminator.peek;
        const endianness = union2.discriminator.endianness || "little_endian";
        const isBigEndian = endianness === "big_endian";
        if (peekType === "uint8") {
          code += `            const discriminatorValue = this._decoder['bytes'][Number(position)];
`;
        } else if (peekType === "uint16") {
          code += `            const discriminatorValue = ${isBigEndian ? `(this._decoder['bytes'][Number(position)] << 8) | this._decoder['bytes'][Number(position) + 1]` : `this._decoder['bytes'][Number(position)] | (this._decoder['bytes'][Number(position) + 1] << 8)`};
`;
        } else if (peekType === "uint32") {
          code += `            const discriminatorValue = ${isBigEndian ? `(this._decoder['bytes'][Number(position)] << 24) | (this._decoder['bytes'][Number(position) + 1] << 16) | (this._decoder['bytes'][Number(position) + 2] << 8) | this._decoder['bytes'][Number(position) + 3]` : `this._decoder['bytes'][Number(position)] | (this._decoder['bytes'][Number(position) + 1] << 8) | (this._decoder['bytes'][Number(position) + 2] << 16) | (this._decoder['bytes'][Number(position) + 3] << 24)`} >>> 0;
`;
        }
      }
      code += `            let value: any;
`;
      for (let i = 0;i < union2.variants.length; i++) {
        const variant = union2.variants[i];
        const isLast = i === union2.variants.length - 1;
        const isFallback = !variant.when;
        if (isFallback) {
          code += `            // Default/fallback variant
`;
          code += `            {
`;
        } else {
          const condition = variant.when.replace(/\bvalue\b/g, "discriminatorValue");
          code += `            ${i === 0 ? "if" : "else if"} (${condition}) {
`;
        }
        code += `              const decoder = new ${variant.type}Decoder(this._decoder['bytes'].slice(Number(position)), { _root: this._root, _rootDecoder: this._decoder });
`;
        code += `              value = { type: '${variant.type}', value: decoder.decode() };
`;
        code += `            }`;
        if (!isFallback && isLast) {
          code += ` else {
`;
          code += `              throw new Error(\`Unknown discriminator value for instance '${instance.name}': \${discriminatorValue}\`);
`;
          code += `            }`;
        }
        code += `
`;
      }
      code += `            this._lazyCache.set('${instance.name}', value);
`;
    } else {
      code += `            const decoder = new ${instance.type}Decoder(this._decoder['bytes'].slice(Number(position)), { _root: this._root, _rootDecoder: this._decoder });
`;
      code += `            const value = decoder.decode();
`;
      code += `            this._lazyCache.set('${instance.name}', value);
`;
    }
    code += `          } finally {
`;
    code += `            this._evaluating.delete('${instance.name}');
`;
    code += `          }
`;
    code += `        }
`;
    code += `        return this._lazyCache.get('${instance.name}')!;
`;
    code += `      }
`;
    code += `    });
`;
  }
  code += `  }
`;
  code += `}`;
  return code;
}
function generateTypeAliasCode(typeName, typeDef, schema, globalEndianness, globalBitOrder) {
  const aliasedType = typeDef;
  const tsType = getElementTypeScriptType(aliasedType, schema);
  const sections = [];
  const aliasDocString = generateJSDoc(getFieldDocumentation({ ...aliasedType, name: typeName }, schema));
  if (aliasDocString) {
    sections.push(aliasDocString.trimEnd());
  }
  sections.push(`export type ${typeName} = ${tsType};`);
  if (aliasedType.type === "discriminated_union") {
    const enumName = `${typeName}Variant`;
    const enumCode = generateDiscriminatedUnionEnum(aliasedType, enumName, "", typeName);
    if (enumCode) {
      sections.push(enumCode.trimEnd());
    }
  }
  sections.push(generateTypeAliasEncoder(typeName, aliasedType, schema, globalEndianness, globalBitOrder));
  sections.push(generateTypeAliasDecoder(typeName, aliasedType, schema, globalEndianness, globalBitOrder));
  return sections.filter(Boolean).join(`

`);
}
function getElementTypeScriptType(element, schema) {
  if (!element || typeof element !== "object") {
    return "any";
  }
  if ("type" in element) {
    switch (element.type) {
      case "bit":
      case "uint8":
      case "uint16":
      case "uint32":
      case "int8":
      case "int16":
      case "int32":
      case "varlength":
      case "float32":
      case "float64":
        return "number";
      case "uint64":
      case "int64":
        return "bigint";
      case "array":
        const itemType = getElementTypeScriptType(element.items, schema);
        return `${itemType}[]`;
      case "string":
        return "string";
      case "discriminated_union":
        return generateDiscriminatedUnionType2(element, schema);
      case "choice":
        return generateChoiceType(element, schema);
      case "back_reference":
        return resolveTypeReference2(element.target_type, schema);
      default:
        return resolveTypeReference2(element.type, schema);
    }
  }
  return "any";
}
function generateChoiceType(choiceDef, schema) {
  const choices = [];
  for (const choice of choiceDef.choices) {
    const choiceType = resolveTypeReference2(choice.type, schema);
    choices.push(`(${choiceType} & { type: '${choice.type}' })`);
  }
  return `
  | ` + choices.join(`
  | `);
}
function generateDiscriminatedUnionType2(unionDef, schema) {
  const variants = [];
  for (const variant of unionDef.variants) {
    const variantType = resolveTypeReference2(variant.type, schema);
    variants.push(`{ type: '${variant.type}'; value: ${variantType} }`);
  }
  return `
  | ` + variants.join(`
  | `);
}
function generateDiscriminatedUnionEnum(unionDef, enumName, indent = "", targetLabel) {
  const variants = Array.isArray(unionDef?.variants) ? unionDef.variants : [];
  if (variants.length === 0) {
    return "";
  }
  const docLabel = targetLabel ?? enumName;
  const doc2 = generateJSDoc(`Variant tags for ${docLabel}`, indent);
  const entries = variants.map((variant) => {
    const memberName = sanitizeEnumMemberName(variant.type);
    return `${indent}  ${memberName} = '${variant.type}',`;
  }).join(`
`);
  let code = doc2;
  code += `${indent}export const enum ${enumName} {
`;
  code += `${entries}
`;
  code += `${indent}}
`;
  return code;
}
function generateTypeAliasEncoder(typeName, aliasedType, schema, globalEndianness, globalBitOrder) {
  let code = `export class ${typeName}Encoder extends BitStreamEncoder {
`;
  code += `  private compressionDict: Map<string, number> = new Map();

`;
  code += `  constructor() {
`;
  code += `    super("${globalBitOrder}");
`;
  code += `  }

`;
  const hasContext = schemaRequiresContext(schema);
  const contextParam = hasContext ? ", context: EncodingContext = EMPTY_CONTEXT" : "";
  code += `  encode(value: ${typeName}Input${contextParam}): Uint8Array {
`;
  code += `    // Reset compression dictionary for each encode
`;
  code += `    this.compressionDict.clear();

`;
  const pseudoField = { ...aliasedType, name: "value" };
  code += generateEncodeFieldCoreImpl(pseudoField, schema, globalEndianness, "value", "    ");
  code += `    return this.finish();
`;
  code += `  }
`;
  code += generateCalculateSizeMethod(typeName, [pseudoField], schema, globalEndianness, hasContext);
  code += `}`;
  return code;
}
function generateTypeAliasDecoder(typeName, aliasedType, schema, globalEndianness, globalBitOrder) {
  let code = `export class ${typeName}Decoder extends SeekableBitStreamDecoder {
`;
  code += `  constructor(input: Uint8Array | number[] | string) {
`;
  code += `    const reader = createReader(input);
`;
  code += `    super(reader, "${globalBitOrder}");
`;
  code += `  }

`;
  code += `  decode(): ${typeName}Output {
`;
  if ("type" in aliasedType) {
    switch (aliasedType.type) {
      case "array":
        code += `    let value: any = {};
`;
        code += generateDecodeFieldCoreImpl({ ...aliasedType, name: "result" }, schema, globalEndianness, "result", "    ");
        code += `    return value.result;
`;
        break;
      default:
        code += `    let value: any = {};
`;
        code += generateDecodeFieldCoreImpl({ ...aliasedType, name: "result" }, schema, globalEndianness, "result", "    ");
        code += `    return value.result;
`;
    }
  }
  code += `  }
`;
  code += `}`;
  return code;
}
function generateDiscriminatedUnionEnumsForFields(typeName, fields) {
  const enums = [];
  for (const field of fields) {
    const fieldAny = field;
    if (fieldAny && fieldAny.type === "discriminated_union") {
      const enumName = `${typeName}${capitalize(fieldAny.name)}Variant`;
      const enumCode = generateDiscriminatedUnionEnum(fieldAny, enumName, "", `${typeName}.${fieldAny.name}`);
      if (enumCode) {
        enums.push(enumCode.trimEnd());
      }
    }
  }
  return enums.join(`

`);
}
function getFieldTypeScriptType2(field, schema) {
  if (!field || typeof field !== "object") {
    return "any";
  }
  if ("type" in field) {
    switch (field.type) {
      case "bit":
      case "uint8":
      case "uint16":
      case "uint32":
      case "int8":
      case "int16":
      case "int32":
      case "varlength":
      case "float32":
      case "float64":
        return "number";
      case "uint64":
      case "int64":
        return "bigint";
      case "array":
        const itemType = getFieldTypeScriptType2(field.items, schema);
        return `${itemType}[]`;
      case "string":
        return "string";
      case "bitfield":
        return `{ ${field.fields.map((f) => `${f.name}: number`).join(", ")} }`;
      case "discriminated_union":
        return generateDiscriminatedUnionType2(field, schema);
      case "back_reference":
        return resolveTypeReference2(field.target_type, schema);
      case "optional":
        const valueType = resolveTypeReference2(field.value_type, schema);
        return `${valueType} | undefined`;
      default:
        return resolveTypeReference2(field.type, schema);
    }
  }
  return "any";
}
function resolveInstanceType(instanceType, schema) {
  if (typeof instanceType === "string") {
    return resolveTypeReference2(instanceType, schema);
  }
  return generateDiscriminatedUnionType2(instanceType, schema);
}
function isInlineDiscriminatedUnion2(instanceType) {
  return typeof instanceType === "object" && instanceType !== null && "discriminator" in instanceType && "variants" in instanceType;
}
function resolveTypeReference2(typeRef, schema) {
  if (!typeRef) {
    throw new Error("resolveTypeReference called with undefined typeRef");
  }
  const genericMatch = typeRef.match(/^(\w+)<(.+)>$/);
  if (genericMatch) {
    const [, genericType, typeArg] = genericMatch;
    const templateDef = schema.types[`${genericType}<T>`];
    if (templateDef) {
      const templateFields = getTypeFields(templateDef);
      const fields = [];
      for (const field of templateFields) {
        let fieldType;
        if ("type" in field && field.type === "T") {
          fieldType = getFieldTypeScriptType2({ ...field, type: typeArg }, schema);
        } else {
          fieldType = getFieldTypeScriptType2(field, schema);
        }
        const optional2 = isFieldConditional2(field) ? "?" : "";
        fields.push(`${field.name}${optional2}: ${fieldType}`);
      }
      return `{ ${fields.join(", ")} }`;
    }
  }
  return sanitizeTypeName(typeRef);
}
function isFieldConditional2(field) {
  return "conditional" in field && field.conditional !== undefined;
}
function convertConditionalToTypeScript2(condition, basePath = "value") {
  const numberLiteralRegex = /(?<![\w$])(-?(?:0x[0-9a-fA-F]+|0b[01]+|0o[0-7]+|\d+(?:\.\d+)?))(?![\w$])/g;
  let expression = condition.replace(numberLiteralRegex, (match) => `__bs_literal(${match})`);
  const reservedIdentifiers = new Set([
    "true",
    "false",
    "null",
    "undefined",
    "BigInt",
    "Number",
    "Math",
    "__bs_literal",
    "__bs_numeric",
    "__bs_get",
    "__bs_checkCondition"
  ]);
  const identifierRegex = /\b([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*)\b/g;
  expression = expression.replace(identifierRegex, (match) => {
    if (reservedIdentifiers.has(match)) {
      return match;
    }
    if (/^\d/.test(match)) {
      return match;
    }
    if (match === basePath || match.startsWith(`${basePath}.`)) {
      return `__bs_numeric(__bs_get(() => ${match}))`;
    }
    return `__bs_numeric(__bs_get(() => ${basePath}.${match}))`;
  });
  return `__bs_checkCondition(() => (${expression}))`;
}
function generateEncoder(typeName, typeDef, schema, globalEndianness, globalBitOrder) {
  const fields = getTypeFields(typeDef);
  let code = `export class ${typeName}Encoder extends BitStreamEncoder {
`;
  code += `  private compressionDict: Map<string, number> = new Map();
`;
  for (const field of fields) {
    if ("type" in field && field.type === "array") {
      const fieldName = field.name;
      const sameIndexTypes = detectCorrespondingTracking(field, schema) || new Set;
      const firstLastTypes = detectFirstLastTracking(fieldName, schema);
      const trackingTypes = new Set([...sameIndexTypes, ...firstLastTypes]);
      if (trackingTypes.size > 0) {
        for (const typeName2 of trackingTypes) {
          code += `  private _positions_${fieldName}_${typeName2}: number[] = [];
`;
        }
        if (sameIndexTypes.size > 0) {
          const choices = field.items?.choices || [];
          for (const choice of choices) {
            code += `  private _index_${fieldName}_${choice.type}: number = 0;
`;
          }
        }
      }
    }
  }
  code += `
  constructor() {
`;
  code += `    super("${globalBitOrder}");
`;
  code += `  }

`;
  const hasContext = schemaRequiresContext(schema);
  const contextParam = hasContext ? ", context: EncodingContext = EMPTY_CONTEXT" : "";
  code += `  encode(value: ${typeName}Input${contextParam}): Uint8Array {
`;
  code += `    // Reset compression dictionary for each encode
`;
  code += `    this.compressionDict.clear();

`;
  const computedFields = fields.filter((f) => f.computed);
  if (computedFields.length > 0) {
    code += `    // Validate: error if user bypassed TypeScript and provided computed fields
`;
    for (const field of computedFields) {
      code += `    if ((value as any).${field.name} !== undefined) {
`;
      code += `      throw new Error("Field '${field.name}' is computed and cannot be set manually");
`;
      code += `    }
`;
    }
    code += `
`;
  }
  for (let i = 0;i < fields.length; i++) {
    const field = fields[i];
    if ("type" in field && field.type === "array") {
      const fieldName = field.name;
      const firstLastTypes = detectFirstLastTracking(fieldName, schema);
      if (firstLastTypes.size > 0) {
        code += `    // Pre-pass: track positions for ${fieldName} array (first/last selectors)
`;
        code += `    this._positions_${fieldName}_${[...firstLastTypes][0]} = [];
`;
        code += `    let value_${fieldName}_offset = this.byteOffset;
`;
        for (let j = 0;j < i; j++) {
          const precedingField = fields[j];
          if (precedingField.computed) {
            continue;
          }
          const precedingFieldType = precedingField.type;
          if (precedingFieldType && schema.types[precedingFieldType]) {
            if (schemaRequiresContext(schema)) {
              const prepassContextVarName = `prepassContext_${precedingField.name}`;
              code += `    // Extend context for pre-pass encoding of nested type
`;
              code += `    const ${prepassContextVarName}: EncodingContext = {
`;
              code += `      ...context,
`;
              code += `      parents: [
`;
              code += `        ...context.parents,
`;
              code += `        value
`;
              code += `      ],
`;
              code += `      arrayIterations: context.arrayIterations,
`;
              code += `      positions: context.positions
`;
              code += `    };
`;
              code += `    const temp_${precedingField.name}_enc = new ${precedingFieldType}Encoder();
`;
              code += `    value_${fieldName}_offset += temp_${precedingField.name}_enc.encode(value.${precedingField.name}, ${prepassContextVarName}).length;
`;
            } else {
              code += `    const temp_${precedingField.name}_enc = new ${precedingFieldType}Encoder();
`;
              code += `    value_${fieldName}_offset += temp_${precedingField.name}_enc.encode(value.${precedingField.name}).length;
`;
            }
          }
        }
        if (field.items?.type !== "choice") {
          const itemType = field.items?.type;
          if (itemType && firstLastTypes.has(itemType)) {
            code += `    for (let ${fieldName}_prepass_i = 0; ${fieldName}_prepass_i < value.${fieldName}.length; ${fieldName}_prepass_i++) {
`;
            code += `      const item = value.${fieldName}[${fieldName}_prepass_i];
`;
            if (schemaRequiresContext(schema)) {
              code += `      // Extend context for array iteration
`;
              code += `      const itemContext: EncodingContext = {
`;
              code += `        ...context,
`;
              code += `        parents: [
`;
              code += `          ...context.parents,
`;
              code += `          { ${fieldName}: value.${fieldName} }
`;
              code += `        ],
`;
              code += `        arrayIterations: {
`;
              code += `          ...context.arrayIterations,
`;
              code += `          ${fieldName}: {
`;
              code += `            items: value.${fieldName},
`;
              code += `            index: ${fieldName}_prepass_i,
`;
              code += `            fieldName: '${fieldName}'
`;
              code += `          }
`;
              code += `        }
`;
              code += `      };
`;
            }
            code += `      this._positions_${fieldName}_${itemType}.push(value_${fieldName}_offset);
`;
            code += `      // Encode to temp to measure size
`;
            code += `      const temp_enc = new ${itemType}Encoder();
`;
            const contextParam2 = schemaRequiresContext(schema) ? ", itemContext" : "";
            code += `      value_${fieldName}_offset += temp_enc.encode(item${contextParam2}).length;
`;
            code += `    }

`;
          }
        }
      }
    }
  }
  const needsAccumulatedContext = hasContext && fields.filter((f) => ("type" in f) && f.type === "array").length >= 1;
  if (needsAccumulatedContext) {
    code += `    // Accumulated context for sibling array corresponding correlation
`;
    code += `    let currentContext: EncodingContext = context;
`;
    for (let i = 0;i < fields.length; i++) {
      const field = fields[i];
      if ("type" in field && field.type === "array") {
        const fieldName = field.name;
        const firstLastTypes = detectFirstLastTracking(fieldName, schema);
        if (firstLastTypes.size > 0) {
          for (const itemType of firstLastTypes) {
            code += `    currentContext.positions.set('${fieldName}_${itemType}', this._positions_${fieldName}_${itemType});
`;
          }
        }
      }
    }
    code += `
`;
  }
  const fromAfterFieldRanges = [];
  for (let i = 0;i < fields.length; i++) {
    const fieldAny = fields[i];
    if (fieldAny.computed?.type === "length_of" && fieldAny.computed.from_after_field) {
      const fromAfterIndex = fields.findIndex((f) => f.name === fieldAny.computed.from_after_field);
      if (fromAfterIndex !== -1) {
        fromAfterFieldRanges.push({
          lengthFieldIndex: i,
          fromAfterFieldIndex: fromAfterIndex
        });
      }
    }
  }
  for (let i = 0;i < fields.length; i++) {
    const field = fields[i];
    const isArray = "type" in field && field.type === "array";
    const isChoiceArray = isArray && field.items?.type === "choice";
    const baseContextVarForField = needsAccumulatedContext ? "currentContext" : "context";
    const isEncodedByFromAfterField = fromAfterFieldRanges.some((range) => i > range.lengthFieldIndex && i > range.fromAfterFieldIndex);
    if (isEncodedByFromAfterField) {
      continue;
    }
    code += generateEncodeField(field, schema, globalEndianness, "    ", typeName, fields, baseContextVarForField);
    if (needsAccumulatedContext && isArray) {
      const fieldName = field.name;
      const typeIndicesRef = isChoiceArray ? `value_${fieldName}_typeIndices` : `new Map<string, number>()`;
      code += `    // Preserve ${fieldName} array context for sibling arrays
`;
      code += `    currentContext = {
`;
      code += `      ...currentContext,
`;
      code += `      arrayIterations: {
`;
      code += `        ...currentContext.arrayIterations,
`;
      code += `        ${fieldName}: {
`;
      code += `          items: value.${fieldName},
`;
      code += `          index: value.${fieldName}.length - 1,
`;
      code += `          fieldName: '${fieldName}',
`;
      code += `          typeIndices: ${typeIndicesRef}
`;
      code += `        }
`;
      code += `      }
`;
      code += `    };

`;
    }
  }
  code += `    return this.finish();
`;
  code += `  }
`;
  code += generateCalculateSizeMethod(typeName, fields, schema, globalEndianness, hasContext);
  code += `}`;
  return code;
}
function generateEncodeField(field, schema, globalEndianness, indent, typeName, allFields, baseContextVar) {
  if (!("type" in field))
    return "";
  const fieldAny = field;
  const fieldName = field.name;
  if (fieldAny.computed) {
    return generateEncodeComputedField(field, schema, globalEndianness, indent, undefined, typeName, allFields);
  }
  if (fieldAny.const !== undefined) {
    const constValue = fieldAny.const;
    return generateEncodeFieldCoreImpl(field, schema, globalEndianness, constValue.toString(), indent, undefined, baseContextVar);
  }
  const valuePath = `value.${fieldName}`;
  return generateEncodeFieldCore(field, schema, globalEndianness, valuePath, indent, undefined, undefined, baseContextVar);
}
function generateEncodeFieldCore(field, schema, globalEndianness, valuePath, indent, typeName, containingFields, baseContextVar) {
  if (!("type" in field))
    return "";
  const fieldAny = field;
  const fieldName = field.name;
  let code = "";
  const isSpecialField = fieldAny.computed || fieldAny.const !== undefined;
  const startPosVar = `${fieldName}_startPos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  if (!isSpecialField) {
    code += `${indent}const ${startPosVar} = this.byteOffset;
`;
    code += `${indent}this.logFieldStart("${fieldName}", "${indent}");
`;
  }
  if (fieldAny.computed) {
    const lastDotIndex = valuePath.lastIndexOf(".");
    const baseObjectPath = lastDotIndex > 0 ? valuePath.substring(0, lastDotIndex) : "value";
    code += generateEncodeComputedField(field, schema, globalEndianness, indent, baseObjectPath, typeName, containingFields);
  } else if (fieldAny.const !== undefined) {
    const constValue = fieldAny.const;
    code += generateEncodeFieldCoreImpl(field, schema, globalEndianness, constValue.toString(), indent, undefined, baseContextVar);
  } else if (isFieldConditional2(field)) {
    const condition = field.conditional;
    const lastDotIndex = valuePath.lastIndexOf(".");
    const basePath = lastDotIndex > 0 ? valuePath.substring(0, lastDotIndex) : "value";
    const tsCondition = convertConditionalToTypeScript2(condition, basePath);
    code += `${indent}if (${tsCondition} && ${valuePath} !== undefined) {
`;
    code += generateEncodeFieldCoreImpl(field, schema, globalEndianness, valuePath, indent + "  ", undefined, baseContextVar);
    code += `${indent}}
`;
  } else {
    code += generateEncodeFieldCoreImpl(field, schema, globalEndianness, valuePath, indent, undefined, baseContextVar);
  }
  if (!isSpecialField) {
    code += `${indent}this.logFieldEnd("${fieldName}", ${startPosVar}, "${indent}");
`;
  }
  return code;
}
function generateEncodeFieldCoreImpl(field, schema, globalEndianness, valuePath, indent, contextVarName, baseContextVar) {
  if (!("type" in field))
    return "";
  const endianness = "endianness" in field && field.endianness ? field.endianness : globalEndianness;
  switch (field.type) {
    case "bit":
      return `${indent}this.writeBits(${valuePath}, ${field.size});
`;
    case "uint8":
      return `${indent}this.writeUint8(${valuePath});
`;
    case "uint16":
      return `${indent}this.writeUint16(${valuePath}, "${endianness}");
`;
    case "uint32":
      return `${indent}this.writeUint32(${valuePath}, "${endianness}");
`;
    case "uint64":
      return `${indent}this.writeUint64(${valuePath}, "${endianness}");
`;
    case "int8":
      return `${indent}this.writeInt8(${valuePath});
`;
    case "int16":
      return `${indent}this.writeInt16(${valuePath}, "${endianness}");
`;
    case "int32":
      return `${indent}this.writeInt32(${valuePath}, "${endianness}");
`;
    case "int64":
      return `${indent}this.writeInt64(${valuePath}, "${endianness}");
`;
    case "varlength": {
      const encoding = "encoding" in field ? field.encoding : "der";
      const methodMap = {
        der: "writeVarlengthDER",
        leb128: "writeVarlengthLEB128",
        ebml: "writeVarlengthEBML",
        vlq: "writeVarlengthVLQ"
      };
      const method = methodMap[encoding];
      return `${indent}this.${method}(${valuePath});
`;
    }
    case "float32":
      return `${indent}this.writeFloat32(${valuePath}, "${endianness}");
`;
    case "float64":
      return `${indent}this.writeFloat64(${valuePath}, "${endianness}");
`;
    case "array":
      return generateEncodeArray(field, schema, globalEndianness, valuePath, indent, generateEncodeFieldCoreImpl, baseContextVar || "context");
    case "string":
      return generateEncodeString(field, globalEndianness, valuePath, indent);
    case "bitfield":
      return generateEncodeBitfield(field, valuePath, indent);
    case "discriminated_union":
      return generateEncodeDiscriminatedUnion(field, schema, globalEndianness, valuePath, indent, contextVarName);
    case "choice":
      return generateEncodeChoice(field, schema, globalEndianness, valuePath, indent, contextVarName);
    case "back_reference":
      return generateEncodeBackReference(field, schema, globalEndianness, valuePath, indent, generateEncodeTypeReference);
    case "optional":
      return generateEncodeOptional(field, schema, globalEndianness, valuePath, indent);
    case "padding": {
      const alignTo = field.align_to;
      let code = "";
      code += `${indent}// Alignment padding to ${alignTo}-byte boundary
`;
      code += `${indent}{
`;
      code += `${indent}  const currentPos = this.getBytePosition();
`;
      code += `${indent}  const paddingBytes = (${alignTo} - (currentPos % ${alignTo})) % ${alignTo};
`;
      code += `${indent}  for (let i = 0; i < paddingBytes; i++) {
`;
      code += `${indent}    this.writeUint8(0);
`;
      code += `${indent}  }
`;
      code += `${indent}}
`;
      return code;
    }
    default:
      return generateEncodeTypeReference(field.type, schema, globalEndianness, valuePath, indent, contextVarName, baseContextVar);
  }
}
function generateEncodeChoice(field, schema, globalEndianness, valuePath, indent, contextVarName = "extendedContext") {
  let code = "";
  const choices = field.choices || [];
  const useEncoderClasses = schemaRequiresContext(schema);
  for (let i = 0;i < choices.length; i++) {
    const choice = choices[i];
    const ifKeyword = i === 0 ? "if" : "else if";
    code += `${indent}${ifKeyword} (${valuePath}.type === '${choice.type}') {
`;
    if (useEncoderClasses) {
      code += `${indent}  const encoder = new ${choice.type}Encoder();
`;
      code += `${indent}  const encoded = encoder.encode(${valuePath} as ${choice.type}, ${contextVarName});
`;
      code += `${indent}  for (const byte of encoded) {
`;
      code += `${indent}    this.writeUint8(byte);
`;
      code += `${indent}  }
`;
    } else {
      code += generateEncodeTypeReference(choice.type, schema, globalEndianness, valuePath, indent + "  ");
    }
    code += `${indent}}`;
    if (i < choices.length - 1) {
      code += `
`;
    }
  }
  code += ` else {
`;
  code += `${indent}  throw new Error(\`Unknown variant type: \${(${valuePath} as any).type}\`);
`;
  code += `${indent}}
`;
  return code;
}
function generateDecodeChoice(field, schema, globalEndianness, fieldName, indent, addTraceLogs = false) {
  const target = getTargetPath(fieldName);
  let code = "";
  if (addTraceLogs) {
    code += `${indent}console.log('[TRACE] Decoding choice field ${fieldName}');
`;
  }
  const choices = field.choices || [];
  let discriminatorType = null;
  let discriminatorEndianness = null;
  if (choices.length > 0) {
    const firstChoiceType = schema.types[choices[0].type];
    if (firstChoiceType && "sequence" in firstChoiceType && firstChoiceType.sequence.length > 0) {
      const firstField = firstChoiceType.sequence[0];
      discriminatorType = firstField.type;
      discriminatorEndianness = firstField.endianness || globalEndianness;
    }
  }
  if (discriminatorType === "uint32") {
    const endian = discriminatorEndianness === "big_endian" ? "'big'" : "'little'";
    code += `${indent}const discriminator = this.peekUint32(${endian});
`;
  } else if (discriminatorType === "uint16") {
    const endian = discriminatorEndianness === "big_endian" ? "'big'" : "'little'";
    code += `${indent}const discriminator = this.peekUint16(${endian});
`;
  } else {
    code += `${indent}const discriminator = this.peekUint8();
`;
  }
  for (let i = 0;i < choices.length; i++) {
    const choice = choices[i];
    const ifKeyword = i === 0 ? "if" : "else if";
    const choiceTypeDef = schema.types[choice.type];
    let discriminatorValue = i + 1;
    if (choiceTypeDef && "sequence" in choiceTypeDef && choiceTypeDef.sequence.length > 0) {
      const firstField = choiceTypeDef.sequence[0];
      if ("const" in firstField && firstField.const !== undefined) {
        discriminatorValue = firstField.const;
      }
    }
    code += `${indent}${ifKeyword} (discriminator === 0x${discriminatorValue.toString(16)}) {
`;
    const baseObject = target.includes(".") ? target.split(".")[0] : "value";
    code += `${indent}  const decoder = new ${choice.type}Decoder(this.bytes.slice(this.byteOffset), ${baseObject});
`;
    code += `${indent}  const decodedValue = decoder.decode();
`;
    code += `${indent}  this.byteOffset += decoder.byteOffset;
`;
    code += `${indent}  ${target} = { ...decodedValue, type: '${choice.type}' };
`;
    code += `${indent}}`;
    if (i < choices.length - 1) {
      code += `
`;
    }
  }
  code += ` else {
`;
  code += `${indent}  throw new Error(\`Unknown choice discriminator: 0x\${discriminator.toString(16)}\`);
`;
  code += `${indent}}
`;
  return code;
}
function generateEncodeDiscriminatedUnion(field, schema, globalEndianness, valuePath, indent, contextVarName = "context") {
  let code = "";
  const variants = field.variants || [];
  for (let i = 0;i < variants.length; i++) {
    const variant = variants[i];
    const ifKeyword = i === 0 ? "if" : "else if";
    code += `${indent}${ifKeyword} (${valuePath}.type === '${variant.type}') {
`;
    const variantTypeDef = schema.types[variant.type];
    const isBackReference = variantTypeDef && variantTypeDef.type === "back_reference";
    if (!isBackReference) {
      const variantTypeDef2 = schema.types[variant.type];
      const isStringType = variantTypeDef2 && variantTypeDef2.type === "string";
      if (isStringType) {
        code += `${indent}  const valueKey = JSON.stringify(${valuePath}.value);
`;
        code += `${indent}  // Use shared compression dict from context (if available) for cross-encoder compression
`;
        code += `${indent}  const compressionDict = ${contextVarName}?.compressionDict || this.compressionDict;
`;
        code += `${indent}  const currentOffset = (${contextVarName}?.byteOffset || 0) + this.byteOffset;
`;
        code += `${indent}  compressionDict.set(valueKey, currentOffset);
`;
      }
    }
    code += generateEncodeTypeReference(variant.type, schema, globalEndianness, `${valuePath}.value`, indent + "  ");
    code += `${indent}}`;
    if (i < variants.length - 1) {
      code += `
`;
    }
  }
  code += ` else {
`;
  code += `${indent}  throw new Error(\`Unknown variant type: \${(${valuePath} as any).type}\`);
`;
  code += `${indent}}
`;
  return code;
}
function generateEncodeOptional(field, schema, globalEndianness, valuePath, indent) {
  const valueType = field.value_type;
  const presenceType = field.presence_type || "uint8";
  let code = "";
  code += `${indent}if (${valuePath} === undefined || ${valuePath} === null) {
`;
  if (presenceType === "uint8") {
    code += `${indent}  this.writeUint8(0);
`;
  } else if (presenceType === "bit") {
    code += `${indent}  this.writeBits(0, 1);
`;
  }
  code += `${indent}} else {
`;
  if (presenceType === "uint8") {
    code += `${indent}  this.writeUint8(1);
`;
  } else if (presenceType === "bit") {
    code += `${indent}  this.writeBits(1, 1);
`;
  }
  const syntheticField = {
    type: valueType,
    name: field.name
  };
  if (field.endianness) {
    syntheticField.endianness = field.endianness;
  }
  code += generateEncodeFieldCoreImpl(syntheticField, schema, globalEndianness, valuePath, indent + "  ");
  code += `${indent}}
`;
  return code;
}
function generateEncodeTypeReference(typeRef, schema, globalEndianness, valuePath, indent, contextVarName, baseContextVar) {
  if (!typeRef) {
    throw new Error(`generateEncodeTypeReference called with undefined typeRef for ${valuePath}`);
  }
  const genericMatch = typeRef.match(/^(\w+)<(.+)>$/);
  if (genericMatch) {
    const [, genericType, typeArg] = genericMatch;
    const templateDef = schema.types[`${genericType}<T>`];
    if (templateDef) {
      const templateFields = getTypeFields(templateDef);
      let code2 = "";
      for (const field of templateFields) {
        const expandedField = JSON.parse(JSON.stringify(field).replace(/"T"/g, `"${typeArg}"`));
        const newValuePath = `${valuePath}.${field.name}`;
        code2 += generateEncodeFieldCore(expandedField, schema, globalEndianness, newValuePath, indent);
      }
      return code2;
    }
  }
  const typeDef = schema.types[typeRef];
  if (!typeDef) {
    throw new Error(`Unknown type '${typeRef}' - not found in schema.types and not a built-in primitive`);
  }
  const typeDefAny = typeDef;
  if (typeDefAny.type === "string") {
    const pseudoField = { ...typeDefAny, name: valuePath.split(".").pop() };
    return generateEncodeFieldCoreImpl(pseudoField, schema, globalEndianness, valuePath, indent);
  }
  if (typeDefAny.type === "array") {
    const pseudoField = { ...typeDefAny, name: valuePath.split(".").pop() };
    return generateEncodeFieldCoreImpl(pseudoField, schema, globalEndianness, valuePath, indent);
  }
  if (isTypeAlias(typeDef)) {
    const aliasedType = typeDef;
    const pseudoField = { ...aliasedType, name: valuePath.split(".").pop() };
    return generateEncodeFieldCoreImpl(pseudoField, schema, globalEndianness, valuePath, indent);
  }
  let code = "";
  const lastDot = valuePath.lastIndexOf(".");
  const fieldName = lastDot >= 0 ? valuePath.substring(lastDot + 1) : valuePath;
  const parentPath = lastDot >= 0 ? valuePath.substring(0, lastDot) : valuePath;
  const encoderVarName = `encoder_${fieldName}`;
  const encodedVarName = `encoded_${fieldName}`;
  if (schemaRequiresContext(schema)) {
    const baseContextVarName = baseContextVar || contextVarName || "context";
    const isInArrayContext = contextVarName && contextVarName.startsWith("extendedContext_");
    let contextToPass;
    if (isInArrayContext) {
      contextToPass = baseContextVarName;
      code += `${indent}// Use existing array context (already has parent)
`;
    } else {
      const nestedContextVarName = `extendedContext_${fieldName}`;
      contextToPass = nestedContextVarName;
      code += `${indent}// Extend context for nested type
`;
      code += generateNestedTypeContextExtension(fieldName, parentPath, indent, schema, baseContextVarName);
    }
    code += `${indent}const ${encoderVarName} = new ${typeRef}Encoder();
`;
    code += `${indent}const ${encodedVarName} = ${encoderVarName}.encode(${valuePath}, ${contextToPass});
`;
    code += `${indent}for (const byte of ${encodedVarName}) {
`;
    code += `${indent}  this.writeUint8(byte);
`;
    code += `${indent}}
`;
  } else {
    code += `${indent}const ${encoderVarName} = new ${typeRef}Encoder();
`;
    code += `${indent}const ${encodedVarName} = ${encoderVarName}.encode(${valuePath});
`;
    code += `${indent}for (const byte of ${encodedVarName}) {
`;
    code += `${indent}  this.writeUint8(byte);
`;
    code += `${indent}}
`;
  }
  return code;
}
function generateDecoder(typeName, typeDef, schema, globalEndianness, globalBitOrder, addTraceLogs = false) {
  const fields = getTypeFields(typeDef);
  const typeDefAny = typeDef;
  const hasInstances = typeDefAny.instances && Array.isArray(typeDefAny.instances) && typeDefAny.instances.length > 0;
  let code = `export class ${typeName}Decoder extends SeekableBitStreamDecoder {
`;
  code += `  constructor(input: Uint8Array | number[] | string, private context?: any) {
`;
  code += `    const reader = createReader(input);
`;
  code += `    super(reader, "${globalBitOrder}");
`;
  code += `  }

`;
  code += `  decode(): ${typeName}Output {
`;
  if (addTraceLogs) {
    code += `    console.log('[TRACE] Decoding ${typeName}');
`;
  }
  if (!hasInstances) {
    code += `    const value: any = {};

`;
    for (const field of fields) {
      code += generateDecodeField(field, schema, globalEndianness, "    ", addTraceLogs);
    }
    code += `    return value;
`;
  } else {
    code += generateDecoderWithLazyFields(typeName, fields, typeDefAny.instances, schema, globalEndianness, "    ", addTraceLogs);
  }
  code += `  }
`;
  code += `}`;
  return code;
}
function generateDecoderWithLazyFields(typeName, fields, instances, schema, globalEndianness, indent, addTraceLogs = false) {
  let code = "";
  code += `${indent}const sequenceData: any = {};

`;
  for (const field of fields) {
    code += generateDecodeField(field, schema, globalEndianness, indent, addTraceLogs).replace(/value\./g, "sequenceData.");
  }
  code += `
${indent}// Create instance with lazy getters for position fields
`;
  code += `${indent}// Pass root decoder (if available from context) so nested position fields can seek in full byte array
`;
  code += `${indent}const decoder = this.context?._rootDecoder || this;
`;
  code += `${indent}const root = this.context?._root;
`;
  code += `${indent}const instance = new ${typeName}Instance(decoder, sequenceData, root);
`;
  code += `${indent}return instance as ${typeName};
`;
  return code;
}
function generateDecodeField(field, schema, globalEndianness, indent, addTraceLogs = false) {
  if (!("type" in field))
    return "";
  const fieldName = field.name;
  let code = "";
  if (addTraceLogs) {
    code += `${indent}console.log('[TRACE] Decoding field: ${fieldName}');
`;
  }
  code += generateDecodeFieldCore(field, schema, globalEndianness, fieldName, indent, addTraceLogs);
  if (addTraceLogs) {
    code += `${indent}console.log('[TRACE] Decoded ${fieldName}:', value.${fieldName});
`;
  }
  return code;
}
function generateDecodeFieldCore(field, schema, globalEndianness, fieldName, indent, addTraceLogs = false) {
  if (!("type" in field))
    return "";
  if (isFieldConditional2(field)) {
    const condition = field.conditional;
    const targetPath = getTargetPath(fieldName);
    const lastDotIndex = targetPath.lastIndexOf(".");
    const basePath = lastDotIndex > 0 ? targetPath.substring(0, lastDotIndex) : "value";
    const tsCondition = convertConditionalToTypeScript2(condition, basePath);
    let code = `${indent}if (${tsCondition}) {
`;
    code += generateDecodeFieldCoreImpl(field, schema, globalEndianness, fieldName, indent + "  ", addTraceLogs);
    code += `${indent}}
`;
    return code;
  }
  return generateDecodeFieldCoreImpl(field, schema, globalEndianness, fieldName, indent, addTraceLogs);
}
function generateDecodeFieldCoreImpl(field, schema, globalEndianness, fieldName, indent, addTraceLogs = false) {
  if (!("type" in field))
    return "";
  const endianness = "endianness" in field && field.endianness ? field.endianness : globalEndianness;
  const isArrayItem = fieldName.endsWith(ARRAY_ITER_SUFFIX) || fieldName.includes(ARRAY_ITER_SUFFIX + ".");
  const target = isArrayItem ? fieldName : `value.${fieldName}`;
  switch (field.type) {
    case "bit":
      if (field.size > 53) {
        return `${indent}${target} = this.readBits(${field.size});
`;
      }
      return `${indent}${target} = Number(this.readBits(${field.size}));
`;
    case "uint8":
      return `${indent}${target} = this.readUint8();
`;
    case "uint16":
      return `${indent}${target} = this.readUint16("${endianness}");
`;
    case "uint32":
      return `${indent}${target} = this.readUint32("${endianness}");
`;
    case "uint64":
      return `${indent}${target} = this.readUint64("${endianness}");
`;
    case "int8":
      return `${indent}${target} = this.readInt8();
`;
    case "int16":
      return `${indent}${target} = this.readInt16("${endianness}");
`;
    case "int32":
      return `${indent}${target} = this.readInt32("${endianness}");
`;
    case "int64":
      return `${indent}${target} = this.readInt64("${endianness}");
`;
    case "varlength": {
      const encoding = "encoding" in field ? field.encoding : "der";
      const methodMap = {
        der: "readVarlengthDER",
        leb128: "readVarlengthLEB128",
        ebml: "readVarlengthEBML",
        vlq: "readVarlengthVLQ"
      };
      const method = methodMap[encoding];
      return `${indent}${target} = this.${method}();
`;
    }
    case "float32":
      return `${indent}${target} = this.readFloat32("${endianness}");
`;
    case "float64":
      return `${indent}${target} = this.readFloat64("${endianness}");
`;
    case "array":
      return generateDecodeArray(field, schema, globalEndianness, fieldName, indent, addTraceLogs, getTargetPath, generateDecodeFieldCore);
    case "string":
      return generateDecodeString(field, globalEndianness, fieldName, indent, addTraceLogs, getTargetPath);
    case "bitfield":
      return generateDecodeBitfield(field, fieldName, indent, getTargetPath);
    case "discriminated_union":
      return generateDecodeDiscriminatedUnion(field, schema, globalEndianness, fieldName, indent, addTraceLogs);
    case "choice":
      return generateDecodeChoice(field, schema, globalEndianness, fieldName, indent, addTraceLogs);
    case "back_reference":
      return generateDecodeBackReference(field, schema, globalEndianness, fieldName, indent, getTargetPath, generateDecodeTypeReference);
    case "optional":
      return generateDecodeOptional(field, schema, globalEndianness, fieldName, indent);
    case "padding": {
      const alignTo = field.align_to;
      let code = "";
      code += `${indent}// Skip alignment padding to ${alignTo}-byte boundary
`;
      code += `${indent}{
`;
      code += `${indent}  const currentPos = this.byteOffset;
`;
      code += `${indent}  const paddingBytes = (${alignTo} - (currentPos % ${alignTo})) % ${alignTo};
`;
      code += `${indent}  this.byteOffset += paddingBytes;
`;
      code += `${indent}}
`;
      return code;
    }
    default:
      return generateDecodeTypeReference(field.type, schema, globalEndianness, fieldName, indent);
  }
}
function generateDecodeDiscriminatedUnion(field, schema, globalEndianness, fieldName, indent, addTraceLogs = false) {
  const target = getTargetPath(fieldName);
  let code = "";
  if (addTraceLogs) {
    code += `${indent}console.log('[TRACE] Decoding discriminated union field ${fieldName}');
`;
  }
  const discriminator = field.discriminator || {};
  const variants = field.variants || [];
  if (discriminator.peek) {
    const peekType = discriminator.peek;
    const endianness = discriminator.endianness || globalEndianness;
    const endiannessArg = peekType !== "uint8" ? `'${endianness}'` : "";
    code += `${indent}const discriminator = this.peek${capitalize(peekType)}(${endiannessArg});
`;
    for (let i = 0;i < variants.length; i++) {
      const variant = variants[i];
      if (variant.when) {
        const condition = variant.when.replace(/\bvalue\b/g, "discriminator");
        const ifKeyword = i === 0 ? "if" : "else if";
        code += `${indent}${ifKeyword} (${condition}) {
`;
        const variantTypeDef = schema.types[variant.type];
        const isBackReference = variantTypeDef && variantTypeDef.type === "back_reference";
        const baseObject = target.includes(".") ? target.split(".")[0] : "value";
        if (isBackReference) {
          code += `${indent}  const decoder = new ${variant.type}Decoder(this.bytes, ${baseObject});
`;
          code += `${indent}  decoder.byteOffset = this.byteOffset;
`;
          code += `${indent}  const decodedValue = decoder.decode();
`;
          code += `${indent}  this.byteOffset = decoder.byteOffset;
`;
        } else {
          code += `${indent}  const decoder = new ${variant.type}Decoder(this.bytes.slice(this.byteOffset), ${baseObject});
`;
          code += `${indent}  const decodedValue = decoder.decode();
`;
          code += `${indent}  this.byteOffset += decoder.byteOffset;
`;
        }
        code += `${indent}  ${target} = { type: '${variant.type}', value: decodedValue };
`;
        code += `${indent}}`;
        if (i < variants.length - 1) {
          code += `
`;
        }
      } else {
        code += ` else {
`;
        const variantTypeDef = schema.types[variant.type];
        const isBackReference = variantTypeDef && variantTypeDef.type === "back_reference";
        const baseObject = target.includes(".") ? target.split(".")[0] : "value";
        if (isBackReference) {
          code += `${indent}  const decoder = new ${variant.type}Decoder(this.bytes, ${baseObject});
`;
          code += `${indent}  decoder.byteOffset = this.byteOffset;
`;
          code += `${indent}  const decodedValue = decoder.decode();
`;
          code += `${indent}  this.byteOffset = decoder.byteOffset;
`;
        } else {
          code += `${indent}  const decoder = new ${variant.type}Decoder(this.bytes.slice(this.byteOffset), ${baseObject});
`;
          code += `${indent}  const decodedValue = decoder.decode();
`;
          code += `${indent}  this.byteOffset += decoder.byteOffset;
`;
        }
        code += `${indent}  ${target} = { type: '${variant.type}', value: decodedValue };
`;
        code += `${indent}}
`;
        return code;
      }
    }
    code += ` else {
`;
    code += `${indent}  throw new Error(\`Unknown discriminator: 0x\${discriminator.toString(16)}\`);
`;
    code += `${indent}}
`;
  } else if (discriminator.field) {
    const discriminatorField = discriminator.field;
    const baseObject = target.includes(".") ? target.split(".")[0] : "value";
    const discriminatorRef = `${baseObject}.${discriminatorField}`;
    for (let i = 0;i < variants.length; i++) {
      const variant = variants[i];
      if (variant.when) {
        const condition = variant.when.replace(/\bvalue\b/g, discriminatorRef);
        const ifKeyword = i === 0 ? "if" : "else if";
        code += `${indent}${ifKeyword} (${condition}) {
`;
        const baseObject2 = target.includes(".") ? target.split(".")[0] : "value";
        const variantTypeDef = schema.types[variant.type];
        const isBackReference = variantTypeDef && variantTypeDef.type === "back_reference";
        if (isBackReference) {
          code += `${indent}  const decoder = new ${variant.type}Decoder(this.bytes, ${baseObject2});
`;
          code += `${indent}  decoder.byteOffset = this.byteOffset;
`;
          code += `${indent}  const payload = decoder.decode();
`;
          code += `${indent}  this.byteOffset = decoder.byteOffset;
`;
        } else {
          code += `${indent}  const decoder = new ${variant.type}Decoder(this.bytes.slice(this.byteOffset), ${baseObject2});
`;
          code += `${indent}  const payload = decoder.decode();
`;
          code += `${indent}  this.byteOffset += decoder.byteOffset;
`;
        }
        code += `${indent}  ${target} = { type: '${variant.type}', value: payload };
`;
        code += `${indent}}`;
        if (i < variants.length - 1) {
          code += `
`;
        }
      } else {
        code += ` else {
`;
        const baseObject2 = target.includes(".") ? target.split(".")[0] : "value";
        const variantTypeDef = schema.types[variant.type];
        const isBackReference = variantTypeDef && variantTypeDef.type === "back_reference";
        if (isBackReference) {
          code += `${indent}  const decoder = new ${variant.type}Decoder(this.bytes, ${baseObject2});
`;
          code += `${indent}  decoder.byteOffset = this.byteOffset;
`;
          code += `${indent}  const payload = decoder.decode();
`;
          code += `${indent}  this.byteOffset = decoder.byteOffset;
`;
        } else {
          code += `${indent}  const decoder = new ${variant.type}Decoder(this.bytes.slice(this.byteOffset), ${baseObject2});
`;
          code += `${indent}  const payload = decoder.decode();
`;
          code += `${indent}  this.byteOffset += decoder.byteOffset;
`;
        }
        code += `${indent}  ${target} = { type: '${variant.type}', value: payload };
`;
        code += `${indent}}
`;
        return code;
      }
    }
    code += ` else {
`;
    code += `${indent}  throw new Error(\`Unknown discriminator value: \${${discriminatorRef}}\`);
`;
    code += `${indent}}
`;
  }
  return code;
}
function generateDecodeOptional(field, schema, globalEndianness, fieldName, indent) {
  const valueType = field.value_type;
  const presenceType = field.presence_type || "uint8";
  let code = "";
  const presentVar = `${fieldName.replace(/\./g, "_")}_present`;
  code += `${indent}const ${presentVar} = `;
  if (presenceType === "uint8") {
    code += `this.readUint8();
`;
  } else if (presenceType === "bit") {
    code += `Number(this.readBits(1));
`;
  }
  code += `${indent}if (${presentVar} !== 0) {
`;
  const syntheticField = {
    type: valueType,
    name: fieldName
  };
  if (field.endianness) {
    syntheticField.endianness = field.endianness;
  }
  code += generateDecodeFieldCoreImpl(syntheticField, schema, globalEndianness, fieldName, indent + "  ");
  code += `${indent}}
`;
  return code;
}
function getTargetPath(fieldName) {
  const isArrayItem = fieldName.endsWith(ARRAY_ITER_SUFFIX) || fieldName.includes(ARRAY_ITER_SUFFIX + ".");
  return isArrayItem ? fieldName : `value.${fieldName}`;
}
function generateDecodeTypeReference(typeRef, schema, globalEndianness, fieldName, indent) {
  const target = getTargetPath(fieldName);
  if (!typeRef) {
    throw new Error(`generateDecodeTypeReference called with undefined typeRef for ${fieldName}`);
  }
  const genericMatch = typeRef.match(/^(\w+)<(.+)>$/);
  if (genericMatch) {
    const [, genericType, typeArg] = genericMatch;
    const templateDef = schema.types[`${genericType}<T>`];
    if (templateDef) {
      const templateFields = getTypeFields(templateDef);
      let code2 = `${indent}${target} = {};
`;
      for (const field of templateFields) {
        const expandedField = JSON.parse(JSON.stringify(field).replace(/"T"/g, `"${typeArg}"`));
        const subFieldCode = generateDecodeFieldCore(expandedField, schema, globalEndianness, `${fieldName}.${expandedField.name}`, indent);
        code2 += subFieldCode;
      }
      return code2;
    }
  }
  const typeDef = schema.types[typeRef];
  if (!typeDef) {
    throw new Error(`Unknown type '${typeRef}' - not found in schema.types and not a built-in primitive`);
  }
  const typeDefAny = typeDef;
  if (typeDefAny.type === "string") {
    const pseudoField = { ...typeDefAny, name: fieldName.split(".").pop() };
    return generateDecodeFieldCoreImpl(pseudoField, schema, globalEndianness, fieldName, indent);
  }
  if (typeDefAny.type === "array") {
    const pseudoField = { ...typeDefAny, name: fieldName.split(".").pop() };
    return generateDecodeFieldCoreImpl(pseudoField, schema, globalEndianness, fieldName, indent);
  }
  if (isTypeAlias(typeDef)) {
    const aliasedType = typeDef;
    const pseudoField = { ...aliasedType, name: fieldName.split(".").pop() };
    return generateDecodeFieldCoreImpl(pseudoField, schema, globalEndianness, fieldName, indent);
  }
  const hasInstanceFields = typeDefAny.instances && Array.isArray(typeDefAny.instances) && typeDefAny.instances.length > 0;
  if (hasInstanceFields) {
    const decoderClass = `${typeRef}Decoder`;
    let code2 = "";
    const sequenceFields = getTypeFields(typeDef);
    const isArrayItem = fieldName.endsWith(ARRAY_ITER_SUFFIX) || fieldName.includes(ARRAY_ITER_SUFFIX + ".");
    const tempVar = fieldName.replace(/\./g, "_") + "_data";
    code2 += `${indent}const ${tempVar}: any = {};
`;
    for (const field of sequenceFields) {
      const subFieldCode = generateDecodeFieldCore(field, schema, globalEndianness, field.name, indent);
      const modifiedCode = subFieldCode.replace(new RegExp(`value\\.${field.name}`, "g"), `${tempVar}.${field.name}`);
      code2 += modifiedCode;
    }
    const rootDecoderExpr = "this.context?._rootDecoder || this";
    code2 += `${indent}${target} = new ${typeRef}Instance(${rootDecoderExpr}, ${tempVar}, this.context?._root || this as any);
`;
    return code2;
  }
  const fields = getTypeFields(typeDef);
  let code = `${indent}${target} = {};
`;
  for (const field of fields) {
    const subFieldCode = generateDecodeFieldCore(field, schema, globalEndianness, `${fieldName}.${field.name}`, indent);
    code += subFieldCode;
  }
  return code;
}

// profile-binschema.ts
var __filename2 = fileURLToPath(import.meta.url);
var __dirname2 = dirname(__filename2);
var ITERATIONS = 500000;
var responsePacket = new Uint8Array([
  18,
  52,
  129,
  128,
  0,
  1,
  0,
  1,
  0,
  0,
  0,
  0,
  7,
  101,
  120,
  97,
  109,
  112,
  108,
  101,
  3,
  99,
  111,
  109,
  0,
  0,
  1,
  0,
  1,
  192,
  12,
  0,
  1,
  0,
  1,
  0,
  0,
  14,
  16,
  0,
  4,
  93,
  184,
  216,
  34
]);
async function main() {
  const schemaPath = resolve(__dirname2, "../packages/binschema/src/tests/protocols/dns-complete-message.schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
  let generatedCode = generateTypeScript(schema);
  const runtimeDir = resolve(__dirname2, "../packages/binschema/src/runtime");
  generatedCode = generatedCode.replace(/from "\.\/bit-stream\.js"/g, `from "${runtimeDir}/bit-stream.js"`).replace(/from "\.\/seekable-bit-stream\.js"/g, `from "${runtimeDir}/seekable-bit-stream.js"`).replace(/from "\.\/binary-reader\.js"/g, `from "${runtimeDir}/binary-reader.js"`).replace(/from "\.\/crc32\.js"/g, `from "${runtimeDir}/crc32.js"`).replace(/from "\.\/expression-evaluator\.js"/g, `from "${runtimeDir}/expression-evaluator.js"`);
  const genDir = join(process.cwd(), ".generated-bench");
  mkdirSync(genDir, { recursive: true });
  const genFile = join(genDir, "BinSchemaDnsProfile.ts");
  writeFileSync(genFile, generatedCode);
  const module = await import(pathToFileURL(genFile).href + `?t=${Date.now()}`);
  const DecoderClass = module.DnsMessageDecoder;
  console.log("Warming up...");
  for (let i = 0;i < 1e4; i++) {
    new DecoderClass(responsePacket).decode();
  }
  console.log(`Running ${ITERATIONS.toLocaleString()} iterations...`);
  const start = performance.now();
  for (let i = 0;i < ITERATIONS; i++) {
    new DecoderClass(responsePacket).decode();
  }
  const end = performance.now();
  const totalMs = end - start;
  const perOpNs = totalMs * 1e6 / ITERATIONS;
  console.log(`Done: ${totalMs.toFixed(0)}ms total, ${perOpNs.toFixed(0)}ns per decode`);
}
main().catch(console.error);
