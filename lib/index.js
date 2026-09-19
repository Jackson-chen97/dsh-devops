import { createRequire } from "node:module";
import { request } from "node:https";
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { Context, Service } from "@deepseek-ai/cordis";

//#region node_modules/@deepseek-ai/cosmokit/lib/index.js
/** Return true when a value is `null` or `undefined`. */
function isNullable(value) {
	return value === null || value === void 0;
}
/** Return true for non-array object values. */
function isPlainObject(data) {
	return data && typeof data === "object" && !Array.isArray(data);
}
/** Filter object entries and return a new object. */
function filterKeys(object, filter) {
	return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
/** Map object values while preserving the original key set. */
function mapValues(object, transform) {
	return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
/** Pick selected keys from an object, optionally including `undefined` values. */
function pick(source, keys, forced) {
	if (!keys) return { ...source };
	const result = {};
	for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
	return result;
}
/** Test values using `instanceof` with a `toStringTag` fallback. */
function is(type, value) {
	if (arguments.length === 1) return (value$1) => is(type, value$1);
	return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
	return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
	return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
/** Binary source detection and base64/hex conversion helpers. */
var Binary;
(function(Binary$1) {
	Binary$1.is = isArrayBufferLike;
	Binary$1.isSource = isArrayBufferSource;
	function fromSource(source) {
		if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
		else return source;
	}
	Binary$1.fromSource = fromSource;
	function toBase64(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
		let binary = "";
		const bytes = new Uint8Array(source);
		for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
		return btoa(binary);
	}
	Binary$1.toBase64 = toBase64;
	function fromBase64(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
		return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
	}
	Binary$1.fromBase64 = fromBase64;
	function toHex(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
		return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
	}
	Binary$1.toHex = toHex;
	function fromHex(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
		const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
		const buffer = [];
		for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
		return Uint8Array.from(buffer).buffer;
	}
	Binary$1.fromHex = fromHex;
})(Binary || (Binary = {}));
/** Decode a base64 string into binary data. */
const base64ToArrayBuffer = Binary.fromBase64;
/** Encode binary data as base64. */
const arrayBufferToBase64 = Binary.toBase64;
/** Decode a hex string into binary data. */
const hexToArrayBuffer = Binary.fromHex;
/** Encode binary data as hex. */
const arrayBufferToHex = Binary.toHex;
/** Deep-clone common JavaScript values while preserving prototypes and cycles. */
function clone(source, refs = /* @__PURE__ */ new Map()) {
	if (!source || typeof source !== "object") return source;
	if (is("Date", source)) return new Date(source.valueOf());
	if (is("RegExp", source)) return new RegExp(source.source, source.flags);
	if (isArrayBufferLike(source)) return source.slice(0);
	if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
	const cached = refs.get(source);
	if (cached) return cached;
	if (Array.isArray(source)) {
		const result$1 = [];
		refs.set(source, result$1);
		source.forEach((value, index) => {
			result$1[index] = Reflect.apply(clone, null, [value, refs]);
		});
		return result$1;
	}
	const result = Object.create(Object.getPrototypeOf(source));
	refs.set(source, result);
	for (const key of Reflect.ownKeys(source)) {
		const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
		if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
		Reflect.defineProperty(result, key, descriptor);
	}
	return result;
}
/** Deeply compare arrays, dates, regexps, buffers, and plain object fields. */
function deepEqual(a, b, strict) {
	if (a === b) return true;
	if (!strict && isNullable(a) && isNullable(b)) return true;
	if (typeof a !== typeof b) return false;
	if (typeof a !== "object") return false;
	if (!a || !b) return false;
	function check(test, then) {
		return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
	}
	return check(Array.isArray, (a$1, b$1) => a$1.length === b$1.length && a$1.every((item, index) => deepEqual(item, b$1[index]))) ?? check(is("Date"), (a$1, b$1) => a$1.valueOf() === b$1.valueOf()) ?? check(is("RegExp"), (a$1, b$1) => a$1.source === b$1.source && a$1.flags === b$1.flags) ?? check(isArrayBufferLike, (a$1, b$1) => {
		if (a$1.byteLength !== b$1.byteLength) return false;
		const viewA = new Uint8Array(a$1);
		const viewB = new Uint8Array(b$1);
		for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
		return true;
	}) ?? Object.keys({
		...a,
		...b
	}).every((key) => deepEqual(a[key], b[key], strict));
}
/** Time constants plus parsing and formatting helpers. */
var Time;
(function(Time$1) {
	Time$1.millisecond = 1;
	Time$1.second = 1e3;
	Time$1.minute = Time$1.second * 60;
	Time$1.hour = Time$1.minute * 60;
	Time$1.day = Time$1.hour * 24;
	Time$1.week = Time$1.day * 7;
	let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
	function setTimezoneOffset(offset) {
		timezoneOffset = offset;
	}
	Time$1.setTimezoneOffset = setTimezoneOffset;
	function getTimezoneOffset() {
		return timezoneOffset;
	}
	Time$1.getTimezoneOffset = getTimezoneOffset;
	function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
		if (typeof date === "number") date = new Date(date);
		if (offset === void 0) offset = timezoneOffset;
		return Math.floor((date.valueOf() / Time$1.minute - offset) / 1440);
	}
	Time$1.getDateNumber = getDateNumber;
	function fromDateNumber(value, offset) {
		const date = new Date(value * Time$1.day);
		if (offset === void 0) offset = timezoneOffset;
		return new Date(+date + offset * Time$1.minute);
	}
	Time$1.fromDateNumber = fromDateNumber;
	const numeric = /\d+(?:\.\d+)?/.source;
	const timeRegExp = new RegExp(`^${[
		"w(?:eek(?:s)?)?",
		"d(?:ay(?:s)?)?",
		"h(?:our(?:s)?)?",
		"m(?:in(?:ute)?(?:s)?)?",
		"s(?:ec(?:ond)?(?:s)?)?"
	].map((unit) => `(${numeric}${unit})?`).join("")}$`);
	function parseTime(source) {
		const capture = timeRegExp.exec(source);
		if (!capture) return 0;
		return (parseFloat(capture[1]) * Time$1.week || 0) + (parseFloat(capture[2]) * Time$1.day || 0) + (parseFloat(capture[3]) * Time$1.hour || 0) + (parseFloat(capture[4]) * Time$1.minute || 0) + (parseFloat(capture[5]) * Time$1.second || 0);
	}
	Time$1.parseTime = parseTime;
	function parseDate(date) {
		const parsed = parseTime(date);
		if (parsed) date = Date.now() + parsed;
		else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
		else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
		return date ? new Date(date) : /* @__PURE__ */ new Date();
	}
	Time$1.parseDate = parseDate;
	function format(ms) {
		const abs = Math.abs(ms);
		if (abs >= Time$1.day - Time$1.hour / 2) return Math.round(ms / Time$1.day) + "d";
		else if (abs >= Time$1.hour - Time$1.minute / 2) return Math.round(ms / Time$1.hour) + "h";
		else if (abs >= Time$1.minute - Time$1.second / 2) return Math.round(ms / Time$1.minute) + "m";
		else if (abs >= Time$1.second) return Math.round(ms / Time$1.second) + "s";
		return ms + "ms";
	}
	Time$1.format = format;
	function toDigits(source, length = 2) {
		return source.toString().padStart(length, "0");
	}
	Time$1.toDigits = toDigits;
	function template(template$1, time = /* @__PURE__ */ new Date()) {
		return template$1.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
	}
	Time$1.template = template;
})(Time || (Time = {}));

//#endregion
//#region node_modules/@deepseek-ai/schemastery/lib/index.mjs
const kSchema = Symbol.for("schemastery");
const kValidationError = Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError = class extends TypeError {
	options;
	name = "ValidationError";
	constructor(message, options) {
		let prefix = "$";
		for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
		else if (typeof segment === "number") prefix += "[" + segment + "]";
		else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
		if (prefix.startsWith(".")) prefix = prefix.slice(1);
		super((prefix === "$" ? "" : `${prefix} `) + message);
		this.options = options;
	}
	static is(error) {
		return !!error?.[kValidationError];
	}
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
const Schema = function(options) {
	const schema = function(data, options$1 = {}) {
		return Schema.resolve(data, schema, options$1)[0];
	};
	if (options.refs) {
		const refs = mapValues(options.refs, (options$1) => new Schema(options$1));
		const getRef = (uid) => refs[uid];
		for (const key in refs) {
			const options$1 = refs[key];
			options$1.sKey = getRef(options$1.sKey);
			options$1.inner = getRef(options$1.inner);
			options$1.list = options$1.list && options$1.list.map(getRef);
			options$1.dict = options$1.dict && mapValues(options$1.dict, getRef);
		}
		return refs[options.uid];
	}
	Object.assign(schema, options);
	if (typeof schema.callback === "string") try {
		schema.callback = new Function("return " + schema.callback)();
	} catch {}
	Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
	Object.setPrototypeOf(schema, Schema.prototype);
	schema.meta ||= {};
	schema.toString = schema.toString.bind(schema);
	return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
	return {
		version: 1,
		vendor: "schemastery",
		validate: (value) => {
			try {
				return { value: Schema.resolve(value, this, {})[0] };
			} catch (error) {
				if (ValidationError.is(error)) return { issues: [{
					message: error.message,
					path: error.options.path
				}] };
				throw error;
			}
		}
	};
} });
Schema.ValidationError = ValidationError;
Schema.prototype.toJSON = function toJSON() {
	if (globalThis.__schemastery_refs__) {
		globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
		return this.uid;
	}
	globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
	globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
	const result = {
		uid: this.uid,
		refs: globalThis.__schemastery_refs__
	};
	globalThis.__schemastery_refs__ = void 0;
	return result;
};
Schema.prototype.set = function set(key, value) {
	this.dict[key] = value;
	return this;
};
Schema.prototype.push = function push(value) {
	this.list.push(value);
	return this;
};
function mergeDesc(original, messages) {
	const result = typeof original === "string" ? { "": original } : { ...original };
	for (const locale in messages) {
		const value = messages[locale];
		if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
		else if (typeof value === "string") result[locale] = value;
	}
	return result;
}
function getInner(value) {
	return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
	return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
	const schema = Schema(this);
	const desc = mergeDesc(schema.meta.description, messages);
	if (Object.keys(desc).length) schema.meta.description = desc;
	if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
		return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
	});
	if (schema.list) schema.list = schema.list.map((inner, index) => {
		return inner.i18n(mapValues(messages, (data = {}) => {
			if (Array.isArray(getInner(data))) return getInner(data)[index];
			if (Array.isArray(data)) return data[index];
			return extractKeys(data);
		}));
	});
	if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
		if (getInner(data)) return getInner(data);
		return extractKeys(data);
	}));
	if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
	return schema;
};
Schema.prototype.extra = function extra(key, value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
};
for (const key of [
	"required",
	"disabled",
	"collapse",
	"hidden",
	"loose"
]) Object.assign(Schema.prototype, { [key](value = true) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
Schema.prototype.deprecated = function deprecated() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "deprecated",
		type: "danger"
	});
	return schema;
};
Schema.prototype.experimental = function experimental() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "experimental",
		type: "warning"
	});
	return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
	const schema = Schema(this);
	const pattern$1 = pick(regexp, ["source", "flags"]);
	schema.meta = {
		...schema.meta,
		pattern: pattern$1
	};
	return schema;
};
Schema.prototype.simplify = function simplify(value) {
	if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
	if (isNullable(value)) return value;
	if (this.type === "object" || this.type === "dict") {
		const result = {};
		for (const key in value) {
			const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
			if (this.type === "dict" || !isNullable(item)) result[key] = item;
		}
		if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
		return result;
	} else if (this.type === "array" || this.type === "tuple") {
		const result = [];
		value.forEach((value$1, index) => {
			const schema = this.type === "array" ? this.inner : this.list[index];
			const item = schema ? schema.simplify(value$1) : value$1;
			result.push(item);
		});
		return result;
	} else if (this.type === "intersect") {
		const result = {};
		for (const item of this.list) Object.assign(result, item.simplify(value));
		return result;
	} else if (this.type === "union") for (const schema of this.list) try {
		Schema.resolve(value, schema, {});
		return schema.simplify(value);
	} catch {}
	return value;
};
Schema.prototype.toString = function toString(inline) {
	return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role$1, extra) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		role: role$1,
		extra
	};
	return schema;
};
for (const key of [
	"default",
	"link",
	"comment",
	"description",
	"max",
	"min",
	"step"
]) Object.assign(Schema.prototype, { [key](value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
const resolvers = {};
Schema.extend = function extend(type, resolve) {
	resolvers[type] = resolve;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
	if (!schema) return [data];
	if (options.ignore?.(data, schema)) return [data];
	if (isNullable(data) && schema.type !== "lazy") {
		if (schema.meta.required) throw new ValidationError(`missing required value`, options);
		let current = schema;
		let fallback = schema.meta.default;
		while (current?.type === "intersect" && isNullable(fallback)) {
			current = current.list[0];
			fallback = current?.meta.default;
		}
		if (isNullable(fallback)) return [data];
		data = clone(fallback);
	}
	const callback = resolvers[schema.type];
	if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
	try {
		return callback(data, schema, options, strict);
	} catch (error) {
		if (!schema.meta.loose) throw error;
		return [schema.meta.default];
	}
};
Schema.from = function from(source) {
	if (isNullable(source)) return Schema.any();
	else if ([
		"string",
		"number",
		"boolean"
	].includes(typeof source)) return Schema.const(source).required();
	else if (source[kSchema]) return source;
	else if (typeof source === "function") switch (source) {
		case String: return Schema.string().required();
		case Number: return Schema.number().required();
		case Boolean: return Schema.boolean().required();
		case Function: return Schema.function().required();
		default: return Schema.is(source).required();
	}
	else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
	const toJSON = () => {
		if (!schema.inner[kSchema]) {
			schema.inner = schema.builder();
			schema.inner.meta = {
				...schema.meta,
				...schema.inner.meta
			};
		}
		return schema.inner.toJSON();
	};
	const schema = new Schema({
		type: "lazy",
		builder,
		inner: { toJSON }
	});
	return schema;
};
Schema.natural = function natural() {
	return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
	return Schema.number().step(.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
	return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
		const date$1 = new Date(value);
		if (isNaN(+date$1)) throw new ValidationError(`invalid date "${value}"`, options);
		return date$1;
	}, true)]);
};
Schema.regExp = function regExp(flag = "") {
	return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
		try {
			return new RegExp(value, flag);
		} catch (e) {
			throw new ValidationError(e.message, options);
		}
	}, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
	return Schema.union([
		Schema.is(ArrayBuffer),
		Schema.is(SharedArrayBuffer),
		Schema.transform(Schema.any(), (value, options) => {
			if (Binary.isSource(value)) return Binary.fromSource(value);
			throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
		}, true),
		...encoding ? [Schema.transform(Schema.string(), (value, options) => {
			try {
				return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
			} catch (e) {
				throw new ValidationError(e.message, options);
			}
		}, true)] : []
	]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
	if (!schema.inner[kSchema]) {
		schema.inner = schema.builder();
		schema.inner.meta = {
			...schema.meta,
			...schema.inner.meta
		};
	}
	return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
	return [data];
});
Schema.extend("never", (data, _, options) => {
	throw new ValidationError(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
	if (deepEqual(data, value)) return [value];
	throw new ValidationError(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
	const { max = Infinity, min = -Infinity } = meta;
	if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
	if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
	if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
	if (meta.pattern) {
		const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
		if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
	}
	checkWithinRange(data.length, meta, "string length", options);
	return [data];
});
function decimalShift(data, digits) {
	const str$1 = data.toString();
	if (str$1.includes("e")) return data * Math.pow(10, digits);
	const index = str$1.indexOf(".");
	if (index === -1) return data * Math.pow(10, digits);
	const frac = str$1.slice(index + 1);
	const integer = str$1.slice(0, index);
	if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
	return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
	step = Math.abs(step);
	if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
	const index = step.toString().indexOf(".");
	const digits = step.toString().slice(index + 1).length;
	return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
	if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
	checkWithinRange(data, meta, "number", options);
	const { step } = meta;
	if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
	return [data];
});
Schema.extend("boolean", (data, _, options) => {
	if (typeof data === "boolean") return [data];
	throw new ValidationError(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
	let value = 0, keys = [];
	if (typeof data === "number") {
		value = data;
		for (const key in bits) if (data & bits[key]) keys.push(key);
	} else if (Array.isArray(data)) {
		keys = data;
		for (const key of keys) {
			if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
			if (key in bits) value |= bits[key];
		}
	} else throw new ValidationError(`expected number or array but got ${data}`, options);
	if (value === meta.default) return [value];
	return [value, keys];
});
Schema.extend("function", (data, _, options) => {
	if (typeof data === "function") return [data];
	throw new ValidationError(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
	if (typeof constructor === "function") {
		if (data instanceof constructor) return [data];
		throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
	} else {
		if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
		let prototype = Object.getPrototypeOf(data);
		while (prototype) {
			if (prototype.constructor?.name === constructor) return [data];
			prototype = Object.getPrototypeOf(prototype);
		}
		throw new ValidationError(`expected ${constructor} but got ${data}`, options);
	}
});
function property(data, key, schema, options) {
	try {
		const [value, adapted] = Schema.resolve(data[key], schema, {
			...options,
			path: [...options.path || [], key]
		});
		if (adapted !== void 0) data[key] = adapted;
		return value;
	} catch (e) {
		if (!options?.autofix) throw e;
		delete data[key];
		return schema.meta.default;
	}
}
Schema.extend("array", (data, { inner, meta }, options) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
	return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in data) {
		let rKey;
		try {
			rKey = Schema.resolve(key, sKey, options)[0];
		} catch (error) {
			if (strict) continue;
			throw error;
		}
		result[rKey] = property(data, key, inner, options);
		data[rKey] = data[key];
		if (key !== rKey) delete data[key];
	}
	return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	const result = list.map((inner, index) => property(data, index, inner, options));
	if (strict) return [result];
	result.push(...data.slice(list.length));
	return [result];
});
function merge(result, data) {
	for (const key in data) {
		if (key in result) continue;
		result[key] = data[key];
	}
}
Schema.extend("object", (data, { dict }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in dict) {
		const value = property(data, key, dict[key], options);
		if (!isNullable(value) || key in data) result[key] = value;
	}
	if (!strict) merge(result, data);
	return [result];
});
Schema.extend("union", (data, { list, toString }, options, strict) => {
	const messages = [];
	for (const inner of list) try {
		return Schema.resolve(data, inner, options, strict);
	} catch (error) {
		messages.push(error);
	}
	throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString }, options, strict) => {
	if (!list.length) return [data];
	let result;
	for (const inner of list) {
		const value = Schema.resolve(data, inner, options, true)[0];
		if (isNullable(value)) continue;
		if (isNullable(result)) result = value;
		else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		else if (typeof value === "object") merge(result ??= {}, value);
		else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
	}
	if (!strict && isPlainObject(data)) merge(result, data);
	return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
	const [result, adapted = data] = Schema.resolve(data, inner, options, true);
	if (preserve) return [callback(result)];
	else return [callback(result), callback(adapted)];
});
const formatters = {};
function defineMethod(name$1, keys, format) {
	formatters[name$1] = format;
	Object.assign(Schema, { [name$1](...args) {
		const schema = new Schema({ type: name$1 });
		keys.forEach((key, index) => {
			switch (key) {
				case "sKey":
					schema.sKey = args[index] ?? Schema.string();
					break;
				case "inner":
					schema.inner = Schema.from(args[index]);
					break;
				case "list":
					schema.list = args[index].map(Schema.from);
					break;
				case "dict":
					schema.dict = mapValues(args[index], Schema.from);
					break;
				case "bits":
					schema.bits = {};
					for (const key$1 in args[index]) {
						if (typeof args[index][key$1] !== "number") continue;
						schema.bits[key$1] = args[index][key$1];
					}
					break;
				case "callback": {
					const callback = schema.callback = args[index];
					callback["toJSON"] ||= () => callback.toString();
					break;
				}
				case "constructor": {
					const constructor = schema.constructor = args[index];
					if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
					break;
				}
				default: schema[key] = args[index];
			}
		});
		if (name$1 === "object" || name$1 === "dict") schema.meta.default = {};
		else if (name$1 === "array" || name$1 === "tuple") schema.meta.default = [];
		else if (name$1 === "bitset") schema.meta.default = 0;
		return schema;
	} });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
	if (typeof constructor === "function") return constructor.name;
	else return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
	if (Object.keys(dict).length === 0) return "{}";
	return `{ ${Object.entries(dict).map(([key, inner]) => {
		return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
	}).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
	const result = list.map(({ toString: format }) => format()).join(" | ");
	return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
	return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
	"inner",
	"callback",
	"preserve"
], ({ inner }, isInner) => inner.toString(isInner));

//#endregion
//#region src/config.ts
/**

* Schemastery schema for the plugin config.

*

* Top-level sections (gitlab, k8s, webhook, monitor) are all optional.

* If a section is present, its required sub-fields are enforced here.

* Cross-field rules (webhook requires gitlab, etc.) are handled by parseConfig.

*/
/**

* IMPORTANT: Do NOT use `.required()` on any field in this schema.

* Schemastery validates `.required()` sub-fields even when the parent object

* is absent from the input, causing boot failures for unconfigured plugins.

* Actual field-presence validation is handled by `parseConfig()` (the "second

* gate") which only enforces required fields when their section IS present.

*/
const Config = Schema.object({
	gitlab: Schema.object({
		baseUrl: Schema.string(),
		token: Schema.string(),
		defaultProject: Schema.string(),
		projects: Schema.array(Schema.object({
			id: Schema.string(),
			path: Schema.string(),
			defaultBranch: Schema.string()
		}))
	}),
	k8s: Schema.object({
		kubeconfigs: Schema.array(Schema.object({
			id: Schema.string(),
			path: Schema.string(),
			context: Schema.string(),
			namespace: Schema.string()
		})),
		defaultContext: Schema.string(),
		defaultNamespace: Schema.string()
	}),
	webhook: Schema.object({
		secret: Schema.string(),
		projectPaths: Schema.array(Schema.string()),
		quietEvents: Schema.array(Schema.string())
	}),
	monitor: Schema.object({
		pollIntervalSec: Schema.number().default(30),
		cooldownSec: Schema.number().default(300),
		pipeline: Schema.array(Schema.object({
			projects: Schema.array(Schema.string()),
			branches: Schema.array(Schema.string()),
			trigger: Schema.union([
				"failed",
				"canceled",
				"success"
			]),
			message: Schema.string(),
			includeFailedJobs: Schema.boolean()
		})),
		pod: Schema.array(Schema.object({
			clusters: Schema.array(Schema.string()),
			namespaces: Schema.array(Schema.string()),
			trigger: Schema.union([
				"crash",
				"restart",
				"pending_stuck"
			]),
			restartThreshold: Schema.number(),
			pendingTimeoutSec: Schema.number(),
			message: Schema.string(),
			includeLogs: Schema.boolean()
		}))
	})
});
/**

* Parse and validate the raw plugin config.

* Throws a descriptive error on missing/invalid fields.

*

* Called by `apply()` as a second gate after Cordis schema validation,

* enforcing cross-field business rules that cannot be expressed in a

* flat Schemastery schema.

*/
function parseConfig(raw) {
	if (!raw || typeof raw !== "object") throw new Error("[dsh-devops] config must be an object");
	const config = { ...raw };
	if (config.gitlab && !config.gitlab.baseUrl) delete config.gitlab;
	if (config.k8s && (!config.k8s.kubeconfigs || config.k8s.kubeconfigs.length === 0)) delete config.k8s;
	if (config.webhook && !config.webhook.secret) delete config.webhook;
	if (config.monitor) {
		const hasRules = (config.monitor.pipeline?.length ?? 0) > 0 || (config.monitor.pod?.length ?? 0) > 0;
		if (!hasRules) delete config.monitor;
	}
	if (config.gitlab) {
		if (!config.gitlab.baseUrl) throw new Error("[dsh-devops] gitlab.baseUrl is required when gitlab section is present");
		if (!config.gitlab.token) throw new Error("[dsh-devops] gitlab.token is required when gitlab section is present");
		if (!config.gitlab.projects?.length) throw new Error("[dsh-devops] gitlab.projects must be a non-empty array");
		for (const p of config.gitlab.projects) {
			if (!p.id) throw new Error("[dsh-devops] gitlab project must have an id");
			if (!p.path) throw new Error(`[dsh-devops] gitlab project "${p.id}" must have a path`);
		}
	}
	if (config.k8s) {
		if (!config.k8s.kubeconfigs?.length) throw new Error("[dsh-devops] k8s.kubeconfigs must be a non-empty array when k8s section is present");
		for (const ref of config.k8s.kubeconfigs) {
			if (!ref.id) throw new Error("[dsh-devops] k8s kubeconfig ref must have an id");
			if (!ref.path) throw new Error(`[dsh-devops] k8s kubeconfig "${ref.id}" must have a path`);
		}
	}
	if (config.webhook) {
		if (!config.webhook.secret) throw new Error("[dsh-devops] webhook.secret is required");
		if (!config.gitlab) throw new Error("[dsh-devops] webhook requires gitlab section to be configured");
	}
	if (config.monitor) {
		if (!config.gitlab && !config.k8s) throw new Error("[dsh-devops] monitor requires at least gitlab or k8s to be configured");
	}
	return config;
}

//#endregion
//#region src/gitlab/client.ts
var GitLabError = class extends Error {
	constructor(status, code, message) {
		super(message);
		this.status = status;
		this.code = code;
		this.name = "GitLabError";
	}
};
function mapMR(raw) {
	return {
		iid: raw.iid,
		title: raw.title,
		state: raw.state,
		sourceBranch: raw.source_branch,
		targetBranch: raw.target_branch,
		webUrl: raw.web_url,
		approvals: {
			approved: raw.approved === true,
			required: raw.approvals_required ?? 0,
			given: raw.approvals_count ?? 0
		}
	};
}
function mapPipeline(raw) {
	return {
		id: raw.id,
		status: raw.status,
		ref: raw.ref,
		sha: raw.sha,
		webUrl: raw.web_url,
		createdAt: raw.created_at,
		finishedAt: raw.finished_at
	};
}
function mapJob(raw) {
	return {
		id: raw.id,
		name: raw.name,
		status: raw.status,
		stage: raw.stage,
		duration: raw.duration
	};
}
function mapTag(raw) {
	return {
		name: raw.name,
		target: raw.target,
		message: raw.message,
		commitId: raw.commit?.id ?? ""
	};
}
var GitLabClient = class {
	projectUrl;
	constructor(baseUrl, projectPath, token) {
		this.baseUrl = baseUrl;
		this.projectPath = projectPath;
		this.token = token;
		this.projectUrl = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectPath)}`;
	}
	/**
	
	* Send a request to the GitLab API and parse the JSON response.
	
	* Throws {@link GitLabError} on non-2xx status codes.
	
	*/
	async request(method, path, body) {
		const url = path.startsWith("http") ? path : `${this.projectUrl}${path}`;
		const headers = {
			"PRIVATE-TOKEN": this.token,
			"Content-Type": "application/json"
		};
		const res = await fetch(url, {
			method,
			headers,
			body: body !== void 0 ? JSON.stringify(body) : void 0
		});
		if (!res.ok) {
			let code = "unknown";
			let message = `GitLab API error ${res.status}`;
			try {
				const err = await res.json();
				code = err.message || err.error || err.error_description || "unknown";
				message = err.message || err.error || err.error_description || message;
			} catch {}
			throw new GitLabError(res.status, code, message);
		}
		if (res.status === 204) return void 0;
		return await res.json();
	}
	/** Create a new merge request. */
	async createMR(sourceBranch, targetBranch, title, description) {
		const raw = await this.request("POST", "/merge_requests", {
			source_branch: sourceBranch,
			target_branch: targetBranch,
			title,
			...description !== void 0 ? { description } : {}
		});
		return mapMR(raw);
	}
	/** Approve a merge request. */
	async approveMR(mrIid) {
		await this.request("POST", `/merge_requests/${mrIid}/approve`);
	}
	/** Request changes on a merge request (post a review note with a negative verdict). */
	async requestChanges(mrIid, comment) {
		await this.request("POST", `/merge_requests/${mrIid}/notes`, { body: `🔴 Changes requested: ${comment}` });
	}
	/** Post a comment (note) on a merge request. */
	async commentMR(mrIid, body) {
		await this.request("POST", `/merge_requests/${mrIid}/notes`, { body });
	}
	/** List open merge requests. */
	async listMRs() {
		const raw = await this.request("GET", "/merge_requests?state=opened");
		return raw.map(mapMR);
	}
	/** Create a new tag pointing at the given ref (branch, tag, or commit SHA). */
	async createTag(name$1, ref, message) {
		const raw = await this.request("POST", "/repository/tags", {
			tag_name: name$1,
			ref,
			...message !== void 0 ? { message } : {}
		});
		return mapTag(raw);
	}
	/** Get a single pipeline by its numeric id. */
	async getPipeline(pipelineId) {
		const raw = await this.request("GET", `/pipelines/${pipelineId}`);
		return mapPipeline(raw);
	}
	/** Get the latest pipeline for a given ref (branch/tag). */
	async getLatestPipelineByRef(ref) {
		const raw = await this.request("GET", `/pipelines?ref=${encodeURIComponent(ref)}&order_by=id&sort=desc&per_page=1`);
		if (!Array.isArray(raw) || raw.length === 0) return void 0;
		return mapPipeline(raw[0]);
	}
	/** List all jobs in a pipeline. */
	async listPipelineJobs(pipelineId) {
		const raw = await this.request("GET", `/pipelines/${pipelineId}/jobs`);
		return raw.map(mapJob);
	}
	/** Fetch the log output of a job. */
	async getJobLog(jobId) {
		const url = `${this.projectUrl}/jobs/${jobId}/log`;
		const res = await fetch(url, { headers: { "PRIVATE-TOKEN": this.token } });
		if (!res.ok) throw new GitLabError(res.status, "unknown", `Failed to fetch job log: ${res.status}`);
		return res.text();
	}
};

//#endregion
//#region src/gitlab/router.ts
var GitLabRouter = class {
	clients;
	constructor(baseUrl, projects, defaultProject) {
		this.baseUrl = baseUrl;
		this.defaultProject = defaultProject;
		this.clients = new Map();
		for (const p of projects) {
			const token = p.token ?? (p.tokenEnv ? process.env[p.tokenEnv] : void 0);
			if (!token) throw new Error(`[dsh-devops] GitLab project "${p.id}": no direct token and environment variable "${p.tokenEnv}" is not set`);
			this.clients.set(p.id, new GitLabClient(baseUrl, p.path, token));
		}
	}
	/**
	
	* Resolve a {@link GitLabClient} for the given project id,
	
	* or fall back to the configured default project.
	
	*/
	resolve(id) {
		const key = id ?? this.defaultProject;
		if (!key) throw new Error("[dsh-devops] GitLab: no project id provided and no defaultProject configured");
		const client = this.clients.get(key);
		if (!client) {
			const available = [...this.clients.keys()].join(", ");
			throw new Error(`[dsh-devops] GitLab: unknown project id "${key}". Available: ${available}`);
		}
		return client;
	}
	/** Return all configured project ids. */
	list() {
		return [...this.clients.keys()];
	}
};

//#endregion
//#region src/gitlab/index.ts
/**

* Register the GitLab service with the DSH context.

*

* @param ctx    — DSH host context (typed `any`; carries the full Cordis API at runtime)

* @param config — parsed GitLab configuration section

* @returns the public {@link GitLabService} instance

*/
function registerGitLab(ctx, config) {
	const router = new GitLabRouter(config.baseUrl, config.projects, config.defaultProject);
	ctx.effect(() => {
		return () => {};
	}, "gitlab");
	const service = {
		listProjects: () => router.list(),
		createMR: (project, sourceBranch, targetBranch, title, description) => router.resolve(project).createMR(sourceBranch, targetBranch, title, description),
		approveMR: (project, mrIid) => router.resolve(project).approveMR(mrIid),
		requestChanges: (project, mrIid, comment) => router.resolve(project).requestChanges(mrIid, comment),
		commentMR: (project, mrIid, body) => router.resolve(project).commentMR(mrIid, body),
		listMRs: (project) => router.resolve(project).listMRs(),
		createTag: (project, name$1, ref, message) => router.resolve(project).createTag(name$1, ref, message),
		getPipeline: (project, pipelineId) => router.resolve(project).getPipeline(pipelineId),
		getLatestPipelineByRef: (project, ref) => router.resolve(project).getLatestPipelineByRef(ref),
		listPipelineJobs: (project, pipelineId) => router.resolve(project).listPipelineJobs(pipelineId),
		getJobLog: (project, jobId) => router.resolve(project).getJobLog(jobId)
	};
	return service;
}

//#endregion
//#region src/k8s/client.ts
const CONDITION_TYPES = [
	"Available",
	"Progressing",
	"ReplicaFailure"
];
const CONDITION_STATUSES = [
	"True",
	"False",
	"Unknown"
];
const POD_PHASES = [
	"Pending",
	"Running",
	"Succeeded",
	"Failed",
	"Unknown"
];
/** Type-narrowing membership check for string-union fields coming from the API. */
function inSet(value, set) {
	return set.includes(value);
}
function truncate(s, max = 300) {
	return s.length > max ? `${s.slice(0, max)}…` : s;
}
function toDeploymentCondition(c) {
	const typeStr = c.type ?? "";
	const statusStr = c.status ?? "";
	return {
		type: inSet(typeStr, CONDITION_TYPES) ? typeStr : "Progressing",
		status: inSet(statusStr, CONDITION_STATUSES) ? statusStr : "Unknown",
		reason: c.reason ?? "",
		message: c.message ?? "",
		lastUpdateTime: c.lastUpdateTime ?? ""
	};
}
function toDeploymentStatus(d, fallbackNamespace) {
	const s = d.status ?? {};
	return {
		name: d.metadata?.name ?? "",
		namespace: d.metadata?.namespace ?? fallbackNamespace,
		readyReplicas: s.readyReplicas ?? 0,
		availableReplicas: s.availableReplicas ?? 0,
		desiredReplicas: d.spec?.replicas ?? 0,
		updatedReplicas: s.updatedReplicas ?? 0,
		conditions: (s.conditions ?? []).map(toDeploymentCondition)
	};
}
function toPodInfo(p, fallbackNamespace) {
	const s = p.status ?? {};
	const containers = (s.containerStatuses ?? []).map((c) => ({
		name: c.name ?? "",
		ready: c.ready ?? false,
		restartCount: c.restartCount ?? 0
	}));
	const phaseStr = s.phase ?? "";
	return {
		name: p.metadata?.name ?? "",
		namespace: p.metadata?.namespace ?? fallbackNamespace,
		phase: inSet(phaseStr, POD_PHASES) ? phaseStr : "Unknown",
		nodeName: s.nodeName,
		restartCount: containers.reduce((sum, c) => sum + c.restartCount, 0),
		containers,
		startTime: s.startTime
	};
}
function toK8sEvent(e, fallbackNamespace) {
	return {
		type: e.type === "Warning" ? "Warning" : "Normal",
		reason: e.reason ?? "",
		message: e.message ?? "",
		object: {
			kind: e.involvedObject?.kind ?? "",
			name: e.involvedObject?.name ?? "",
			namespace: e.involvedObject?.namespace ?? fallbackNamespace
		},
		count: e.count,
		lastTimestamp: e.lastTimestamp ?? ""
	};
}
var K8sClient = class {
	ctx;
	server;
	constructor(ctx) {
		this.ctx = ctx;
		this.server = ctx.server.replace(/\/+$/, "");
	}
	/** Authenticated GET returning parsed JSON. */
	async getJson(path) {
		const res = await this.fetch(path, "application/json");
		return await res.json();
	}
	/** Authenticated GET returning the body as text. */
	async getText(path) {
		const res = await this.fetch(path, "application/json");
		return res.text();
	}
	async fetch(path, accept) {
		const url = new URL(`${this.server}${path}`);
		const ca = this.ctx.caData ? Buffer.from(this.ctx.caData, "base64") : void 0;
		const res = await new Promise((resolve, reject) => {
			const req = request({
				hostname: url.hostname,
				port: url.port || 443,
				path: `${url.pathname}${url.search}`,
				method: "GET",
				headers: {
					Authorization: `Bearer ${this.ctx.token}`,
					Accept: accept
				},
				...this.ctx.insecureSkipTlsVerify ? { rejectUnauthorized: false } : ca ? {
					ca,
					rejectUnauthorized: true,
					checkServerIdentity: () => void 0
				} : {}
			}, (upstream) => {
				const chunks = [];
				upstream.on("data", (c) => chunks.push(c));
				upstream.on("end", () => {
					const body = Buffer.concat(chunks).toString("utf8");
					const status = upstream.statusCode ?? 0;
					const bodyless = status === 204 || status === 304;
					resolve(new Response(bodyless ? null : body, {
						status,
						statusText: upstream.statusMessage ?? ""
					}));
				});
			});
			req.on("error", reject);
			req.end();
		}).catch((err) => {
			throw new Error(`[k8s] request to ${path} failed: ${err.message}`);
		});
		if (!res.ok) {
			const body = await res.text().catch(() => "");
			throw new Error(`[k8s] GET ${path} failed: ${res.status} ${res.statusText}${body ? ` — ${truncate(body)}` : ""}`);
		}
		return res;
	}
	/** List all deployments in a namespace. */
	async getDeployments(namespace) {
		const data = await this.getJson(`/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments`);
		return data.items.map((d) => toDeploymentStatus(d, namespace));
	}
	/** Get a single deployment by name. */
	async getDeployment(namespace, name$1) {
		const d = await this.getJson(`/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name$1)}`);
		return toDeploymentStatus(d, namespace);
	}
	/** List all pods in a namespace. */
	async getPods(namespace) {
		const data = await this.getJson(`/api/v1/namespaces/${encodeURIComponent(namespace)}/pods`);
		return data.items.map((p) => toPodInfo(p, namespace));
	}
	/** List recent events in a namespace, optionally limited. */
	async getEvents(namespace, limit) {
		const q = limit ? `?limit=${limit}` : "";
		const data = await this.getJson(`/api/v1/namespaces/${encodeURIComponent(namespace)}/events${q}`);
		return data.items.map((e) => toK8sEvent(e, namespace));
	}
	/** Fetch (tail of) a pod's logs. */
	async getPodLogs(namespace, podName, container, tailLines) {
		const params = new URLSearchParams();
		if (container) params.set("container", container);
		if (tailLines != null) params.set("tailLines", String(tailLines));
		const qs = params.toString();
		const path = `/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(podName)}/log${qs ? `?${qs}` : ""}`;
		return this.getText(path);
	}
};

//#endregion
//#region src/k8s/kubeconfig.ts
/**

* Expand a leading `~` (or `~/...`) in a path to the user's home directory.

* Paths that do not start with `~` are returned unchanged.

*/
function expandPath(p) {
	if (p === "~") return homedir();
	if (p.startsWith("~/") || p.startsWith("~\\")) return join(homedir(), p.slice(2));
	return p;
}
/**

* Parse a kubeconfig file into a resolved {@link K8sContext}.

*

* @param filePath    Path to the kubeconfig file (supports `~` expansion).

* @param contextName  Context to select. When omitted, the file's

*                    `current-context` is used.

* @throws Descriptive errors when the file/context/cluster/user cannot be found

*         or a required field (server, token) is missing.

*/
function parseKubeconfig(filePath, contextName) {
	const expanded = expandPath(filePath);
	let raw;
	try {
		raw = readFileSync(expanded, "utf8");
	} catch (err) {
		throw new Error(`[k8s] cannot read kubeconfig file at "${expanded}": ${err.message}`);
	}
	let doc;
	try {
		doc = parse(raw);
	} catch (err) {
		throw new Error(`[k8s] failed to parse YAML in kubeconfig "${expanded}": ${err.message}`);
	}
	if (!doc || typeof doc !== "object") throw new Error(`[k8s] kubeconfig "${expanded}" did not parse to a mapping`);
	const clusters = doc.clusters ?? [];
	const users = doc.users ?? [];
	const contexts = doc.contexts ?? [];
	const targetName = contextName ?? doc["current-context"];
	if (!targetName) throw new Error(`[k8s] kubeconfig "${expanded}" has no current-context and no context name was provided`);
	const ctx = contexts.find((c) => c.name === targetName);
	if (!ctx) {
		const available = contexts.map((c) => c.name).filter(Boolean).join(", ") || "none";
		throw new Error(`[k8s] context "${targetName}" not found in kubeconfig "${expanded}" (available: ${available})`);
	}
	const inner = ctx.context ?? {};
	const clusterName = inner["cluster"];
	const userRef = inner["user"];
	if (!clusterName) throw new Error(`[k8s] context "${targetName}" does not reference a cluster`);
	if (!userRef) throw new Error(`[k8s] context "${targetName}" does not reference a user`);
	const clusterEntry = clusters.find((c) => c.name === clusterName);
	if (!clusterEntry) throw new Error(`[k8s] cluster "${clusterName}" (referenced by context "${targetName}") not found in kubeconfig "${expanded}"`);
	const cluster = clusterEntry.cluster ?? {};
	const server = cluster["server"];
	if (!server) throw new Error(`[k8s] cluster "${clusterName}" does not specify a server`);
	const userEntry = users.find((u) => u.name === userRef);
	if (!userEntry) throw new Error(`[k8s] user "${userRef}" (referenced by context "${targetName}") not found in kubeconfig "${expanded}"`);
	const user = userEntry.user ?? {};
	const token = user["token"] ?? user["auth-provider"]?.config?.["access-token"];
	if (!token) throw new Error(`[k8s] user "${userRef}" does not provide a token (looked for "token" and "auth-provider.config.access-token")`);
	return {
		server,
		token,
		caData: cluster["certificate-authority-data"] || void 0,
		insecureSkipTlsVerify: cluster["insecure-skip-tls-verify"] || void 0,
		namespace: inner["namespace"] ?? "default"
	};
}

//#endregion
//#region src/k8s/router.ts
var K8sRouter = class {
	clusters = new Map();
	defaultClientId;
	defaultNamespace;
	/**
	
	* @param kubeconfigs     One entry per cluster. Each `id` is the routing key.
	
	* @param defaultContext  Preferred default cluster. Used as the default when it
	
	*                        matches a configured `id`; otherwise the first cluster.
	
	*                        (Also passed to each file whose ref omits `context`.)
	
	* @param defaultNamespace Fallback namespace applied when neither a ref nor its
	
	*                        context specifies one.
	
	*/
	constructor(kubeconfigs, defaultContext, defaultNamespace) {
		if (!kubeconfigs.length) throw new Error("[k8s] router requires at least one kubeconfig");
		for (const ref of kubeconfigs) {
			const ctx = parseKubeconfig(ref.path, ref.context ?? defaultContext);
			this.clusters.set(ref.id, {
				client: new K8sClient(ctx),
				contextNamespace: ctx.namespace,
				refNamespace: ref.namespace
			});
		}
		const ids = [...this.clusters.keys()];
		this.defaultClientId = defaultContext && this.clusters.has(defaultContext) ? defaultContext : ids[0];
		this.defaultNamespace = defaultNamespace;
	}
	/** All configured cluster ids. */
	list() {
		return [...this.clusters.keys()];
	}
	/** Resolve a cluster id (or the default) to its client. */
	resolve(id) {
		return this.entry(id).client;
	}
	/**
	
	* Effective namespace for a cluster. Precedence:
	
	* ref override → context namespace (when it isn't the implicit `default`) →
	
	* router default → `default`.
	
	*/
	getDefaultNamespace(id) {
		const e = this.entry(id);
		if (e.refNamespace) return e.refNamespace;
		if (e.contextNamespace !== "default") return e.contextNamespace;
		return this.defaultNamespace ?? "default";
	}
	entry(id) {
		const key = id ?? this.defaultClientId;
		const e = this.clusters.get(key);
		if (!e) throw new Error(`[k8s] unknown cluster id "${key}" (configured: ${[...this.clusters.keys()].join(", ")})`);
		return e;
	}
};

//#endregion
//#region src/k8s/index.ts
/**

* Register the K8s service with the DSH context.

*

* Eagerly parses every configured kubeconfig so misconfiguration surfaces at

* startup (inside the lifecycle effect) rather than on first use.

*

* @param ctx    — DSH host context (carries the full Cordis API at runtime)

* @param config — parsed K8s configuration section

* @returns the public {@link K8sService} instance

*/
function registerK8s(ctx, config) {
	const router = new K8sRouter(config.kubeconfigs, config.defaultContext, config.defaultNamespace);
	ctx.effect(() => {
		const ids = router.list();
		ctx.log?.warn?.(`[dsh-devops:k8s] ready — ${ids.length} cluster(s): ${ids.join(", ")}`);
		return () => {};
	}, "dsh-devops:k8s");
	const service = {
		listClusters: () => router.list(),
		getDefaultNamespace: (cluster) => router.getDefaultNamespace(cluster),
		getDeploymentStatus: (cluster, namespace, name$1) => router.resolve(cluster).getDeployment(namespace, name$1),
		getDeploymentStatusList: (cluster, namespace) => router.resolve(cluster).getDeployments(namespace),
		getPodList: (cluster, namespace) => router.resolve(cluster).getPods(namespace),
		getEvents: (cluster, namespace, limit) => router.resolve(cluster).getEvents(namespace, limit),
		getPodLogs: (cluster, namespace, podName, container, tailLines) => router.resolve(cluster).getPodLogs(namespace, podName, container, tailLines)
	};
	return service;
}

//#endregion
//#region node_modules/@deepseek-ai/dsh-scope/lib/index.js
/**
* Shared insertion-ordered storage and effect ownership for scope-aware registries.
*
* @module @deepseek-ai/dsh-scope
*/
/**
* Insertion-ordered named entries with caller-owned duplicate diagnostics.
*
* Values are borrowed. Iterators are live within one nonempty table
* generation; draining the table detaches them from later insertions. Each
* successful insertion returns an idempotent undo for that exact entry.
*/
var NamedEntries = class {
	duplicateError;
	data = /* @__PURE__ */ new Map();
	constructor(duplicateError) {
		this.duplicateError = duplicateError;
	}
	/**
	* Insert one unique name.
	* @param name - name unique within this table.
	* @param value - borrowed value to retain.
	* @returns an idempotent undo that removes only this insertion.
	*/
	insert(name$1, value) {
		const data = this.data;
		if (data.has(name$1)) throw this.duplicateError(name$1);
		data.set(name$1, value);
		let active = true;
		return () => {
			if (!active) return;
			active = false;
			data.delete(name$1);
			if (data.size === 0 && this.data === data) this.data = /* @__PURE__ */ new Map();
		};
	}
	/**
	* Read one named value.
	* @param name - name to resolve.
	* @returns the retained value, or `undefined` when absent.
	*/
	get(name$1) {
		return this.data.get(name$1);
	}
	/**
	* Test one name for membership.
	* @param name - name to test.
	* @returns whether the table contains that name.
	*/
	has(name$1) {
		return this.data.has(name$1);
	}
	/**
	* Iterate live names in insertion order.
	* @returns the native live key iterator.
	*/
	keys() {
		return this.data.keys();
	}
	/**
	* Iterate live entries in insertion order.
	* @returns the native live entry iterator.
	*/
	entries() {
		return this.data.entries();
	}
	/**
	* Iterate live values in insertion order.
	* @returns the native live value iterator.
	*/
	values() {
		return this.data.values();
	}
	/**
	* Test whether this table has no entries.
	* @returns whether the table is empty.
	*/
	isEmpty() {
		return this.data.size === 0;
	}
};
/**
* Insertion-ordered anonymous entries with independent registration identity.
*
* Equal values remain separate registrations. Values are borrowed, and
* iterators are live within one nonempty table generation; draining the table
* detaches them from later appends.
*/
var AnonymousEntries = class {
	data = /* @__PURE__ */ new Map();
	/**
	* Append one independently owned value.
	* @param value - borrowed value to retain.
	* @returns an idempotent undo for this exact append.
	*/
	append(value) {
		const data = this.data;
		const key = Symbol();
		data.set(key, value);
		let active = true;
		return () => {
			if (!active) return;
			active = false;
			data.delete(key);
			if (data.size === 0 && this.data === data) this.data = /* @__PURE__ */ new Map();
		};
	}
	/**
	* Iterate live values in insertion order.
	* @returns the native live value iterator.
	*/
	values() {
		return this.data.values();
	}
	/**
	* Test whether this table has no entries.
	* @returns whether the table is empty.
	*/
	isEmpty() {
		return this.data.size === 0;
	}
};
/**
* Own the global and exact-scope layers for one registry.
*
* Reads never create scoped layers. Registrations derive both visibility and
* effect ownership from the supplied Cordis context, collect undo before
* notification, and reclaim only a completely empty aggregate layer.
*/
var ScopedLayers = class {
	createLayer;
	onChange;
	/** The eagerly constructed context-global layer. */
	global;
	scoped = /* @__PURE__ */ new Map();
	constructor(createLayer, onChange) {
		this.createLayer = createLayer;
		this.onChange = onChange;
		this.global = createLayer(void 0);
	}
	/**
	* Read an existing exact-scope overlay. Deliberately chain-blind: callers
	* addressing one scope's OWN contributions (its restrictions, its guards)
	* must not silently pick up an ancestor's — use {@link chainLayers} where
	* inheritance is the point.
	* @param scope - exact scope key; `undefined` denotes no overlay.
	* @returns the existing scoped layer, or `undefined` without creating one.
	*/
	peek(scope) {
		if (scope === void 0) return void 0;
		return this.scoped.get(scope);
	}
	/**
	* Existing overlays along the scope's parent chain ({@link scopeChainOf}),
	* farthest ancestor first and the exact scope last, so a caller layering
	* them in order gives the nearest scope the final word.
	* @param scope - viewing scope, or `undefined` for no overlays.
	* @returns the existing layers, nearest last; absent overlays are skipped.
	*/
	chainLayers(scope) {
		const layers = [];
		for (const key of scopeChainOf(scope).reverse()) {
			const layer = this.scoped.get(key);
			if (layer !== void 0) layers.push(layer);
		}
		return layers;
	}
	/**
	* Materialize global named entries followed by scope-chain shadows,
	* farthest ancestor first, so the nearest scope's entry wins a name.
	* @param scope - viewing scope, or `undefined` for the global view.
	* @param pick - select the named table from a layer.
	* @returns an insertion-ordered effective map.
	*/
	merge(scope, pick$1) {
		const merged = new Map(pick$1(this.global).entries());
		for (const layer of this.chainLayers(scope)) for (const [name$1, value] of pick$1(layer).entries()) merged.set(name$1, value);
		return merged;
	}
	/**
	* Attach one synchronous layer mutation to its registration context.
	* @param ctx - context that determines both scope visibility and effect ownership.
	* @param action - atomic mutation returning its synchronous undo.
	* @param options - Cordis effect label and optional change notification.
	* @returns the exact disposer returned by `ctx.effect()`.
	*/
	effect(ctx, action, options) {
		const scope = scopeOf(ctx);
		const notify = options.notify ?? true;
		return ctx.effect(function* () {
			let layer;
			let created = false;
			if (scope === void 0) layer = this.global;
			else {
				const existing = this.scoped.get(scope);
				if (existing === void 0) {
					layer = this.createLayer(scope);
					this.scoped.set(scope, layer);
					created = true;
				} else layer = existing;
			}
			let undo;
			try {
				undo = action(layer);
			} catch (error) {
				if (scope !== void 0 && created && layer.isEmpty()) this.scoped.delete(scope);
				throw error;
			}
			yield () => {
				undo();
				if (scope !== void 0 && layer.isEmpty()) this.scoped.delete(scope);
				if (notify) this.onChange();
			};
			if (notify) this.onChange();
		}.bind(this), options.label);
	}
};
/**
* Scoped-context primitive: mint a Cordis context that tags registrations with
* an opaque identity and build routing-only event carriers for that identity.
*
* @module @deepseek-ai/dsh-scope
*/
/** Context tag written by {@link createScope}. */
const kScope = Symbol("dsh.scope");
/** The key associated with each carrier. Presence distinguishes an unkeyed carrier from a non-carrier. */
const carrierKeys = /* @__PURE__ */ new WeakMap();
/**
* The enclosing scope of each key. One relation powers both directions of
* scope nesting: registration views inherit DOWN the chain (a child scope
* sees its ancestors' layers — {@link ScopedLayers}), and event admission
* extends UP it (a listener tagged with an ancestor receives events dispatched
* to a descendant key — {@link scopeTarget}).
*/
const scopeParents = /* @__PURE__ */ new WeakMap();
/**
* The chain from a key to its root ancestor.
* @param key - the starting key, or `undefined` for the empty chain.
* @returns keys nearest-first: `[key, parent, grandparent, …]`.
*/
function scopeChainOf(key) {
	const chain = [];
	for (let cursor = key; cursor !== void 0; cursor = scopeParents.get(cursor)) chain.push(cursor);
	return chain;
}
/**
* Read the nearest scope tag inherited by a context.
* @param ctx - context to inspect.
* @returns its scope key, or `undefined` for an unscoped context.
*/
function scopeOf(ctx) {
	return ctx[kScope];
}
/**
* Build an opaque receiver that preserves the base filter, admits untagged
* listeners globally, and admits tagged listeners for a matching key or any
* of its ancestors ({@link bindScopeParent}): a listener owned by an enclosing
* scope receives every descendant scope's events, which is what lets one
* standing composition observe each of the agents composed under it. A tag
* BELOW the dispatch key stays excluded — events flow up the chain, never
* down.
* @param base - subject or service whose existing Cordis filter is preserved.
* @param key - routed scope identity, or `undefined` for an unscoped subject.
* @returns a carrier whose subject remains available only through event arguments.
*/
function scopeTarget(base, key) {
	const baseFilter = base[Context.filter];
	const carrier = { [Context.filter](ctx) {
		if (baseFilter !== void 0 && !baseFilter.call(base, ctx)) return false;
		const tag = scopeOf(ctx);
		if (tag === void 0) return true;
		for (let cursor = key; cursor !== void 0; cursor = scopeParents.get(cursor)) if (cursor === tag) return true;
		return false;
	} };
	carrierKeys.set(carrier, key);
	return carrier;
}

//#endregion
//#region node_modules/@deepseek-ai/dsh-typert-protocol/lib/index.js
/** The one Remote failure class shared by owners, the Gateway, and consumers. */
/**
* One Remote call failure: a real Error carrying its stable code and typed
* details. Owners throw it at the failure point; the Host Gateway encodes it
* onto the wire unchanged; the Client face rebuilds an instance for the
* `RemoteResult` error branch, so `throw result.error` keeps throw semantics.
* Discrimination is always by `code`, never by instanceof.
*/
var RemoteError = class extends Error {
	code;
	details;
	/** Structural marker: cross-realm/bundle identification never uses instanceof. */
	isDSHRemoteError = true;
	/**
	* @param code - stable failure code declared in {@link RemoteErrorDetailsMap}.
	* @param message - human diagnostic carried across the wire.
	* @param details - structured payload typed by the code.
	* @param options - standard Error options (`cause` survives in-process only).
	*/
	constructor(code, message, details, options) {
		super(message, options);
		this.code = code;
		this.details = details;
		this.name = "RemoteError";
	}
};
/**
* Remote decorators and explicit Gateway bindings backed by versioned
* descriptors carried on decorated class prototypes. Strict reflection
* remains a Typert compiler responsibility.
* @module @deepseek-ai/dsh-typert-protocol
*/
const TYPERT_REMOTE_SEGMENT_PATTERN = /^[A-Za-z0-9_$.-]+$/;
/**
* Test one generated Remote name against the Connection endpoint grammar.
* @param value - namespace, method, lookup, or Context segment.
* @returns whether the value can cross the shared RPC carrier unchanged.
*/
function isTypertRemoteSegment(value) {
	return value !== "." && value !== ".." && TYPERT_REMOTE_SEGMENT_PATTERN.test(value);
}
const REMOTE_METHOD_DESCRIPTOR = "@deepseek-ai/dsh-typert-protocol/remote-methods";
/**
* Bind one visible Service field to a Cordis key and Remote namespace.
* @param service - owning Service instance, normally `this`.
* @param serviceKey - exact Cordis service key.
* @param options - optional distinct wire namespace.
* @returns a frozen, inspectable binding with no compiler-injected metadata.
*/
function bindTypertRemote(service, serviceKey, options = {}) {
	validateName("service key", serviceKey);
	const namespace = options.namespace ?? serviceKey;
	validateName("namespace", namespace);
	return Object.freeze({
		service,
		serviceKey,
		namespace
	});
}
/** Cordis Service base that exposes its registered name through Typert Gateway. */
var TypertRemoteService = class extends Service {
	/** Visible binding consumed by the Gateway's source-mode discovery. */
	typertRemote;
	/**
	* Register the Service and bind the same key to Typert Gateway.
	* @param ctx - owning Cordis Context.
	* @param serviceKey - exact Cordis service key and default wire namespace.
	* @param options - optional distinct wire namespace.
	*/
	constructor(ctx, serviceKey, options = {}) {
		super(ctx, serviceKey);
		this.typertRemote = bindTypertRemote(this, this.name, options);
	}
};
function Remote(methodExportOrOptions, context) {
	if (typeof methodExportOrOptions === "string") {
		validateName("Remote export name", methodExportOrOptions);
		return remoteDecorator({ kind: "direct" }, void 0, methodExportOrOptions);
	}
	if (typeof methodExportOrOptions === "object") {
		if (remoteOptionMode(methodExportOrOptions) !== "stream" || Reflect.ownKeys(methodExportOrOptions).length !== 1) throw new TypeError("typert-protocol: Remote options must contain exactly mode: \"stream\"");
		return remoteDecorator({ kind: "direct" }, "stream");
	}
	if (context === void 0) throw new TypeError("typert-protocol: Remote decorator context is missing");
	addMarkerInitializer(context, { kind: "direct" });
}
function remoteOptionMode(options) {
	return Reflect.get(options, "mode");
}
function remoteDecorator(invocation, mode, exportName) {
	return function(_method, context) {
		addMarkerInitializer(context, invocation, mode, exportName);
	};
}
function readRemoteMethodDescriptor(prototype) {
	const property$1 = Object.getOwnPropertyDescriptor(prototype, REMOTE_METHOD_DESCRIPTOR);
	if (property$1 === void 0) return void 0;
	const descriptor = property$1.value;
	if (descriptor === null || typeof descriptor !== "object") throw new TypeError("typert-protocol: Remote method descriptor must be an object");
	const version$1 = Reflect.get(descriptor, "version");
	if (version$1 !== 1) throw new TypeError(`typert-protocol: unsupported Remote method descriptor version ${String(version$1)}`);
	const methods = Reflect.get(descriptor, "methods");
	if (!Array.isArray(methods)) throw new TypeError("typert-protocol: Remote method descriptor methods must be an array");
	return descriptor;
}
function addMarkerInitializer(context, invocation, mode, exportName) {
	if (context.private || context.static || typeof context.name !== "string") throw new TypeError("typert-protocol: Remote decorators require a public instance method with a string name");
	const method = context.name;
	context.addInitializer(function() {
		const prototype = Object.getPrototypeOf(this);
		if (prototype === null) throw new TypeError(`typert-protocol: cannot mark Remote method "${method}" on an object without a prototype`);
		mark(prototype, method, invocation, mode, exportName);
	});
}
function mark(prototype, method, invocation, mode, exportName) {
	const descriptor = readRemoteMethodDescriptor(prototype);
	const marker = Object.freeze({
		method,
		...exportName === void 0 || exportName === method ? {} : { exportName },
		...mode === void 0 ? {} : { mode },
		invocation: Object.freeze(invocation)
	});
	const current = descriptor?.methods.find((candidate) => candidate.method === method);
	if (current !== void 0) {
		if (current.exportName === marker.exportName && current.mode === marker.mode && sameInvocation(current.invocation, invocation)) return;
		throw new Error(`typert-protocol: Remote method "${method}" has conflicting invocation markers`);
	}
	Object.defineProperty(prototype, REMOTE_METHOD_DESCRIPTOR, {
		configurable: true,
		value: Object.freeze({
			version: 1,
			methods: Object.freeze([...descriptor?.methods ?? [], marker])
		})
	});
}
function sameInvocation(left, right) {
	if (left.kind === "direct") return right.kind === "direct";
	if (right.kind === "direct") return false;
	return left.context === right.context;
}
function validateName(subject, value) {
	if (!isTypertRemoteSegment(value)) throw new TypeError(`typert-protocol: ${subject} must contain only RPC endpoint segment characters`);
}

//#endregion
//#region node_modules/@deepseek-ai/dsh-util-values/lib/index.js
/** Duplicate-install-safe JSON and immutable-value helpers. @module @deepseek-ai/dsh-util-values */
/**
* Mark an unreachable closed-union branch.
* @param value - impossible value; an unhandled typed variant fails at the call site.
* @param context - optional switch-site label included in the failure message.
* @returns never; a runtime value that escaped its type always throws.
*/
function assertNever(value, context) {
	const rendered = JSON.stringify(value) ?? String(value);
	throw new Error(`unreachable variant${context ? ` in ${context}` : ""}: ${rendered}`);
}
/** Whether a realm-owned intrinsic prototype is backed by its native constructor. */
function hasIntrinsicConstructor$1(prototype, name$1) {
	const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;
	if (typeof constructor !== "function") return false;
	try {
		return constructor.name === name$1 && constructor.prototype === prototype && Function.prototype.toString.call(constructor) === `function ${name$1}() { [native code] }`;
	} catch {
		return false;
	}
}
/** Whether a candidate is one realm's intrinsic `Object.prototype`. */
function isIntrinsicObjectPrototype$1(value) {
	return Object.getPrototypeOf(value) === null && hasIntrinsicConstructor$1(value, "Object");
}
/** Whether an array uses one realm's intrinsic `Array.prototype`, not a subclass or forged prototype. */
function hasPlainArrayPrototype$1(value) {
	const prototype = Object.getPrototypeOf(value);
	if (!Array.isArray(prototype) || !hasIntrinsicConstructor$1(prototype, "Array")) return false;
	const objectPrototype = Object.getPrototypeOf(prototype);
	return typeof objectPrototype === "object" && objectPrototype !== null && isIntrinsicObjectPrototype$1(objectPrototype);
}
/** Whether an object is a plain or null-prototype record from any JavaScript realm. */
function hasPlainObjectPrototype(value) {
	const prototype = Object.getPrototypeOf(value);
	return prototype === null || typeof prototype === "object" && isIntrinsicObjectPrototype$1(prototype);
}
/** Return every JSON-visible object key, or reject own data JSON would discard. */
function enumerableStringKeys(value) {
	const keys = Reflect.ownKeys(value);
	if (keys.some((key) => typeof key !== "string" || !Object.prototype.propertyIsEnumerable.call(value, key))) return void 0;
	return keys;
}
/** Validate lossless JSON iteratively, optionally materializing a detached snapshot. */
function walkJsonValue(value, detach) {
	const ancestors = /* @__PURE__ */ new Set();
	let root;
	const assign = (destination, item) => {
		if (destination === void 0) return;
		if (destination.kind === "root") root = item;
		else if (destination.kind === "array") destination.target[destination.index] = item;
		else Object.defineProperty(destination.target, destination.key, {
			value: item,
			enumerable: true,
			configurable: true,
			writable: true
		});
	};
	const tasks = [{
		kind: "visit",
		value,
		...detach ? { destination: { kind: "root" } } : {}
	}];
	for (let task = tasks.pop(); task !== void 0; task = tasks.pop()) {
		if (task.kind === "leave") {
			ancestors.delete(task.source);
			continue;
		}
		if (task.kind === "array-item") {
			if (!Object.prototype.hasOwnProperty.call(task.source, task.index)) return void 0;
			tasks.push({
				kind: "visit",
				value: task.source[task.index],
				...task.target === void 0 ? {} : { destination: {
					kind: "array",
					target: task.target,
					index: task.index
				} }
			});
			continue;
		}
		if (task.kind === "object-property") {
			tasks.push({
				kind: "visit",
				value: task.source[task.key],
				...task.target === void 0 ? {} : { destination: {
					kind: "object",
					target: task.target,
					key: task.key
				} }
			});
			continue;
		}
		const current = task.value;
		if (current === null) {
			assign(task.destination, null);
			continue;
		}
		if (typeof current === "boolean" || typeof current === "string") {
			assign(task.destination, current);
			continue;
		}
		if (typeof current === "number") {
			if (!Number.isFinite(current) || Object.is(current, -0)) return void 0;
			assign(task.destination, current);
			continue;
		}
		if (typeof current !== "object") return void 0;
		if (ancestors.has(current)) return void 0;
		if (Array.isArray(current)) {
			if (!hasPlainArrayPrototype$1(current)) return void 0;
			const length = current.length;
			if (Reflect.ownKeys(current).length !== length + 1) return void 0;
			const target$1 = detach ? [] : void 0;
			if (target$1 !== void 0) assign(task.destination, target$1);
			ancestors.add(current);
			tasks.push({
				kind: "leave",
				source: current
			});
			for (let index = length - 1; index >= 0; index--) tasks.push({
				kind: "array-item",
				source: current,
				index,
				...target$1 === void 0 ? {} : { target: target$1 }
			});
			continue;
		}
		if (!hasPlainObjectPrototype(current)) return void 0;
		const keys = enumerableStringKeys(current);
		if (keys === void 0) return void 0;
		const target = detach ? {} : void 0;
		if (target !== void 0) assign(task.destination, target);
		ancestors.add(current);
		tasks.push({
			kind: "leave",
			source: current
		});
		for (let index = keys.length - 1; index >= 0; index--) {
			const key = keys[index];
			/* v8 ignore next -- the loop is bounded by the captured key count. */
			if (key === void 0) return void 0;
			tasks.push({
				kind: "object-property",
				source: current,
				key,
				...target === void 0 ? {} : { target }
			});
		}
	}
	return detach ? root : true;
}
/**
* Validate and detach lossless JSON in one read per property.
* @param value - candidate value to validate and detach.
* @returns the detached snapshot, or `undefined` when the value is not losslessly JSON-serializable.
*/
function snapshotJsonValue(value) {
	return walkJsonValue(value, true);
}
/**
* Test the same lossless JSON rules as {@link snapshotJsonValue} without detaching the value.
* @param value - candidate value to test.
* @returns whether the value survives a JSON round trip without loss.
*/
function isJsonValue(value) {
	return walkJsonValue(value, false) === true;
}
/**
* Deep-freeze an object graph in place while leaving live AbortSignal objects mutable.
* @param value - value to freeze.
* @returns the same value after every reachable enumerable child is frozen.
*/
function deepFreeze(value) {
	const seen = /* @__PURE__ */ new WeakSet();
	const pending = [{
		kind: "visit",
		node: value
	}];
	while (pending.length > 0) {
		const task = pending.pop();
		/* v8 ignore next -- the loop condition guarantees one pending task. */
		if (task === void 0) continue;
		if (task.kind === "property") {
			pending.push({
				kind: "visit",
				node: task.source[task.key]
			});
			continue;
		}
		const node = task.node;
		if (node === null || typeof node !== "object") continue;
		if (node instanceof AbortSignal) continue;
		if (seen.has(node)) continue;
		seen.add(node);
		Object.freeze(node);
		const keys = Object.keys(node);
		for (let index = keys.length - 1; index >= 0; index--) {
			const key = keys[index];
			/* v8 ignore next -- the loop is bounded by the captured key count. */
			if (key === void 0) continue;
			pending.push({
				kind: "property",
				source: node,
				key
			});
		}
	}
	return value;
}

//#endregion
//#region node_modules/@deepseek-ai/dsh-util-crypto/lib/index.js
/**
* Random v4 UUID, minted from `crypto.getRandomValues`.
* @returns the UUID string.
*/
function randomUUID() {
	const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
	const hex = Array.from(bytes, (byte, index) => {
		return (index === 6 ? byte & 15 | 64 : index === 8 ? byte & 63 | 128 : byte).toString(16).padStart(2, "0");
	}).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

//#endregion
//#region node_modules/@deepseek-ai/dsh-brand/lib/index.js
/**
* Duplicate-install-safe nominal primitive helpers.
*
* A brand makes structurally identical strings or numbers non-interchangeable
* at the type level: a `SessionId` cannot be passed where a `ToolCallId` is
* expected, and an event sequence cannot be passed as a log offset. Comparison,
* logging, and serialization retain the underlying primitive behavior.
*
* This package owns no concrete domain value and keeps no runtime identity or mutable
* state, so independently installed copies produce interchangeable values.
*
* @module @deepseek-ai/dsh-brand
*/
/**
* Apply a compile-time string brand without changing the value.
* @param value - string admitted by the domain that owns the target brand.
* @returns the same string with the requested compile-time brand.
*/
function brandString(value) {
	return value;
}

//#endregion
//#region node_modules/@deepseek-ai/dsh-timeout/lib/index.js
/** Largest delay Node schedules without clamping it to one millisecond. */
const MAX_TIMER_DELAY_MS = 2147483647;

//#endregion
//#region node_modules/@deepseek-ai/dsh-llm/lib/index.js
/**
* Detach and deep-freeze a message whose identity already exists.
* @param message - complete message, including its stable identity.
* @returns an immutable snapshot that preserves the identity.
*/
function freezeMessage(message) {
	return deepFreeze(structuredClone(message));
}
/**
* Create one identified message and freeze it before publication.
* @param input - complete role, content, and source for a new message.
* @returns an immutable message with a fresh stable identity.
*/
function createMessage(input) {
	return freezeMessage({
		...input,
		id: brandString(randomUUID())
	});
}
/**
* Create one identified user-role message and freeze it before publication.
* @param input - complete content and source for a new user message.
* @returns an immutable user message with a fresh stable identity.
*/
function createUserMessage(input) {
	return createMessage({
		...input,
		role: "user"
	});
}
/**
* Harness error base with a stable machine-routable code and chained cause.
* Package errors extend it so tool results and replay can retain failure class.
* @module @deepseek-ai/dsh-llm/error
*/
/**
* Base class for all harness errors. Carries a `code` (stable, programmatic —
* e.g. `NO_ADAPTER`, `INVALID_ARGS`, `INVARIANT`) distinct from the
* human-readable `message`, and supports `cause` chaining via the standard
* `ErrorOptions`. `name` defaults to the subclass constructor name.
*/
var HarnessError = class extends Error {
	/** Stable machine-routable failure class (e.g. `RATE_LIMIT`); route on this, never by parsing `message`. */
	code;
	constructor(message, code, options) {
		super(message, options);
		this.code = code;
		this.name = new.target.name;
	}
};
/**
* Canonical provider-neutral code for a response that completed normally but
* carried no content blocks at all. Providers occasionally emit a degenerate
* completion (a terminal stop with zero output); adapters classify it as this
* failure instead of yielding an empty assistant message, because an empty
* message silently ends the turn with nothing for the user or the loop to act
* on. The attempt produced nothing durable, so retry policy treats it as safe
* to repeat.
*/
const EMPTY_RESPONSE_CODE = "EMPTY_RESPONSE";
/** Structured codes and plain phrases that explicitly name a context bound being exceeded. */
const STRUCTURED_CONTEXT_OVERFLOW = new RegExp(String.raw`(?:^|[^a-z0-9])context[\s_-](?:length|window)[\s_-]` + String.raw`(?:exceed(?:ed|s)?|overflow(?:ed)?|limit[\s_-]exceeded)(?:$|[^a-z0-9])`, "i");
/** Request-size wording that ties "too large" directly to model context capacity. */
const TOO_LARGE_FOR_CONTEXT = new RegExp(String.raw`\b(?:request|prompt|input|messages?)\s+(?:is\s+|are\s+)?` + String.raw`too\s+(?:large|long)\s+for\s+(?:(?:this|the)\s+)?` + String.raw`(?:model(?:'s)?\s+)?context(?:\s+window)?\b`, "i");
/** "Exceeds" wording is safe only when its object is explicitly the model context. */
const EXCEEDS_MODEL_CONTEXT = new RegExp(String.raw`\b(?:input|prompt|request|messages?)\b.{0,40}` + String.raw`\b(?:exceed(?:s|ed)?|overflows?|is\s+larger\s+than)\b.{0,40}` + String.raw`\b(?:the\s+)?(?:model(?:'s)?\s+)?context(?:\s+(?:length|window))?\b`, "i");
/**
* Provider-owned request-retry policy configuration and resolution.
*
* Adapters expose one resolved policy per registered provider route; the
* optional dsh-llm-retry plugin executes it on the agent's failed-step extension point.
*
* @module @deepseek-ai/dsh-llm/retry-policy
*/
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_INITIAL_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 1e4;
const DEFAULT_JITTER_RATIO = .1;
const DEFAULT_RETRYABLE_CODES = Object.freeze([
	EMPTY_RESPONSE_CODE,
	"RATE_LIMIT",
	"SERVER",
	"TIMEOUT",
	"TRANSPORT"
]);
const backoffSchema = Schema.object({
	initialDelayMs: Schema.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_INITIAL_DELAY_MS),
	maxDelayMs: Schema.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_MAX_DELAY_MS),
	jitterRatio: Schema.number().min(0).max(1).default(DEFAULT_JITTER_RATIO)
});
const normalPolicySchema = Schema.object({
	mode: Schema.const("normal").required(),
	maxRetries: Schema.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_MAX_RETRIES),
	retryableCodes: Schema.array(Schema.string()).default([...DEFAULT_RETRYABLE_CODES]),
	backoff: backoffSchema
});
const alwaysPolicySchema = Schema.object({
	mode: Schema.const("always").required(),
	backoff: backoffSchema
});
/** Cordis schema embedded by each concrete provider configuration. */
const RetryPolicySchema = Schema.union([normalPolicySchema, alwaysPolicySchema]);
const NORMAL_POLICY_KEYS = new Set([
	"mode",
	"maxRetries",
	"retryableCodes",
	"backoff"
]);
const ALWAYS_POLICY_KEYS = new Set([
	"mode",
	"maxRetries",
	"retryableCodes",
	"backoff"
]);
const BACKOFF_KEYS = new Set([
	"initialDelayMs",
	"maxDelayMs",
	"jitterRatio"
]);
function validateKeys(value, allowed, path) {
	for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`${path}: unknown key "${key}"`);
}
function resolveBackoff(config, path) {
	if (config !== void 0) validateKeys(config, BACKOFF_KEYS, path);
	const initialDelayMs = config?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
	const maxDelayMs = config?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
	const jitterRatio = config?.jitterRatio ?? DEFAULT_JITTER_RATIO;
	if (!Number.isFinite(initialDelayMs) || initialDelayMs <= 0 || initialDelayMs > MAX_TIMER_DELAY_MS) throw new Error(`${path}.initialDelayMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`);
	if (!Number.isFinite(maxDelayMs) || maxDelayMs <= 0 || maxDelayMs > MAX_TIMER_DELAY_MS) throw new Error(`${path}.maxDelayMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`);
	if (initialDelayMs > maxDelayMs) throw new Error(`${path}.initialDelayMs must be less than or equal to maxDelayMs`);
	if (!Number.isFinite(jitterRatio) || jitterRatio < 0 || jitterRatio > 1) throw new Error(`${path}.jitterRatio must be between 0 and 1`);
	return Object.freeze({
		initialDelayMs,
		maxDelayMs,
		jitterRatio
	});
}
/**
* Validate, default, and detach one provider-owned retry policy.
* @param config - optional provider configuration; omission selects normal defaults.
* @param path - diagnostic path naming the provider config that owns the value.
* @returns an immutable policy safe to capture in provider registration state.
*/
function resolveRetryPolicy(config, path) {
	if (config === void 0) return Object.freeze({
		mode: "normal",
		maxRetries: DEFAULT_MAX_RETRIES,
		retryableCodes: DEFAULT_RETRYABLE_CODES,
		...resolveBackoff(void 0, `${path}.backoff`)
	});
	switch (config.mode) {
		case "normal": {
			validateKeys(config, NORMAL_POLICY_KEYS, path);
			const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
			const retryableCodes = config.retryableCodes ?? [...DEFAULT_RETRYABLE_CODES];
			if (!Number.isSafeInteger(maxRetries) || maxRetries < 0) throw new Error(`${path}.maxRetries must be a non-negative safe integer`);
			if (retryableCodes.length === 0) throw new Error(`${path}.retryableCodes must not be empty`);
			if (retryableCodes.some((code) => typeof code !== "string" || code.length === 0)) throw new Error(`${path}.retryableCodes must contain only non-empty strings`);
			if (new Set(retryableCodes).size !== retryableCodes.length) throw new Error(`${path}.retryableCodes must not contain duplicates`);
			return Object.freeze({
				mode: "normal",
				maxRetries,
				retryableCodes: Object.freeze([...retryableCodes]),
				...resolveBackoff(config.backoff, `${path}.backoff`)
			});
		}
		case "always":
			validateKeys(config, ALWAYS_POLICY_KEYS, path);
			return Object.freeze({
				mode: "always",
				...resolveBackoff(config.backoff, `${path}.backoff`)
			});
		default: throw new Error(`${path}.mode must be "normal" or "always"`);
	}
}
/**
* Field-wise equality over {@link LlmCallConfig} — the comparison a caller
* runs to decide whether a proposed configuration is a real change (worth a
* logged header snapshot) or the held one restated.
* @param a - one configuration.
* @param b - the other.
* @returns whether every field (including the `stop` list, element-wise) matches.
*/
function callConfigEquals(a, b) {
	if (a.provider !== b.provider || a.model !== b.model || a.reasoningEffort !== b.reasoningEffort || a.temperature !== b.temperature || a.maxTokens !== b.maxTokens) return false;
	if (a.stop === void 0 || b.stop === void 0) return a.stop === b.stop;
	return a.stop.length === b.stop.length && a.stop.every((s, i) => s === b.stop?.[i]);
}
/**
* Normalization for values thrown by a final LLM adapter boundary.
*
* @module @deepseek-ai/dsh-llm/adapter-failure
*/
/**
* Detach serializable provider facts from a value thrown by an adapter.
* @param value - arbitrary value thrown during adapter dispatch or iteration.
* @returns immutable provider-neutral facts suitable for a terminal finish chunk.
* @internal
*/
function normalizeLlmFailure(value) {
	const error = value instanceof Error ? value : new HarnessError(thrownMessage(value), "UNKNOWN", { cause: value });
	const carried = ownFailureSnapshot(error);
	if (carried !== void 0 && carried.code === ownErrorCode(error)) return carried;
	return Object.freeze({
		message: errorMessage$1(error),
		code: harnessErrorCode(error)
	});
}
/** Render a non-Error throw without letting hostile coercion escape normalization. */
function thrownMessage(value) {
	try {
		const message = String(value);
		return message.length > 0 ? message : "LLM adapter failed";
	} catch (_hostileThrownValue) {
		return "LLM adapter failed";
	}
}
/** Read a foreign error's own data-backed `code` without invoking accessors. */
function ownErrorCode(error) {
	try {
		const descriptor = Object.getOwnPropertyDescriptor(error, "code");
		return descriptor !== void 0 && "value" in descriptor ? descriptor.value : void 0;
	} catch (_sdkPropertyTrap) {
		return;
	}
}
/** Snapshot an own data property without invoking an SDK-defined accessor. */
function ownFailureSnapshot(error) {
	try {
		const descriptor = Object.getOwnPropertyDescriptor(error, "failure");
		return descriptor !== void 0 && "value" in descriptor ? failureSnapshot(descriptor.value) : void 0;
	} catch (_sdkPropertyTrap) {
		return;
	}
}
/** Validate and detach an arbitrary serializable failure payload. */
function failureSnapshot(value) {
	if (typeof value !== "object" || value === null) return void 0;
	try {
		const candidate = value;
		const message = candidate.message;
		const code = candidate.code;
		const status = candidate.status;
		const providerRetryAfterMs = candidate.providerRetryAfterMs;
		const requestId = candidate.requestId;
		if (typeof message !== "string" || message.length === 0 || typeof code !== "string" || code.length === 0 || status !== void 0 && (!Number.isInteger(status) || status < 100 || status > 599) || providerRetryAfterMs !== void 0 && (!Number.isFinite(providerRetryAfterMs) || providerRetryAfterMs <= 0) || requestId !== void 0 && (typeof requestId !== "string" || requestId.length === 0)) return void 0;
		return Object.freeze({
			message,
			code,
			...status === void 0 ? {} : { status },
			...providerRetryAfterMs === void 0 ? {} : { providerRetryAfterMs },
			...requestId === void 0 ? {} : { requestId }
		});
	} catch (_sdkFailureGetter) {
		return;
	}
}
/** Read an SDK error message without letting an accessor replace the primary failure. */
function errorMessage$1(error) {
	try {
		const message = error.message;
		if (typeof message === "string" && message.length > 0) return message;
	} catch (_sdkMessageGetter) {}
	return "LLM adapter failed";
}
/** Trust only Harness-owned codes; third-party SDK codes are not our taxonomy. */
function harnessErrorCode(error) {
	return error instanceof HarnessError ? error.code : "UNKNOWN";
}
function quoted(value) {
	return JSON.stringify(value);
}
/**
* Stable text shown to a model that cannot accept one durable image reference.
* @param ref - durable normalized attachment omitted from the request.
* @returns deterministic text-only placeholder.
*/
function textOnlyImageText(ref) {
	return `[image omitted because this model accepts text only; attachment sha256:${String(ref.attachmentId).slice(7, 15)}]`;
}
/**
* True when typed model content contains an image block, walking nested
* tool-result content. This is the one recursive image walk shared by every
* image policy (capability gating, text-only serialization, compaction
* survey), so a consumer cannot silently diverge on nesting depth.
* @param content - typed model content blocks.
* @returns whether any nested block is an image.
*/
function contentHasImage(content) {
	return content.some((block) => block.type === "image" || block.type === "tool-result" && contentHasImage(block.content));
}
/**
* True when typed model content contains a file block, walking nested
* tool-result content on the same recursion every file policy shares.
* Reads current content on every call without retaining scan results.
* @param content - typed model content blocks.
* @returns whether any nested block is a file.
*/
function contentHasFile(content) {
	for (const block of content) if (block.type === "file" || block.type === "tool-result" && contentHasFile(block.content)) return true;
	return false;
}
/**
* Stable model-facing handle for one durable file reference: the address of
* the verbatim stored copy and the instruction to read it on demand. This is
* the only representation a provider ever receives for a file.
* @param ref - durable verbatim file reference.
* @param readonlyPath - execution-world path of the stored copy, when resolvable.
* @returns deterministic handle text naming the file, its size, and its address.
*/
function fileHandleText(ref, readonlyPath) {
	const digest = String(ref.attachmentId).slice(7, 15);
	const identity = `File ${quoted(ref.name)} (${ref.bytes} bytes, sha256:${digest})`;
	if (readonlyPath === void 0) return `[${identity} was uploaded, but the current execution environment cannot access a readable path. Report that limitation if its contents are needed; do not claim to have read it.]`;
	return `[${identity}: verbatim read-only copy saved at ${quoted(readonlyPath)}. Read that path with your file tools when its contents are needed; copy it to a writable location before modifying it. When delegating file work, include this saved path in the delegation prompt; only subagents sharing this execution environment can read it.]`;
}
/** Replace every file occurrence, including nested tool results, with handle text. */
function replaceFilesWithHandles(blocks, resolvePath) {
	let next;
	for (const [index, block] of blocks.entries()) {
		if (block.type === "file") {
			next ??= blocks.slice(0, index);
			next.push({
				type: "text",
				text: fileHandleText(block.attachment, resolvePath(block.attachment))
			});
			continue;
		}
		if (block.type === "tool-result") {
			const content = replaceFilesWithHandles(block.content, resolvePath);
			if (content !== block.content) {
				next ??= blocks.slice(0, index);
				next.push({
					...block,
					content
				});
				continue;
			}
		}
		next?.push(block);
	}
	return next ?? blocks;
}
/**
* Project durable file history into deterministic handle text for every model
* route. Unlike images, no provider receives file blocks natively, so this
* projection is unconditional in request assembly.
* @param messages - complete request history.
* @param resolvePath - resolve one reference's current execution-world read path.
* @returns the original list without files, otherwise shallow message copies with handle text.
*/
function projectFilesToText(messages, resolvePath) {
	if (!messages.some((message) => contentHasFile(message.content))) return messages;
	return messages.map((message) => {
		const content = replaceFilesWithHandles(message.content, resolvePath);
		return content === message.content ? message : {
			...message,
			content
		};
	});
}
/** Replace every image occurrence, including nested tool results, for a text-only model. */
function replaceImagesForTextModel(blocks) {
	let next;
	for (const [index, block] of blocks.entries()) {
		if (block.type === "image") {
			next ??= blocks.slice(0, index);
			next.push({
				type: "text",
				text: textOnlyImageText(block.attachment)
			});
			continue;
		}
		if (block.type === "tool-result") {
			const content = replaceImagesForTextModel(block.content);
			if (content !== block.content) {
				next ??= blocks.slice(0, index);
				next.push({
					...block,
					content
				});
				continue;
			}
		}
		next?.push(block);
	}
	return next ?? blocks;
}
/**
* Project durable image history into deterministic text for an exact text-only model.
* @param messages - complete request history.
* @returns the original list without images, otherwise shallow message copies with stable placeholders.
*/
function projectImagesForTextModel(messages) {
	if (!messages.some((message) => contentHasImage(message.content))) return messages;
	return messages.map((message) => {
		const content = replaceImagesForTextModel(message.content);
		return content === message.content ? message : {
			...message,
			content
		};
	});
}
/**
* Centralize the non-secret product identity every provider request sends as `User-Agent`, keeping
* adapters from drifting. See
* `.agents/notes/implemented/architecture/2026-06-21-mandatory-app-attribution-headers.md`.
*
* App-attribution vocabulary for provider requests.
* @module @deepseek-ai/dsh-llm/attribution
*/
const { version } = createRequire(import.meta.url)("../package.json");
/**
* LLM service: adapter registry with a waterfall-interceptable streaming call
* API. Exports the `LlmRuntime` default, the abstract `LlmAdapter` for
* provider backends, and `BlockAssembler` for chunk assembly.
*
* @module @deepseek-ai/dsh-llm
*/
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) if (kind === "field") initializers.unshift(_);
		else descriptor[key] = _;
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
/**
* Typed error for LLM-related failures. Extends {@link HarnessError}, so the
* `code` string (e.g. `AUTH`, `RATE_LIMIT`, `NO_ADAPTER`) is shared taxonomy.
*/
var LlmError = class extends HarnessError {
	/** Serializable facts retained beside this live Error. */
	failure;
	/**
	* @param message - non-empty human-readable failure summary.
	* @param code - non-empty stable provider-neutral machine code.
	* @param options - optional cause and validated serializable provider facts.
	*/
	constructor(message, code, options) {
		if (typeof message !== "string" || message.length === 0) throw new Error("LlmError message must be a non-empty string");
		if (typeof code !== "string" || code.length === 0) throw new Error("LlmError code must be a non-empty string");
		if (options?.status !== void 0 && (!Number.isInteger(options.status) || options.status < 100 || options.status > 599)) throw new Error("LlmError status must be an integer from 100 through 599");
		if (options?.providerRetryAfterMs !== void 0 && (!Number.isFinite(options.providerRetryAfterMs) || options.providerRetryAfterMs <= 0)) throw new Error("LlmError providerRetryAfterMs must be a positive finite number");
		if (options?.requestId !== void 0 && (typeof options.requestId !== "string" || options.requestId.length === 0)) throw new Error("LlmError requestId must be a non-empty string");
		super(message, code, options);
		this.name = "LlmError";
		this.failure = Object.freeze({
			message,
			code,
			...options?.status === void 0 ? {} : { status: options.status },
			...options?.providerRetryAfterMs === void 0 ? {} : { providerRetryAfterMs: options.providerRetryAfterMs },
			...options?.requestId === void 0 ? {} : { requestId: options.requestId }
		});
	}
};
/**
* The abstract `llm` service: an adapter registry plus a streaming model-call
* API, interceptable via the `llm/stream` waterfall.
*/
let LlmRuntime = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _listProviders_decorators;
	let _listConfigurableProviders_decorators;
	let _remoteDiscoverModels_decorators;
	return class LlmRuntime$1 extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_listProviders_decorators = [Remote];
			_listConfigurableProviders_decorators = [Remote];
			_remoteDiscoverModels_decorators = [Remote("discoverModels")];
			__esDecorate(this, null, _listProviders_decorators, {
				kind: "method",
				name: "listProviders",
				static: false,
				private: false,
				access: {
					has: (obj) => "listProviders" in obj,
					get: (obj) => obj.listProviders
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _listConfigurableProviders_decorators, {
				kind: "method",
				name: "listConfigurableProviders",
				static: false,
				private: false,
				access: {
					has: (obj) => "listConfigurableProviders" in obj,
					get: (obj) => obj.listConfigurableProviders
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _remoteDiscoverModels_decorators, {
				kind: "method",
				name: "remoteDiscoverModels",
				static: false,
				private: false,
				access: {
					has: (obj) => "remoteDiscoverModels" in obj,
					get: (obj) => obj.remoteDiscoverModels
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		adapters = (__runInitializers(this, _instanceExtraInitializers), /* @__PURE__ */ new Map());
		directory = /* @__PURE__ */ new Map();
		discoveries = /* @__PURE__ */ new Map();
		constructor(ctx) {
			super(ctx, "llm");
		}
		/** Notify topology observers without letting one broken listener veto the commit. */
		emitAdaptersUpdated() {
			let invariantFailure;
			for (const listener of this.ctx.events.dispatch("emit", ["llm/adapters-updated"])) try {
				const returned = listener();
				if (returned != null && typeof returned.then === "function") Promise.resolve(returned).then(void 0, (error) => {
					this.warnAdaptersListenerFailure(error);
				});
			} catch (error) {
				if (error?.code === "INVARIANT") {
					invariantFailure ??= error;
					continue;
				}
				this.warnAdaptersListenerFailure(error);
			}
			if (invariantFailure !== void 0) throw invariantFailure;
		}
		/** Contained-listener diagnostic shared by the sync and async failure paths. */
		warnAdaptersListenerFailure(error) {
			this.ctx.logger.warn("llm: an llm/adapters-updated listener failed");
			this.ctx.logger.warn(error);
		}
		/**
		* Register an adapter for the given provider routes. Throws `LlmError` with code
		* `DUPLICATE_ADAPTER` if any provider already has an adapter (all-or-nothing).
		* Disposed with the fiber.
		* @param providers - every provider route this adapter should serve.
		* @param adapter - the adapter that streams calls for those providers.
		* @returns the disposer, carrying {@link AdapterRegistrationHandle.replace}.
		*/
		registerAdapter(providers, adapter) {
			const owned = /* @__PURE__ */ new Set();
			let released = false;
			const dispose = this.ctx.effect(function* () {
				if (providers.length === 0) throw new LlmError("an adapter must register at least one provider", "INVALID_ADAPTER");
				this.commitRoutes(owned, this.prepareRoutes(providers, adapter, owned));
				yield () => {
					released = true;
					for (const provider of owned) this.adapters.delete(provider);
					owned.clear();
					this.emitAdaptersUpdated();
				};
			}.bind(this), "llm.registerAdapter()");
			const handle = () => void dispose();
			handle.replace = (next) => {
				if (released) throw new LlmError("a disposed adapter registration cannot replace its routes", "REGISTRATION_DISPOSED");
				this.commitRoutes(owned, this.prepareRoutes(next, adapter, owned));
			};
			return handle;
		}
		/**
		* Validate one candidate route set for `adapter`, treating routes this
		* registration already holds as available. Nothing is mutated: a rejected
		* candidate leaves the registry exactly as it was.
		*/
		prepareRoutes(providers, adapter, owned) {
			const unique = /* @__PURE__ */ new Set();
			const registrations = [];
			for (const provider of providers) {
				if (provider.length === 0) throw new LlmError("adapter provider names must be non-empty", "INVALID_ADAPTER");
				if (unique.has(provider) || this.adapters.has(provider) && !owned.has(provider)) throw new LlmError(`an adapter for provider "${provider}" is already registered`, "DUPLICATE_ADAPTER");
				const info = adapter.providerInfo(provider);
				if (typeof info.id !== "string" || info.id !== provider || typeof info.name !== "string" || info.name.length === 0) throw new LlmError(`adapter metadata for provider "${provider}" must preserve its id and have a non-empty name`, "INVALID_ADAPTER");
				unique.add(provider);
				const retryPolicy = adapter.providerRetryPolicy(provider) ?? resolveRetryPolicy(void 0, `llm: provider "${provider}" retryPolicy`);
				registrations.push({
					adapter,
					provider: {
						id: info.id,
						name: info.name
					},
					retryPolicy
				});
			}
			return registrations;
		}
		/**
		* Swap this registration's routes for the prepared ones in one synchronous
		* section, so no observer can see the registry between the release and the
		* re-registration. The route set's one mutation point is also where
		* `llm/adapters-updated` is published, so a `replace` announces itself
		* exactly like a first registration.
		*/
		commitRoutes(owned, registrations) {
			for (const provider of owned) this.adapters.delete(provider);
			owned.clear();
			for (const registration of registrations) {
				this.adapters.set(registration.provider.id, registration);
				owned.add(registration.provider.id);
			}
			this.emitAdaptersUpdated();
		}
		/**
		* Describe provider routes with a registered adapter.
		* @returns detached provider metadata in registration order.
		*/
		listProviders() {
			return [...this.adapters.values()].map(({ provider }) => ({ ...provider }));
		}
		/**
		* Declare provider routes an adapter plugin can activate through
		* configuration. Registration is all-or-nothing: an empty list, invalid
		* entry, or a provider already declared by any registration throws
		* `LlmError` without registering the rest. Disposed with the fiber.
		* @param entries - every configurable provider this plugin owns.
		* @returns a handle that withdraws all of them, and can atomically replace them.
		*/
		registerConfigurableProviders(entries) {
			let held = [];
			let disposed = false;
			/**
			* Validate a candidate set in full against everything this registration
			* does not already hold, then publish it. Nothing is written until the
			* whole set passes, so a refused candidate leaves the current entries in
			* place — the property that makes `replace` a swap rather than a
			* delete-then-add that can strand the directory empty.
			*/
			const commit = (candidates) => {
				const detached = [];
				const own = new Set(held.map((entry) => entry.provider));
				for (const entry of candidates) {
					if (entry.provider.length === 0 || entry.displayName.length === 0 || entry.settingsNs.length === 0) throw new LlmError("configurable providers need a non-empty provider, displayName, and settingsNs", "INVALID_DIRECTORY");
					if (entry.settingsPath.some((segment) => segment.length === 0)) throw new LlmError(`configurable provider "${entry.provider}" has an empty settingsPath segment`, "INVALID_DIRECTORY");
					if (this.directory.has(entry.provider) && !own.has(entry.provider) || detached.some((seen) => seen.provider === entry.provider)) throw new LlmError(`configurable provider "${entry.provider}" is already declared`, "DUPLICATE_DIRECTORY");
					detached.push({
						...entry,
						settingsPath: [...entry.settingsPath]
					});
				}
				for (const entry of held) this.directory.delete(entry.provider);
				for (const entry of detached) this.directory.set(entry.provider, entry);
				held = detached;
				this.emitAdaptersUpdated();
			};
			const dispose = this.ctx.effect(function* () {
				if (entries.length === 0) throw new LlmError("a configurable-provider registration must declare at least one provider", "INVALID_DIRECTORY");
				commit(entries);
				yield () => {
					disposed = true;
					for (const entry of held) this.directory.delete(entry.provider);
					held = [];
					this.emitAdaptersUpdated();
				};
			}.bind(this), "llm.registerConfigurableProviders()");
			const handle = () => void dispose();
			handle.replace = (next) => {
				if (disposed) throw new LlmError("this configurable-provider registration was disposed", "REGISTRATION_DISPOSED");
				commit(next);
			};
			return handle;
		}
		/**
		* List every declared configurable provider, registered or dormant.
		* @returns detached directory entries in declaration order.
		*/
		listConfigurableProviders() {
			return [...this.directory.values()].map((entry) => ({
				...entry,
				settingsPath: [...entry.settingsPath]
			}));
		}
		/**
		* Offer to interrogate provider endpoints on behalf of the settings
		* namespace this plugin owns. The namespace is the key because that is what
		* a configuration surface already holds from the configurable-provider
		* directory, and because a provider being *added* has no route to name yet.
		* Disposed with the fiber.
		* @param settingsNs - the namespace whose profiles this discovery serves.
		* @param discover - interrogates one endpoint and must honor the supplied signal.
		* @returns the disposer that withdraws the offer.
		*/
		registerModelDiscovery(settingsNs, discover) {
			const dispose = this.ctx.effect(function* () {
				if (settingsNs.length === 0) throw new LlmError("model discovery needs a non-empty settings namespace", "INVALID_DISCOVERY");
				if (this.discoveries.has(settingsNs)) throw new LlmError(`model discovery for "${settingsNs}" is already registered`, "DUPLICATE_DISCOVERY");
				this.discoveries.set(settingsNs, discover);
				yield () => {
					this.discoveries.delete(settingsNs);
				};
			}.bind(this), "llm.registerModelDiscovery()");
			return () => void dispose();
		}
		/**
		* Interrogate one provider endpoint for the models it advertises. The
		* request describes a draft, not a stored route, so nothing here reads or
		* writes settings or credentials — the caller owns both, and the reply is
		* candidate metadata a surface may offer for adoption.
		* @param settingsNs - namespace whose registered discovery serves this draft.
		* @param request - the endpoint, protocol, and one-shot credential to use.
		* @param signal - caller cancellation.
		* @returns the advertised models, deduplicated in endpoint order.
		*/
		async discoverModels(settingsNs, request$1, signal) {
			const discover = this.discoveries.get(settingsNs);
			if (discover === void 0) throw new LlmError(`no model discovery is registered for "${settingsNs}"`, "NO_DISCOVERY");
			if ((request$1.provider ?? "").length === 0 && (request$1.baseURL ?? "").length === 0) throw new LlmError("model discovery needs a provider route or a baseURL", "INVALID_DISCOVERY");
			const discovered = signal === void 0 ? await discover(request$1) : await discover(request$1, signal);
			const seen = /* @__PURE__ */ new Set();
			const models = [];
			for (const model of discovered) {
				if (typeof model.id !== "string" || model.id.length === 0 || seen.has(model.id)) continue;
				seen.add(model.id);
				models.push({
					id: model.id,
					...model.name === void 0 ? {} : { name: model.name },
					...model.contextWindow === void 0 ? {} : { contextWindow: model.contextWindow },
					...model.maxTokens === void 0 ? {} : { maxTokens: model.maxTokens }
				});
			}
			return models;
		}
		/**
		* Remote adapter for one draft provider interrogation.
		* @param settingsNs - namespace whose registered discovery serves this draft.
		* @param request - endpoint, protocol, and one-shot credential to use.
		* @param signal - caller cancellation supplied by the Remote carrier.
		* @returns advertised models in endpoint order.
		* @throws RemoteError with `llm/model-discovery-rejected` when discovery refuses or fails.
		*/
		async remoteDiscoverModels(settingsNs, request$1, signal) {
			try {
				return await this.discoverModels(settingsNs, request$1, signal);
			} catch (error) {
				throw new RemoteError("llm/model-discovery-rejected", error instanceof Error ? error.message : String(error), {
					settingsNs,
					...request$1.baseURL === void 0 ? {} : { baseURL: request$1.baseURL }
				}, { cause: error });
			}
		}
		/**
		* Resolve the retry policy captured when one provider route was registered.
		* @param provider - registered provider route to inspect.
		* @returns the provider-owned policy, with normal defaults already resolved.
		*/
		providerRetryPolicy(provider) {
			return this.registration(provider).retryPolicy;
		}
		/**
		* Resolve provider-side request-image pricing for one exact route, or
		* `undefined` when the provider is unregistered or declares none. Unknown
		* providers degrade to `undefined` rather than throwing because callers
		* price durable history whose route may no longer be mounted.
		* @param provider - provider route named by a request header.
		* @param model - exact model id named by the same header.
		* @returns the owning adapter's image pricing for the route, when declared.
		*/
		imageRequestPricing(provider, model) {
			return this.adapters.get(provider)?.adapter.imageRequestPricing(provider, model);
		}
		/**
		* Resolve the exact text one durable file occurrence contributes to every
		* provider request in the current execution environment.
		* @param ref - durable verbatim file reference from model history.
		* @returns the same deterministic handle text used at adapter dispatch.
		*/
		fileRequestText(ref) {
			return fileHandleText(ref, this.fileReadPath(ref));
		}
		/** Detach typed adapter-owned modality metadata. */
		detachedModalities(modalities) {
			return modalities === void 0 ? void 0 : [...modalities];
		}
		/**
		* Discover models advertised by one registered provider. Catalog membership
		* is advisory and never changes routing or request validation.
		* @param provider - registered provider route to inspect.
		* @returns detached model metadata in adapter-preferred order.
		*/
		async listModels(provider) {
			const models = await this.registration(provider).adapter.listModels(provider);
			const seen = /* @__PURE__ */ new Set();
			return models.map((model) => {
				if (typeof model.provider !== "string" || model.provider !== provider || typeof model.id !== "string" || model.id.length === 0 || typeof model.name !== "string" || model.name.length === 0 || model.description !== void 0 && typeof model.description !== "string" || seen.has(model.id)) throw new LlmError(`adapter returned invalid or duplicate model metadata for provider "${provider}"`, "INVALID_CATALOG");
				seen.add(model.id);
				const inputModalities = this.detachedModalities(model.inputModalities);
				return {
					provider: model.provider,
					id: model.id,
					name: model.name,
					...model.description === void 0 ? {} : { description: model.description },
					...inputModalities === void 0 ? {} : { inputModalities }
				};
			});
		}
		/**
		* Resolve and validate all metadata from the adapter that owns one exact
		* route. The result is detached from adapter-owned objects; catalog
		* membership remains advisory and does not control request routing.
		* @param provider - registered provider route to inspect.
		* @param model - exact model id passed to the adapter.
		* @param signal - optional cancellation for adapter-owned asynchronous lookup.
		* @returns exact model identity plus available context and reasoning metadata.
		*/
		async resolveModelInfo(provider, model, signal) {
			return this.resolveModelInfoFor(this.registration(provider), model, signal);
		}
		async resolveModelInfoFor(registration, model, signal) {
			const resolved = await registration.adapter.resolveModel(registration.provider.id, model, signal);
			return this.normalizeModelInfo(registration, model, resolved);
		}
		/** Validate and detach one adapter-returned exact model result. */
		normalizeModelInfo(registration, model, resolved) {
			const provider = registration.provider.id;
			if (typeof resolved.provider !== "string" || resolved.provider !== provider || typeof resolved.id !== "string" || resolved.id !== model || typeof resolved.name !== "string" || resolved.name.length === 0 || resolved.description !== void 0 && typeof resolved.description !== "string") throw new LlmError(`adapter returned invalid exact model metadata for provider "${provider}" model "${model}"`, "INVALID_MODEL_INFO");
			const context = resolved.context;
			if (context !== void 0 && (!Number.isInteger(context.contextWindow) || context.contextWindow <= 0)) throw new LlmError(`adapter returned invalid context metadata for provider "${provider}" model "${model}"`, "INVALID_MODEL_CONTEXT");
			const inputModalities = this.detachedModalities(resolved.inputModalities);
			const systemPromptUpdate = resolved.systemPromptUpdate;
			if (systemPromptUpdate !== void 0 && systemPromptUpdate !== "in-history") throw new LlmError(`adapter returned invalid system prompt update mode for provider "${provider}" model "${model}"`, "INVALID_MODEL_INFO");
			const defaultMaxTokens = resolved.defaultMaxTokens;
			if (defaultMaxTokens !== void 0 && (!Number.isSafeInteger(defaultMaxTokens) || defaultMaxTokens <= 0)) throw new LlmError(`adapter returned invalid default maxTokens for provider "${provider}" model "${model}"`, "INVALID_MODEL_MAX_TOKENS");
			const info = {
				provider,
				id: model,
				name: resolved.name,
				...resolved.description === void 0 ? {} : { description: resolved.description },
				...inputModalities === void 0 ? {} : { inputModalities },
				...context === void 0 ? {} : { context: { contextWindow: context.contextWindow } },
				...defaultMaxTokens === void 0 ? {} : { defaultMaxTokens },
				...resolved.systemPromptUpdate === void 0 ? {} : { systemPromptUpdate: resolved.systemPromptUpdate }
			};
			const reasoning = resolved.reasoning;
			if (reasoning === void 0) return info;
			if (reasoning.efforts.length === 0) throw new LlmError(`adapter returned invalid reasoning metadata for provider "${provider}" model "${model}"`, "INVALID_MODEL_REASONING");
			const seen = /* @__PURE__ */ new Set();
			const efforts = reasoning.efforts.map((effort) => {
				if (typeof effort.id !== "string" || effort.id.length === 0 || typeof effort.name !== "string" || effort.name.length === 0 || effort.description !== void 0 && typeof effort.description !== "string" || seen.has(effort.id)) throw new LlmError(`adapter returned invalid or duplicate reasoning effort metadata for provider "${provider}" model "${model}"`, "INVALID_MODEL_REASONING");
				seen.add(effort.id);
				return {
					id: effort.id,
					name: effort.name,
					...effort.description === void 0 ? {} : { description: effort.description }
				};
			});
			if (reasoning.defaultEffort !== void 0 && !seen.has(reasoning.defaultEffort)) throw new LlmError(`adapter returned an unknown default reasoning effort for provider "${provider}" model "${model}"`, "INVALID_MODEL_REASONING");
			return {
				...info,
				reasoning: {
					efforts,
					...reasoning.defaultEffort === void 0 ? {} : { defaultEffort: reasoning.defaultEffort }
				}
			};
		}
		/**
		* Validate a conversation call config against its exact model capability and
		* materialize adapter-configured defaults. Unsupported explicit efforts
		* reject before provider I/O; no clamping or aliasing is performed. This
		* standalone query does not bind a later dispatch; use {@link prepareCall}
		* when logging and streaming must share one adapter registration.
		* @param config - provider/model route and optional request controls.
		* @param signal - optional cancellation for adapter-owned capability lookup.
		* @returns a detached config only when a default must be materialized.
		*/
		async resolveCallConfig(config, signal) {
			return (await this.resolveCallFor(this.registration(config.provider), config, signal)).config;
		}
		async resolveCallFor(registration, config, signal) {
			const info = await this.resolveModelInfoFor(registration, config.model, signal);
			return this.resolveCallWithInfo(config, info);
		}
		/** Validate request controls against one already-bound exact model result. */
		resolveCallWithInfo(config, info) {
			const defaulted = config.maxTokens === void 0 && info.defaultMaxTokens !== void 0 ? {
				...config,
				maxTokens: info.defaultMaxTokens
			} : config;
			const reasoning = info.reasoning;
			const requested = defaulted.reasoningEffort;
			let resolvedConfig = defaulted;
			if (reasoning === void 0) {
				if (requested !== void 0) throw new LlmError(`provider "${config.provider}" model "${config.model}" does not support reasoning effort "${requested}"`, "UNSUPPORTED_REASONING_EFFORT");
			} else {
				const effective = requested ?? reasoning.defaultEffort;
				if (effective !== void 0) {
					if (!reasoning.efforts.some((effort) => effort.id === effective)) throw new LlmError(`provider "${config.provider}" model "${config.model}" does not support reasoning effort "${effective}"`, "UNSUPPORTED_REASONING_EFFORT");
					if (requested !== effective) resolvedConfig = {
						...defaulted,
						reasoningEffort: effective
					};
				}
			}
			return {
				config: resolvedConfig,
				...info.context === void 0 ? {} : { context: info.context },
				modelInfo: info
			};
		}
		/**
		* Resolve one call under its current adapter registration. The returned
		* one-shot handle keeps that registration across header logging and dispatch,
		* so HMR cannot combine one adapter's capability result with another adapter.
		* @param config - provider/model route and optional request controls.
		* @param signal - optional cancellation for adapter-owned capability lookup.
		* @returns a prepared config and its registration-bound stream entry point.
		*/
		async prepareCall(config, signal) {
			const registration = this.registration(config.provider);
			const adapterCall = await registration.adapter.prepareCall(config.provider, config.model, signal);
			const modelInfo = this.normalizeModelInfo(registration, config.model, adapterCall.model);
			const resolved = this.resolveCallWithInfo(config, modelInfo);
			const resolvedConfig = deepFreeze(structuredClone(resolved.config));
			const context = resolved.context === void 0 ? void 0 : deepFreeze(structuredClone(resolved.context));
			const adapterDefaults = deepFreeze({
				...config.reasoningEffort === void 0 && resolvedConfig.reasoningEffort !== void 0 ? { reasoningEffort: true } : {},
				...config.maxTokens === void 0 && resolvedConfig.maxTokens !== void 0 ? { maxTokens: true } : {}
			});
			let dispatched = false;
			return Object.freeze({
				config: resolvedConfig,
				retryPolicy: registration.retryPolicy,
				adapterDefaults,
				...context === void 0 ? {} : { context },
				...modelInfo.inputModalities === void 0 ? {} : { inputModalities: Object.freeze([...modelInfo.inputModalities]) },
				...modelInfo.systemPromptUpdate === void 0 ? {} : { systemPromptUpdate: modelInfo.systemPromptUpdate },
				stream: (options) => {
					if (dispatched) throw new LlmError("a prepared LLM call can only be dispatched once", "INVALID_PREPARED_CALL");
					if (!callConfigEquals(options, resolvedConfig)) throw new LlmError("prepared LLM call config changed before adapter dispatch", "INVALID_PREPARED_CALL");
					dispatched = true;
					return this.streamWithRegistration(options, {
						registration,
						config: resolvedConfig,
						modelInfo,
						dispatch: (options$1) => adapterCall.stream(options$1)
					});
				}
			});
		}
		registration(provider) {
			const registration = this.adapters.get(provider);
			if (!registration) throw new LlmError(`no adapter registered for provider "${provider}"`, "NO_ADAPTER");
			return registration;
		}
		/** Remove replay state whose historical route is owned by another adapter. */
		forAdapter(options, adapter) {
			const messages = options.messages.map((message) => {
				const source = message.source;
				if (message.role !== "assistant" || source.kind !== "model" || source.replayState === void 0) return message;
				if (this.adapters.get(source.provider)?.adapter === adapter) return message;
				return freezeMessage({
					...message,
					source: {
						kind: "model",
						provider: source.provider,
						model: source.model
					}
				});
			});
			if (messages.every((message, index) => message === options.messages[index])) return options;
			const filtered = {
				...options,
				messages
			};
			return Object.isFrozen(options) ? deepFreeze(filtered) : filtered;
		}
		/**
		* Resolve the current execution-world read path of one durable file
		* reference through the mounted attachment and filesystem providers.
		*/
		fileReadPath(ref) {
			let hostPath;
			try {
				hostPath = this.ctx.get("attachments")?.fileHostPath(ref);
			} catch {
				return;
			}
			if (hostPath === void 0) return void 0;
			return this.ctx.get("fs")?.processPathFromHostPath(hostPath);
		}
		/**
		* Final adapter boundary. Adapter selection, dispatch, iterator construction,
		* and iteration failures become one terminal failure chunk. Middleware and
		* downstream consumer failures remain thrown plugin or consumer errors.
		*/
		async *adapterStream(options, prepared) {
			let iterator;
			try {
				const registration = prepared?.registration ?? this.registration(options.provider);
				const adapter = registration.adapter;
				let modelInfo;
				let resolvedConfig;
				let dispatch;
				if (prepared === void 0) {
					const adapterCall = await adapter.prepareCall(options.provider, options.model, options.signal);
					modelInfo = this.normalizeModelInfo(registration, options.model, adapterCall.model);
					resolvedConfig = this.resolveCallWithInfo(options, modelInfo).config;
					dispatch = (options$1) => adapterCall.stream(options$1);
				} else {
					modelInfo = prepared.modelInfo;
					resolvedConfig = prepared.config;
					dispatch = prepared.dispatch;
				}
				if (prepared !== void 0 && !callConfigEquals(options, resolvedConfig)) throw new LlmError("prepared LLM call config changed before adapter dispatch", "INVALID_PREPARED_CALL");
				const resolvedOptions = callConfigEquals(options, resolvedConfig) ? options : Object.isFrozen(options) ? deepFreeze({
					...options,
					...resolvedConfig
				}) : {
					...options,
					...resolvedConfig
				};
				let projectedMessages = resolvedOptions.messages;
				if (projectedMessages.some((message) => contentHasFile(message.content))) projectedMessages = projectFilesToText(projectedMessages, (ref) => this.fileReadPath(ref));
				if (modelInfo.inputModalities !== void 0 && !modelInfo.inputModalities.includes("image") && projectedMessages.some((message) => contentHasImage(message.content))) projectedMessages = projectImagesForTextModel(projectedMessages);
				const projectedOptions = projectedMessages === resolvedOptions.messages ? resolvedOptions : Object.isFrozen(resolvedOptions) ? deepFreeze({
					...resolvedOptions,
					messages: projectedMessages
				}) : {
					...resolvedOptions,
					messages: projectedMessages
				};
				iterator = dispatch(this.forAdapter(projectedOptions, adapter))[Symbol.asyncIterator]();
			} catch (error) {
				yield adapterFailureChunk(error, options.signal);
				return;
			}
			let completed = false;
			try {
				while (true) {
					let item;
					try {
						const next = await iterator.next();
						item = next.done ? { done: true } : {
							done: false,
							value: next.value
						};
					} catch (error) {
						completed = true;
						yield adapterFailureChunk(error, options.signal);
						return;
					}
					if (item.done) {
						completed = true;
						return;
					}
					yield item.value;
				}
			} finally {
				if (!completed) {
					const close = iterator.return?.bind(iterator);
					if (close) await close();
				}
			}
		}
		/**
		* Stream one model call as raw chunks (token-level deltas). Replay state is
		* retained only when the same adapter instance owns its historical provider
		* and the target provider. Final adapter selection remains fixed through
		* asynchronous exact-model resolution and dispatch. Adapter selection,
		* dispatch, and iteration failures become terminal `error` or `aborted`
		* finish chunks; middleware, nested-call, cleanup, and consumer failures
		* remain thrown.
		* @param options - the full request; `options.provider` selects the adapter.
		* @returns the chunk stream, possibly wrapped by `llm/stream` listeners.
		*/
		stream(options) {
			return this.streamWithRegistration(options);
		}
		streamWithRegistration(options, prepared) {
			return this.ctx.waterfall(this, "llm/stream", options, () => this.adapterStream(options, prepared));
		}
	};
})();
/** Convert one adapter throw into the stream protocol's terminal outcome. */
function adapterFailureChunk(error, signal) {
	const failure = normalizeLlmFailure(error);
	return {
		type: "finish",
		reason: signal?.aborted || failure.code === "ABORTED" ? {
			kind: "aborted",
			failure
		} : {
			kind: "error",
			failure
		}
	};
}

//#endregion
//#region node_modules/@deepseek-ai/dsh-tools/lib/index.js
/**
* Enforced JSON Schema subset shared by tool outputs, generated PTC mode
* types, subagents, and workflows. The subset accepts any JSON root, an
* annotation-only schema for unconstrained JSON, one scalar `type`, object
* `properties`/`required`/boolean `additionalProperties`, array `items`,
* type-correct scalar `enum`/`const`, and exact-one `oneOf`.
*
* Unsupported or misplaced keywords reject rather than being accepted without
* enforcement. Consumers that require an object root apply
* {@link assertObjectJsonSchema} before accepting input.
* @module dsh-tools/json-schema
*/
/**
* Thrown when a raw schema falls outside the enforced subset. `violations`
* lists every offending path instead of stopping at the first author error.
*/
var JsonSchemaError = class extends HarnessError {
	/** Individual schema violations in walk order. */
	violations;
	constructor(violations) {
		super(`unsupported JSON schema: ${violations.join("; ")}`, "UNSUPPORTED_SCHEMA");
		this.name = "JsonSchemaError";
		this.violations = violations;
	}
};
const CONSTRAINT_KEYWORDS = new Set([
	"type",
	"oneOf",
	"properties",
	"required",
	"additionalProperties",
	"items",
	"enum",
	"const"
]);
const ANNOTATION_KEYWORDS = new Set([
	"description",
	"title",
	"default",
	"examples"
]);
const SCHEMA_TYPES = [
	"object",
	"array",
	"string",
	"number",
	"integer",
	"boolean",
	"null"
];
/** Whether a realm-owned intrinsic prototype is backed by its native constructor. */
function hasIntrinsicConstructor(prototype, name$1) {
	const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;
	if (typeof constructor !== "function") return false;
	try {
		return constructor.name === name$1 && constructor.prototype === prototype && Function.prototype.toString.call(constructor) === `function ${name$1}() { [native code] }`;
	} catch {
		return false;
	}
}
/** Whether a candidate is one realm's intrinsic `Object.prototype`. */
function isIntrinsicObjectPrototype(value) {
	return Object.getPrototypeOf(value) === null && hasIntrinsicConstructor(value, "Object");
}
/**
* Test for a realm-agnostic plain JSON record without accepting arrays or
* exotic objects.
* @param value - candidate record from any JavaScript realm.
* @returns Whether the value has a plain-object prototype chain.
*/
function isPlainJsonRecord(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	try {
		const prototype = Object.getPrototypeOf(value);
		return prototype === null || typeof prototype === "object" && isIntrinsicObjectPrototype(prototype);
	} catch {
		return false;
	}
}
/** Whether an array uses one realm's intrinsic `Array.prototype`. */
function hasPlainArrayPrototype(value) {
	const prototype = Object.getPrototypeOf(value);
	if (!Array.isArray(prototype) || !hasIntrinsicConstructor(prototype, "Array")) return false;
	const objectPrototype = Object.getPrototypeOf(prototype);
	return typeof objectPrototype === "object" && objectPrototype !== null && isIntrinsicObjectPrototype(objectPrototype);
}
/** Return whether a record contains only own enumerable string keys. */
function hasOnlyEnumerableStringKeys(value) {
	try {
		return Reflect.ownKeys(value).every((key) => typeof key === "string" && Object.prototype.propertyIsEnumerable.call(value, key));
	} catch {
		return false;
	}
}
/**
* Test for an ordinary schema record whose keys survive JSON projection.
* @param value - candidate record from any JavaScript realm.
* @returns Whether the record has an intrinsic prototype and only own enumerable string keys.
*/
function isJsonSchemaRecord(value) {
	return isPlainJsonRecord(value) && hasOnlyEnumerableStringKeys(value);
}
/**
* Test for a dense ordinary array with no JSON-invisible decorations.
* @param value - candidate array from any JavaScript realm.
* @returns Whether the array is intrinsic, dense, and undecorated.
*/
function isPlainJsonArray(value) {
	if (!Array.isArray(value)) return false;
	try {
		if (!hasPlainArrayPrototype(value) || Reflect.ownKeys(value).length !== value.length + 1) return false;
		for (let index = 0; index < value.length; index++) if (!Object.hasOwn(value, index)) return false;
		return true;
	} catch {
		return false;
	}
}
/** Lossless finite JSON number, excluding negative zero. */
function isJsonNumber(value) {
	return typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0);
}
/** Whether a scalar is valid for one declared schema type. */
function scalarMatches(type, value) {
	switch (type) {
		case "string": return typeof value === "string";
		case "number": return isJsonNumber(value);
		case "integer": return isJsonNumber(value) && Number.isInteger(value);
		case "boolean": return typeof value === "boolean";
		case "null": return value === null;
		default: return assertNever(type, "JsonSchemaType");
	}
}
/** Keywords that are invalid beside `oneOf`. */
const ONE_OF_SIBLING_KEYWORDS = [
	"properties",
	"required",
	"additionalProperties",
	"items",
	"enum",
	"const"
];
/** Validate object-only fields after its property schemas have been visited. */
function checkObjectSchemaTail(node, path, properties, violations) {
	const hasRequired = Object.hasOwn(node, "required");
	const required = hasRequired ? node.required : void 0;
	if (hasRequired) if (!isPlainJsonArray(required) || required.some((entry) => typeof entry !== "string")) violations.push(`${path}.required must be an array of strings`);
	else {
		const declared = isJsonSchemaRecord(properties) ? properties : {};
		for (const key of required) if (!Object.hasOwn(declared, key)) violations.push(`${path}.required names "${key}" which is not in properties`);
	}
	if (Object.hasOwn(node, "additionalProperties") && typeof node.additionalProperties !== "boolean") violations.push(`${path}.additionalProperties must be a boolean`);
}
/** Collect every violation for one raw schema tree without using the JavaScript call stack. */
function checkSchemaNode(root, rootPath, violations, seen) {
	const tasks = [{
		kind: "enter",
		node: root,
		path: rootPath
	}];
	for (let task = tasks.pop(); task !== void 0; task = tasks.pop()) {
		if (task.kind === "leave") {
			seen.delete(task.node);
			continue;
		}
		if (task.kind === "one-of-tail") {
			for (const key of ONE_OF_SIBLING_KEYWORDS) if (Object.hasOwn(task.node, key)) violations.push(`${task.path}.${key} is not supported beside oneOf`);
			continue;
		}
		if (task.kind === "object-tail") {
			checkObjectSchemaTail(task.node, task.path, task.properties, violations);
			continue;
		}
		const { node, path } = task;
		if (!isJsonSchemaRecord(node)) {
			violations.push(`${path} must be a schema object`);
			continue;
		}
		if (seen.has(node)) {
			violations.push(`${path} is circular`);
			continue;
		}
		seen.add(node);
		tasks.push({
			kind: "leave",
			node
		});
		for (const key of Object.keys(node)) {
			if (CONSTRAINT_KEYWORDS.has(key)) continue;
			if (ANNOTATION_KEYWORDS.has(key)) {
				try {
					if (!isJsonValue(node[key])) violations.push(`${path}.${key} annotation must be lossless JSON data`);
				} catch {
					violations.push(`${path}.${key} annotation must be lossless JSON data`);
				}
				continue;
			}
			violations.push(`${path}.${key} is not a supported keyword (subset: type/oneOf/properties/required/additionalProperties/items/enum/const + annotations)`);
		}
		if (Object.hasOwn(node, "description") && typeof node.description !== "string") violations.push(`${path}.description must be a string`);
		if (Object.hasOwn(node, "title") && typeof node.title !== "string") violations.push(`${path}.title must be a string`);
		const hasType = Object.hasOwn(node, "type");
		const hasOneOf = Object.hasOwn(node, "oneOf");
		if (hasType && hasOneOf) {
			violations.push(`${path} cannot declare both type and oneOf`);
			continue;
		}
		if (!hasType && !hasOneOf) {
			for (const key of ONE_OF_SIBLING_KEYWORDS) if (Object.hasOwn(node, key)) violations.push(`${path}.${key} requires type or oneOf`);
			continue;
		}
		if (hasOneOf) {
			const oneOf = node.oneOf;
			tasks.push({
				kind: "one-of-tail",
				node,
				path
			});
			if (!isPlainJsonArray(oneOf) || oneOf.length < 2) violations.push(`${path}.oneOf must be an array of at least two schemas`);
			else for (let index = oneOf.length - 1; index >= 0; index--) tasks.push({
				kind: "enter",
				node: oneOf[index],
				path: `${path}.oneOf[${index}]`
			});
			continue;
		}
		const type = node.type;
		if (typeof type !== "string" || !SCHEMA_TYPES.includes(type)) {
			violations.push(Array.isArray(type) ? `${path}.type must be a single type string (type arrays are not supported)` : `${path}.type must be one of ${SCHEMA_TYPES.join("/")}`);
			continue;
		}
		const schemaType = type;
		for (const [key, types] of Object.entries({
			properties: ["object"],
			required: ["object"],
			additionalProperties: ["object"],
			items: ["array"],
			enum: [
				"string",
				"number",
				"integer",
				"boolean",
				"null"
			],
			const: [
				"string",
				"number",
				"integer",
				"boolean",
				"null"
			]
		})) if (Object.hasOwn(node, key) && !types.includes(schemaType)) violations.push(`${path}.${key} is not supported on type "${schemaType}"`);
		switch (schemaType) {
			case "object": {
				const properties = Object.hasOwn(node, "properties") ? node.properties : void 0;
				tasks.push({
					kind: "object-tail",
					node,
					path,
					properties
				});
				if (Object.hasOwn(node, "properties")) if (!isJsonSchemaRecord(properties)) violations.push(`${path}.properties must be an object of schemas`);
				else {
					const entries = Object.entries(properties);
					for (let index = entries.length - 1; index >= 0; index--) {
						const entry = entries[index];
						/* v8 ignore next -- the loop is bounded by the captured entry count. */
						if (entry === void 0) continue;
						tasks.push({
							kind: "enter",
							node: entry[1],
							path: `${path}.properties.${entry[0]}`
						});
					}
				}
				break;
			}
			case "array":
				if (Object.hasOwn(node, "items")) tasks.push({
					kind: "enter",
					node: node.items,
					path: `${path}.items`
				});
				break;
			case "string":
			case "number":
			case "integer":
			case "boolean":
			case "null": {
				const hasEnum = Object.hasOwn(node, "enum");
				const allowed = hasEnum ? node.enum : void 0;
				const enumValid = isPlainJsonArray(allowed) && allowed.length > 0 && allowed.every((entry) => scalarMatches(schemaType, entry));
				if (hasEnum && !enumValid) violations.push(`${path}.enum must be a non-empty array of ${schemaType} values`);
				const hasConst = Object.hasOwn(node, "const");
				const declaredConst = hasConst ? node.const : void 0;
				const constValid = scalarMatches(schemaType, declaredConst);
				if (hasConst) {
					if (!constValid) violations.push(`${path}.const must be a ${schemaType} value`);
					else if (enumValid && !allowed.includes(declaredConst)) violations.push(`${path}.const must be one of ${path}.enum when both are declared`);
				}
				break;
			}
			default: assertNever(schemaType, "JsonSchemaType");
		}
	}
}
/**
* Assert that an arbitrary raw schema uses only the enforced subset.
* Annotation-only schemas are accepted as the standard unconstrained-JSON
* form; callers that require an object root use {@link assertObjectJsonSchema}.
* @param schema - untrusted raw JSON Schema.
* @returns Assertion that the schema belongs to the supported subset.
*/
function assertSupportedJsonSchema(schema) {
	const violations = [];
	checkSchemaNode(schema, "schema", violations, /* @__PURE__ */ new Set());
	if (violations.length > 0) throw new JsonSchemaError(violations);
}
/** Safely test the lossless JSON boundary when a getter may throw. */
function safelyIsJsonValue(value) {
	try {
		return isJsonValue(value);
	} catch {
		return false;
	}
}
/** Root-aware diagnostic path for the parameter validator's empty sentinel. */
function diagnosticPath(path) {
	return path === "" ? "arguments" : path;
}
/** Append one object property without a leading dot at an implicit root. */
function propertyPath(path, key) {
	return path === "" ? key : `${path}.${key}`;
}
/** The generic exception-containment diagnostic owned by one valid schema node. */
function losslessValueViolation(path) {
	return [`"${diagnosticPath(path)}" must be a lossless JSON value`];
}
/** Append diagnostics without spreading a potentially wide child result as call arguments. */
function appendViolations(target, source) {
	for (const violation of source) target.push(violation);
}
/** Initialize one validation frame with empty aggregation state. */
function valueFrame(node, value, path) {
	return {
		node,
		value,
		path,
		catches: false,
		phase: "start",
		children: [],
		childIndex: 0,
		violations: [],
		tailViolations: [],
		matches: 0
	};
}
/** Validate one scalar node after its primitive type check. */
function checkScalarValue(node, value, path) {
	const allowed = Object.hasOwn(node, "enum") ? node.enum : void 0;
	if (allowed !== void 0 && !allowed.includes(value)) return [`"${diagnosticPath(path)}" must be one of ${JSON.stringify(allowed)}`];
	if (Object.hasOwn(node, "const") && value !== node.const) return [`"${diagnosticPath(path)}" must be ${JSON.stringify(node.const)}`];
	return [];
}
/** Validate one trusted schema/value pair with explicit frames rather than recursive calls. */
function checkValue(schema, value, path) {
	const frames = [valueFrame(schema, value, path)];
	let rootResult;
	const receive = (result) => {
		const parent = frames.at(-1);
		if (parent === void 0) {
			rootResult = result;
			return;
		}
		if (parent.kind === "oneOf") {
			if (result.length === 0) parent.matches++;
		} else appendViolations(parent.violations, result);
	};
	const finish = (result) => {
		frames.pop();
		receive(result);
	};
	while (frames.length > 0) {
		const frame = frames.at(-1);
		/* v8 ignore next -- the loop condition guarantees a current frame. */
		if (frame === void 0) break;
		try {
			if (frame.phase === "children") {
				if (frame.childIndex < frame.children.length) {
					const child = frame.children[frame.childIndex];
					/* v8 ignore next -- childIndex is bounded by children.length. */
					if (child === void 0) throw new Error("missing schema-value child frame");
					frame.childIndex++;
					frames.push(valueFrame(child.node, child.value, child.path));
					continue;
				}
				if (frame.kind === "oneOf") {
					finish(frame.matches === 1 ? [] : [`"${diagnosticPath(frame.path)}" must match exactly one oneOf branch (matched ${frame.matches})`]);
					continue;
				}
				appendViolations(frame.violations, frame.tailViolations);
				if (frame.violations.length > 0) finish(frame.violations);
				else if (frame.kind === "object") finish(safelyIsJsonValue(frame.value) ? [] : [`"${diagnosticPath(frame.path)}" must be a lossless JSON object`]);
				else finish(safelyIsJsonValue(frame.value) ? [] : [`"${diagnosticPath(frame.path)}" must be a dense lossless JSON array`]);
				continue;
			}
			const nodeType = Object.hasOwn(frame.node, "type") ? frame.node.type : void 0;
			frame.catches = !(nodeType !== void 0 && !SCHEMA_TYPES.includes(nodeType));
			const oneOf = Object.hasOwn(frame.node, "oneOf") ? frame.node.oneOf : void 0;
			if (oneOf !== void 0) {
				frame.kind = "oneOf";
				frame.children = Array.from(oneOf, (branch) => ({
					node: branch,
					value: frame.value,
					path: frame.path
				}));
				frame.childIndex = 0;
				frame.matches = 0;
				frame.phase = "children";
				continue;
			}
			if (nodeType === void 0) {
				finish(safelyIsJsonValue(frame.value) ? [] : losslessValueViolation(frame.path));
				continue;
			}
			switch (nodeType) {
				case "object": {
					if (!isPlainJsonRecord(frame.value)) {
						finish([`"${diagnosticPath(frame.path)}" must be an object`]);
						break;
					}
					const properties = Object.hasOwn(frame.node, "properties") ? frame.node.properties ?? {} : {};
					const violations = [];
					const required = Object.hasOwn(frame.node, "required") ? frame.node.required ?? [] : [];
					for (const key of required) if (!Object.hasOwn(frame.value, key) || frame.value[key] === void 0) violations.push(`missing required property "${propertyPath(frame.path, key)}"`);
					const children = [];
					for (const [key, child] of Object.entries(properties)) {
						if (!Object.hasOwn(frame.value, key) || frame.value[key] === void 0) continue;
						children.push({
							node: child,
							value: frame.value[key],
							path: propertyPath(frame.path, key)
						});
					}
					const tailViolations = [];
					if (Object.hasOwn(frame.node, "additionalProperties") && frame.node.additionalProperties === false) {
						for (const key of Object.keys(frame.value)) if (!Object.hasOwn(properties, key)) tailViolations.push(`"${propertyPath(frame.path, key)}" is not a declared property (additionalProperties: false)`);
					}
					frame.kind = "object";
					frame.children = children;
					frame.childIndex = 0;
					frame.violations = violations;
					frame.tailViolations = tailViolations;
					frame.phase = "children";
					break;
				}
				case "array": {
					if (!Array.isArray(frame.value)) {
						finish([`"${diagnosticPath(frame.path)}" must be an array`]);
						break;
					}
					const items = Object.hasOwn(frame.node, "items") ? frame.node.items : void 0;
					const children = items === void 0 ? [] : frame.value.flatMap((entry, index) => [{
						node: items,
						value: entry,
						path: `${frame.path}[${index}]`
					}]);
					frame.kind = "array";
					frame.children = children;
					frame.childIndex = 0;
					frame.violations = [];
					frame.phase = "children";
					break;
				}
				case "string":
					finish(typeof frame.value === "string" ? checkScalarValue(frame.node, frame.value, frame.path) : [`"${diagnosticPath(frame.path)}" must be a string`]);
					break;
				case "number":
					finish(typeof frame.value !== "number" ? [`"${diagnosticPath(frame.path)}" must be a number`] : !isJsonNumber(frame.value) ? [`"${diagnosticPath(frame.path)}" must be a finite JSON number`] : checkScalarValue(frame.node, frame.value, frame.path));
					break;
				case "integer":
					finish(!isJsonNumber(frame.value) || !Number.isInteger(frame.value) ? [`"${diagnosticPath(frame.path)}" must be an integer`] : checkScalarValue(frame.node, frame.value, frame.path));
					break;
				case "boolean":
					finish(typeof frame.value === "boolean" ? checkScalarValue(frame.node, frame.value, frame.path) : [`"${diagnosticPath(frame.path)}" must be a boolean`]);
					break;
				case "null":
					finish(frame.value === null ? checkScalarValue(frame.node, frame.value, frame.path) : [`"${diagnosticPath(frame.path)}" must be null`]);
					break;
				default: finish(assertNever(nodeType, "JsonSchemaType"));
			}
		} catch (error) {
			let failed = frames.pop();
			while (failed !== void 0 && !failed.catches) failed = frames.pop();
			if (failed === void 0) throw error;
			receive(losslessValueViolation(failed.path));
		}
	}
	/* v8 ignore next -- every root frame finishes or throws. */
	return rootResult ?? losslessValueViolation(path);
}
/**
* Validate a candidate value against an asserted raw schema. The function is
* total for arbitrary values and returns path-qualified violations.
* @param schema - a schema accepted by {@link assertSupportedJsonSchema}.
* @param value - the candidate JSON value.
* @param path - root label used in diagnostics.
* @returns All violations in walk order; empty means valid.
*/
function validateJsonSchemaValue(schema, value, path = "value") {
	return checkValue(schema, value, path);
}
/** Unified JSON-value schema DSL, inference, compilation, and typed tool helper. @module dsh-tools/schema */
const ANNOTATION_KEYS = [
	"description",
	"title",
	"default",
	"examples"
];
/** Throw one author-schema violation through the shared schema error type. */
function authorError(message) {
	throw new JsonSchemaError([message]);
}
/** Copy own annotation fields for validation by the raw-schema boundary. */
function copyAnnotations(source, target) {
	if (Object.hasOwn(source, "description")) target.description = source.description;
	if (Object.hasOwn(source, "title")) target.title = source.title;
	if (Object.hasOwn(source, "default")) target.default = source.default;
	if (Object.hasOwn(source, "examples")) target.examples = source.examples;
}
/** Reject author-only keys outside one node's declared vocabulary. */
function assertAuthorKeys(source, path, allowed) {
	for (const key of Object.keys(source)) if (!allowed.includes(key)) authorError(`${path}.${key} is not supported by the value schema DSL`);
}
/** Install a compiled node without giving `__proto__` assignment semantics. */
function assignCompiledNode(destination, node) {
	switch (destination.kind) {
		case "root":
			destination.holder.value = node;
			break;
		case "property":
			Object.defineProperty(destination.target, destination.key, {
				value: node,
				enumerable: true,
				configurable: true,
				writable: true
			});
			break;
		case "item":
			destination.target.items = node;
			break;
		case "one-of":
			destination.target[destination.index] = node;
			break;
	}
}
/** Install a compiled property map at its root or containing object node. */
function assignCompiledPropertyMap(destination, compiled) {
	if (destination.kind === "root") destination.holder.value = compiled;
	else destination.target.properties = compiled.properties;
}
/** Execute an author-schema compilation task graph without recursive descent. */
function runSchemaCompiler(initial) {
	const seen = /* @__PURE__ */ new Set();
	const tasks = [initial];
	for (let task = tasks.pop(); task !== void 0; task = tasks.pop()) {
		if (task.kind === "leave") {
			seen.delete(task.input);
			continue;
		}
		if (task.kind === "property-map-tail") {
			if (task.required.length > 0) {
				task.compiled.required = task.required;
				if (task.destination.kind === "object") task.destination.target.required = task.required;
			}
			continue;
		}
		if (task.kind === "property") {
			if (!isJsonSchemaRecord(task.property)) authorError(`${task.path} must be a value schema object`);
			if (Object.hasOwn(task.property, "required") && task.property.required !== true) authorError(`${task.path}.required must be true when present`);
			if (Object.hasOwn(task.property, "required") && task.property.required === true) task.required.push(task.key);
			tasks.push({
				kind: "value",
				input: task.property,
				path: task.path,
				allowRequired: true,
				destination: {
					kind: "property",
					target: task.properties,
					key: task.key
				}
			});
			continue;
		}
		if (task.kind === "property-map") {
			if (!isJsonSchemaRecord(task.input)) authorError(`${task.path} must be an object of value schemas`);
			if (seen.has(task.input)) authorError(`${task.path} is circular`);
			seen.add(task.input);
			const compiled = { properties: {} };
			const required = [];
			assignCompiledPropertyMap(task.destination, compiled);
			tasks.push({
				kind: "leave",
				input: task.input
			});
			tasks.push({
				kind: "property-map-tail",
				compiled,
				required,
				destination: task.destination
			});
			const entries = Object.entries(task.input);
			for (let index = entries.length - 1; index >= 0; index--) {
				const entry = entries[index];
				/* v8 ignore next -- the loop is bounded by the captured entry count. */
				if (entry === void 0) continue;
				tasks.push({
					kind: "property",
					property: entry[1],
					path: `${task.path}.${entry[0]}`,
					key: entry[0],
					properties: compiled.properties,
					required
				});
			}
			continue;
		}
		const { input, path } = task;
		if (!isJsonSchemaRecord(input)) authorError(`${path} must be a value schema object`);
		if (seen.has(input)) authorError(`${path} is circular`);
		seen.add(input);
		const authorKeys = [...ANNOTATION_KEYS, ...task.allowRequired ? ["required"] : []];
		const node = {};
		assignCompiledNode(task.destination, node);
		tasks.push({
			kind: "leave",
			input
		});
		if (Object.hasOwn(input, "oneOf")) {
			assertAuthorKeys(input, path, [
				...authorKeys,
				"oneOf",
				"type"
			]);
			if (Object.hasOwn(input, "type")) authorError(`${path} cannot declare both type and oneOf`);
			if (!isPlainJsonArray(input.oneOf)) authorError(`${path}.oneOf must be an array of at least two value schemas`);
			const branches = [];
			node.oneOf = branches;
			copyAnnotations(input, node);
			for (let index = input.oneOf.length - 1; index >= 0; index--) tasks.push({
				kind: "value",
				input: input.oneOf[index],
				path: `${path}.oneOf[${index}]`,
				allowRequired: false,
				destination: {
					kind: "one-of",
					target: branches,
					index
				}
			});
			continue;
		}
		const inputType = Object.hasOwn(input, "type") ? input.type : void 0;
		switch (inputType) {
			case "json":
				assertAuthorKeys(input, path, [...authorKeys, "type"]);
				copyAnnotations(input, node);
				break;
			case "object":
				assertAuthorKeys(input, path, [
					...authorKeys,
					"type",
					"properties",
					"additionalProperties"
				]);
				if (!Object.hasOwn(input, "additionalProperties") || typeof input.additionalProperties !== "boolean") authorError(`${path}.additionalProperties must be explicitly true or false`);
				node.type = "object";
				copyAnnotations(input, node);
				node.additionalProperties = input.additionalProperties;
				if (Object.hasOwn(input, "properties")) tasks.push({
					kind: "property-map",
					input: input.properties,
					path: `${path}.properties`,
					destination: {
						kind: "object",
						target: node
					}
				});
				break;
			case "array":
				assertAuthorKeys(input, path, [
					...authorKeys,
					"type",
					"items"
				]);
				node.type = "array";
				copyAnnotations(input, node);
				if (Object.hasOwn(input, "items")) tasks.push({
					kind: "value",
					input: input.items,
					path: `${path}.items`,
					allowRequired: false,
					destination: {
						kind: "item",
						target: node
					}
				});
				break;
			case "string":
			case "number":
			case "integer":
			case "boolean":
			case "null":
				assertAuthorKeys(input, path, [
					...authorKeys,
					"type",
					"enum",
					"const"
				]);
				node.type = inputType;
				copyAnnotations(input, node);
				if (Object.hasOwn(input, "enum")) {
					if (!isPlainJsonArray(input.enum)) authorError(`${path}.enum must be a non-empty array of scalar values`);
					node.enum = Array.from(input.enum, (entry) => entry);
				}
				if (Object.hasOwn(input, "const")) node.const = input.const;
				break;
			default: authorError(`${path}.type must be string/number/integer/boolean/null/array/object/json, or use oneOf`);
		}
	}
}
/** Compile one implicit property map, collecting per-property requiredness. */
function compilePropertyMap(input, path) {
	const holder = {};
	runSchemaCompiler({
		kind: "property-map",
		input,
		path,
		destination: {
			kind: "root",
			holder
		}
	});
	/* v8 ignore next -- the root task assigns before scheduling any descendants. */
	return holder.value ?? authorError(`${path} did not compile`);
}
/** Compile one author node without applying any consumer root restriction. */
function compileValueSchema(input, path) {
	const holder = {};
	runSchemaCompiler({
		kind: "value",
		input,
		path,
		allowRequired: false,
		destination: {
			kind: "root",
			holder
		}
	});
	/* v8 ignore next -- the root task assigns before scheduling any descendants. */
	return holder.value ?? authorError(`${path} did not compile`);
}
/**
* Compile one author-facing value schema to the enforced raw JSON Schema
* subset. The author-only `json` node becomes an annotation-only schema.
* @param spec - schema for any JSON-value root.
* @returns The asserted raw schema projection.
*/
function valueSchemaSpecToJsonSchema(spec) {
	const schema = compileValueSchema(spec, "schema");
	assertSupportedJsonSchema(schema);
	return schema;
}
/**
* Compile the implicit open parameter object into raw JSON Schema.
* @param spec - per-property parameter definitions.
* @returns An object-rooted raw schema with no implicit-root openness override.
*/
function parameterSchemaSpecToJsonSchema(spec) {
	const compiled = compilePropertyMap(spec, "parameters");
	const schema = {
		type: "object",
		properties: compiled.properties,
		...compiled.required === void 0 ? {} : { required: compiled.required }
	};
	assertSupportedJsonSchema(schema);
	return schema;
}
/** Invalid model-generated arguments for a typed tool. */
var ToolArgsError = class extends HarnessError {
	/** Individual violations in schema-walk order. */
	violations;
	constructor(violations) {
		super(`invalid arguments: ${violations.join("; ")}`, "INVALID_ARGS");
		this.name = "ToolArgsError";
		this.violations = violations;
	}
};
/**
* Define a first-party tool with inferred arguments and strict execution
* validation. Replay-only presenters validate softly and fall back to generic
* rendering for obsolete logged arguments.
* @param options - typed definition and optional finalizer and presenters.
* @returns A registry-ready definition.
*/
function defineTool(options) {
	const userExecute = options.execute;
	const userFinalizeContent = options.finalizeContent;
	const userRender = options.output.render;
	const userPresentationMeta = options.output.presentationMeta;
	const userPresentCall = options.presentCall;
	const userPresentResult = options.presentResult;
	const userIsConcurrencySafe = options.isConcurrencySafe;
	if (options.timeoutMs !== void 0 && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)) throw new Error(`defineTool(${options.name}): timeoutMs must be a positive finite number`);
	const parameters = parameterSchemaSpecToJsonSchema(options.parameters);
	const outputSchema = valueSchemaSpecToJsonSchema(options.output.schema);
	const validate = (args) => validateJsonSchemaValue(parameters, args, "");
	const tool = {
		name: options.name,
		description: options.description,
		parameters,
		output: {
			schema: outputSchema,
			render(args, value) {
				return userRender(args, value);
			},
			...userPresentationMeta !== void 0 ? { presentationMeta(args, value) {
				return userPresentationMeta(args, value);
			} } : {}
		},
		...options.timeoutMs !== void 0 ? { timeoutMs: options.timeoutMs } : {},
		async execute(args, exec) {
			const violations = validate(args);
			if (violations.length > 0) throw new ToolArgsError(violations);
			return userExecute(args, exec);
		}
	};
	if (userFinalizeContent) tool.finalizeContent = (exec, result) => userFinalizeContent(exec, result);
	if (userPresentCall) tool.presentCall = (args) => {
		if (validate(args).length > 0) return void 0;
		return userPresentCall(args);
	};
	if (userPresentResult) tool.presentResult = (args, result) => {
		if (validate(args).length > 0) return void 0;
		return userPresentResult(args, result);
	};
	if (userIsConcurrencySafe) tool.isConcurrencySafe = (args) => {
		if (validate(args).length > 0) return false;
		return userIsConcurrencySafe(args);
	};
	return tool;
}
/**
* PTC mode `run_code` transport. Programs call the registry's agent-visible
* tools through nested executions scheduled under the native concurrency
* contract; each sub-dispatch is logged for reconstruction, while only the
* outer curated result enters model history.
* @module @deepseek-ai/dsh-tools/src/ptc
*/
/** The model-facing name of the PTC mode tool. */
const RUN_CODE_NAME = "run_code";
/**
* The TypeScript flavor: the fallback for a schema read with no runtime
* mounted ({@link resolveFlavor} owns which readers reach that). A real
* assembly always resolves a runtime first, so the model never sees this
* fallback outside its own language.
*/
const TYPESCRIPT_FLAVOR = {
	description: "Execute a TypeScript program against the available tools. Takes two required arguments: `code`, the BODY of an async function (erasable syntax only; top-level `await` and `return` work), and `description`, a short summary of what the program does. Call tools as `await tools.name(args)` per the declarations in the system prompt. Only what you print or return is program output — curate it. Image-bearing subtool results are attached after the run.",
	codeDescription: "The program: the body of an async TypeScript function."
};
/** Per-language `run_code` schema flavors (see {@link RunCodeFlavor}); one entry per {@link CodeSdkLanguage}. */
const RUN_CODE_FLAVORS = {
	typescript: TYPESCRIPT_FLAVOR,
	python: {
		description: "Execute a Python program against the available tools. Takes two required arguments: `code`, the BODY of an async function (top-level `await` and `return` work), and `description`, a short summary of what the program does. Call tools as `await tools.name(args)` per the declarations in the system prompt. Use `print(...)` and/or `return <value>` for program output — curate it. Image-bearing subtool results are attached after the run.",
		codeDescription: "The program: the body of an async Python function."
	}
};
/**
* The `description` parameter's model-facing description: language-independent
* (the UI label contract is the same for every runtime), shared between the
* static spec and the language-aware `parameters` getter so the two emissions
* can never drift.
*/
const RUN_CODE_DESCRIPTION_PARAM_DESCRIPTION = "Clear, concise description of what this program does in active voice, 5-10 words (shown in the UI). Examples: \"Count TODO markers across packages\"; \"Read failing test and its fixture\"; \"Rename config key in every cordis.yml\".";
/**
* Resolve the {@link RunCodeFlavor} for the loaded runtime's language, read at
* schema-emission time so the model-visible `run_code` schema always matches
* the SDK section's language. `peekRuntime` returns `undefined` only when no
* runtime is mounted, which reaches this function through definition readers
* and `schemas()` — the doc-catalog harvest is the only shipped one, and none
* of them feeds a model, because `wireSchemas` calls `requireCodeRuntime`
* before projecting — so that path degrades to {@link TYPESCRIPT_FLAVOR}. A
* mounted runtime whose language has no flavor entry fails loud, exactly as
* `requireCodeRuntime` rejects it at assembly. Keeping this table in step with
* `SDK_RENDERERS` is the compiler's job ({@link CodeSdkLanguage}); what this
* guard owns is the runtime-supplied language neither table knows, which never
* yields a wrong-language schema for a real runtime.
*/
function resolveFlavor(peekRuntime) {
	const runtime = peekRuntime();
	if (runtime === void 0) return TYPESCRIPT_FLAVOR;
	const flavor = RUN_CODE_FLAVORS[runtime.language];
	if (!Object.hasOwn(RUN_CODE_FLAVORS, runtime.language) || flavor === void 0) {
		const known = Object.keys(RUN_CODE_FLAVORS).map((name$1) => JSON.stringify(name$1)).join(", ");
		throw new Error(`dsh-tools: no run_code schema flavor registered for runtime language ${JSON.stringify(runtime.language)} (known: ${known})`);
	}
	return flavor;
}
/**
* Thrown by `run_code` when the program run itself failed — a program
* exception, a budget expiry, an abort, or substrate death. Extends
* {@link HarnessError} (`code: 'CODE_RUN_FAILED'`); the registry's execution
* pipeline converts it into a structured `isError` result whose text carries
* the failure kind plus the captured logs, so the model can self-correct.
*/
var CodeRunFailedError = class extends HarnessError {
	constructor(message) {
		super(message, "CODE_RUN_FAILED");
		this.name = "CodeRunFailedError";
	}
};
/**
* Snapshot one binding call's argument as lossless JSON, then snapshot that
* detached value again so dispatch and logging stay independent without
* reintroducing structured-clone's platform-specific nesting limit.
*/
function jsonNormalizeArgs(value) {
	let snapshot;
	try {
		snapshot = snapshotJsonValue(value);
	} catch (error) {
		throw new Error(`tool arguments must be lossless JSON: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (snapshot === void 0) throw new Error("tool arguments must be lossless JSON (call the tool with an arguments object, e.g. `{}`)");
	const logged = snapshotJsonValue(snapshot);
	/* v8 ignore next -- snapshot is already a detached lossless JSON value. */
	if (logged === void 0) throw new Error("tool arguments could not be detached for durable logging");
	return {
		dispatched: snapshot,
		logged
	};
}
/** Two-space JSON presentation, matching the existing shallow `run_code` text contract. */
const JSON_INDENT = "  ";
/**
* ECMAScript caps `JSON.stringify`'s `space` string at ten characters. The
* renderer also caps TOTAL indentation there, compacting deeper subtrees, so
* formatted output remains linear in the canonical JSON size.
*/
const MAX_JSON_INDENT_CHARS = 10;
/** Render one non-string JSON root without recursive traversal or unbounded indentation growth. */
function renderJsonValue(value) {
	const chunks = [];
	const tasks = [{
		kind: "value",
		value,
		depth: 0,
		compact: false
	}];
	for (let task = tasks.pop(); task !== void 0; task = tasks.pop()) {
		if (task.kind === "text") {
			chunks.push(task.text);
			continue;
		}
		const current = task.value;
		if (current === null || typeof current === "boolean" || typeof current === "number") {
			chunks.push(String(current));
			continue;
		}
		if (typeof current === "string") {
			chunks.push(JSON.stringify(current));
			continue;
		}
		const compact = task.compact || (task.depth + 1) * 2 > MAX_JSON_INDENT_CHARS;
		const childDepth = task.depth + 1;
		if (Array.isArray(current)) {
			chunks.push("[");
			if (current.length === 0) {
				chunks.push("]");
				continue;
			}
			tasks.push({
				kind: "text",
				text: compact ? "]" : `\n${JSON_INDENT.repeat(task.depth)}]`
			});
			for (let index = current.length - 1; index >= 0; index--) {
				const item = current[index];
				/* v8 ignore next -- canonical JsonValue arrays are dense. */
				if (item === void 0) throw new Error("cannot render a sparse JSON array");
				tasks.push({
					kind: "value",
					value: item,
					depth: childDepth,
					compact
				});
				tasks.push({
					kind: "text",
					text: compact ? index === 0 ? "" : "," : `${index === 0 ? "\n" : ",\n"}${JSON_INDENT.repeat(childDepth)}`
				});
			}
			continue;
		}
		const keys = Object.keys(current);
		chunks.push("{");
		if (keys.length === 0) {
			chunks.push("}");
			continue;
		}
		tasks.push({
			kind: "text",
			text: compact ? "}" : `\n${JSON_INDENT.repeat(task.depth)}}`
		});
		for (let index = keys.length - 1; index >= 0; index--) {
			const key = keys[index];
			/* v8 ignore next -- the loop is bounded by the captured key count. */
			if (key === void 0) throw new Error("cannot render a missing JSON object key");
			const item = current[key];
			/* v8 ignore next -- canonical JsonValue records contain no undefined properties. */
			if (item === void 0) throw new Error("cannot render an undefined JSON object property");
			tasks.push({
				kind: "value",
				value: item,
				depth: childDepth,
				compact
			});
			tasks.push({
				kind: "text",
				text: compact ? `${index === 0 ? "" : ","}${JSON.stringify(key)}:` : `${index === 0 ? "\n" : ",\n"}${JSON_INDENT.repeat(childDepth)}${JSON.stringify(key)}: `
			});
		}
	}
	return chunks.join("");
}
/** Render one present program completion value for the model-facing result text. */
function renderValue(value) {
	return typeof value === "string" ? value : renderJsonValue(value);
}
/**
* Build the `run_code` {@link ToolDefinition}: required `code` and
* `description` parameters, executed through the dispatch bridge described
* above. The
* registry reserves it as presentation infrastructure under non-native modes,
* outside the filterable global/scoped capability layers.
* @param registry - the owning registry (sub-calls go through its `execute`,
*   bindings cover its registered tools).
* @param options - the registry-private capabilities described above.
* @returns the registry-ready definition.
*/
function createRunCodeTool(registry, options) {
	const { requireRuntime, peekRuntime, maxParallel, shapeDispatchLog } = options;
	const definition = defineTool({
		name: RUN_CODE_NAME,
		description: TYPESCRIPT_FLAVOR.description,
		parameters: {
			code: {
				type: "string",
				required: true,
				description: TYPESCRIPT_FLAVOR.codeDescription
			},
			description: {
				type: "string",
				required: true,
				description: RUN_CODE_DESCRIPTION_PARAM_DESCRIPTION
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					logs: {
						type: "array",
						required: true,
						items: { type: "string" }
					},
					result: { type: "json" }
				}
			},
			render: (_args, value) => {
				const rendered = value.result === void 0 ? "" : renderValue(value.result);
				const parts = [value.logs.join("\n"), rendered].filter((part) => part.length > 0);
				return [{
					type: "text",
					text: parts.length > 0 ? parts.join("\n") : "(run_code completed with no output)"
				}];
			}
		},
		async execute(args, exec) {
			if (args.description.trim().length === 0) throw new Error("invalid description: expected a non-empty string");
			const runtime = requireRuntime();
			const runController = new AbortController();
			const onOuterAbort = () => {
				runController.abort(exec.signal.reason);
			};
			exec.signal.addEventListener("abort", onOuterAbort, { once: true });
			let dispatches = 0;
			const pendingQueue = [];
			const inFlight = /* @__PURE__ */ new Set();
			/** Tracked settle-event side work (log-content listener + append), drained at run settlement. */
			const logWork = /* @__PURE__ */ new Set();
			const commitQueue = [];
			let exclusiveActive = false;
			let driving = false;
			let driverRun = Promise.resolve();
			let wake;
			const wakeup = () => {
				const release = wake;
				wake = void 0;
				release?.();
			};
			/**
			* The single ordered lane. Each pass commits the head-of-line settled
			* dispatch (ordered post-execute), then starts the next queued entry if
			* its slot is free (ordered pre-execute), and otherwise sleeps until a
			* body settles or a new submission arrives. One run reaching the
			* empty-queues/empty-pool state is quiescence.
			*/
			const drive = () => {
				if (driving) return driverRun;
				driving = true;
				driverRun = (async () => {
					try {
						for (;;) {
							const signal = new Promise((resolve) => {
								wake = resolve;
							});
							const commitHead = commitQueue[0];
							if (commitHead !== void 0 && commitHead.settled) {
								commitQueue.shift();
								await commitHead.commit();
								if (commitHead.mode === "exclusive") exclusiveActive = false;
								continue;
							}
							const head = pendingQueue[0];
							if (head !== void 0) {
								if (runController.signal.aborted) {
									pendingQueue.shift();
									head.abandon();
									continue;
								}
								const mode = head.classify();
								if (!exclusiveActive && (mode === "exclusive" ? inFlight.size === 0 : inFlight.size < maxParallel)) {
									if (mode === "exclusive") exclusiveActive = true;
									head.mode = mode;
									pendingQueue.shift();
									commitQueue.push(head);
									await head.start();
									const flight = head.flight.finally(() => {
										inFlight.delete(flight);
										wakeup();
									});
									inFlight.add(flight);
									continue;
								}
							}
							if (pendingQueue.length === 0 && commitQueue.length === 0 && inFlight.size === 0) return;
							await signal;
						}
					} finally {
						driving = false;
						wake = void 0;
					}
				})();
				return driverRun;
			};
			/** Every dispatch settled AND committed; nothing can start (the run is aborted at call time). */
			const drainDispatches = async () => {
				await drive();
				while (logWork.size > 0) await Promise.allSettled([...logWork]);
			};
			const runOver = () => runController.signal.aborted;
			const binding = (name$1) => async (rawArgs) => {
				if (runOver()) throw new Error(`run_code run is over (${String(runController.signal.reason)}); ${name$1} not dispatched`);
				const normalized = jsonNormalizeArgs(rawArgs);
				const n = ++dispatches;
				const subCallId = brandString(`${String(exec.callId)}:ptc:${n}`);
				const input = {
					callId: subCallId,
					rootCallId: exec.rootCallId,
					name: name$1,
					arguments: normalized.dispatched,
					...exec.agent ? { agent: exec.agent } : {},
					parent: exec.token,
					signal: runController.signal
				};
				const scheduler = registry[TOOL_RUNTIME_SCHEDULER];
				const outcome = await new Promise((resolve, reject) => {
					let parked;
					const settle = (result) => {
						resolve(result.isError ? {
							isError: true,
							message: result.error.message
						} : {
							isError: false,
							value: result.value
						});
						const agent = exec.agent;
						if (agent === void 0) return;
						const task = (async () => {
							const logged = await shapeDispatchLog({
								exec,
								agent,
								subCallId,
								name: name$1,
								isError: result.isError,
								content: result.content
							});
							agent.session.append("tool/ptc-dispatch", {
								rootCallId: exec.rootCallId,
								parentCallId: exec.callId,
								subCallId,
								name: name$1,
								arguments: normalized.logged,
								isError: result.isError,
								content: logged
							});
						})().finally(() => {
							logWork.delete(task);
						});
						logWork.add(task);
					};
					pendingQueue.push({
						flight: Promise.resolve(),
						settled: false,
						classify: () => registry.executionMode(input).kind,
						abandon: () => {
							reject(/* @__PURE__ */ new Error(`run_code run is over (${String(runController.signal.reason)}); ${name$1} tool call abandoned`));
						},
						async start() {
							exec.agent?.session.append("tool/ptc-dispatch-start", {
								rootCallId: exec.rootCallId,
								parentCallId: exec.callId,
								subCallId,
								name: name$1,
								arguments: normalized.logged
							});
							const prepared = await scheduler.prepare(input);
							if (prepared.kind === "dispatch") {
								this.flight = scheduler.dispatch(prepared.exec).then((dispatchOutcome) => {
									parked = {
										kind: dispatchOutcome.kind,
										exec: prepared.exec,
										result: dispatchOutcome.result
									};
									this.settled = true;
								});
								return;
							}
							parked = {
								kind: prepared.kind,
								exec: prepared.exec,
								result: prepared.result
							};
							this.settled = true;
						},
						async commit() {
							/* v8 ignore next -- commit() runs only after `settled` flipped, which set parked. */
							if (parked === void 0) return;
							const result = parked.kind === "post-result" ? await scheduler.finalize(parked.exec, parked.result) : scheduler.finish(parked.exec, parked.result);
							if (!result.isError && result.content.some((block) => block.type === "image")) exec.deferContext(createUserMessage({
								content: result.content,
								source: {
									kind: "plugin",
									plugin: "tools-ptc"
								}
							}));
							for (const context of result.additionalContexts ?? []) exec.deferContext(context);
							if (result.concludesTurn) exec.concludeTurn();
							settle(result);
							while (logWork.size > maxParallel) await Promise.race(logWork);
						}
					});
					wakeup();
					drive();
				});
				if (runOver()) throw new Error(`run_code run is over (${String(runController.signal.reason)}); ${name$1} result discarded`);
				if (outcome.isError) throw new Error(outcome.message);
				return outcome.value;
			};
			const functions = Object.create(null);
			for (const schema of registry.schemas(exec.agent)) {
				if (schema.name === "run_code") continue;
				Object.defineProperty(functions, schema.name, {
					enumerable: true,
					value: binding(schema.name)
				});
			}
			try {
				let result;
				try {
					result = await runtime.run({
						program: args.code,
						bindings: [{
							global: "tools",
							functions,
							errorClass: {
								name: "ToolCallError",
								memberNameProperty: "toolName"
							}
						}],
						signal: runController.signal
					});
				} finally {
					runController.abort("run_code settled");
					await drainDispatches();
				}
				if (result.error) {
					const logsText = result.logs.length > 0 ? `\nCaptured output:\n${result.logs.join("\n")}` : "";
					throw new CodeRunFailedError(`code run failed (${result.error.kind}): ${result.error.message}${logsText}`);
				}
				return {
					logs: result.logs,
					...result.value !== void 0 ? { result: result.value } : {}
				};
			} finally {
				exec.signal.removeEventListener("abort", onOuterAbort);
			}
		},
		presentCall: (args) => ({
			card: "generic",
			title: args.description,
			kind: "execute",
			rawInput: args.code
		})
	});
	Object.defineProperty(definition, "description", {
		enumerable: true,
		get: () => resolveFlavor(peekRuntime).description
	});
	Object.defineProperty(definition, "parameters", {
		enumerable: true,
		get: () => parameterSchemaSpecToJsonSchema({
			code: {
				type: "string",
				required: true,
				description: resolveFlavor(peekRuntime).codeDescription
			},
			description: {
				type: "string",
				required: true,
				description: RUN_CODE_DESCRIPTION_PARAM_DESCRIPTION
			}
		})
	});
	return definition;
}
/**
* PTC mode codegen: the pure projection from registered tool schemas to the TypeScript SDK
* text the model programs against (the `tools:sdk` prompt section). Sibling of
* `json-schema.ts` — `schemas()` (native function calling) and this module (the generated
* `declare const tools` API) are two projections of the same store.
* @module @deepseek-ai/dsh-tools/src/ts-types
*/
/** Property names that are valid bare TS identifiers; anything else is quoted. */
const IDENTIFIER$1 = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
/** Render an object key: bare when it is a valid identifier, quoted otherwise (every name stays reachable, no aliasing). */
function renderKey(name$1) {
	return IDENTIFIER$1.test(name$1) ? name$1 : JSON.stringify(name$1);
}
/** One `indent`-deep line prefix (two spaces per level). */
function pad$1(indent) {
	return "  ".repeat(indent);
}
/** A one-line JSDoc block for a schema `description`, or no lines when there is none. */
function docLines$1(description, indent) {
	if (typeof description !== "string" || description.length === 0) return [];
	const collapsed = description.replace(/\s+/g, " ").trim();
	return [`${pad$1(indent)}/** ${collapsed.replaceAll("*/", String.raw`*\/`)} */`];
}
/** Render one scalar already validated by the unified schema boundary. */
function renderScalar(value) {
	return JSON.stringify(value);
}
/** Render a validated scalar `const`/`enum`, falling back to the broad type. */
function renderConstrainedScalar$1(node, type) {
	const broad = type === "integer" ? "number" : type;
	if (Object.hasOwn(node, "const")) return renderScalar(node.const);
	if (Object.hasOwn(node, "enum")) return node.enum.map(renderScalar).join(" | ");
	return broad;
}
/** Build one document from captured parts while retaining the legacy array-parenthesization test. */
function typeDocumentFrom(parts) {
	return {
		parts,
		containsUnionOrIntersection: parts.some((part) => typeof part === "string" ? part.includes("|") || part.includes("&") : part.containsUnionOrIntersection)
	};
}
/** Build a small document without an intermediate array at each call site. */
function typeDocument(...parts) {
	return typeDocumentFrom(parts);
}
/** Flatten a nested document with an explicit work stack. */
function flattenTypeDocument(document) {
	const chunks = [];
	const tasks = [document];
	for (let task = tasks.pop(); task !== void 0; task = tasks.pop()) {
		if (typeof task === "string") {
			chunks.push(task);
			continue;
		}
		for (let index = task.parts.length - 1; index >= 0; index--) {
			const part = task.parts[index];
			/* v8 ignore next -- the loop is bounded by the captured part count. */
			if (part !== void 0) tasks.push(part);
		}
	}
	return chunks.join("");
}
/** Initialize one schema-render frame with empty aggregation state. */
function schemaRenderFrame(node, indent) {
	return {
		node,
		indent,
		phase: "start",
		children: [],
		childIndex: 0,
		childDocuments: [],
		entries: []
	};
}
/** Render an already asserted schema to a composable document. */
function renderSupportedSchema(schema, indent) {
	const frames = [schemaRenderFrame(schema, indent)];
	let rootDocument;
	const finish = (document) => {
		frames.pop();
		const parent = frames.at(-1);
		if (parent === void 0) rootDocument = document;
		else parent.childDocuments.push(document);
	};
	while (frames.length > 0) {
		const frame = frames.at(-1);
		/* v8 ignore next -- the loop condition guarantees a current frame. */
		if (frame === void 0) break;
		if (frame.phase === "children") {
			if (frame.childIndex < frame.children.length) {
				const child = frame.children[frame.childIndex];
				/* v8 ignore next -- childIndex is bounded by children.length. */
				if (child === void 0) throw new Error("missing schema render child");
				frame.childIndex++;
				frames.push(schemaRenderFrame(child.node, child.indent));
				continue;
			}
			if (frame.kind === "oneOf") {
				const parts$1 = [];
				for (let index = 0; index < frame.childDocuments.length; index++) {
					if (index > 0) parts$1.push(" | ");
					const child = frame.childDocuments[index];
					/* v8 ignore next -- child documents correspond one-to-one with children. */
					if (child !== void 0) parts$1.push(child);
				}
				finish(typeDocumentFrom(parts$1));
				continue;
			}
			if (frame.kind === "array") {
				const child = frame.childDocuments[0];
				/* v8 ignore next -- array frames always schedule exactly one child. */
				if (child === void 0) throw new Error("missing array item type");
				finish(child.containsUnionOrIntersection ? typeDocument("(", child, ")[]") : typeDocument(child, "[]"));
				continue;
			}
			const required = new Set(frame.node.required);
			const parts = ["{"];
			for (let index = 0; index < frame.entries.length; index++) {
				const entry = frame.entries[index];
				const child = frame.childDocuments[index];
				/* v8 ignore next -- object entries and child documents have the same length. */
				if (entry === void 0 || child === void 0) throw new Error("missing object property type");
				const [name$1, prop] = entry;
				for (const line of docLines$1(prop.description, frame.indent + 1)) parts.push("\n", line);
				parts.push("\n", `${pad$1(frame.indent + 1)}${renderKey(name$1)}${required.has(name$1) ? "" : "?"}: `, child, ";");
			}
			parts.push("\n", `${pad$1(frame.indent)}}`);
			const declared = typeDocumentFrom(parts);
			finish(frame.node.additionalProperties === false ? declared : typeDocument(declared, " & Record<string, JsonValue>"));
			continue;
		}
		const node = frame.node;
		if (node.oneOf !== void 0) {
			frame.kind = "oneOf";
			frame.children = Array.from(node.oneOf, (child) => ({
				node: child,
				indent: frame.indent
			}));
			frame.childIndex = 0;
			frame.childDocuments = [];
			frame.phase = "children";
			continue;
		}
		if (node.type === void 0) {
			finish(typeDocument("JsonValue"));
			continue;
		}
		switch (node.type) {
			case "string":
			case "number":
			case "integer":
			case "boolean":
			case "null":
				finish(typeDocument(renderConstrainedScalar$1(node, node.type)));
				break;
			case "array":
				if (node.items === void 0) finish(typeDocument("JsonValue[]"));
				else {
					frame.kind = "array";
					frame.children = [{
						node: node.items,
						indent: frame.indent
					}];
					frame.childIndex = 0;
					frame.childDocuments = [];
					frame.phase = "children";
				}
				break;
			case "object": {
				const open = node.additionalProperties !== false;
				const entries = Object.entries(node.properties ?? {});
				if (entries.length === 0) finish(typeDocument(open ? "Record<string, JsonValue>" : "Record<string, never>"));
				else {
					frame.kind = "object";
					frame.entries = entries;
					frame.children = entries.map(([, child]) => ({
						node: child,
						indent: frame.indent + 1
					}));
					frame.childIndex = 0;
					frame.childDocuments = [];
					frame.phase = "children";
				}
				break;
			}
			default: finish(typeDocument("unknown"));
		}
	}
	/* v8 ignore next -- every root frame produces one document. */
	return rootDocument ?? typeDocument("unknown");
}
/**
* Map one enforced JSON-Schema node to a TypeScript type literal. Supports
* every unified schema construct and returns `unknown` for malformed or
* unsupported inputs without throwing.
* @param schema - the JSON-Schema node (any shape; hostile inputs degrade).
* @param indent - the indentation level for nested object members.
* @returns the TS type text (multi-line for objects with properties).
*/
function jsonSchemaToTs(schema, indent = 0) {
	try {
		assertSupportedJsonSchema(schema);
		return flattenTypeDocument(renderSupportedSchema(schema, indent));
	} catch {
		return "unknown";
	}
}
/** The fixed model-facing usage contract rendered above the declarations (see the PTC mode Agent Note's "What the model sees"). */
const SDK_INSTRUCTIONS$1 = `## Writing code for run_code

\`run_code\` takes two required arguments: \`code\` — the body of an async TypeScript function (erasable syntax only — no \`enum\` or namespaces; type annotations are advisory, the code runs type-stripped) — and \`description\`, a short summary of what the program does. The declarations below are SDK bindings for this program. A declaration does not make its name a directly callable tool; only names supplied as separate tool schemas may be called directly.`;
const SDK_PROGRAM_INSTRUCTIONS = `Inside the program:

- Call tools as \`await tools.name(args)\` — quoted access for exotic names: \`tools["my-tool"](args)\`. Every call resolves to the tool's typed canonical JSON value. Tool arguments must be lossless JSON.
- A FAILED tool call rejects with \`ToolCallError\`, whose \`toolName\` identifies the failed tool and whose \`message\` is human-readable — \`try/catch\` it to handle and continue.
- Independent read-only calls MAY overlap under \`Promise.all\` (safe calls run concurrently; mutating calls run alone, in submission order). Sequence dependent work with \`await\`.
- Emit results with \`return\` and/or \`console.log(...)\`. Only what you print or return is program output. A successful tool result containing an image is attached after the run so you can inspect it on the next step; every other intermediate result stays out of the conversation, so extract just what you need.

Program-only SDK bindings:`;
/** Whether one string schema accepts the literal used by the bash example. */
function acceptsExampleString(schema, value) {
	return schema?.type === "string" && (schema.const === void 0 || schema.const === value) && (schema.enum === void 0 || schema.enum.includes(value));
}
/** Render the bash example only when its literal arguments satisfy the current parameter schema. */
function renderBashExample(schemas) {
	const bash = schemas.find((schema) => schema.name === "bash");
	if (bash === void 0) return "";
	const parameters = bash.parameters;
	if (parameters.type !== "object") return "";
	const required = parameters.required ?? [];
	if (required.some((name$1) => name$1 !== "command" && name$1 !== "description")) return "";
	if (!acceptsExampleString(parameters.properties?.command, "pwd")) return "";
	const needsDescription = required.includes("description");
	if (needsDescription && !acceptsExampleString(parameters.properties?.description, "Show current directory")) return "";
	return ` When no separate \`bash\` schema is supplied, invoke a declared \`bash\` binding inside \`run_code\`:\n\n\`run_code({ code: "return await tools.bash({ command: 'pwd'${needsDescription ? ", description: 'Show current directory'" : ""} })", description: "Show current directory" })\``;
}
/**
* Render the full `tools:sdk` prompt section: the fixed usage instructions
* plus one `declare const tools` interface covering every given tool.
* Deterministic — tools are emitted in lexicographic name order, so an
* unchanged tool set produces byte-identical text across assemblies. The sort
* is not a total order on byte-equal names, so two schemas sharing a name
* would render in argument order; the caller's visible-capability map is keyed
* by name, so the input never carries a duplicate.
* @param schemas - the tool schemas to declare (the caller excludes
*   `run_code` itself).
* @returns the complete section text.
*/
function renderToolsSdk(schemas) {
	const sorted = [...schemas].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
	const argsMembers = [];
	const outputMembers = [];
	for (const schema of sorted) {
		argsMembers.push(...docLines$1(schema.description, 1));
		argsMembers.push(`${pad$1(1)}${renderKey(schema.name)}: ${jsonSchemaToTs(schema.parameters, 1)};`);
		outputMembers.push(`${pad$1(1)}${renderKey(schema.name)}: ${jsonSchemaToTs(schema.output, 1)};`);
	}
	const declaration = [
		`interface ToolArgsMap {${argsMembers.length > 0 ? `\n${argsMembers.join("\n")}\n` : ""}}`,
		`interface ToolOutputMap {${outputMembers.length > 0 ? `\n${outputMembers.join("\n")}\n` : ""}}`,
		"type ToolName = keyof ToolOutputMap",
		[
			"declare class ToolCallError extends Error {",
			"  readonly name: \"ToolCallError\";",
			"  readonly toolName: ToolName;",
			"}"
		].join("\n"),
		[
			"declare const tools: {",
			"  [K in ToolName]: (args: ToolArgsMap[K]) => Promise<ToolOutputMap[K]>;",
			"}"
		].join("\n")
	].join("\n\n");
	return `${SDK_INSTRUCTIONS$1}${renderBashExample(sorted)}\n\n${SDK_PROGRAM_INSTRUCTIONS}\n\n\`\`\`ts\ntype JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }\n\n${declaration}\n\`\`\``;
}
/**
* PTC mode codegen — Python flavor. The pure projection from registered tool schemas to the
* Python SDK text the model programs against under `runtime.language === 'python'`. Sibling of
* {@link ./ts-types.ts | ts-types.ts}; the two files are two projections of the same registry
* store, keyed by the loaded {@link @deepseek-ai/dsh-code-runtime#CodeRuntime.language | code
* runtime's language}.
*
* Under `mode: 'ptc'` the native tool schemas are omitted from the request, so this generated
* SDK is the model's ONLY source for each tool's argument names, required fields, types,
* descriptions, and canonical output shapes; under `mode: 'both'` the native schemas ship
* alongside it and it is one of two. Object-shaped arguments and outputs therefore render as one
* named `TypedDict` per tool (and per nested object), not an opaque `dict[str, Any]`, so the
* shape survives into the program under the mode that has nothing else to carry it.
* @module @deepseek-ai/dsh-tools/src/py-types
*/
/**
* The reference grammar's `xid_start xid_continue*` — the set
* `str.isidentifier()` accepts on a CPython whose Unicode tables match the
* engine's. See {@link isBareIdentifier} for what a version skew does.
*/
const IDENTIFIER = /^[\p{XID_Start}_]\p{XID_Continue}*$/u;
/**
* Whether a name can be emitted as a bare Python identifier rather than
* routed to the subscript/`dict[str, Any]` path.
*
* Python identifiers are not ASCII: `路径` is as legal a field name as `path`,
* and rejecting it would degrade the whole enclosing object, dropping every
* field's name, requiredness, and type — information whose only source under
* `mode: 'ptc'` is this generated text.
*
* NFKC stability is a second and separate condition, because CPython
* normalizes identifiers at compile time while JSON keys are compared as
* written: `ﬁeld` would be declared and reachable as `field`, so the SDK would
* advertise a key under a spelling the harness never accepts, and two keys
* that normalize together would collapse into one declaration. Those names
* take the subscript path, which carries their exact bytes.
*
* `IDENTIFIER` matches `str.isidentifier()` (measured on Node 22.23.1 vs
* CPython 3.9.6 tables): the equivalence holds inside the two versions' shared
* tables, and the skew characters below are exactly where that pair diverges.
* The predicate as a whole is deliberately stricter than `isidentifier()`,
* which does not test NFKC stability: `'ﬁeld'.isidentifier()` is True and
* this returns false.
*
* Both conditions are evaluated against the ENGINE's Unicode tables, and the
* two sides are versioned independently — `\p{XID_Start}`/`\p{XID_Continue}`
* follow the running engine (Node 22.23.1 reports Unicode 17.0) while CPython
* follows its own (3.9.6 reports 13.0.0). The skew is not symmetric. A CPython
* older than the engine is the dangerous direction: a character added to either
* property since its tables (U+10570 Vithkuqi and U+1E290 Toto, 14.0; U+1E4D0
* Nag Mundari, 15.0; U+1C89 Cyrillic TJE, 16.0 — ages per `DerivedAge.txt`; all
* four are NFKC-stable and accepted here, and all four are `Cn` on that 3.9.6,
* which rejects them) is emitted bare and its tokenizer refuses the character,
* taking the whole SDK block down — the same parseability invariant
* {@link UNPRINTABLE}, {@link LONE_SURROGATE} and {@link MAX_LIST_NESTING}
* exist for. Both properties carry it: a character added only to `XID_Continue`
* passes the trailing `\p{XID_Continue}*` in a tail position and fails the same
* way — U+200C ZWNJ and U+200D ZWJ are that case, gaining `XID_Continue` in UCD
* 15.1 and absent from it in 13.0.0, 14.0.0 and 15.0.0, so `a\u{200C}b` is
* emitted bare here while `isidentifier()` is False on 3.9.6 and on 3.12.13
* (15.0.0). A CPython newer than the engine only routes a legal name to the
* subscript/`dict[str, Any]` path: less readable, still correct. The NFKC
* condition reduces to the same skew, since normalization stability guarantees
* an assigned character's normalization never changes afterwards.
*
* This predicate is not the only reader of engine tables. {@link camelCase}
* reads them at three further points — its split set, its head test, and its
* `toUpperCase()` case mapping — and this predicate's verdict gates none of
* them: a class name derived there reaches emitted text whenever any object
* shape in the tool's schema declares a `TypedDict`, including for a tool this
* predicate rejected. A tool named `zz-\u{1E4D0}x` with such parameters never
* reaches the skew here (the `-` rejects it outright) yet emits `class
* Zz\u{1E4D0}xArgs`, which that same 3.9.6 refuses — Nag Mundari arrived two
* releases after its tables. The case mapping is a separate table rather than
* an XID membership test, and it fails on names both conditions above accept:
* `\u{019B}` is XID_Start and NFKC-stable, so this predicate accepts it and
* `async def \u{019B}` compiles on 3.9.6, but Node uppercases it to
* `\u{A7DC}` — unassigned in that CPython, whose own `.upper()` is the identity
* here — and the declared `class \u{A7DC}Args` fails with `invalid
* non-printable character U+A7DC`. Closing the exposure therefore covers all
* four read points, not this predicate alone; it needs the target interpreter's
* version, which the backend reporting `language: 'python'` owns; the
* language-dispatch Agent Note records the deferral.
*
* The `ts-types` sibling keeps its own ASCII rule rather than sharing this
* one: ECMAScript identifiers are a different set (`$`) and are never
* normalized, so one predicate cannot be correct for both. ZWJ/ZWNJ are not
* part of that difference — both sets carry them on the engine's tables; what
* separates the two there is the CPython table version above.
* @param name - the raw schema field or tool name.
* @returns whether the name can be emitted bare.
*/
function isBareIdentifier(name$1) {
	return IDENTIFIER.test(name$1) && name$1.normalize("NFKC") === name$1;
}
/**
* Python hard keywords: reserved everywhere, so a tool or field named
* ``class`` or ``lambda`` is legal on the wire but not as an attribute
* (``tools.class`` would be a SyntaxError in the model program) and not as a
* class-syntax `TypedDict` field. Such a tool renders under subscript access
* and such an object degrades to ``dict[str, Any]`` — the model still reaches
* every tool and field without collisions.
* Soft keywords (``match``, ``case``, ``type``, ``_`` — the language
* reference's whole set) are deliberately ABSENT: each is special in exactly
* one syntactic position — a statement head (``match``, ``type``), a ``match``
* statement's clause head (``case``), or a pattern (``_``) — so ``match: str``
* as a field and ``async def match(...)`` as a method are both legal, and
* including them would needlessly degrade common search/regex tool fields to
* ``dict[str, Any]``. Underscore-leading names are handled separately, not
* here: a non-dunder ``__token`` name-mangles, a dunder present on
* ``object``/``type`` resolves before the proxy hook, and implicit
* special-method lookup bypasses the hook.
*/
const RESERVED = new Set([
	"False",
	"None",
	"True",
	"and",
	"as",
	"assert",
	"async",
	"await",
	"break",
	"class",
	"continue",
	"def",
	"del",
	"elif",
	"else",
	"except",
	"finally",
	"for",
	"from",
	"global",
	"if",
	"import",
	"in",
	"is",
	"lambda",
	"nonlocal",
	"not",
	"or",
	"pass",
	"raise",
	"return",
	"try",
	"while",
	"with",
	"yield",
	"__debug__"
]);
/** `typing` symbols this module may emit, in the deterministic import order. */
const TYPING_ORDER = [
	"Any",
	"Literal",
	"NotRequired",
	"Protocol",
	"TypedDict"
];
/** `indent`-deep line prefix (four spaces per level to match PEP 8 output). */
function pad(indent) {
	return "    ".repeat(indent);
}
/**
* The `Cc` code points that survive the whitespace collapse in {@link describe}
* and have no printable form: the C0 controls, DEL, and the C1 controls. Only
* U+0009 to U+000D are absent, because ECMAScript `\s` already collapsed them —
* `\s` is TAB/VT/FF/SP/NBSP/ZWNBSP/Zs plus LF/CR/LS/PS, so no C1 code point is
* in it and the whole U+0080 to U+009F block reaches this rule intact. Those
* are not hypothetical input: they are what Windows-1252 bytes 0x80 to 0x9F
* (smart quotes, em dash) become when decoded as Latin-1.
* CPython rejects source containing a NUL outright
* (`SyntaxError: source code string cannot contain null bytes`), whether it
* sits in a docstring or in a comment, so one such byte anywhere in a schema
* description would make the whole generated SDK unparseable — under
* `mode: 'ptc'`, the model's only declaration of the tools. The rest are
* legal but invisible; escaping them with the same rule keeps the emitted text
* readable and the treatment uniform.
*
* The boundary is the category, not per-code-point addressability: `\xNN`
* addresses U+0000 to U+00FF, so one escape form covers `Cc` exactly. The
* invisible `Cf` formatting characters pass through by design — of them only
* U+00AD soft hyphen would fit `\xNN` at all, and escaping that one while
* U+200B ZWSP, U+200E/U+200F bidi marks, and U+2060 word joiner passed through
* would leave a rule that is neither category- nor addressability-shaped. The
* whole family is legal in both consumers, since only LF and CR terminate a
* Python string literal or a `#` comment. That set is the tokenizer's, not
* `str.splitlines()`': NEL (U+0085), LS (U+2028), and PS (U+2029) split a
* string at run time but do not end a physical line in source — measured on
* CPython 3.9.6 and 3.12.13, each accepted in both positions with the value
* round-tripping — so they are safe raw wherever they reach emitted text
* unescaped, which for all three is `JSON.stringify`, at two call sites:
* {@link pyScalar}'s literal path, and the subscript tool-name comment's own
* call, which a name carrying any of them always reaches, none being
* `XID_Continue`. The `description` path escapes NEL under the class above and
* folds LS and PS in {@link describe}'s `\s+` collapse, both being `\s`.
*/
const UNPRINTABLE = /[\u0000-\u0008\u000e-\u001f\u007f-\u009f]/g;
/**
* Unpaired surrogate code points, escaped by {@link describe} as `\uNNNN` —
* its own form, since `\xNN` stops at U+00FF. The `u` flag is what makes this
* the LONE ones: in Unicode mode a well-formed pair is a single astral code
* point outside D800 to DFFF, so an emoji in a description survives untouched.
*
* This is the NUL case from {@link UNPRINTABLE}, not the invisible-character
* case. Python source must be UTF-8-encodable and a lone surrogate is not, so
* `compile()` raises `UnicodeEncodeError: surrogates not allowed` for one
* anywhere in the text — measured on 3.9 for a string literal and for a `#`
* comment alike. A raw or MCP tool description reaches this: `JSON.parse` on a
* wire `"\ud800"` escape yields exactly such a code point.
*/
const LONE_SURROGATE = /[\ud800-\udfff]/gu;
/**
* The collapsed one-line `description` of a schema node (byte-stable across
* formatting churn), or `undefined` when the node carries none. Every caller
* passes an object — a validated property node, the `ToolSdkSchema` itself, or
* the `{ description }` wrapper {@link docLines} synthesizes — so only the
* description field needs guarding. A description that collapses
* to nothing (empty, or whitespace only) is `undefined` too: it documents the
* node no better than an absent one, and emitting it would leave an empty
* `"""` docstring or a bare `#   ` line in the SDK. Only ECMAScript whitespace
* folds, so a description of whitespace plus one surviving control character is
* NOT absent: it collapses to that character's visible escape.
*
* Control characters left over after the whitespace collapse are rendered as
* their `\xNN` escapes (see {@link UNPRINTABLE}) and unpaired surrogates as
* their `\uNNNN` escapes (see {@link LONE_SURROGATE}); the escape's own backslash is
* emitted literally by both consumers, since {@link docLines} doubles it into a
* Python source escape and a `#` comment carries it verbatim.
*/
function describe(schema) {
	const description = schema.description;
	if (typeof description !== "string") return void 0;
	const collapsed = description.replace(/\s+/g, " ").replace(UNPRINTABLE, (char) => `\\x${char.charCodeAt(0).toString(16).padStart(2, "0")}`).replace(LONE_SURROGATE, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`).trim();
	return collapsed.length === 0 ? void 0 : collapsed;
}
/**
* One-line docstring for a tool `description`, or no lines when there is none.
* Backslashes are doubled first, every quote is escaped, and a trailing
* backslash cannot survive: a description ending in `"` or an odd backslash
* would otherwise merge with (or escape) the closing triple quote and make
* the generated block — PTC mode's only SDK — syntactically invalid Python.
*/
function docLines(description, indent) {
	const collapsed = describe({ description });
	if (collapsed === void 0) return [];
	const escaped = collapsed.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
	return [`${pad(indent)}"""${escaped}"""`];
}
/**
* CamelCase a name into a Python type identifier: non-identifier characters
* split words, `_` splits too (it is `XID_Continue`, so the split set names it
* explicitly), and a head that cannot start an identifier takes a `Tool`
* prefix. Unicode survives, so a `路径` field yields `路径`-based class names
* instead of collapsing to the bare prefix. A character that is not
* `XID_Continue` splits even when it is a letter, so a name whose NFKC folding
* would leave the identifier set is not carried through — the split set is the
* grammar's, not an ASCII approximation of it.
*
* The result is NFKC-normalized: these names are generated, never matched
* against a JSON key, so normalizing is free here and keeps what CPython
* compiles identical to what is emitted — unlike {@link isBareIdentifier},
* which must reject unstable names outright. Normalizing AFTER the prefix
* decision is what makes that hold at the seam the prefix creates: `Tool` +
* a combining-mark head composes there (`U+0301` gives `Tooĺ`, U+013A), so
* normalizing only the un-prefixed part would emit a name CPython compiles to
* a different symbol. The second call is idempotent on the un-prefixed arm.
*
* The split set, the head test, and `toUpperCase()` all read the engine's
* Unicode tables, so this function carries the same version skew
* {@link isBareIdentifier} documents, by paths independent of it: a class name
* derived here reaches emitted text whenever any object shape in the tool's
* schema declares a `TypedDict`, and the predicate's verdict on the tool name
* does not gate that. The case mapping is the one that can fail on a name the
* predicate accepted; the worked example is there.
* @param raw - the schema field or tool name to derive from.
* @returns a class-name segment safe to emit.
*/
function camelCase(raw) {
	const joined = raw.split(/[^\p{XID_Continue}]+|_+/u).filter((part) => part.length > 0).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join("").normalize("NFKC");
	return (/^\p{XID_Start}/u.test(joined) ? joined : `Tool${joined}`).normalize("NFKC");
}
/** Class-name base cap keeping each emitted name — and total text — linear in schema depth. */
const MAX_CLASS_NAME_BASE = 120;
/**
* Deepest `list[…]` nesting emitted into one annotation before the item type
* degrades to `Any`. CPython's tokenizer rejects a logical line holding more
* than 200 simultaneously-open brackets (`MAXLEVEL`, `SyntaxError: too many
* nested parentheses`), so an array chain deeper than that would render an SDK
* block that is not valid Python at all — the same failure the docstring
* escaping in {@link docLines} exists to prevent. 180 leaves headroom for the
* few brackets an annotation can add around the chain, all of which count
* toward the same limit. Per emission site, counting brackets open at the
* chain's innermost point:
*
* - Return annotation, `async def f(self, args: X) -> chain:` — 180 `list[`
*   plus an innermost `Literal[`. The parameter list's `(` closed at the `)`
*   before the `->`, so it is NOT open here: 181.
* - TypedDict field, `field: NotRequired[chain]` — a class-body line with no
*   other open bracket, and its children start at `listDepth: 1` to reserve
*   the `NotRequired[`, so 179 `list[` plus `Literal[`: 181. Required fields
*   share that start for uniformity, spending one level of representable depth
*   on a bracket they never emit.
* - Argument annotation, `async def f(self, args: chain) -> Y:` — the `(` IS
*   still open around it: 180 `list[` plus `Literal[` plus the paren, 182, the
*   worst case. Reachable only through a raw `register()` whose `parameters`
*   is an array reached from the root through `oneOf` arms alone — the root
*   array itself, or one nested under any depth of unions, since an arm
*   inherits the enclosing depth unchanged (`A | B` opens no bracket). An
*   object ancestor takes it out of this case: its fields restart the chain at
*   the 181 site. `defineTool` compiles an object root, so the annotation is a
*   bare TypedDict class name or a one-bracket `dict[str, Any]` when that
*   object degrades — never a chain.
*
* A CPython grammar limit, not a deployment choice, so it is fixed rather than
* configurable. The sibling `ts-types` renderer needs no counterpart: nothing
* in the TypeScript grammar bounds nesting, and its SDK block is never type-
* checked. Only bracket nesting counts — a `oneOf` renders as a flat `A | B`
* chain and nested objects render as separate `class` statements, so neither
* accumulates open brackets at any depth. The invariant this cap serves is
* grammatical validity; see the `oneOf` arm in {@link renderType} for the one
* interpreter limit deliberately left uncapped.
*/
const MAX_LIST_NESTING = 180;
/**
* Cap a class-name base at {@link MAX_CLASS_NAME_BASE} (see the callers for
* why capping keeps the render linear). `slice` counts UTF-16 code units, so
* an astral character straddling the boundary would be cut in half and leave a
* lone surrogate — not an identifier character, and not even well-formed text;
* drop it rather than emit it.
*/
function capClassNameBase(base) {
	if (base.length <= MAX_CLASS_NAME_BASE) return base;
	const capped = base.slice(0, MAX_CLASS_NAME_BASE);
	return /[\uD800-\uDBFF]$/.test(capped) ? capped.slice(0, -1) : capped;
}
/**
* Reserve a unique class name from a base, suffixing `2`, `3`, … on collision.
* The base is capped at {@link MAX_CLASS_NAME_BASE} first: child class names
* derive from their parent's allocated name (`ParentChild`), so an unbounded
* schema of single-field objects would otherwise grow each name by one field
* per level and the sum of all names to Θ(depth²). Capping the base keeps each
* name — and the total emitted text — linear in depth. Collisions resume from
* the per-base counter in `state.nextClassCounter` rather than rescanning from
* `2`, so a deep chain sharing one capped base stays O(1) per allocation
* (amortized) instead of Θ(depth²) in time.
*/
function allocateClassName(base, state) {
	const capped = capClassNameBase(base);
	let name$1 = capped;
	if (state.usedClassNames.has(name$1)) {
		let n = state.nextClassCounter.get(capped) ?? 2;
		while (state.usedClassNames.has(`${capped}${n}`)) n++;
		name$1 = `${capped}${n}`;
		state.nextClassCounter.set(capped, n + 1);
	}
	state.usedClassNames.add(name$1);
	return name$1;
}
/**
* Append a child-name segment to a parent class-name base, capping the result
* at {@link MAX_CLASS_NAME_BASE}. Capping AT PROPAGATION (not only inside
* {@link allocateClassName}) keeps each level O(1): a deep `oneOf`- or
* object-chain would otherwise carry an ever-growing ConsString down the tree
* and re-materialize it (via `.length`/`.slice`) at every level — Θ(depth²).
* The bounded base plus the collision counter still yields unique names.
*
* The join is NFKC-normalized because both sides are separately normalized yet
* their concatenation need not be: a base ending in a Hangul L jamo or LV
* syllable composes with a following V or T jamo head (`가` + `ᆨ` gives `각`),
* so the emitted class name would differ from the symbol CPython compiles, and
* two byte-distinct names could fold onto one — `usedClassNames` dedupes by the
* raw bytes, so the collision counter would not see it. Normalizing costs
* O(cap + segment) per level, the same order as the `slice` it feeds. The other
* two join points need no counterpart: `Args`/`Output` start with `A`/`O` and
* {@link allocateClassName}'s suffix is digits, none of which compose backwards.
*/
function childClassName(base, segment) {
	return capClassNameBase(`${base}${segment}`.normalize("NFKC"));
}
/**
* Render one validated scalar as Python literal text (`True`/`False`,
* JSON-quoted strings, bare numbers). `null` cannot reach here: the `null`
* type renders directly as `None`, and the unified validator rejects a null
* `const`/`enum` entry on every other scalar type.
*
* A beyond-safe-range integral number takes `BigInt` digits rather than
* `String`: Python integers are arbitrary-precision, so the emitted digits ARE
* the value the model programs against, and `String` can give a different
* integer than the double holds (`2 ** 60` prints the rounded `...847000`, not
* the exact `...846976`) or no integer literal at all (`1e21` prints `1e+21`).
* `String`'s rounding is not a bug in it: `Number::toString` emits the shortest
* decimal string that re-reads to the same double, then pads to the exponent
* with zeros (1 significant digit for `1e20`, 16 for `2 ** 60`) — and when the
* shortest string is shorter than the double's exact value, those padded digits
* name an integer no double holds. Passing one back would have to cross the
* argument boundary as a JSON number — a double again — so the SDK would
* document a value no program can pass. `BigInt` needs no case split: where
* `String` is already exact (`2 ** 53`, `1e20`) the two agree byte for byte,
* and where it is not, `BigInt` is the exact one. The TS flavor needs no
* counterpart at all: its literal is re-read by a JS parser back into the same
* double.
*
* `JSON.stringify` is also what keeps this path's output parseable, and it is
* the only thing that does. It covers both classes of hazard: the two kinds of
* code point CPython refuses anywhere in source — NUL among the C0 controls,
* and the whole D800–DFFF unpaired-surrogate block, escaped under ES2019
* well-formed stringification, which the engines range guarantees — and the
* ones that break this line in particular, a bare `"` closing the literal
* early, a trailing odd backslash eating the closing quote, and a bare LF/CR
* ending it before its terminator. The `description` path carries
* {@link UNPRINTABLE} and {@link LONE_SURROGATE} because nothing quotes it,
* and folds newlines in {@link describe}.
*
* That leans on a coincidence worth naming: every escape `JSON.stringify` can
* emit (`\"`, `\\`, `\b`, `\f`, `\n`, `\r`, `\t`, `\uXXXX`) is also a Python
* escape denoting the same character, so the emitted `Literal[...]` both
* parses and decodes back to the value the schema declared. DEL, the C1
* controls (NEL among them), and LS/PS (U+2028/U+2029) do reach it raw —
* legal but invisible, byte-for-byte as in the TS flavor; escaping them is a
* both-flavors change. Those last three are legal here for the reason
* {@link UNPRINTABLE} records: they are `str.splitlines()` boundaries, not
* tokenizer line terminators. The subscript tool-name comment quotes its name
* through its own call to the same `JSON.stringify`, never through this
* function, and inherits both halves — escapes and pass-throughs alike.
*/
function pyScalar(value) {
	if (value === true) return "True";
	if (value === false) return "False";
	if (typeof value === "string") return JSON.stringify(value);
	if (typeof value === "number" && Number.isInteger(value) && !Number.isSafeInteger(value)) return BigInt(value).toString();
	return String(value);
}
/**
* Render a validated scalar `const`/`enum` as `Literal[...]`, falling back to
* the broad type. Deliberately deviates from PEP 586, which restricts `Literal`
* parameters to int/bool/str/bytes/enum/None: a non-integral number
* `const`/`enum` emits a float literal (`Literal[1.5]`) a strict checker would
* reject. An integral one does not deviate — {@link pyScalar} emits int digits,
* including for the beyond-safe-range values it widens through `BigInt`, and
* PEP 586 admits int parameters. Harmless either way — the stub is advisory
* prompt text, only required to parse — and keeping the exact value
* communicates the constraint to the model.
*/
function renderConstrainedScalar(node, broad, state) {
	if (node.const !== void 0) {
		state.typing.add("Literal");
		return `Literal[${pyScalar(node.const)}]`;
	}
	if (node.enum !== void 0) {
		state.typing.add("Literal");
		return `Literal[${node.enum.map(pyScalar).join(", ")}]`;
	}
	return broad;
}
/**
* Map one JSON-Schema node to a Python type expression, threading `state` to
* collect the `TypedDict` declarations and `typing` symbols a full render
* needs. `className` is the name to give an object node with properties (and
* the prefix for its nested objects). Handles every unified schema construct —
* `oneOf` (→ `X | Y`), `const`/`enum` (→ `Literal[...]`), `integer` (→ `int`),
* `null` (→ `None`) — and degrades an unsupported or malformed schema to `Any`
* without throwing, the same trusted-after-validation stance as the sibling
* {@link ./ts-types.ts | ts-types} renderer. {@link jsonSchemaToPy} is the
* context-free entry point; this is the collecting core.
*/
function renderType(schema, className, state) {
	const newFrame = (schema$1, className$1, listDepth) => ({
		schema: schema$1,
		className: className$1,
		phase: "start",
		listDepth,
		children: [],
		childIndex: 0,
		childTypes: [],
		entries: []
	});
	try {
		assertSupportedJsonSchema(schema);
		const frames = [newFrame(schema, className, 0)];
		let result;
		const finish = (type) => {
			frames.pop();
			const parent = frames.at(-1);
			if (parent === void 0) result = type;
			else parent.childTypes.push(type);
		};
		while (frames.length > 0) {
			const frame = frames.at(-1);
			/* v8 ignore next -- the loop condition guarantees a current frame. */
			if (frame === void 0) break;
			if (frame.phase === "children") {
				if (frame.childIndex < frame.children.length) {
					const child = frame.children[frame.childIndex];
					/* v8 ignore next -- childIndex is bounded by children.length. */
					if (child === void 0) throw new Error("missing python render child");
					frame.childIndex++;
					frames.push(newFrame(child.schema, child.className, child.listDepth));
					continue;
				}
				if (frame.kind === "oneOf") {
					let union = "";
					for (const [index, childType] of frame.childTypes.entries()) union = index === 0 ? childType : `${union} | ${childType}`;
					finish(union);
					continue;
				}
				if (frame.kind === "array") {
					/* v8 ignore next -- the ?? arm needs a childless array frame, which start never builds. */
					finish(`list[${frame.childTypes[0] ?? "Any"}]`);
					continue;
				}
				const node$1 = frame.node;
				const name$1 = frame.allocated;
				/* v8 ignore next -- typeddict frames always set node and allocated at start. */
				if (node$1 === void 0 || name$1 === void 0) throw new Error("missing typeddict frame state");
				const required = new Set(node$1.required);
				const lines = [`class ${name$1}(TypedDict):`];
				for (let index = 0; index < frame.entries.length; index++) {
					const entry = frame.entries[index];
					const fieldType = frame.childTypes[index];
					/* v8 ignore next -- entries and childTypes correspond one-to-one. */
					if (entry === void 0 || fieldType === void 0) throw new Error("missing typeddict field type");
					const [field, fieldSchema] = entry;
					const description = describe(fieldSchema);
					if (description !== void 0) lines.push(`${pad(1)}# ${description}`);
					if (required.has(field)) lines.push(`${pad(1)}${field}: ${fieldType}`);
					else {
						state.typing.add("NotRequired");
						lines.push(`${pad(1)}${field}: NotRequired[${fieldType}]`);
					}
				}
				if (node$1.additionalProperties !== false) lines.push(`${pad(1)}# Additional keys beyond those declared are allowed.`);
				if (lines.length === 1) lines.push(`${pad(1)}pass`);
				state.classes.push(lines.join("\n"));
				finish(name$1);
				continue;
			}
			frame.phase = "children";
			const node = frame.schema;
			if (node.oneOf !== void 0) {
				frame.kind = "oneOf";
				frame.children = node.oneOf.map((branch, index) => ({
					schema: branch,
					className: childClassName(frame.className, `${index + 1}`),
					listDepth: frame.listDepth
				}));
				continue;
			}
			if (node.type === void 0) {
				state.typing.add("Any");
				finish("Any");
				continue;
			}
			switch (node.type) {
				case "string":
					finish(renderConstrainedScalar(node, "str", state));
					break;
				case "number":
					finish(renderConstrainedScalar(node, "float", state));
					break;
				case "integer":
					finish(renderConstrainedScalar(node, "int", state));
					break;
				case "boolean":
					finish(renderConstrainedScalar(node, "bool", state));
					break;
				case "null":
					finish("None");
					break;
				case "array":
					if (node.items === void 0) {
						state.typing.add("Any");
						finish("list[Any]");
						break;
					}
					if (frame.listDepth >= MAX_LIST_NESTING) {
						state.typing.add("Any");
						finish("Any");
						break;
					}
					frame.kind = "array";
					frame.children = [{
						schema: node.items,
						className: frame.className,
						listDepth: frame.listDepth + 1
					}];
					break;
				case "object": {
					const entries = Object.entries(node.properties ?? {});
					if (className === "" || !entries.every(([name$1]) => isBareIdentifier(name$1) && !RESERVED.has(name$1) && !(name$1.startsWith("__") && !name$1.endsWith("__")))) {
						state.typing.add("Any");
						finish("dict[str, Any]");
						break;
					}
					if (entries.length === 0 && node.additionalProperties !== false) {
						state.typing.add("Any");
						finish("dict[str, Any]");
						break;
					}
					frame.kind = "typeddict";
					frame.node = node;
					frame.allocated = allocateClassName(frame.className, state);
					state.typing.add("TypedDict");
					frame.entries = entries;
					/* v8 ignore next -- allocated is always set before children are built. */
					frame.children = entries.map(([field, child]) => ({
						schema: child,
						className: childClassName(frame.allocated ?? "", camelCase(field)),
						listDepth: 1
					}));
					break;
				}
				default:
					state.typing.add("Any");
					finish("Any");
			}
		}
		/* v8 ignore next -- every root frame produces one expression. */
		return result ?? "Any";
	} catch {
		state.typing.add("Any");
		return "Any";
	}
}
/** The fixed model-facing usage contract rendered above the declarations. */
const SDK_INSTRUCTIONS = `## Writing code for run_code

\`run_code\` takes two required arguments: \`code\` — the body of an async Python function (top-level \`await\` and \`return\` both work) — and \`description\`, a short summary of what the program does. At run time exactly two of the names declared below are bound: \`tools\` and \`ToolCallError\`. Everything else is a STATIC STUB describing argument and return types — in particular the \`TypedDict\` classes do NOT exist at run time, so build arguments as plain \`dict\`/\`list\` JSON values: \`await tools.name({"field": 1})\`, never \`FooArgs(field=1)\`, which raises \`NameError\`. Inside the program:

- Call tools as \`await tools.name(args)\` — subscript access for exotic, reserved, or underscore-leading names: \`await tools["my-tool"](args)\`. Every call resolves to the tool's typed canonical JSON value (each method's return type below). Tool arguments must be lossless JSON.
- A FAILED tool call raises \`ToolCallError\`, whose \`toolName\` identifies the failed tool and whose message is human-readable — wrap in \`try/except\` to handle and continue.
- Independent read-only calls MAY overlap under \`asyncio.gather\` (safe calls run concurrently; mutating calls run alone, in submission order). Sequence dependent work with \`await\`.
- Emit the run's answer with \`print(...)\` and/or a top-level \`return <value>\`; the returned value must be lossless JSON. Only what you print and return is program output. A successful tool result containing an image is attached after the run so you can inspect it on the next step; every other intermediate result stays out of the conversation, so extract just what you need.

The available tools:`;
/**
* Render the full `tools:sdk` prompt section under `runtime.language ===
* 'python'`: the Python-flavored usage instructions plus one named `TypedDict`
* per tool argument or output object (and per nested object) and one awaitable
* method per visible tool on a `Tools` protocol — typed args in, the tool's
* canonical output value out — with a `tools: Tools` singleton the model calls
* into. The `typing` import line lists exactly the symbols the render used.
* Deterministic — tools are emitted in lexicographic name order, and class
* declarations precede the protocol in that same order (nested classes before
* the parent that references them), so an unchanged tool set produces
* byte-identical text across assemblies. The sort is not a total order on
* byte-equal names, so two schemas sharing a name would render in argument
* order; the caller's visible-capability map is keyed by name, so the input
* never carries a duplicate.
* @param schemas - the tool schemas plus canonical output schemas to declare
*   (the caller excludes `run_code` itself).
* @returns the complete section text.
*/
function renderToolsSdkPy(schemas) {
	const sorted = [...schemas].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
	const state = {
		classes: [],
		usedClassNames: /* @__PURE__ */ new Set(),
		nextClassCounter: /* @__PURE__ */ new Map(),
		typing: new Set(["Protocol"])
	};
	const members = [];
	let statements = 0;
	for (const schema of sorted) {
		const argType = renderType(schema.parameters, `${camelCase(schema.name)}Args`, state);
		const outputType = renderType(schema.output, `${camelCase(schema.name)}Output`, state);
		if (isBareIdentifier(schema.name) && !RESERVED.has(schema.name) && !schema.name.startsWith("_")) {
			const doc = docLines(schema.description, 2);
			members.push(doc.length > 0 ? `${pad(1)}async def ${schema.name}(self, args: ${argType}) -> ${outputType}:` : `${pad(1)}async def ${schema.name}(self, args: ${argType}) -> ${outputType}: ...`);
			members.push(...doc);
			statements += 1;
		} else {
			members.push(`${pad(1)}# tools[${JSON.stringify(schema.name)}](args: ${argType}) -> ${outputType}`);
			const description = describe(schema);
			if (description !== void 0) members.push(`${pad(1)}#   ${description}`);
		}
	}
	const body = (statements > 0 ? members : [`${pad(1)}pass`, ...members]).join("\n");
	const imports = TYPING_ORDER.filter((symbol) => state.typing.has(symbol));
	const classBlock = state.classes.length > 0 ? `${state.classes.join("\n\n")}\n\n` : "";
	return `${SDK_INSTRUCTIONS}\n\n\`\`\`python\n${`from typing import ${imports.join(", ")}\n\nclass ToolCallError(Exception):
    toolName: str\n\n${classBlock}class Tools(Protocol):\n${body}\n\ntools: Tools`}\n\`\`\``;
}
/**
* Tool registry, model presentation modes, and pre/guard/around/post/result
* execution pipeline.
* @module @deepseek-ai/dsh-tools
*/
/**
* Language → SDK-section renderer. The registry looks up the loaded
* `ctx.codeRuntime.language` in this table when assembling the `tools:sdk`
* section under a non-native mode; a runtime whose language is not a key
* fails the assembly loudly (same idiom as `toolOrder` violations). Adding a
* new backend language is three parallel edits — a {@link CodeSdkLanguage}
* member, an entry here, and a `RUN_CODE_FLAVORS` entry in `ptc.ts` for
* its `run_code` schema strings — plus the renderer function this table points
* at. The `satisfies` clause pins this table's key set to that union, which
* the flavor table is checked against too, so any of the three left out is a
* typecheck failure. What no check reaches is the prose that names the values
* instead of deriving them: the seam's `dsh-code-runtime` README pair, its
* `CodeRuntime.language` JSDoc, and `docs/subsystems/code-runtime.md`
* with its zh pair, plus this package's own README pair and the
* {@link Config.mode} JSDoc.
*/
/**
* The model-facing statement of the `ptc` collapse. Names the consequence
* (the call fails) and the route (inside the program), because a rule the
* model can only discover by being denied is one it corrects too late.
*/
const PTC_ONLY_INSTRUCTION = `\`${RUN_CODE_NAME}\` is the only tool you can call directly — a tool call naming any other tool fails. Reach every tool the SDK declares below from inside the program.`;
const SDK_RENDERERS = {
	typescript: renderToolsSdk,
	python: renderToolsSdkPy
};
/**
* Scheduler entry point omitted from the generated named service API.
* @internal
*/
const TOOL_RUNTIME_SCHEDULER = Symbol("@deepseek-ai/dsh-tools.scheduler");
/** Canonical error code for cancellation after a tool body was invoked. */
const TOOL_ABORTED = "ABORTED";
/** Canonical error code for cancellation before a tool body was invoked. */
const TOOL_ABORTED_BEFORE_DISPATCH = "ABORTED_BEFORE_DISPATCH";
/**
* Thrown (internally) when the model requests a tool that isn't registered.
* Extends {@link HarnessError} (`code: 'UNKNOWN_TOOL'`) so an unknown-tool
* failure is as routable as a tool-thrown one — retry/sandbox/replay code can
* distinguish it from a tool body's own error.
*/
var ToolNotFoundError = class extends HarnessError {
	/**
	* @param toolName - the name the caller asked for.
	* @param reachableFrom - how the model reaches this tool instead, when the
	*   name IS visible and only the presentation denies calling it directly.
	*   Omitted for a name that is registered nowhere.
	*/
	constructor(toolName, reachableFrom) {
		super(reachableFrom === void 0 ? `unknown tool "${toolName}"` : `unknown tool "${toolName}": ${reachableFrom}`, "UNKNOWN_TOOL");
		this.name = "ToolNotFoundError";
	}
};
/** Thrown when a tool body or post-policy value violates its declared output. */
var ToolOutputError = class extends HarnessError {
	/** Schema/value violations in validation order. */
	violations;
	constructor(toolName, violations) {
		super(`tool "${toolName}" returned invalid output: ${violations.join("; ")}`, "INVALID_TOOL_OUTPUT");
		this.name = "ToolOutputError";
		this.violations = violations;
	}
};
/** Convert one projector exception into the canonical invalid-output failure. */
function projectionError(toolName, projector, error) {
	return new ToolOutputError(toolName, [`output.${projector} failed: ${errorMessage(error)}`]);
}
/** Snapshot one projector result before later durable-result materialization. */
function snapshotProjection(toolName, projector, candidate) {
	try {
		const detached = snapshotJsonValue(candidate);
		if (detached === void 0) throw new ToolOutputError(toolName, [`output.${projector} returned non-lossless JSON`]);
		return detached;
	} catch (error) {
		if (error instanceof ToolOutputError) throw error;
		throw projectionError(toolName, projector, error);
	}
}
/** Snapshot one body or policy value into the canonical invalid-output failure class. */
function snapshotToolValue(toolName, candidate) {
	try {
		const detached = snapshotJsonValue(candidate);
		if (detached === void 0) throw new ToolOutputError(toolName, ["value is not lossless JSON"]);
		return detached;
	} catch (error) {
		if (error instanceof ToolOutputError) throw error;
		throw new ToolOutputError(toolName, [`value snapshot failed: ${errorMessage(error)}`]);
	}
}
/**
* Best-effort human-readable message from an arbitrary thrown value: Error
* instances use `.message`; non-Error objects with a string `message`
* property (e.g. `throw { message: 'denied' }`) use it too; everything else
* is stringified.
*/
function errorMessage(error) {
	try {
		if (error instanceof Error) return error.message;
		if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") return error.message;
		return String(error);
	} catch {
		return "<unprintable thrown value>";
	}
}
/** Derive one failure message from policy feedback without changing its rendered blocks. */
function failureMessageFromContent(content) {
	const text = content.map((block) => block.type === "text" ? block.text : `[${block.type} content]`).join("\n");
	return text.length > 0 ? text : "tool result blocked by post-execute policy";
}
/** Snapshot and freeze one durable tool-result projection or reject lossy data. */
function materializePresentation(candidate) {
	const detached = snapshotJsonValue(candidate);
	if (detached === void 0) throw new TypeError("tool result must be losslessly JSON-serializable");
	return deepFreeze(detached);
}
/** Structured `{ name, code }` for a thrown HarnessError, else undefined. */
function errorInfo(error) {
	try {
		return error instanceof HarnessError ? {
			name: error.name,
			code: error.code
		} : void 0;
	} catch {
		return;
	}
}
/** One scope's complete tool-registry contribution. */
var ToolLayer = class {
	tools;
	restrictions = new AnonymousEntries();
	guards = new AnonymousEntries();
	/**
	* Presentation this scope's agent declared for itself, shadowing the
	* deployment default. One cell rather than an entry table: two answers to
	* "which form does the model see" is a contradiction, not a merge.
	*/
	mode;
	constructor(scope) {
		this.tools = new NamedEntries((name$1) => /* @__PURE__ */ new Error(scope === void 0 ? `tool "${name$1}" is already registered (for a per-agent variant, register through that agent's \`agent.ctx\` instead)` : `tool "${name$1}" is already registered in this scope`));
	}
	/** Whether every contribution table in this aggregate layer is empty. */
	isEmpty() {
		return this.tools.isEmpty() && this.restrictions.isEmpty() && this.guards.isEmpty() && this.mode === void 0;
	}
	/** Whether every compiled restriction in this layer admits a global tool name. */
	admits(name$1) {
		for (const filter of this.restrictions.values()) if (filter.allow !== void 0 && !filter.allow.has(name$1) || filter.deny !== void 0 && filter.deny.has(name$1)) return false;
		return true;
	}
	/** First monotonic denial from this layer's live guard registrations. */
	guardReason(exec) {
		for (const guard of this.guards.values()) {
			const reason = guard(exec);
			if (reason !== void 0) return reason;
		}
	}
};
/** Resolve the run_code overlap cap at the owning config boundary (direct construction bypasses the Loader schema). */
function resolveMaxParallelSubCalls(value) {
	const maxParallelSubCalls = value ?? 10;
	if (!Number.isInteger(maxParallelSubCalls) || maxParallelSubCalls < 1) throw new Error("maxParallelSubCalls must be a positive integer");
	return maxParallelSubCalls;
}
/**
* Tool registry and execution pipeline. Scoped registrations shadow globals;
* one visibility resolver feeds presentation, lookup, and dispatch.
*/
var ToolRuntime = class extends Service {
	static inject = ["systemPrompt"];
	static Config = Schema.object({
		mode: Schema.union([
			"native",
			"ptc",
			"both"
		]).default("native"),
		maxParallelSubCalls: Schema.natural().min(1).default(10)
	});
	/** Internal staged view consumed by `dsh-agent-loop`'s parallel scheduler. */
	[TOOL_RUNTIME_SCHEDULER] = {
		prepare: (exec) => this.prepareScheduledExecution(exec),
		dispatch: (exec) => this.dispatchScheduledExecution(exec),
		finalize: (exec, result) => this.finalizeScheduledExecution(exec, result),
		finish: (exec, result) => this.finishScheduledExecution(exec, result)
	};
	/** Context deferred by a running tool body, keyed by its scheduler-owned execution. */
	deferredContexts = /* @__PURE__ */ new WeakMap();
	/** Executions whose tool body declared the current turn complete. */
	concludingExecutions = /* @__PURE__ */ new WeakSet();
	/** Original caller cancellation, kept outside the wrapper-mutable execution object. */
	cancellationStates = /* @__PURE__ */ new WeakMap();
	/** Definition-owned final content transform snapshotted before policy begins. */
	contentFinalizers = /* @__PURE__ */ new WeakMap();
	layers = new ScopedLayers((scope) => new ToolLayer(scope), () => {
		this.ctx.emit("tools/change");
	});
	/** Presentation for scopes that declare none; {@link presentAs} shadows it per scope. */
	defaultMode;
	maxParallelSubCalls;
	/**
	* Reserved presentation transport, kept outside the filterable registration
	* layers. Built on first need rather than at construction: which agents run
	* a PTC mode is no longer known when the service is constructed, and the
	* transport is stateless beyond its closures over `this`.
	*/
	ptcTransport;
	constructor(ctx, config = {}) {
		super(ctx, "tools");
		this.defaultMode = config.mode ?? "native";
		this.maxParallelSubCalls = resolveMaxParallelSubCalls(config.maxParallelSubCalls);
		ctx.systemPrompt.tools((context) => this.wireSchemas(context.scope));
		if (this.defaultMode !== "native") {
			ctx.systemPrompt.section(this.collapseSection());
			ctx.systemPrompt.section(this.sdkSection());
		}
	}
	/**
	* The prompt statement of the `ptc` executor collapse, registered wherever
	* {@link sdkSection} is and rendering empty outside an effective `ptc`.
	*
	* Every tool contributes its own guidance section naming its tool, none of
	* them qualify how that tool is reached, and they all render before the SDK.
	* Without this the model reads a catalog of tools it is told to use and no
	* statement that only `run_code` may be called, so it emits a native call,
	* receives `UNKNOWN_TOOL` for a tool the prompt just declared, and concludes
	* the deployment is inconsistent. Its order places the rule before that
	* guidance rather than after it.
	*
	* `both` renders empty: native calls do execute there, so the rule is false.
	* @returns the section registration.
	*/
	collapseSection() {
		return {
			name: "tools:ptc-only",
			order: this.ctx.systemPrompt.getSectionOrder("PTC_ONLY"),
			text: (context) => this.modeFor(context.scope) === "ptc" ? PTC_ONLY_INSTRUCTION : ""
		};
	}
	/**
	* The generated-SDK prompt section, registered globally by a PTC mode
	* deployment and per scope by {@link presentAs}.
	*
	* The body regenerates from the CALLING scope, and renders empty for an
	* agent presenting natively — an agent that opted out under a PTC mode
	* deployment still sees the global registration, and an empty section is
	* dropped from the rendered prompt.
	* @returns the section registration.
	*/
	sdkSection() {
		return {
			name: "tools:sdk",
			order: this.ctx.systemPrompt.getSectionOrder("TOOLS_SDK"),
			text: (context) => {
				const mode = this.modeFor(context.scope);
				if (mode === "native") return "";
				const runtime = this.requireCodeRuntime(mode);
				const render = SDK_RENDERERS[runtime.language];
				/* v8 ignore next -- requireCodeRuntime rejects an unknown language before this runs. */
				if (render === void 0) throw new Error(`dsh-tools: no SDK renderer for ${runtime.language}`);
				return render(this.sdkSchemas(context.scope));
			}
		};
	}
	/**
	* The presentation one scope's agent sees: its own declaration, else the
	* deployment default.
	* @param scope - the calling agent, or undefined for the global view.
	* @returns the resolved presentation mode.
	*/
	modeFor(scope) {
		const layers = this.layers.chainLayers(scope);
		for (let index = layers.length - 1; index >= 0; index -= 1) {
			const mode = layers[index]?.mode;
			if (mode !== void 0) return mode;
		}
		return this.defaultMode;
	}
	/**
	* The reserved `run_code` transport, built on first need.
	*
	* It never enters the global layer: per-agent restrictions must not remove
	* it, and a scoped registration must not shadow it. The visibility resolver
	* appends it after resolving the filterable global/scoped capability layers,
	* and only for scopes whose mode actually presents it.
	* @returns the shared transport definition.
	*/
	requireCodeTransport() {
		this.ptcTransport ??= createRunCodeTool(this, {
			requireRuntime: () => this.requireCodeRuntime(this.defaultMode),
			peekRuntime: () => this.ctx.get("codeRuntime"),
			maxParallel: this.maxParallelSubCalls,
			shapeDispatchLog: (dispatch) => this.shapeDispatchLog(dispatch)
		});
		return this.ptcTransport;
	}
	/**
	* Present the calling scope's tools in `mode` instead of the deployment
	* default. Nearest scope on the chain wins, so a preset's standing
	* declaration covers every agent joined under it.
	*
	* Scoped only, and one declaration per scope: this is how an agent preset
	* composes PTC mode agents beside native ones in the same process, and a
	* process-global override would be the `mode` config field instead.
	* @param mode - the presentation the covered agents' models see.
	* @returns the exact disposer that restores the deployment default.
	*/
	presentAs(mode) {
		const ctx = this.ctx;
		if (scopeOf(ctx) === void 0) throw new Error("tools.presentAs() requires a scoped context (agent.ctx): a context-global presentation is the `mode` config field on the tools row");
		return ctx.effect(function* () {
			yield this.layers.effect(ctx, (layer) => {
				if (layer.mode !== void 0) throw new Error(`tools.presentAs("${mode}") conflicts with "${layer.mode}" already declared for this scope; one composition selects one presentation`);
				layer.mode = mode;
				return () => {
					layer.mode = void 0;
				};
			}, { label: "tools.presentAs()" });
			if (mode !== "native") {
				yield ctx.systemPrompt.section(this.collapseSection());
				yield ctx.systemPrompt.section(this.sdkSection());
			}
		}.bind(this), "tools.presentAs()");
	}
	/**
	* Build one scope's wire schemas and names for prompt-order validation.
	* Restrictions do not make known tools invalid, but a mode collapse does.
	*/
	wireSchemas(scope) {
		const view = this.view(scope);
		const mode = this.modeFor(scope);
		if (mode === "native") return {
			schemas: [...view.visible.values()].map((definition) => this.schemaOf(definition, false)),
			knownNames: [...view.knownNames]
		};
		this.requireCodeRuntime(mode);
		const schemas = [...view.visible.values()].map((definition) => this.schemaOf(definition, false));
		if (mode === "ptc") return {
			schemas: schemas.filter((schema) => schema.name === RUN_CODE_NAME),
			knownNames: [RUN_CODE_NAME]
		};
		return {
			schemas,
			knownNames: [...view.knownNames, RUN_CODE_NAME]
		};
	}
	/**
	* Resolve the code runtime or throw the actionable misconfiguration error.
	* Read at use time (assembly / run_code execution), NOT via static
	* `inject`: an inject entry would hold `ctx.tools` — and every tool plugin
	* behind it — hostage to a code runtime existing even under `mode:
	* 'native'`.
	*
	* Assembly and `run_code` execution read separately, so the language is not
	* bound to a request. Harmless while one published backend exists — both
	* reads return the same flavor — but a reload that swapped in a second
	* language between them would hand a program written against one SDK to the
	* other. Binding it is deferred until a second backend ships (the first
	* point it is testable).
	*/
	requireCodeRuntime(mode) {
		const runtime = this.ctx.get("codeRuntime");
		if (!runtime) throw new Error(`dsh-tools: mode "${mode}" requires a code runtime — load a ctx.codeRuntime implementation (e.g. @deepseek-ai/dsh-code-runtime-worker-thread) or set tools mode to "native"`);
		if (!Object.hasOwn(SDK_RENDERERS, runtime.language)) {
			const known = Object.keys(SDK_RENDERERS).map((name$1) => JSON.stringify(name$1)).join(", ");
			throw new Error(`dsh-tools: no SDK renderer registered for runtime language ${JSON.stringify(runtime.language)} (known: ${known})`);
		}
		return runtime;
	}
	/**
	* Register globally or in the calling agent scope. Scoped tools shadow
	* globals; duplicates within one layer and the reserved `run_code` name fail.
	* @param definition - tool schema, execution, and optional finalization/presentation callbacks.
	* @returns the exact disposer that unregisters the tool.
	*/
	register(definition) {
		const name$1 = definition.name;
		const output = definition.output;
		if (output === void 0 || typeof output !== "object" || typeof output.render !== "function" || output.presentationMeta !== void 0 && typeof output.presentationMeta !== "function") throw new TypeError(`tool "${name$1}" must declare output { schema, render, presentationMeta? }`);
		assertSupportedJsonSchema(output.schema);
		const timeoutMs = definition.timeoutMs;
		if (timeoutMs !== void 0 && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) throw new TypeError(`tool "${name$1}" timeoutMs must be a positive finite number`);
		if (name$1 === "run_code") throw new Error(`tool name "${RUN_CODE_NAME}" is reserved for the PTC mode presentation transport and cannot be registered or shadowed`);
		return this.layers.effect(this.ctx, (layer) => layer.tools.insert(name$1, definition), { label: "tools.register()" });
	}
	/**
	* Restrict global tools for the calling agent scope. Empty filters, unknown
	* names, scope-local names, and reserved transport names fail. Restrictions
	* intersect; scoped registrations remain visible.
	* @param filter - global-tool mask: `allow` (keep only) and/or `deny` (remove).
	* @returns the exact disposer that lifts this restriction.
	*/
	restrict(filter) {
		const scope = scopeOf(this.ctx);
		if (scope === void 0) throw new Error("tools.restrict() requires a scoped context (agent.ctx): a context-global restriction would mask every agent — deny the tool for the intended agent instead");
		const allow = filter.allow;
		const deny = filter.deny;
		if (allow === void 0 && deny === void 0) throw new Error("tools.restrict({}) is a no-op: pass `allow` and/or `deny` (an empty filter is almost always a materialized-empty-config bug)");
		const compiled = {
			...allow !== void 0 ? { allow: new Set(allow) } : {},
			...deny !== void 0 ? { deny: new Set(deny) } : {}
		};
		if ([...allow ?? [], ...deny ?? []].includes("run_code")) throw new Error(`tools.restrict() cannot name reserved PTC mode presentation transport "${RUN_CODE_NAME}"; restrict end-capability tools instead`);
		const known = this.view(scope).restrictableNames;
		const unknown = [...allow ?? [], ...deny ?? []].filter((name$1) => !known.has(name$1));
		if (unknown.length > 0) throw new Error(`tools.restrict() names unknown global tool${unknown.length > 1 ? "s" : ""} ${unknown.map((n) => `"${n}"`).join(", ")}; known global tools: ${[...known].sort().join(", ") || "(none)"}`);
		return this.layers.effect(this.ctx, (layer) => layer.restrictions.append(compiled), { label: "tools.restrict()" });
	}
	/**
	* Register a monotonic guard after the extensible `tools/pre-execute`
	* waterfall. A plain-context guard applies globally; one registered through
	* `agent.ctx` applies only to that agent. Any matching guard may deny by
	* returning a reason, while no guard can force-allow a call another guard
	* denied. The exact effect disposer is returned for ordered ownership and
	* HMR cleanup.
	* @param guard - synchronous check; a returned string denies the execution.
	* @returns the exact disposer that unregisters the guard.
	*/
	guard(guard) {
		return this.layers.effect(this.ctx, (layer) => layer.guards.append(guard), {
			label: "tools.guard()",
			notify: false
		});
	}
	/** First monotonic denial from the global then the scope chain's guard layers, farthest first. */
	guardReason(exec) {
		const globalReason = this.layers.global.guardReason(exec);
		if (globalReason !== void 0) return globalReason;
		if (exec.agent === void 0) return void 0;
		for (const layer of this.layers.chainLayers(exec.agent)) {
			const reason = layer.guardReason(exec);
			if (reason !== void 0) return reason;
		}
	}
	/**
	* Resolve every registry fact one scope needs in one layer traversal. The
	* visible map applies restrictions to the INHERITED surface, then the
	* scope's own registrations and the reserved presentation transport; the
	* other sets retain the pre-restriction facts needed by restriction and
	* prompt-order validation.
	*
	* A restriction filters what a scope inherits — the global layer and every
	* ancestor layer on its chain — and never what its OWN layer registers.
	* That exemption is what a per-child capability filter has to keep intact:
	* the delegation runtime registers a child's structured-output tool into the
	* child's own layer, and a filter naming the capabilities the child may use
	* must not strip the machinery it answers through.
	*
	* Reading the exempt set as "the global layer" instead of "not mine" held
	* only while every model-facing tool sat in the host composition. Once
	* presets moved them onto the agent plane they became an ANCESTOR
	* contribution, so a child's filter silently stopped constraining anything
	* it was given.
	* @param scope - the viewing scope (the agent), or undefined for the global view.
	* @returns the complete derived view for that scope.
	*/
	view(scope) {
		const layers = this.layers.chainLayers(scope);
		const own = this.layers.peek(scope);
		const inherited = new Map(this.layers.global.tools.entries());
		for (const layer of layers) {
			if (layer === own) continue;
			for (const [name$1, definition] of layer.tools.entries()) inherited.set(name$1, definition);
		}
		const visible = /* @__PURE__ */ new Map();
		const knownNames = /* @__PURE__ */ new Set();
		const restrictableNames = /* @__PURE__ */ new Set();
		for (const [name$1, definition] of inherited) {
			knownNames.add(name$1);
			restrictableNames.add(name$1);
			if (layers.every((layer) => layer.admits(name$1))) visible.set(name$1, definition);
		}
		if (own !== void 0) for (const [name$1, definition] of own.tools.entries()) {
			knownNames.add(name$1);
			visible.set(name$1, definition);
		}
		if (this.modeFor(scope) !== "native") visible.set(RUN_CODE_NAME, this.requireCodeTransport());
		return {
			visible,
			knownNames,
			restrictableNames
		};
	}
	/**
	* Look up a tool as one scope sees it (scoped
	* shadows global; a restricted-away global reads as absent). Presenters pass
	* the calling agent so the rendered card matches the definition that
	* actually executed.
	* @param name - the tool name as registered.
	* @param scope - the viewing scope (the agent); omitted = the global view.
	* @returns the definition the scope resolves, or undefined when none is visible.
	*/
	get(name$1, scope) {
		return this.view(scope).visible.get(name$1);
	}
	/**
	* Resolve the definition that MAY EXECUTE for a call, applying the mode
	* collapse at the operation boundary that owns it. The registry view
	* (`get`) is presentation-agnostic; here a MODEL-DIRECT call under `ptc`
	* may only name the reserved `run_code` transport, while a nested
	* sub-dispatch (a `parent` token set — the `run_code` SDK calling a tool
	* it bound) may call any visible tool. Denial surfaces as `UNKNOWN_TOOL`
	* through the executor, matching an absent definition.
	* @param name - the tool name as registered.
	* @param scope - the viewing scope (the agent); omitted = the global view.
	* @param nested - whether the call is a transport sub-dispatch, not a model-direct call.
	* @returns the definition that may run, or undefined when the call must be rejected.
	*/
	resolveExecution(name$1, scope, nested) {
		const tool = this.get(name$1, scope);
		if (tool === void 0) return void 0;
		if (this.collapses(name$1, scope, nested)) return void 0;
		return tool;
	}
	/**
	* Project visible definitions onto the allowlisted model-facing schema fields,
	* excluding execution and presentation callbacks.
	* @param scope - the viewing scope (the agent); omitted = the global view.
	* @returns one deep-cloned schema per visible tool.
	*/
	schemas(scope) {
		return [...this.view(scope).visible.values()].map((definition) => this.schemaOf(definition, true));
	}
	/** Project visible callable tools onto the generated PTC mode SDK contract. */
	sdkSchemas(scope) {
		return [...this.view(scope).visible.values()].filter((definition) => definition.name !== RUN_CODE_NAME).map((definition) => {
			const output = snapshotJsonValue(definition.output.schema);
			/* v8 ignore next -- registration already validated and retained this schema as lossless JSON. */
			if (output === void 0) throw new Error(`tool "${definition.name}" output schema must be lossless JSON before SDK projection`);
			return {
				...this.schemaOf(definition, true),
				output
			};
		});
	}
	/** Project one definition onto the model-facing schema fields. */
	schemaOf(definition, detachParameters) {
		const { name: name$1, description, parameters } = definition;
		const detached = detachParameters ? snapshotJsonValue(parameters) : parameters;
		if (detached === void 0) throw new Error(`tool "${name$1}" parameters must be lossless JSON before schema projection`);
		return {
			name: name$1,
			description,
			parameters: detached
		};
	}
	/**
	* Classify a pending call through the caller's visible tool definition. Only
	* an exact `true` is parallel; unknown, hidden, undeclared, invalid, or
	* throwing classifiers are exclusive.
	* @param exec - call name, parsed arguments, and optional agent scope.
	* @returns the fail-closed scheduling mode.
	*/
	executionMode(exec) {
		const tool = this.resolveExecution(exec.name, exec.agent, exec.parent !== void 0);
		if (!tool?.isConcurrencySafe) return { kind: "exclusive" };
		try {
			return tool.isConcurrencySafe(exec.arguments) === true ? { kind: "parallel" } : { kind: "exclusive" };
		} catch {
			return { kind: "exclusive" };
		}
	}
	/**
	* Run the `tools/ptc-dispatch-log` waterfall over one settled sub-dispatch
	* and return the content the bridge should log on `tool/ptc-dispatch`.
	* Contained: when a listener throws, the method logs the original settled
	* content; that failure must not fail the dispatch or omit the settle event. Private:
	* the ONE consumer is the `run_code` bridge this registry constructs, which
	* receives it as a capability parameter (the `requireRuntime` idiom) — the
	* waterfall, not this invoker, is the public extension point.
	*/
	async shapeDispatchLog(dispatch) {
		try {
			return await this.ctx.waterfall(scopeTarget(this, dispatch.agent), "tools/ptc-dispatch-log", dispatch, () => Promise.resolve(dispatch.content));
		} catch (error) {
			this.ctx.logger.warn(`tools: ptc-dispatch-log listener failed for ${dispatch.name}: ${errorMessage(error)}; logging the original settled content`);
			return dispatch.content;
		}
	}
	/**
	* Whether the `ptc` mode collapse denies a model-direct call: only the
	* reserved `run_code` transport may be named. Nested sub-dispatches (a
	* `parent` token set) bypass the collapse. One home for the
	* security-relevant predicate, shared by {@link resolveExecution} and
	* {@link createExecution} so the two can never drift apart.
	*
	* Resolved through {@link modeFor}, NOT `defaultMode`: an agent given `ptc`
	* by an agent preset under a native deployment is the composition
	* `dsh-agent-tool-presentation` exists for, and reading the deployment default would
	* leave exactly that agent uncollapsed — announcing one surface while
	* executing another, which is the bypass this collapse closes.
	* @param name - the tool name as registered.
	* @param scope - the viewing scope whose effective presentation mode applies.
	* @param nested - whether the call is a transport sub-dispatch, not a model-direct call.
	*/
	collapses(name$1, scope, nested) {
		return !nested && this.modeFor(scope) === "ptc" && name$1 !== "run_code";
	}
	/**
	* Execute through pre-policy, guards, around-dispatch, post-policy,
	* definition-owned content finalization, and final notification. Tool and
	* listener failures resolve as materialized error results; an invisible tool
	* reports `UNKNOWN_TOOL`. The returned outcome is the same lossless, frozen
	* snapshot final observers receive. Cancellation
	* arriving after entry and before final result materialization skips a
	* not-yet-started body with `ABORTED_BEFORE_DISPATCH` or replaces a
	* successful started outcome with `ABORTED`; already-started work is still
	* drained and may retain a tool-owned structured error.
	* @param exec - the typed same-process call input. The registry assigns its
	*   correlation token before policy begins.
	* @returns the materialized final result.
	*/
	async execute(exec) {
		return this.prepareExecution(exec, (prepared) => this.completeScheduledExecution(prepared));
	}
	async completeScheduledExecution(prepared) {
		switch (prepared.kind) {
			case "dispatch": {
				const dispatched = await this.dispatchScheduledExecution(prepared.exec);
				return dispatched.kind === "post-result" ? await this.finalizeScheduledExecution(prepared.exec, dispatched.result) : this.finishScheduledExecution(prepared.exec, dispatched.result);
			}
			case "post-result": return await this.finalizeScheduledExecution(prepared.exec, prepared.result);
			case "final-result": return this.finishScheduledExecution(prepared.exec, prepared.result);
			default: return assertNever(prepared, "scheduled tool preparation");
		}
	}
	createExecution(exec) {
		const deferredContexts = [];
		const token = createExecutionToken();
		const callId = exec.callId;
		const rootCallId = exec.rootCallId ?? callId;
		const name$1 = exec.name;
		const agent = exec.agent;
		const parent = exec.parent;
		const signal = exec.signal;
		const visible = this.get(name$1, agent);
		const collapsed = visible !== void 0 && this.collapses(name$1, agent, parent !== void 0);
		const concludingExecutions = this.concludingExecutions;
		const base = {
			token,
			callId,
			rootCallId,
			name: name$1,
			signal,
			...agent !== void 0 ? { agent } : {},
			...parent !== void 0 ? { parent } : {},
			deferContext(context) {
				deferredContexts.push(context);
			},
			concludeTurn() {
				concludingExecutions.add(this);
			}
		};
		const capturedFinalizer = visible?.finalizeContent?.bind(visible);
		const finalizerFor = () => collapsed && !signal.aborted ? void 0 : capturedFinalizer;
		try {
			const detached = snapshotJsonValue(exec.arguments);
			if (detached === void 0) throw new TypeError("tool execution arguments must be losslessly JSON-serializable");
			const execution = {
				...base,
				arguments: deepFreeze(detached)
			};
			this.deferredContexts.set(execution, deferredContexts);
			this.contentFinalizers.set(execution, finalizerFor());
			this.cancellationStates.set(execution, {
				callerSignal: signal,
				bodyInvoked: false
			});
			if (collapsed) {
				if (signal.aborted) return {
					kind: "final-result",
					exec: execution,
					result: toolAbortedBeforeDispatchResult()
				};
				return {
					kind: "final-result",
					exec: execution,
					result: toolErrorResult(new ToolNotFoundError(name$1, `only \`${RUN_CODE_NAME}\` is callable directly — call \`${name$1}\` from inside a \`${RUN_CODE_NAME}\` program instead`))
				};
			}
			return {
				kind: "ready",
				exec: execution
			};
		} catch (error) {
			const execution = {
				...base,
				arguments: void 0
			};
			this.contentFinalizers.set(execution, finalizerFor());
			return {
				kind: "final-result",
				exec: execution,
				result: toolErrorResult(error)
			};
		}
	}
	/**
	* Run the ordered pre-execute and monotonic guard stages for the scheduler.
	* @param input - the caller-supplied execution input.
	* @returns the prepared execution plus the next scheduler stage.
	* @internal
	*/
	async prepareScheduledExecution(input) {
		return this.prepareExecution(input, (prepared) => prepared);
	}
	async prepareExecution(input, next) {
		const created = this.createExecution(input);
		if (created.kind !== "ready") return next(created);
		const exec = created.exec;
		if (this.callerCancelled(exec)) return next({
			kind: "final-result",
			exec,
			result: toolAbortedBeforeDispatchResult()
		});
		try {
			const carrier = scopeTarget(this, exec.agent);
			const gate = await this.ctx.waterfall(carrier, "tools/pre-execute", exec, () => Promise.resolve({ kind: "allow" }));
			const askResolution = gate.kind === "ask" ? await this.serviceAsk(exec, gate) : {
				decision: gate,
				approvalCancelled: false
			};
			const { decision } = askResolution;
			if (this.callerCancelled(exec) && askResolution.approvalCancelled) return await next({
				kind: "post-result",
				exec,
				result: toolAbortedBeforeDispatchResult()
			});
			const denialReason = decision.kind === "allow" ? this.guardReason(exec) : decision.reason;
			if (denialReason !== void 0) return await next({
				kind: "post-result",
				exec,
				result: this.materializeFinalResult({
					content: [{
						type: "text",
						text: `Error: ${denialReason}`
					}],
					isError: true,
					error: { message: denialReason }
				})
			});
			if (this.callerCancelled(exec)) return await next({
				kind: "post-result",
				exec,
				result: toolAbortedBeforeDispatchResult()
			});
			return await next({
				kind: "dispatch",
				exec
			});
		} catch (error) {
			return next({
				kind: "final-result",
				exec,
				result: toolErrorResult(error)
			});
		}
	}
	/** Whether the original caller signal is currently aborted. */
	callerCancelled(exec) {
		const state = this.cancellationStates.get(exec);
		/* v8 ignore next -- only registry-minted executions reach the staged scheduler methods */
		if (state === void 0) throw new Error("tool registry scheduler invariant violated: missing cancellation state");
		return state.callerSignal.aborted;
	}
	/** Canonical cancellation outcome selected by whether the tool body started. */
	cancellationResult(exec, prior) {
		const state = this.cancellationStates.get(exec);
		/* v8 ignore next -- only registry-minted executions reach the staged scheduler methods */
		if (state === void 0) throw new Error("tool registry scheduler invariant violated: missing cancellation state");
		return state.bodyInvoked ? toolAbortedResult(prior) : toolAbortedBeforeDispatchResult(prior);
	}
	/**
	* Dispatch the registered body with the original caller signal fused back
	* into any around-wrapper replacement. Cancellation never abandons the body:
	* a started promise reaches quiescence before its outcome becomes `ABORTED`.
	*/
	async dispatchToolBody(exec) {
		const state = this.cancellationStates.get(exec);
		/* v8 ignore next -- only registry-minted executions reach the staged scheduler methods */
		if (state === void 0) throw new Error("tool registry scheduler invariant violated: missing cancellation state");
		const wrapperSignal = exec.signal;
		const fused = fuseToolSignals(state.callerSignal, wrapperSignal);
		const signal = fused.signal;
		if (isAborted(signal)) {
			fused.dispose();
			return toolAbortedBeforeDispatchResult();
		}
		exec.signal = signal;
		try {
			const tool = this.resolveExecution(exec.name, exec.agent, exec.parent !== void 0);
			if (!tool) throw new ToolNotFoundError(exec.name);
			state.bodyInvoked = true;
			const returned = await tool.execute(exec.arguments, exec);
			const result = this.createSuccessResult(exec, tool, returned);
			return isAborted(signal) ? toolAbortedResult(result) : result;
		} catch (error) {
			return toolErrorResult(error);
		} finally {
			fused.dispose();
			exec.signal = wrapperSignal;
		}
	}
	/**
	* Run around-dispatch and the tool body. Tool and unknown-tool failures still
	* receive post-execute; pipeline failures are already final.
	* @param exec - the prepared execution.
	* @returns whether the result still needs post-execute.
	* @internal
	*/
	async dispatchScheduledExecution(exec) {
		try {
			const mutableExec = exec;
			const carrier = scopeTarget(this, exec.agent);
			const result = await this.ctx.waterfall(carrier, "tools/execute", mutableExec, () => this.dispatchToolBody(mutableExec));
			const normalized = this.normalizeDispatchResult(exec, result);
			const deferredContexts = this.deferredContexts.get(exec);
			/* v8 ignore next -- dispatch only receives executions minted by this registry's prepare stage */
			if (deferredContexts === void 0) throw new Error("tool registry scheduler invariant violated: unprepared execution");
			const resultWithDeferredContexts = deferredContexts.length === 0 ? normalized : this.markCanonical(exec, {
				...normalized,
				additionalContexts: [...deferredContexts, ...normalized.additionalContexts ?? []]
			});
			return {
				kind: "post-result",
				result: this.callerCancelled(exec) && !resultWithDeferredContexts.isError ? this.cancellationResult(exec, resultWithDeferredContexts) : resultWithDeferredContexts
			};
		} catch (error) {
			return {
				kind: "final-result",
				result: toolErrorResult(error)
			};
		}
	}
	/**
	* Run ordered post-execute, then apply definition-owned content finalization,
	* materialize, and notify the final outcome.
	* @param exec - the prepared execution.
	* @param result - dispatch/pre result that still needs post-execute.
	* @returns the materialized final result.
	* @internal
	*/
	async finalizeScheduledExecution(exec, result) {
		try {
			const postResult = await this.postExecute(exec, result);
			return this.finishScheduledExecution(exec, this.callerCancelled(exec) && !postResult.isError ? this.cancellationResult(exec, postResult) : postResult);
		} catch (error) {
			return this.finishScheduledExecution(exec, toolErrorResult(error));
		}
	}
	/**
	* Materialize the candidate, apply definition-owned content finalization,
	* then materialize and notify the authoritative result.
	* @param exec - the prepared execution.
	* @param result - final result.
	* @returns the materialized final result.
	* @internal
	*/
	finishScheduledExecution(exec, result) {
		let materializedResult;
		try {
			materializedResult = this.materializeFinalResult(result);
		} catch (error) {
			materializedResult = this.materializeFinalResult(toolErrorResult(error));
		}
		let finalResult;
		try {
			finalResult = this.materializeFinalResult(this.applyFinalContent(exec, materializedResult));
		} catch (error) {
			finalResult = this.materializeFinalResult(toolErrorResult(error));
		}
		this.notifyResult(exec, finalResult);
		return finalResult;
	}
	/** Apply the snapshotted tool-owned content transform without exposing other result fields. */
	applyFinalContent(exec, result) {
		const finalizeContent = this.contentFinalizers.get(exec);
		if (finalizeContent === void 0) return result;
		const content = finalizeContent(exec, result);
		return content === void 0 ? result : {
			...result,
			content
		};
	}
	/** Notify observers without exposing a mutation or error channel into the outcome. */
	notifyResult(exec, result) {
		Object.freeze(exec);
		const { name: toolName, callId } = exec;
		const reportFailure = (error) => {
			this.ctx.logger.warn(`tool "${toolName}" (${callId}): tools/result observer failed: ${errorMessage(error)}`);
		};
		const callbacks = this.ctx.events.dispatch("emit", [
			scopeTarget(this, exec.agent),
			"tools/result",
			exec,
			result
		]);
		for (const callback of callbacks) try {
			const returned = callback(exec, result);
			Promise.resolve(returned).catch(reportFailure);
		} catch (error) {
			reportFailure(error);
		}
	}
	/**
	* Resolve an `ask` decision to allow/deny through the approval seam. The
	* seam is consumed opportunistically with `ctx.get('approval')` — a
	* deployment that composes no ApprovalService keeps the historical degrade
	* to deny, and an unmount mid-session degrades the same way on the next ask.
	* An agent-less execution also degrades: without an agent there is no
	* session to audit to and no UI to route to. Otherwise the outcome maps
	* one-to-one — `allowed-once` proceeds; the three non-grants deny with
	* distinct reasons so the model can tell a human "no" from an absent
	* approval channel.
	*/
	async serviceAsk(exec, ask) {
		const approval = this.ctx.get("approval");
		if (approval === void 0) return {
			decision: {
				kind: "deny",
				reason: ask.reason ?? `tool "${exec.name}" requires approval (not yet supported)`
			},
			approvalCancelled: false
		};
		if (exec.agent === void 0) return {
			decision: {
				kind: "deny",
				reason: `tool "${exec.name}" requires approval, but the call has no agent to route it through`
			},
			approvalCancelled: false
		};
		const outcome = await approval.request({
			agent: exec.agent,
			toolName: exec.name,
			callId: exec.callId,
			...ask.reason !== void 0 ? { reason: ask.reason } : {},
			signal: exec.signal
		});
		switch (outcome) {
			case "allowed-once": return {
				decision: { kind: "allow" },
				approvalCancelled: false
			};
			case "rejected": return {
				decision: {
					kind: "deny",
					reason: `the user rejected tool "${exec.name}"`
				},
				approvalCancelled: false
			};
			case "cancelled": return {
				decision: {
					kind: "deny",
					reason: `approval for tool "${exec.name}" was cancelled`
				},
				approvalCancelled: true
			};
			case "unavailable": return {
				decision: {
					kind: "deny",
					reason: `tool "${exec.name}" requires approval, but no approval channel is available`
				},
				approvalCancelled: false
			};
			default: return assertNever(outcome, "ApprovalOutcome");
		}
	}
	/**
	* Run the `tools/post-execute` waterfall over a dispatched `result` and apply
	* its {@link PostToolDecision}: `accept` keeps the call successful (replacing
	* `content` when given), `block` turns it into an `isError` whose content is
	* the corrective `feedback`. Either decision may attach `additionalContexts`,
	* which are ferried on the returned result for the loop's active-batch FIFO.
	* Context deferred by the tool body survives an accepted result but is
	* discarded when the outer call is blocked; a block exposes only context the
	* blocking decision explicitly supplied.
	* Runs inside `execute`'s outer try/catch (a throwing listener → isError).
	*/
	async postExecute(exec, result) {
		const decision = await this.ctx.waterfall(scopeTarget(this, exec.agent), "tools/post-execute", exec, result, () => Promise.resolve({ kind: "accept" }));
		const decisionContexts = decision.additionalContexts ?? [];
		if (decision.kind === "block") {
			const message = failureMessageFromContent(decision.feedback);
			return this.markCanonical(exec, {
				content: decision.feedback,
				isError: true,
				error: { message },
				...decisionContexts.length > 0 ? { additionalContexts: decisionContexts } : {}
			});
		}
		if (Object.hasOwn(decision, "content") && Object.hasOwn(decision, "value")) throw new TypeError("tools/post-execute accept decision cannot replace both value and content");
		const additionalContexts = [...result.additionalContexts ?? [], ...decisionContexts];
		if (Object.hasOwn(decision, "value")) {
			if (result.isError) throw new TypeError("tools/post-execute cannot replace the value of a failed result");
			const tool = this.resolveExecution(exec.name, exec.agent, exec.parent !== void 0);
			if (tool === void 0) throw new ToolNotFoundError(exec.name);
			const replaced = this.createSuccessResult(exec, tool, decision.value);
			return this.markCanonical(exec, {
				...replaced,
				...additionalContexts.length > 0 ? { additionalContexts } : {}
			});
		}
		return this.markCanonical(exec, {
			...result,
			...decision.content !== void 0 ? { content: decision.content } : {},
			...additionalContexts.length > 0 ? { additionalContexts } : {}
		});
	}
	/** Registry-normalized results and the exact dispatch that validated each value. */
	canonicalResults = /* @__PURE__ */ new WeakMap();
	/** Mark one registry-normalized result as canonical only for its owning dispatch. */
	markCanonical(exec, result) {
		this.canonicalResults.set(result, exec.token);
		return result;
	}
	/** Snapshot, validate, render, and optionally project one successful body value. */
	createSuccessResult(exec, tool, candidate) {
		const detached = snapshotToolValue(tool.name, candidate);
		const violations = validateJsonSchemaValue(tool.output.schema, detached, "value");
		if (violations.length > 0) throw new ToolOutputError(tool.name, violations);
		const value = deepFreeze(detached);
		let rendered;
		try {
			rendered = tool.output.render(exec.arguments, value);
		} catch (error) {
			throw projectionError(tool.name, "render", error);
		}
		const content = snapshotProjection(tool.name, "render", rendered);
		let meta;
		if (exec.parent === void 0 && tool.output.presentationMeta !== void 0) {
			let projected;
			try {
				projected = tool.output.presentationMeta(exec.arguments, value);
			} catch (error) {
				throw projectionError(tool.name, "presentationMeta", error);
			}
			meta = snapshotProjection(tool.name, "presentationMeta", projected);
		}
		const concludesTurn = this.concludingExecutions.has(exec);
		return this.markCanonical(exec, this.materializeFinalResult({
			isError: false,
			value,
			content,
			...meta !== void 0 ? { meta } : {},
			...concludesTurn ? { concludesTurn: true } : {}
		}));
	}
	/** Normalize an around-dispatch wrapper's authored result through the owning output contract. */
	normalizeDispatchResult(exec, result) {
		if (this.canonicalResults.get(result) === exec.token) return result;
		if (result.isError) return this.markCanonical(exec, {
			isError: true,
			error: result.error,
			content: result.content,
			...result.meta !== void 0 ? { meta: result.meta } : {},
			...result.additionalContexts !== void 0 ? { additionalContexts: result.additionalContexts } : {}
		});
		const tool = this.resolveExecution(exec.name, exec.agent, exec.parent !== void 0);
		if (tool === void 0) throw new ToolNotFoundError(exec.name);
		const normalized = this.createSuccessResult(exec, tool, result.value);
		return this.markCanonical(exec, {
			...normalized,
			...result.additionalContexts !== void 0 ? { additionalContexts: result.additionalContexts } : {}
		});
	}
	/** Materialize the authoritative commit outcome once, immediately before `tools/result`. */
	materializeFinalResult(result) {
		const presentation = {
			content: result.content,
			...result.meta !== void 0 ? { meta: result.meta } : {},
			...result.additionalContexts !== void 0 ? { additionalContexts: result.additionalContexts } : {}
		};
		if (result.isError) return materializePresentation({
			isError: true,
			error: result.error,
			...presentation
		});
		return deepFreeze({
			...materializePresentation({
				isError: false,
				...presentation,
				...result.concludesTurn === true ? { concludesTurn: true } : {}
			}),
			value: result.value
		});
	}
};
/** Mint a same-process correlation token whose identity is its value. */
function createExecutionToken() {
	return Symbol("dsh.tool.execution");
}
function toolErrorResult(error) {
	const info = errorInfo(error);
	const message = errorMessage(error);
	return {
		content: [{
			type: "text",
			text: `Error: ${message}`
		}],
		isError: true,
		error: {
			message,
			...info ? { info } : {}
		}
	};
}
/** Read live abort state across an await without treating it as synchronously immutable. */
function isAborted(signal) {
	return signal.aborted;
}
/**
* Fuse caller and wrapper cancellation without nesting `AbortSignal.any`.
* Keeping the relay dispatch-scoped also removes listeners when work settles.
*/
function fuseToolSignals(caller, wrapper) {
	if (caller === wrapper) return {
		signal: caller,
		dispose() {}
	};
	const controller = new AbortController();
	let listening = false;
	const dispose = () => {
		if (!listening) return;
		listening = false;
		caller.removeEventListener("abort", abortFromCaller);
		wrapper.removeEventListener("abort", abortFromWrapper);
	};
	const abortFrom = (source) => {
		const reason = source.reason;
		controller.abort(reason);
		dispose();
	};
	const abortFromCaller = () => {
		abortFrom(caller);
	};
	const abortFromWrapper = () => {
		abortFrom(wrapper);
	};
	if (wrapper.aborted) abortFromWrapper();
	else if (caller.aborted) abortFromCaller();
	else {
		listening = true;
		caller.addEventListener("abort", abortFromCaller, { once: true });
		wrapper.addEventListener("abort", abortFromWrapper, { once: true });
	}
	return {
		signal: controller.signal,
		dispose
	};
}
/** Canonical result when cancellation supersedes success after body invocation. */
function toolAbortedResult(prior) {
	const additionalContexts = prior?.additionalContexts ?? [];
	return {
		content: [{
			type: "text",
			text: "Error: tool call aborted"
		}],
		isError: true,
		error: {
			message: "tool call aborted",
			info: {
				name: "AbortError",
				code: TOOL_ABORTED
			}
		},
		...additionalContexts.length > 0 ? { additionalContexts } : {}
	};
}
/** Canonical result when cancellation prevents tool body invocation. */
function toolAbortedBeforeDispatchResult(prior) {
	const additionalContexts = prior?.additionalContexts ?? [];
	return {
		content: [{
			type: "text",
			text: "Error: tool call aborted before dispatch"
		}],
		isError: true,
		error: {
			message: "tool call aborted before dispatch",
			info: {
				name: "AbortError",
				code: TOOL_ABORTED_BEFORE_DISPATCH
			}
		},
		...additionalContexts.length > 0 ? { additionalContexts } : {}
	};
}

//#endregion
//#region src/tools/pipeline-watch.ts
/**

* Pipeline watch: polls pipeline status and follows up on completion/failure.

*

* Called automatically after gitlab_mr_create, or manually via gitlab_pipeline_watch.

*/
const POLL_INTERVAL_MS = 3e4;
const MAX_DURATION_MS = 30 * 60 * 1e3;
/**

* Start a pipeline watch for a given project + branch.

*

* Polls every 30 seconds until:

* - Pipeline succeeds → followup success message + stop

* - Pipeline fails/cancels → followup failure message (with failed jobs) + stop

* - Max duration exceeded → followup timeout + stop

* - Plugin unload → cleanup via ctx.effect

*/
function startPipelineWatch(ctx, gitlab, project, branch) {
	const resolvedProject = project ?? gitlab.listProjects()[0];
	ctx.effect(() => {
		const startTime = Date.now();
		let stopped = false;
		const timer = setInterval(async () => {
			if (stopped) return;
			try {
				const pipeline = await gitlab.getLatestPipelineByRef(resolvedProject, branch);
				if (!pipeline) return;
				if (pipeline.status === "success") {
					stopped = true;
					ctx.followup?.(`✅ Pipeline #${pipeline.id} 在 ${branch} 成功: ${pipeline.webUrl}`);
					clearInterval(timer);
				} else if (pipeline.status === "failed" || pipeline.status === "canceled") {
					stopped = true;
					const jobs = await gitlab.listPipelineJobs(resolvedProject, pipeline.id);
					const failed = jobs.filter((j) => j.status === "failed").map((j) => j.name);
					ctx.followup?.(`⚠️ Pipeline #${pipeline.id} 在 ${branch} ${pipeline.status}! 失败: ${failed.join(", ") || "N/A"}\n${pipeline.webUrl}`);
					clearInterval(timer);
				} else if (Date.now() > startTime + MAX_DURATION_MS) {
					stopped = true;
					ctx.followup?.(`⏰ Pipeline watch (${branch}) 超时停止`);
					clearInterval(timer);
				}
			} catch (err) {
				if (isRecoverable(err)) return;
				stopped = true;
				ctx.followup?.(`⚠️ Pipeline watch (${branch}) 中断: ${err.message}`);
				clearInterval(timer);
			}
		}, POLL_INTERVAL_MS);
		return () => {
			stopped = true;
			clearInterval(timer);
		};
	}, "dsh-devops:pipeline-watch");
}
/**

* Check if an error is a transient/recoverable one (network, timeout, 5xx).

*/
function isRecoverable(err) {
	if (!err) return false;
	const status = err.status ?? err.code;
	if (typeof status === "number" && status >= 500 && status < 600) return true;
	if (err.code === "ECONNRESET" || err.code === "ETIMEDOUT" || err.code === "ENOTFOUND") return true;
	if (err.message?.includes("fetch failed")) return true;
	return false;
}

//#endregion
//#region src/tools/gitlab.ts
/** Render an arbitrary value as a formatted JSON text block. */
function renderObject$1(value) {
	return [{
		type: "text",
		text: JSON.stringify(value, null, 2)
	}];
}
/**

* Register GitLab tools with the DSH context.

* @param ctx - DSH context (has ctx.tools?.register or ctx.tool?.register)

* @param gitlab - GitLabService instance

*/
function registerGitLabTools(ctx, gitlab) {
	const register = (ctx.tools?.register ?? ctx.tool?.register)?.bind(ctx.tools ?? ctx.tool);
	if (!register) {
		ctx.log?.warn?.("[dsh-devops] ctx.tools not available, skipping GitLab tool registration");
		return;
	}
	register(cleanTool(defineTool({
		name: "gitlab_mr_create",
		description: "Create a GitLab merge request. Auto-starts pipeline monitoring unless watch_pipeline is false.",
		parameters: {
			project: {
				type: "string",
				description: "Project ID (optional, uses default)"
			},
			source_branch: {
				type: "string",
				description: "Source branch name",
				required: true
			},
			target_branch: {
				type: "string",
				description: "Target branch name",
				required: true
			},
			title: {
				type: "string",
				description: "MR title",
				required: true
			},
			description: {
				type: "string",
				description: "MR description (markdown)"
			},
			reviewers: {
				type: "array",
				description: "Reviewer usernames (optional)",
				items: { type: "string" }
			},
			watch_pipeline: {
				type: "boolean",
				description: "Auto-start pipeline watch (default: true)"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject$1(value)
		},
		async execute(args) {
			const project = args.project || void 0;
			const mr = await gitlab.createMR(project, args.source_branch, args.target_branch, args.title, args.description);
			let watchMsg = "";
			if (args.watch_pipeline !== false) {
				startPipelineWatch(ctx, gitlab, project, args.source_branch);
				watchMsg = `📡 Pipeline monitoring started for ${args.source_branch}`;
			}
			return {
				iid: mr.iid,
				title: mr.title,
				state: mr.state,
				web_url: mr.webUrl,
				watch: watchMsg
			};
		}
	})));
	register(cleanTool(defineTool({
		name: "gitlab_mr_review",
		description: "Review a GitLab merge request: approve, request changes, or add a comment.",
		parameters: {
			project: {
				type: "string",
				description: "Project ID (optional, uses default)"
			},
			mr_iid: {
				type: "number",
				description: "MR iid (the number after !)",
				required: true
			},
			action: {
				type: "string",
				description: "Review action",
				enum: [
					"approve",
					"request_changes",
					"comment"
				],
				required: true
			},
			comment: {
				type: "string",
				description: "Review comment"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject$1(value)
		},
		async execute(args) {
			const project = args.project || void 0;
			const mrIid = args.mr_iid;
			const action = args.action;
			const comment = args.comment;
			switch (action) {
				case "approve":
					await gitlab.approveMR(project, mrIid);
					return {
						ok: true,
						action: "approved",
						mr_iid: mrIid
					};
				case "request_changes":
					await gitlab.requestChanges(project, mrIid, comment ?? "");
					return {
						ok: true,
						action: "changes_requested",
						mr_iid: mrIid
					};
				case "comment":
					await gitlab.commentMR(project, mrIid, comment ?? "");
					return {
						ok: true,
						action: "commented",
						mr_iid: mrIid
					};
				default: throw new Error(`Unknown review action: ${action}`);
			}
		}
	})));
	register(cleanTool(defineTool({
		name: "gitlab_mr_list",
		description: "List merge requests for a project.",
		parameters: {
			project: {
				type: "string",
				description: "Project ID (optional, uses default)"
			},
			state: {
				type: "string",
				description: "MR state filter (informational, currently defaults to opened)",
				enum: [
					"opened",
					"closed",
					"merged",
					"all"
				]
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject$1(value)
		},
		async execute(args) {
			const project = args.project || void 0;
			const mrs = await gitlab.listMRs(project);
			return {
				count: mrs.length,
				merge_requests: mrs.map((mr) => ({
					iid: mr.iid,
					title: mr.title,
					state: mr.state,
					source_branch: mr.sourceBranch,
					target_branch: mr.targetBranch,
					web_url: mr.webUrl,
					approvals: mr.approvals
				}))
			};
		}
	})));
	register(cleanTool(defineTool({
		name: "gitlab_tag_create",
		description: "Create a git tag in a GitLab project.",
		parameters: {
			project: {
				type: "string",
				description: "Project ID (optional, uses default)"
			},
			name: {
				type: "string",
				description: "Tag name (e.g., v1.0.0)",
				required: true
			},
			ref: {
				type: "string",
				description: "Branch/commit to tag (defaults to default branch)"
			},
			message: {
				type: "string",
				description: "Annotated tag message"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject$1(value)
		},
		async execute(args) {
			const project = args.project || void 0;
			const tag = await gitlab.createTag(project, args.name, args.ref, args.message);
			return {
				name: tag.name,
				commit_id: tag.commitId,
				message: tag.message
			};
		}
	})));
	register(cleanTool(defineTool({
		name: "gitlab_pipeline_status",
		description: "Get the latest pipeline status for a branch.",
		parameters: {
			project: {
				type: "string",
				description: "Project ID (optional, uses default)"
			},
			ref: {
				type: "string",
				description: "Branch/tag to check (defaults to default branch)"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject$1(value)
		},
		async execute(args) {
			const project = args.project || void 0;
			const ref = args.ref;
			const pipeline = await gitlab.getLatestPipelineByRef(project, ref);
			if (!pipeline) return {
				status: "none",
				message: `No pipeline found for ref "${ref ?? "default"}"`
			};
			return {
				id: pipeline.id,
				status: pipeline.status,
				ref: pipeline.ref,
				sha: pipeline.sha,
				web_url: pipeline.webUrl,
				created_at: pipeline.createdAt,
				finished_at: pipeline.finishedAt
			};
		}
	})));
	register(cleanTool(defineTool({
		name: "gitlab_pipeline_jobs",
		description: "List all jobs in a pipeline.",
		parameters: {
			project: {
				type: "string",
				description: "Project ID (optional, uses default)"
			},
			pipeline_id: {
				type: "number",
				description: "Pipeline ID",
				required: true
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject$1(value)
		},
		async execute(args) {
			const project = args.project || void 0;
			const jobs = await gitlab.listPipelineJobs(project, args.pipeline_id);
			return {
				pipeline_id: args.pipeline_id,
				count: jobs.length,
				jobs: jobs.map((j) => ({
					id: j.id,
					name: j.name,
					stage: j.stage,
					status: j.status,
					duration_sec: j.duration
				}))
			};
		}
	})));
	register(cleanTool(defineTool({
		name: "gitlab_pipeline_watch",
		description: "Start, stop, or check pipeline monitoring for a branch.",
		parameters: {
			project: {
				type: "string",
				description: "Project ID (optional, uses default)"
			},
			action: {
				type: "string",
				description: "Watch action",
				enum: ["start", "status"],
				required: true
			},
			branch: {
				type: "string",
				description: "Branch to monitor",
				required: true
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject$1(value)
		},
		async execute(args) {
			const project = args.project || void 0;
			const branch = args.branch;
			switch (args.action) {
				case "start":
					startPipelineWatch(ctx, gitlab, project, branch);
					return {
						ok: true,
						message: `📡 Watching pipeline for branch: ${branch}`
					};
				case "status": return {
					ok: true,
					message: `⏳ Pipeline watch for ${branch} is active (polling every 30s)`
				};
				default: throw new Error(`Unknown watch action: ${args.action}`);
			}
		}
	})));
}

//#endregion
//#region src/tools/k8s.ts
/** Render an arbitrary value as a formatted JSON text block. */
function renderObject(value) {
	return [{
		type: "text",
		text: JSON.stringify(value, null, 2)
	}];
}
/**

* Register K8s tools with the DSH context.

* @param ctx - DSH context

* @param k8s - K8sService instance

*/
function registerK8sTools(ctx, k8s) {
	const register = (ctx.tools?.register ?? ctx.tool?.register)?.bind(ctx.tools ?? ctx.tool);
	if (!register) {
		ctx.log?.warn?.("[dsh-devops] ctx.tools not available, skipping K8s tool registration");
		return;
	}
	register(cleanTool(defineTool({
		name: "k8s_deployment_status",
		description: "Get deployment rolling status (replicas, conditions). Returns all deployments if no name given.",
		parameters: {
			cluster: {
				type: "string",
				description: "Cluster ID (optional, uses default)"
			},
			namespace: {
				type: "string",
				description: "Namespace (uses cluster default)"
			},
			name: {
				type: "string",
				description: "Specific deployment name (optional, lists all if omitted)"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject(value)
		},
		async execute(args) {
			const cluster = args.cluster || void 0;
			const ns = args.namespace || k8s.getDefaultNamespace(cluster);
			if (args.name) {
				const dep = await k8s.getDeploymentStatus(cluster, ns, args.name);
				return formatDeployment(dep);
			}
			const deps = await k8s.getDeploymentStatusList(cluster, ns);
			return {
				namespace: ns,
				count: deps.length,
				deployments: deps.map(formatDeployment)
			};
		}
	})));
	register(cleanTool(defineTool({
		name: "k8s_pods",
		description: "List pods in a namespace with phase and restart counts.",
		parameters: {
			cluster: {
				type: "string",
				description: "Cluster ID (optional, uses default)"
			},
			namespace: {
				type: "string",
				description: "Namespace (uses cluster default)"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject(value)
		},
		async execute(args) {
			const cluster = args.cluster || void 0;
			const ns = args.namespace || k8s.getDefaultNamespace(cluster);
			const pods = await k8s.getPodList(cluster, ns);
			return {
				namespace: ns,
				count: pods.length,
				pods: pods.map((p) => ({
					name: p.name,
					phase: p.phase,
					restart_count: p.restartCount,
					node: p.nodeName,
					containers: p.containers.map((c) => ({
						name: c.name,
						ready: c.ready,
						restarts: c.restartCount
					}))
				}))
			};
		}
	})));
	register(cleanTool(defineTool({
		name: "k8s_events",
		description: "Get recent Kubernetes events in a namespace.",
		parameters: {
			cluster: {
				type: "string",
				description: "Cluster ID (optional, uses default)"
			},
			namespace: {
				type: "string",
				description: "Namespace (uses cluster default)"
			},
			limit: {
				type: "number",
				description: "Max events to return (default: 20)"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject(value)
		},
		async execute(args) {
			const cluster = args.cluster || void 0;
			const ns = args.namespace || k8s.getDefaultNamespace(cluster);
			const limit = args.limit || 20;
			const events = await k8s.getEvents(cluster, ns, limit);
			return {
				namespace: ns,
				count: events.length,
				events: events.map((e) => ({
					type: e.type,
					reason: e.reason,
					message: e.message,
					object: e.object,
					count: e.count,
					last_timestamp: e.lastTimestamp
				}))
			};
		}
	})));
	register(cleanTool(defineTool({
		name: "k8s_logs",
		description: "Get pod logs (tail last N lines).",
		parameters: {
			cluster: {
				type: "string",
				description: "Cluster ID (optional, uses default)"
			},
			namespace: {
				type: "string",
				description: "Namespace (uses cluster default)"
			},
			pod: {
				type: "string",
				description: "Pod name",
				required: true
			},
			container: {
				type: "string",
				description: "Container name (optional, first container if omitted)"
			},
			tail_lines: {
				type: "number",
				description: "Number of lines from the end (default: 100)"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => renderObject(value)
		},
		async execute(args) {
			const cluster = args.cluster || void 0;
			const ns = args.namespace || k8s.getDefaultNamespace(cluster);
			const pod = args.pod;
			const container = args.container;
			const tailLines = args.tail_lines || 100;
			const logs = await k8s.getPodLogs(cluster, ns, pod, container, tailLines);
			return {
				pod,
				namespace: ns,
				tail_lines: tailLines,
				logs
			};
		}
	})));
}
function formatDeployment(dep) {
	return {
		name: dep.name,
		namespace: dep.namespace,
		ready: `${dep.readyReplicas}/${dep.desiredReplicas}`,
		available: dep.availableReplicas,
		updated: dep.updatedReplicas,
		conditions: dep.conditions.map((c) => ({
			type: c.type,
			status: c.status,
			reason: c.reason,
			message: c.message
		}))
	};
}

//#endregion
//#region src/tools/index.ts
/**

* Strip `undefined` fields (and functions) from a tool result. The host

* validates tool output as lossless JSON, which rejects `undefined` values

* that legitimately occur when upstream API objects lack optional fields

* (e.g. a pipeline without `finished_at`).

*/
function pruneUndefined(value) {
	if (value === void 0 || typeof value === "function") return null;
	if (Array.isArray(value)) return value.map(pruneUndefined);
	if (value && typeof value === "object") {
		const out = {};
		for (const [k, v] of Object.entries(value)) out[k] = pruneUndefined(v);
		return out;
	}
	return value;
}
/** Wrap a tool definition so every execute() result is JSON-lossless-safe. */
function cleanTool(tool) {
	const execute = tool.execute.bind(tool);
	tool.execute = async (args) => pruneUndefined(await execute(args));
	return tool;
}
function registerTools(ctx, services) {
	if (services.gitlab) registerGitLabTools(ctx, services.gitlab);
	if (services.k8s) registerK8sTools(ctx, services.k8s);
}

//#endregion
//#region src/webhook/handler.ts
/**

* Safely read a nested property from an unknown object by dot-path.

* Returns undefined when any segment in the path is missing or non-object.

*/
function safeGet(obj, path) {
	if (obj == null || typeof obj !== "object") return void 0;
	let current = obj;
	for (const key of path.split(".")) {
		if (current == null || typeof current !== "object") return void 0;
		current = current[key];
	}
	return current;
}
/** Coerce an unknown value to a display string; empty string for null/undefined. */
function str(value) {
	return value == null ? "" : String(value);
}
const MR_ACTIONS = new Set([
	"open",
	"update",
	"close",
	"merge",
	"approval",
	"unapproval"
]);
/**

* Parse the X-Gitlab-Event header into a WebhookEvent.

*

* Returns null for:

*  - "Merge Request Hook" (deferred — requires payload inspection via

*    {@link parseMergeRequestEvent})

*  - Any unknown or missing header

*/
function parseEvent(header) {
	switch (header) {
		case "Merge Request Hook": return null;
		case "Pipeline Hook": return {
			type: "pipeline",
			action: "created"
		};
		case "Tag Push Hook": return { type: "tag_push" };
		case "Note Hook": return {
			type: "note",
			action: "create"
		};
		default: return null;
	}
}
/**

* Inspect a Merge Request Hook payload and return the corresponding WebhookEvent.

*

* Reads `payload.object_attributes.action` and maps it to one of the known

* merge-request actions. Returns null when the action is missing or unrecognized.

*/
function parseMergeRequestEvent(payload) {
	if (payload == null || typeof payload !== "object") return null;
	const action = payload.object_attributes?.action;
	if (typeof action !== "string" || !MR_ACTIONS.has(action)) return null;
	const mrAction = action;
	return {
		type: "merge_request",
		action: mrAction
	};
}
/**

* Generate a human-readable follow-up message for a parsed WebhookEvent.

*

* Returns null for "silent" events that should not produce a notification:

*  - merge_request open / update

*  - pipeline created / skipped

*/
function toFollowupMessage(event, payload) {
	switch (event.type) {
		case "merge_request": {
			const iid = str(safeGet(payload, "object_attributes.iid"));
			const title = str(safeGet(payload, "object_attributes.title"));
			const target = str(safeGet(payload, "object_attributes.target_branch"));
			switch (event.action) {
				case "merge": return `✅ MR !${iid} "${title}" 已合并到 ${target}`;
				case "approval": return `👍 MR !${iid} 获得审批`;
				case "unapproval": return `👎 MR !${iid} 审批被撤回`;
				case "close": return `🔒 MR !${iid} "${title}" 已关闭`;
				default: return null;
			}
		}
		case "pipeline": {
			const id = str(safeGet(payload, "object_attributes.id"));
			const ref = str(safeGet(payload, "object_attributes.ref"));
			const webUrl = str(safeGet(payload, "object_attributes.web_url"));
			switch (event.action) {
				case "success": return `✅ Pipeline #${id} 在 ${ref} 成功`;
				case "failed": return `⚠️ Pipeline #${id} 在 ${ref} 失败! ${webUrl}`;
				case "canceled": return `🚫 Pipeline #${id} 被取消`;
				default: return null;
			}
		}
		case "tag_push": {
			const ref = str(safeGet(payload, "ref"));
			return `🏷️ 新 Tag: ${ref}`;
		}
		case "note": {
			const mrId = str(safeGet(payload, "merge_request.iid")) || str(safeGet(payload, "object_attributes.merge_request_id"));
			const note = str(safeGet(payload, "object_attributes.note"));
			const truncated = note.length > 200 ? `${note.slice(0, 200)}…` : note;
			return `💬 MR !${mrId} 新评论: ${truncated}`;
		}
	}
}
/**

* Normalise the X-Gitlab-Event header value into a short event-type name

* suitable for matching against `config.quietEvents`.

*

* Known mappings:

*   "Merge Request Hook" → "merge_request"

*   "Pipeline Hook"      → "pipeline"

*   "Tag Push Hook"      → "tag_push"

*   "Note Hook"          → "note"

*   "Push Hook"          → "push"

*   "Issue Hook"         → "issue"

*

* Unknown headers are normalised by lowercasing, stripping the trailing

* " hook", and replacing spaces with underscores.

*/
function getEventType(header) {
	if (!header) return "unknown";
	const known = {
		"Merge Request Hook": "merge_request",
		"Pipeline Hook": "pipeline",
		"Tag Push Hook": "tag_push",
		"Note Hook": "note",
		"Push Hook": "push",
		"Issue Hook": "issue"
	};
	if (known[header] !== void 0) return known[header];
	return header.toLowerCase().replace(/\s*hook\s*$/, "").replace(/\s+/g, "_");
}

//#endregion
//#region src/webhook/index.ts
/**

* Read a header value from an untyped req object, trying both the original

* case and the lower-case form (Node.js normalises to lower-case, but some

* frameworks preserve the original case).

*/
function getHeader(req, name$1) {
	const headers = req?.headers ?? {};
	if (headers[name$1] != null) return String(headers[name$1]);
	const lower = name$1.toLowerCase();
	if (headers[lower] != null) return String(headers[lower]);
	return void 0;
}
/**

* Attempt to parse the request body as JSON.

* Handles both pre-parsed objects (some frameworks) and raw strings.

*/
function parseBody(req) {
	const body = req?.body;
	if (body == null) return {};
	if (typeof body === "object") return body;
	if (typeof body === "string") try {
		return JSON.parse(body);
	} catch {
		return {};
	}
	return {};
}
/**

* Check whether the incoming request passes the project-path filter.

* Returns true when the filter is not configured or the project matches.

*/
function matchesProjectFilter(payload, projectPaths) {
	if (!projectPaths || projectPaths.length === 0) return true;
	const p = payload;
	const projectPath = p?.project?.path_with_namespace ?? p?.project?.path ?? "";
	if (!projectPath) return true;
	return projectPaths.some((pp) => projectPath === pp || projectPath.endsWith(`/${pp}`));
}
/**

* Core webhook request handler shared by both registration paths.

* Called for every incoming webhook POST after the framework has dispatched it.

*/
function handleWebhookRequest(req, res, ctx, config) {
	try {
		const token = getHeader(req, "X-Gitlab-Token") ?? "";
		if (token !== config.secret) {
			res.writeHead?.(401, { "Content-Type": "application/json" });
			res.end?.(JSON.stringify({ error: "Unauthorized" }));
			return;
		}
		const rawEventHeader = getHeader(req, "X-Gitlab-Event");
		const eventTypeName = getEventType(rawEventHeader);
		if (config.quietEvents?.includes(eventTypeName)) {
			res.writeHead?.(200);
			res.end?.();
			return;
		}
		const payload = parseBody(req);
		if (!matchesProjectFilter(payload, config.projectPaths)) {
			res.writeHead?.(200);
			res.end?.();
			return;
		}
		let event = parseEvent(rawEventHeader);
		if (rawEventHeader === "Merge Request Hook") event = parseMergeRequestEvent(payload);
		if (event == null) {
			res.writeHead?.(200);
			res.end?.();
			return;
		}
		const message = toFollowupMessage(event, payload);
		if (message != null) ctx.followup?.(`[GitLab] ${message}`);
		res.writeHead?.(200);
		res.end?.();
	} catch (err) {
		ctx.log?.error("[dsh-devops:webhook] Error handling webhook request", err);
		res.writeHead?.(500);
		res.end?.();
	}
}
/**

* Register the GitLab webhook handler on the DSH context.

*

* Registration strategy (first match wins):

*  1. `ctx.webhook.register()`  — preferred; passes the secret so the

*     framework can verify it before invoking the handler.

*  2. `ctx.http.register()`     — fallback; the handler performs its own

*     secret check on every request.

*  3. Neither available         — logs a warning and returns silently.

*

* The handler:

*  - Verifies `X-Gitlab-Token` matches `config.secret` (401 on mismatch)

*  - Normalises `X-Gitlab-Event` into an event type name

*  - Silently drops events listed in `config.quietEvents`

*  - Filters by `config.projectPaths` when set

*  - Generates a follow-up message via `toFollowupMessage` and calls

*    `ctx.followup` with a `[GitLab]`-prefixed string

*

* Lifecycle: registration is wrapped in `ctx.effect` so the DSH session

* teardown can cancel the endpoint if needed.

*/
function registerWebhook(ctx, config) {
	const WEBHOOK_PATH = "/gitlab-webhook";
	ctx.effect(() => {
		if (ctx.webhook?.register) {
			const endpoint = ctx.webhook.register({
				path: WEBHOOK_PATH,
				method: "POST",
				secret: config.secret
			});
			endpoint.onEvent((req, res) => {
				handleWebhookRequest(req, res, ctx, config);
			});
			ctx.log?.warn(`[dsh-devops:webhook] Registered webhook via ctx.webhook at ${WEBHOOK_PATH}`);
			return;
		}
		if (ctx.http?.register) {
			const endpoint = ctx.http.register({
				path: WEBHOOK_PATH,
				method: "POST"
			});
			endpoint.onEvent((req, res) => {
				handleWebhookRequest(req, res, ctx, config);
			});
			ctx.log?.warn(`[dsh-devops:webhook] Registered webhook via ctx.http fallback at ${WEBHOOK_PATH}`);
			return;
		}
		ctx.log?.warn("[dsh-devops:webhook] Neither ctx.webhook nor ctx.http is available; skipping webhook registration. Webhook notifications will not work.");
	}, "webhook-register");
}

//#endregion
//#region src/monitor/throttle.ts
/**

* Alert throttling — suppresses duplicate alerts within a cooldown window.

*/
const lastFired = new Map();
/**

* Returns true if the alert for `key` should be suppressed (within cooldown).

* Records the fire time if it should not be suppressed.

*/
function throttled(key, cooldownSec) {
	const now = Date.now();
	const last = lastFired.get(key);
	if (last !== void 0 && now - last < cooldownSec * 1e3) return true;
	lastFired.set(key, now);
	return false;
}
/**

* Clears all throttle entries. Called on plugin unload.

*/
function clearThrottle() {
	lastFired.clear();
}

//#endregion
//#region src/monitor/rules.ts
async function checkPipelineAlerts(ctx, gitlab, rules, config) {
	const cooldown = config.cooldownSec ?? 300;
	const projects = gitlab.listProjects();
	for (const project of projects) for (const rule of rules) {
		if (rule.projects && !rule.projects.includes(project)) continue;
		const branches = rule.branches ?? ["HEAD"];
		for (const branch of branches) {
			const pipeline = await gitlab.getLatestPipelineByRef(project, branch);
			if (!pipeline) continue;
			if (!matchesPipelineTrigger(pipeline.status, rule.trigger)) continue;
			const key = `pipeline:${project}:${pipeline.ref}:${pipeline.id}:${rule.trigger}`;
			if (throttled(key, cooldown)) continue;
			const message = await formatPipelineAlert(rule, project, pipeline, gitlab);
			ctx.followup?.(message);
		}
	}
}
function matchesPipelineTrigger(status, trigger) {
	return status === trigger;
}
async function formatPipelineAlert(rule, project, pipeline, gitlab) {
	const lines = [];
	lines.push(`🔔 Pipeline ${rule.trigger}: ${project} @ ${pipeline.ref}`);
	lines.push(`   Pipeline #${pipeline.id} | ${pipeline.status}`);
	if (pipeline.webUrl) lines.push(`   ${pipeline.webUrl}`);
	if (rule.includeFailedJobs) try {
		const jobs = await gitlab.listPipelineJobs(project, pipeline.id);
		const failed = jobs.filter((j) => j.status === "failed");
		if (failed.length > 0) {
			lines.push("   Failed jobs:");
			for (const job of failed) lines.push(`     - ${job.name} (${job.status})`);
		}
	} catch {}
	if (rule.message) lines.push(`   ${rule.message}`);
	return lines.join("\n");
}
async function checkPodAlerts(ctx, k8s, rules, config) {
	const cooldown = config.cooldownSec ?? 300;
	const clusters = k8s.listClusters();
	for (const cluster of clusters) for (const rule of rules) {
		if (rule.clusters && !rule.clusters.includes(cluster)) continue;
		const namespaces = rule.namespaces ?? [k8s.getDefaultNamespace(cluster)];
		for (const namespace of namespaces) {
			const pods = await k8s.getPodList(cluster, namespace);
			for (const pod of pods) await evaluatePodRule(ctx, k8s, rule, config, cluster, namespace, pod, cooldown);
		}
	}
}
async function evaluatePodRule(ctx, k8s, rule, config, cluster, namespace, pod, cooldown) {
	let triggered = false;
	let detail = "";
	switch (rule.trigger) {
		case "crash":
			if (pod.phase === "Failed") {
				triggered = true;
				detail = "Pod crashed (phase: Failed)";
			}
			break;
		case "restart": {
			const threshold = rule.restartThreshold ?? 3;
			if (pod.restartCount > threshold) {
				triggered = true;
				detail = `Pod restarts exceeded threshold (${pod.restartCount} > ${threshold})`;
			}
			break;
		}
		case "pending_stuck": {
			const timeoutSec = rule.pendingTimeoutSec ?? 300;
			if (pod.phase === "Pending") {
				const startMs = pod.startTime ? new Date(pod.startTime).getTime() : void 0;
				if (startMs !== void 0) {
					const pendingMs = Date.now() - startMs;
					if (pendingMs > timeoutSec * 1e3) {
						triggered = true;
						detail = `Pod stuck in Pending for ${Math.round(pendingMs / 1e3)}s (timeout: ${timeoutSec}s)`;
					}
				}
			}
			break;
		}
	}
	if (!triggered) return;
	const key = `pod:${cluster}:${namespace}:${pod.name}:${rule.trigger}`;
	if (throttled(key, cooldown)) return;
	const message = formatPodAlert(rule, cluster, namespace, pod, detail);
	ctx.followup?.(message);
}
function formatPodAlert(rule, cluster, namespace, pod, detail) {
	const lines = [];
	lines.push(`🐳 Pod alert [${rule.trigger}]: ${pod.name} in ${cluster}/${namespace}`);
	lines.push(`   ${detail}`);
	lines.push(`   Phase: ${pod.phase} | Restarts: ${pod.restartCount}`);
	if (rule.message) lines.push(`   ${rule.message}`);
	return lines.join("\n");
}

//#endregion
//#region src/monitor/index.ts
/**

* Starts the monitor polling loop.

*

* @param ctx       Plugin context (effect, followup, log)

* @param config    Monitor configuration

* @param services  Registered services: { gitlab?, k8s? }

*/
function startMonitor(ctx, config, services) {
	const intervalMs = (config.pollIntervalSec ?? 60) * 1e3;
	ctx.effect(() => {
		const timer = setInterval(async () => {
			try {
				if (config.pipeline?.length && services.gitlab) await checkPipelineAlerts(ctx, services.gitlab, config.pipeline, config);
				if (config.pod?.length && services.k8s) await checkPodAlerts(ctx, services.k8s, config.pod, config);
			} catch (err) {
				ctx.log?.error("[dsh-devops:monitor] tick error:", err?.message ?? err);
			}
		}, intervalMs);
		return () => {
			clearInterval(timer);
			clearThrottle();
		};
	}, "dsh-devops:monitor");
}

//#endregion
//#region src/api.ts
function writeJson(res, status, body) {
	res.writeHead(status, { "Content-Type": "application/json" });
	res.end(JSON.stringify(body));
}
function readBody(req) {
	if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
	if (req.readable === false || req.readable === void 0 && req._readableState?.readable === false) return Promise.resolve(req.body ?? {});
	return new Promise((resolve, reject) => {
		let data = "";
		let settled = false;
		const finish = (val) => {
			if (!settled) {
				settled = true;
				resolve(val);
			}
		};
		const fail = (err) => {
			if (!settled) {
				settled = true;
				reject(err);
			}
		};
		req.on("data", (chunk) => {
			data += chunk;
		});
		req.on("end", () => {
			try {
				finish(data ? JSON.parse(data) : {});
			} catch {
				finish({});
			}
		});
		req.on("error", fail);
		setTimeout(() => {
			if (!settled) try {
				finish(data ? JSON.parse(data) : {});
			} catch {
				finish({});
			}
		}, 1e3).unref();
	});
}
/** Check if the request is from localhost. */
function isLocalhost(req) {
	const addr = req.socket?.remoteAddress ?? "";
	return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}
/** Mask secret header values for logging. */
function maskHeaders(headers) {
	if (!headers) return "{}";
	try {
		const h = new Headers(headers);
		const out = {};
		h.forEach((v, k) => {
			out[k] = /token|authorization|key|cookie/i.test(k) ? v.slice(0, 6) + "***" : v;
		});
		return JSON.stringify(out);
	} catch {
		return "{}";
	}
}
/** Fetch with timeout via AbortController. Logs URL + request + response to devops.log.

*  When `tls` is given (a resolved kubeconfig context), the cluster CA is pinned

*  (or verification skipped on insecureSkipTlsVerify) — native fetch cannot do per-request CAs. */
async function fetchWithTimeout(url, init, ms = 5e3, tls) {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), ms);
	const method = (init.method ?? "GET").toUpperCase();
	const bodySnippet = init.body ? String(init.body).slice(0, 300) : "";
	writeLog("info", "API-REQ", `${method} ${url} | headers=${maskHeaders(init.headers)}${bodySnippet ? " | body=" + bodySnippet : ""}`);
	const started = Date.now();
	try {
		let res;
		if (tls?.caData || tls?.insecureSkipTlsVerify) res = await httpsGet(url, {
			headers: init.headers,
			signal: ctrl.signal,
			ca: tls.caData ? Buffer.from(tls.caData, "base64") : void 0,
			insecureSkipTlsVerify: tls.insecureSkipTlsVerify
		});
		else res = await fetch(url, {
			...init,
			signal: ctrl.signal
		});
		const text = await res.text();
		writeLog(res.ok ? "info" : "warn", "API-RES", `${res.status} ${method} ${url} | ${Date.now() - started}ms | ${text.slice(0, 800)}`);
		const bodyless = res.status === 204 || res.status === 304;
		return new Response(bodyless ? null : text, {
			status: res.status,
			statusText: res.statusText,
			headers: res.headers
		});
	} catch (err) {
		writeLog("error", "API-ERR", `${method} ${url} | ${Date.now() - started}ms | ${err.name === "AbortError" ? `timeout(${ms}ms)` : err.message ?? "unknown"}`);
		throw err;
	} finally {
		clearTimeout(timer);
	}
}
/** GET via node:https with an optional pinned CA (fetch cannot set a per-request CA). */
function httpsGet(url, opts) {
	return new Promise((resolve, reject) => {
		const u = new URL(url);
		const req = request({
			hostname: u.hostname,
			port: u.port || 443,
			path: `${u.pathname}${u.search}`,
			method: opts.method ?? "GET",
			headers: opts.body ? {
				...opts.headers,
				"Content-Length": Buffer.byteLength(opts.body)
			} : opts.headers,
			...opts.insecureSkipTlsVerify ? { rejectUnauthorized: false } : opts.ca ? {
				ca: opts.ca,
				rejectUnauthorized: true,
				checkServerIdentity: () => void 0
			} : {}
		}, (upstream) => {
			const chunks = [];
			upstream.on("data", (c) => chunks.push(c));
			upstream.on("end", () => {
				resolve(new Response(Buffer.concat(chunks).toString("utf8"), {
					status: upstream.statusCode ?? 0,
					statusText: upstream.statusMessage ?? ""
				}));
			});
		});
		req.on("error", reject);
		opts.signal?.addEventListener("abort", () => req.destroy(new Error("AbortError")));
		if (opts.body) req.write(opts.body);
		req.end();
	});
}
async function testGitLab(params) {
	const { baseUrl, token } = params;
	if (!baseUrl || !token) return {
		ok: false,
		message: "Missing required fields: baseUrl, token"
	};
	try {
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/user`;
		const res = await fetchWithTimeout(url, { headers: { "PRIVATE-TOKEN": token } });
		if (res.status === 401) return {
			ok: false,
			message: "Authentication failed (401) — token invalid or expired"
		};
		if (!res.ok) return {
			ok: false,
			message: `GitLab API error: ${res.status} ${res.statusText}`
		};
		const user = await res.json();
		return {
			ok: true,
			message: `Connected as ${user.username ?? user.name ?? "user"}`
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			message: "Connection timed out (5s)"
		};
		return {
			ok: false,
			message: `Network error: ${err.message}`
		};
	}
}
/** Fetch/search projects visible to the token. Optional `search` keyword for server-side filtering. */
async function gitlabProjects(params) {
	const { baseUrl, token, search } = params;
	if (!baseUrl || !token) return {
		ok: false,
		projects: [],
		message: "Missing baseUrl or token"
	};
	try {
		const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects?membership=true&per_page=100&order_by=last_activity_at&sort=desc${searchParam}`;
		const res = await fetchWithTimeout(url, { headers: { "PRIVATE-TOKEN": token } }, 2e4);
		if (!res.ok) return {
			ok: false,
			projects: [],
			message: `GitLab API error: ${res.status}`
		};
		const raw = await res.json();
		const projects = raw.map((p) => ({
			id: String(p.id),
			name: p.name,
			path: p.path_with_namespace,
			defaultBranch: p.default_branch
		}));
		return {
			ok: true,
			projects
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			projects: [],
			message: "Timed out"
		};
		return {
			ok: false,
			projects: [],
			message: err.message
		};
	}
}
async function gitlabBranches(params) {
	const { baseUrl, path, token, search } = params;
	if (!token) return {
		ok: false,
		branches: [],
		message: "Missing token"
	};
	try {
		const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(path)}/repository/branches?per_page=100${searchParam}`;
		const res = await fetchWithTimeout(url, { headers: { "PRIVATE-TOKEN": token } }, 12e3);
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			return {
				ok: false,
				branches: [],
				message: `GitLab API error: ${res.status}${detail ? " | " + detail.slice(0, 120) : ""}`
			};
		}
		const raw = await res.json();
		return {
			ok: true,
			branches: raw.map((b) => ({
				name: b.name,
				isDefault: b.default === true
			}))
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			branches: [],
			message: "Timed out"
		};
		return {
			ok: false,
			branches: [],
			message: err.message
		};
	}
}
/** Latest commit on a branch (for MR description auto-fill). */
async function gitlabLastCommit(params) {
	const { baseUrl, path, token, branch } = params;
	if (!token || !branch) return {
		ok: false,
		message: "Missing token or branch"
	};
	try {
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(path)}/repository/commits?ref_name=${encodeURIComponent(branch)}&per_page=1`;
		const res = await fetchWithTimeout(url, { headers: { "PRIVATE-TOKEN": token } }, 12e3);
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			return {
				ok: false,
				message: `GitLab API error: ${res.status}${detail ? " | " + detail.slice(0, 120) : ""}`
			};
		}
		const raw = await res.json();
		const c = raw[0];
		if (!c) return {
			ok: false,
			message: "分支上没有提交"
		};
		return {
			ok: true,
			shortId: c.short_id ?? "",
			title: c.title ?? "",
			message: (c.message ?? "").trim(),
			author: c.author_name ?? "",
			date: c.committed_date ?? ""
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			message: "Timed out"
		};
		return {
			ok: false,
			message: err.message
		};
	}
}
/** List project members (for the MR reviewer dropdown). */
async function gitlabMembers(params) {
	const { baseUrl, path, token, search } = params;
	if (!token) return {
		ok: false,
		members: [],
		message: "Missing token"
	};
	try {
		const searchParam = search ? `&query=${encodeURIComponent(search)}` : "";
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(path)}/members/all?per_page=100${searchParam}`;
		const res = await fetchWithTimeout(url, { headers: { "PRIVATE-TOKEN": token } }, 12e3);
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			return {
				ok: false,
				members: [],
				message: `GitLab API error: ${res.status}${detail ? " | " + detail.slice(0, 120) : ""}`
			};
		}
		const raw = await res.json();
		return {
			ok: true,
			members: raw.map((m) => ({
				username: m.username,
				name: m.name
			}))
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			members: [],
			message: "Timed out"
		};
		return {
			ok: false,
			members: [],
			message: err.message
		};
	}
}
async function testK8s(params) {
	const { kubeconfigPath, context } = params;
	if (!kubeconfigPath) return {
		ok: false,
		message: "Missing kubeconfigPath"
	};
	try {
		const kctx = parseKubeconfig(kubeconfigPath, context);
		const res = await fetchWithTimeout(`${kctx.server}/version`, { headers: {
			Authorization: `Bearer ${kctx.token}`,
			Accept: "application/json"
		} }, 5e3, kctx);
		if (res.status === 401) return {
			ok: false,
			message: "K8s API: token rejected (401) — token expired or invalid"
		};
		if (res.status === 403) return {
			ok: false,
			message: "K8s API: forbidden (403) — insufficient RBAC permissions"
		};
		if (!res.ok) return {
			ok: false,
			message: `K8s API error: ${res.status} ${res.statusText}`
		};
		const info = await res.json();
		const expanded = expandPath(kubeconfigPath);
		let contexts = [];
		try {
			const { readFileSync: readFileSync$1 } = await import("node:fs");
			const { parse: parse$1 } = await import("yaml");
			const doc = parse$1(readFileSync$1(expanded, "utf8"));
			contexts = (doc?.contexts ?? []).map((c) => ({
				name: c?.name ?? "",
				namespace: c?.context?.namespace ?? ""
			})).filter((c) => c.name);
		} catch {}
		return {
			ok: true,
			message: `Connected to ${kctx.server} (${info.gitVersion ?? "unknown version"})`,
			server: kctx.server,
			namespace: kctx.namespace,
			contexts
		};
	} catch (err) {
		return {
			ok: false,
			message: err.message
		};
	}
}
async function k8sContexts(params) {
	const { kubeconfigPath } = params;
	if (!kubeconfigPath) return {
		ok: false,
		contexts: [],
		message: "Missing kubeconfigPath"
	};
	try {
		const expanded = expandPath(kubeconfigPath);
		const { readFileSync: readFileSync$1 } = await import("node:fs");
		const { parse: parse$1 } = await import("yaml");
		const doc = parse$1(readFileSync$1(expanded, "utf8"));
		const contexts = (doc?.contexts ?? []).map((c) => ({
			name: c?.name ?? "",
			namespace: c?.context?.namespace ?? ""
		})).filter((c) => c.name);
		return {
			ok: true,
			contexts
		};
	} catch (err) {
		return {
			ok: false,
			contexts: [],
			message: err.message
		};
	}
}
async function k8sNamespaces(params) {
	const { kubeconfigPath, context } = params;
	try {
		const kctx = parseKubeconfig(kubeconfigPath, context);
		const res = await fetchWithTimeout(`${kctx.server}/api/v1/namespaces`, { headers: {
			Authorization: `Bearer ${kctx.token}`,
			Accept: "application/json"
		} }, 5e3, kctx);
		if (!res.ok) return {
			ok: false,
			namespaces: [],
			message: `K8s API error: ${res.status}`
		};
		const data = await res.json();
		const namespaces = data.items.filter((ns) => ns.status?.phase === "Active" || !ns.status).map((ns) => ns.metadata.name);
		return {
			ok: true,
			namespaces
		};
	} catch (err) {
		return {
			ok: false,
			namespaces: [],
			message: err.message
		};
	}
}
async function k8sDeployments(params) {
	const { kubeconfigPath, context, namespace } = params;
	try {
		const kctx = parseKubeconfig(kubeconfigPath, context);
		const ns = namespace || kctx.namespace;
		const res = await fetchWithTimeout(`${kctx.server}/apis/apps/v1/namespaces/${encodeURIComponent(ns)}/deployments`, { headers: {
			Authorization: `Bearer ${kctx.token}`,
			Accept: "application/json"
		} }, 1e4, kctx);
		if (!res.ok) return {
			ok: false,
			deployments: [],
			message: `K8s API error: ${res.status}`
		};
		const data = await res.json();
		const deployments = (data.items ?? []).map((d) => {
			const spec = d.spec ?? {};
			const status = d.status ?? {};
			const image = spec?.template?.spec?.containers?.[0]?.image ?? "";
			return {
				name: d.metadata?.name ?? "",
				ready: status.readyReplicas ?? 0,
				replicas: status.replicas ?? spec.replicas ?? 0,
				image,
				imageTag: (image.split(":")[1] ?? "").slice(0, 24),
				updated: d.metadata?.creationTimestamp ?? ""
			};
		});
		return {
			ok: true,
			deployments
		};
	} catch (err) {
		return {
			ok: false,
			deployments: [],
			message: err.message
		};
	}
}
/** List merge requests for a project. */
async function gitlabMRs(params) {
	const { baseUrl, token, projectPath, state } = params;
	if (!baseUrl || !token || !projectPath) return {
		ok: false,
		mergeRequests: [],
		message: "Missing baseUrl, token or projectPath"
	};
	try {
		const stateParam = state ? `&state=${encodeURIComponent(state)}` : "&state=opened";
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(projectPath)}/merge_requests?per_page=20&order_by=updated_at&sort=desc${stateParam}`;
		const res = await fetchWithTimeout(url, { headers: { "PRIVATE-TOKEN": token } }, 1e4);
		if (!res.ok) return {
			ok: false,
			mergeRequests: [],
			message: `GitLab API error: ${res.status}`
		};
		const raw = await res.json();
		const mergeRequests = raw.map((mr) => ({
			iid: mr.iid,
			title: mr.title,
			state: mr.state,
			author: mr.author?.username ?? "unknown",
			sourceBranch: mr.source_branch,
			targetBranch: mr.target_branch,
			createdAt: mr.created_at,
			updatedAt: mr.updated_at,
			approvalsBeforeMerge: mr.approvals_before_merge ?? null,
			mergeStatus: mr.merge_status ?? "",
			workInProgress: !!mr.work_in_progress,
			draft: !!mr.draft,
			webUrl: mr.web_url
		}));
		return {
			ok: true,
			mergeRequests
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			mergeRequests: [],
			message: "Timed out"
		};
		return {
			ok: false,
			mergeRequests: [],
			message: err.message
		};
	}
}
/** List recent pipelines for a project. */
async function gitlabPipelines(params) {
	const { baseUrl, token, projectPath, ref, perPage } = params;
	if (!baseUrl || !token || !projectPath) return {
		ok: false,
		pipelines: [],
		message: "Missing baseUrl, token or projectPath"
	};
	try {
		const refParam = ref ? `&ref=${encodeURIComponent(ref)}` : "";
		const count = Math.min(perPage ?? 10, 50);
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(projectPath)}/pipelines?per_page=${count}&order_by=id&sort=desc${refParam}`;
		const res = await fetchWithTimeout(url, { headers: { "PRIVATE-TOKEN": token } }, 1e4);
		if (!res.ok) return {
			ok: false,
			pipelines: [],
			message: `GitLab API error: ${res.status}`
		};
		const raw = await res.json();
		const pipelines = raw.map((p) => ({
			id: p.id,
			status: p.status,
			ref: p.ref,
			sha: p.sha?.slice(0, 8),
			createdAt: p.created_at,
			updatedAt: p.updated_at,
			duration: p.duration
		}));
		return {
			ok: true,
			pipelines
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			pipelines: [],
			message: "Timed out"
		};
		return {
			ok: false,
			pipelines: [],
			message: err.message
		};
	}
}
/** Jobs of a pipeline (for the expandable pipeline detail view). */
async function gitlabPipelineJobs(params) {
	const { baseUrl, token, projectPath, pipelineId } = params;
	if (!baseUrl || !token || !projectPath) return {
		ok: false,
		jobs: [],
		message: "Missing params"
	};
	try {
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(projectPath)}/pipelines/${pipelineId}/jobs?per_page=50`;
		const res = await fetchWithTimeout(url, { headers: { "PRIVATE-TOKEN": token } }, 15e3);
		if (!res.ok) return {
			ok: false,
			jobs: [],
			message: `GitLab API error: ${res.status}`
		};
		const raw = await res.json();
		const jobs = raw.map((j) => ({
			id: j.id,
			name: j.name,
			stage: j.stage,
			status: j.status,
			duration: j.duration,
			failureReason: j.failure_reason || ""
		}));
		return {
			ok: true,
			jobs
		};
	} catch (err) {
		return {
			ok: false,
			jobs: [],
			message: err.message
		};
	}
}
/** Strip ANSI escape codes and gitlab-runner control lines from a raw job trace, leaving plain text. */
function cleanJobLog(s) {
	return s.replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, "").split("\n").filter((l) => !/^section_(start|end):/.test(l) && !/^get:job:/.test(l)).join("\n");
}
/** Get the build log of a single GitLab pipeline job. Tries /log (GitLab ≥12), falls back to /trace (GitLab 11.x). */
async function gitlabJobLog(params) {
	const { baseUrl, token, projectPath, jobId } = params;
	if (!baseUrl || !token || !projectPath || !jobId) return {
		ok: false,
		logs: "",
		message: "Missing params"
	};
	const jobUrl = `${baseUrl.replace(/\/+$/, "")}/projects/${projectPath}/jobs/${jobId}`;
	const apiBase = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(projectPath)}/jobs/${jobId}`;
	const authed = { headers: { "PRIVATE-TOKEN": token } };
	try {
		let res = await fetchWithTimeout(`${apiBase}/log`, authed, 15e3);
		if (res.status === 404) res = await fetchWithTimeout(`${apiBase}/trace`, authed, 15e3);
		if (res.status === 404) return {
			ok: false,
			logs: "",
			message: "未获取到日志（该 GitLab 版本无可用的日志接口），请通过 GitLab 页面查看",
			jobUrl
		};
		if (res.status === 202) return {
			ok: false,
			logs: "",
			message: "Job 仍在运行，日志暂不可用，请稍后重试",
			jobUrl
		};
		if (!res.ok) return {
			ok: false,
			logs: "",
			message: `GitLab API error: ${res.status}`,
			jobUrl
		};
		return {
			ok: true,
			logs: cleanJobLog(await res.text())
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			logs: "",
			message: "Timed out",
			jobUrl
		};
		return {
			ok: false,
			logs: "",
			message: err.message,
			jobUrl
		};
	}
}
/** List pods in a K8s namespace. */
async function k8sPods(params) {
	const { kubeconfigPath, context, namespace } = params;
	if (!kubeconfigPath || !namespace) return {
		ok: false,
		pods: [],
		message: "Missing kubeconfigPath or namespace"
	};
	try {
		const kctx = parseKubeconfig(kubeconfigPath, context);
		const res = await fetchWithTimeout(`${kctx.server}/api/v1/namespaces/${encodeURIComponent(namespace)}/pods`, { headers: {
			Authorization: `Bearer ${kctx.token}`,
			Accept: "application/json"
		} }, 1e4, kctx);
		if (!res.ok) return {
			ok: false,
			pods: [],
			message: `K8s API error: ${res.status}`
		};
		const data = await res.json();
		const pods = (data.items ?? []).map((pod) => {
			const cs = pod.status?.containerStatuses ?? [];
			const restarts = cs.reduce((sum, c) => sum + (c.restartCount ?? 0), 0);
			let reason = "";
			for (const c of cs) if (c.state?.waiting?.reason) reason = c.state.waiting.reason;
			else if (!reason && c.lastState?.terminated?.reason && c.lastState.terminated.reason !== "Completed") reason = c.lastState.terminated.reason;
			return {
				name: pod.metadata?.name,
				phase: pod.status?.phase ?? "Unknown",
				ready: cs.filter((c) => c.ready).length,
				total: cs.length,
				restarts,
				node: pod.spec?.nodeName ?? "",
				reason,
				startedAt: pod.status?.startTime ?? ""
			};
		});
		return {
			ok: true,
			pods
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			pods: [],
			message: "Timed out"
		};
		return {
			ok: false,
			pods: [],
			message: err.message
		};
	}
}
/** List recent events in a K8s namespace. */
async function k8sEvents(params) {
	const { kubeconfigPath, context, namespace, limit } = params;
	if (!kubeconfigPath || !namespace) return {
		ok: false,
		events: [],
		message: "Missing kubeconfigPath or namespace"
	};
	try {
		const kctx = parseKubeconfig(kubeconfigPath, context);
		const count = Math.min(limit ?? 20, 100);
		const res = await fetchWithTimeout(`${kctx.server}/api/v1/namespaces/${encodeURIComponent(namespace)}/events?limit=${count}&sort={by:lastTimestamp,order:descending}`, { headers: {
			Authorization: `Bearer ${kctx.token}`,
			Accept: "application/json"
		} }, 1e4, kctx);
		if (!res.ok) return {
			ok: false,
			events: [],
			message: `K8s API error: ${res.status}`
		};
		const data = await res.json();
		const events = (data.items ?? []).map((ev) => ({
			type: ev.type ?? "Normal",
			reason: ev.reason ?? "",
			message: ev.message ?? "",
			object: ev.involvedObject?.name ?? "",
			kind: ev.involvedObject?.kind ?? "",
			time: ev.lastTimestamp ?? ev.eventTime ?? ""
		}));
		return {
			ok: true,
			events
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			events: [],
			message: "Timed out"
		};
		return {
			ok: false,
			events: [],
			message: err.message
		};
	}
}
/** List repository tags for a project (newest first). */
async function gitlabTags(params) {
	const { baseUrl, token, projectPath } = params;
	if (!baseUrl || !token || !projectPath) return {
		ok: false,
		tags: [],
		message: "Missing baseUrl, token or projectPath"
	};
	try {
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(projectPath)}/repository/tags?per_page=20&order_by=updated&sort=desc`;
		const res = await fetchWithTimeout(url, { headers: { "PRIVATE-TOKEN": token } }, 1e4);
		if (!res.ok) return {
			ok: false,
			tags: [],
			message: `GitLab API error: ${res.status}`
		};
		const raw = await res.json();
		const tags = raw.map((t) => ({
			name: t.name,
			message: t.message ?? t.release?.message ?? "",
			createdAt: t.commit?.created_at ?? ""
		}));
		return {
			ok: true,
			tags
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			tags: [],
			message: "Timed out"
		};
		return {
			ok: false,
			tags: [],
			message: err.message
		};
	}
}
/** Resolve a list of usernames to GitLab user ids (best-effort) for reviewer_ids. */
async function resolveUserIds(baseUrl, token, names) {
	const ids = [];
	for (const name$1 of names) try {
		const su = await fetchWithTimeout(`${baseUrl.replace(/\/+$/, "")}/api/v4/users?search=${encodeURIComponent(name$1)}&per_page=5`, { headers: { "PRIVATE-TOKEN": token } }, 8e3);
		if (!su.ok) continue;
		const users = await su.json();
		const u = users.find((x) => x.username.toLowerCase() === name$1.toLowerCase()) ?? users[0];
		if (u?.id) ids.push(u.id);
	} catch {}
	return ids;
}
/** Create a merge request. `reviewers` is a comma/space separated username list. */
async function gitlabCreateMr(params) {
	const { baseUrl, token, projectPath, sourceBranch, targetBranch, title, description, reviewers } = params;
	if (!baseUrl || !token || !projectPath) return {
		ok: false,
		message: "Missing baseUrl, token or projectPath"
	};
	if (!sourceBranch || !targetBranch || !title) return {
		ok: false,
		message: "Missing source, target or title"
	};
	try {
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(projectPath)}/merge_requests`;
		const body = {
			source_branch: sourceBranch,
			target_branch: targetBranch,
			title,
			remove_source_branch: true
		};
		if (description) body.description = description;
		if (reviewers) {
			const names = reviewers.split(/[,，\s]+/).map((s) => s.trim().replace(/^@/, "")).filter(Boolean);
			const ids = await resolveUserIds(baseUrl, token, names);
			if (ids.length) body["reviewer_ids"] = ids;
		}
		const res = await fetchWithTimeout(url, {
			method: "POST",
			headers: {
				"PRIVATE-TOKEN": token,
				"Content-Type": "application/json"
			},
			body: JSON.stringify(body)
		}, 1e4);
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			return {
				ok: false,
				message: `GitLab API error: ${res.status}${detail ? " | " + detail.slice(0, 160) : ""}`
			};
		}
		const mr = await res.json();
		return {
			ok: true,
			mergeRequest: {
				iid: mr.iid,
				title: mr.title,
				webUrl: mr.web_url
			}
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			message: "Timed out"
		};
		return {
			ok: false,
			message: err.message
		};
	}
}
/** Create a lightweight tag. */
async function gitlabCreateTag(params) {
	const { baseUrl, token, projectPath, tagName, ref, message } = params;
	if (!baseUrl || !token || !projectPath) return {
		ok: false,
		message: "Missing baseUrl, token or projectPath"
	};
	if (!tagName || !ref) return {
		ok: false,
		message: "Missing tag name or ref"
	};
	try {
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(projectPath)}/repository/tags`;
		const body = {
			tag_name: tagName,
			ref
		};
		if (message) body.message = message;
		const res = await fetchWithTimeout(url, {
			method: "POST",
			headers: {
				"PRIVATE-TOKEN": token,
				"Content-Type": "application/json"
			},
			body: JSON.stringify(body)
		}, 1e4);
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			return {
				ok: false,
				message: `GitLab API error: ${res.status}${detail ? " | " + detail.slice(0, 160) : ""}`
			};
		}
		const tag = await res.json();
		return {
			ok: true,
			tag: { name: tag.name }
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			message: "Timed out"
		};
		return {
			ok: false,
			message: err.message
		};
	}
}
/** Cancel or retry a pipeline. `action` is 'cancel' or 'retry'. */
async function gitlabPipelineAction(params) {
	const { baseUrl, token, projectPath, pipelineId, action } = params;
	if (!baseUrl || !token || !projectPath) return {
		ok: false,
		message: "Missing baseUrl, token or projectPath"
	};
	if (!["cancel", "retry"].includes(action)) return {
		ok: false,
		message: "action must be 'cancel' or 'retry'"
	};
	try {
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(projectPath)}/pipelines/${pipelineId}/${action}`;
		const res = await fetchWithTimeout(url, {
			method: "POST",
			headers: { "PRIVATE-TOKEN": token }
		}, 1e4);
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			return {
				ok: false,
				message: `GitLab API error: ${res.status}${detail ? " | " + detail.slice(0, 160) : ""}`
			};
		}
		return { ok: true };
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			message: "Timed out"
		};
		return {
			ok: false,
			message: err.message
		};
	}
}
/** Approve a merge request (uses the caller token's approval). */
async function gitlabMrApprove(params) {
	const { baseUrl, token, projectPath, mrIid } = params;
	if (!baseUrl || !token || !projectPath) return {
		ok: false,
		message: "Missing baseUrl, token or projectPath"
	};
	try {
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(projectPath)}/merge_requests/${mrIid}/approve`;
		const res = await fetchWithTimeout(url, {
			method: "POST",
			headers: { "PRIVATE-TOKEN": token }
		}, 1e4);
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			return {
				ok: false,
				message: `GitLab API error: ${res.status}${detail ? " | " + detail.slice(0, 160) : ""}`
			};
		}
		const mr = await res.json();
		return {
			ok: true,
			approvalsBeforeMerge: mr.approvals_before_merge ?? null
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			message: "Timed out"
		};
		return {
			ok: false,
			message: err.message
		};
	}
}
/** Close / reopen a merge request. */
async function gitlabMrAction(params) {
	const { baseUrl, token, projectPath, mrIid, action } = params;
	if (!baseUrl || !token || !projectPath) return {
		ok: false,
		message: "Missing baseUrl, token or projectPath"
	};
	if (!["close", "reopen"].includes(action)) return {
		ok: false,
		message: `Unknown action: ${action}`
	};
	try {
		const url = `${baseUrl.replace(/\/+$/, "")}/api/v4/projects/${encodeURIComponent(projectPath)}/merge_requests/${mrIid}`;
		const res = await fetchWithTimeout(url, {
			method: "PUT",
			headers: {
				"PRIVATE-TOKEN": token,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ state_event: action })
		}, 1e4);
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			return {
				ok: false,
				message: `GitLab API error: ${res.status}${detail ? " | " + detail.slice(0, 160) : ""}`
			};
		}
		const mr = await res.json();
		return {
			ok: true,
			state: mr.state ?? action
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			message: "Timed out"
		};
		return {
			ok: false,
			message: err.message
		};
	}
}
/** Tail the logs of a pod container (plain text). */
async function k8sPodLogs(params) {
	const { kubeconfigPath, context, namespace, podName, container, tailLines } = params;
	if (!kubeconfigPath || !namespace || !podName) return {
		ok: false,
		logs: "",
		message: "Missing kubeconfigPath, namespace or podName"
	};
	try {
		const kctx = parseKubeconfig(kubeconfigPath, context);
		const n = Math.min(tailLines ?? 100, 1e3);
		const containerParam = container ? `&container=${encodeURIComponent(container)}` : "";
		const res = await fetchWithTimeout(`${kctx.server}/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(podName)}/log?tailLines=${n}${containerParam}`, { headers: {
			Authorization: `Bearer ${kctx.token}`,
			Accept: "application/json"
		} }, 1e4, kctx);
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			return {
				ok: false,
				logs: "",
				message: `K8s API error: ${res.status}${detail ? " | " + detail.slice(0, 160) : ""}`
			};
		}
		return {
			ok: true,
			logs: await res.text()
		};
	} catch (err) {
		if (err.name === "AbortError") return {
			ok: false,
			logs: "",
			message: "Timed out"
		};
		return {
			ok: false,
			logs: "",
			message: err.message
		};
	}
}
/** PATCH a deployment (strategic-merge) — used for image change and restart. */
async function k8sPatchDeployment(params) {
	const { kubeconfigPath, context, namespace, name: name$1, patch } = params;
	if (!kubeconfigPath || !namespace || !name$1 || !patch) return {
		ok: false,
		message: "Missing params"
	};
	try {
		const kctx = parseKubeconfig(kubeconfigPath, context);
		const res = await httpsGet(`${kctx.server}/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name$1)}`, {
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${kctx.token}`,
				Accept: "application/json",
				"Content-Type": "application/strategic-merge-patch+json"
			},
			body: JSON.stringify(patch),
			ca: kctx.caData ? Buffer.from(kctx.caData, "base64") : void 0,
			insecureSkipTlsVerify: kctx.insecureSkipTlsVerify
		});
		const text = await res.text();
		if (!res.ok) return {
			ok: false,
			message: `K8s API error: ${res.status}${text ? " | " + text.slice(0, 160) : ""}`
		};
		return { ok: true };
	} catch (err) {
		return {
			ok: false,
			message: err.message
		};
	}
}
/** Change the image of a deployment's first container (or the named one). */
async function k8sSetImage(params) {
	const { kubeconfigPath, context, namespace, name: name$1, image, container } = params;
	if (!image) return {
		ok: false,
		message: "Missing image"
	};
	try {
		const kctx = parseKubeconfig(kubeconfigPath, context);
		let containerName = container;
		if (!containerName) {
			const res = await fetchWithTimeout(`${kctx.server}/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name$1)}`, { headers: {
				Authorization: `Bearer ${kctx.token}`,
				Accept: "application/json"
			} }, 1e4, kctx);
			if (!res.ok) return {
				ok: false,
				message: `K8s API error: ${res.status}`
			};
			const dep = await res.json();
			containerName = dep?.spec?.template?.spec?.containers?.[0]?.name;
			if (!containerName) return {
				ok: false,
				message: "Deployment has no containers"
			};
		}
		return k8sPatchDeployment({
			...params,
			patch: { spec: { template: { spec: { containers: [{
				name: containerName,
				image
			}] } } } }
		});
	} catch (err) {
		return {
			ok: false,
			message: err.message
		};
	}
}
/** Restart a deployment (annotate pod template with restartedAt, like kubectl rollout restart). */
async function k8sRestartDeployment(params) {
	return k8sPatchDeployment({
		...params,
		patch: { spec: { template: { metadata: { annotations: { "kubectl.kubernetes.io/restartedAt": new Date().toISOString() } } } } }
	});
}
async function browseFile(_params) {
	const platform = process.platform;
	if (platform === "win32") {
		const { execFile } = await import("node:child_process");
		const script = [
			"Add-Type -AssemblyName System.Windows.Forms",
			"$d = New-Object System.Windows.Forms.OpenFileDialog",
			"$d.Title = '选择 kubeconfig 文件'",
			"$d.Filter = '配置文件 (*.yaml;*.yml;*.json;*.config)|*.yaml;*.yml;*.json;*.config|所有文件 (*.*)|*.*'",
			"$r = $d.ShowDialog()",
			"if ($r -eq [System.Windows.Forms.DialogResult]::OK) { $d.FileName }"
		].join("; ");
		return new Promise((resolve) => {
			execFile("powershell", [
				"-NoProfile",
				"-NonInteractive",
				"-Command",
				script
			], { timeout: 12e4 }, (err, stdout, stderr) => {
				const path = stdout?.trim();
				if (err && !path) {
					console.error("[dsh-devops] browse-file error:", err.message, stderr?.trim() || "");
					resolve({
						ok: false,
						path: "",
						message: err.message
					});
				} else resolve({
					ok: true,
					path: path || ""
				});
			});
		});
	}
	return {
		ok: false,
		path: "",
		message: "File browse not supported on this platform"
	};
}
const CONFIG_DIR = join(homedir(), ".dsh-devops");
const CONFIG_FILE$1 = join(CONFIG_DIR, "config.json");
const LOG_FILE = join(CONFIG_DIR, "devops.log");
const MAX_LOG_SIZE = 5 * 1024 * 1024;
function ensureConfigDir() {
	if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
}
/** Write a log entry to ~/.dsh-devops/devops.log */
function writeLog(level, message, detail) {
	try {
		ensureConfigDir();
		try {
			const st = statSync(LOG_FILE);
			if (st.size > MAX_LOG_SIZE) {
				const content = readFileSync(LOG_FILE, "utf8");
				writeFileSync(LOG_FILE, content.slice(-512 * 1024), "utf8");
			}
		} catch {}
		const ts = new Date().toISOString();
		const line = `[${ts}] [${level.toUpperCase()}] ${message}${detail ? " | " + detail : ""}\n`;
		appendFileSync(LOG_FILE, line, "utf8");
	} catch {}
}
/** Read log entries for the API */
function readLogs(params) {
	try {
		if (!existsSync(LOG_FILE)) return {
			ok: true,
			lines: []
		};
		const raw = readFileSync(LOG_FILE, "utf8");
		let allLines = raw.split("\n").filter(Boolean);
		const level = (params.level ?? "").toLowerCase();
		if (level) allLines = allLines.filter((l) => l.includes(`[${level.toUpperCase()}]`));
		const search = (params.search ?? "").toLowerCase();
		if (search) allLines = allLines.filter((l) => l.toLowerCase().includes(search));
		const limit = Math.min(Number(params.lines) || 200, 5e3);
		allLines = allLines.slice(-limit);
		return {
			ok: true,
			lines: allLines
		};
	} catch (err) {
		return {
			ok: false,
			lines: [],
			message: err.message
		};
	}
}
function saveConfig(params) {
	try {
		ensureConfigDir();
		let existing = {};
		if (existsSync(CONFIG_FILE$1)) try {
			existing = JSON.parse(readFileSync(CONFIG_FILE$1, "utf8"));
		} catch {
			existing = {};
		}
		if (!existing || typeof existing !== "object" || Array.isArray(existing)) existing = {};
		writeFileSync(CONFIG_FILE$1, JSON.stringify({
			...existing,
			...params
		}, null, 2), "utf8");
		writeLog("info", "save-config", "config written");
		return {
			ok: true,
			message: "配置已保存"
		};
	} catch (err) {
		writeLog("error", "save-config", err.message);
		return {
			ok: false,
			message: `保存失败: ${err.message}`
		};
	}
}
function loadConfig(_params) {
	try {
		if (!existsSync(CONFIG_FILE$1)) return {
			ok: true,
			config: null
		};
		const raw = readFileSync(CONFIG_FILE$1, "utf8");
		const config = JSON.parse(raw);
		return {
			ok: true,
			config
		};
	} catch (err) {
		return {
			ok: false,
			config: null,
			message: err.message
		};
	}
}
/**

* Register the /devops/api HTTP prefix route.

* Called from the plugin's `apply()` function.

*/
function registerDevopsApi(ctx) {
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: "/devops/api",
		handler: async (req, res) => {
			if (!isLocalhost(req)) {
				writeJson(res, 403, {
					ok: false,
					message: "Forbidden"
				});
				return;
			}
			if (req.method !== "POST") {
				writeJson(res, 405, {
					ok: false,
					message: "Method not allowed"
				});
				return;
			}
			const pathname = new URL(req.url ?? "/", "http://dsh.internal").pathname;
			const method = pathname.startsWith("/devops/api/") ? pathname.slice(12) : pathname.startsWith("/") ? pathname.slice(1) : "";
			const handlers = {
				"test-gitlab": testGitLab,
				"gitlab-projects": gitlabProjects,
				"gitlab-branches": gitlabBranches,
				"gitlab-mrs": gitlabMRs,
				"gitlab-pipelines": gitlabPipelines,
				"gitlab-tags": gitlabTags,
				"gitlab-members": gitlabMembers,
				"gitlab-last-commit": gitlabLastCommit,
				"gitlab-create-mr": gitlabCreateMr,
				"gitlab-create-tag": gitlabCreateTag,
				"gitlab-pipeline-action": gitlabPipelineAction,
				"gitlab-mr-approve": gitlabMrApprove,
				"gitlab-mr-action": gitlabMrAction,
				"gitlab-pipeline-jobs": gitlabPipelineJobs,
				"gitlab-job-log": gitlabJobLog,
				"k8s-set-image": k8sSetImage,
				"k8s-restart": k8sRestartDeployment,
				"test-k8s": testK8s,
				"k8s-contexts": k8sContexts,
				"k8s-namespaces": k8sNamespaces,
				"k8s-deployments": k8sDeployments,
				"k8s-pods": k8sPods,
				"k8s-events": k8sEvents,
				"k8s-pod-logs": k8sPodLogs,
				"browse-file": browseFile,
				"save-config": saveConfig,
				"load-config": loadConfig,
				"logs": readLogs
			};
			const handler = handlers[method];
			if (!handler) {
				writeJson(res, 404, {
					ok: false,
					message: `Unknown method: ${method}`
				});
				return;
			}
			const started = Date.now();
			try {
				const body = await readBody(req);
				const inSnippet = JSON.stringify(body).slice(0, 400);
				const result = await handler(body);
				const ms = Date.now() - started;
				const outSnippet = JSON.stringify(result).slice(0, 400);
				writeLog(result?.ok === false ? "warn" : "info", `POST /devops/api/${method}`, `${ms}ms | in=${inSnippet} | out=${outSnippet}`);
				writeJson(res, 200, result);
			} catch (err) {
				const ms = Date.now() - started;
				writeLog("error", `POST /devops/api/${method}`, `${ms}ms | ${err.message}`);
				writeJson(res, 500, {
					ok: false,
					message: err.message ?? "Internal error"
				});
			}
		}
	}), "dsh-devops: /devops/api routes");
}

//#endregion
//#region src/runtime-config.ts
const CONFIG_FILE = join(homedir(), ".dsh-devops", "config.json");
const NOT_CONFIGURED_MSG = "[dsh-devops] Not configured yet — open DSH Settings → DevOps, add the connection info, and save.";
/** Read the raw settings-file config (null when missing/corrupt). */
function readConfigJson() {
	try {
		if (!existsSync(CONFIG_FILE)) return null;
		return JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
	} catch {
		return null;
	}
}
/** Minimal server-side mirror of the client's migrateConfig (legacy → servers list). */
function normalizeConfigJson(raw) {
	if (!raw || typeof raw !== "object") return raw;
	const out = JSON.parse(JSON.stringify(raw));
	const gl = out.gitlab || {};
	if (!Array.isArray(gl.servers) && gl.baseUrl) {
		const legacyProject = Array.isArray(gl.projects) ? gl.projects[0] : null;
		gl.servers = [{
			id: "s1",
			label: "GitLab",
			baseUrl: gl.baseUrl,
			token: gl.token || "",
			projectPath: legacyProject?.path || "",
			branch: legacyProject?.defaultBranch || ""
		}];
	}
	const k8s = out.k8s || {};
	if (!Array.isArray(k8s.kubeconfigs) && k8s.kubeconfigPath) k8s.kubeconfigs = [{
		id: "k1",
		path: k8s.kubeconfigPath,
		context: k8s.context || "",
		namespace: k8s.namespace || ""
	}];
	out.gitlab = gl;
	out.k8s = k8s;
	return out;
}
/**
* Resolve the effective GitLab config.
* Returns null when neither source has a usable GitLab section.
*/
function resolveGitLabConfig(cordisRaw) {
	const raw = cordisRaw && typeof cordisRaw === "object" ? cordisRaw : {};
	if (raw.gitlab && typeof raw.gitlab === "object" && raw.gitlab.baseUrl) return raw.gitlab;
	const file = normalizeConfigJson(readConfigJson());
	const gl = file?.gitlab || {};
	const servers = Array.isArray(gl.servers) ? gl.servers : [];
	const active = servers.find((s) => s.id === gl.activeServerId) || servers[0];
	if (!active?.baseUrl || !active?.token || !active?.projectPath) return null;
	const usable = servers.filter((s) => s.baseUrl && s.token);
	return {
		baseUrl: active.baseUrl,
		token: active.token,
		defaultProject: active.id,
		projects: usable.map((s) => ({
			id: s.id,
			path: s.projectPath || "",
			token: s.token,
			defaultBranch: s.branch || void 0
		}))
	};
}
/**
* Resolve the effective K8s config.
* Returns null when neither source has a usable K8s section.
*/
function resolveK8sConfig(cordisRaw) {
	const raw = cordisRaw && typeof cordisRaw === "object" ? cordisRaw : {};
	if (raw.k8s && typeof raw.k8s === "object" && Array.isArray(raw.k8s.kubeconfigs) && raw.k8s.kubeconfigs.length) return raw.k8s;
	const file = normalizeConfigJson(readConfigJson());
	const k8s = file?.k8s || {};
	const kcList = Array.isArray(k8s.kubeconfigs) ? k8s.kubeconfigs : [];
	const usable = kcList.filter((k) => k.path);
	if (!usable.length) return null;
	const active = usable.find((k) => k.id === k8s.activeKubeconfigId) || usable[0];
	return {
		kubeconfigs: usable.map((k) => ({
			id: k.id,
			path: k.path,
			context: k.context || void 0,
			namespace: k.namespace || void 0
		})),
		defaultContext: active.id
	};
}

//#endregion
//#region src/runtime/lazy.ts
function notConfigured() {
	throw new Error(NOT_CONFIGURED_MSG);
}
/**
* GitLab service that rebuilds its router from the effective config on every
* call. Cheap: the underlying client is stateless HTTP.
*/
function createLazyGitLabService(ctx, cordisRaw) {
	function router() {
		const cfg = resolveGitLabConfig(cordisRaw);
		if (!cfg) notConfigured();
		try {
			return new GitLabRouter(cfg.baseUrl, cfg.projects, cfg.defaultProject);
		} catch (err) {
			ctx.log?.warn?.(`[dsh-devops] GitLab router build failed: ${err.message}`);
			throw err;
		}
	}
	return {
		listProjects: () => {
			const r = router();
			return r ? r.list() : [];
		},
		createMR: (p, s, t, title, desc) => router().resolve(p).createMR(s, t, title, desc),
		approveMR: (p, iid) => router().resolve(p).approveMR(iid),
		requestChanges: (p, iid, c) => router().resolve(p).requestChanges(iid, c),
		commentMR: (p, iid, body) => router().resolve(p).commentMR(iid, body),
		listMRs: (p) => router().resolve(p).listMRs(),
		createTag: (p, name$1, ref, msg) => router().resolve(p).createTag(name$1, ref, msg),
		getPipeline: (p, id) => router().resolve(p).getPipeline(id),
		getLatestPipelineByRef: (p, ref) => router().resolve(p).getLatestPipelineByRef(ref),
		listPipelineJobs: (p, id) => router().resolve(p).listPipelineJobs(id),
		getJobLog: (p, id) => router().resolve(p).getJobLog(id)
	};
}
/**
* K8s service that rebuilds its router from the effective config on every
* call. Re-parses kubeconfig files per call (~ms file IO) in exchange for
* always-current cluster/context/namespace selection.
*/
function createLazyK8sService(ctx, cordisRaw) {
	function router() {
		const cfg = resolveK8sConfig(cordisRaw);
		if (!cfg) notConfigured();
		try {
			return new K8sRouter(cfg.kubeconfigs, cfg.defaultContext, cfg.defaultNamespace);
		} catch (err) {
			ctx.log?.warn?.(`[dsh-devops] K8s router build failed: ${err.message}`);
			throw err;
		}
	}
	return {
		listClusters: () => {
			const r = router();
			return r ? r.list() : [];
		},
		getDefaultNamespace: (cluster) => router().getDefaultNamespace(cluster),
		getDeploymentStatus: (c, ns, name$1) => router().resolve(c).getDeployment(ns, name$1),
		getDeploymentStatusList: (c, ns) => router().resolve(c).getDeployments(ns),
		getPodList: (c, ns) => router().resolve(c).getPods(ns),
		getEvents: (c, ns, limit) => router().resolve(c).getEvents(ns, limit),
		getPodLogs: (c, ns, podName, container, tailLines) => router().resolve(c).getPodLogs(ns, podName, container, tailLines)
	};
}

//#endregion
//#region src/index.ts
const name = "dsh-devops";
const inject = ["webServer", "tools"];
/**

* Plugin apply function — called by the DSH/Cordis loader.

*

* @param ctx - The DSH host context (services, tools, events, effects, etc.)

* @param rawConfig - Raw user config from cordis.yml

*/
function apply(ctx, rawConfig) {
	const raw = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
	const config = parseConfig(raw);
	const gitlabService = createLazyGitLabService(ctx, raw);
	const k8sService = createLazyK8sService(ctx, raw);
	registerTools(ctx, {
		gitlab: gitlabService,
		k8s: k8sService
	});
	if (config.webhook) registerWebhook(ctx, config.webhook);
	if (config.monitor) {
		const eagerGitlab = config.gitlab ? registerGitLab(ctx, config.gitlab) : gitlabService;
		const eagerK8s = config.k8s ? registerK8s(ctx, config.k8s) : k8sService;
		startMonitor(ctx, config.monitor, {
			gitlab: eagerGitlab,
			k8s: eagerK8s
		});
	}
	registerDevopsApi(ctx);
}

//#endregion
export { Config, apply, inject, name };